// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

interface IIdentityRegistry {
    function verifyIdentity(address wallet) external view returns (bool);
    function getCommitment(address wallet)  external view returns (bytes32);
}

interface ITaskRewardDispenser {
    function awardTask(bytes32 commitment, bytes32 taskId) external;
}

interface IOrganizerRegistry {
    function isActive(bytes32 orgId) external view returns (bool);
    function getOrganizer(bytes32 orgId) external view returns (
        address owner,
        string memory name,
        uint256 minStake,
        uint256 minReputation,
        bool active,
        uint256 registeredAt
    );
}

/**
 * @title  GovernanceVoteTask
 * @notice Awards reputation when a registered identity votes in a governance proposal.
 *
 *         Design:
 *           - Any active organizer in OrganizerRegistry can register proposals
 *           - Identity holders claim their reward after voting off-chain or on-chain
 *           - One reward per identity per proposal — enforced by TaskRewardDispenser
 *           - Organizer is trusted to only allow claiming after a valid vote
 *             (same trust model as TASK_ORACLE on TaskRewardDispenser)
 *
 *         taskId per claim:
 *           keccak256(abi.encodePacked("civyx:task:governance_vote:", orgId, proposalId))
 *
 *         Roles:
 *           DEFAULT_ADMIN_ROLE  — protocol admin, can pause, update addresses
 *           PROPOSAL_REGISTRAR  — held by organizer contracts or EOAs that may
 *                                 register proposals on behalf of an orgId
 *
 *         Deployment steps:
 *           1. Deploy this contract
 *           2. Call TaskRewardDispenser.grantTaskOracle(address(this))
 *           3. Organizers call registerProposal() — or admin grants them PROPOSAL_REGISTRAR
 */
contract GovernanceVoteTask is AccessControl, Pausable, ReentrancyGuard {

    // -------------------------------------------------------------------------
    // Roles
    // -------------------------------------------------------------------------

    bytes32 public constant PROPOSAL_REGISTRAR = keccak256("PROPOSAL_REGISTRAR");
    bytes32 public constant PAUSER_ROLE        = keccak256("PAUSER_ROLE");

    // -------------------------------------------------------------------------
    // Structs
    // -------------------------------------------------------------------------

    struct Proposal {
        bytes32 orgId;
        bytes32 proposalId;
        bool    active;       // organizer can close a proposal to stop new claims
        uint256 registeredAt; // block number
        uint256 claimCount;   // total identities that claimed this proposal
    }

    // -------------------------------------------------------------------------
    // State
    // -------------------------------------------------------------------------

    IIdentityRegistry    public identityRegistry;
    ITaskRewardDispenser public dispenser;
    IOrganizerRegistry   public organizerRegistry;

    /// @notice proposalKey => Proposal  (proposalKey = keccak256(orgId, proposalId))
    mapping(bytes32 => Proposal) public proposals;

    /// @notice Total proposals registered across all organizers
    uint256 public totalProposals;

    // -------------------------------------------------------------------------
    // Events
    // -------------------------------------------------------------------------

    event ProposalRegistered(
        bytes32 indexed orgId,
        bytes32 indexed proposalId,
        bytes32         proposalKey,
        address         registeredBy
    );
    event ProposalClosed(bytes32 indexed orgId, bytes32 indexed proposalId);
    event GovernanceVoteClaimed(
        address indexed wallet,
        bytes32 indexed commitment,
        bytes32 indexed orgId,
        bytes32         proposalId
    );

    // -------------------------------------------------------------------------
    // Errors
    // -------------------------------------------------------------------------

    error OrganizerNotActive(bytes32 orgId);
    error ProposalAlreadyExists(bytes32 proposalKey);
    error ProposalNotFound(bytes32 proposalKey);
    error ProposalNotActive(bytes32 proposalKey);
    error NotRegistered(address wallet);
    error ZeroAddress();
    error ZeroId();

    // -------------------------------------------------------------------------
    // Constructor
    // -------------------------------------------------------------------------

    constructor(
        address _identityRegistry,
        address _dispenser,
        address _organizerRegistry,
        address _admin
    ) {
        if (_identityRegistry   == address(0)) revert ZeroAddress();
        if (_dispenser          == address(0)) revert ZeroAddress();
        if (_organizerRegistry  == address(0)) revert ZeroAddress();
        if (_admin              == address(0)) revert ZeroAddress();

        identityRegistry  = IIdentityRegistry(_identityRegistry);
        dispenser         = ITaskRewardDispenser(_dispenser);
        organizerRegistry = IOrganizerRegistry(_organizerRegistry);

        _grantRole(DEFAULT_ADMIN_ROLE, _admin);
        _grantRole(PAUSER_ROLE,        _admin);
        _grantRole(PROPOSAL_REGISTRAR, _admin);
    }

    // -------------------------------------------------------------------------
    // Proposal management — callable by PROPOSAL_REGISTRAR
    // -------------------------------------------------------------------------

    /**
     * @notice Register a new governance proposal that identities can claim against.
     *
     * @dev    The organizer identified by orgId must be active in OrganizerRegistry.
     *         proposalId is chosen by the organizer — typically a sequential number
     *         or keccak256 of the proposal title/hash.
     *         Only PROPOSAL_REGISTRAR can call this. Organizers apply for this role
     *         via the admin, or deploy a wrapper contract that holds the role.
     *
     * @param orgId       Organizer context from OrganizerRegistry
     * @param proposalId  Unique proposal identifier within the organizer's context
     */
    function registerProposal(bytes32 orgId, bytes32 proposalId)
        external
        onlyRole(PROPOSAL_REGISTRAR)
        whenNotPaused
    {
        if (orgId      == bytes32(0)) revert ZeroId();
        if (proposalId == bytes32(0)) revert ZeroId();
        if (!organizerRegistry.isActive(orgId)) revert OrganizerNotActive(orgId);

        bytes32 key = _proposalKey(orgId, proposalId);
        if (proposals[key].registeredAt != 0) revert ProposalAlreadyExists(key);

        proposals[key] = Proposal({
            orgId:        orgId,
            proposalId:   proposalId,
            active:       true,
            registeredAt: block.number,
            claimCount:   0
        });

        totalProposals++;
        emit ProposalRegistered(orgId, proposalId, key, msg.sender);
    }

    /**
     * @notice Close a proposal — prevents new claims but does not affect existing ones.
     * @dev    Only PROPOSAL_REGISTRAR.
     */
    function closeProposal(bytes32 orgId, bytes32 proposalId)
        external
        onlyRole(PROPOSAL_REGISTRAR)
    {
        bytes32 key = _proposalKey(orgId, proposalId);
        if (proposals[key].registeredAt == 0) revert ProposalNotFound(key);
        proposals[key].active = false;
        emit ProposalClosed(orgId, proposalId);
    }

    // -------------------------------------------------------------------------
    // Claim — callable by any registered identity
    // -------------------------------------------------------------------------

    /**
     * @notice Claim reputation for participating in a governance proposal.
     *
     * @dev    msg.sender must be a registered, active Civyx identity.
     *         The proposal must exist and be open.
     *         TaskRewardDispenser enforces one claim per (commitment, taskId) globally.
     *
     * @param orgId       Organizer context
     * @param proposalId  Proposal to claim against
     */
    function claim(bytes32 orgId, bytes32 proposalId)
        external
        nonReentrant
        whenNotPaused
    {
        if (!identityRegistry.verifyIdentity(msg.sender))
            revert NotRegistered(msg.sender);

        bytes32 key = _proposalKey(orgId, proposalId);
        if (proposals[key].registeredAt == 0) revert ProposalNotFound(key);
        if (!proposals[key].active)           revert ProposalNotActive(key);

        bytes32 commitment = identityRegistry.getCommitment(msg.sender);
        bytes32 taskId     = _taskId(orgId, proposalId);

        proposals[key].claimCount++;

        emit GovernanceVoteClaimed(msg.sender, commitment, orgId, proposalId);

        dispenser.awardTask(commitment, taskId);
    }

    // -------------------------------------------------------------------------
    // View
    // -------------------------------------------------------------------------

    /// @notice Returns the proposal struct for a given orgId + proposalId pair
    function getProposal(bytes32 orgId, bytes32 proposalId)
        external view
        returns (Proposal memory)
    {
        return proposals[_proposalKey(orgId, proposalId)];
    }

    /// @notice Returns whether a specific identity has already claimed a proposal
    function hasClaimed(bytes32 commitment, bytes32 orgId, bytes32 proposalId)
        external view
        returns (bool)
    {
        // Delegates to dispenser — single source of truth
        return _hasClaimedDispenser(commitment, orgId, proposalId);
    }

    // -------------------------------------------------------------------------
    // Internal
    // -------------------------------------------------------------------------

    function _proposalKey(bytes32 orgId, bytes32 proposalId)
        internal pure returns (bytes32)
    {
        return keccak256(abi.encodePacked(orgId, proposalId));
    }

    function _taskId(bytes32 orgId, bytes32 proposalId)
        internal pure returns (bytes32)
    {
        return keccak256(abi.encodePacked("civyx:task:governance_vote:", orgId, proposalId));
    }

    function _hasClaimedDispenser(bytes32 commitment, bytes32 orgId, bytes32 proposalId)
        internal view returns (bool)
    {
        // Read hasClaimed from dispenser via low-level call to avoid ABI dependency
        (bool ok, bytes memory data) = address(dispenser).staticcall(
            abi.encodeWithSignature(
                "hasClaimed(bytes32,bytes32)",
                commitment,
                _taskId(orgId, proposalId)
            )
        );
        if (!ok || data.length == 0) return false;
        return abi.decode(data, (bool));
    }

    // -------------------------------------------------------------------------
    // Admin
    // -------------------------------------------------------------------------

    function setIdentityRegistry(address newRegistry) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (newRegistry == address(0)) revert ZeroAddress();
        identityRegistry = IIdentityRegistry(newRegistry);
    }

    function setDispenser(address newDispenser) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (newDispenser == address(0)) revert ZeroAddress();
        dispenser = ITaskRewardDispenser(newDispenser);
    }

    function setOrganizerRegistry(address newRegistry) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (newRegistry == address(0)) revert ZeroAddress();
        organizerRegistry = IOrganizerRegistry(newRegistry);
    }

    function pause()   external onlyRole(PAUSER_ROLE) { _pause(); }
    function unpause() external onlyRole(PAUSER_ROLE) { _unpause(); }
}
