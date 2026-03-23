# Registration Flow

## Overview

Registering a Civyx identity is a three-step process that happens entirely in the browser until the final on-chain transaction. No data is sent to any server at any point.

---

## Step 1 — Generate Secret

The user opens the Civyx frontend and clicks **Generate Secret**. The browser generates 32 random bytes using `crypto.getRandomValues()`, masks the top bits to ensure the value fits within the BN254 field, and displays the result.

```javascript
const bytes = new Uint8Array(32);
crypto.getRandomValues(bytes);
bytes[0] &= 0x1f; // mask to BN254 field
secret = '0x' + bytes.map(b => b.toString(16).padStart(2, '0')).join('');
```

The frontend immediately prompts the user to download a backup file. This file contains the secret in plaintext alongside the wallet address and generation timestamp. **The user must download this file before continuing. There is no way to recover a lost secret — not from the frontend, not from the contract, not from Civyx.**

---

## Step 2 — Compute Commitment

The frontend computes the Pedersen hash of the secret using Barretenberg's WASM, loaded and executed entirely in the browser via the `AsyncApi` layer from bb.js.

```
commitment = pedersen_hash([secret])
```

This computation is entirely local. The commitment is displayed to the user and used in the next step. The secret remains in memory only for the duration of the session.

---

## Step 3 — Register On-Chain

The user calls `registerIdentity(commitment)` on the `IdentityRegistry` with a PAS stake attached. The contract:

1. Verifies the caller does not already have a registered identity
2. Verifies the stake meets the minimum requirement (0.01 PAS)
3. Stores the identity record keyed by commitment
4. Maps the caller's wallet address to the commitment
5. Emits an `IdentityRegistered` event

```solidity
function registerIdentity(bytes32 commitment) external payable {
    require(msg.value >= minimumStake, "Insufficient stake");
    require(walletToCommitment[msg.sender] == bytes32(0), "Already registered");

    identities[commitment] = Identity({
        commitment:   commitment,
        stake:        msg.value,
        registeredAt: block.timestamp,
        active:       true
    });

    walletToCommitment[msg.sender] = commitment;
    emit IdentityRegistered(msg.sender, commitment, msg.value);
}
```

At this point the identity is live. The registering wallet is automatically the first wallet linked to this identity.

---

## Important Notes

**One identity per wallet.** A wallet that is already registered cannot register again. To start fresh, the existing identity must be deactivated first.

**Commitment is permanent.** The commitment stored on-chain at registration cannot be changed. It is derived from the secret — changing it would require knowing a different secret, which defeats the purpose.

**Stake is fully recoverable.** The PAS stake is returned in full on deactivation. It is not a fee. It is a deposit.
