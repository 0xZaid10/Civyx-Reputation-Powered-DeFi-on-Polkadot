# Message Format and Payloads

## XCM Program Structure

Every XCM message dispatched by the `IdentityBroadcaster` uses the `Transact` instruction wrapped in a standard fee-handling program:

```
XCM Program:
  WithdrawAsset({ asset: fee_amount, location: Here })
  BuyExecution({ fees: fee_amount, weight_limit: Unlimited })
  Transact({
    origin_kind: SovereignAccount,
    require_weight_at_most: weight,
    call: encoded_call_data
  })
  RefundSurplus
  DepositAsset({ assets: All, beneficiary: fee_refund_address })
```

The `call` field inside `Transact` encodes a call to the receiver contract's `receive*` function with the appropriate payload.

---

## Payload Definitions

### IdentityPayload

Broadcast when identity state changes — registration, deactivation, or reactivation.

```solidity
struct IdentityPayload {
    bytes32 commitment;   // Identity commitment hash
    address wallet;       // Registering wallet address
    bool    active;       // Current identity status
    uint256 stake;        // PAS stake amount
    uint256 timestamp;    // Asset Hub block timestamp
}
```

### ReputationPayload

Broadcast when reputation score should be updated on a destination parachain.

```solidity
struct ReputationPayload {
    address wallet;       // Wallet address
    bytes32 commitment;   // Identity commitment
    uint256 score;        // Current score (0–1000)
    uint8   tier;         // Current tier (1–5)
    bool    active;       // Identity active status
    uint256 timestamp;    // Asset Hub block timestamp
}
```

### WalletLinkPayload

Broadcast when a new wallet is linked to an existing identity.

```solidity
struct WalletLinkPayload {
    address wallet;       // Newly linked wallet
    bytes32 commitment;   // Commitment it was linked to
    uint256 timestamp;    // Asset Hub block timestamp
}
```

---

## Payload Encoding

All payloads are ABI-encoded before being wrapped in the XCM `Transact` call data:

```solidity
function _encodeReputationPayload(
    address wallet,
    bytes32 commitment,
    uint256 score,
    uint8 tier
) internal view returns (bytes memory) {
    ReputationPayload memory payload = ReputationPayload({
        wallet:     wallet,
        commitment: commitment,
        score:      score,
        tier:       tier,
        active:     true,
        timestamp:  block.timestamp
    });

    return abi.encodeWithSelector(
        ICivyxReceiver.receiveReputation.selector,
        abi.encode(payload)
    );
}
```

---

## Timestamp Purpose

The `timestamp` field in every payload serves two purposes:

1. **Staleness detection** — destination parachains can check how old the data is using `isFresh(wallet, maxAge)`
2. **Replay protection** — receiver contracts reject incoming messages with a timestamp older than the currently stored value, preventing an attacker from resubmitting old messages with lower scores
