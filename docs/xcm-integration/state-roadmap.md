# Current State and Roadmap

## What Is Live Today

### Fully Functional on Testnet

- `IdentityBroadcaster` deployed and live at `0x9A5710098B845e7841E1D09E1bde0dC1e30374AC`
- Manual broadcast functions work: `broadcastReputation`, `broadcastIdentity`, `broadcastWalletLink`
- Batch broadcasting implemented and tested
- Auto-broadcast implemented at the contract level
- Fee configuration system working

### Partially Functional

- **Auto-broadcast listener:** The contract logic is complete but the event listener connection between `ReputationRegistry` score changes and the `IdentityBroadcaster` auto-dispatch is not yet wired end-to-end
- **No destination receiver contracts deployed:** The receiver contract code is complete and ready for deployment on any EVM-compatible parachain, but no deployments exist yet
- **No production XCM round-trip tested:** Full end-to-end broadcast → receive → query has not been tested in a live multi-chain environment

---

## Roadmap

### Short Term

**Complete auto-broadcast listener integration.** Wire the `ReputationRegistry` `ReputationEarned` event to automatically trigger `IdentityBroadcaster` dispatches for wallets with auto-broadcast enabled.

**Deploy receiver on Westend.** First real end-to-end XCM test — broadcast from Polkadot Asset Hub Testnet, receive and store on Westend, query from a local contract.

**Deploy receiver on Rococo.** Broader testing across multiple parachain configurations.

---

### Medium Term

**EVM parachain receiver deployments.** Deploy receiver contracts on testnet environments for Moonbeam, Astar, and Acala — the three highest-priority production targets.

**Fee reserve mechanism.** Design and implement a fee reserve system for auto-broadcast. Users deposit PAS into a per-wallet reserve. Auto-broadcast fees are deducted from the reserve. When exhausted, auto-broadcast pauses and the user is notified.

**Protocol-triggered refresh.** Implement the callback pattern allowing destination protocols to request an updated score from Asset Hub before sensitive operations.

---

### Long Term

**Production receiver network.** Deploy and maintain Civyx receiver contracts on all major Polkadot EVM parachains — Moonbeam, Astar, Acala, Hydration, Interlay, Bifrost.

**Governance-controlled broadcaster updates.** Move broadcaster address configuration from admin-controlled to on-chain governance.

**ZK-verified XCM messages.** Replace broadcaster address authentication with ZK proofs that allow destination parachains to cryptographically verify that data came from the Civyx protocol — eliminating the trust assumption on the broadcaster address entirely.

**Cross-chain reputation aggregation.** Allow reputation earned on destination parachains through Civyx-integrated protocols to flow back to Asset Hub and contribute to the canonical score.
