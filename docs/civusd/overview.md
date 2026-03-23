# CivUSD — Overview

## What Is CivUSD?

CivUSD is the DeFi layer of the Civyx protocol — a collateral-backed stablecoin where the rules of borrowing are not fixed. Instead of treating every user identically regardless of history, CivUSD reads reputation directly from the `TrustOracle` at mint time and adjusts the collateral requirement accordingly.

This is the mechanism that closes the Civyx protocol loop. Identity enables reputation. Reputation enables cheaper capital. Cheaper capital incentivizes more on-chain activity. More activity builds more reputation.

**Contract address:** `0xa3ce5424489ed5D8cff238009c61ab48Ef852F6D`

---

## Token Parameters

| Parameter | Value |
|---|---|
| Name | CivUSD |
| Symbol | CivUSD |
| Decimals | 18 |
| Supply | Dynamic — minted and burned per position |
| Standard | ERC20 |

CivUSD is fully transferable once in circulation. A user without a Civyx identity can receive and hold CivUSD — they simply cannot mint new CivUSD themselves.

---

## Design Philosophy

### Reputation as Collateral Signal

Traditional collateral-backed stablecoins use one variable to determine borrowing capacity: the value of the deposited asset. CivUSD introduces a second variable: verified on-chain reputation. The more a user has demonstrated trustworthy, consistent on-chain behavior, the less they need to over-collateralize.

This is not a subjective judgment. It is a deterministic on-chain calculation executed at mint time using data that anyone can independently verify.

### No Recurring Interest

CivUSD charges a **one-time mint fee** instead of an ongoing interest rate. The protocol earns revenue at mint time. The borrower pays once and holds the position without ongoing cost. There is no time pressure, no compounding debt, and no liquidation driven by accumulated interest.

### Sybil-Resistant Access

Because reputation is anchored by the Civyx identity protocol — which requires a stake, uses ZK proofs, and ties scores to a commitment rather than an address — the reputation signal CivUSD reads is Sybil-resistant. A user cannot create a second identity to inflate their reputation and access lower collateral ratios. Each identity requires a stake and starts at zero.

---

## Adding CivUSD to MetaMask

The Civyx frontend includes a one-click button on the CivUSD page using EIP-747:

```javascript
await window.ethereum.request({
    method: 'wallet_watchAsset',
    params: {
        type: 'ERC20',
        options: {
            address:  '0xa3ce5424489ed5D8cff238009c61ab48Ef852F6D',
            symbol:   'CivUSD',
            decimals: 18,
        },
    },
});
```
