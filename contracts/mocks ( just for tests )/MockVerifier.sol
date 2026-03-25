// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;
// Test helper — always returns true for proof verification
contract MockVerifier {
    function verify(bytes calldata, bytes32[] calldata) external pure returns (bool) {
        return true;
    }
}
