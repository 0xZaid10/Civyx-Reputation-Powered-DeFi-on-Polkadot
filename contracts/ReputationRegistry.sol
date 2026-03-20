// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

interface IIdentityRegistryLookup {
    function getCommitment(address wallet) external view returns (bytes32);
    function getIdentityStake(address wallet) external view returns (uint256);
}

/**
 * @title  ReputationRegistry
 * @notice Manages global and application-specific reputation for Civyx identities.
 *
 *         Reputation is tied to identity commitments, not wallet addresses,
 *         so it persists across wallet changes.
 *
 * @dev    Uses OpenZeppelin AccessControl, Pausable.
 *
 *         Endorsement Anti-Farming Design:
 *         ─────────────────────────────────
 *         Four layered protections prevent reputation farming:
 *
 *         1. OWNERSHIP CHECK
 *            msg.sender must own the endorserCommitment.
 *            Prevents: using someone else's commitment to endorse.
 *
 *         2. MINIMUM REPUTATION TO ENDORSE
 *            Endorser must have >= MIN_REPUTATION_TO_ENDORSE global reputation.
 *            Prevents: fresh zero-rep identities farming each other.
 *            Breaks the bootstrap loop — you cannot start from nothing.
 *
 *         3. TIERED ENDORSEMENT WEIGHT
 *            Endorsement value scales with endorser's reputation tier:
 *              Tier 1 (rep  0–99):  weight = 1  (fresh identity, low trust)
 *              Tier 2 (rep 100–299): weight = 3
 *              Tier 3 (rep 300–599): weight = 5
 *              Tier 4 (rep 600+):   weight = 10 (highly trusted, high impact)
 *            Prevents: 100 low-rep identities generating same value as
 *            10 high-rep identities.
 *
 *         4. ENDORSEMENT COOLDOWN
 *            Each identity can only endorse once per ENDORSEMENT_COOLDOWN blocks.
 *            Prevents: rapid sequential endorsements even with high-rep identity.
 *
 *         5. MAX ENDORSEMENTS RECEIVED
 *            Each identity can only receive MAX_ENDORSEMENTS_RECEIVED endorsements.
 *            Prevents: pile-on boosting where 1000 people all endorse one identity.
 *            Forces reputation to be earned through activity, not popularity.
 */
contract ReputationRegistry is AccessControl, Pausable {

    // -------------------------------------------------------------------------
    // Roles
    // -------------------------------------------------------------------------

    bytes32 public constant PAUSER_ROLE        = keccak256("PAUSER_ROLE");
    bytes32 public constant REPUTATION_UPDATER = keccak256("REPUTATION_UPDATER");
    bytes32 public constant APP_MANAGER        = keccak256("APP_MANAGER");

    // -------------------------------------------------------------------------
    // Constants
    // -------------------------------------------------------------------------

    uint256 public constant MAX_REPUTATION            = 1000;

    /// @notice Minimum global reputation required to endorse others.
    ///         Breaks the zero-rep bootstrap farming loop.
    uint256 public constant MIN_REPUTATION_TO_ENDORSE = 50;

    /// @notice Maximum endorsements any identity can receive.
    ///         Prevents pile-on boosting. After this, endorsements are ignored.
    uint256 public constant MAX_ENDORSEMENTS_RECEIVED = 20;

    /// @notice Blocks between endorsements from the same identity.
    ///         ~1 hour on Polkadot Hub (6s blocks = 600 blocks/hour).
    uint256 public constant ENDORSEMENT_COOLDOWN      = 600;

    // -------------------------------------------------------------------------
    // State
    // -------------------------------------------------------------------------

    /// @notice Reference to IdentityRegistry to verify commitment ownership
    IIdentityRegistryLookup public identityRegistry;

    /// @notice commitment => global reputation score (0–MAX_REPUTATION)
    mapping(bytes32 => uint256) public globalReputation;

    /// @notice appId => commitment => local reputation score
    mapping(bytes32 => mapping(bytes32 => uint256)) public localReputation;

    /// @notice commitment => total weighted endorsement points received
    mapping(bytes32 => uint256) public endorsementPoints;

    /// @notice commitment => number of endorsements received (unweighted count)
    mapping(bytes32 => uint256) public endorsementCount;

    /// @notice endorser => endorsed => has endorsed flag (one per pair, ever)
    mapping(bytes32 => mapping(bytes32 => bool)) public hasEndorsed;

    /// @notice endorser => last block they endorsed at (for cooldown)
    mapping(bytes32 => uint256) public lastEndorsedBlock;

    /// @notice appId => registered flag
    mapping(bytes32 => bool) public registeredApps;

    /// @notice appId => human-readable name
    mapping(bytes32 => string) public appNames;

    // -------------------------------------------------------------------------
    // Events
    // -------------------------------------------------------------------------

    event GlobalReputationUpdated(bytes32 indexed commitment, uint256 oldScore, uint256 newScore);
    event LocalReputationSet(bytes32 indexed appId, bytes32 indexed commitment, uint256 score);
    event IdentityEndorsed(
        bytes32 indexed endorser,
        bytes32 indexed endorsed,
        uint256 weight,
        uint256 endorserReputation
    );
    event AppRegistered(bytes32 indexed appId, string name);

    // -------------------------------------------------------------------------
    // Errors
    // -------------------------------------------------------------------------

    error AppNotRegistered(bytes32 appId);
    error AppAlreadyRegistered(bytes32 appId);
    error AlreadyEndorsed(bytes32 endorser, bytes32 endorsed);
    error CannotEndorseSelf();
    error ScoreExceedsMax(uint256 score, uint256 max);
    error ZeroCommitment();
    error NotCommitmentOwner();
    error InsufficientReputationToEndorse(uint256 current, uint256 required);
    error EndorsementCooldownActive(uint256 currentBlock, uint256 availableAt);
    error EndorsementCapReached(bytes32 endorsed, uint256 cap);

    // -------------------------------------------------------------------------
    // Constructor
    // -------------------------------------------------------------------------

    constructor(address _admin, address _identityRegistry) {
        require(_admin != address(0),            "ReputationRegistry: zero admin");
        require(_identityRegistry != address(0), "ReputationRegistry: zero registry");

        _grantRole(DEFAULT_ADMIN_ROLE, _admin);
        _grantRole(PAUSER_ROLE,        _admin);
        _grantRole(REPUTATION_UPDATER, _admin);
        _grantRole(APP_MANAGER,        _admin);

        identityRegistry = IIdentityRegistryLookup(_identityRegistry);
    }

    // -------------------------------------------------------------------------
    // Global Reputation
    // -------------------------------------------------------------------------

    /**
     * @notice Add reputation points to an identity (capped at MAX_REPUTATION).
     * @dev    Only REPUTATION_UPDATER. Called by trusted oracles or governance.
     */
    function addGlobalReputation(bytes32 commitment, uint256 score)
        external
        onlyRole(REPUTATION_UPDATER)
        whenNotPaused
    {
        if (commitment == bytes32(0)) revert ZeroCommitment();
        uint256 oldScore = globalReputation[commitment];
        uint256 newScore = oldScore + score;
        if (newScore > MAX_REPUTATION) newScore = MAX_REPUTATION;
        globalReputation[commitment] = newScore;
        emit GlobalReputationUpdated(commitment, oldScore, newScore);
    }

    /**
     * @notice Slash reputation points from an identity (floors at 0).
     * @dev    Only REPUTATION_UPDATER.
     */
    function slashGlobalReputation(bytes32 commitment, uint256 score)
        external
        onlyRole(REPUTATION_UPDATER)
        whenNotPaused
    {
        if (commitment == bytes32(0)) revert ZeroCommitment();
        uint256 oldScore = globalReputation[commitment];
        uint256 newScore = oldScore > score ? oldScore - score : 0;
        globalReputation[commitment] = newScore;
        emit GlobalReputationUpdated(commitment, oldScore, newScore);
    }

    /**
     * @notice Returns effective reputation = global score + endorsement bonus.
     *         Endorsement bonus = endorsementPoints (already weighted).
     *         Capped at MAX_REPUTATION.
     */
    function getEffectiveReputation(bytes32 commitment) external view returns (uint256) {
        uint256 base  = globalReputation[commitment];
        uint256 bonus = endorsementPoints[commitment];
        uint256 total = base + bonus;
        return total > MAX_REPUTATION ? MAX_REPUTATION : total;
    }

    // -------------------------------------------------------------------------
    // Endorsements
    // -------------------------------------------------------------------------

    /**
     * @notice Returns the endorsement weight for a given reputation score.
     *
     *         Tiered system — higher reputation = more impactful endorsement:
     *           0–49   rep: weight 0  (cannot endorse — below minimum)
     *           50–99  rep: weight 1  (entry level)
     *           100–299 rep: weight 3
     *           300–599 rep: weight 5
     *           600+   rep: weight 10 (trusted community member)
     *
     * @param rep  The endorser's current global reputation score
     */
    function getEndorsementWeight(uint256 rep) public pure returns (uint256) {
        if (rep >= 600) return 10;
        if (rep >= 300) return 5;
        if (rep >= 100) return 3;
        if (rep >= 50)  return 1;
        return 0;
    }

    /**
     * @notice Endorse another identity.
     *
     * @dev    Production-grade anti-farming with 5 layered checks:
     *         1. Ownership    — msg.sender must own endorserCommitment
     *         2. Min rep      — endorser needs >= MIN_REPUTATION_TO_ENDORSE
     *         3. Cooldown     — one endorsement per ENDORSEMENT_COOLDOWN blocks
     *         4. One per pair — cannot endorse same identity twice (ever)
     *         5. Cap          — endorsed identity cannot receive > MAX_ENDORSEMENTS_RECEIVED
     *
     *         Weight scales with endorser tier so 100 fresh identities cannot
     *         replicate the value of 10 established identities.
     *
     * @param endorserCommitment  The calling wallet's identity commitment
     * @param endorsedCommitment  The identity being endorsed
     */
    function endorseIdentity(bytes32 endorserCommitment, bytes32 endorsedCommitment)
        external
        whenNotPaused
    {
        // ── Basic validation ─────────────────────────────────────────────────
        if (endorserCommitment == bytes32(0) || endorsedCommitment == bytes32(0))
            revert ZeroCommitment();
        if (endorserCommitment == endorsedCommitment)
            revert CannotEndorseSelf();

        // ── Check 1: Ownership ───────────────────────────────────────────────
        // msg.sender must own the endorserCommitment.
        if (identityRegistry.getCommitment(msg.sender) != endorserCommitment)
            revert NotCommitmentOwner();

        // ── Check 2: Minimum reputation to endorse ───────────────────────────
        // Endorser must have earned minimum reputation through legitimate activity.
        // This breaks the zero-rep bootstrap farming loop.
        uint256 endorserRep = globalReputation[endorserCommitment];
        if (endorserRep < MIN_REPUTATION_TO_ENDORSE)
            revert InsufficientReputationToEndorse(endorserRep, MIN_REPUTATION_TO_ENDORSE);

        // ── Check 3: Cooldown ────────────────────────────────────────────────
        // One endorsement per ENDORSEMENT_COOLDOWN blocks per identity.
        uint256 availableAt = lastEndorsedBlock[endorserCommitment] + ENDORSEMENT_COOLDOWN;
        if (block.number < availableAt)
            revert EndorsementCooldownActive(block.number, availableAt);

        // ── Check 4: One per pair ────────────────────────────────────────────
        // Cannot endorse the same identity twice, ever.
        if (hasEndorsed[endorserCommitment][endorsedCommitment])
            revert AlreadyEndorsed(endorserCommitment, endorsedCommitment);

        // ── Check 5: Cap on endorsements received ────────────────────────────
        // Prevents pile-on boosting where everyone endorses one popular identity.
        if (endorsementCount[endorsedCommitment] >= MAX_ENDORSEMENTS_RECEIVED)
            revert EndorsementCapReached(endorsedCommitment, MAX_ENDORSEMENTS_RECEIVED);

        // ── Compute weighted endorsement value ───────────────────────────────
        uint256 weight = getEndorsementWeight(endorserRep);

        // ── Commit state changes ─────────────────────────────────────────────
        hasEndorsed[endorserCommitment][endorsedCommitment] = true;
        lastEndorsedBlock[endorserCommitment]               = block.number;
        endorsementCount[endorsedCommitment]++;
        endorsementPoints[endorsedCommitment]              += weight;

        emit IdentityEndorsed(endorserCommitment, endorsedCommitment, weight, endorserRep);
    }

    // -------------------------------------------------------------------------
    // Application-Specific Reputation
    // -------------------------------------------------------------------------

    /**
     * @notice Register an application that can maintain its own reputation list.
     * @dev    Only APP_MANAGER.
     */
    function registerApp(bytes32 appId, string calldata name)
        external
        onlyRole(APP_MANAGER)
    {
        if (registeredApps[appId]) revert AppAlreadyRegistered(appId);
        registeredApps[appId] = true;
        appNames[appId]        = name;
        emit AppRegistered(appId, name);
    }

    /**
     * @notice Set an application-specific reputation score for an identity.
     * @dev    Only APP_MANAGER. App must be registered first.
     */
    function setLocalReputation(bytes32 appId, bytes32 commitment, uint256 score)
        external
        onlyRole(APP_MANAGER)
        whenNotPaused
    {
        if (!registeredApps[appId])   revert AppNotRegistered(appId);
        if (commitment == bytes32(0)) revert ZeroCommitment();
        if (score > MAX_REPUTATION)   revert ScoreExceedsMax(score, MAX_REPUTATION);
        localReputation[appId][commitment] = score;
        emit LocalReputationSet(appId, commitment, score);
    }

    /// @notice Get application-specific reputation for an identity
    function getLocalReputation(bytes32 appId, bytes32 commitment)
        external
        view
        returns (uint256)
    {
        return localReputation[appId][commitment];
    }

    // -------------------------------------------------------------------------
    // Admin
    // -------------------------------------------------------------------------

    function setIdentityRegistry(address newRegistry) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(newRegistry != address(0), "ReputationRegistry: zero address");
        identityRegistry = IIdentityRegistryLookup(newRegistry);
    }

    function pause()   external onlyRole(PAUSER_ROLE) { _pause(); }
    function unpause() external onlyRole(PAUSER_ROLE) { _unpause(); }
}

