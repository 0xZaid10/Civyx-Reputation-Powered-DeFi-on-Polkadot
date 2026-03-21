# Civyx — Decentralized Identity, Reputation & DeFi on Polkadot

> From actions → to reputation → to financial power.

**Live on Polkadot Asset Hub Testnet (chainId 420420417) · 17 contracts deployed and verified · 226 tests passing · XCM confirmed on-chain**

---

## Table of Contents

### Non-Technical Overview
1. [What is Civyx](#1-what-is-civyx)
2. [The Problem](#2-the-problem)
3. [The Solution](#3-the-solution)
4. [How Identity Works](#4-how-identity-works)
5. [How Reputation Works](#5-how-reputation-works)
6. [Endorsements](#6-endorsements)
7. [Staking](#7-staking)
8. [The Task Reward System](#8-the-task-reward-system)
9. [Cross-dApp Reputation — ExternalTaskVerifier](#9-cross-dapp-reputation--externaltaskverifier)
10. [CivUSD — Reputation-Aware Stablecoin](#10-civusd--reputation-aware-stablecoin)
11. [System Synergy](#11-system-synergy--the-full-loop)
12. [Cross-Chain via XCM](#12-cross-chain-via-xcm)
13. [For Organizers and DAOs](#13-for-organizers-and-daos)
14. [How to Test It Right Now](#14-how-to-test-it-right-now)
15. [Frontend Pages](#15-frontend-pages)
16. [Privacy and Security](#16-privacy-and-security)
17. [All Deployed Contracts](#17-all-deployed-contracts)
18. [Current Status](#18-current-status)

### Technical Reference
19. [Technology Stack](#19-technology-stack)
20. [OpenZeppelin Integration — Core Infrastructure](#20-openzeppelin-integration--core-infrastructure)
21. [ZK Circuit Architecture](#20-zk-circuit-architecture)
22. [Contract-by-Contract Reference](#21-contract-by-contract-technical-reference)
23. [Security Model](#22-security-model)
24. [Test Coverage](#23-test-coverage)
25. [Hardhat Configuration](#24-hardhat-configuration)
26. [Development Commands](#25-development-commands)
---

## 1. What is Civyx?

Civyx is a decentralized identity, reputation, and DeFi trust layer built natively on Polkadot. It solves three interconnected problems in sequence:

**Who are you?** — Sybil-resistant identity anchored to a single cryptographic secret, linking multiple wallets, enforced by zero-knowledge proofs and economic stake. No personal information. No trusted party.

**What have you done?** — Portable reputation earned from real on-chain actions across any dApp in the Polkadot ecosystem — including external protocols that have never heard of Civyx — aggregated into a single 0–1000 score.

**What can you access?** — CivUSD, a USD-pegged stablecoin where your collateral requirement is dynamically and directly set by your reputation tier. Higher score = less capital locked = better access.

Civyx transforms reputation from a vanity metric into an economic primitive. Every point earned — anywhere — reduces the cost of accessing capital.

---

## 2. The Problem

### Sybil attacks break every on-chain system

Creating a wallet takes 30 seconds and costs nothing. Any system treating each wallet as a unique person is broken by design:

- **DAO governance** — one actor spins up 500 wallets and controls every vote. Governance becomes theater.
- **Airdrops** — scripts drain distributions meant for thousands of real participants in minutes.
- **Reputation systems** — bot farms endorse each other until trust scores mean nothing within days of launch.
- **DeFi lending** — every borrower is treated identically regardless of on-chain history or trustworthiness.

### Fragmented wallets erase history

Cold storage, daily use, trading — most participants have multiple wallets. Switching wallets means starting reputation at zero. Nothing carries over. History doesn't travel.

### Reputation has no financial value

Even strong reputation on one protocol is invisible everywhere else. It cannot be converted into better financial access, reduced collateral, or any tangible DeFi benefit.

---

## 3. The Solution

Civyx enforces one identity per participant — not by verifying real-world identity, but by making it costly and cryptographically provable to claim a second one.

**Three-layer architecture:**

```
Layer 1 — Identity
  ZK-proved uniqueness · multi-wallet linking · economic stake
  
Layer 2 — Reputation  
  Task rewards · peer endorsements · cross-dApp proof verification
  
Layer 3 — DeFi
  CivUSD stablecoin · reputation-tiered collateral · liquidation
```

These layers compound: actions earn reputation, reputation unlocks better DeFi terms, better DeFi terms incentivise genuine on-chain participation.

---

## 4. How Identity Works

### Registration

A random secret is generated **locally in the browser** — it never leaves the device. A Pedersen hash of that secret (the commitment) is submitted to the blockchain along with a PAS stake. The commitment is the on-chain identity anchor. Nobody — not Civyx, not any node — can reverse it to find the secret.

On-chain record stores: `commitment`, `stake` (18-decimal wei), `createdBlock`, `walletCount`, `active`.

### Linking additional wallets

Each additional wallet requires a ZK proof that demonstrates:
1. Knowledge of the secret behind the commitment
2. Intention to link specifically this wallet address (via a nullifier: `pedersen_hash([secret, wallet])`)

The proof is verified on-chain by the UltraHonk verifier. The nullifier is permanently recorded — the same proof cannot be submitted for any other wallet. Once verified, the wallet is linked and shares the identity's full reputation score.

### Deactivation and reactivation

`deactivateIdentity()` returns the full stake. Commitment, linked wallets, and reputation are preserved in storage indefinitely. `reactivateIdentity()` requires restaking — all history is restored exactly as it was.

---

## 5. How Reputation Works

Reputation is scored 0–1000. Two independent sources:

**Global reputation** — awarded by task contracts via TaskRewardDispenser whenever a real on-chain action is completed and verified.

**Endorsement bonus** — weighted peer endorsements from other verified Civyx identity holders, added on top of global reputation.

**Effective reputation** = `min(globalReputation[commitment] + endorsementPoints[commitment], 1000)`

This is what all external systems — TrustOracle, CivUSD, organizer gates — see when querying a wallet.

### Point curve

| Current globalReputation | Points awarded per completed task |
|---|---|
| 0 – 49 | +5 |
| 50 – 1000 | +3 |

Early participants earn faster. The rate normalises as the ecosystem grows.

### Reputation tiers

Tiers are computed from effective reputation and used for CivUSD collateral ratios, XCM snapshots, and endorsement weighting:

| Tier | Effective rep range | CivUSD collateral ratio |
|---|---|---|
| Tier 0 | 0 – 49 | 180% |
| Tier 1 | 50 – 99 | 150% |
| Tier 2 | 100 – 299 | 130% |
| Tier 3 | 300 – 599 | 115% |
| Tier 4 | 600 – 1000 | 110% |

Reputation follows the identity commitment — not any specific wallet. Link new wallets, switch wallets, change addresses — the score stays.

---

## 6. Endorsements

Peer-to-peer weighted reputation additions. Endorsement weight is determined by the endorser's current effective reputation:

| Endorser effective rep | Weight added to endorsed identity |
|---|---|
| 0 – 49 | Cannot endorse |
| 50 – 99 | +1 point |
| 100 – 299 | +3 points |
| 300 – 599 | +5 points |
| 600 – 1000 | +10 points |

### Five-check anti-farming gauntlet

Every single `endorseIdentity()` call runs all five checks before proceeding:

1. **Ownership** — `identityRegistry.getCommitment(msg.sender)` must equal `endorserCommitment`
2. **Minimum rep** — endorser's `globalReputation` must be ≥ 50
3. **Cooldown** — `block.number >= lastEndorsedBlock[endorser] + 600`
4. **One per pair** — `hasEndorsed[endorser][endorsed]` must be false (permanent, not per-period)
5. **Cap** — `endorsementCount[endorsed]` must be < 20

100 fresh accounts coordinating cannot replicate the endorsement impact of 10 established high-reputation identities.

---

## 7. Staking

PAS tokens locked as collateral per identity. The economic backbone of Sybil resistance — creating fake identities has a real and linear cost.

| Operation | Function | Notes |
|---|---|---|
| Minimum stake | 0.01 PAS | Protocol floor, enforced on register and reactivate |
| Add stake | `addStake() payable` | Any amount, any linked wallet, anytime |
| Withdraw surplus | `withdrawStake(amount)` | Must leave ≥ minimumStake locked |
| Deactivate | `deactivateIdentity()` | Returns full stake, preserves all history |
| Reactivate | `reactivateIdentity() payable` | Requires new stake ≥ minimum |

**The stake is not a fee.** It is fully refundable collateral. It makes identity farming expensive at scale.

### Stake milestone tasks (claimable once per identity)

- Lock 100 PAS → claim +5 rep via `StakeMilestoneTask.claim(0)`
- Lock 500 PAS → claim +5 rep via `StakeMilestoneTask.claim(1)`
- Lock 1000 PAS → claim +5 rep via `StakeMilestoneTask.claim(2)`

`claimAll()` claims all eligible milestones in a single transaction. Already-claimed milestones are skipped silently — the whole tx never reverts on a duplicate.

---

## 8. The Task Reward System

Modular reputation-earning infrastructure. Every real on-chain action has a corresponding task contract. Complete the action, call `claim()`, earn points automatically.

### Architecture

`TaskRewardDispenser` is the central authority. All task contracts hold the `TASK_ORACLE` role. When a task is verified and complete, the task contract calls `dispenser.awardTask(commitment, taskId)`, which:
1. Checks `claimed[commitment][taskId]` — reverts `AlreadyClaimed` if true (CEI pattern)
2. Sets `claimed[commitment][taskId] = true`
3. Reads `reputationRegistry.globalReputation(commitment)` to determine 5 or 3 points
4. Calls `reputationRegistry.addGlobalReputation(commitment, points)`

Claims are permanently recorded. Deactivating and reactivating an identity does not reset them.

### All live task IDs

| Task | Contract | TaskID computation |
|---|---|---|
| Register identity | RegisterIdentityTask | `keccak256("civyx:task:register_identity")` |
| Stake 100 PAS | StakeMilestoneTask | `keccak256("civyx:task:stake:100")` |
| Stake 500 PAS | StakeMilestoneTask | `keccak256("civyx:task:stake:500")` |
| Stake 1000 PAS | StakeMilestoneTask | `keccak256("civyx:task:stake:1000")` |
| Genesis airdrop | CommunityDrop | `keccak256("civyx:task:community_drop:genesis")` |
| Governance vote | GovernanceVoteTask | `keccak256(abi.encodePacked("civyx:task:governance_vote:", orgId, proposalId))` |
| Airdrop claim | AirdropClaimTask | `keccak256(abi.encodePacked("civyx:task:airdrop_claim:", orgId, campaignId))` |
| External dApp | ExternalTaskVerifier | `keccak256(abi.encodePacked("civyx:ext:task:", schemaId))` |

---

## 9. Cross-dApp Reputation — ExternalTaskVerifier

**Address:** `0x434F288ff599e1f56fe27CF372be2941543b4171`

### The problem

Every previous task type required the external protocol to explicitly call Civyx contracts. This is a scalability bottleneck — most DeFi activity happens on protocols that will never integrate Civyx.

### The solution

`ExternalTaskVerifier` lets users earn Civyx reputation for actions on **any external dApp** — without that protocol ever touching Civyx. Verification is fully on-chain via `staticcall`.

### How it works

1. Admin registers a `VerificationSchema` pointing to an external contract and a view function selector
2. User calls `claimExternal(schemaId)` on ExternalTaskVerifier
3. Contract performs `schema.targetContract.staticcall(selector + abi.encode(msg.sender))` — **read-only, cannot modify state**
4. Return data is decoded and checked against the schema's `ReturnType`
5. If the check passes: reputation is awarded via `dispenser.awardTask()`

### ReturnType enum

```solidity
enum ReturnType {
    BOOL_TRUE,        // decoded bool must be true
    UINT_NONZERO,     // decoded uint256 must be > 0
    UINT_GTE_AMOUNT,  // decoded uint256 must be >= schema.requiredAmount
    BYTES32_NONZERO   // decoded bytes32 must be != bytes32(0)
}
```

### Supported patterns

| Function signature | ReturnType | Example use |
|---|---|---|
| `hasVoted(address) → bool` | `BOOL_TRUE` | DAO governance voting |
| `hasClaimed(address) → bool` | `BOOL_TRUE` | Protocol reward claim |
| `isMember(address) → bool` | `BOOL_TRUE` | Protocol membership |
| `balanceOf(address) → uint256` | `UINT_NONZERO` | Token or NFT holder |
| `balanceOf(address) → uint256` | `UINT_GTE_AMOUNT` | Holds minimum threshold |
| `getCommitment(address) → bytes32` | `BYTES32_NONZERO` | Has any bytes32 state |

Any view function that accepts one `address` argument and returns `bool`, `uint256`, or `bytes32` works.

### Schema ID convention

```solidity
// Recommended: ties schemaId to specific (contract, function) pair
bytes32 schemaId = keccak256(abi.encodePacked("civyx:ext:", targetContract, selector));

// Or any unique readable identifier
bytes32 schemaId = keccak256("acmedao:vote:proposal:3");
```

### TaskID derivation

```solidity
// Internal — matches what dispenser stores
bytes32 taskId = keccak256(abi.encodePacked("civyx:ext:task:", schemaId));
```

---

## 10. CivUSD — Reputation-Aware Stablecoin

**Address:** `0x3d3055C0949d94477e31DD123D65eEbe2aD762db`

### What it is

CivUSD is an ERC20 USD-pegged stablecoin backed by PAS collateral. The first stablecoin where your collateral requirement is determined by your on-chain reputation tier — not a fixed over-collateralisation ratio applied equally to everyone.

### Why no interest

Traditional DeFi lending charges recurring interest. CivUSD charges a single one-time mint fee (0.5% by default, maximum 5% enforced on-chain). No rate fluctuations. No compounding debt. Ethically designed.

### Collateral tiers

| Tier | Effective rep | Ratio | To mint 100 CivUSD, deposit... |
|---|---|---|---|
| Tier 0 | 0 – 49 | 180% | 180 PAS |
| Tier 1 | 50 – 99 | 150% | 150 PAS |
| Tier 2 | 100 – 299 | 130% | 130 PAS |
| Tier 3 | 300 – 599 | 115% | 115 PAS |
| Tier 4 | 600+ | 110% | 110 PAS |

### Mint mechanics (key design decision)

The user sends `msg.value` PAS and specifies desired **net** CivUSD output. **All of `msg.value` is stored as collateral — no refund.** This design avoids rounding-error refund vectors and means positions are always at least as healthy as the minimum required.

Validation:
```
grossFromValue = (msg.value × pasUsdPrice × 100) / (1e18 × ratio)
feeFromValue   = grossFromValue × mintFeeBps / 10_000
netFromValue   = grossFromValue − feeFromValue
require(civUsdAmount ≤ netFromValue)  // cannot mint more than collateral allows
```

Fee computation (proportional to actual minting):
```
gross = civUsdAmount × 10_000 / (10_000 − mintFeeBps)
fee   = gross − civUsdAmount  // minted to address(this) as protocol reserve
```

### Health check

```
isHealthy(wallet) = (collateralOf[wallet] × pasUsdPrice × 100) ≥ (debtOf[wallet] × ratio × 1e18)
```

Where `ratio` uses the wallet's **current** effective reputation tier. Reputation changes affect health instantly.

### Liquidation

If a position is unhealthy (PAS price dropped, or reputation fell to a lower tier), any party can liquidate:
1. Caller burns `debtAmount` of their own CivUSD
2. Contract zeroes the proportional portion of the target's debt and collateral
3. Collateral transferred to caller

No liquidation discount in v1. Discount mechanism can be added in a future upgrade without breaking existing positions.

### Price oracle

`pasUsdPrice` stored on-chain with 8-decimal precision (e.g. `5_000_000` = $0.05). Admin-updatable. Interface designed to accept Chainlink or Acala price feed on mainnet as a drop-in replacement.

---

## 11. System Synergy — The Full Loop

Every component of Civyx feeds into every other component. The full loop:

```
Step 1 — Act anywhere
  Vote in a DAO · claim a DeFi reward · hold a token
  On any Polkadot protocol, no Civyx integration required

Step 2 — Prove on-chain
  ExternalTaskVerifier.claimExternal(schemaId)
  → staticcall to external contract (read-only)
  → return data decoded and verified against schema
  → dispenser.awardTask(commitment, taskId)

Step 3 — Reputation increases
  e.g. 49 rep → 54 rep → crosses Tier 1 boundary
  Effective reputation updates immediately
  All downstream systems see new tier at once

Step 4 — Financial access improves
  CivUSD.collateralRatioFor(wallet) drops from 180% → 150%
  isHealthy threshold relaxes for existing positions
  maxMintable returns higher net CivUSD per PAS deposited

Step 5 — Reputation also powers (simultaneously)
  TrustOracle.meetsOrganizerRequirements() → DAO access
  AirdropClaimTask Merkle allowlists → verified distributions
  IdentityBroadcaster XCM snapshot tier → cross-chain identity
  ReputationRegistry.getEndorsementWeight() → peer endorsements
```

**The key insight:** reputation is not a score — it is an access key. More reputation means lower collateral, better governance rights, stronger endorsement weight, and higher XCM identity tier. Every real on-chain action across all of Polkadot contributes to it.

---

## 12. Cross-Chain via XCM

Polkadot's native XCM V5 (Cross-Consensus Messaging) broadcasts full identity snapshots to any parachain. No bridges. No third parties. Confirmed working on Paseo testnet.

### What gets broadcast

```
IdentitySnapshot {
    commitment:          bytes32   — identity fingerprint
    stake:               uint256   — PAS locked (18-decimal wei)
    walletCount:         uint256   — linked wallets
    active:              bool
    globalReputation:    uint256
    effectiveReputation: uint256
    endorsementCount:    uint256
    reputationTier:      uint8     — 0–4
    nativeBalance:       uint256   — wallet.balance at snapshot time
    snapshotBlock:       uint256
    broadcaster:         address
}
```

### XCM V5 message encoding

```
0x05  — VersionedXcm::V5
0x08  — compact(2): 2 instructions
0x2f  — UnpaidExecution (enum index 47 in XCM V5)
0x00  — WeightLimit::Unlimited
0x00  — check_origin: None
0x0a  — ClearOrigin (enum index 10)
```

Full bytes: `0x05082f00000a` (6 bytes). Confirmed valid on Paseo testnet.

**Weight confirmed via `xcm.weighMessage()`:** 1,830,000 refTime · 0 proofSize

**Cooldown:** 100 blocks (~10 minutes) between broadcasts per identity

### Why the contract cannot send XCM directly

`pallet_xcm::send` on Polkadot Hub only accepts EOA (wallet) origins. Contract addresses are rejected. `broadcastIdentity()` validates identity, enforces cooldown, emits the `IdentityBroadcast` event on-chain, then returns. The wallet calls `xcm.send()` separately using the bytes from `prepareSnapshot()`.

### Confirmed broadcast transaction

Transaction `0x9e142d14...` on Blockscout confirms the full system working end-to-end. Gas: 4,112. Snapshot fields visible in the Logs tab decoded from event data.

---

## 13. For Organizers and DAOs

Any project can register as a Civyx organizer and use identity + reputation gating. Fully permissionless. No approval needed.

### Register

```solidity
organizerRegistry.registerOrganizer(
    keccak256("my-dao-v1"),  // orgId — choose any unique identifier
    "My DAO",
    minStake,                // 0 = open to all
    minReputation            // 0 = open to all
);
```

### Gate any function

```solidity
// Using organizer-defined thresholds (reads from OrganizerRegistry)
require(
    oracle.meetsOrganizerRequirements(msg.sender, orgId),
    "Insufficient standing"
);

// Using custom thresholds
require(
    oracle.meetsRequirements(msg.sender, 100e18, 50),
    "Need 100 PAS + 50 rep"
);
```

### Run governance with reputation rewards

```solidity
// Admin registers proposal
governanceVoteTask.registerProposal(orgId, proposalId);

// Users vote in your DAO, then call:
governanceVoteTask.claim(orgId, proposalId);
// → earns 3–5 rep points, one per identity per proposal
```

### Run Sybil-resistant airdrop

```solidity
// Build Merkle tree from identity commitments (not wallet addresses)
// bytes32[] leaves = identityCommitments.map(c => keccak256(abi.encodePacked(c)));
airdropClaimTask.createCampaign(orgId, campaignId, merkleRoot, "Season 1 Drop");

// Users submit proof:
airdropClaimTask.claim(orgId, campaignId, merkleProof);
// → earns rep + receives tokens, one claim per identity
```

### Register external task schema

```solidity
bytes4 selector = bytes4(keccak256("hasVoted(address)"));
bytes32 schemaId = keccak256(abi.encodePacked("civyx:ext:", daoContract, selector));

externalTaskVerifier.registerSchema(
    schemaId,
    daoContract,
    selector,
    ReturnType.BOOL_TRUE,
    0,
    "Voted in My DAO governance"
);
```

---

## 14. How to Test It Right Now

**Network:** Polkadot Asset Hub Testnet · chainId 420420417 · RPC: `https://eth-rpc-testnet.polkadot.io` · Symbol: PAS

**Get PAS:** Polkadot faucet at `https://faucet.polkadot.io`

### Complete walkthrough

| Step | Action | Expected |
|---|---|---|
| 1 | `/app/register` — generate secret, submit tx | Identity created, linked to wallet |
| 2 | Dashboard → Manage Stake → Add → stake 100 PAS | Stake milestone task claimable |
| 3 | Dashboard → Completed Tasks → Staked 100 PAS → claim | +5 rep, 10 total |
| 4 | Stake 500 PAS total, claim milestone | +5 rep, 15 total |
| 5 | Stake 1000 PAS total, claim milestone | +5 rep, 20 total → Tier 0 still |
| 6 | `/community` → Vote genesis proposal | +3–5 rep depending on curve |
| 7 | `/community` → Claim 50 PAS airdrop | +5 rep, 50 PAS received |
| 8 | Dashboard → all 5 tasks green with Blockscout links | |
| 9 | `/xcm-demo` → broadcast snapshot | IdentityBroadcast event on Blockscout |
| 10 | `/civusd` → see your tier, enter collateral → Mint | CivUSD received |
| 11 | `/earn` → claim any registered external schemas | Rep from external dApp |
| 12 | Dashboard → Endorse — get another identity to endorse | effectiveRep > globalRep |

---

## 15. Frontend Pages

**Navigation order (DeFi-first):** Home · CivUSD · Earn Rep · Community · Dashboard · XCM

| Page | Route | Description |
|---|---|---|
| Landing | `/` | DeFi-first protocol overview: identity, rep, CivUSD tier table, external tasks, XCM synergy flow, all contracts |
| **CivUSD** | `/civusd` | Mint/burn interface · 5-tier collateral table with active tier highlighted · live position health · mint quote calculator · burn PAS return preview |
| **Earn Rep** | `/earn` | Browse registered external dApp schemas · live `wouldVerify` eligibility check · `claimExternal()` one-click claim · integration guide for builders |
| Community | `/community` | Genesis governance vote + 50 PAS airdrop · rep updates live after claim |
| Dashboard | `/app` | Identity card · reputation with live progress bar · stake management · 5 completed tasks with Blockscout links · endorsement section |
| Register | `/app/register` | New identity: secret generation → commitment → stake → tx |
| Link Wallet | `/app/link` | ZK proof generation in browser → `linkWallet()` |
| XCM Demo | `/xcm-demo` | Live snapshot from `prepareSnapshot()` · broadcast tx · Blockscout confirmation |
| Developers | `/developers` | ZK proof tools: identity and nullifier proof generators |

---

## 16. Privacy and Security

| Property | Detail |
|---|---|
| Secret | Generated locally in browser, never transmitted or stored anywhere |
| On-chain data | Only commitment hash — Pedersen(BN254), mathematically irreversible |
| Wallet link proofs | ZK — proves ownership without revealing secret |
| No trusted setup | UltraHonk transparent — no ceremony, no toxic waste |
| Nullifiers | Bind proofs to specific wallets/actions — replay impossible |
| External verification | `staticcall` — read-only, cannot modify external state |
| Token transfers | CEI pattern on all ETH-moving functions throughout |
| Emergency stop | `Pausable` on all user-facing contracts |
| Role separation | AccessControl — TASK_ORACLE, SCHEMA_MANAGER, REPUTATION_UPDATER each strictly scoped |
| Re-entrancy | ReentrancyGuard on all value-transferring contracts |
| CivUSD collateral | No-refund design — full msg.value locked, no refund reentrancy vector |

---

## 17. All Deployed Contracts — Polkadot Testnet (chainId: 420420417)

**Explorer:** `https://blockscout-testnet.polkadot.io`

### Core Identity & Reputation

| Contract | Address | Purpose |
|---|---|---|
| IdentityRegistry | `0x56BBC4969818d4E27Fe39983f8aDee4F3e1C5c6f` | Register identities, link wallets, manage stake |
| ReputationRegistry | `0xa9FCD9102fbe420a40B380a891f94a3Fc1D4Fb2c` | Global + local rep, endorsements |
| OrganizerRegistry | `0x8A472Ca618c74FdF270A9A75bE6034a7d98BB9B9` | Permissionless organizer registration |
| TrustOracle | `0xe6aD6C8f4943CC39b5dFb46FB88a1597bdF4b467` | Aggregated read layer — all identity data in one call |
| IdentityBroadcaster | `0x9A5710098B845e7841E1D09E1bde0dC1e30374AC` | XCM V5 cross-chain identity snapshots |

### ZK Verifiers

| Contract | Address | Purpose |
|---|---|---|
| WalletLinkVerifier | `0x72CC5BA2958CB688B00dFE2E578Db3BbB79eD311` | On-chain UltraHonk verifier for wallet-link proofs |
| NullifierVerifier | `0x0454a4798602babb16529F49920E8B2f4a747Bb2` | On-chain verifier for nullifier proofs |
| IdentityVerifier | `0xa2Cd20296027836dbD67874Ebd4a11Eeede292C8` | On-chain verifier for identity ownership proofs |
| IdentityVerifierRouter | `0xC2D5F1C13e2603624a717409356DD48253f17319` | Upgrade-friendly router over all three verifiers |

### Task Reward System

| Contract | Address | Purpose |
|---|---|---|
| TaskRewardDispenser | `0xF5971713619e7622e82f329a3f46B7280E781c58` | Central hub — enforces one-claim-per-identity, awards rep |
| RegisterIdentityTask | `0x2b17aDAcd236a6A1641be06f1Ba8F5257109Cce6` | +5 rep on identity registration |
| StakeMilestoneTask | `0x1825B4c62A70f5E53323F1b3fEAAA22F451E033b` | +5 rep at 100/500/1000 PAS stake milestones |
| GovernanceVoteTask | `0x5f9dD176ea5282d392225ceC5c2E7A24d5d02672` | +3–5 rep per governance proposal (orgId-scoped) |
| AirdropClaimTask | `0x2C834EFcDd2E9D04C1a34367BA9D8aa587F90fBe` | +3–5 rep for Merkle-verified airdrop claims |
| CommunityDrop | `0x3A5fBC501c5D515383fADFf5ebD92C393f5eFee9` | Genesis community drop: 50 PAS + rep in one tx |

### DeFi Layer

| Contract | Address | Purpose |
|---|---|---|
| ExternalTaskVerifier | `0x434F288ff599e1f56fe27CF372be2941543b4171` | Cross-dApp reputation via staticcall verification |
| CivUSD | `0x3d3055C0949d94477e31DD123D65eEbe2aD762db` | Reputation-tiered stablecoin, ERC20 |

### Genesis community drop state

- Claim amount: 50 PAS per identity
- Funded with: 2000 PAS
- Remaining claims: 40
- Genesis orgId: `0xfa77fe2bb2f7ea6a53a0767759cf0daff1b1e47056033ad6774d5911f256c06e`
- Genesis proposalId: `0xf01bf01569eee860b9e4b7fc1e74ca49e436fd3521a5976c8e6a183f4dec9130`

---

## 18. Current Status

- ✓ 17 contracts deployed and verified on Polkadot Asset Hub Testnet
- ✓ 3 ZK circuits compiled with UltraHonk — wallet-link proofs generated and verified on-chain
- ✓ 6 task types fully operational: registration, stake milestones, governance vote, airdrop claim, community drop, external tasks
- ✓ Community drop: 2000 PAS funded, 40 claims remaining
- ✓ XCM V5 broadcast confirmed on Paseo testnet — `IdentityBroadcast` event verified on Blockscout, gas: 4,112
- ✓ ExternalTaskVerifier live — staticcall-based cross-dApp proof system operational
- ✓ CivUSD live — reputation-tiered stablecoin minting and burning on testnet
- ✓ Frontend: Landing · CivUSD · Earn Rep · Community · Dashboard · XCM Demo · Developers
- ✓ 226 tests passing across 9 test suites (see Section 23)
- ✓ Live demo identity: 1015.01 PAS staked · 113 effective rep · Tier 2 (130% CivUSD ratio) · 5/5 tasks complete · XCM broadcast confirmed
- ◆ Mainnet deployment in progress

---
---

# TECHNICAL REFERENCE

---

## 19. Technology Stack

| Layer | Technology |
|---|---|
| ZK Proving System | Noir v1.0.0-beta.18 + Barretenberg UltraHonk |
| ZK Proof Format | UltraHonk — transparent setup, BN254 curve, no trusted ceremony |
| Smart Contracts | Solidity 0.8.28 |
| Contract Standards | OpenZeppelin v5: AccessControl, Pausable, ReentrancyGuard, Ownable, ERC20 |
| Network | Polkadot Asset Hub EVM (chainId: 420420417) |
| Cross-Chain | XCM V5 via precompile at `0xA0000` |
| Development | Hardhat + TypeScript + Ethers v6 |
| Frontend | React 18 + Vite + wagmi v2 + RainbowKit + TailwindCSS |
| Solc | 0.8.28, optimizer runs: 200, viaIR: true, evm target: paris |
| ZK Transcript Libs | WalletLinkZKTranscriptLib · NullifierZKTranscriptLib · IdentityZKTranscriptLib |

---

## 20. OpenZeppelin Integration — Core Infrastructure

OpenZeppelin v5 is not a convenience import in Civyx — it is the structural skeleton of the entire smart contract system. Every contract in the project inherits at least one OZ module. Without OpenZeppelin, the permission system, reentrancy protection, emergency controls, token standard, and cryptographic verification would all need to be written, tested, and audited from scratch. Instead, Civyx stands on the most battle-tested smart contract library in existence.

**6 modules · 17 contracts · every single one uses at least two**

---

### 20.1 AccessControl — The Permission Architecture

**Contracts using it:** IdentityRegistry · ReputationRegistry · OrganizerRegistry · TrustOracle · TaskRewardDispenser · GovernanceVoteTask · AirdropClaimTask · ExternalTaskVerifier

**Why it is a core function, not a utility:**

In Civyx, permission is not binary (owner / not-owner). The protocol has multiple distinct actors that each need exactly defined capabilities — and nothing beyond them. OpenZeppelin's `AccessControl` provides this through role-based permission: every role is a `bytes32` hash, granted and revoked independently, verifiable on-chain.

The alternative — a single `onlyOwner` modifier — would mean a compromised admin key can do everything: register schemas, award reputation, modify organizers, pause every contract. With AccessControl, each role is scoped to exactly one capability. Compromising `SCHEMA_MANAGER` only allows schema registration. It cannot touch reputation, stakes, or any other system.

**All custom roles defined in Civyx:**

| Role | Defined in | Granted to | What it permits |
|---|---|---|---|
| `TASK_ORACLE` | TaskRewardDispenser | Every task contract | The **only** way to call `awardTask()` and credit reputation |
| `SCHEMA_MANAGER` | ExternalTaskVerifier | Admin wallet | The **only** way to register or deactivate external dApp schemas |
| `REPUTATION_UPDATER` | ReputationRegistry | TaskRewardDispenser only | The **only** way to call `addGlobalReputation()` directly |
| `APP_MANAGER` | ReputationRegistry | Protocol admin | Register apps for local reputation scoring |
| `PROPOSAL_REGISTRAR` | GovernanceVoteTask | Protocol admin | Register and close governance proposals |
| `CAMPAIGN_MANAGER` | AirdropClaimTask | Protocol admin | Create, update, and close airdrop campaigns |
| `PAUSER_ROLE` | All multi-role contracts | Protocol admin | Pause/unpause — separate from all write permissions |
| `OPERATOR_ROLE` | IdentityRegistry | Protocol admin | Reserved for protocol-level registry operations |
| `DEFAULT_ADMIN_ROLE` | All AccessControl contracts | Deployer | Grant and revoke all other roles |

**How TASK_ORACLE makes the entire reputation system trustless:**

```solidity
// In TaskRewardDispenser:
bytes32 public constant TASK_ORACLE = keccak256("TASK_ORACLE");

function awardTask(bytes32 commitment, bytes32 taskId)
    external
    onlyRole(TASK_ORACLE)   // ← ONLY task contracts can reach this
    nonReentrant
    whenNotPaused
{
    if (claimed[commitment][taskId]) revert AlreadyClaimed(commitment, taskId);
    claimed[commitment][taskId] = true;
    // ... award points
}
```

Every task contract — RegisterIdentityTask, StakeMilestoneTask, GovernanceVoteTask, AirdropClaimTask, CommunityDrop, ExternalTaskVerifier — holds this role. Adding a new task type is a single `grantTaskOracle(newContract)` call. Revoking a compromised one is `revokeTaskOracle(address)`. No existing contract changes. No redeployment. The role system handles it.

**How REPUTATION_UPDATER creates a one-way information flow:**

```
External caller
    → TaskRewardDispenser.awardTask()     [requires TASK_ORACLE]
        → ReputationRegistry.addGlobalReputation()  [requires REPUTATION_UPDATER]
```

Only TaskRewardDispenser holds `REPUTATION_UPDATER`. So reputation can only increase through a completed, verified, deduplicated task award. Nothing else can touch it. No admin shortcut. No direct write path.

**Role definition pattern used throughout:**

```solidity
bytes32 public constant TASK_ORACLE      = keccak256("TASK_ORACLE");
bytes32 public constant SCHEMA_MANAGER   = keccak256("SCHEMA_MANAGER");
bytes32 public constant REPUTATION_UPDATER = keccak256("REPUTATION_UPDATER");
bytes32 public constant PAUSER_ROLE      = keccak256("PAUSER_ROLE");
bytes32 public constant PROPOSAL_REGISTRAR = keccak256("PROPOSAL_REGISTRAR");
bytes32 public constant CAMPAIGN_MANAGER = keccak256("CAMPAIGN_MANAGER");
```

Each role is a deterministic hash — no magic numbers, no collision risk, fully verifiable by anyone.

---

### 20.2 Ownable — Single-Authority Contracts

**Contracts using it:** TrustOracle · IdentityBroadcaster · RegisterIdentityTask · StakeMilestoneTask · CommunityDrop · CivUSD

**Why it is used here instead of AccessControl:**

Some contracts have a single class of admin action — update a pointer, change a fee, pause the contract. For these, full role separation adds complexity with no security benefit. `Ownable` provides a clean single-owner model with `onlyOwner` guard and `transferOwnership()`.

CivUSD uses Ownable because its admin operations (update price, update fee, swap oracle, pause) are all the same class of trust — they all go to the same admin. AccessControl would add roles with no meaningful separation.

TrustOracle uses Ownable + AccessControl together: Ownable for the owner who can swap underlying registries, AccessControl for the OPERATOR_ROLE.

```solidity
// CivUSD admin functions — all owner-gated
function updatePrice(uint256 newPrice) external onlyOwner { ... }
function setTrustOracle(address newOracle) external onlyOwner { ... }
function setMintFee(uint256 feeBps) external onlyOwner { ... }
function pause() external onlyOwner { _pause(); }
function unpause() external onlyOwner { _unpause(); }
```

**Ownership transfer is always available** — if the admin key needs to rotate to a multisig or DAO contract, `transferOwnership()` handles it with one call on every Ownable contract.

---

### 20.3 ReentrancyGuard — Protecting Every Value Transfer

**Contracts using it:** IdentityRegistry · TaskRewardDispenser · IdentityBroadcaster · GovernanceVoteTask · AirdropClaimTask · CommunityDrop · ExternalTaskVerifier · CivUSD

**The attack it prevents:**

A reentrancy attack works like this: a malicious contract calls a function that sends ETH. In the ETH transfer, the malicious contract's `receive()` function calls the same function again — before the first call has finished updating state. If balances are checked before transfer but updated after, the attacker drains funds in a loop.

This is how TheDAO was drained for $60M in 2016. It remains one of the most exploited vulnerability classes in Ethereum history.

**Where the risk exists in Civyx:**

Every function that sends native PAS (ETH-equivalent) to a caller is a potential reentrancy target:

| Contract | Function | ETH transfer |
|---|---|---|
| IdentityRegistry | `deactivateIdentity()` | Returns full stake |
| IdentityRegistry | `withdrawStake()` | Returns surplus stake |
| CommunityDrop | `claim()` | Sends 50 PAS airdrop |
| CivUSD | `mint()` | Refund of excess (old design) / reserves |
| CivUSD | `burn()` | Returns collateral |
| CivUSD | `liquidate()` | Sends collateral to liquidator |

**How ReentrancyGuard works:**

```solidity
// OpenZeppelin's implementation (simplified):
uint256 private _status = NOT_ENTERED; // 1

modifier nonReentrant() {
    require(_status != ENTERED);  // 2 — reverts if already inside
    _status = ENTERED;            // 2 — lock
    _;
    _status = NOT_ENTERED;        // 1 — unlock
}
```

A single storage slot acts as a mutex. The second call into any `nonReentrant` function will always find `_status == ENTERED` and revert. No loop possible.

**Applied alongside CEI (Checks-Effects-Interactions):**

ReentrancyGuard is the belt. CEI is the suspenders. Both together on every critical path:

```solidity
// CivUSD.burn() — ReentrancyGuard + CEI
function burn(uint256 civUsdAmount) external nonReentrant whenNotPaused {
    // CHECK
    if (debtOf[msg.sender] < civUsdAmount) revert InsufficientDebt(...);
    
    uint256 collateralReturn = collateralOf[msg.sender] * civUsdAmount / debtOf[msg.sender];
    
    // EFFECTS — state updated before any external call
    collateralOf[msg.sender] -= collateralReturn;
    debtOf[msg.sender]       -= civUsdAmount;
    totalCollateral          -= collateralReturn;
    _burn(msg.sender, civUsdAmount);  // internal ERC20 state update
    
    // INTERACTION — external call last
    (bool ok, ) = msg.sender.call{ value: collateralReturn }("");
    if (!ok) revert TransferFailed();
}
```

Even if `msg.sender` is a contract that tries to re-enter `burn()` during the ETH transfer, `nonReentrant` catches it instantly.

---

### 20.4 Pausable — Protocol-Wide Emergency Controls

**Contracts using it:** IdentityRegistry · ReputationRegistry · OrganizerRegistry · TaskRewardDispenser · GovernanceVoteTask · AirdropClaimTask · ExternalTaskVerifier · CommunityDrop · CivUSD · RegisterIdentityTask · StakeMilestoneTask

**Why every user-facing contract inherits Pausable:**

Smart contracts are immutable by design — you cannot patch a bug by editing the code. Pausable is the emergency brake. If a vulnerability is discovered in any contract, the admin can halt it in one transaction before funds are drained, giving time to assess and redeploy.

**The architecture of pause propagation:**

Because Civyx contracts call each other in chains (task contract → dispenser → reputation registry), pausing the TaskRewardDispenser halts the entire reputation-award pipeline across every task type simultaneously — without touching any individual task contract.

```
pause(TaskRewardDispenser)
    → ALL task contracts' dispenser.awardTask() calls revert
    → No reputation can be awarded anywhere
    → Identity, staking, endorsements continue unaffected
```

This means pauses can be surgical. Pause CivUSD independently of the reputation system. Pause ExternalTaskVerifier without affecting native tasks. Each contract has its own independent pause switch.

**How `whenNotPaused` is applied on every critical path:**

```solidity
// TaskRewardDispenser — the reputation bottleneck
function awardTask(bytes32 commitment, bytes32 taskId)
    external
    onlyRole(TASK_ORACLE)
    nonReentrant
    whenNotPaused      // ← one modifier pauses the whole award pipeline
{
    ...
}

// CivUSD — all three value functions gated
function mint(uint256 civUsdAmount) external payable nonReentrant whenNotPaused { ... }
function burn(uint256 civUsdAmount) external        nonReentrant whenNotPaused { ... }
function liquidate(address target, uint256 debt)    nonReentrant whenNotPaused { ... }
```

**Pausable implementation (OZ v5):**

```solidity
// OpenZeppelin internals:
bool private _paused = false;

modifier whenNotPaused() {
    if (paused()) revert EnforcedPause();
    _;
}

function _pause() internal { _paused = true; emit Paused(msg.sender); }
function _unpause() internal { _paused = false; emit Unpaused(msg.sender); }
```

Each contract's `pause()` and `unpause()` functions call these internals, gated by `onlyOwner` or `onlyRole(PAUSER_ROLE)` depending on the contract's permission model.

---

### 20.5 ERC20 — CivUSD as a Standard Token

**Contract using it:** CivUSD only

**Why this matters beyond just "it's a token":**

`ERC20` is the universal interface for fungible tokens on Ethereum-compatible chains. By inheriting OZ's `ERC20`, CivUSD automatically becomes compatible with every wallet, DEX, lending protocol, bridge, and analytics platform that works with ERC20 — without writing a single line of interface code.

```solidity
contract CivUSD is ERC20, Ownable, Pausable, ReentrancyGuard {
    constructor(...) ERC20("Civyx USD", "CivUSD") Ownable(_admin) { ... }
```

**What the ERC20 inheritance provides for free:**

| Function | Inherited from ERC20 | Used by |
|---|---|---|
| `balanceOf(address)` | Standard view | Frontend CivUSD balance display |
| `transfer(address, uint256)` | Standard write | CivUSD holders send to others |
| `approve(address, uint256)` | Standard write | Allows spenders (future DEX integrations) |
| `transferFrom(...)` | Standard write | Pulls CivUSD from approved holders |
| `allowance(address, address)` | Standard view | Check approved spending limits |
| `totalSupply()` | Standard view | Protocol TVL tracking |
| `name() → "Civyx USD"` | From constructor | Wallet display name |
| `symbol() → "CivUSD"` | From constructor | Wallet ticker |
| `decimals() → 18` | Default | Same unit as PAS on EVM |

**The internal functions Civyx uses directly:**

```solidity
// Mint net CivUSD to user
_mint(msg.sender, civUsdAmount);

// Mint fee to protocol reserve (contract holds as CivUSD)
_mint(address(this), fee);

// Burn during repayment — reduces supply
_burn(msg.sender, civUsdAmount);

// Burn caller's CivUSD during liquidation
_burn(msg.sender, debtAmount);
```

`_mint` and `_burn` are internal — only callable from within CivUSD's own functions. External parties cannot mint or burn directly. The only paths to new CivUSD are through `mint()` (identity-gated) and the fee mechanism. The only destruction paths are `burn()` and `liquidate()`.

**Fee as protocol reserve:**

When a user mints, the fee is minted to `address(this)` — the CivUSD contract itself holds the fee as protocol reserve CivUSD. This means:
- No ETH transfer to a treasury in the hot path (no additional reentrancy vector)
- Protocol accumulates CivUSD over time
- Admin can withdraw via a separate owner-gated function at any time

---

### 20.6 MerkleProof — On-Chain Allowlist Verification

**Contract using it:** AirdropClaimTask only

**Why Merkle trees are the right structure for airdrop allowlists:**

Storing 10,000 eligible identities directly on-chain would cost millions of gas. A Merkle tree stores only the 32-byte root on-chain. Users submit a proof (log2(N) hashes — ~13 hashes for 10,000 entries) and the contract verifies their inclusion in O(log N) time. The entire allowlist costs one 32-byte storage write.

**The critical design decision — leaves are commitments, not wallets:**

```solidity
// Standard airdrop (wallet-based) — Sybil attack possible:
bytes32 leaf = keccak256(abi.encodePacked(msg.sender));
// → 1 wallet per person... but one person has 50 wallets

// Civyx implementation (identity-based) — Sybil-resistant:
bytes32 commitment = identityRegistry.getCommitment(msg.sender);
bytes32 leaf       = keccak256(abi.encodePacked(commitment));
// → 1 identity per person, regardless of wallets
```

Any wallet linked to an eligible identity can submit the proof — they share the same commitment. But each identity can only claim once, enforced by the dispenser's `(commitment, taskId)` deduplication. This is the correct model for Sybil-resistant distributions.

**The actual verification call:**

```solidity
if (!MerkleProof.verify(merkleProof, campaigns[key].merkleRoot, leaf))
    revert InvalidMerkleProof();
```

`MerkleProof.verify()` takes the proof array, stored root, and computed leaf. It hashes up the tree and checks the result equals the root. No off-chain trust. No signature from an admin. Entirely deterministic on-chain verification.

**Multi-round support:**

```solidity
function updateMerkleRoot(bytes32 orgId, bytes32 campaignId, bytes32 newRoot)
    external onlyRole(CAMPAIGN_MANAGER)
{
    campaigns[campaignKey].merkleRoot = newRoot;
}
```

Campaigns can update their Merkle root to add new eligible identities — supporting phased distributions without redeploying. The dispenser ensures each identity can still only claim once across all rounds.

---

### 20.7 Why OpenZeppelin v5 Specifically

Civyx uses OpenZeppelin **v5** — the most recent major version, released in late 2023. Key differences from v4 that matter for Civyx:

**AccessControl in v5:** `_grantRole()` and `_revokeRole()` return booleans and emit events on every change. Role enumeration is available. No breaking changes to the core permission model.

**ReentrancyGuard in v5:** Uses `uint256` status values (1/2) instead of boolean to save gas via storage slot packing. The protection logic is identical.

**Ownable in v5:** Constructor takes `address initialOwner` explicitly — no implicit `msg.sender` ownership. This is why every Civyx `Ownable` constructor passes `_admin` explicitly:
```solidity
constructor(..., address _admin) ERC20("Civyx USD", "CivUSD") Ownable(_admin) { ... }
```

**Pausable in v5:** Reverts with custom errors (`EnforcedPause`, `ExpectedPause`) instead of require strings — same gas model as Civyx's own custom errors throughout.

**ERC20 in v5:** Full EIP-20 compliance, `_update()` hook replaces `_beforeTokenTransfer`/`_afterTokenTransfer` for cleaner extension.

---

### 20.8 OpenZeppelin Usage Map — Full Project

| Contract | Ownable | AccessControl | ReentrancyGuard | Pausable | ERC20 | MerkleProof |
|---|---|---|---|---|---|---|
| IdentityRegistry | — | ✓ | ✓ | ✓ | — | — |
| ReputationRegistry | — | ✓ | — | ✓ | — | — |
| OrganizerRegistry | — | ✓ | — | ✓ | — | — |
| TrustOracle | ✓ | ✓ | — | — | — | — |
| IdentityBroadcaster | ✓ | — | ✓ | — | — | — |
| IdentityVerifierRouter | ✓ | — | — | — | — | — |
| TaskRewardDispenser | — | ✓ | ✓ | ✓ | — | — |
| RegisterIdentityTask | ✓ | — | — | ✓ | — | — |
| StakeMilestoneTask | ✓ | — | — | ✓ | — | — |
| GovernanceVoteTask | — | ✓ | ✓ | ✓ | — | — |
| AirdropClaimTask | — | ✓ | ✓ | ✓ | — | ✓ |
| CommunityDrop | ✓ | — | ✓ | ✓ | — | — |
| ExternalTaskVerifier | — | ✓ | ✓ | ✓ | — | — |
| CivUSD | ✓ | — | ✓ | ✓ | ✓ | — |
| **Total contracts** | **6** | **8** | **8** | **11** | **1** | **1** |

---

## 21. ZK Circuit Architecture
Three circuits in Noir v1.0.0-beta.18, compiled with Barretenberg UltraHonk. No trusted setup.

### identity.nr

| | |
|---|---|
| **Statement proven** | `pedersen_hash([secret]) == commitment` |
| **Private inputs** | `secret: Field` |
| **Public inputs** | `commitment: Field` |
| **Circuit size** | N = 16,384 (2^14 gates) |
| **Public input count** | 17 |
| **VK hash** | `0x08c3a688735dbc1ece5e0271972da9adcdefdd8916e8604933cf9fd89f3a5789` |
| **Use** | Proves identity ownership in Developer demo page without revealing which wallet or commitment |

### wallet.nr (WalletLink circuit)

| | |
|---|---|
| **Statement proven** | `pedersen_hash([secret]) == commitment` AND `pedersen_hash([secret, wallet_address]) == nullifier` |
| **Private inputs** | `secret: Field` |
| **Public inputs** | `commitment: Field`, `nullifier: Field`, `wallet_address: Field` |
| **Circuit size** | N = 32,768 (2^15 gates) |
| **Public input count** | 19 |
| **VK hash** | `0x2798bb7cde90399fade6f70aa4a9be7c7c15c0abe518aa10d2dd7308192fe36e` |
| **Proof size** | 8,640 bytes |
| **Nullifier binding** | `pedersen_hash([secret, wallet_address])` — proof cannot be reused for any other target wallet |
| **Use** | `IdentityRegistry.linkWallet()`. Public inputs assembled as `[commitment, nullifier, bytes32(uint160(msg.sender))]` |

### null.nr (General nullifier circuit)

| | |
|---|---|
| **Statement proven** | `pedersen_hash([secret]) == commitment` AND `pedersen_hash([secret, action_id]) == nullifier` |
| **Private inputs** | `secret: Field` |
| **Public inputs** | `commitment: Field`, `nullifier: Field`, `action_id: Field` |
| **Use** | General-purpose one-time action proof. `action_id` scopes the nullifier — prevents replay across different actions |

### UltraHonk vs Groth16

| Property | UltraHonk | Groth16 |
|---|---|---|
| Trusted setup | None (transparent) | Required per circuit |
| Proof size | 8,640 bytes | ~192 bytes |
| Recursive composition | Supported | Limited |
| Verification keys | Hardcoded BN254 G1 points in Solidity — immutable | Same |
| Trade-off | Larger proofs for trustless setup | Smaller proofs, ceremony risk |

---

## 22. Contract-by-Contract Technical Reference
---

### IdentityRegistry

**Address:** `0x56BBC4969818d4E27Fe39983f8aDee4F3e1C5c6f`
**Inherits:** AccessControl, Pausable, ReentrancyGuard
**Roles:** `DEFAULT_ADMIN_ROLE` · `PAUSER_ROLE` · `OPERATOR_ROLE`

**Storage:**
```
minimumStake:       uint256
walletLinkVerifier: IHonkVerifier
identities:         mapping(bytes32 => Identity)
walletToCommitment: mapping(address => bytes32)
usedNullifiers:     mapping(bytes32 => bool)
_linkedWallets:     mapping(bytes32 => address[])   // private
```

**Identity struct:** `commitment bytes32` · `stake uint256` (18-decimal wei from msg.value) · `createdBlock uint256` · `walletCount uint256` · `active bool`

**Functions:**

`registerIdentity(bytes32 commitment) payable`
Checks: `msg.value >= minimumStake` · commitment not registered · wallet not already linked.
Effects: stores Identity · maps `walletToCommitment[msg.sender] = commitment` · appends to `_linkedWallets[commitment]`.
Emits: `IdentityRegistered(commitment, msg.sender, msg.value)`.

`linkWallet(bytes32 commitment, bytes proof, bytes32 nullifier)`
Checks: identity active · nullifier not used · `msg.sender` not already linked.
Assembles public inputs: `[commitment, nullifier, bytes32(uint160(msg.sender))]`.
Calls `walletLinkVerifier.verify(proof, publicInputs)` — reverts if invalid.
Records nullifier · increments walletCount · appends wallet.

`unlinkWallet()`
Swap-and-pop removal from `_linkedWallets`. Cannot unlink last wallet (use `deactivateIdentity` instead).

`deactivateIdentity()`
CEI: sets `active=false` · captures `stakeToReturn` · zeroes `identity.stake` · transfers PAS to caller.
Identity preserved in storage for reactivation.

`reactivateIdentity() payable`
Requires: identity inactive · `msg.value >= minimumStake`.
Sets `active=true` · stores new stake.

`addStake() payable` — adds `msg.value` to stake.

`withdrawStake(uint256 amount)` — reverts `WithdrawExceedsStake` if `amount > stake - minimumStake`. CEI.

**View functions:** `verifyIdentity(address) → bool` · `getCommitment(address) → bytes32` · `getIdentityStake(address) → uint256` · `getLinkedWalletCount(address) → uint256` · `getLinkedWallets(bytes32) → address[]` · `getIdentity(bytes32) → Identity`

---

### ReputationRegistry

**Address:** `0xa9FCD9102fbe420a40B380a891f94a3Fc1D4Fb2c`
**Inherits:** AccessControl, Pausable
**Roles:** `DEFAULT_ADMIN_ROLE` · `PAUSER_ROLE` · `REPUTATION_UPDATER` · `APP_MANAGER`

**Constants:**
```
MAX_REPUTATION            = 1000
MIN_REPUTATION_TO_ENDORSE = 50
MAX_ENDORSEMENTS_RECEIVED = 20
ENDORSEMENT_COOLDOWN      = 600    // blocks
```

**Storage:**
```
globalReputation:  mapping(bytes32 => uint256)
localReputation:   mapping(bytes32 => mapping(bytes32 => uint256))   // appId → commitment → score
endorsementPoints: mapping(bytes32 => uint256)
endorsementCount:  mapping(bytes32 => uint256)
hasEndorsed:       mapping(bytes32 => mapping(bytes32 => bool))
lastEndorsedBlock: mapping(bytes32 => uint256)
```

**Effective reputation formula:** `min(globalReputation[c] + endorsementPoints[c], 1000)`

**Functions:**

`addGlobalReputation(bytes32 commitment, uint256 score)` — only `REPUTATION_UPDATER`. Caps at MAX_REPUTATION.

`slashGlobalReputation(bytes32 commitment, uint256 score)` — only `REPUTATION_UPDATER`. Floors at 0.

`getEffectiveReputation(bytes32 commitment) → uint256` — returns capped sum.

`endorseIdentity(bytes32 endorserCommitment, bytes32 endorsedCommitment)` — five-check gauntlet (all must pass in order):
1. `identityRegistry.getCommitment(msg.sender) == endorserCommitment`
2. `globalReputation[endorserCommitment] >= 50`
3. `block.number >= lastEndorsedBlock[endorserCommitment] + 600`
4. `!hasEndorsed[endorserCommitment][endorsedCommitment]`
5. `endorsementCount[endorsedCommitment] < 20`
Adds `getEndorsementWeight(globalReputation[endorserCommitment])` to endorsementPoints.
Sets `hasEndorsed[endorser][endorsed] = true` permanently.

`getEndorsementWeight(uint256 rep) → uint256` — pure: `<50→0` · `<100→1` · `<300→3` · `<600→5` · `>=600→10`

`registerApp(bytes32 appId, string name)` — only `APP_MANAGER`.
`setLocalReputation(bytes32 appId, bytes32 commitment, uint256 score)` — only `APP_MANAGER`.
`getLocalReputation(bytes32 appId, bytes32 commitment) → uint256`

---

### OrganizerRegistry

**Address:** `0x8A472Ca618c74FdF270A9A75bE6034a7d98BB9B9`
**Inherits:** AccessControl, Pausable

**Organizer struct:** `owner address` · `name string` · `minStake uint256` (wei) · `minReputation uint256` · `active bool` · `registeredAt uint256`

`registerOrganizer(bytes32 orgId, string name, uint256 minStake, uint256 minReputation)` — permissionless, any caller. orgId must be non-zero and not already registered. Both minimums can be 0.

`updateRequirements(bytes32 orgId, uint256 newMinStake, uint256 newMinReputation)` — owner only.

`deactivateOrganizer/reactivateOrganizer(bytes32 orgId)` — owner or admin.

`transferOrganizerOwnership(bytes32 orgId, address newOwner)` — current owner only.

`isActive(bytes32 orgId) → bool` · `getRequirements(bytes32) → (uint256, uint256)` · `getOrganizer(bytes32) → Organizer` · `getOrganizersByOwner(address) → bytes32[]`

**Genesis organizer:** orgId = `keccak256("civyx-community-v1")` = `0xfa77fe2bb2f7ea6a53a0767759cf0daff1b1e47056033ad6774d5911f256c06e` · minStake=0 · minReputation=0

---

### TrustOracle

**Address:** `0xe6aD6C8f4943CC39b5dFb46FB88a1597bdF4b467`
**Inherits:** Ownable, AccessControl

**TrustProfile struct:** `isRegistered bool` · `stake uint256` · `globalReputation uint256` · `effectiveReputation uint256` · `endorsementCount uint256` · `linkedWalletCount uint256` · `commitment bytes32`

`getTrustProfile(address wallet) → TrustProfile` — aggregates 5+ sub-calls across IdentityRegistry and ReputationRegistry. Returns all-zero struct for unregistered wallets (does not revert).

`meetsRequirements(address, uint256 minStake, uint256 minReputation) → bool` — custom threshold check. Checks: isRegistered AND stake >= minStake AND effectiveRep >= minReputation.

`meetsOrganizerRequirements(address, bytes32 orgId) → bool` — reads requirements from OrganizerRegistry automatically. Reverts if org is not active.

`verifyIdentity(address) → bool` · `getEffectiveReputation(address) → uint256` · `getCommitment(address) → bytes32` · `getIdentityStake(address) → uint256`

Admin setters: `setIdentityRegistry` · `setReputationRegistry` · `setOrganizerRegistry`

---

### IdentityBroadcaster

**Address:** `0x9A5710098B845e7841E1D09E1bde0dC1e30374AC`
**Inherits:** Ownable, ReentrancyGuard

**XCM precompile:** `0xA0000` (native Polkadot Hub precompile)

**Storage:**
```
trustOracle:        ITrustOracle
xcm:                IXcm                           // XCM precompile
totalBroadcasts:    uint256
broadcastCount:     mapping(bytes32 => uint256)    // per commitment
lastBroadcastBlock: mapping(bytes32 => uint256)
broadcastCooldown:  uint256 = 100
```

**IdentitySnapshot struct:** `commitment bytes32` · `stake uint256` · `walletCount uint256` · `active bool` · `globalReputation uint256` · `effectiveReputation uint256` · `endorsementCount uint256` · `reputationTier uint8` · `nativeBalance uint256` · `snapshotBlock uint256` · `broadcaster address`

**PreparedBroadcast struct:** `snapshot IdentitySnapshot` · `xcmMessage bytes` · `xcmWeight Weight` · `canBroadcast bool` · `cooldownRemaining uint256`

`broadcastIdentity(uint32 destinationParaId, bytes xcmMessage)` — validates identity via TrustOracle · enforces 100-block cooldown · builds snapshot via `_buildSnapshot()` · increments `broadcastCount` and `totalBroadcasts` · emits `IdentityBroadcast(commitment, broadcaster, destinationParaId, snapshot)`. Gas: 4,112 on testnet.

`prepareSnapshot(address wallet) → PreparedBroadcast` (view) — builds full snapshot + encodes XCM bytes + computes cooldown status. Free to call. Used by frontend before broadcasting.

**Tier mapping `_getTier(rep)`:** `<50→0` · `<100→1` · `<300→2` · `<600→3` · `>=600→4`

Admin: `setTrustOracle` · `setXcm` · `setBroadcastCooldown`

---

### IdentityVerifierRouter

**Address:** `0xC2D5F1C13e2603624a717409356DD48253f17319`
**Inherits:** Ownable

Upgrade-friendly indirection over three UltraHonk verifier contracts. If circuits are recompiled with a new VK, only the router pointer updates — IdentityRegistry and all downstream contracts stay unchanged.

`verifyWalletLink(bytes proof, bytes32[] publicInputs) → bool`
`verifyNullifier(bytes proof, bytes32[] publicInputs) → bool`
`verifyIdentity(bytes proof, bytes32[] publicInputs) → bool`

Admin setters: `setWalletLinkVerifier` · `setNullifierVerifier` · `setIdentityVerifier`

---

### TaskRewardDispenser

**Address:** `0xF5971713619e7622e82f329a3f46B7280E781c58`
**Inherits:** AccessControl, Pausable, ReentrancyGuard
**Roles:** `DEFAULT_ADMIN_ROLE` · `PAUSER_ROLE` · `TASK_ORACLE`

**Constants:** `THRESHOLD=50` · `POINTS_HIGH=5` · `POINTS_LOW=3`

**Storage:**
```
reputationRegistry:  IReputationRegistry
claimed:             mapping(bytes32 => mapping(bytes32 => bool))  // (commitment, taskId) → bool
totalTasksCompleted: uint256
tasksCompletedBy:    mapping(bytes32 => uint256)
```

`awardTask(bytes32 commitment, bytes32 taskId)` — only `TASK_ORACLE` · nonReentrant · whenNotPaused.
CEI pattern: checks `claimed[commitment][taskId]` (reverts `AlreadyClaimed`) → sets claimed flag → reads globalRep → awards 5 or 3 points → calls `reputationRegistry.addGlobalReputation()`.

`hasClaimed(bytes32 commitment, bytes32 taskId) → bool`
`grantTaskOracle(address)` / `revokeTaskOracle(address)` — admin, zero-address guarded.

---

### RegisterIdentityTask

**Address:** `0x2b17aDAcd236a6A1641be06f1Ba8F5257109Cce6`
**Inherits:** Ownable, Pausable
**Task ID:** `keccak256("civyx:task:register_identity")`

`claim()` — verifies `identityRegistry.verifyIdentity(msg.sender)` · gets commitment · emits `RegisterIdentityTaskClaimed` · calls `dispenser.awardTask(commitment, TASK_ID)`. Double-claim prevention delegated entirely to dispenser.

---

### StakeMilestoneTask

**Address:** `0x1825B4c62A70f5E53323F1b3fEAAA22F451E033b`
**Inherits:** Ownable, Pausable

**PAS on EVM:** `msg.value` stored in 18-decimal wei. `1 PAS = 10_000_000_000 planck` natively but EVM always uses 18 decimals. Display with `formatEther` (÷1e18).

**Milestones:**

| Index | Threshold | Task ID |
|---|---|---|
| 0 | 100 PAS (in wei) | `keccak256("civyx:task:stake:100")` |
| 1 | 500 PAS (in wei) | `keccak256("civyx:task:stake:500")` |
| 2 | 1000 PAS (in wei) | `keccak256("civyx:task:stake:1000")` |

`claim(uint256 milestoneIndex)` — validates index < 3 · verifies identity · reads live stake via `identityRegistry.getIdentityStake(msg.sender)` · compares to threshold · reverts `StakeBelowThreshold(current, required)` if insufficient.

`claimAll()` — iterates ascending. Stops at first ineligible (can't hit 500 without 100 first). Skips already-claimed via try/catch — never reverts on a duplicate.

`eligibleMilestones(address wallet) → bool[3]` (view) — frontend utility.

Re-staking after withdrawal does NOT re-enable claiming. Dispenser claimed flag is permanent.

---

### GovernanceVoteTask

**Address:** `0x5f9dD176ea5282d392225ceC5c2E7A24d5d02672`
**Inherits:** AccessControl, Pausable, ReentrancyGuard
**Roles:** `DEFAULT_ADMIN_ROLE` · `PAUSER_ROLE` · `PROPOSAL_REGISTRAR`

**Proposal struct:** `orgId bytes32` · `proposalId bytes32` · `active bool` · `registeredAt uint256` · `claimCount uint256`

**proposalKey:** `keccak256(abi.encodePacked(orgId, proposalId))`

**taskId:** `keccak256(abi.encodePacked("civyx:task:governance_vote:", orgId, proposalId))`

`registerProposal(bytes32 orgId, bytes32 proposalId)` — only `PROPOSAL_REGISTRAR`. Requires `organizerRegistry.isActive(orgId)`.

`closeProposal(bytes32 orgId, bytes32 proposalId)` — only `PROPOSAL_REGISTRAR`. Stops new claims, does not affect existing.

`claim(bytes32 orgId, bytes32 proposalId)` — verifies identity active · proposal exists and active · increments claimCount · calls dispenser.

`hasClaimed(bytes32 commitment, bytes32 orgId, bytes32 proposalId) → bool` — delegates to dispenser via staticcall.

**Genesis proposal:** orgId=`0xfa77fe2bb...` · proposalId=`0xf01bf015...`

---

### AirdropClaimTask

**Address:** `0x2C834EFcDd2E9D04C1a34367BA9D8aa587F90fBe`
**Inherits:** AccessControl, Pausable, ReentrancyGuard
**Roles:** `DEFAULT_ADMIN_ROLE` · `PAUSER_ROLE` · `CAMPAIGN_MANAGER`
**Uses:** OpenZeppelin `MerkleProof`

**Campaign struct:** `orgId bytes32` · `campaignId bytes32` · `merkleRoot bytes32` · `active bool` · `createdAt uint256` · `claimCount uint256` · `name string`

**Merkle leaf:** `keccak256(abi.encodePacked(commitment))` — identity-based (not wallet-based). Any linked wallet of an eligible identity can submit the proof. Sybil-resistant by design.

**taskId:** `keccak256(abi.encodePacked("civyx:task:airdrop_claim:", orgId, campaignId))`

`createCampaign(bytes32 orgId, bytes32 campaignId, bytes32 merkleRoot, string name)` — only `CAMPAIGN_MANAGER`. Requires org active and non-zero merkleRoot.

`updateMerkleRoot(bytes32 orgId, bytes32 campaignId, bytes32 newRoot)` — only `CAMPAIGN_MANAGER`. Supports multi-round allowlist updates without redeploying.

`claim(bytes32 orgId, bytes32 campaignId, bytes32[] calldata merkleProof)` — verifies identity active and campaign active. Gets commitment. Computes leaf = `keccak256(abi.encodePacked(commitment))`. Calls `MerkleProof.verify()`. Reverts `InvalidMerkleProof` if invalid.

`isEligible(bytes32 orgId, bytes32 campaignId, bytes32 commitment, bytes32[] proof) → bool` (view) — frontend eligibility check.

---

### CommunityDrop

**Address:** `0x3A5fBC501c5D515383fADFf5ebD92C393f5eFee9`
**Inherits:** Ownable, Pausable, ReentrancyGuard
**Task ID:** `keccak256("civyx:task:community_drop:genesis")`
**Live state:** 2000 PAS · 50 PAS/claim · 40 claims remaining

`claim()` — verifies identity · checks `address(this).balance >= claimAmount` (reverts `InsufficientContractBalance`) · increments `totalClaims` · calls `dispenser.awardTask()` — reverts `AlreadyClaimed` if duplicate (this happens before ETH transfer, full CEI) · sends `claimAmount` PAS to caller.

`contractBalance() → uint256` · `remainingClaims() → uint256` (`balance / claimAmount`) · `setClaimAmount(uint256)` (owner) · `withdraw(uint256, address)` (owner, emergency)

`receive() external payable` — accepts top-up PAS, emits `Funded(funder, amount)`.

---

### ExternalTaskVerifier

**Address:** `0x434F288ff599e1f56fe27CF372be2941543b4171`
**Inherits:** AccessControl, Pausable, ReentrancyGuard
**Roles:** `DEFAULT_ADMIN_ROLE` · `PAUSER_ROLE` · `SCHEMA_MANAGER`

**ReturnType enum:**
```solidity
enum ReturnType {
    BOOL_TRUE,        // decoded bool must be true
    UINT_NONZERO,     // decoded uint256 must be > 0
    UINT_GTE_AMOUNT,  // decoded uint256 must be >= schema.requiredAmount
    BYTES32_NONZERO   // decoded bytes32 must be != bytes32(0)
}
```

**VerificationSchema struct:**
```solidity
struct VerificationSchema {
    address    targetContract;   // external dApp contract to call
    bytes4     selector;         // function selector: e.g. bytes4(keccak256("hasVoted(address)"))
    ReturnType returnType;
    uint256    requiredAmount;   // only used for UINT_GTE_AMOUNT
    bool       active;
    uint256    registeredAt;     // block number
    string     label;            // human-readable description
    uint256    totalClaims;
}
```

**State:** `mapping(bytes32 => VerificationSchema) public schemas` · `uint256 public totalSchemas` · `uint256 public totalExternalClaims`

**Events:** `SchemaRegistered(schemaId, targetContract, selector, returnType, label, registrar)` · `SchemaDeactivated(schemaId)` · `SchemaReactivated(schemaId)` · `ExternalTaskClaimed(wallet, commitment, schemaId, targetContract, verifiedValue)`

**Errors:** `SchemaNotFound` · `SchemaNotActive` · `SchemaAlreadyExists` · `NotRegistered` · `VerificationFailed(targetContract, selector, wallet)` · `StaticCallReverted(targetContract, selector)` · `ZeroAddress` · `ZeroId` · `ZeroSelector` · `EmptyLabel`

**Function reference:**

`registerSchema(bytes32 schemaId, address targetContract, bytes4 selector, ReturnType returnType, uint256 requiredAmount, string label)` — only `SCHEMA_MANAGER`, whenNotPaused. Validates non-zero schemaId/targetContract/selector, non-empty label, not already registered. Stores schema, increments `totalSchemas`.

`deactivateSchema(bytes32 schemaId)` — only `SCHEMA_MANAGER`. Prevents new claims.

`reactivateSchema(bytes32 schemaId)` — only `SCHEMA_MANAGER`.

`claimExternal(bytes32 schemaId)` — nonReentrant, whenNotPaused.
Full flow:
1. `identityRegistry.verifyIdentity(msg.sender)` → revert `NotRegistered`
2. Schema existence check → revert `SchemaNotFound`
3. Schema active check → revert `SchemaNotActive`
4. Get `commitment = identityRegistry.getCommitment(msg.sender)`
5. Build calldata: `abi.encodePacked(schema.selector, abi.encode(msg.sender))`
6. `schema.targetContract.staticcall(callData)` → revert `StaticCallReverted` on failure or empty return
7. `_verifyReturn(schema, returnData)` — decodes and checks:
   - `BOOL_TRUE`: `abi.decode(data, (bool))` must be `true`
   - `UINT_NONZERO`: decoded uint256 must be `> 0`
   - `UINT_GTE_AMOUNT`: decoded uint256 must be `>= requiredAmount`
   - `BYTES32_NONZERO`: decoded bytes32 must be `!= bytes32(0)`
   - Reverts `VerificationFailed(targetContract, selector, msg.sender)` on any failure
8. Effects (CEI): `schema.totalClaims++` · `totalExternalClaims++`
9. Emits `ExternalTaskClaimed(wallet, commitment, schemaId, targetContract, verifiedValue)`
10. `dispenser.awardTask(commitment, _taskId(schemaId))` → reverts `AlreadyClaimed` if duplicate

`wouldVerify(bytes32 schemaId, address wallet) → (bool success, string reason)` (view) — performs full staticcall check without state mutation. Frontend eligibility preview.

`getTaskId(bytes32 schemaId) → bytes32` (pure) — returns `keccak256(abi.encodePacked("civyx:ext:task:", schemaId))`.

`getSchema(bytes32 schemaId) → VerificationSchema` (view)

**Admin:** `setIdentityRegistry` · `setDispenser` · `pause` · `unpause`

---

### CivUSD

**Address:** `0x3d3055C0949d94477e31DD123D65eEbe2aD762db`
**Inherits:** ERC20("Civyx USD", "CivUSD"), Ownable, Pausable, ReentrancyGuard

**Constants:**
```solidity
uint256 public constant BASIS_POINTS = 10_000;
uint256 public constant PRICE_PREC   = 1e8;     // 8-decimal price precision

uint256 public constant REP_TIER_1   = 50;
uint256 public constant REP_TIER_2   = 100;
uint256 public constant REP_TIER_3   = 300;
uint256 public constant REP_TIER_4   = 600;

uint256 public constant RATIO_TIER_0 = 180;     // plain %
uint256 public constant RATIO_TIER_1 = 150;
uint256 public constant RATIO_TIER_2 = 130;
uint256 public constant RATIO_TIER_3 = 115;
uint256 public constant RATIO_TIER_4 = 110;
```

**Storage:**
```
trustOracle:    ITrustOracle
pasUsdPrice:    uint256   // 8-decimal (e.g. 5_000_000 = $0.05/PAS)
mintFeeBps:     uint256   // default 50 (0.5%), max 500 (5%)
collateralOf:   mapping(address => uint256)   // PAS locked per wallet (18-decimal wei)
debtOf:         mapping(address => uint256)   // CivUSD outstanding per wallet
totalCollateral: uint256
```

**Constructor:** `(address trustOracle, uint256 pasUsdPrice, address admin)` — deployed with `pasUsdPrice = 5_000_000`. Reverts `ZeroAddress` or `ZeroPrice`.

**Events:** `Minted(wallet, commitment, collateral, gross, fee, civUsdAmount, ratio)` · `Burned(wallet, civUsdBurned, collateralReturned)` · `Liquidated(target, liquidator, debt, collateral)` · `PriceUpdated(oldPrice, newPrice)` · `MintFeeUpdated(oldFee, newFee)`

**Errors:** `NotRegisteredIdentity` · `InsufficientCollateral` · `InsufficientDebt` · `PositionHealthy` · `ZeroAmount` · `ZeroAddress` · `ZeroPrice` · `FeeTooHigh` · `TransferFailed`

**`mint(uint256 civUsdAmount) payable`** — nonReentrant, whenNotPaused.
```
1. msg.value > 0                                          → ZeroAmount
2. trustOracle.verifyIdentity(msg.sender)                  → NotRegisteredIdentity
3. rep   = trustOracle.getEffectiveReputation(msg.sender)
4. ratio = _collateralRatio(rep)

Validation (compute max mintable from collateral):
   grossFromValue = (msg.value × pasUsdPrice × 100) / (1e18 × ratio)
   feeFromValue   = grossFromValue × mintFeeBps / BASIS_POINTS
   netFromValue   = grossFromValue − feeFromValue
   civUsdAmount > netFromValue                            → InsufficientCollateral

Proportional fee for actual mint:
   gross = civUsdAmount × BASIS_POINTS / (BASIS_POINTS − mintFeeBps)
   fee   = gross − civUsdAmount

Effects:
   collateralOf[msg.sender] += msg.value    ← full msg.value, no refund
   debtOf[msg.sender]       += civUsdAmount
   totalCollateral          += msg.value

Interactions:
   _mint(msg.sender, civUsdAmount)          ← net CivUSD to user
   _mint(address(this), fee)                ← fee as protocol reserve

Emits: Minted(wallet, commitment, msg.value, gross, fee, civUsdAmount, ratio)
```

**Key design: no refund.** All of `msg.value` becomes collateral. This eliminates refund reentrancy risk and ensures positions are always at least as healthy as minimum required.

**`burn(uint256 civUsdAmount)`** — nonReentrant, whenNotPaused.
```
debtOf[msg.sender] >= civUsdAmount         → InsufficientDebt
collateralReturn = collateralOf[w] × civUsdAmount / debtOf[w]
Effects: reduce collateralOf, debtOf, totalCollateral
_burn(msg.sender, civUsdAmount)
Transfer collateralReturn PAS to caller    → TransferFailed on failure
Emits: Burned(wallet, civUsdAmount, collateralReturn)
```

**`liquidate(address target, uint256 debtAmount)`** — nonReentrant, whenNotPaused.
```
!isHealthy(target)                          → PositionHealthy
debtOf[target] >= debtAmount               → InsufficientDebt
collateralToSeize = collateralOf[target] × debtAmount / debtOf[target]
Effects: reduce target's collateralOf, debtOf, totalCollateral
_burn(msg.sender, debtAmount)              ← caller pays debt
Transfer collateralToSeize to caller
Emits: Liquidated(target, liquidator, debtAmount, collateralToSeize)
```

**`maxMintable(address wallet, uint256 collateral) → (uint256 net, uint256 fee, uint256 ratio)`** (view)
```
ratio = _collateralRatio(effectiveReputation)
gross = (collateral × pasUsdPrice × 100) / (1e18 × ratio)
fee   = gross × mintFeeBps / BASIS_POINTS
net   = gross − fee
```

**`isHealthy(address wallet) → bool`** (view)
```
if debtOf[wallet] == 0: return true
(collateralOf[wallet] × pasUsdPrice × 100) >= (debtOf[wallet] × ratio × 1e18)
where ratio = _collateralRatio(current effectiveReputation)
```

**`collateralRatioFor(address wallet) → uint256`** (view) — returns plain % (110–180).

**`getPosition(address wallet) → (lockedCollateral, mintedAmount, currentRatioBps, currentRep)`** (view)

**`canMint(address wallet) → bool`** (view) — `trustOracle.verifyIdentity(wallet)`

**`updatePrice(uint256 newPrice)`** — admin only. Reverts `ZeroPrice`. Emits `PriceUpdated`. Immediately affects all `isHealthy` results.

**`setMintFee(uint256 feeBps)`** — admin. Max 500 enforced on-chain. Emits `MintFeeUpdated`.

**`_collateralRatio(uint256 rep) → uint256`** (internal pure):
```
rep >= 600 → 110   (Tier 4)
rep >= 300 → 115   (Tier 3)
rep >= 100 → 130   (Tier 2)
rep >= 50  → 150   (Tier 1)
default    → 180   (Tier 0)
```

---

## 23. Security Model
### ZK layer

- Pedersen hash on BN254 — collision resistant, standard in production ZK systems
- Nullifiers bind proofs to specific targets — cross-wallet and cross-action replay impossible
- UltraHonk transparent setup — no trusted ceremony, no parameters to compromise
- VKs hardcoded as BN254 G1 points in generated Solidity — immutable after deployment
- 8,640-byte proofs — larger than Groth16, trade-off accepted for trustless setup

### Smart contract layer

**Checks-Effects-Interactions applied universally:**

| Contract | Function | Order |
|---|---|---|
| IdentityRegistry | deactivateIdentity | zero stake → transfer PAS |
| IdentityRegistry | withdrawStake | reduce stake → transfer PAS |
| CommunityDrop | claim | increment counter + call dispenser → send PAS |
| CivUSD | mint | update collateralOf/debtOf → _mint → refund |
| CivUSD | burn | reduce collateralOf/debtOf → _burn → transfer PAS |
| CivUSD | liquidate | reduce target state → _burn caller → transfer PAS |
| ExternalTaskVerifier | claimExternal | increment counters → emit event → call dispenser |

**ReentrancyGuard applied to:** IdentityRegistry · TaskRewardDispenser · IdentityBroadcaster · GovernanceVoteTask · AirdropClaimTask · CommunityDrop · ExternalTaskVerifier · CivUSD

**AccessControl minimum-privilege separation:**
- `TASK_ORACLE` on TaskRewardDispenser — only task contracts, only awards points
- `SCHEMA_MANAGER` on ExternalTaskVerifier — only registers/deactivates schemas
- `REPUTATION_UPDATER` on ReputationRegistry — only TaskRewardDispenser
- `PROPOSAL_REGISTRAR` on GovernanceVoteTask — only proposal creation
- `CAMPAIGN_MANAGER` on AirdropClaimTask — only campaign management

**ExternalTaskVerifier staticcall safety:** `staticcall` is read-only by EVM design. Cannot modify state. Cannot send ETH. Return data decoded via `abi.decode` which reverts cleanly on malformed data. `StaticCallReverted` error surfaces call failures explicitly.

**CivUSD no-refund design:** `msg.value` stored in full as collateral. No refund path eliminates the `call()` reentrancy vector. Positions are always at least as collateralised as the minimum threshold.

**Economic layer:**
- `minimumStake` creates linear cost for Sybil attacks
- CivUSD always overcollateralised
- Liquidation enforces system solvency if PAS price drops

---

## 24. Test Coverage
| Contract | Tests | Status | Key coverage |
|---|---|---|---|
| TaskRewardDispenser | 34 | ✓ 34/34 | Award curve, AlreadyClaimed, role gates, pause |
| RegisterIdentityTask | 19 | ✓ 19/19 | Happy path, NotRegistered, double-claim, admin |
| StakeMilestoneTask | 27 | ✓ 27/27 | All 3 milestones, claimAll, re-stake blocked, pause |
| GovernanceVoteTask | 22 | ✓ 22/22 | Register+close proposal, claim, double-claim, pause |
| AirdropClaimTask | 26 | ✓ 26/26 | Campaign lifecycle, Merkle verify, wrong proof, multi-round |
| CommunityDrop | 24 | ✓ 24/24 | PAS transfer math, AlreadyClaimed, insufficient balance |
| CommunityPage.integration | 13 | ✓ 13/13 | Vote+airdrop combined, rep curve crossing at 50, multi-identity |
| ExternalTaskVerifier | 30 | ✓ 30/30 | BOOL_TRUE, UINT_NONZERO, UINT_GTE_AMOUNT, BYTES32_NONZERO, staticcall failure, deactivate, double-claim, wouldVerify |
| CivUSD | 31 | ✓ 31/31 | All 5 tiers, mint math, burn proportional return, isHealthy, price drop + liquidation, fee cap, pause |
| **Total** | **226** | **226/226** | |

**Live on-chain verification (Polkadot testnet):**
- RegisterIdentityTask: claimed, +5 rep
- StakeMilestoneTask: all 3 milestones, +15 rep total
- CommunityDrop: +5 rep, 50 PAS received
- GovernanceVoteTask: +3 rep (rep was ≥ 50)
- IdentityBroadcaster: broadcast confirmed, gas 4,112, full snapshot decoded on Blockscout

---

## 25. Hardhat Configuration
```typescript
// hardhat.config.ts
networks: {
  polkadotTestnet: {
    url:      'https://eth-rpc-testnet.polkadot.io',
    chainId:  420420417,
    accounts: [DEPLOYER_PRIVATE_KEY, WALLET2_PRIVATE_KEY],
  }
}

// Deployment gas settings (type 0 legacy required on Polkadot Hub)
const gas = {
  type:     0,
  gasPrice: block.baseFeePerGas,    // 1000 gwei on testnet
  gasLimit: 3_000_000n,
};

// src/lib/txOptions.ts — used by all frontend write calls
export const TX_OPTIONS = {
  gas:      300000n,
  gasPrice: 1000000000000n,         // 1000 gwei
} as const;
```

**Note:** Polkadot Hub EVM requires type 0 legacy transactions. Without explicit `gasPrice = block.baseFeePerGas`, MetaMask shows wildly inflated fee estimates.

**Deployer address:** `0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266`

**Wallet2 (demo identity):** `0x64d874397F48E0550F5ef6bEA13fCfA03ABE94A7`
- Commitment: `0x1bd3f634d2cec51dd349a9872637f637f25e3e48fd5f0ee11562dca720820444`
- State: 1015.01 PAS staked · 113 rep · Tier 2 (130% CivUSD ratio) · 5/5 tasks complete

---

## 26. Development Commands
```bash
# Compile all contracts
npx hardhat compile

# Run all 9 test suites
npx hardhat test

# Run individual suites
npx hardhat test test/TaskRewardDispenser.test.ts
npx hardhat test test/RegisterIdentityTask.test.ts
npx hardhat test test/StakeMilestoneTask.test.ts
npx hardhat test test/GovernanceVoteTask.test.ts
npx hardhat test test/AirdropClaimTask.test.ts
npx hardhat test test/CommunityDrop.test.ts
npx hardhat test test/CommunityPage.integration.test.ts
npx hardhat test test/ExternalTaskVerifier.test.ts
npx hardhat test test/CivUSD.test.ts

# ─── Deploy (already deployed — for reference) ────────────────────────────────

# Core task system
npx hardhat run scripts/deployTaskRewardDispenser.ts  --network polkadotTestnet
npx hardhat run scripts/deployRegisterIdentityTask.ts --network polkadotTestnet
npx hardhat run scripts/deployStakeMilestoneTask.ts   --network polkadotTestnet
npx hardhat run scripts/deployGovernanceVoteTask.ts   --network polkadotTestnet
npx hardhat run scripts/deployAirdropClaimTask.ts     --network polkadotTestnet
npx hardhat run scripts/deployCommunityDrop.ts        --network polkadotTestnet

# DeFi layer
npx hardhat run scripts/deployExternalTaskVerifier.ts --network polkadotTestnet
npx hardhat run scripts/deployCivUSD.ts               --network polkadotTestnet

# ─── Setup & operations ───────────────────────────────────────────────────────

# Register genesis organizer + proposal (CommunityPage)
npx hardhat run scripts/setupCommunityDrop.ts         --network polkadotTestnet

# Top up community drop contract with PAS
npx hardhat run scripts/fundCommunityDrop.ts          --network polkadotTestnet

# Register external dApp schemas on ExternalTaskVerifier
# (edit TASKS array in script first)
npx hardhat run scripts/registerExternalTask.ts       --network polkadotTestnet

# ─── On-chain smoke tests ─────────────────────────────────────────────────────

npx hardhat run scripts/testTaskRewardDispenser.ts    --network polkadotTestnet
npx hardhat run scripts/testRegisterIdentityTask.ts   --network polkadotTestnet
npx hardhat run scripts/testStakeMilestoneTask.ts     --network polkadotTestnet
```

---

## 27. Extending the System
### Add a new task contract (minimal template)

```solidity
contract MyTask is Ownable, Pausable {
    bytes32 public constant TASK_ID =
        keccak256("civyx:task:my_task_v1");

    IIdentityRegistry    public identityRegistry;
    ITaskRewardDispenser public dispenser;

    error NotRegistered(address wallet);

    function claim() external whenNotPaused {
        if (!identityRegistry.verifyIdentity(msg.sender))
            revert NotRegistered(msg.sender);

        // --- verify completion condition here ---
        // e.g. require(myProtocol.hasParticipated(msg.sender));

        bytes32 commitment = identityRegistry.getCommitment(msg.sender);
        dispenser.awardTask(commitment, TASK_ID);
    }
}
```

**Deploy steps:**
1. Deploy contract
2. `TaskRewardDispenser.grantTaskOracle(address(myTask))` from admin
3. No other contracts change

### Register an external dApp schema

```solidity
// Works with any view function: f(address) → bool | uint256 | bytes32
bytes4  selector = bytes4(keccak256("hasVoted(address)"));
bytes32 schemaId = keccak256(abi.encodePacked("civyx:ext:", daoAddress, selector));

externalTaskVerifier.registerSchema(
    schemaId,
    daoAddress,
    selector,
    ReturnType.BOOL_TRUE,
    0,                               // requiredAmount (UINT_GTE_AMOUNT only)
    "Voted in My DAO governance"
);
// Users call claimExternal(schemaId) — rep awarded automatically
```

**After registering:** paste `schemaId` into `KNOWN_SCHEMAS` array in `ExternalTasksPage.tsx` for it to appear in the frontend.

### Instance-scoped task IDs

```solidity
// For tasks with multiple instances (per-proposal, per-campaign):
bytes32 taskId = keccak256(
    abi.encodePacked("civyx:task:my_action:", orgId, instanceId)
);
// Each instance gets its own permanent slot in the dispenser
```

### Suggested future extensions

| Extension | What it does | Notes |
|---|---|---|
| `CrossChainBroadcastTask` | Rep for first XCM broadcast | Check `broadcastCount[commitment] >= 1` on IdentityBroadcaster |
| `EndorseMilestoneTask` | Rep for reaching N endorsements received | Check `endorsementCount` on ReputationRegistry |
| `CivUSDMintTask` | Rep for first CivUSD mint | Check `debtOf[wallet] > 0` on CivUSD |
| `CivUSDRepayTask` | Rep for full position repayment | Check `debtOf[wallet] == 0` after burn |
| `MultiWalletTask` | Rep for linking N wallets | Check `getLinkedWalletCount` on IdentityRegistry |
| Chainlink oracle | Replace admin `updatePrice` | Drop-in: implement ITrustOracle-compatible interface |
| Liquidation discount | Incentivise liquidators | Add bonus % to `collateralToSeize` calculation |
| CivUSD local reputation | Task reward for CivUSD users | Register as APP_MANAGER, use `setLocalReputation` |
