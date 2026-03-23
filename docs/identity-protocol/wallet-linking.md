# Wallet Linking

## Overview

Once an identity exists, additional wallets can be linked to it. Linking proves that the person controlling the new wallet is the same person who knows the secret behind the existing commitment — without revealing the secret or making the connection between wallets visible on-chain.

All linked wallets share the same reputation score and CivUSD borrowing power.

---

## Linking Flow

### Step 1 — Load Secret

The user opens the Link Wallet page on the new wallet's browser session. They load their secret by uploading the backup file or pasting it manually.

### Step 2 — Read Commitment From Chain

The frontend reads the commitment stored on-chain using `getCommitment(address)` on the `IdentityRegistry`. This is always used as the source of truth — it ensures the commitment passed into the ZK circuit matches exactly what was stored at registration. Computing it locally and hoping it matches is not sufficient and will cause proof verification to fail.

### Step 3 — Compute Nullifier

The frontend computes the nullifier for this specific wallet link:

```
nullifier = pedersen_hash([secret, wallet_address])
```

This is computed using Barretenberg's Pedersen hash — the same implementation used inside the ZK circuit. Each wallet address produces a unique nullifier. Linking wallet A and wallet B to the same identity produces two entirely different nullifiers.

### Step 4 — Generate ZK Proof

The wallet link circuit runs in the browser. It takes four inputs:

| Input | Visibility | Value |
|---|---|---|
| `secret` | Private | The user's secret — never transmitted |
| `commitment` | Public | Pedersen hash of secret, read from chain |
| `nullifier` | Public | pedersen_hash([secret, wallet_address]) |
| `wallet_address` | Public | The address being linked |

The circuit proves two statements simultaneously:

1. `pedersen_hash([secret]) == commitment` — the caller knows the secret behind the registered commitment
2. `pedersen_hash([secret, wallet_address]) == nullifier` — the nullifier was derived honestly

Proof generation runs entirely in the browser. It takes approximately **10–30 seconds** depending on device hardware. No data is sent to any server during this process.

### Step 5 — Submit On-Chain

The user calls `linkWallet(commitment, proof, nullifier)` on the `IdentityRegistry`. The contract:

1. Verifies the identity associated with the commitment is active
2. Verifies the nullifier has not been used before
3. Calls `WalletLinkVerifier.verify(proof, [commitment, nullifier, wallet_address])`
4. If verification passes, records the nullifier as used and maps the new wallet to the commitment
5. Emits a `WalletLinked` event

```solidity
function linkWallet(
    bytes32 commitment,
    bytes calldata proof,
    bytes32 nullifier
) external {
    require(identities[commitment].active, "Identity not active");
    require(!usedNullifiers[nullifier], "Nullifier already used");

    bytes32[] memory publicInputs = new bytes32[](3);
    publicInputs[0] = commitment;
    publicInputs[1] = nullifier;
    publicInputs[2] = bytes32(uint256(uint160(msg.sender)));

    require(walletLinkVerifier.verify(proof, publicInputs), "Invalid proof");

    usedNullifiers[nullifier] = true;
    walletToCommitment[msg.sender] = commitment;
    emit WalletLinked(msg.sender, commitment);
}
```

---

## Multiple Wallets

There is no hard limit on the number of wallets that can be linked to a single identity. Each linking operation requires its own proof and its own on-chain transaction. No additional stake is required beyond the original registration deposit.

---

## Cross-Wallet Reputation Sharing

All wallets linked to the same identity share a single reputation score. When the `TrustOracle` is queried with any linked wallet address, it resolves to the commitment and returns the score associated with that commitment.

A user can earn reputation on wallet A, link wallet B, and immediately use wallet B to access CivUSD's reputation-tiered collateral ratios. The score is tied to the identity, not to any individual wallet.

---

## Unlinking

Individual wallets cannot be selectively unlinked without deactivating the entire identity. This is a deliberate security constraint — if selective unlinking were allowed, a user could link a wallet to earn reputation and then unlink it to disassociate from that history. The only path to removing a wallet from an identity is full identity deactivation.
