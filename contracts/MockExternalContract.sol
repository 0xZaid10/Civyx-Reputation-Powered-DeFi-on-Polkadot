// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/**
 * @dev Unified test double for ExternalTaskVerifier tests.
 *      Simulates a dApp exposing bool, uint256, and bytes32 view functions.
 *      Never deploy to production.
 */
contract MockExternalContract {

    mapping(address => bool)    private _voted;
    mapping(address => uint256) private _balance;
    mapping(address => bytes32) private _commitment;

    // ── bool return (hasVoted pattern) ────────────────────────────────────────
    function setHasVoted(address user, bool v) external { _voted[user] = v; }
    function hasVoted(address user) external view returns (bool) { return _voted[user]; }

    // ── uint256 return (balanceOf pattern) ────────────────────────────────────
    function setBalance(address user, uint256 amt) external { _balance[user] = amt; }
    function balanceOf(address user) external view returns (uint256) { return _balance[user]; }

    // ── bytes32 return (getCommitment pattern) ────────────────────────────────
    function setCommitment(address user, bytes32 c) external { _commitment[user] = c; }
    function getCommitment(address user) external view returns (bytes32) { return _commitment[user]; }
}

