# Smart Contracts — Reputation Layer

## ReputationRegistry

**Address:** `0xa9FCD9102fbe420a40B380a891f94a3Fc1D4Fb2c`

Canonical store for all reputation scores. Keyed by commitment hash. The `TaskRewardDispenser` is the only address authorized to call `addPoints`.

**State variables:**

| Variable | Type | Description |
|---|---|---|
| `scores` | `mapping(bytes32 => uint256)` | Score per commitment |
| `identityRegistry` | IIdentityRegistry | Reference to identity layer |

**Score tiers:**

| Tier | Min Score | Max Score |
|---|---|---|
| 1 | 0 | 199 |
| 2 | 200 | 399 |
| 3 | 400 | 599 |
| 4 | 600 | 799 |
| 5 | 800 | 1000 |

**Key functions:**

| Function | Visibility | Modifiers | Description |
|---|---|---|---|
| `getScore(bytes32 commitment)` | external | view | Raw score |
| `getScoreByWallet(address wallet)` | external | view | Score by wallet |
| `getTier(bytes32 commitment)` | external | view | Tier (1–5) |
| `getTierByWallet(address wallet)` | external | view | Tier by wallet |
| `addPoints(bytes32 commitment, uint256 points)` | external | onlyRole(REPUTATION_UPDATER), nonReentrant, whenNotPaused | Add points |
| `setScore(bytes32 commitment, uint256 score)` | external | onlyRole(DEFAULT_ADMIN_ROLE) | Admin: set score directly |

**Access control roles:**

| Role | Holder | Purpose |
|---|---|---|
| `DEFAULT_ADMIN_ROLE` | Deployer | Full admin access |
| `REPUTATION_UPDATER` | TaskRewardDispenser | Call addPoints |
| `PAUSER_ROLE` | Deployer | Pause and unpause |

**Events:**

| Event | Parameters |
|---|---|
| `ReputationEarned` | `bytes32 indexed commitment, uint256 points, uint256 newScore` |
| `ScoreUpdated` | `bytes32 indexed commitment, uint256 oldScore, uint256 newScore` |
| `TierChanged` | `bytes32 indexed commitment, uint8 oldTier, uint8 newTier` |

**OpenZeppelin:** `AccessControl`, `ReentrancyGuard`, `Pausable`

---

## OrganizerRegistry

**Address:** `0x8A472Ca618c74FdF270A9A75bE6034a7d98BB9B9`

Manages organizer registration, trust levels, governance proposals, and vote records. See [Organizers](../reputation-protocol/organizers.md) for the full conceptual reference.

**Data structures:**

```solidity
struct Organizer {
    bytes32 id;
    string  name;
    address owner;
    uint256 stake;
    uint8   trustLevel;
    bool    approved;
    uint256 registeredAt;
    bool    active;
}

struct Proposal {
    bytes32 id;
    bytes32 organizerId;
    string  description;
    uint256 votingEnd;
    bool    active;
}
```

**Key functions:**

| Function | Visibility | Modifiers | Description |
|---|---|---|---|
| `registerOrganizer(string name)` | external | payable, nonReentrant | Register with stake |
| `approveOrganizer(bytes32 id, uint8 trustLevel)` | external | onlyRole(OPERATOR_ROLE) | Approve pending organizer |
| `setTrustLevel(bytes32 id, uint8 level)` | external | onlyRole(OPERATOR_ROLE) | Update trust level |
| `suspendOrganizer(bytes32 id)` | external | onlyRole(OPERATOR_ROLE) | Suspend organizer |
| `reinstateOrganizer(bytes32 id)` | external | onlyRole(OPERATOR_ROLE) | Lift suspension |
| `deregisterOrganizer(bytes32 id)` | external | nonReentrant | Owner: permanently remove |
| `registerProposal(bytes32 orgId, bytes32 propId, string desc, uint256 end)` | external | — | Register governance proposal |
| `closeProposal(bytes32 proposalId)` | external | — | Close proposal to new votes |
| `recordVote(address voter, bytes32 proposalId)` | external | onlyRole(TASK_ORACLE) | Record vote |
| `hasVoted(address wallet, bytes32 proposalId)` | external | view | Check vote status |
| `isOrganizerActive(bytes32 id)` | external | view | Check active status |
| `getTrustLevel(bytes32 id)` | external | view | Read trust level |

**Access control roles:**

| Role | Purpose |
|---|---|
| `DEFAULT_ADMIN_ROLE` | Full admin |
| `OPERATOR_ROLE` | Approve, suspend, reinstate organizers |
| `PROPOSAL_REGISTRAR` | Register proposals on behalf of organizers |
| `TASK_ORACLE` | Record votes — granted to task contracts |
| `PAUSER_ROLE` | Pause and unpause |

**Events:**

| Event | Parameters |
|---|---|
| `OrganizerRegistered` | `bytes32 id, string name, address owner` |
| `OrganizerApproved` | `bytes32 id, uint8 trustLevel` |
| `TrustLevelUpdated` | `bytes32 id, uint8 oldLevel, uint8 newLevel` |
| `OrganizerSuspended` | `bytes32 id` |
| `OrganizerReinstated` | `bytes32 id` |
| `OrganizerDeregistered` | `bytes32 id` |
| `ProposalRegistered` | `bytes32 proposalId, bytes32 organizerId` |
| `ProposalClosed` | `bytes32 proposalId` |
| `VoteRecorded` | `bytes32 proposalId, address voter` |

**OpenZeppelin:** `AccessControl`, `ReentrancyGuard`, `Pausable`

---

## TrustOracle

**Address:** `0xe6aD6C8f4943CC39b5dFb46FB88a1597bdF4b467`

Unified reputation query interface. Any protocol that wants to gate on Civyx reputation calls this contract.

**Key functions:**

| Function | Visibility | Description |
|---|---|---|
| `getScore(address wallet)` | external view | Reputation score |
| `getTier(address wallet)` | external view | Tier (1–5) |
| `getCommitment(address wallet)` | external view | Commitment hash |
| `isVerified(address wallet)` | external view | True if active identity |
| `getFullProfile(address wallet)` | external view | Score, tier, commitment, verified |

**Return type for getFullProfile:**
```solidity
struct Profile {
    uint256 score;
    uint8   tier;
    bytes32 commitment;
    bool    verified;
}
```

**Events:**

| Event | Parameters |
|---|---|
| `ScoreQueried` | `address indexed wallet, uint256 score, address indexed caller` |

**OpenZeppelin:** `AccessControl`, `Pausable`

---

## TaskRewardDispenser

**Address:** `0xF5971713619e7622e82f329a3f46B7280E781c58`

Validates and routes all reputation point awards. Task contracts cannot call `ReputationRegistry` directly.

**Key functions:**

| Function | Visibility | Modifiers | Description |
|---|---|---|---|
| `dispenseReward(address user, uint256 points, bytes32 organizerId)` | external | onlyRole(TASK_ORACLE), nonReentrant, whenNotPaused | Award points |
| `registerTask(address taskContract, bytes32 organizerId)` | external | onlyRole(DEFAULT_ADMIN_ROLE) | Authorize task contract |
| `deregisterTask(address taskContract)` | external | onlyRole(DEFAULT_ADMIN_ROLE) | Remove authorization |
| `isTaskAuthorized(address taskContract)` | external | view | Check authorization |
| `getTaskOrganizer(address taskContract)` | external | view | Get organizer ID |

**Access control roles:**

| Role | Holder | Purpose |
|---|---|---|
| `DEFAULT_ADMIN_ROLE` | Deployer | Register and deregister tasks |
| `TASK_ORACLE` | Task contracts | Call dispenseReward |
| `PAUSER_ROLE` | Deployer | Pause and unpause |

**Events:**

| Event | Parameters |
|---|---|
| `RewardDispensed` | `address indexed user, uint256 points, bytes32 indexed organizerId` |
| `TaskRegistered` | `address indexed taskContract, bytes32 indexed organizerId` |
| `TaskDeregistered` | `address indexed taskContract` |

**OpenZeppelin:** `AccessControl`, `ReentrancyGuard`, `Pausable`

---

## ExternalTaskVerifier

**Address:** `0x434F288ff599e1f56fe27CF372be2941543b4171`

Executes `staticcall` verification against external contracts. See [External Task Verification](../reputation-protocol/external-verification.md) for the full reference.

**Data structures:**
```solidity
struct VerificationSchema {
    address target;
    bytes4  selector;
    bytes   expectedValue;
    uint8   argType;
    bool    active;
}
```

**Key functions:**

| Function | Description |
|---|---|
| `verify(address target, bytes callData, bytes expectedResult)` | Single staticcall verification |
| `verifySchema(uint256 schemaId, address user)` | Verify against stored schema |
| `registerSchema(address target, bytes4 selector, bytes expectedValue, uint8 argType)` | Register schema |
| `getSchema(uint256 schemaId)` | Read schema |

**OpenZeppelin:** `AccessControl`, `Pausable`

---

## Task Contracts

### RegisterIdentityTask
**Address:** `0x2b17aDAcd236a6A1641be06f1Ba8F5257109Cce6` | Points: 5 | Limit: Once per identity

### StakeMilestoneTask
**Address:** `0x1825B4c62A70f5E53323F1b3fEAAA22F451E033b` | Points: 5 per milestone | Milestones: 100, 500, 1000 PAS

### GovernanceVoteTask
**Address:** `0x5f9dD176ea5282d392225ceC5c2E7A24d5d02672` | Points: 5 per proposal | Limit: Once per proposal per identity

### AirdropClaimTask
**Address:** `0x2C834EFcDd2E9D04C1a34367BA9D8aa587F90fBe` | Points: 5 | Limit: Once per identity

### CommunityDrop
**Address:** `0x3A5fBC501c5D515383fADFf5ebD92C393f5eFee9` | 50 PAS per claim | 40 claims total | Requires active identity

All task contracts use `AccessControl`, `ReentrancyGuard`, and `Pausable`.
