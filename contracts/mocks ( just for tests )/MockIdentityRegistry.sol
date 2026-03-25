// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/**
 * @title  MockIdentityRegistry
 * @notice Test double for IdentityRegistry.
 *         Mirrors the two functions RegisterIdentityTask calls:
 *           - verifyIdentity(wallet) → bool
 *           - getCommitment(wallet)  → bytes32
 *
 *         verifyIdentity returns true when a non-zero commitment is set
 *         and the wallet has not been explicitly deactivated — matching
 *         the real IdentityRegistry behaviour.
 *
 * @dev    NEVER deploy to production.
 */
contract MockIdentityRegistry {

    mapping(address => bytes32) private _commitments;
    mapping(address => bool)    private _deactivated;

    /// @notice Register a wallet with a commitment (active by default)
    function setCommitment(address wallet, bytes32 commitment) external {
        _commitments[wallet] = commitment;
    }

    /// @notice Simulate deactivateIdentity() — verifyIdentity will return false
    function deactivate(address wallet) external {
        _deactivated[wallet] = true;
    }

    /// @notice Reactivate a wallet
    function reactivate(address wallet) external {
        _deactivated[wallet] = false;
    }

    function getCommitment(address wallet) external view returns (bytes32) {
        return _commitments[wallet];
    }

    /// @notice Returns true if wallet has a commitment and is not deactivated
    function verifyIdentity(address wallet) external view returns (bool) {
        return _commitments[wallet] != bytes32(0) && !_deactivated[wallet];
    }

    // ── Extra view functions used by other task contracts ───────────────────

    mapping(address => uint256) private _walletCounts;
    mapping(address => uint256) private _stakes;

    function setWalletCount(address wallet, uint256 count) external {
        _walletCounts[wallet] = count;
    }

    function setStake(address wallet, uint256 stake) external {
        _stakes[wallet] = stake;
    }

    function getLinkedWalletCount(address wallet) external view returns (uint256) {
        return _walletCounts[wallet];
    }

    function getIdentityStake(address wallet) external view returns (uint256) {
        return _stakes[wallet];
    }
}
