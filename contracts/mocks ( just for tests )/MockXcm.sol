// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/**
 * @title  MockXcm
 * @notice Test double for the XCM precompile at 0xA0000.
 *         Records send() calls so tests can assert on destination + message bytes.
 *         weighMessage() returns a fixed weight.
 */
contract MockXcm {

    struct Weight {
        uint64 refTime;
        uint64 proofSize;
    }

    bytes   public lastDestination;
    bytes   public lastMessage;
    uint256 public callCount;

    function execute(bytes calldata message, Weight calldata) external {
        lastMessage = message;
        callCount++;
    }

    function weighMessage(bytes calldata) external pure returns (Weight memory) {
        return Weight({ refTime: 1_830_000, proofSize: 0 });
    }

    function send(bytes calldata destination, bytes calldata message) external {
        lastDestination = destination;
        lastMessage     = message;
        callCount++;
    }
}
