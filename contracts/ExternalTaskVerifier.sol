// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

interface IIdentityRegistry {
    function verifyIdentity(address wallet) external view returns (bool);
    function getCommitment(address wallet)  external view returns (bytes32);
}

interface ITaskRewardDispenser {
    function awardTask(bytes32 commitment, bytes32 taskId) external;
}

/**
 * @title  ExternalTaskVerifier
 * @notice Allows any Civyx identity holder to claim reputation for actions
 *         performed on any external dApp — without requiring the dApp to
 *         integrate Civyx.
 *
 *         An admin registers VerificationSchemas. Each schema defines:
 *           - which external contract to staticcall
 *           - which view function to call with the user's address
 *           - how to interpret the return value
 *
 *         A user calls claimExternal(schemaId) after completing the external action.
 *         The contract reads state via staticcall and awards reputation if verified.
 *
 *         Supported verification patterns:
 *           hasVoted(address) → bool          → ReturnType.BOOL_TRUE
 *           hasClaimed(address) → bool        → ReturnType.BOOL_TRUE
 *           balanceOf(address) → uint256      → ReturnType.UINT_NONZERO
 *           balanceOf(address) → uint256      → ReturnType.UINT_GTE_AMOUNT (+ requiredAmount)
 *           getCommitment(address) → bytes32  → ReturnType.BYTES32_NONZERO
 *
 *         taskId per claim: keccak256(abi.encodePacked("civyx:external:", schemaId))
 *         One claim per identity per schema — enforced by TaskRewardDispenser.
 *
 *         Roles:
 *           DEFAULT_ADMIN_ROLE — full admin
 *           SCHEMA_MANAGER     — register/deactivate schemas
 *           PAUSER_ROLE        — pause/unpause
 *
 *         Deployment:
 *           1. Deploy ExternalTaskVerifier
 *           2. TaskRewardDispenser.grantTaskOracle(address(this))
 *           3. Admin registers schemas
 *           4. Users call claimExternal(schemaId)
 */
contract ExternalTaskVerifier is AccessControl, Pausable, ReentrancyGuard {

    // ── Roles ──────────────────────────────────────────────────────────────────

    bytes32 public constant PAUSER_ROLE    = keccak256("PAUSER_ROLE");
    bytes32 public constant SCHEMA_MANAGER = keccak256("SCHEMA_MANAGER");

    // ── Return type ────────────────────────────────────────────────────────────

    enum ReturnType {
        BOOL_TRUE,        // return bool — must be true
        UINT_NONZERO,     // return uint256 — must be > 0
        UINT_GTE_AMOUNT,  // return uint256 — must be >= schema.requiredAmount
        BYTES32_NONZERO   // return bytes32 — must be non-zero
    }

    // ── Schema ─────────────────────────────────────────────────────────────────

    struct VerificationSchema {
        address    targetContract;
        bytes4     selector;          // view function accepting (address) as sole arg
        ReturnType returnType;
        uint256    requiredAmount;    // used only for UINT_GTE_AMOUNT
        bool       active;
        uint256    registeredAt;      // block number
        string     label;
        uint256    totalClaims;
    }

    // ── State ──────────────────────────────────────────────────────────────────

    IIdentityRegistry    public identityRegistry;
    ITaskRewardDispenser public dispenser;

    mapping(bytes32 => VerificationSchema) public schemas;
    uint256 public totalSchemas;
    uint256 public totalExternalClaims;

    // ── Events ─────────────────────────────────────────────────────────────────

    event SchemaRegistered(
        bytes32 indexed schemaId,
        address indexed targetContract,
        bytes4          selector,
        ReturnType      returnType,
        string          label,
        address         registeredBy
    );
    event SchemaDeactivated(bytes32 indexed schemaId);
    event SchemaReactivated(bytes32 indexed schemaId);
    event ExternalTaskClaimed(
        address indexed wallet,
        bytes32 indexed commitment,
        bytes32 indexed schemaId,
        address         targetContract,
        uint256         verifiedValue
    );

    // ── Errors ─────────────────────────────────────────────────────────────────

    error SchemaNotFound(bytes32 schemaId);
    error SchemaNotActive(bytes32 schemaId);
    error SchemaAlreadyExists(bytes32 schemaId);
    error NotRegistered(address wallet);
    error VerificationFailed(address targetContract, bytes4 selector, address wallet);
    error StaticCallReverted(address targetContract, bytes4 selector);
    error ZeroAddress();
    error ZeroId();
    error ZeroSelector();
    error EmptyLabel();

    // ── Constructor ────────────────────────────────────────────────────────────

    constructor(
        address _identityRegistry,
        address _dispenser,
        address _admin
    ) {
        if (_identityRegistry == address(0)) revert ZeroAddress();
        if (_dispenser        == address(0)) revert ZeroAddress();
        if (_admin            == address(0)) revert ZeroAddress();

        identityRegistry = IIdentityRegistry(_identityRegistry);
        dispenser        = ITaskRewardDispenser(_dispenser);

        _grantRole(DEFAULT_ADMIN_ROLE, _admin);
        _grantRole(PAUSER_ROLE,        _admin);
        _grantRole(SCHEMA_MANAGER,     _admin);
    }

    // ── Schema management ──────────────────────────────────────────────────────

    /**
     * @notice Register a verification schema.
     * @param schemaId        Unique ID — e.g. keccak256("acmedao:vote:proposal:1")
     * @param targetContract  External contract to staticcall
     * @param selector        4-byte selector of a view function accepting (address)
     * @param returnType      How to interpret the return value
     * @param requiredAmount  Only used for UINT_GTE_AMOUNT, 0 otherwise
     * @param label           Human-readable description
     */
    function registerSchema(
        bytes32    schemaId,
        address    targetContract,
        bytes4     selector,
        ReturnType returnType,
        uint256    requiredAmount,
        string calldata label
    )
        external
        onlyRole(SCHEMA_MANAGER)
        whenNotPaused
    {
        if (schemaId            == bytes32(0)) revert ZeroId();
        if (targetContract      == address(0)) revert ZeroAddress();
        if (selector            == bytes4(0))  revert ZeroSelector();
        if (bytes(label).length == 0)          revert EmptyLabel();
        if (schemas[schemaId].registeredAt != 0) revert SchemaAlreadyExists(schemaId);

        schemas[schemaId] = VerificationSchema({
            targetContract: targetContract,
            selector:       selector,
            returnType:     returnType,
            requiredAmount: requiredAmount,
            active:         true,
            registeredAt:   block.number,
            label:          label,
            totalClaims:    0
        });

        totalSchemas++;
        emit SchemaRegistered(schemaId, targetContract, selector, returnType, label, msg.sender);
    }

    function deactivateSchema(bytes32 schemaId) external onlyRole(SCHEMA_MANAGER) {
        if (schemas[schemaId].registeredAt == 0) revert SchemaNotFound(schemaId);
        schemas[schemaId].active = false;
        emit SchemaDeactivated(schemaId);
    }

    function reactivateSchema(bytes32 schemaId) external onlyRole(SCHEMA_MANAGER) {
        if (schemas[schemaId].registeredAt == 0) revert SchemaNotFound(schemaId);
        schemas[schemaId].active = true;
        emit SchemaReactivated(schemaId);
    }

    // ── Claim ──────────────────────────────────────────────────────────────────

    /**
     * @notice Claim reputation for an action performed on an external dApp.
     *
     * @dev    1. Verifies Civyx identity is active
     *         2. Performs read-only staticcall to targetContract.selector(msg.sender)
     *         3. Interprets return value according to schema.returnType
     *         4. Awards reputation via dispenser (reverts AlreadyClaimed if done before)
     *
     * @param schemaId  The schema that defines what external state to verify
     */
    function claimExternal(bytes32 schemaId)
        external
        nonReentrant
        whenNotPaused
    {
        if (!identityRegistry.verifyIdentity(msg.sender))
            revert NotRegistered(msg.sender);

        VerificationSchema storage schema = schemas[schemaId];
        if (schema.registeredAt == 0) revert SchemaNotFound(schemaId);
        if (!schema.active)           revert SchemaNotActive(schemaId);

        bytes32 commitment = identityRegistry.getCommitment(msg.sender);

        // Build call: selector + abi-encoded wallet address
        bytes memory callData = abi.encodePacked(schema.selector, abi.encode(msg.sender));

        // staticcall — read-only, cannot modify external state
        (bool success, bytes memory returnData) = schema.targetContract.staticcall(callData);

        if (!success || returnData.length == 0)
            revert StaticCallReverted(schema.targetContract, schema.selector);

        // Verify return value matches schema requirement
        uint256 verifiedValue = _verifyReturn(schema, returnData);

        // State changes before external call (checks-effects-interactions)
        schema.totalClaims++;
        totalExternalClaims++;

        emit ExternalTaskClaimed(
            msg.sender,
            commitment,
            schemaId,
            schema.targetContract,
            verifiedValue
        );

        dispenser.awardTask(commitment, _taskId(schemaId));
    }

    // ── View ───────────────────────────────────────────────────────────────────

    /// @notice Preview whether a wallet currently passes a schema's check
    function wouldVerify(bytes32 schemaId, address wallet)
        external
        view
        returns (bool passes, uint256 verifiedValue, string memory reason)
    {
        VerificationSchema storage schema = schemas[schemaId];
        if (schema.registeredAt == 0) return (false, 0, "Schema not found");
        if (!schema.active)           return (false, 0, "Schema not active");

        bytes memory callData = abi.encodePacked(schema.selector, abi.encode(wallet));
        (bool success, bytes memory returnData) = schema.targetContract.staticcall(callData);

        if (!success || returnData.length == 0) return (false, 0, "Staticcall failed");

        if (schema.returnType == ReturnType.BOOL_TRUE) {
            bool val = abi.decode(returnData, (bool));
            return (val, val ? 1 : 0, val ? "Verified" : "Returns false");
        }
        if (schema.returnType == ReturnType.UINT_NONZERO) {
            uint256 val = abi.decode(returnData, (uint256));
            return (val > 0, val, val > 0 ? "Verified" : "Returns zero");
        }
        if (schema.returnType == ReturnType.UINT_GTE_AMOUNT) {
            uint256 val = abi.decode(returnData, (uint256));
            bool ok = val >= schema.requiredAmount;
            return (ok, val, ok ? "Verified" : "Below required amount");
        }
        if (schema.returnType == ReturnType.BYTES32_NONZERO) {
            bytes32 val = abi.decode(returnData, (bytes32));
            bool ok = val != bytes32(0);
            return (ok, ok ? 1 : 0, ok ? "Verified" : "Returns zero bytes32");
        }
        return (false, 0, "Unknown return type");
    }

    function getTaskId(bytes32 schemaId) external pure returns (bytes32) {
        return _taskId(schemaId);
    }

    function getSchema(bytes32 schemaId) external view returns (VerificationSchema memory) {
        return schemas[schemaId];
    }

    // ── Internal ───────────────────────────────────────────────────────────────

    function _verifyReturn(
        VerificationSchema storage schema,
        bytes memory returnData
    ) internal view returns (uint256) {
        if (schema.returnType == ReturnType.BOOL_TRUE) {
            if (!abi.decode(returnData, (bool)))
                revert VerificationFailed(schema.targetContract, schema.selector, msg.sender);
            return 1;
        }
        if (schema.returnType == ReturnType.UINT_NONZERO) {
            uint256 val = abi.decode(returnData, (uint256));
            if (val == 0) revert VerificationFailed(schema.targetContract, schema.selector, msg.sender);
            return val;
        }
        if (schema.returnType == ReturnType.UINT_GTE_AMOUNT) {
            uint256 val = abi.decode(returnData, (uint256));
            if (val < schema.requiredAmount)
                revert VerificationFailed(schema.targetContract, schema.selector, msg.sender);
            return val;
        }
        if (schema.returnType == ReturnType.BYTES32_NONZERO) {
            bytes32 val = abi.decode(returnData, (bytes32));
            if (val == bytes32(0))
                revert VerificationFailed(schema.targetContract, schema.selector, msg.sender);
            return uint256(val);
        }
        revert VerificationFailed(schema.targetContract, schema.selector, msg.sender);
    }

    function _taskId(bytes32 schemaId) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked("civyx:external:", schemaId));
    }

    // ── Admin ──────────────────────────────────────────────────────────────────

    function setIdentityRegistry(address newRegistry) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (newRegistry == address(0)) revert ZeroAddress();
        identityRegistry = IIdentityRegistry(newRegistry);
    }

    function setDispenser(address newDispenser) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (newDispenser == address(0)) revert ZeroAddress();
        dispenser = ITaskRewardDispenser(newDispenser);
    }

    function pause()   external onlyRole(PAUSER_ROLE) { _pause(); }
    function unpause() external onlyRole(PAUSER_ROLE) { _unpause(); }
}
