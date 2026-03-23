# Burning CivUSD

## Overview

Burning CivUSD closes or partially reduces a position and returns proportional collateral to the caller. There is no fee for burning.

---

## Burn Flow

### Step 1 — Verify Active Position

```solidity
require(positions[msg.sender].active, "No active position");
require(
    balanceOf(msg.sender) >= civUSDAmount,
    "Insufficient CivUSD balance"
);
require(
    civUSDAmount <= positions[msg.sender].civUSDMinted,
    "Cannot burn more than minted"
);
```

### Step 2 — Calculate Proportional Collateral

The collateral returned is proportional to the fraction of the debt being repaid:

```solidity
uint256 totalMinted     = positions[msg.sender].civUSDMinted;
uint256 totalCollateral = positions[msg.sender].collateral;

uint256 collateralToReturn = (totalCollateral * civUSDAmount) / totalMinted;
```

### Step 3 — Update Position and Return Collateral

```solidity
positions[msg.sender].civUSDMinted  -= civUSDAmount;
positions[msg.sender].collateral    -= collateralToReturn;

if (positions[msg.sender].civUSDMinted == 0) {
    positions[msg.sender].active = false;
}

_burn(msg.sender, civUSDAmount);

(bool success, ) = msg.sender.call{value: collateralToReturn}("");
require(success, "Collateral return failed");
```

---

## Full Burn Function

```solidity
function burn(
    uint256 civUSDAmount
) external nonReentrant whenNotPaused {
    require(civUSDAmount > 0, "Amount must be positive");
    require(positions[msg.sender].active, "No active position");
    require(
        balanceOf(msg.sender) >= civUSDAmount,
        "Insufficient CivUSD balance"
    );
    require(
        civUSDAmount <= positions[msg.sender].civUSDMinted,
        "Cannot burn more than minted"
    );

    uint256 totalMinted     = positions[msg.sender].civUSDMinted;
    uint256 totalCollateral = positions[msg.sender].collateral;
    uint256 collateralToReturn = (totalCollateral * civUSDAmount) / totalMinted;

    positions[msg.sender].civUSDMinted  -= civUSDAmount;
    positions[msg.sender].collateral    -= collateralToReturn;

    if (positions[msg.sender].civUSDMinted == 0) {
        positions[msg.sender].active = false;
    }

    _burn(msg.sender, civUSDAmount);

    (bool success, ) = msg.sender.call{value: collateralToReturn}("");
    require(success, "Collateral return failed");

    emit Burned(msg.sender, civUSDAmount, collateralToReturn);
}
```

---

## Partial vs Full Burns

**Partial burn:** Burns a portion of the outstanding CivUSD debt and returns the proportional collateral. The position remains open with reduced debt and reduced collateral.

**Full burn:** Burns the entire outstanding debt. The position is closed (`active = false`) and all remaining collateral is returned.

---

## Notes

**The mint fee is not refunded on burn.** It was charged at mint time as a one-time protocol fee and is retained regardless of how long the position was held.

**You must hold the CivUSD to burn it.** If you have transferred your CivUSD to another address, you must acquire it back before burning. The contract checks `balanceOf(msg.sender)`.

**Partial burns do not reset the tier.** The collateral ratio from the original mint is still in effect for the remaining position. The health factor recalculates based on the updated collateral and debt values.
