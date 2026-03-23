# Civyx Documentation

Civyx is a trust protocol for on-chain economies, built natively on Polkadot Asset Hub.

It answers a question that DeFi has ignored for years: why does the system treat a three-year on-chain veteran exactly the same as a wallet created five minutes ago?

Civyx fixes this by building three interconnected layers — identity, reputation, and DeFi — that compound on each other into a single closed loop.

```
Actions → Reputation → Cheaper Capital → More Actions
```

---

## What Is Civyx?

**Identity.** One person, one identity, across as many wallets as they own. Anchored by a stake. Proven through ZK proofs. No personal data. No central authority.

**Reputation.** A score from 0 to 1000, built from real on-chain actions. Portable across Polkadot parachains via XCM. Readable by any contract on any integrated chain.

**CivUSD.** A reputation-aware stablecoin where collateral ratios are earned, not fixed. High reputation means lower collateral requirements — reputation stops being cosmetic and starts reducing the cost of capital.

---

## Protocol at a Glance

| Component | Description |
|---|---|
| Network | Polkadot Asset Hub Testnet (chainId: 420420417) |
| Contracts | 17 deployed contracts across 3 layers |
| ZK Circuits | 3 Noir circuits — identity, wallet link, nullifier |
| Proof System | UltraKeccakHonk via Barretenberg |
| Portability | XCM cross-chain reputation broadcasting |
| Stablecoin | CivUSD — reputation-tiered collateral ratios |

---

## Navigate the Docs

| Section | What You Will Find |
|---|---|
| [Introduction](introduction.md) | Problem, solution, why Polkadot |
| [Architecture Overview](architecture.md) | Three-layer design, contract graph, design principles |
| [Identity Protocol](identity-protocol/overview.md) | Secret, commitment, ZK proofs, wallet linking |
| [Reputation Protocol](reputation-protocol/overview.md) | Scoring, tasks, organizers, external verification |
| [CivUSD](civusd/overview.md) | Stablecoin mechanics, ratios, mint, burn, liquidation |
| [Smart Contracts Reference](smart-contracts/overview.md) | All 17 contracts — addresses, ABIs, events, roles |
| [XCM Integration](xcm-integration/overview.md) | Cross-chain reputation broadcasting |
| [Security](security/overview.md) | Cryptographic model, access control, known risks |
| [Roadmap](roadmap.md) | What is built, what is next, what is unsettled |

---

## Deployed Contracts — Quick Reference

| Contract | Address |
|---|---|
| IdentityRegistry | `0x56BBC4969818d4E27Fe39983f8aDee4F3e1C5c6f` |
| ReputationRegistry | `0xa9FCD9102fbe420a40B380a891f94a3Fc1D4Fb2c` |
| TrustOracle | `0xe6aD6C8f4943CC39b5dFb46FB88a1597bdF4b467` |
| CivUSD | `0xa3ce5424489ed5D8cff238009c61ab48Ef852F6D` |
| WalletLinkVerifier | `0x72CC5BA2958CB688B00dFE2E578Db3BbB79eD311` |
| IdentityBroadcaster | `0x9A5710098B845e7841E1D09E1bde0dC1e30374AC` |

Full contract reference → [Smart Contracts](smart-contracts/overview.md)

---

> Civyx is a testnet deployment built for the Polkadot Solidity Hackathon. It has not undergone a formal security audit. Do not use it to secure real capital.
