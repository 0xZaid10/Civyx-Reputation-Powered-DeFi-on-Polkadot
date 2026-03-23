# Identity Deactivation

## Overview

Identity deactivation is a deliberate, user-initiated action. There is no automatic expiry, no time limit, and no admin-triggered deactivation under normal operating conditions.

---

## Who Can Deactivate

Only the wallet that originally registered the identity can call `deactivateIdentity()`. Linked wallets do not have this permission. This prevents a compromised secondary wallet from destroying an entire identity and recovering its stake.

Addresses holding the `OPERATOR_ROLE` can trigger deactivation in exceptional circumstances — protocol-level safety mechanisms — but this is gated behind OpenZeppelin's `AccessControl` and is not part of normal operation.

---

## What Happens On Deactivation

When `deactivateIdentity()` is called:

1. The identity status is set to inactive in the `IdentityRegistry`
2. The full PAS stake is returned to the calling wallet — no fees, no penalties
3. The wallet-to-commitment mapping for the registering wallet is cleared
4. An `IdentityDeactivated` event is emitted

Linked wallets are not automatically cleared. Their `walletToCommitment` entries still point to the commitment. However, since the identity is marked inactive, any protocol action that requires an active identity — earning reputation, minting CivUSD, linking additional wallets — will fail for all wallets associated with that commitment until the identity is reactivated.

---

## What Is Preserved

Deactivation does not erase anything.

- The commitment record remains in contract storage
- The reputation score tied to that commitment is fully preserved
- All nullifier records remain
- Linked wallet mappings remain

This is intentional. Reputation represents real, verified on-chain history. It should not be destroyable by a single transaction. If a user deactivates and re-registers with the same commitment and secret, they recover their full score and all linked wallet mappings immediately.

---

## Reactivation

A deactivated identity can be reactivated by calling `registerIdentity(commitment)` again with a fresh PAS stake. The contract detects that the commitment already exists, verifies the caller is the original registering wallet, flips the active flag back to true, and records the new stake. No new commitment is created. No reputation is lost.

---

## Edge Cases

**Compromised registering wallet.** A bad actor with the registering wallet can deactivate the identity and recover the stake. They cannot steal the reputation or mint CivUSD — those actions require a valid ZK proof, which requires knowing the secret. Damage is limited to the stake recovery and forcing the real user to re-register.

**Lost secret.** Without the secret, no new ZK proofs can be generated and no new wallets can be linked. The identity becomes effectively frozen — it cannot be used for new ZK-gated actions, but its existing reputation score and wallet mappings remain intact on-chain. Existing linked wallets can still query their reputation.

**Starting fresh.** A user can deactivate, recover the stake, and register a brand new identity with a new secret and commitment. The old reputation stays permanently on the old commitment. The new identity starts at zero. There is no mechanism to transfer reputation between identities — this is a deliberate anti-gaming constraint.
