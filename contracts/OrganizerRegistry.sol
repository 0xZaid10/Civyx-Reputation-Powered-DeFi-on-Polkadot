// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

/**
 * @title  OrganizerRegistry
 * @notice Permissionless registry for DAOs, protocols, and event organizers.
 *
 *         Any address can register as an organizer and set their own access
 *         requirements — minimum stake and minimum reputation — for their
 *         specific context. These requirements are checked via TrustOracle's
 *         meetsOrganizerRequirements() and are independent of the protocol's
 *         global minimumStake floor on IdentityRegistry.
 *
 *         Design decisions:
 *           - Permissionless: anyone can self-register
 *           - orgId: keccak256 of a unique name, e.g. keccak256("MyDAO-v1")
 *           - Owner of an org can update requirements or deactivate
 *           - Requirements can be set to zero (open access for any identity)
 *           - No minimum enforced on organizer's minStake (their choice)
 *           - Organizers can update requirements at any time
 *
 * @dev    Uses OpenZeppelin AccessControl + Pausable.
 */
contract OrganizerRegistry is AccessControl, Pausable {

    // -------------------------------------------------------------------------
    // Roles
    // -------------------------------------------------------------------------

    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");

    // -------------------------------------------------------------------------
    // Data Structures
    // -------------------------------------------------------------------------

    struct Organizer {
        address owner;          // address that registered and controls this org
        string  name;           // human-readable name for display
        uint256 minStake;       // minimum PAS stake required (in wei)
        uint256 minReputation;  // minimum effective reputation required (0–1000)
        bool    active;         // false if deactivated by owner or admin
        uint256 registeredAt;   // block number of registration
    }

    // -------------------------------------------------------------------------
    // State
    // -------------------------------------------------------------------------

    /// @notice orgId => Organizer record
    mapping(bytes32 => Organizer) public organizers;

    /// @notice owner address => list of orgIds they own
    mapping(address => bytes32[]) public organizersByOwner;

    // -------------------------------------------------------------------------
    // Events
    // -------------------------------------------------------------------------

    event OrganizerRegistered(
        bytes32 indexed orgId,
        address indexed owner,
        string  name,
        uint256 minStake,
        uint256 minReputation
    );
    event RequirementsUpdated(
        bytes32 indexed orgId,
        uint256 oldMinStake,
        uint256 newMinStake,
        uint256 oldMinReputation,
        uint256 newMinReputation
    );
    event OrganizerDeactivated(bytes32 indexed orgId, address indexed caller);
    event OrganizerReactivated(bytes32 indexed orgId, address indexed caller);
    event OwnershipTransferred(bytes32 indexed orgId, address indexed oldOwner, address indexed newOwner);

    // -------------------------------------------------------------------------
    // Errors
    // -------------------------------------------------------------------------

    error OrganizerAlreadyExists(bytes32 orgId);
    error OrganizerDoesNotExist(bytes32 orgId);
    error OrganizerNotActive(bytes32 orgId);
    error OrganizerAlreadyActive(bytes32 orgId);
    error NotOrganizerOwner(bytes32 orgId);
    error EmptyOrgId();
    error EmptyName();
    error ZeroAddress();

    // -------------------------------------------------------------------------
    // Constructor
    // -------------------------------------------------------------------------

    constructor(address _admin) {
        if (_admin == address(0)) revert ZeroAddress();
        _grantRole(DEFAULT_ADMIN_ROLE, _admin);
        _grantRole(PAUSER_ROLE,        _admin);
    }

    // -------------------------------------------------------------------------
    // Registration
    // -------------------------------------------------------------------------

    /**
     * @notice Register as an organizer.
     *
     * @dev    orgId should be keccak256 of a unique identifier, e.g.:
     *           keccak256(abi.encodePacked("MyDAO-governance-v1"))
     *         minStake and minReputation can both be zero (open to any identity).
     *         There is no protocol-enforced minimum — organizers choose freely.
     *
     * @param orgId          Unique identifier for this organizer context
     * @param name           Human-readable name for display (e.g. "MyDAO")
     * @param minStake       Minimum PAS stake required (wei), 0 = no requirement
     * @param minReputation  Minimum effective reputation, 0 = no requirement
     */
    function registerOrganizer(
        bytes32 orgId,
        string calldata name,
        uint256 minStake,
        uint256 minReputation
    )
        external
        whenNotPaused
    {
        if (orgId == bytes32(0))             revert EmptyOrgId();
        if (bytes(name).length == 0)         revert EmptyName();
        if (organizers[orgId].registeredAt != 0)
            revert OrganizerAlreadyExists(orgId);

        organizers[orgId] = Organizer({
            owner:          msg.sender,
            name:           name,
            minStake:       minStake,
            minReputation:  minReputation,
            active:         true,
            registeredAt:   block.number
        });

        organizersByOwner[msg.sender].push(orgId);

        emit OrganizerRegistered(orgId, msg.sender, name, minStake, minReputation);
    }

    // -------------------------------------------------------------------------
    // Requirement Updates
    // -------------------------------------------------------------------------

    /**
     * @notice Update stake and reputation requirements for an organizer context.
     * @dev    Only the organizer owner can call this.
     *         Requirements can be changed at any time — no lock-in.
     *
     * @param orgId          The organizer to update
     * @param newMinStake    New minimum stake (wei), 0 = no requirement
     * @param newMinReputation  New minimum reputation, 0 = no requirement
     */
    function updateRequirements(
        bytes32 orgId,
        uint256 newMinStake,
        uint256 newMinReputation
    )
        external
        whenNotPaused
    {
        _requireOwner(orgId);
        _requireActive(orgId);

        Organizer storage org = organizers[orgId];
        uint256 oldMinStake      = org.minStake;
        uint256 oldMinReputation = org.minReputation;

        org.minStake      = newMinStake;
        org.minReputation = newMinReputation;

        emit RequirementsUpdated(
            orgId,
            oldMinStake,
            newMinStake,
            oldMinReputation,
            newMinReputation
        );
    }

    // -------------------------------------------------------------------------
    // Deactivation & Reactivation
    // -------------------------------------------------------------------------

    /**
     * @notice Deactivate an organizer context.
     * @dev    Only owner or DEFAULT_ADMIN_ROLE.
     *         Deactivated organizers will fail meetsOrganizerRequirements checks.
     */
    function deactivateOrganizer(bytes32 orgId) external {
        if (organizers[orgId].registeredAt == 0)
            revert OrganizerDoesNotExist(orgId);
        if (
            organizers[orgId].owner != msg.sender &&
            !hasRole(DEFAULT_ADMIN_ROLE, msg.sender)
        ) revert NotOrganizerOwner(orgId);

        _requireActive(orgId);
        organizers[orgId].active = false;
        emit OrganizerDeactivated(orgId, msg.sender);
    }

    /**
     * @notice Reactivate a previously deactivated organizer context.
     * @dev    Only owner or DEFAULT_ADMIN_ROLE.
     */
    function reactivateOrganizer(bytes32 orgId) external {
        if (organizers[orgId].registeredAt == 0)
            revert OrganizerDoesNotExist(orgId);
        if (
            organizers[orgId].owner != msg.sender &&
            !hasRole(DEFAULT_ADMIN_ROLE, msg.sender)
        ) revert NotOrganizerOwner(orgId);

        if (organizers[orgId].active) revert OrganizerAlreadyActive(orgId);
        organizers[orgId].active = true;
        emit OrganizerReactivated(orgId, msg.sender);
    }

    // -------------------------------------------------------------------------
    // Ownership Transfer
    // -------------------------------------------------------------------------

    /**
     * @notice Transfer ownership of an organizer context to a new address.
     * @dev    Only current owner can transfer.
     */
    function transferOrganizerOwnership(bytes32 orgId, address newOwner) external {
        if (newOwner == address(0)) revert ZeroAddress();
        _requireOwner(orgId);

        address oldOwner = organizers[orgId].owner;
        organizers[orgId].owner = newOwner;
        organizersByOwner[newOwner].push(orgId);

        emit OwnershipTransferred(orgId, oldOwner, newOwner);
    }

    // -------------------------------------------------------------------------
    // View Functions
    // -------------------------------------------------------------------------

    /// @notice Returns the full Organizer struct for an orgId
    function getOrganizer(bytes32 orgId) external view returns (Organizer memory) {
        return organizers[orgId];
    }

    /// @notice Returns true if organizer exists and is active
    function isActive(bytes32 orgId) external view returns (bool) {
        return organizers[orgId].active;
    }

    /// @notice Returns requirements for a specific organizer
    function getRequirements(bytes32 orgId)
        external
        view
        returns (uint256 minStake, uint256 minReputation)
    {
        Organizer storage org = organizers[orgId];
        if (org.registeredAt == 0) revert OrganizerDoesNotExist(orgId);
        return (org.minStake, org.minReputation);
    }

    /// @notice Returns all orgIds registered by an owner address
    function getOrganizersByOwner(address owner)
        external
        view
        returns (bytes32[] memory)
    {
        return organizersByOwner[owner];
    }

    // -------------------------------------------------------------------------
    // Internal Helpers
    // -------------------------------------------------------------------------

    function _requireOwner(bytes32 orgId) internal view {
        if (organizers[orgId].registeredAt == 0)
            revert OrganizerDoesNotExist(orgId);
        if (organizers[orgId].owner != msg.sender)
            revert NotOrganizerOwner(orgId);
    }

    function _requireActive(bytes32 orgId) internal view {
        if (!organizers[orgId].active)
            revert OrganizerNotActive(orgId);
    }

    // -------------------------------------------------------------------------
    // Admin
    // -------------------------------------------------------------------------

    function pause()   external onlyRole(PAUSER_ROLE) { _pause(); }
    function unpause() external onlyRole(PAUSER_ROLE) { _unpause(); }
}
