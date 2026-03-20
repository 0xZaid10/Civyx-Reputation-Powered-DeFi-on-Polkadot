// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

interface IIdentityRegistryView {
    function verifyIdentity(address wallet)        external view returns (bool);
    function getIdentityStake(address wallet)      external view returns (uint256);
    function getLinkedWalletCount(address wallet)  external view returns (uint256);
    function getCommitment(address wallet)         external view returns (bytes32);
}

interface IReputationRegistryView {
    function globalReputation(bytes32 commitment)                              external view returns (uint256);
    function endorsementCount(bytes32 commitment)                              external view returns (uint256);
    function getEffectiveReputation(bytes32 commitment)                        external view returns (uint256);
    function getLocalReputation(bytes32 appId, bytes32 commitment)             external view returns (uint256);
}

interface IOrganizerRegistryView {
    function getRequirements(bytes32 orgId) external view returns (uint256 minStake, uint256 minReputation);
    function isActive(bytes32 orgId)        external view returns (bool);
}

/**
 * @title  TrustOracle
 * @notice Unified read-only verification interface for decentralized applications.
 *
 *         dApps query this single contract instead of calling IdentityRegistry,
 *         ReputationRegistry, and OrganizerRegistry separately.
 *
 *         Entry points:
 *           getTrustProfile(wallet)                     — full profile in one call
 *           meetsRequirements(wallet, minStake, minRep) — custom threshold check
 *           meetsOrganizerRequirements(wallet, orgId)   — organizer-specific check
 *
 * @dev    Pure aggregation layer — no state mutations except admin config.
 */
contract TrustOracle is Ownable, AccessControl {

    // -------------------------------------------------------------------------
    // Roles
    // -------------------------------------------------------------------------

    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");

    // -------------------------------------------------------------------------
    // State
    // -------------------------------------------------------------------------

    IIdentityRegistryView   public identityRegistry;
    IReputationRegistryView public reputationRegistry;
    IOrganizerRegistryView  public organizerRegistry;

    // -------------------------------------------------------------------------
    // Structs
    // -------------------------------------------------------------------------

    struct TrustProfile {
        bool    isRegistered;
        uint256 stake;
        uint256 globalReputation;
        uint256 effectiveReputation;
        uint256 endorsementCount;
        uint256 linkedWalletCount;
        bytes32 commitment;
    }

    // -------------------------------------------------------------------------
    // Events
    // -------------------------------------------------------------------------

    event RegistryUpdated(address indexed old, address indexed updated);
    event ReputationRegistryUpdated(address indexed old, address indexed updated);
    event OrganizerRegistryUpdated(address indexed old, address indexed updated);

    // -------------------------------------------------------------------------
    // Errors
    // -------------------------------------------------------------------------

    error ZeroAddress();
    error OrganizerNotActive(bytes32 orgId);

    // -------------------------------------------------------------------------
    // Constructor
    // -------------------------------------------------------------------------

    /**
     * @param _identityRegistry    Address of deployed IdentityRegistry
     * @param _reputationRegistry  Address of deployed ReputationRegistry
     * @param _organizerRegistry   Address of deployed OrganizerRegistry
     * @param _admin               Address to receive owner + admin roles
     */
    constructor(
        address _identityRegistry,
        address _reputationRegistry,
        address _organizerRegistry,
        address _admin
    ) Ownable(_admin) {
        if (_identityRegistry   == address(0)) revert ZeroAddress();
        if (_reputationRegistry == address(0)) revert ZeroAddress();
        if (_organizerRegistry  == address(0)) revert ZeroAddress();
        if (_admin              == address(0)) revert ZeroAddress();

        identityRegistry   = IIdentityRegistryView(_identityRegistry);
        reputationRegistry = IReputationRegistryView(_reputationRegistry);
        organizerRegistry  = IOrganizerRegistryView(_organizerRegistry);

        _grantRole(DEFAULT_ADMIN_ROLE, _admin);
        _grantRole(OPERATOR_ROLE,      _admin);
    }

    // -------------------------------------------------------------------------
    // Core Queries
    // -------------------------------------------------------------------------

    function verifyIdentity(address wallet) external view returns (bool) {
        return identityRegistry.verifyIdentity(wallet);
    }

    function getIdentityStake(address wallet) external view returns (uint256) {
        return identityRegistry.getIdentityStake(wallet);
    }

    function getLinkedWalletCount(address wallet) external view returns (uint256) {
        return identityRegistry.getLinkedWalletCount(wallet);
    }

    function getGlobalReputation(address wallet) external view returns (uint256) {
        bytes32 commitment = identityRegistry.getCommitment(wallet);
        if (commitment == bytes32(0)) return 0;
        return reputationRegistry.globalReputation(commitment);
    }

    function getEffectiveReputation(address wallet) external view returns (uint256) {
        bytes32 commitment = identityRegistry.getCommitment(wallet);
        if (commitment == bytes32(0)) return 0;
        return reputationRegistry.getEffectiveReputation(commitment);
    }

    function getLocalReputation(bytes32 appId, address wallet) external view returns (uint256) {
        bytes32 commitment = identityRegistry.getCommitment(wallet);
        if (commitment == bytes32(0)) return 0;
        return reputationRegistry.getLocalReputation(appId, commitment);
    }
    
    function getCommitment(address wallet) external view returns (bytes32) {
        return identityRegistry.getCommitment(wallet);
    }

    // -------------------------------------------------------------------------
    // Full Trust Profile — primary dApp entry point
    // -------------------------------------------------------------------------

    /**
     * @notice Returns the complete trust profile for a wallet in a single call.
     * @dev    This is the primary function dApps should use.
     *         Returns all-zero struct for unregistered wallets.
     */
    function getTrustProfile(address wallet) external view returns (TrustProfile memory) {
        bytes32 commitment = identityRegistry.getCommitment(wallet);
        bool isRegistered  = identityRegistry.verifyIdentity(wallet);

        if (!isRegistered || commitment == bytes32(0)) {
            return TrustProfile({
                isRegistered:        false,
                stake:               0,
                globalReputation:    0,
                effectiveReputation: 0,
                endorsementCount:    0,
                linkedWalletCount:   0,
                commitment:          bytes32(0)
            });
        }

        return TrustProfile({
            isRegistered:        true,
            stake:               identityRegistry.getIdentityStake(wallet),
            globalReputation:    reputationRegistry.globalReputation(commitment),
            effectiveReputation: reputationRegistry.getEffectiveReputation(commitment),
            endorsementCount:    reputationRegistry.endorsementCount(commitment),
            linkedWalletCount:   identityRegistry.getLinkedWalletCount(wallet),
            commitment:          commitment
        });
    }

    // -------------------------------------------------------------------------
    // Requirements Checks
    // -------------------------------------------------------------------------

    /**
     * @notice Convenience gate — checks identity + custom stake + reputation threshold.
     *
     * @dev    Use this when you want full control over the thresholds in your
     *         own contract, independent of any organizer context.
     *
     * @param wallet         Wallet to check
     * @param minStake       Minimum stake required in wei (0 = skip check)
     * @param minReputation  Minimum effective reputation required (0 = skip check)
     */
    function meetsRequirements(
        address wallet,
        uint256 minStake,
        uint256 minReputation
    ) external view returns (bool) {
        if (!identityRegistry.verifyIdentity(wallet)) return false;

        if (minStake > 0) {
            if (identityRegistry.getIdentityStake(wallet) < minStake) return false;
        }

        if (minReputation > 0) {
            bytes32 commitment = identityRegistry.getCommitment(wallet);
            if (reputationRegistry.getEffectiveReputation(commitment) < minReputation)
                return false;
        }

        return true;
    }

    /**
     * @notice Organizer-specific gate — checks identity against a registered
     *         organizer's requirements.
     *
     * @dev    Use this when integrating with a specific Civyx organizer context.
     *         Reads minStake and minReputation from OrganizerRegistry.
     *         Reverts if the organizer is not active.
     *
     *         Example usage in a DAO contract:
     *           bytes32 orgId = keccak256("MyDAO-governance-v1");
     *           require(
     *             oracle.meetsOrganizerRequirements(msg.sender, orgId),
     *             "Does not meet DAO requirements"
     *           );
     *
     * @param wallet   Wallet to check
     * @param orgId    keccak256 identifier of the organizer context
     */
    function meetsOrganizerRequirements(
        address wallet,
        bytes32 orgId
    ) external view returns (bool) {
        if (!organizerRegistry.isActive(orgId)) revert OrganizerNotActive(orgId);
        if (!identityRegistry.verifyIdentity(wallet)) return false;

        (uint256 minStake, uint256 minReputation) = organizerRegistry.getRequirements(orgId);

        if (minStake > 0) {
            if (identityRegistry.getIdentityStake(wallet) < minStake) return false;
        }

        if (minReputation > 0) {
            bytes32 commitment = identityRegistry.getCommitment(wallet);
            if (reputationRegistry.getEffectiveReputation(commitment) < minReputation)
                return false;
        }

        return true;
    }

    /**
     * @notice Returns the organizer's requirements for display in frontends.
     * @param orgId  keccak256 identifier of the organizer context
     */
    function getOrganizerRequirements(bytes32 orgId)
        external
        view
        returns (uint256 minStake, uint256 minReputation)
    {
        return organizerRegistry.getRequirements(orgId);
    }

    // -------------------------------------------------------------------------
    // Admin
    // -------------------------------------------------------------------------

    function setIdentityRegistry(address newRegistry) external onlyOwner {
        if (newRegistry == address(0)) revert ZeroAddress();
        emit RegistryUpdated(address(identityRegistry), newRegistry);
        identityRegistry = IIdentityRegistryView(newRegistry);
    }

    function setReputationRegistry(address newRegistry) external onlyOwner {
        if (newRegistry == address(0)) revert ZeroAddress();
        emit ReputationRegistryUpdated(address(reputationRegistry), newRegistry);
        reputationRegistry = IReputationRegistryView(newRegistry);
    }

    function setOrganizerRegistry(address newRegistry) external onlyOwner {
        if (newRegistry == address(0)) revert ZeroAddress();
        emit OrganizerRegistryUpdated(address(organizerRegistry), newRegistry);
        organizerRegistry = IOrganizerRegistryView(newRegistry);
    }
}
