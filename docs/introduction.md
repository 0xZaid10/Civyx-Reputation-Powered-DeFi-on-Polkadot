# Introduction

## The Problem

DeFi has a memory problem.

Every protocol interaction starts from zero. There is no concept of earned trust, no way to distinguish a reliable participant from a Sybil actor, and no mechanism for reputation to reduce financial friction.

A wallet with three years of clean on-chain history — consistent governance participation, responsible borrowing, active liquidity provision — gets the same collateral requirement as an address created five minutes ago. The system is stateless by design, and that statelesness has a cost.

Three problems compound from this:

**Sybil vulnerability.** Without identity, one person can operate hundreds of wallets. Airdrops get farmed. Governance gets manipulated. Community rewards go to bots. Every protocol that tries to reward its community faces the same attack.

**Reputation is worthless.** Protocols that do track behavior store it in silos. Voting history lives in one contract. Liquidity history lives in another. Neither travels. Neither does anything. There is no layer that aggregates, verifies, and exposes on-chain reputation in a form other protocols can use.

**Capital is allocated blindly.** Every borrower pays the same rate regardless of history. There is no mechanism for trustworthy behavior to translate into financial advantage. Reputation has no economic value.

---

## The Solution

Civyx is a three-layer protocol built to fix this.

**Layer 1 — Identity.** A privacy-preserving, ZK-proven identity system. One person, one identity, across as many wallets as they own. Anchored by a stake. Proven through zero-knowledge cryptography without revealing anything personal. No KYC. No central authority. Sybil-resistant by design.

**Layer 2 — Reputation.** A score from 0 to 1000, built from real on-chain actions and verified by the protocol. Earned through task completion, governance participation, liquidity provision, and more. Portable across Polkadot parachains via XCM. Readable by any contract on any integrated chain.

**Layer 3 — DeFi.** CivUSD — a reputation-aware stablecoin where collateral ratios are not fixed, they are earned. The higher your reputation, the less collateral you need. Reputation stops being cosmetic and starts reducing the cost of capital.

---

## The Protocol Loop

```
Actions → Reputation → Cheaper Capital → More Actions
```

This loop is the core thesis of Civyx. Reputation is not a side feature — it is the mechanism by which consistent on-chain behavior translates into measurable financial advantage. Each layer feeds the next. The protocol compounds.

---

## Why Polkadot?

Civyx is built natively on Polkadot Asset Hub for specific technical reasons, not as an afterthought.

**EVM compatibility via Asset Hub** means Solidity contracts deploy without modification while still living inside the Polkadot ecosystem. No new toolchain. No new mental model for developers.

**XCM (Cross-Consensus Messaging)** is what makes reputation portable. A score earned on Asset Hub can be broadcast to any parachain that integrates the Civyx receiver — without bridges, without wrapped tokens, without trust assumptions. This is the primitive that makes Civyx a cross-chain trust layer rather than a single-chain application.

**Low fees and real finality** make the identity staking model practical. Anchoring an identity on-chain needs to be affordable for real users, not just whales.

**Native interoperability** means Civyx does not need to rebuild the ecosystem — it sits on top of it as a trust layer that any Polkadot protocol can read from.

---

## What Civyx Is Not

**Not a KYC system.** No personal data is collected or stored anywhere in the protocol. Identity is proven through cryptography, not documents.

**Not a credit score.** There is no centralized oracle deciding your reputation. Every point in your score comes from verifiable, on-chain actions that any contract can independently confirm.

**Not a wallet.** Civyx works alongside your existing wallets — MetaMask, Talisman, SubWallet — without replacing them.

**Not finished.** Civyx is a testnet deployment built for the Polkadot Solidity Hackathon. It is a complete proof of concept for the full protocol loop. What comes next is the path from proof of concept to production infrastructure. The roadmap section is honest about what is built, what is in progress, and what is still being figured out.
