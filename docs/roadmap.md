# Roadmap

## Current State — What Is Live Today

Civyx is a testnet deployment built for the Polkadot Solidity Hackathon. The protocol is functional — identity registration, wallet linking, reputation earning, CivUSD minting, and XCM broadcasting all work on Polkadot Asset Hub Testnet (chainId: 420420417).

### Fully Functional

**Identity Protocol**
- Secret generation in browser via Barretenberg WASM
- Pedersen commitment computation
- On-chain identity registration with PAS stake
- ZK proof generation for wallet linking — runs entirely in browser
- On-chain wallet link verification
- Nullifier tracking and replay prevention
- Identity deactivation, stake recovery, and reactivation

**Reputation Protocol**
- ReputationRegistry with 0–1000 scoring and five tiers
- OrganizerRegistry with genesis organizer and trust levels
- TaskRewardDispenser with trust level enforcement
- All four internal task contracts deployed and operational
- CommunityDrop — 2000 PAS funded, 40 claims available
- ExternalTaskVerifier with staticcall schema verification
- TrustOracle exposing unified reputation query interface

**DeFi Layer**
- CivUSD with five-tier reputation-gated collateral ratios
- Mint and burn flows with one-time fee
- Position health tracking
- Collateral top-up
- Liquidation with 5% bonus

**Infrastructure**
- 226 passing Hardhat tests across 9 test suites
- All 17 contracts deployed and verified on Blockscout
- Vite + React + wagmi frontend deployed on Vercel

### Partially Functional

**XCM Broadcasting** — `IdentityBroadcaster` is live and broadcast functions work. No destination parachain receiver contracts are deployed yet. Auto-broadcast listener integration is implemented at the contract level but not yet wired end-to-end.

**External Task Verification** — `ExternalTaskVerifier` is deployed. Schema registration is admin-only. No external protocol schemas are registered beyond Civyx internal ones.

**CivUSD Price Oracle** — Liquidation logic is implemented. The price feed is a simplified testnet oracle, not manipulation-resistant.

---

## Phase 1 — Testnet Hardening

*Near term — 4–8 weeks*

### Security
- **Multisig admin transfer.** Move `DEFAULT_ADMIN_ROLE` across all 17 contracts from the deployer EOA to a Gnosis Safe multisig (3-of-5). This is the single most important security improvement before any real capital is involved.
- **Internal security review.** Thorough review of all contract logic — ZK verifier integration, `ExternalTaskVerifier` staticcall handling, and CivUSD liquidation logic. Document findings and fix issues before external audit.
- **Fuzz testing.** Expand the Hardhat test suite with fuzz tests targeting reputation scoring math, collateral ratio calculations, and nullifier uniqueness.

### External Task Verification
- **Schema self-service interface.** Frontend interface for approved organizers to register external task schemas without requiring an admin transaction.
- **Initial external protocol integrations.** Register verification schemas for 3–5 external protocols on Polkadot Asset Hub with clearly readable on-chain state.

### Frontend
- **Proof generation UX.** Improve the progress bar granularity for wallet link proof generation (10–30 seconds), add estimated time remaining, improve error handling.
- **Mobile compatibility.** Investigate WebAssembly memory constraints on iOS and Android. Implement appropriate fallbacks for devices that cannot handle proof generation.

---

## Phase 2 — XCM Deployment

*Medium term — 2–4 months*

### Receiver Contract Deployment
- **Westend testnet.** Deploy Civyx receiver contract on Westend Asset Hub. Test the full XCM round-trip — broadcast from Polkadot Asset Hub Testnet, receive on Westend, query from a local contract.
- **Rococo deployment.** Expand to Rococo for multi-parachain testing.
- **EVM parachain testnets.** Deploy receivers on Moonbeam, Astar, and Acala testnets — the three highest-priority production targets.

### Auto-Broadcast
- **ReputationRegistry listener.** Complete the connection between `ReputationRegistry` `ReputationEarned` events and the `IdentityBroadcaster` auto-broadcast logic.
- **Fee reserve mechanism.** Users deposit PAS into a per-wallet reserve on the `IdentityBroadcaster`. Auto-broadcast fees deduct from the reserve. When exhausted, auto-broadcast pauses and the user is notified.

### Protocol-Triggered Refresh
- Design and implement the interface allowing destination parachain protocols to trigger a reputation refresh from Asset Hub before sensitive operations — the highest-assurance freshness mechanism.

---

## Phase 3 — Mainnet Preparation

*Medium term — 3–6 months*

These requirements are non-negotiable before any mainnet deployment.

### Formal Audit
An independent security audit by a reputable smart contract auditing firm. Target firms: Trail of Bits, Spearbit, or Zellic — firms with experience in both EVM smart contracts and ZK proof systems.

Scope: all 17 contracts, ZK circuit implementations, XCM message handling logic.

**A clean audit report or full accounting of findings and remediations is required. The audit cannot be deferred.**

### Production Price Oracle
Replace the simplified testnet price feed with a production-grade solution:
- **Option A:** Polkadot-native oracle infrastructure accessible from Asset Hub
- **Option B:** Chainlink price feeds via XCM (if available on Asset Hub at mainnet time)

The decision will be made based on what is live, audited, and manipulation-resistant at the time.

### Governance Framework
Move critical protocol parameters from admin-controlled to governance-controlled:
- Collateral ratio changes in CivUSD
- Mint fee changes
- Liquidation threshold changes
- Minimum stake changes in `IdentityRegistry`
- Trust level assignments for organizers above level 2
- Addition of new destination parachain receivers

The governance mechanism will use the `OrganizerRegistry` proposal and voting infrastructure — Civyx can govern itself using its own reputation system.

---

## Phase 4 — Mainnet Launch

*Long term — 6–12 months*

### Polkadot Asset Hub Mainnet Deployment
All 17 contracts deployed to mainnet with:
- Audited contract code
- Multisig or governance-controlled admin
- Production price oracle for CivUSD
- Funded CommunityDrop for mainnet launch
- Full XCM receiver deployment on priority parachains

### Production Receiver Network

| Parachain | Priority | Rationale |
|---|---|---|
| Moonbeam | High | Largest EVM ecosystem on Polkadot |
| Astar | High | Strong DeFi and NFT ecosystem |
| Acala | High | Native DeFi hub |
| Hydration | Medium | DEX — CivUSD liquidity |
| Interlay | Medium | BTC DeFi |
| Bifrost | Medium | Liquid staking |

### DeFi Protocol Integrations
Approach established Polkadot DeFi protocols to integrate Civyx reputation. The value proposition for integrating protocols:
- Reduce collateral requirements for verified users
- Gate governance participation — prevent Sybil attacks
- Reward long-term users with loyalty benefits
- Earn organizer revenue through task creation

External task verification means integrations require no smart contract changes on the partner side — any readable on-chain state can become a Civyx reputation signal immediately.

---

## Phase 5 — Protocol Expansion

*Long term — 12+ months*

### Reputation Decay
Introduce configurable decay so reputation reflects recent activity rather than accumulated history. A user who was active two years ago and inactive since should score lower than a currently active user with the same total points.

The decay mechanism must avoid punishing users who simply hold reputation, creating a participation treadmill, or being gameable by timing task completions. Current thinking: exponential decay toward a floor — reputation decays but never to zero, preserving historical value while rewarding current activity.

### Cross-Chain Reputation Aggregation
Allow reputation earned on destination parachains through Civyx-integrated protocols to flow back to Asset Hub and contribute to the canonical score. This requires a trust model for cross-chain reputation claims — likely ZK proofs generated on the destination chain submitted to Asset Hub for canonical score update. A significant research direction.

### Reputation Lending
High-reputation users act as vouchers for low-reputation users — temporarily extending their collateral ratio benefit in exchange for a fee. Creates a reputation economy where high-reputation users can monetize their standing. The attack vector (vouching for Sybil identities) is mitigated by the voucher's financial liability for the vouched position.

### Reputation-Weighted Governance
Replace or supplement token-weighted governance with reputation-weighted governance. Protocol decisions weighted by Civyx score rather than token holdings. Directly realizes the protocol's core thesis — consistent on-chain behavior should translate to influence.

The challenge: if governance weight depends on reputation, the incentive to farm tasks increases dramatically. The trust level cap system (1000 point maximum, 50 points max per task) provides some protection, but this requires careful game theory analysis before implementation.

### ZK-Verified XCM Messages
Replace broadcaster address authentication with ZK proofs that cryptographically verify data came from the Civyx protocol — eliminating the trust assumption on the broadcaster address entirely. A frontier research area at the intersection of ZK proofs and cross-chain messaging.

### Mobile SDK
React Native SDK for mobile application integration. The primary challenge is ZK proof generation on mobile hardware — current browser-based Barretenberg WASM requires 1–2 GB memory and 10–30 seconds. Solutions under investigation: delegated proving with client-side verification, lighter mobile-specific proof systems.

---

## What We Are Still Figuring Out

These are open questions without settled answers.

**Tokenomics.** Whether Civyx needs a native governance token, how protocol revenue should flow, and whether reputation itself is sufficient as governance weight are genuinely unsettled. The current model — fees accumulate in CivUSD, withdrawable by admin — is a placeholder.

**Reputation portability limits.** If reputation can be earned across any integrated protocol on any parachain and aggregated back to Asset Hub, the attack surface for reputation gaming expands. The right balance between portability and integrity is not yet determined.

**Decay mechanism parameters.** Reputation decay is clearly needed for long-term health. The exact rate, floor value, and whether decay applies above a threshold require both game theory analysis and community input.

**Oracle selection.** Depends on what infrastructure is live and audited on Polkadot at mainnet preparation time. Cannot be decided today.

**Audit timeline.** Auditing firms with ZK proof system expertise have long lead times. Mainnet timeline is gated on audit availability as much as engineering readiness.

---

## Summary

| Phase | Timeline | Key Deliverables |
|---|---|---|
| Phase 1 — Testnet Hardening | 4–8 weeks | Multisig admin, external task schemas, frontend UX |
| Phase 2 — XCM Deployment | 2–4 months | Receiver contracts, auto-broadcast, protocol-triggered refresh |
| Phase 3 — Mainnet Preparation | 3–6 months | Formal audit, production oracle, governance framework |
| Phase 4 — Mainnet Launch | 6–12 months | Asset Hub mainnet, receiver network, DeFi integrations |
| Phase 5 — Protocol Expansion | 12+ months | Reputation decay, cross-chain aggregation, reputation governance |

The direction is clear. The execution will take time and will change as we learn. Civyx is not a finished product — it is a protocol in active development with a working foundation and a coherent thesis about where on-chain trust should go.
