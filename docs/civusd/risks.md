# Risk Considerations

## PAS Price Volatility

CivUSD is collateralized by PAS, which is a volatile asset. A sharp drop in PAS price can push positions below the 120% liquidation threshold before users have time to add collateral.

This risk is highest for tier 4 and tier 5 users who open positions at 125% and 110% respectively — they have very little buffer. Tier 1 users (180%) have a 60-percentage-point buffer before liquidation, while tier 5 users open their positions already below the threshold and must manage collateral actively from day one.

**Recommendation:** Maintain a health factor well above 120%. During volatile market conditions, consider adding collateral proactively rather than waiting for the threshold to be approached.

---

## Reputation Tier Lock

A position records the reputation tier at mint time. If a user mints at tier 1 (180%) and later reaches tier 3 (140%), their existing position remains at the 180% ratio. To benefit from the improved ratio they must close the existing position and open a new one.

This is intentional — the collateral ratio at mint time defines the terms of the position.

---

## Oracle Dependency

CivUSD's liquidation logic depends on an accurate PAS/USD price feed. If the price oracle is manipulated or becomes stale:

- Liquidations could fire incorrectly (price reported too low)
- Liquidations could fail to fire when needed (price reported too high)

The current testnet implementation uses a simplified oracle that is not manipulation-resistant. **Production deployment requires a robust, decentralized price feed before CivUSD can be used with real capital.** See the [Roadmap](../roadmap.md) for the oracle selection plan.

---

## Single Position Constraint

The current one-position-per-wallet limitation means a user cannot spread exposure across multiple positions at different collateral ratios. This is a known limitation that will be addressed in a future version.

---

## Audit Status

CivUSD has not undergone a formal security audit. The contracts use audited OpenZeppelin components throughout, but smart contract security requires independent expert review that has not yet been performed.

**Do not use CivUSD to secure real capital until a formal audit has been completed.**

---

## Summary Table

| Risk | Severity | Current Mitigation | Planned Mitigation |
|---|---|---|---|
| PAS price volatility | High | Liquidation mechanism | Robust price oracle |
| Tier lock on existing positions | Low | Documented behavior | Multi-position support |
| Simplified price oracle | High | Testnet only | Decentralized oracle before mainnet |
| Single position per wallet | Low | Documented limitation | Multi-position roadmap |
| No formal audit | High | Testnet deployment only | Audit before mainnet |
| Admin key centralization | Medium | Testnet accepted | Multisig on mainnet |
