// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @dev Test double for OrganizerRegistry. Never deploy to production.
contract MockOrganizerRegistry {

    mapping(bytes32 => bool) private _active;

    function setActive(bytes32 orgId, bool active) external {
        _active[orgId] = active;
    }

    function isActive(bytes32 orgId) external view returns (bool) {
        return _active[orgId];
    }

    // Stub to satisfy the full interface used by GovernanceVoteTask
    function getOrganizer(bytes32 orgId) external view returns (
        address owner,
        string memory name,
        uint256 minStake,
        uint256 minReputation,
        bool active,
        uint256 registeredAt
    ) {
        return (address(0), '', 0, 0, _active[orgId], 0);
    }
}
