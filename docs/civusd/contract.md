# CivUSD — Contract Reference

## Contract Details

**Address:** `0xa3ce5424489ed5D8cff238009c61ab48Ef852F6D`

**Dependencies:**
- `TrustOracle` — reads reputation tier at mint time
- `IdentityRegistry` — verifies active identity

---

## State Variables

| Variable | Type | Description |
|---|---|---|
| `positions` | `mapping(address => Position)` | Active positions per wallet |
| `collateralRatios` | `mapping(uint8 => uint256)` | Ratio per tier (in percent) |
| `mintFeeBps` | uint256 | One-time mint fee in basis points |
| `liquidationThreshold` | uint256 | Health factor triggering liquidation (120) |
| `liquidationBonus` | uint256 | Bonus paid to liquidators (5%) |
| `protocolFees` | uint256 | Accumulated protocol fees (wei) |
| `trustOracle` | ITrustOracle | Reference to TrustOracle |

---

## Data Structures

```solidity
struct Position {
    uint256 collateral;    // PAS deposited (wei)
    uint256 civUSDMinted;  // Outstanding CivUSD debt
    uint8   tierAtMint;    // Reputation tier at mint time
    uint256 mintedAt;      // Mint timestamp
    bool    active;        // Position status
}
```

---

## Collateral Ratio Configuration

| Tier | Default Ratio |
|---|---|
| 1 | 180% |
| 2 | 160% |
| 3 | 140% |
| 4 | 125% |
| 5 | 110% |

---

## Functions

| Function | Visibility | Modifiers | Description |
|---|---|---|---|
| `mint(uint256 civUSDAmount)` | external | payable, nonReentrant, whenNotPaused | Open position and mint CivUSD |
| `burn(uint256 civUSDAmount)` | external | nonReentrant, whenNotPaused | Burn CivUSD and recover collateral |
| `addCollateral()` | external | payable, nonReentrant | Add collateral to existing position |
| `liquidate(address user)` | external | nonReentrant, whenNotPaused | Liquidate undercollateralized position |
| `getRequiredCollateral(address user, uint256 amount)` | external | view | Calculate collateral needed |
| `getPositionHealth(address user)` | external | view | Current health factor |
| `getPosition(address user)` | external | view | Full position record |
| `getCollateralRatio(address user)` | external | view | Effective ratio for a user |
| `withdrawFees(address recipient, uint256 amount)` | external | onlyRole(DEFAULT_ADMIN_ROLE), nonReentrant | Withdraw protocol fees |
| `setCollateralRatio(uint8 tier, uint256 ratio)` | external | onlyRole(DEFAULT_ADMIN_ROLE) | Update ratio for a tier |
| `setMintFee(uint256 feeBps)` | external | onlyRole(DEFAULT_ADMIN_ROLE) | Update mint fee |
| `setLiquidationThreshold(uint256 threshold)` | external | onlyRole(DEFAULT_ADMIN_ROLE) | Update liquidation threshold |
| `pause()` | external | onlyRole(PAUSER_ROLE) | Pause all operations |
| `unpause()` | external | onlyRole(PAUSER_ROLE) | Resume operations |

---

## Access Control Roles

| Role | Identifier | Purpose |
|---|---|---|
| `DEFAULT_ADMIN_ROLE` | `0x00` | Fee withdrawal, ratio and parameter updates |
| `PAUSER_ROLE` | `keccak256("PAUSER_ROLE")` | Pause and unpause |

---

## Events

| Event | Parameters | Emitted When |
|---|---|---|
| `Minted` | `address indexed user, uint256 amount, uint256 collateral, uint8 tier, uint256 ratio` | CivUSD minted |
| `Burned` | `address indexed user, uint256 amount, uint256 collateralReturned` | CivUSD burned |
| `CollateralAdded` | `address indexed user, uint256 amount` | Collateral topped up |
| `Liquidated` | `address indexed user, address indexed liquidator, uint256 debt, uint256 collateral` | Position liquidated |
| `CollateralRatioUpdated` | `uint8 tier, uint256 oldRatio, uint256 newRatio` | Ratio changed |
| `MintFeeUpdated` | `uint256 oldFee, uint256 newFee` | Mint fee changed |
| `FeesWithdrawn` | `address indexed recipient, uint256 amount` | Protocol fees withdrawn |

---

## OpenZeppelin Modules

| Module | Purpose |
|---|---|
| `ERC20` | Standard token implementation |
| `AccessControl` | Role-based permissions |
| `ReentrancyGuard` | Reentrancy protection on PAS transfers |
| `Pausable` | Emergency stop mechanism |
