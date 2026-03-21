// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @dev Test double for TrustOracle used in CivUSD tests. Never deploy to production.
contract MockTrustOracle {
    mapping(address => bool)    private _registered;
    mapping(address => uint256) private _reputation;
    mapping(address => bytes32) private _commitments;

    function setIdentity(address wallet, bool registered, uint256 rep) external {
        _registered[wallet]  = registered;
        _reputation[wallet]  = rep;
        _commitments[wallet] = keccak256(abi.encodePacked(wallet, rep));
    }

    function verifyIdentity(address wallet) external view returns (bool) {
        return _registered[wallet];
    }

    function getEffectiveReputation(address wallet) external view returns (uint256) {
        return _reputation[wallet];
    }

    function getCommitment(address wallet) external view returns (bytes32) {
        return _commitments[wallet];
    }
}
