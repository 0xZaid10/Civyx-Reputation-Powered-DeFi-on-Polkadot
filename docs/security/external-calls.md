# External Call and XCM Message Security

## staticcall Isolation

The `ExternalTaskVerifier` uses `staticcall` to query external contracts for task verification. `staticcall` is a read-only EVM operation with strong isolation guarantees.

**What a staticcall target cannot do:**
- Modify state in any contract — including Civyx contracts
- Transfer ETH or tokens
- Emit events
- Call other contracts in a way that modifies state
- Drain funds from the `ExternalTaskVerifier`

The only surface a malicious target has is the return value. This is mitigated by the expected value check — verification only passes if the return data exactly matches the schema's `expectedValue`. A target returning arbitrary data fails the check and awards no reputation.

---

## Gas Griefing Protection

A malicious external contract called via `staticcall` could run expensive computations that consume the transaction's gas budget without reverting — effectively griefing the caller.

**Mitigation:** Every `staticcall` is dispatched with an explicit gas cap:

```solidity
(bool success, bytes memory result) = target.staticcall{
    gas: MAX_EXTERNAL_GAS
}(callData);
```

If the external contract consumes more than `MAX_EXTERNAL_GAS`, the `staticcall` returns `false` and the verification fails cleanly. The outer transaction does not run out of gas.

---

## Schema Validation

Before a verification schema can be used for task completion, it must be registered by an address with the `SCHEMA_MANAGER` role. This means:

- Arbitrary external contracts cannot be called without admin approval
- Each schema is reviewed before being activated
- A deactivated schema stops accepting new completions immediately

This is an additional layer of protection against malicious external call targets being registered as task schemas.

---

## XCM Message Security

### Origin Authentication

The Civyx receiver contract on each destination parachain validates that every incoming XCM message originates from the registered Asset Hub `IdentityBroadcaster` address. Messages from any other source are rejected:

```solidity
modifier onlyXCMOrigin() {
    require(
        _getXCMOrigin() == registeredBroadcaster,
        "Unauthorized XCM origin"
    );
    _;
}
```

### Monotonic Timestamp Enforcement

All receiver functions reject payloads with a timestamp older than or equal to the currently stored value. This prevents replay attacks:

```solidity
require(
    data.timestamp > storedReputation[data.wallet].updatedAt,
    "Stale update rejected"
);
```

An attacker who captures an old XCM message with a lower score cannot resubmit it to downgrade a user's reputation on a destination chain — the timestamp check rejects it.

### Bounds Validation

The receiver validates all incoming data before storing it:

```solidity
require(data.score <= 1000, "Score out of bounds");
require(data.tier >= 1 && data.tier <= 5, "Tier out of bounds");
```

### Weight Limit Protection

Every XCM message is dispatched with a configured `weightLimit`. If receiver execution exceeds this weight, the XCM message fails gracefully — it does not consume unbounded resources on the destination chain.

### No Local Modification

Receiver contracts on destination parachains accept updates only from authenticated XCM messages. No local contract, no admin, and no user on the destination parachain can modify stored reputation data directly. All writes must originate from the Asset Hub broadcaster.

---

## Checks-Effects-Interactions Pattern

All contracts in Civyx that transfer PAS follow the checks-effects-interactions pattern without exception:

```solidity
function burn(uint256 civUSDAmount) external nonReentrant whenNotPaused {
    // 1. CHECKS — all validations first
    require(civUSDAmount > 0, "Amount must be positive");
    require(positions[msg.sender].active, "No active position");
    require(balanceOf(msg.sender) >= civUSDAmount, "Insufficient balance");

    // 2. EFFECTS — all state changes before any external call
    positions[msg.sender].civUSDMinted -= civUSDAmount;
    positions[msg.sender].collateral   -= collateralToReturn;
    _burn(msg.sender, civUSDAmount);

    // 3. INTERACTIONS — external call last
    (bool success, ) = msg.sender.call{value: collateralToReturn}("");
    require(success, "Transfer failed");
}
```

Combined with `ReentrancyGuard`, this ensures that even a malicious contract attempting a reentrant call during the PAS transfer will find all state already updated and fail its own checks.
