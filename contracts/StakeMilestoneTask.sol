// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

interface IIdentityRegistry {
    function verifyIdentity(address wallet)   external view returns (bool);
    function getCommitment(address wallet)    external view returns (bytes32);
    function getIdentityStake(address wallet) external view returns (uint256);
}

interface ITaskRewardDispenser {
    function awardTask(bytes32 commitment, bytes32 taskId) external;
}

/**
 * @title  StakeMilestoneTask
 * @notice Awards reputation when an identity's stake crosses 100, 500, or 1000 PAS.
 *
 *         Milestones:
 *           0 — 100  PAS — keccak256("civyx:task:stake:100")
 *           1 — 500  PAS — keccak256("civyx:task:stake:500")
 *           2 — 1000 PAS — keccak256("civyx:task:stake:1000")
 *
 *         Flow:
 *           1. User stakes via IdentityRegistry.registerIdentity() or addStake()
 *           2. User calls claim(milestoneIndex) or claimAll() here
 *           3. Contract checks current live stake >= milestone threshold
 *           4. Calls TaskRewardDispenser.awardTask(commitment, taskId)
 *           5. Dispenser awards 5 pts (or 3 if rep >= 50) on ReputationRegistry
 *
 *         One-time per milestone: TaskRewardDispenser enforces
 *         (commitment, taskId) uniqueness — milestones cannot be re-claimed
 *         even if stake drops and rises again.
 *
 *         PAS denomination:
 *           Polkadot Asset Hub uses 10 decimals.
 *           1 PAS = 10_000_000_000 planck (1e10).
 *
 *         Deployment steps:
 *           1. Deploy this contract
 *           2. Call TaskRewardDispenser.grantTaskOracle(address(this))
 */
contract StakeMilestoneTask is Ownable, Pausable {

    // -------------------------------------------------------------------------
    // PAS constant
    // -------------------------------------------------------------------------

    uint256 public constant PAS = 10_000_000_000;

    // -------------------------------------------------------------------------
    // Milestones
    // -------------------------------------------------------------------------

    struct Milestone {
        uint256 threshold;
        bytes32 taskId;
        string  label;
    }

    Milestone[] public milestones;

    // -------------------------------------------------------------------------
    // State
    // -------------------------------------------------------------------------

    IIdentityRegistry    public identityRegistry;
    ITaskRewardDispenser public dispenser;

    // -------------------------------------------------------------------------
    // Events
    // -------------------------------------------------------------------------

    event StakeMilestoneClaimed(
        address indexed wallet,
        bytes32 indexed commitment,
        uint256         milestoneIndex,
        uint256         stakeAtClaim,
        uint256         threshold
    );

    // -------------------------------------------------------------------------
    // Errors
    // -------------------------------------------------------------------------

    error NotRegistered(address wallet);
    error StakeBelowThreshold(uint256 current, uint256 required);
    error InvalidMilestoneIndex(uint256 index);
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

        milestones.push(Milestone({
            threshold: 100  * PAS,
            taskId:    keccak256("civyx:task:stake:100"),
            label:     "100"
        }));
        milestones.push(Milestone({
            threshold: 500  * PAS,
            taskId:    keccak256("civyx:task:stake:500"),
            label:     "500"
        }));
        milestones.push(Milestone({
            threshold: 1000 * PAS,
            taskId:    keccak256("civyx:task:stake:1000"),
            label:     "1000"
        }));
    }

    // -------------------------------------------------------------------------
    // Claim
    // -------------------------------------------------------------------------

    /**
     * @notice Claim a single stake milestone reward.
     * @param milestoneIndex  0 = 100 PAS, 1 = 500 PAS, 2 = 1000 PAS
     */
    function claim(uint256 milestoneIndex) external whenNotPaused {
        if (milestoneIndex >= milestones.length)
            revert InvalidMilestoneIndex(milestoneIndex);
        if (!identityRegistry.verifyIdentity(msg.sender))
            revert NotRegistered(msg.sender);

        uint256 currentStake = identityRegistry.getIdentityStake(msg.sender);
        uint256 threshold    = milestones[milestoneIndex].threshold;

        if (currentStake < threshold)
            revert StakeBelowThreshold(currentStake, threshold);

        bytes32 commitment = identityRegistry.getCommitment(msg.sender);

        emit StakeMilestoneClaimed(
            msg.sender,
            commitment,
            milestoneIndex,
            currentStake,
            threshold
        );

        dispenser.awardTask(commitment, milestones[milestoneIndex].taskId);
    }

    /**
     * @notice Claim all eligible milestones in one transaction.
     * @dev    Stops at first milestone where stake is insufficient.
     *         Skips already-claimed milestones via try/catch.
     */
    function claimAll() external whenNotPaused {
        if (!identityRegistry.verifyIdentity(msg.sender))
            revert NotRegistered(msg.sender);

        bytes32 commitment   = identityRegistry.getCommitment(msg.sender);
        uint256 currentStake = identityRegistry.getIdentityStake(msg.sender);

        for (uint256 i = 0; i < milestones.length; i++) {
            if (currentStake < milestones[i].threshold) break;

            try dispenser.awardTask(commitment, milestones[i].taskId) {
                emit StakeMilestoneClaimed(
                    msg.sender,
                    commitment,
                    i,
                    currentStake,
                    milestones[i].threshold
                );
            } catch {
                // Already claimed — skip
            }
        }
    }

    // -------------------------------------------------------------------------
    // View
    // -------------------------------------------------------------------------

    function getMilestoneCount() external view returns (uint256) {
        return milestones.length;
    }

    function getMilestone(uint256 index)
        external view
        returns (uint256 threshold, bytes32 taskId, string memory label)
    {
        if (index >= milestones.length) revert InvalidMilestoneIndex(index);
        Milestone memory m = milestones[index];
        return (m.threshold, m.taskId, m.label);
    }

    /// @notice Returns which milestones wallet has enough stake to claim
    function eligibleMilestones(address wallet)
        external view
        returns (bool[] memory eligible)
    {
        uint256 stake = identityRegistry.getIdentityStake(wallet);
        eligible = new bool[](milestones.length);
        for (uint256 i = 0; i < milestones.length; i++) {
            eligible[i] = stake >= milestones[i].threshold;
        }
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
