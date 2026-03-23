# Collateral Ratios

## How Ratios Work

The collateral ratio determines how much PAS a user must deposit to mint a given amount of CivUSD. A ratio of 150% means the user must deposit $1.50 worth of PAS for every $1.00 of CivUSD minted.

CivUSD uses five tiers of collateral ratios, directly mapped to the five reputation tiers defined by the `TrustOracle`. The ratio is read live at mint time — not cached.

---

## Ratio Table

| Tier | Score Range | Label | Collateral Ratio | Example: mint 1000 CivUSD |
|---|---|---|---|---|
| 1 | 0 – 199 | New | 180% | Deposit 1800 PAS worth |
| 2 | 200 – 399 | Established | 160% | Deposit 1600 PAS worth |
| 3 | 400 – 599 | Trusted | 140% | Deposit 1400 PAS worth |
| 4 | 600 – 799 | Veteran | 125% | Deposit 1250 PAS worth |
| 5 | 800 – 1000 | Elite | 110% | Deposit 1100 PAS worth |

The difference between tier 1 and tier 5 is **70 percentage points** of collateral. For a user minting 1000 CivUSD, this translates to a difference of **700 PAS** in required collateral — earned entirely through verifiable on-chain behavior.

---

## Ratio Calculation

At mint time, the contract reads the caller's tier and looks up the corresponding ratio:

```solidity
function getRequiredCollateral(
    address user,
    uint256 civUSDAmount
) public view returns (uint256) {
    uint8   tier  = trustOracle.getTier(user);
    uint256 ratio = collateralRatios[tier];
    return (civUSDAmount * ratio) / 100;
}
```

---

## Important Notes

**Ratios are read live.** If a user's reputation improves between mint operations, their next mint automatically uses the better ratio. Improvements are reflected immediately.

**Existing positions are not retroactively adjusted.** A position opened at 180% stays at 180% regardless of subsequent ratio changes or reputation improvements. To benefit from a better ratio, the user must close the existing position and open a new one.

**Ratios are governance-updatable.** Collateral ratios can be updated by the contract admin and will eventually move to governance control. Changes only affect new mint operations.
