// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/**
 * @title  MockReputationRegistry
 * @notice Test double for ReputationRegistry.
 *         Mirrors the two functions TaskRewardDispenser calls:
 *           - globalReputation(commitment) — public mapping read
 *           - addGlobalReputation(commitment, score) — role-gated write
 *
 *         Extra helpers for test setup:
 *           - grantUpdater(address)         — give a contract write access
 *           - setReputation(commitment, n)  — seed a reputation value directly
 *
 * @dev    NEVER deploy to production.
 */
contract MockReputationRegistry {

    mapping(bytes32 => uint256) public globalReputation;
    mapping(address => bool)    public updaters;

    uint256 public constant MAX_REPUTATION = 1000;

    error NotUpdater();

    function grantUpdater(address updater) external {
        updaters[updater] = true;
    }

    function addGlobalReputation(bytes32 commitment, uint256 score) external {
        if (!updaters[msg.sender]) revert NotUpdater();
        uint256 next = globalReputation[commitment] + score;
        globalReputation[commitment] = next > MAX_REPUTATION ? MAX_REPUTATION : next;
    }

    /// @notice Seed a reputation value directly — for test setup only
    function setReputation(bytes32 commitment, uint256 score) external {
        globalReputation[commitment] = score;
    }
}
