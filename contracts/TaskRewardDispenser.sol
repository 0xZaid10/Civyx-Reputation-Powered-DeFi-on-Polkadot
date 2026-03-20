// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

interface IReputationRegistry {
    function addGlobalReputation(bytes32 commitment, uint256 score) external;
    function globalReputation(bytes32 commitment) external view returns (uint256);
}

/**
 * @title  TaskRewardDispenser
 * @notice Dispenses reputation points when task contracts report a completion.
 *
 *         Reward curve:
 *           globalReputation < 50  →  5 pts
 *           globalReputation >= 50 →  3 pts
 *
 *         Roles:
 *           DEFAULT_ADMIN_ROLE  — admin, grants roles, updates registry
 *           PAUSER_ROLE         — can pause / unpause
 *           TASK_ORACLE         — held by task contracts, authorises awardTask()
 *
 *         Double-claim prevention:
 *           (commitment, taskId) is permanently recorded once claimed.
 *
 *         taskId convention:
 *           one-time :  keccak256("civyx:task:<name>")
 *           instanced:  keccak256(abi.encodePacked("civyx:task:<name>", instanceId))
 *
 *         Deploy steps:
 *           1. Deploy this contract
 *           2. grantRole(REPUTATION_UPDATER, address(this)) on ReputationRegistry
 *           3. Deploy task contracts → call grantTaskOracle(taskContract) here
 */
contract TaskRewardDispenser is AccessControl, Pausable, ReentrancyGuard {

    // -------------------------------------------------------------------------
    // Roles
    // -------------------------------------------------------------------------

    bytes32 public constant TASK_ORACLE = keccak256("TASK_ORACLE");
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");

    // -------------------------------------------------------------------------
    // Constants
    // -------------------------------------------------------------------------

    uint256 public constant THRESHOLD   = 50;
    uint256 public constant POINTS_HIGH = 5;
    uint256 public constant POINTS_LOW  = 3;

    // -------------------------------------------------------------------------
    // State
    // -------------------------------------------------------------------------

    IReputationRegistry public reputationRegistry;

    /// @notice commitment => taskId => claimed
    mapping(bytes32 => mapping(bytes32 => bool)) public claimed;

    /// @notice Total tasks rewarded across all identities
    uint256 public totalTasksCompleted;

    /// @notice Tasks completed per commitment
    mapping(bytes32 => uint256) public tasksCompletedBy;

    // -------------------------------------------------------------------------
    // Events
    // -------------------------------------------------------------------------

    event TaskRewarded(
        bytes32 indexed commitment,
        bytes32 indexed taskId,
        uint256         pointsAwarded,
        uint256         newReputation,
        address indexed awardedBy
    );

    event ReputationRegistryUpdated(
        address indexed oldRegistry,
        address indexed newRegistry
    );

    // -------------------------------------------------------------------------
    // Errors
    // -------------------------------------------------------------------------

    error AlreadyClaimed(bytes32 commitment, bytes32 taskId);
    error ZeroCommitment();
    error ZeroTaskId();
    error ZeroAddress();

    // -------------------------------------------------------------------------
    // Constructor
    // -------------------------------------------------------------------------

    constructor(address _reputationRegistry, address _admin) {
        if (_reputationRegistry == address(0)) revert ZeroAddress();
        if (_admin              == address(0)) revert ZeroAddress();

        reputationRegistry = IReputationRegistry(_reputationRegistry);

        _grantRole(DEFAULT_ADMIN_ROLE, _admin);
        _grantRole(PAUSER_ROLE,        _admin);
    }

    // -------------------------------------------------------------------------
    // Core
    // -------------------------------------------------------------------------

    /**
     * @notice Award reputation for a completed task.
     * @dev    Only TASK_ORACLE. Checks-effects-interactions pattern applied.
     * @param commitment  Identity commitment to reward
     * @param taskId      Unique task / task-instance identifier
     */
    function awardTask(bytes32 commitment, bytes32 taskId)
        external
        nonReentrant
        whenNotPaused
        onlyRole(TASK_ORACLE)
    {
        if (commitment == bytes32(0)) revert ZeroCommitment();
        if (taskId     == bytes32(0)) revert ZeroTaskId();
        if (claimed[commitment][taskId])
            revert AlreadyClaimed(commitment, taskId);

        claimed[commitment][taskId] = true;
        totalTasksCompleted++;
        tasksCompletedBy[commitment]++;

        uint256 currentRep = reputationRegistry.globalReputation(commitment);
        uint256 points     = currentRep < THRESHOLD ? POINTS_HIGH : POINTS_LOW;

        reputationRegistry.addGlobalReputation(commitment, points);

        uint256 newRep = reputationRegistry.globalReputation(commitment);
        emit TaskRewarded(commitment, taskId, points, newRep, msg.sender);
    }

    // -------------------------------------------------------------------------
    // View
    // -------------------------------------------------------------------------

    /// @notice Points that would be awarded right now for a commitment
    function previewPoints(bytes32 commitment) external view returns (uint256) {
        uint256 rep = reputationRegistry.globalReputation(commitment);
        return rep < THRESHOLD ? POINTS_HIGH : POINTS_LOW;
    }

    /// @notice Whether a (commitment, taskId) pair has already been claimed
    function hasClaimed(bytes32 commitment, bytes32 taskId)
        external view returns (bool)
    {
        return claimed[commitment][taskId];
    }

    // -------------------------------------------------------------------------
    // Admin
    // -------------------------------------------------------------------------

    function setReputationRegistry(address newRegistry)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        if (newRegistry == address(0)) revert ZeroAddress();
        emit ReputationRegistryUpdated(address(reputationRegistry), newRegistry);
        reputationRegistry = IReputationRegistry(newRegistry);
    }

    function grantTaskOracle(address taskContract)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        if (taskContract == address(0)) revert ZeroAddress();
        _grantRole(TASK_ORACLE, taskContract);
    }

    function revokeTaskOracle(address taskContract)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        _revokeRole(TASK_ORACLE, taskContract);
    }

    function pause()   external onlyRole(PAUSER_ROLE) { _pause(); }
    function unpause() external onlyRole(PAUSER_ROLE) { _unpause(); }
}
