# Cryptographic Security

## ZK Proof Guarantees

The core identity operations in Civyx — wallet linking, identity verification, nullifier consumption — are gated by ZK proofs generated from Noir circuits and verified by Barretenberg-generated Solidity verifier contracts.

**Completeness.** A user who knows the correct secret can always generate a valid proof. A legitimate wallet link will always succeed if the secret is correct and the commitment matches.

**Soundness.** A user who does not know the secret cannot generate a valid proof. Without the secret, there is no computationally feasible path to producing a proof that satisfies the verifier. This rests on the hardness of the discrete logarithm problem on BN254 and the security of the UltraKeccakHonk proof system.

**Zero-knowledge.** The proof reveals nothing about the secret beyond the public inputs explicitly included. An observer who sees the proof transcript learns nothing about the secret or about other wallets linked to the same identity.

These guarantees hold under standard cryptographic assumptions for BN254 and UltraHonk. They have not been formally verified for this specific deployment.

---

## Pedersen Hash Properties

The commitment and nullifier scheme relies on Barretenberg's Pedersen hash over BN254:

```
commitment = pedersen_hash([secret])
nullifier  = pedersen_hash([secret, action_id])
```

**Collision resistance.** Finding two different secrets that produce the same commitment requires breaking the Pedersen hash collision resistance over BN254. No efficient algorithm is known.

**Preimage resistance.** Given a commitment, recovering the secret requires solving the discrete logarithm problem on BN254. Computationally infeasible.

**Nullifier independence.** Knowing one nullifier gives zero information about other nullifiers derived from the same secret. Each action produces an independently random-looking output.

---

## Nullifier Replay Protection

Every ZK proof that produces a nullifier records it in the `usedNullifiers` mapping on submission. The mapping is permanent and append-only — nullifiers are never deleted.

```solidity
mapping(bytes32 => bool) public usedNullifiers;

// Checked before every proof-gated action:
require(!usedNullifiers[nullifier], "Nullifier already used");

// Written after successful verification:
usedNullifiers[nullifier] = true;
```

A captured proof cannot be resubmitted — the second attempt produces the same nullifier, which is already marked as used and the transaction reverts.

---

## Commitment Privacy

The commitment stored on-chain is a hash of the secret. It does not reveal the secret.

However, an observer who queries `getCommitment(walletA)` and `getCommitment(walletB)` and finds they return the same value can confirm the two wallets share an identity. Civyx does not provide full anonymity between linked wallets — it provides Sybil resistance and default unlinkability.

For users who require strict wallet separation, the recommendation is to maintain two completely separate Civyx identities with different secrets rather than linking both wallets to one identity.

---

## Browser-Side Proof Generation

All ZK proofs are generated entirely within the user's browser using:
- Barretenberg WASM (3.0.0-nightly.20260102)
- Noir JS (1.0.0-beta.18)
- Circuit bytecode loaded from `/public/<circuit>.json`

No proof-related data — secret, witness, intermediate values — is transmitted to any server at any point during proof generation. The only data that leaves the browser is the final proof and public inputs submitted to the on-chain verifier via a wallet transaction.
