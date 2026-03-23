# Reputation Protocol — Overview

## What Is Civyx Reputation?

Reputation in Civyx is not assigned by anyone. It is not based on social graphs, token holdings, or off-chain data. It is earned exclusively through verifiable on-chain actions — actions that any contract can independently confirm without trusting Civyx as an intermediary.

The score ranges from **0 to 1000**. It is tied to an identity commitment, not to any individual wallet. Every wallet linked to the same identity shares the same score. It is portable across Polkadot parachains via XCM.

---

## Score and Tiers

Every registered identity starts at 0. Points are added through task completion. The score is divided into five tiers that map directly to CivUSD collateral ratios and can be used by any external protocol.

| Tier | Score Range | Label |
|---|---|---|
| 1 | 0 – 199 | New |
| 2 | 200 – 399 | Established |
| 3 | 400 – 599 | Trusted |
| 4 | 600 – 799 | Veteran |
| 5 | 800 – 1000 | Elite |

---

## How Reputation Is Earned

Reputation is earned through **tasks** — defined actions that, when completed and verified, result in a point award. Tasks come in two types:

**Internal tasks** verify actions within the Civyx ecosystem itself — registering an identity, reaching a stake milestone, participating in governance, claiming the community airdrop.

**External tasks** verify actions on entirely separate contracts using `staticcall`. No integration or cooperation is required from the target protocol. If it exposes a readable on-chain function — `hasVoted()`, `balanceOf()`, `hasClaimed()` — Civyx can use it as a task condition.

---

## How Reputation Is Read

The score lives on the commitment, not on any individual wallet address. The lookup chain is:

```
wallet address
      │
      ▼ getCommitment(wallet)
commitment hash
      │
      ▼ getScore(commitment)
reputation score
```

Any contract that needs to read reputation queries the `TrustOracle` — the unified interface that abstracts this lookup:

```solidity
uint256 score  = trustOracle.getScore(wallet);
uint8   tier   = trustOracle.getTier(wallet);
bool    active = trustOracle.isVerified(wallet);
```

---

## Reputation Layer Contracts

| Contract | Address | Purpose |
|---|---|---|
| ReputationRegistry | `0xa9FCD9102fbe420a40B380a891f94a3Fc1D4Fb2c` | Canonical score store |
| OrganizerRegistry | `0x8A472Ca618c74FdF270A9A75bE6034a7d98BB9B9` | Manages task organizers |
| TrustOracle | `0xe6aD6C8f4943CC39b5dFb46FB88a1597bdF4b467` | Unified reputation query interface |
| TaskRewardDispenser | `0xF5971713619e7622e82f329a3f46B7280E781c58` | Validates and routes point awards |
| ExternalTaskVerifier | `0x434F288ff599e1f56fe27CF372be2941543b4171` | Executes staticcall verification |
| RegisterIdentityTask | `0x2b17aDAcd236a6A1641be06f1Ba8F5257109Cce6` | Task: register identity |
| StakeMilestoneTask | `0x1825B4c62A70f5E53323F1b3fEAAA22F451E033b` | Task: reach stake milestones |
| GovernanceVoteTask | `0x5f9dD176ea5282d392225ceC5c2E7A24d5d02672` | Task: governance participation |
| AirdropClaimTask | `0x2C834EFcDd2E9D04C1a34367BA9D8aa587F90fBe` | Task: community airdrop claim |
| CommunityDrop | `0x3A5fBC501c5D515383fADFf5ebD92C393f5eFee9` | Genesis airdrop contract |
