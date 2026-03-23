# Fee Structure

## Mint Fee

CivUSD charges a one-time mint fee at position open. There is no ongoing interest rate, no recurring cost, and no fee on burn.

| Parameter | Default Value | Range |
|---|---|---|
| `mintFeeBps` | 50 (0.5%) | 0 – 500 bps |

**Example:** Minting 1000 CivUSD at the default 0.5% fee costs 5 CivUSD worth of collateral retained by the protocol.

The fee is deducted from the deposited collateral at mint time and accumulated in the `protocolFees` storage variable:

```solidity
uint256 fee = (civUSDAmount * mintFeeBps) / 10000;
protocolFees += fee;
```

---

## Protocol Fee Withdrawal

Accumulated fees are withdrawable by the contract admin:

```solidity
function withdrawFees(
    address recipient,
    uint256 amount
) external onlyRole(DEFAULT_ADMIN_ROLE) nonReentrant {
    require(amount <= protocolFees, "Insufficient fees");
    protocolFees -= amount;
    (bool success, ) = recipient.call{value: amount}("");
    require(success, "Fee withdrawal failed");
    emit FeesWithdrawn(recipient, amount);
}
```

---

## Fee Updates

The mint fee can be updated by the admin at any time within the 0–500 bps range. Changes only affect new mint operations — existing positions are not retroactively affected.

```solidity
function setMintFee(uint256 feeBps)
    external onlyRole(DEFAULT_ADMIN_ROLE);
```

---

## No Other Fees

| Action | Fee |
|---|---|
| Mint | One-time fee (default 0.5%) |
| Burn | None |
| Add collateral | None |
| Liquidation | None (liquidator receives bonus from collateral) |
| Identity registration | No Civyx fee — only PAS gas |
| Wallet linking | No Civyx fee — only PAS gas |
