# Smart Contracts — DeFi Layer

## CivUSD

**Address:** `0xa3ce5424489ed5D8cff238009c61ab48Ef852F6D`

Reputation-aware collateral-backed stablecoin. Requires an active Civyx identity to mint. Fully transferable ERC20 once in circulation.

For the complete functional reference see [CivUSD Contract Reference](../civusd/contract.md).

**Dependencies:**
- `TrustOracle` — reads reputation tier at mint time
- `IdentityRegistry` — verifies active identity status

**Token parameters:**

| Parameter | Value |
|---|---|
| Name | CivUSD |
| Symbol | CivUSD |
| Decimals | 18 |
| Supply | Dynamic |

**Collateral ratios:**

| Tier | Ratio |
|---|---|
| 1 (New) | 180% |
| 2 (Established) | 160% |
| 3 (Trusted) | 140% |
| 4 (Veteran) | 125% |
| 5 (Elite) | 110% |

**Protocol parameters:**

| Parameter | Default Value |
|---|---|
| Mint fee | 50 bps (0.5%) |
| Liquidation threshold | 120% |
| Liquidation bonus | 5% |

**Key functions:**

| Function | Modifiers | Description |
|---|---|---|
| `mint(uint256 civUSDAmount)` | payable, nonReentrant, whenNotPaused | Open position and mint |
| `burn(uint256 civUSDAmount)` | nonReentrant, whenNotPaused | Burn and recover collateral |
| `addCollateral()` | payable, nonReentrant | Top up collateral |
| `liquidate(address user)` | nonReentrant, whenNotPaused | Liquidate unhealthy position |
| `getRequiredCollateral(address user, uint256 amount)` | view | Calculate required collateral |
| `getPositionHealth(address user)` | view | Current health factor |
| `getPosition(address user)` | view | Full position record |
| `withdrawFees(address recipient, uint256 amount)` | onlyRole(DEFAULT_ADMIN_ROLE), nonReentrant | Withdraw protocol fees |
| `setCollateralRatio(uint8 tier, uint256 ratio)` | onlyRole(DEFAULT_ADMIN_ROLE) | Update ratio |
| `setMintFee(uint256 feeBps)` | onlyRole(DEFAULT_ADMIN_ROLE) | Update fee |

**Access control roles:**

| Role | Purpose |
|---|---|
| `DEFAULT_ADMIN_ROLE` | Parameter updates, fee withdrawal |
| `PAUSER_ROLE` | Pause and unpause |

**Events:**

| Event | Parameters |
|---|---|
| `Minted` | `address indexed user, uint256 amount, uint256 collateral, uint8 tier, uint256 ratio` |
| `Burned` | `address indexed user, uint256 amount, uint256 collateralReturned` |
| `CollateralAdded` | `address indexed user, uint256 amount` |
| `Liquidated` | `address indexed user, address indexed liquidator, uint256 debt, uint256 collateral` |
| `CollateralRatioUpdated` | `uint8 tier, uint256 oldRatio, uint256 newRatio` |
| `MintFeeUpdated` | `uint256 oldFee, uint256 newFee` |
| `FeesWithdrawn` | `address indexed recipient, uint256 amount` |

**OpenZeppelin:** `ERC20`, `AccessControl`, `ReentrancyGuard`, `Pausable`
