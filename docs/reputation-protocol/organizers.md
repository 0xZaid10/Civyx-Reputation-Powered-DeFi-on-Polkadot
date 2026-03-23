# Organizers

## What Is an Organizer?

Organizers are the entities authorized to define tasks and award reputation points within the Civyx protocol. They are the bridge between real on-chain behavior and the reputation system.

An organizer can be a DeFi protocol, a DAO, a community group, a developer building on Civyx, or the Civyx core team itself. The only requirement is registration in the `OrganizerRegistry` and approval from an authorized operator.

Organizers do not control the reputation system directly. They define what actions are worth rewarding and how many points those actions carry — within the constraints their trust level permits. Every point award flows through the `TaskRewardDispenser`, which validates every claim independently before touching the `ReputationRegistry`.

---

## The Genesis Organizer

The genesis organizer is the first organizer registered in the protocol, created at deployment by the Civyx core team. It operates at the highest trust level and is the organizer under which all core Civyx task contracts are registered.

**Genesis organizer ID:**
```
0xfa77fe2bb2f7ea6a53a0767759cf0daff1b1e47056033ad6774d5911f256c06e
```

**Genesis proposal ID:**
```
0xf01bf01569eee860b9e4b7fc1e74ca49e436fd3521a5976c8e6a183f4dec9130
```

---

## Trust Levels

Every approved organizer has a trust level from 1 to 4. The trust level defines the maximum number of points any single task under that organizer can award.

| Level | Label | Max Points Per Task | Typical Assignee |
|---|---|---|---|
| 1 | Basic | 5 | New or unverified organizers |
| 2 | Trusted | 15 | Community organizers with track record |
| 3 | Verified | 30 | Established protocols integrating Civyx |
| 4 | Core | 50 | Civyx core contracts and genesis organizer |

Trust levels ensure that reaching a high reputation score requires completing tasks across multiple organizers. Gaming the system requires compromising multiple independent organizers simultaneously, not just one.

---

## Registration Process

### Step 1 — Register

Any address calls `registerOrganizer(string name)` on the `OrganizerRegistry` with a stake attached. The organizer is created in a **pending** state with trust level 0.

```solidity
bytes32 organizerId = keccak256(
    abi.encodePacked(name, msg.sender, block.timestamp)
);
```

### Step 2 — Operator Approval

An address holding the `OPERATOR_ROLE` approves the organizer and assigns a trust level. This is a manual review step.

```solidity
function approveOrganizer(
    bytes32 organizerId,
    uint8 trustLevel
) external onlyRole(OPERATOR_ROLE);
```

### Step 3 — Task Registration

After approval, the organizer's task contracts are registered with the `TaskRewardDispenser`. Each task contract must implement the `ITask` interface. Once registered, users can complete tasks and the task contracts can call `dispenseReward`.

---

## Organizer Lifecycle

| State | Description |
|---|---|
| **Pending** | Registered, awaiting operator approval |
| **Active** | Approved, can issue tasks and award reputation |
| **Suspended** | Temporarily blocked by operator — new completions blocked, existing points preserved |
| **Deregistered** | Permanently removed, stake returned, all task contracts deauthorized |

Deregistration is irreversible. Points already earned through a deregistered organizer's tasks are permanent — they cannot be revoked.

---

## Reward Dispensing Flow

```
User completes on-chain action
        │
        ▼
Task contract verifies action occurred
        │
        ▼
Task contract calls TaskRewardDispenser.dispenseReward(user, points, organizerId)
        │
        ├── Validates task contract is authorized
        ├── Validates organizer is approved and active
        ├── Validates points <= trust level cap
        └── Calls ReputationRegistry.addPoints(commitment, points)
                        │
                        └── Score updated, ReputationEarned emitted
```

---

## Proposal Registration

Organizers can register governance proposals in the `OrganizerRegistry`. The `GovernanceVoteTask` uses these records to verify participation.

```solidity
function registerProposal(
    bytes32 organizerId,
    bytes32 proposalId,
    string calldata description,
    uint256 votingEnd
) external;
```

Once registered, votes on the proposal are recorded on-chain and become verifiable by any contract via `hasVoted(address, bytes32)`.

---

## OrganizerRegistry — Key Functions

| Function | Description |
|---|---|
| `registerOrganizer(string name)` | Register with stake — pending approval |
| `approveOrganizer(bytes32 id, uint8 trustLevel)` | Operator: approve |
| `setTrustLevel(bytes32 id, uint8 level)` | Operator: update trust level |
| `suspendOrganizer(bytes32 id)` | Operator: temporarily suspend |
| `reinstateOrganizer(bytes32 id)` | Operator: lift suspension |
| `deregisterOrganizer(bytes32 id)` | Owner: permanently remove |
| `registerProposal(...)` | Register governance proposal |
| `hasVoted(address wallet, bytes32 proposalId)` | Check vote status |
| `isOrganizerActive(bytes32 id)` | Check active status |
| `getTrustLevel(bytes32 id)` | Read trust level |

**Address:** `0x8A472Ca618c74FdF270A9A75bE6034a7d98BB9B9`
