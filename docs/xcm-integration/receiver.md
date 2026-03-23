# Receiver Contract

## Overview

The Civyx receiver contract is deployed on each destination parachain that integrates Civyx. It accepts incoming XCM messages from the Asset Hub `IdentityBroadcaster`, validates their origin, decodes the payload, and stores the data locally.

Once stored, any contract on the destination parachain can query reputation data at zero cross-chain cost.

---

## Origin Validation

Every incoming XCM message is validated against the registered Asset Hub broadcaster address:

```solidity
modifier onlyXCMOrigin() {
    require(
        _getXCMOrigin() == registeredBroadcaster,
        "Unauthorized XCM origin"
    );
    _;
}
```

Messages from any unregistered origin are rejected immediately. This is the primary security guarantee of the receiver — no external actor can inject false reputation data.

---

## Receiving Functions

### receiveIdentity

```solidity
function receiveIdentity(
    bytes calldata encodedPayload
) external onlyXCMOrigin {
    IdentityPayload memory data = abi.decode(encodedPayload, (IdentityPayload));

    require(
        data.timestamp > storedIdentities[data.commitment].updatedAt,
        "Stale update rejected"
    );

    storedIdentities[data.commitment] = StoredIdentity({
        commitment: data.commitment,
        wallet:     data.wallet,
        active:     data.active,
        stake:      data.stake,
        updatedAt:  data.timestamp
    });

    walletToCommitment[data.wallet] = data.commitment;
    emit IdentityReceived(data.commitment, data.wallet, data.active);
}
```

### receiveReputation

```solidity
function receiveReputation(
    bytes calldata encodedPayload
) external onlyXCMOrigin {
    ReputationPayload memory data = abi.decode(encodedPayload, (ReputationPayload));

    require(data.score <= 1000, "Score out of bounds");
    require(data.tier >= 1 && data.tier <= 5, "Tier out of bounds");
    require(
        data.timestamp > storedReputation[data.wallet].updatedAt,
        "Stale update rejected"
    );

    storedReputation[data.wallet] = StoredReputation({
        commitment: data.commitment,
        score:      data.score,
        tier:       data.tier,
        active:     data.active,
        updatedAt:  data.timestamp
    });

    emit ReputationReceived(data.wallet, data.score, data.tier);
}
```

### receiveWalletLink

```solidity
function receiveWalletLink(
    bytes calldata encodedPayload
) external onlyXCMOrigin {
    WalletLinkPayload memory data = abi.decode(encodedPayload, (WalletLinkPayload));

    require(
        data.timestamp > walletLinkTimestamps[data.wallet],
        "Stale update rejected"
    );

    walletToCommitment[data.wallet] = data.commitment;
    walletLinkTimestamps[data.wallet] = data.timestamp;
    emit WalletLinkReceived(data.wallet, data.commitment);
}
```

---

## Query Functions

```solidity
// Raw reputation score (0–1000)
function getScore(address wallet) external view returns (uint256);

// Reputation tier (1–5)
function getTier(address wallet) external view returns (uint8);

// Full stored reputation record
function getReputation(address wallet) external view returns (StoredReputation memory);

// Identity status for a commitment
function getIdentity(bytes32 commitment) external view returns (StoredIdentity memory);

// True if wallet has a verified, active Civyx identity
function isVerified(address wallet) external view returns (bool);

// Commitment hash for a wallet
function getCommitment(address wallet) external view returns (bytes32);

// True if stored data is within maxAge seconds
function isFresh(address wallet, uint256 maxAge) external view returns (bool);
```

---

## Stored Data Structures

```solidity
struct StoredReputation {
    bytes32 commitment;
    uint256 score;
    uint8   tier;
    bool    active;
    uint256 updatedAt;  // Asset Hub timestamp of last update
}

struct StoredIdentity {
    bytes32 commitment;
    address wallet;
    bool    active;
    uint256 stake;
    uint256 updatedAt;
}
```
