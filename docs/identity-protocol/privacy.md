# Privacy Guarantees

## What Civyx Does and Does Not Hide

Civyx provides meaningful privacy for identity data — but it is important to understand exactly what is and is not hidden.

---

## What Is Hidden

**The secret is never on-chain.** Only its Pedersen hash — the commitment — is stored. The hash function is one-way. Given the commitment, recovering the secret is computationally infeasible.

**ZK proofs reveal nothing beyond stated public inputs.** The wallet link proof reveals the commitment, the nullifier, and the wallet address — all of which are already public inputs to the transaction. No information about the secret, no information about other linked wallets, and no information that could be used to correlate identities is exposed by the proof itself.

**Nullifiers are unlinkable across actions.** Each nullifier is derived from the secret combined with a specific action identifier. Knowing one nullifier gives zero information about other nullifiers derived from the same secret.

**Proof generation is entirely local.** The Barretenberg WASM, Noir circuit bytecode, and proving key all run inside the user's browser. No proof-related data is sent to any server at any point.

---

## What Is Not Hidden

**Wallet connections are not fully anonymous.** The on-chain state maps each wallet to a commitment hash. Two wallets that share a commitment are linked. An observer cannot determine this without specifically checking both wallets and comparing their commitment values — but a determined adversary who suspects two wallets are linked can confirm this by querying their commitments.

Civyx does not claim to provide full anonymity between linked wallets. It provides:
- Secret privacy — the secret is never revealed
- Unlinkability by default — an observer cannot passively determine wallet connections
- No direct on-chain connection — no single transaction links two wallets together

---

## Practical Privacy Model

Civyx is designed for **Sybil resistance**, not for **hiding wallet connections from targeted investigation**. If an adversary already suspects two wallets belong to the same person and has the resources to query both on-chain, they can confirm the link.

For users who require stronger wallet separation — for example, separating a work identity from a personal identity — the recommendation is to maintain two completely separate Civyx identities with two separate secrets. Linked wallets should be treated as publicly linkable to each other.
