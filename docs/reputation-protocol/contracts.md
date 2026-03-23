# Deployed Contracts — Reputation Layer

## Contract Directory

| Contract | Address |
|---|---|
| ReputationRegistry | `0xa9FCD9102fbe420a40B380a891f94a3Fc1D4Fb2c` |
| OrganizerRegistry | `0x8A472Ca618c74FdF270A9A75bE6034a7d98BB9B9` |
| TrustOracle | `0xe6aD6C8f4943CC39b5dFb46FB88a1597bdF4b467` |
| TaskRewardDispenser | `0xF5971713619e7622e82f329a3f46B7280E781c58` |
| ExternalTaskVerifier | `0x434F288ff599e1f56fe27CF372be2941543b4171` |
| RegisterIdentityTask | `0x2b17aDAcd236a6A1641be06f1Ba8F5257109Cce6` |
| StakeMilestoneTask | `0x1825B4c62A70f5E53323F1b3fEAAA22F451E033b` |
| GovernanceVoteTask | `0x5f9dD176ea5282d392225ceC5c2E7A24d5d02672` |
| AirdropClaimTask | `0x2C834EFcDd2E9D04C1a34367BA9D8aa587F90fBe` |
| CommunityDrop | `0x3A5fBC501c5D515383fADFf5ebD92C393f5eFee9` |

---

## ReputationRegistry

**Address:** `0xa9FCD9102fbe420a40B380a891f94a3Fc1D4Fb2c`

The canonical store for all reputation scores. Scores are keyed by commitment hash, not wallet address. The `TaskRewardDispenser` is the only address authorized to add points.

**Key functions:**

| Function | Description |
|---|---|
| `getScore(bytes32 commitment)` | Raw score for a commitment |
| `getScoreByWallet(address wallet)` | Resolve wallet to commitment and return score |
| `getTier(bytes32 commitment)` | Score tier (1–5) |
| `getTierByWallet(address wallet)` | Tier by wallet address |
| `addPoints(bytes32 commitment, uint256 points)` | Add points — REPUTATION_UPDATER only |

**Access control roles:**

| Role | Holder | Purpose |
|---|---|---|
| `DEFAULT_ADMIN_ROLE` | Deployer | Full admin access |
| `REPUTATION_UPDATER` | TaskRewardDispenser | Call addPoints |
| `PAUSER_ROLE` | Deployer | Pause and unpause |

**Events:**

| Event | Parameters |
|---|---|
| `ReputationEarned` | `bytes32 commitment, uint256 points, uint256 newScore` |
| `ScoreUpdated` | `bytes32 commitment, uint256 oldScore, uint256 newScore` |
| `TierChanged` | `bytes32 commitment, uint8 oldTier, uint8 newTier` |

**OpenZeppelin:** `AccessControl`, `ReentrancyGuard`, `Pausable`

---

## TrustOracle

**Address:** `0xe6aD6C8f4943CC39b5dFb46FB88a1597bdF4b467`

The unified interface through which the rest of the protocol — and any external protocol — reads reputation data. Any protocol on Polkadot that wants to gate on Civyx reputation calls this contract.

**Key functions:**

| Function | Description |
|---|---|
| `getScore(address wallet)` | Reputation score |
| `getTier(address wallet)` | Tier (1–5) |
| `isVerified(address wallet)` | True if active identity |
| `getFullProfile(address wallet)` | Score, tier, commitment, verified status |

**OpenZeppelin:** `AccessControl`, `Pausable`

---

## TaskRewardDispenser

**Address:** `0xF5971713619e7622e82f329a3f46B7280E781c58`

Validates and routes all reputation point awards. Acts as gatekeeper — task contracts cannot call `ReputationRegistry` directly.

**Key functions:**

| Function | Description |
|---|---|
| `dispenseReward(address user, uint256 points, bytes32 organizerId)` | Award points — TASK_ORACLE only |
| `registerTask(address taskContract, bytes32 organizerId)` | Authorize task contract |
| `deregisterTask(address taskContract)` | Remove authorization |

**OpenZeppelin:** `AccessControl`, `ReentrancyGuard`, `Pausable`

---

## OrganizerRegistry

**Address:** `0x8A472Ca618c74FdF270A9A75bE6034a7d98BB9B9`

Manages organizer registration, trust levels, proposal records, and vote data. See [Organizers](organizers.md) for the full reference.

**OpenZeppelin:** `AccessControl`, `ReentrancyGuard`, `Pausable`

---

## ExternalTaskVerifier

**Address:** `0x434F288ff599e1f56fe27CF372be2941543b4171`

Executes `staticcall` verification against external contracts. See [External Task Verification](external-verification.md) for the full reference.

**OpenZeppelin:** `AccessControl`, `Pausable`

---

## CommunityDrop

**Address:** `0x3A5fBC501c5D515383fADFf5ebD92C393f5eFee9`

Genesis airdrop — 2000 PAS funded, 50 PAS per claim, 40 claims total. Requires active Civyx identity to claim.

**Key functions:**

| Function | Description |
|---|---|
| `claim()` | Claim airdrop — requires active identity |
| `hasClaimed(address wallet)` | Check claim status |
| `getRemainingClaims()` | Claims remaining |

**OpenZeppelin:** `AccessControl`, `ReentrancyGuard`, `Pausable`
