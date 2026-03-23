# XCM and Reputation Portability

## Overview

Reputation earned on Polkadot Asset Hub does not have to stay there. Through XCM — Polkadot's native cross-consensus messaging protocol — a Civyx reputation score can be broadcast to any parachain in the ecosystem, making it readable by local contracts without cross-chain calls at query time.

This is what makes Civyx a cross-chain trust layer rather than a single-chain application. A score earned through on-chain activity on Asset Hub can follow the user to any parachain that integrates the Civyx receiver interface — DeFi protocols, governance systems, lending markets — without bridges, without wrapped tokens, and without trusting any intermediary.

For the full technical XCM reference, see the [XCM Integration](../xcm-integration/overview.md) section.

---

## How It Works

```
Asset Hub                           Destination Parachain
────────────────────                ──────────────────────────
IdentityBroadcaster                 Civyx Receiver Contract
        │                                     │
        │  XCM Transact message               │
        │ ──────────────────────────────────► │
        │  { wallet, commitment,              │
        │    score, tier, active }            │
                                              │
                                    Stores reputation data locally
                                              │
                                    Local contracts query:
                                    receiver.getScore(wallet)
                                    receiver.getTier(wallet)
```

---

## Triggering a Broadcast

Reputation broadcasts are triggered explicitly by calling `broadcastReputation` on the `IdentityBroadcaster`:

```solidity
function broadcastReputation(
    address wallet,
    uint32 destParachain
) external whenNotPaused;
```

The caller pays the XCM execution fee in PAS.

---

## Auto-Broadcast

Users can register a preference to automatically broadcast reputation updates whenever their score changes:

```solidity
function enableAutoBroadcast(uint32 destParachain) external;
function disableAutoBroadcast(uint32 destParachain) external;
```

Once enabled, every task completion that changes the score automatically propagates the update to the configured destination parachain without user action.

---

## Data Freshness

Because reputation data on destination parachains is a snapshot, it can become stale if the user's score changes after the last broadcast.

| Approach | Description |
|---|---|
| User-triggered refresh | Call `broadcastReputation` manually |
| Auto-broadcast | Every score change propagates automatically |
| Protocol-triggered refresh | Destination protocol requests update via XCM (roadmap) |

Destination protocols implement their own freshness policies using `isFresh(wallet, maxAge)`.

---

## Querying on Destination Parachains

Once data has been received and stored by the receiver contract, any local contract can query it:

```solidity
receiver.getScore(wallet);      // Raw score 0–1000
receiver.getTier(wallet);       // Tier 1–5
receiver.isVerified(wallet);    // Active identity status
receiver.isFresh(wallet, 24 hours); // Freshness check
```

No cross-chain call is required at query time — all data is available locally.
