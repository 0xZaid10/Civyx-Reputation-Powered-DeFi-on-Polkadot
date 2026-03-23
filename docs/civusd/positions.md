# Position Management

## Position Data Model

Every active CivUSD position is stored in the `positions` mapping keyed by wallet address:

```solidity
struct Position {
    uint256 collateral;    // PAS deposited (wei)
    uint256 civUSDMinted;  // CivUSD outstanding
    uint8   tierAtMint;    // Reputation tier when minted
    uint256 mintedAt;      // Timestamp of mint
    bool    active;        // Whether position is open
}
```

---

## One Position Per Wallet

In the current version, each wallet can hold only one active position at a time. To open a second position, the first must be fully burned. Multi-position support per wallet is on the roadmap.

---

## Position Health

Position health is the ratio of collateral value to outstanding CivUSD debt, expressed as a percentage:

```solidity
function getPositionHealth(
    address user
) public view returns (uint256 healthFactor) {
    Position memory pos = positions[user];
    if (!pos.active || pos.civUSDMinted == 0) return type(uint256).max;

    uint256 collateralValue = getCollateralValue(pos.collateral);
    uint256 debtValue       = pos.civUSDMinted;

    healthFactor = (collateralValue * 100) / debtValue;
}
```

A health factor above 100 means the position is collateralized. A health factor below 120 triggers liquidation eligibility.

---

## Collateral Top-Up

A user can add collateral to an existing position at any time to improve health factor without changing the CivUSD debt:

```solidity
function addCollateral() external payable nonReentrant {
    require(positions[msg.sender].active, "No active position");
    require(msg.value > 0, "Must send collateral");

    positions[msg.sender].collateral += msg.value;

    emit CollateralAdded(msg.sender, msg.value);
}
```

This is the recommended action when a position's health factor approaches the liquidation threshold during a period of PAS price decline.

---

## Reading Position Data

```solidity
// Full position record
function getPosition(address user)
    external view returns (Position memory);

// Current health factor
function getPositionHealth(address user)
    external view returns (uint256);

// Collateral ratio effective for this user
function getCollateralRatio(address user)
    external view returns (uint256);

// Collateral required to mint a given amount
function getRequiredCollateral(address user, uint256 amount)
    external view returns (uint256);
```

---

## Monitoring Your Position

Users should monitor their position health factor during volatile PAS price movements. The recommended approach:

1. Check health factor regularly using `getPositionHealth(address)`
2. If health factor approaches 130–140, consider adding collateral via `addCollateral()`
3. If health factor drops below 120, the position is eligible for liquidation by any external caller
4. Maintain a buffer appropriate for your risk tolerance — tier 5 users (110% ratio) have a smaller buffer than tier 1 users (180% ratio)
