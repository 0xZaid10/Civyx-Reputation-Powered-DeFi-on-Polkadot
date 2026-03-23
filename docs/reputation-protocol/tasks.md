# Task System

## Overview

Tasks are the mechanism through which reputation is earned. Each task defines what action must be performed, how many points it awards, how the action is verified, and whether it can be completed multiple times or only once.

---

## Internal Tasks

Internal tasks verify actions within the Civyx protocol itself.

### RegisterIdentityTask

**Address:** `0x2b17aDAcd236a6A1641be06f1Ba8F5257109Cce6`

Awards reputation for completing the most fundamental Civyx action — registering an identity. Verifies by calling `verifyIdentity(address)` on the `IdentityRegistry`.

| Parameter | Value |
|---|---|
| Points awarded | 5 |
| Completion limit | Once per identity |
| Verification | `IdentityRegistry.verifyIdentity(address)` |

---

### StakeMilestoneTask

**Address:** `0x1825B4c62A70f5E53323F1b3fEAAA22F451E033b`

Awards reputation for reaching PAS stake milestones. Reads the stake amount from `IdentityRegistry.getIdentityStake(address)`. Three milestones, each claimable once.

| Milestone | Threshold | Points |
|---|---|---|
| Bronze | 100 PAS | 5 |
| Silver | 500 PAS | 5 |
| Gold | 1000 PAS | 5 |

**Total possible:** 15 points across all three milestones.

---

### GovernanceVoteTask

**Address:** `0x5f9dD176ea5282d392225ceC5c2E7A24d5d02672`

Awards reputation for participating in registered governance proposals. Verifies that the caller has voted on a specific proposal ID stored in the `OrganizerRegistry`.

| Parameter | Value |
|---|---|
| Points awarded | 5 per proposal |
| Completion limit | Once per proposal per identity |
| Verification | `OrganizerRegistry.hasVoted(address, proposalId)` |

**Genesis proposal ID:**
```
0xf01bf01569eee860b9e4b7fc1e74ca49e436fd3521a5976c8e6a183f4dec9130
```

---

### AirdropClaimTask

**Address:** `0x2C834EFcDd2E9D04C1a34367BA9D8aa587F90fBe`

Awards reputation for claiming from the Civyx community airdrop. Verifies by calling `hasClaimed(address)` on the `CommunityDrop` contract.

| Parameter | Value |
|---|---|
| Points awarded | 5 |
| Completion limit | Once per identity |
| Verification | `CommunityDrop.hasClaimed(address)` |

---

### CommunityDrop

**Address:** `0x3A5fBC501c5D515383fADFf5ebD92C393f5eFee9`

The Civyx genesis airdrop contract. Distributes PAS to eligible wallets with a verified Civyx identity.

| Parameter | Value |
|---|---|
| Total funded | 2000 PAS |
| Amount per claim | 50 PAS |
| Maximum claims | 40 |

---

## Task Completion Flow

When a user completes a task, the following sequence executes:

```
User action on-chain
      │
      ▼
completeTask(address user)
      │
      ├── Verifies qualifying action occurred
      ├── Checks task not already completed by this user
      └── Calls TaskRewardDispenser.dispenseReward(user, points, organizerId)
                │
                ├── Validates task contract is authorized
                ├── Validates organizer is approved
                ├── Validates points ≤ trust level cap
                └── Calls ReputationRegistry.addPoints(commitment, points)
```

Every step has a failure mode that prevents invalid awards. A task contract that is not registered, an organizer that is not approved, points that exceed the trust cap, or a user without a registered identity will all cause the transaction to revert before any reputation is written.
