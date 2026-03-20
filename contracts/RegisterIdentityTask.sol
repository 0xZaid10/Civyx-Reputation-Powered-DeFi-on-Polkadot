// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

interface IIdentityRegistry {
    function verifyIdentity(address wallet) external view returns (bool);
    function getCommitment(address wallet)  external view returns (bytes32);
}

interface ITaskRewardDispenser {
    function awardTask(bytes32 commitment, bytes32 taskId) external;
}

/**
 * @title  RegisterIdentityTask
 * @notice Awards reputation when a wallet has a registered, active identity.
 *
 *         Task ID: keccak256("civyx:task:register_identity")
 *
 *         Flow:
 *           1. User registers identity via IdentityRegistry.registerIdentity()
 *           2. User calls claim() here
 *           3. Contract verifies wallet is active in IdentityRegistry
 *           4. Resolves wallet → commitment
 *           5. Calls TaskRewardDispenser.awardTask(commitment, TASK_ID)
 *           6. Dispenser awards 5 pts (or 3 if rep >= 50) on ReputationRegistry
 *
 *         One-time: TaskRewardDispenser enforces (commitment, taskId) uniqueness.
 *
 *         Deployment steps:
 *           1. Deploy this contract
 *           2. Call TaskRewardDispenser.grantTaskOracle(address(this))
 */
contract RegisterIdentityTask is Ownable, Pausable {

    // -------------------------------------------------------------------------
    // Constants
    // -------------------------------------------------------------------------

    bytes32 public constant TASK_ID =
        keccak256("civyx:task:register_identity");

    // -------------------------------------------------------------------------
    // State
    // -------------------------------------------------------------------------

    IIdentityRegistry    public identityRegistry;
    ITaskRewardDispenser public dispenser;

    // -------------------------------------------------------------------------
    // Events
    // -------------------------------------------------------------------------

    event RegisterIdentityTaskClaimed(
        address indexed wallet,
        bytes32 indexed commitment
    );

    // -------------------------------------------------------------------------
    // Errors
    // -------------------------------------------------------------------------

    error NotRegistered(address wallet);
    error ZeroAddress();

    // -------------------------------------------------------------------------
    // Constructor
    // -------------------------------------------------------------------------

    constructor(
        address _identityRegistry,
        address _dispenser,
        address _admin
    ) Ownable(_admin) {
        if (_identityRegistry == address(0)) revert ZeroAddress();
        if (_dispenser        == address(0)) revert ZeroAddress();

        identityRegistry = IIdentityRegistry(_identityRegistry);
        dispenser        = ITaskRewardDispenser(_dispenser);
    }

    // -------------------------------------------------------------------------
    // Claim
    // -------------------------------------------------------------------------

    /**
     * @notice Claim the identity registration reward.
     * @dev    msg.sender must be registered and active in IdentityRegistry.
     *         Double-claim prevention is handled by TaskRewardDispenser —
     *         a second call will revert with AlreadyClaimed there.
     */
    function claim() external whenNotPaused {
        if (!identityRegistry.verifyIdentity(msg.sender))
            revert NotRegistered(msg.sender);

        bytes32 commitment = identityRegistry.getCommitment(msg.sender);

        emit RegisterIdentityTaskClaimed(msg.sender, commitment);

        dispenser.awardTask(commitment, TASK_ID);
    }

    // -------------------------------------------------------------------------
    // Admin
    // -------------------------------------------------------------------------

    function setIdentityRegistry(address newRegistry) external onlyOwner {
        if (newRegistry == address(0)) revert ZeroAddress();
        identityRegistry = IIdentityRegistry(newRegistry);
    }

    function setDispenser(address newDispenser) external onlyOwner {
        if (newDispenser == address(0)) revert ZeroAddress();
        dispenser = ITaskRewardDispenser(newDispenser);
    }

    function pause()   external onlyOwner { _pause(); }
    function unpause() external onlyOwner { _unpause(); }
}
