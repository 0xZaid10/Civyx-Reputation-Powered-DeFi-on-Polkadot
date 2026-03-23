# Fee Model and Security

## XCM Fee Model

Every XCM message dispatched by the `IdentityBroadcaster` consumes PAS to pay for execution on both Asset Hub and the destination parachain.

### Fee Configuration

Fees are configured per destination parachain by the admin:

```solidity
feeConfigs[parachainId] = XCMFeeConfig({
    feeAmount:   0.01 ether,    // 0.01 PAS per message
    weightLimit: 1_000_000_000, // Max execution weight
    configured:  true
});
```

### Fee Sources

| Broadcast Type | Who Pays |
|---|---|
| Manual broadcast (`broadcastReputation`) | The caller pays XCM fee from their wallet |
| Auto-broadcast on score change | Fee deducted from broadcaster fee reserve |
| Admin batch broadcast | The calling admin address pays |

### Fee Estimation

```solidity
function estimateFee(uint32 destParachain)
    external view returns (uint256 feeAmount);
```

---

## Security Model

### Origin Authentication

The receiver contract validates every incoming XCM message against the registered Asset Hub broadcaster address. This is the primary security guarantee. Messages from any unregistered origin are rejected immediately.

The broadcaster address is set once at receiver deployment and can only be changed by the receiver's admin through a governance process.

### Monotonic Timestamps

All receiver functions reject incoming payloads with a timestamp equal to or older than the currently stored value for the same wallet:

```solidity
require(
    data.timestamp > storedReputation[data.wallet].updatedAt,
    "Stale update rejected"
);
```

This prevents replay attacks where an attacker captures an old XCM message with a lower score and resubmits it to downgrade a user's reputation on a destination chain.

### Score Bounds Validation

The receiver validates that incoming score and tier values are within expected ranges:

```solidity
require(data.score <= 1000, "Score out of bounds");
require(data.tier >= 1 && data.tier <= 5, "Tier out of bounds");
```

Out-of-range values indicate a malformed or malicious payload and are rejected.

### No Local Modification

Receiver contracts on destination parachains are strictly append-only from the perspective of local contracts. The only functions that can update stored data are the XCM-gated `receive*` functions. No local contract, no admin, and no user on the destination parachain can modify stored reputation data directly.

### Weight Limit Protection

Each XCM message is dispatched with a configured `weightLimit` that caps the maximum execution cost on the destination. If receiver contract execution exceeds this weight, the XCM message fails gracefully rather than consuming unbounded resources.

### Active Status Propagation

When a Civyx identity is deactivated on Asset Hub, the next broadcast sets `active: false` in the payload. Destination parachains that check the `active` flag will immediately stop treating the wallet as a verified Civyx identity.
