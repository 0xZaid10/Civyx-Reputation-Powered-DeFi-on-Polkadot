# XCM Integration — Overview

## What XCM Does for Civyx

Polkadot's Cross-Consensus Messaging protocol — XCM — is what separates Civyx from a siloed Asset Hub application and makes it a genuine cross-chain trust layer.

Without XCM, Civyx reputation is useful only on Asset Hub. With XCM, any parachain in the Polkadot ecosystem can read a user's identity status and reputation score, gate access to their protocols, reward verified behavior, and participate in the same trust network — without deploying their own identity infrastructure, without bridges, and without trusting any intermediary.

XCM in Civyx is used exclusively for **state propagation** — broadcasting verified identity and reputation data from Asset Hub to destination parachains so that local contracts can query it without cross-chain overhead at read time.

---

## What Gets Broadcast

| Data | Payload Type | Triggered By |
|---|---|---|
| Identity registration / status | IdentityPayload | User or protocol |
| Reputation score and tier | ReputationPayload | User, protocol, or auto |
| Wallet link events | WalletLinkPayload | User or protocol |

---

## How It Works — In One Paragraph

The `IdentityBroadcaster` contract on Asset Hub reads current state from `IdentityRegistry` and `ReputationRegistry`, encodes it into an XCM `Transact` message, and dispatches it to a configured receiver contract on the destination parachain. The receiver validates the origin, stores the data locally, and exposes it through standard view functions. Local contracts on the destination chain query the receiver at zero cross-chain cost.

---

## Key Components

| Component | Location | Role |
|---|---|---|
| `IdentityBroadcaster` | Asset Hub | Reads state, constructs XCM messages, dispatches |
| XCM Transport Layer | Polkadot Relay | Routes messages between parachains |
| Civyx Receiver Contract | Destination Parachain | Accepts messages, stores data, serves queries |

---

## Sections in This Chapter

| Page | What You Will Find |
|---|---|
| [Architecture](architecture.md) | System diagram, component roles, message flow |
| [Message Format and Payloads](messages.md) | XCM program structure, payload definitions, encoding |
| [IdentityBroadcaster Reference](broadcaster.md) | Full function and event reference |
| [Receiver Contract](receiver.md) | Receiving, storing, and querying data on destination chains |
| [Data Freshness](freshness.md) | Staleness model and refresh strategies |
| [Fee Model and Security](fees-security.md) | XCM fees, origin validation, replay protection |
| [Integration Guide](integration-guide.md) | Step-by-step guide for destination parachain integrators |
| [Current State and Roadmap](state-roadmap.md) | What is live, what is next |
