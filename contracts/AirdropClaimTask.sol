// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";

interface IIdentityRegistry {
    function verifyIdentity(address wallet) external view returns (bool);
    function getCommitment(address wallet)  external view returns (bytes32);
}

interface ITaskRewardDispenser {
    function awardTask(bytes32 commitment, bytes32 taskId) external;
}

interface IOrganizerRegistry {
    function isActive(bytes32 orgId) external view returns (bool);
}

/**
 * @title  AirdropClaimTask
 * @notice Awards reputation when a verified Civyx identity claims a registered airdrop campaign.
 *
 *         Design:
 *           - Any active organizer in OrganizerRegistry can create a campaign
 *           - Campaigns use a Merkle tree to define the allowlist of eligible commitments
 *           - Claimants submit a Merkle proof that their commitment is in the allowlist
 *           - One reputation reward per identity per campaign — enforced by TaskRewardDispenser
 *           - Reputation is awarded on top of whatever tokens the airdrop distributes
 *             (token distribution is handled by the organizer's own contract, not here)
 *
 *         taskId per claim:
 *           keccak256(abi.encodePacked("civyx:task:airdrop_claim:", orgId, campaignId))
 *
 *         Merkle leaf format:
 *           keccak256(abi.encodePacked(commitment))
 *           — the leaf is the identity commitment, not the wallet address,
 *             so the allowlist is wallet-agnostic and Sybil-resistant by default.
 *
 *         Roles:
 *           DEFAULT_ADMIN_ROLE  — protocol admin
 *           CAMPAIGN_MANAGER    — may create and close campaigns on behalf of organizers
 *           PAUSER_ROLE         — pause/unpause
 *
 *         Deployment steps:
 *           1. Deploy this contract
 *           2. Call TaskRewardDispenser.grantTaskOracle(address(this))
 *           3. Organizers apply for CAMPAIGN_MANAGER or call createCampaign() directly
 *              if admin grants them the role
 */
contract AirdropClaimTask is AccessControl, Pausable, ReentrancyGuard {

    // -------------------------------------------------------------------------
    // Roles
    // -------------------------------------------------------------------------

    bytes32 public constant CAMPAIGN_MANAGER = keccak256("CAMPAIGN_MANAGER");
    bytes32 public constant PAUSER_ROLE      = keccak256("PAUSER_ROLE");

    // -------------------------------------------------------------------------
    // Structs
    // -------------------------------------------------------------------------

    struct Campaign {
        bytes32 orgId;
        bytes32 campaignId;
        bytes32 merkleRoot;   // root of allowlist tree (leaves = keccak256(commitment))
        bool    active;       // organizer can close the campaign
        uint256 createdAt;    // block number
        uint256 claimCount;   // total identities that claimed reputation
        string  name;         // human-readable campaign name
    }

    // -------------------------------------------------------------------------
    // State
    // -------------------------------------------------------------------------

    IIdentityRegistry    public identityRegistry;
    ITaskRewardDispenser public dispenser;
    IOrganizerRegistry   public organizerRegistry;

    /// @notice campaignKey => Campaign  (campaignKey = keccak256(orgId, campaignId))
    mapping(bytes32 => Campaign) public campaigns;

    /// @notice Total campaigns created across all organizers
    uint256 public totalCampaigns;

    // -------------------------------------------------------------------------
    // Events
    // -------------------------------------------------------------------------

    event CampaignCreated(
        bytes32 indexed orgId,
        bytes32 indexed campaignId,
        bytes32         campaignKey,
        bytes32         merkleRoot,
        string          name,
        address         createdBy
    );
    event CampaignClosed(bytes32 indexed orgId, bytes32 indexed campaignId);
    event CampaignMerkleRootUpdated(
        bytes32 indexed orgId,
        bytes32 indexed campaignId,
        bytes32         oldRoot,
        bytes32         newRoot
    );
    event AirdropClaimed(
        address indexed wallet,
        bytes32 indexed commitment,
        bytes32 indexed orgId,
        bytes32         campaignId
    );

    // -------------------------------------------------------------------------
    // Errors
    // -------------------------------------------------------------------------

    error OrganizerNotActive(bytes32 orgId);
    error CampaignAlreadyExists(bytes32 campaignKey);
    error CampaignNotFound(bytes32 campaignKey);
    error CampaignNotActive(bytes32 campaignKey);
    error InvalidMerkleProof();
    error NotRegistered(address wallet);
    error ZeroAddress();
    error ZeroId();
    error ZeroRoot();

    // -------------------------------------------------------------------------
    // Constructor
    // -------------------------------------------------------------------------

    constructor(
        address _identityRegistry,
        address _dispenser,
        address _organizerRegistry,
        address _admin
    ) {
        if (_identityRegistry  == address(0)) revert ZeroAddress();
        if (_dispenser         == address(0)) revert ZeroAddress();
        if (_organizerRegistry == address(0)) revert ZeroAddress();
        if (_admin             == address(0)) revert ZeroAddress();

        identityRegistry  = IIdentityRegistry(_identityRegistry);
        dispenser         = ITaskRewardDispenser(_dispenser);
        organizerRegistry = IOrganizerRegistry(_organizerRegistry);

        _grantRole(DEFAULT_ADMIN_ROLE, _admin);
        _grantRole(PAUSER_ROLE,        _admin);
        _grantRole(CAMPAIGN_MANAGER,   _admin);
    }

    // -------------------------------------------------------------------------
    // Campaign management — callable by CAMPAIGN_MANAGER
    // -------------------------------------------------------------------------

    /**
     * @notice Create a new airdrop campaign with a Merkle allowlist.
     *
     * @dev    The organizer identified by orgId must be active in OrganizerRegistry.
     *         merkleRoot is the root of a tree whose leaves are keccak256(commitment).
     *         This makes the allowlist identity-based (not wallet-based) by default —
     *         any linked wallet of an eligible identity can claim.
     *
     * @param orgId       Organizer context from OrganizerRegistry
     * @param campaignId  Unique campaign identifier (e.g. keccak256("MyDAO-airdrop-s1"))
     * @param merkleRoot  Root of the Merkle allowlist tree
     * @param name        Human-readable campaign name for display
     */
    function createCampaign(
        bytes32 orgId,
        bytes32 campaignId,
        bytes32 merkleRoot,
        string calldata name
    )
        external
        onlyRole(CAMPAIGN_MANAGER)
        whenNotPaused
    {
        if (orgId      == bytes32(0)) revert ZeroId();
        if (campaignId == bytes32(0)) revert ZeroId();
        if (merkleRoot == bytes32(0)) revert ZeroRoot();
        if (!organizerRegistry.isActive(orgId)) revert OrganizerNotActive(orgId);

        bytes32 key = _campaignKey(orgId, campaignId);
        if (campaigns[key].createdAt != 0) revert CampaignAlreadyExists(key);

        campaigns[key] = Campaign({
            orgId:       orgId,
            campaignId:  campaignId,
            merkleRoot:  merkleRoot,
            active:      true,
            createdAt:   block.number,
            claimCount:  0,
            name:        name
        });

        totalCampaigns++;
        emit CampaignCreated(orgId, campaignId, key, merkleRoot, name, msg.sender);
    }

    /**
     * @notice Update the Merkle root of an active campaign.
     * @dev    Only CAMPAIGN_MANAGER. Useful for multi-round allowlist updates.
     */
    function updateMerkleRoot(bytes32 orgId, bytes32 campaignId, bytes32 newRoot)
        external
        onlyRole(CAMPAIGN_MANAGER)
    {
        if (newRoot == bytes32(0)) revert ZeroRoot();
        bytes32 key = _campaignKey(orgId, campaignId);
        if (campaigns[key].createdAt == 0) revert CampaignNotFound(key);

        bytes32 oldRoot = campaigns[key].merkleRoot;
        campaigns[key].merkleRoot = newRoot;
        emit CampaignMerkleRootUpdated(orgId, campaignId, oldRoot, newRoot);
    }

    /**
     * @notice Close a campaign — prevents new reputation claims.
     * @dev    Only CAMPAIGN_MANAGER.
     */
    function closeCampaign(bytes32 orgId, bytes32 campaignId)
        external
        onlyRole(CAMPAIGN_MANAGER)
    {
        bytes32 key = _campaignKey(orgId, campaignId);
        if (campaigns[key].createdAt == 0) revert CampaignNotFound(key);
        campaigns[key].active = false;
        emit CampaignClosed(orgId, campaignId);
    }

    // -------------------------------------------------------------------------
    // Claim — callable by any registered identity
    // -------------------------------------------------------------------------

    /**
     * @notice Claim reputation for participating in a verified airdrop campaign.
     *
     * @dev    msg.sender must be a registered, active Civyx identity.
     *         The caller's commitment must appear in the campaign's Merkle allowlist.
     *         TaskRewardDispenser enforces one claim per (commitment, taskId) globally.
     *
     *         Merkle leaf = keccak256(abi.encodePacked(commitment))
     *         This means any wallet linked to an eligible identity can submit the proof.
     *
     * @param orgId        Organizer context
     * @param campaignId   Campaign to claim against
     * @param merkleProof  Proof that commitment is in the campaign's allowlist
     */
    function claim(
        bytes32 orgId,
        bytes32 campaignId,
        bytes32[] calldata merkleProof
    )
        external
        nonReentrant
        whenNotPaused
    {
        if (!identityRegistry.verifyIdentity(msg.sender))
            revert NotRegistered(msg.sender);

        bytes32 key = _campaignKey(orgId, campaignId);
        if (campaigns[key].createdAt == 0) revert CampaignNotFound(key);
        if (!campaigns[key].active)        revert CampaignNotActive(key);

        bytes32 commitment = identityRegistry.getCommitment(msg.sender);

        // Verify the commitment is in the allowlist
        bytes32 leaf = keccak256(abi.encodePacked(commitment));
        if (!MerkleProof.verify(merkleProof, campaigns[key].merkleRoot, leaf))
            revert InvalidMerkleProof();

        bytes32 taskId = _taskId(orgId, campaignId);

        campaigns[key].claimCount++;

        emit AirdropClaimed(msg.sender, commitment, orgId, campaignId);

        dispenser.awardTask(commitment, taskId);
    }

    // -------------------------------------------------------------------------
    // View
    // -------------------------------------------------------------------------

    /// @notice Returns the campaign struct for a given orgId + campaignId pair
    function getCampaign(bytes32 orgId, bytes32 campaignId)
        external view
        returns (Campaign memory)
    {
        return campaigns[_campaignKey(orgId, campaignId)];
    }

    /// @notice Returns whether a commitment is eligible according to the Merkle allowlist
    function isEligible(
        bytes32 orgId,
        bytes32 campaignId,
        bytes32 commitment,
        bytes32[] calldata merkleProof
    )
        external view
        returns (bool)
    {
        bytes32 key = _campaignKey(orgId, campaignId);
        if (campaigns[key].createdAt == 0 || !campaigns[key].active) return false;
        bytes32 leaf = keccak256(abi.encodePacked(commitment));
        return MerkleProof.verify(merkleProof, campaigns[key].merkleRoot, leaf);
    }

    /// @notice Returns whether a commitment has already claimed a campaign
    function hasClaimed(bytes32 commitment, bytes32 orgId, bytes32 campaignId)
        external view
        returns (bool)
    {
        (bool ok, bytes memory data) = address(dispenser).staticcall(
            abi.encodeWithSignature(
                "hasClaimed(bytes32,bytes32)",
                commitment,
                _taskId(orgId, campaignId)
            )
        );
        if (!ok || data.length == 0) return false;
        return abi.decode(data, (bool));
    }

    // -------------------------------------------------------------------------
    // Internal
    // -------------------------------------------------------------------------

    function _campaignKey(bytes32 orgId, bytes32 campaignId)
        internal pure returns (bytes32)
    {
        return keccak256(abi.encodePacked(orgId, campaignId));
    }

    function _taskId(bytes32 orgId, bytes32 campaignId)
        internal pure returns (bytes32)
    {
        return keccak256(abi.encodePacked("civyx:task:airdrop_claim:", orgId, campaignId));
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
