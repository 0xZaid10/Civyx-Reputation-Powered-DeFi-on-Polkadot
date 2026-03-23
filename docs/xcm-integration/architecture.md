# XCM Architecture

## System Diagram

```
┌─────────────────────────────────────────────────────┐
│                  Polkadot Asset Hub                  │
│                                                      │
│   IdentityRegistry       ReputationRegistry          │
│         │                       │                    │
│         └───────────┬───────────┘                    │
│                     ▼                                │
│            IdentityBroadcaster                       │
│                     │                                │
└─────────────────────┼────────────────────────────────┘
                      │ XCM Transact
                      │
┌─────────────────────┼────────────────────────────────┐
│         Polkadot Relay Chain (routing)               │
└─────────────────────┼────────────────────────────────┘
                      │
           ┌──────────┴──────────┐
           │                     │
┌──────────▼──────┐   ┌──────────▼──────┐
│  Parachain A    │   │  Parachain B    │
│                 │   │                 │
│ Civyx Receiver  │   │ Civyx Receiver  │
│                 │   │                 │
│ DeFi protocol   │   │ Governance      │
│ getTier(addr)   │   │ isVerified(addr)│
└─────────────────┘   └─────────────────┘
```

---

## Component Roles

### IdentityBroadcaster (Asset Hub)

The only contract in the system that sends XCM messages. It:
- Reads current state from `IdentityRegistry` and `ReputationRegistry`
- Encodes the data into the correct payload type
- Constructs the full XCM program
- Dispatches via the Asset Hub XCM precompile

All broadcasts originate here. There is no other entry point into the XCM system.

---

### XCM Transport Layer (Polkadot Relay)

Civyx uses the `Transact` XCM instruction to deliver encoded call data to receiver contracts on destination parachains. The relay chain provides:
- Message ordering and routing
- Delivery guarantees
- Fee metering and weight accounting

Civyx does not implement any of this — it is provided by the Polkadot runtime.

---

### Civyx Receiver Contract (Destination Parachain)

Deployed on each destination parachain that wants to integrate Civyx. It:
- Accepts incoming XCM messages from the Asset Hub `IdentityBroadcaster`
- Validates origin against the registered broadcaster address
- Decodes the payload and stores data locally
- Exposes view functions that local contracts query at zero cross-chain cost

---

## Message Flow

```
User calls broadcastReputation(wallet, destParachain)
                │
                ▼
IdentityBroadcaster reads from:
  - identityRegistry.getCommitment(wallet)
  - reputationRegistry.getScore(commitment)
  - reputationRegistry.getTier(commitment)
                │
                ▼
Encodes ReputationPayload
                │
                ▼
Constructs XCM program:
  WithdrawAsset (fee)
  BuyExecution
  Transact (call receiveReputation on receiver)
  RefundSurplus
  DepositAsset
                │
                ▼
Dispatches via XCM precompile
                │
                ▼
Relay chain routes to destination parachain
                │
                ▼
Receiver.receiveReputation(payload) executes
                │
                ▼
Data stored: storedReputation[wallet] = { score, tier, ... }
                │
                ▼
Local contracts query receiver.getTier(wallet)
```

---

## Broadcast Types

| Broadcast | Function | Payload | Use Case |
|---|---|---|---|
| Identity | `broadcastIdentity` | IdentityPayload | Propagate registration or status change |
| Reputation | `broadcastReputation` | ReputationPayload | Update score and tier on destination |
| Reputation (batch) | `broadcastReputationBatch` | Multiple ReputationPayloads | Bulk update for multiple wallets |
| Wallet link | `broadcastWalletLink` | WalletLinkPayload | Keep wallet mappings in sync |
