# Identity Protocol — Overview

## What Is a Civyx Identity?

A Civyx identity is not an email address, a username, or a government ID. It is a single cryptographic commitment stored on-chain, backed by a PAS stake, proven through zero-knowledge cryptography.

The user knows a secret. The chain knows a hash of that secret. The ZK proof bridges the gap — proving knowledge without revealing anything.

One identity can span multiple wallets. All of them share the same reputation score and borrowing power. Identity is not tied to a single address — it is tied to a person.

---

## Core Concepts

### The Secret

When a user registers on Civyx, their browser generates a cryptographically random 32-byte secret. This secret never leaves the device. It is never sent to any server. It is never stored on-chain.

The secret is a BN254 field element — a 256-bit number that fits within the curve's scalar field. This constraint matters because the Pedersen hash function used in the ZK circuits operates over BN254.

```
secret = random 32 bytes, masked to fit BN254 field
```

The user is responsible for backing this up. If it is lost, the identity cannot be proven and no new wallets can be linked. The frontend generates a downloadable backup file at registration time.

---

### The Commitment

The commitment is the only identity-related value stored on-chain. It is the Pedersen hash of the secret, computed using Barretenberg's BN254 implementation — the same hash function used inside the Noir ZK circuits.

```
commitment = pedersen_hash([secret])
```

This is a one-way function. Given the commitment, recovering the secret is computationally infeasible. Given the secret, computing the commitment is instant. The commitment serves as the public anchor of the identity — it links all of a user's wallets without revealing what they have in common.

---

### The Stake

Every identity registration requires a PAS stake deposited alongside the commitment. The minimum stake is **0.01 PAS**.

The stake serves two purposes. First, it creates a Sybil cost — generating thousands of fake identities requires locking up real capital. Second, it aligns incentives — a user with stake on the line has a reason to maintain their identity honestly.

The stake is held by the `IdentityRegistry` and returned in full when the identity is deactivated. It does not earn yield. It does not get slashed. It is purely a commitment deposit.

---

### The Nullifier

A nullifier is a one-time value derived from the secret and a specific action identifier:

```
nullifier = pedersen_hash([secret, action_id])
```

Nullifiers prevent proof replay. Once a nullifier has been submitted and recorded on-chain, the same proof cannot be submitted again. The `IdentityRegistry` maintains a permanent mapping of used nullifiers.

For wallet linking, `action_id` is the wallet address being linked — meaning each wallet produces a unique nullifier and linking the same wallet twice is impossible.

---

## Identity Lifecycle

```
Generate Secret
      │
      ▼
Compute Commitment
      │
      ▼
Register On-Chain (stake PAS)
      │
      ├──► Link Additional Wallets (ZK proof per wallet)
      │
      ├──► Earn Reputation (all linked wallets share score)
      │
      ├──► Mint CivUSD (reputation-tiered collateral)
      │
      └──► Deactivate (recover stake, score preserved)
```

---

## Identity Layer Contracts

| Contract | Address | Purpose |
|---|---|---|
| IdentityRegistry | `0x56BBC4969818d4E27Fe39983f8aDee4F3e1C5c6f` | Central store for identities, stakes, nullifiers |
| WalletLinkVerifier | `0x72CC5BA2958CB688B00dFE2E578Db3BbB79eD311` | ZK verifier for wallet linking |
| NullifierVerifier | `0x0454a4798602babb16529F49920E8B2f4a747Bb2` | ZK verifier for nullifier circuit |
| IdentityVerifier | `0xa2Cd20296027836dbD67874Ebd4a11Eeede292C8` | ZK verifier for identity circuit |
| IdentityVerifierRouter | `0xC2D5F1C13e2603624a717409356DD48253f17319` | Routes verification by proof type |
| IdentityBroadcaster | `0x9A5710098B845e7841E1D09E1bde0dC1e30374AC` | XCM broadcaster for cross-chain portability |
