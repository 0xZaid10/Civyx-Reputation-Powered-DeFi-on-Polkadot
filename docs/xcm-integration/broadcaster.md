# IdentityBroadcaster — Full Reference

**Address:** `0x9A5710098B845e7841E1D09E1bde0dC1e30374AC`

---

## State

```solidity
// Receiver contract per destination parachain
mapping(uint32 => address) public destinationContracts;

// XCM fee configuration per destination
mapping(uint32 => XCMFeeConfig) public feeConfigs;

// Auto-broadcast: wallet => parachain => enabled
mapping(address => mapping(uint32 => bool)) public autoBroadcast;

struct XCMFeeConfig {
    uint256 feeAmount;    // Fee in PAS (wei) per message
    uint64  weightLimit;  // Max execution weight
    bool    configured;   // Whether destination is ready
}
```

---

## Broadcast Functions

### broadcastIdentity

Reads identity state from `IdentityRegistry` and dispatches to a destination parachain.

```solidity
function broadcastIdentity(
    bytes32 commitment,
    uint32 destParachain
) external whenNotPaused;
```

---

### broadcastReputation

Reads current reputation state and dispatches to a destination parachain.

```solidity
function broadcastReputation(
    address wallet,
    uint32 destParachain
) external whenNotPaused;
```

Requirements:
- Wallet must have an active Civyx identity
- Destination must be configured with a receiver address and fee config

---

### broadcastReputationBatch

Broadcasts reputation for multiple wallets in one transaction. More gas-efficient than individual calls. Maximum batch size: 50 wallets. Wallets without an active identity are silently skipped.

```solidity
function broadcastReputationBatch(
    address[] calldata wallets,
    uint32 destParachain
) external whenNotPaused;
```

---

### broadcastWalletLink

Propagates a wallet link event to keep destination parachains in sync.

```solidity
function broadcastWalletLink(
    address wallet,
    bytes32 commitment,
    uint32 destParachain
) external whenNotPaused;
```

---

## Auto-Broadcast

Users can register a preference to automatically broadcast reputation updates whenever their score changes:

```solidity
function enableAutoBroadcast(uint32 destParachain) external;
function disableAutoBroadcast(uint32 destParachain) external;
function isAutoBroadcastEnabled(address wallet, uint32 destParachain) external view returns (bool);
```

Once enabled, every task completion that updates the score triggers an automatic XCM broadcast to the configured destination — no user action required. Auto-broadcast incurs XCM fees on every task completion.

---

## Admin Functions

```solidity
// Configure receiver contract on a destination parachain
function setDestinationContract(
    uint32 parachain,
    address receiver
) external onlyRole(DEFAULT_ADMIN_ROLE);

// Configure XCM fee parameters for a destination
function setFeeConfig(
    uint32 parachain,
    uint256 feeAmount,
    uint64 weightLimit
) external onlyRole(DEFAULT_ADMIN_ROLE);

// Read configured receiver
function getDestinationContract(uint32 parachain)
    external view returns (address);

// Estimate fee for a destination
function estimateFee(uint32 destParachain)
    external view returns (uint256);
```

---

## Access Control Roles

| Role | Purpose |
|---|---|
| `DEFAULT_ADMIN_ROLE` | Configure destinations and fee parameters |
| `PAUSER_ROLE` | Pause and unpause broadcasts |

---

## Events

| Event | Parameters | Emitted When |
|---|---|---|
| `IdentityBroadcast` | `bytes32 indexed commitment, uint32 destParachain, uint256 timestamp` | Identity broadcast sent |
| `ReputationBroadcast` | `address indexed wallet, uint32 destParachain, uint256 score, uint8 tier` | Reputation broadcast sent |
| `WalletLinkBroadcast` | `address indexed wallet, bytes32 commitment, uint32 destParachain` | Wallet link broadcast sent |
| `AutoBroadcastEnabled` | `address indexed wallet, uint32 destParachain` | Auto-broadcast enabled |
| `AutoBroadcastDisabled` | `address indexed wallet, uint32 destParachain` | Auto-broadcast disabled |
| `DestinationConfigured` | `uint32 parachain, address receiver` | New destination configured |
| `FeeConfigUpdated` | `uint32 parachain, uint256 feeAmount, uint64 weightLimit` | Fee config updated |
| `BroadcastFailed` | `address wallet, uint32 destParachain, bytes reason` | XCM dispatch failed |

**OpenZeppelin:** `AccessControl`, `Pausable`
