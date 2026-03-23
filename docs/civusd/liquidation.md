# Liquidation

## Overview

Liquidation protects the protocol's solvency. If a position's collateral value falls below the liquidation threshold — due to a drop in PAS price relative to the CivUSD peg — the position becomes eligible for liquidation by any external caller.

---

## Liquidation Threshold

A position becomes eligible for liquidation when its health factor drops below **120%**.

This means: for every 1.00 CivUSD of debt, the position must hold at least 1.20 PAS worth of collateral. Below this level, any address can trigger liquidation.

---

## The Tier-Buffer Tradeoff

Higher reputation earns lower collateral requirements — but also means a smaller buffer before the liquidation threshold.

| Tier | Opening Ratio | Liquidation Threshold | Buffer |
|---|---|---|---|
| 1 (New) | 180% | 120% | 60 percentage points |
| 2 (Established) | 160% | 120% | 40 percentage points |
| 3 (Trusted) | 140% | 120% | 20 percentage points |
| 4 (Veteran) | 125% | 120% | 5 percentage points |
| 5 (Elite) | 110% | 120% | — (opens below threshold) |

> **Note:** Tier 5 users open positions at 110%, which is already below the 120% liquidation threshold. This means Elite-tier positions require active management and collateral top-ups to remain healthy. This is the risk tradeoff of the maximum reputation discount.

---

## Liquidation Flow

Any external caller can liquidate an eligible position by calling `liquidate(address user)`:

1. The liquidator repays the outstanding CivUSD debt on behalf of the position holder
2. The liquidator receives the position's collateral plus a **5% liquidation bonus**
3. The position is closed
4. The original position holder loses their collateral but their CivUSD debt is cleared

```solidity
function liquidate(
    address user
) external nonReentrant whenNotPaused {
    require(positions[user].active, "No active position");
    require(
        getPositionHealth(user) < liquidationThreshold,
        "Position is healthy"
    );

    uint256 debt       = positions[user].civUSDMinted;
    uint256 collateral = positions[user].collateral;
    uint256 bonus      = (collateral * liquidationBonus) / 100;
    uint256 payout     = collateral + bonus;

    _burn(msg.sender, debt);

    positions[user].active      = false;
    positions[user].civUSDMinted = 0;
    positions[user].collateral  = 0;

    (bool success, ) = msg.sender.call{value: payout}("");
    require(success, "Liquidation payout failed");

    emit Liquidated(user, msg.sender, debt, collateral);
}
```

---

## Liquidation Bonus

Liquidators receive **5% of the liquidated collateral** as an incentive for maintaining protocol solvency. This bonus is funded from the position's collateral, not from a separate reserve.

**Example:**
- User has 1200 PAS collateral and 1000 CivUSD debt
- Position health = 120% — exactly at threshold
- PAS price drops slightly → health < 120% → eligible
- Liquidator repays 1000 CivUSD
- Liquidator receives 1200 PAS + 5% bonus = 1260 PAS
- Net liquidator profit: 1260 - 1000 (CivUSD value) = 260 PAS

---

## Protecting Against Liquidation

1. **Monitor health factor** — use `getPositionHealth(address)` regularly
2. **Add collateral** — call `addCollateral()` with additional PAS when health factor declines
3. **Partially burn** — reduce debt by burning some CivUSD to improve health factor
4. **Understand your tier's buffer** — tier 4 and 5 users have minimal buffers and must manage positions more actively than tier 1 and 2 users
