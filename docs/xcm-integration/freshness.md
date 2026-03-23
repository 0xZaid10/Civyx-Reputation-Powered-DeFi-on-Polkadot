# Data Freshness

## The Staleness Problem

Because reputation data on destination parachains is a snapshot rather than a live feed, it can become stale if the user's score changes after the last broadcast. Civyx provides three mechanisms to manage this.

---

## Refresh Strategies

### User-Triggered Refresh

The user manually calls `broadcastReputation(wallet, destParachain)` on the Asset Hub `IdentityBroadcaster` whenever they want to update their score on a destination parachain.

**Best for:** Infrequent updates, or before a high-value action on a destination protocol.

**Cost:** One XCM fee per broadcast.

---

### Auto-Broadcast on Score Change

The user calls `enableAutoBroadcast(destParachain)` once. From that point forward, every reputation update on Asset Hub automatically triggers an XCM broadcast to the configured destination.

**Best for:** Users actively building reputation who want it reflected in real time.

**Cost:** XCM fee on every task completion. Users should maintain a PAS balance sufficient for ongoing auto-broadcast fees.

---

### Protocol-Triggered Refresh *(Roadmap)*

A destination parachain protocol sends an XCM message back to Asset Hub requesting an updated score before a sensitive operation. The request is fulfilled and the updated payload is returned via XCM.

**Best for:** High-stakes operations where stale data could cause significant financial miscalculation — for example, a large CivUSD-equivalent mint on a destination chain.

**Cost:** Two XCM round trips. The destination protocol pays for the callback.

This approach is on the roadmap and is not yet implemented.

---

## Freshness Checks

Destination parachain protocols implement their own freshness policies using the receiver's `isFresh` function:

```solidity
function isFresh(address wallet, uint256 maxAge)
    external view returns (bool) {
    return block.timestamp - storedReputation[wallet].updatedAt <= maxAge;
}
```

Example usage in a destination protocol:

```solidity
// Require reputation data no older than 24 hours
require(
    civyxReceiver.isFresh(msg.sender, 24 hours),
    "Reputation data stale — please refresh on Asset Hub"
);
```

---

## Recommended Freshness Thresholds

Different protocols have different risk tolerances. These are suggested starting points:

| Protocol Type | Suggested Max Age | Rationale |
|---|---|---|
| Lending / borrowing | 1–6 hours | Financial risk warrants fresh data |
| Governance voting | 24–72 hours | Score changes infrequently |
| Access gating | 1–7 days | Binary check, less time-sensitive |
| Airdrop eligibility | One-time check | Snapshot at a specific block |

---

## What Happens When Data Is Stale

The receiver contract itself does not automatically reject queries on stale data — it returns whatever is stored. Staleness enforcement is the responsibility of the consuming protocol via `isFresh()`.

If a protocol does not implement a freshness check, it will use whatever score was last broadcast, which may be outdated. Protocol integrators should always implement a freshness policy appropriate for their risk profile.
