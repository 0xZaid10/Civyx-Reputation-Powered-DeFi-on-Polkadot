# Economic Security

## Sybil Resistance

The identity stake is the primary Sybil-resistance mechanism. Registering an identity requires locking a minimum of **0.01 PAS**. This cost is recoverable — the stake is returned on deactivation — but it must remain locked for the duration of the identity's active period.

For an attacker attempting to register 1000 fake identities:

- **Capital cost:** 10 PAS locked across 1000 identities
- **Opportunity cost:** Capital locked and unavailable for other uses
- **Additional friction:** Each identity must complete tasks independently to build reputation
- **ZK barrier:** Wallet linking requires knowing the secret, preventing one operator from controlling multiple identities from a single signing key

The stake requirement alone is a deterrent, not an absolute barrier. A well-funded attacker could register many identities. The real defense is the stake cost **combined with the task completion requirement.** Reaching tier 3 or higher on a fake identity requires performing real on-chain actions — providing liquidity, participating in governance, claiming airdrops — that themselves have costs.

---

## Task Completion Costs

Every task that earns reputation requires a real on-chain action. These actions have their own inherent costs that make fake reputation expensive to farm:

| Task | Cost to Attacker |
|---|---|
| Register identity | Minimum 0.01 PAS stake per identity |
| Stake milestone (1000 PAS) | 1000 PAS locked per identity |
| Governance participation | Must hold governance tokens |
| Airdrop claim | Limited per identity, costs gas |
| External tasks (liquidity, staking) | Requires real capital deployment |

An attacker who wants high-reputation fake identities must perform all these actions for each fake identity. The cost of building a fake tier 4 or tier 5 identity is approximately equal to the cost of being a real tier 4 or tier 5 user — which defeats the purpose of the attack.

---

## Trust Level Caps

The trust level system bounds organizer influence over the reputation system. Even a fully compromised organizer can award at most:

| Trust Level | Max Points Per Task | Tasks to Max Score (1000 pts) |
|---|---|---|
| 1 (Basic) | 5 | 200 tasks |
| 2 (Trusted) | 15 | 67 tasks |
| 3 (Verified) | 30 | 34 tasks |
| 4 (Core) | 50 | 20 tasks |

A single compromised organizer at trust level 1 cannot max out a user's score with one transaction — it would require 200 separate task completions. This limits the blast radius of any single organizer compromise.

---

## Liquidation Incentives

The 5% liquidation bonus in CivUSD is calibrated to ensure liquidators are incentivized to maintain protocol solvency without the bonus being so large that it becomes exploitable.

**Too small a bonus:** Unhealthy positions go unliquidated. Protocol becomes insolvent over time.

**Too large a bonus:** Creates incentives for liquidators to manipulate the PAS price oracle to force artificial liquidations.

At 5%, the bonus is competitive with other collateral-backed stablecoin protocols and provides sufficient incentive for liquidators to monitor and act on positions during volatile market conditions.

---

## Fee Revenue Alignment

The one-time mint fee in CivUSD aligns protocol revenue with usage rather than with time. The protocol earns when users mint. Users pay once and hold positions without ongoing cost pressure. This removes the incentive for users to close positions prematurely to avoid accumulating interest, which in turn keeps collateral levels stable.
