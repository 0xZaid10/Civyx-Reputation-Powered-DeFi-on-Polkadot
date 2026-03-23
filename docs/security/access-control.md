# Access Control

## Role Matrix

The complete access control matrix across all 17 Civyx contracts:

| Role | Contracts | Capabilities |
|---|---|---|
| `DEFAULT_ADMIN_ROLE` | All 17 | Grant/revoke roles, update parameters, emergency functions |
| `PAUSER_ROLE` | 11 stateful contracts | Pause and unpause contract operations |
| `OPERATOR_ROLE` | IdentityRegistry, OrganizerRegistry | Admin identity deactivation, organizer approval |
| `REPUTATION_UPDATER` | ReputationRegistry | Call `addPoints` — granted exclusively to TaskRewardDispenser |
| `TASK_ORACLE` | TaskRewardDispenser, OrganizerRegistry | Call `dispenseReward`, record votes — granted to task contracts |
| `SCHEMA_MANAGER` | ExternalTaskVerifier, IdentityVerifierRouter | Register verification schemas and proof types |
| `PROPOSAL_REGISTRAR` | OrganizerRegistry | Register governance proposals |
| `CAMPAIGN_MANAGER` | CommunityDrop | Configure airdrop parameters |

---

## Principle of Least Privilege

Each role is scoped to the minimum capability needed:

- `REPUTATION_UPDATER` can only call `addPoints` — it cannot read scores, set scores directly, or pause the contract
- `TASK_ORACLE` can only call `dispenseReward` — it cannot register new tasks or modify organizer trust levels
- `SCHEMA_MANAGER` can only register and update schemas — it cannot approve organizers or modify reputation scores
- `PAUSER_ROLE` can only pause and unpause — it cannot modify any other state

This means a compromised task contract — which holds `TASK_ORACLE` — can at most award reputation points up to the bounds set by its organizer's trust level. It cannot drain funds, change parameters, or affect the identity layer.

---

## Role Dependency Chain

```
DEFAULT_ADMIN_ROLE
      │ grants
      ├── PAUSER_ROLE (to trusted operators)
      ├── OPERATOR_ROLE (to trusted operators)
      ├── REPUTATION_UPDATER (to TaskRewardDispenser only)
      ├── TASK_ORACLE (to authorized task contracts)
      ├── SCHEMA_MANAGER (to authorized schema managers)
      ├── PROPOSAL_REGISTRAR (to authorized organizers)
      └── CAMPAIGN_MANAGER (to airdrop operators)
```

---

## Admin Key Risk

The `DEFAULT_ADMIN_ROLE` is currently held by the deployer address `0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266`.

This is the primary centralization risk in the current deployment. A compromised admin key could:
- Grant `REPUTATION_UPDATER` to an arbitrary address and inflate scores
- Drain protocol fees from CivUSD
- Update collateral ratios to unsafe values
- Pause all contracts simultaneously

**Current mitigation:** This is a testnet deployment. The admin key risk is acknowledged and accepted for this phase. No real capital is at risk.

**Planned mitigation:** Transfer `DEFAULT_ADMIN_ROLE` to a Gnosis Safe multisig (3-of-5 minimum) before any mainnet deployment. Move critical parameter changes to on-chain governance long term.

---

## What Admin Cannot Do

Despite the broad admin powers, there are things no admin key can do:

- **Alter ZK verification logic.** The verifier contracts are immutable. No admin function can change what constitutes a valid proof.
- **Revoke earned reputation retroactively.** There is no `removePoints` function. Once awarded, points are permanent.
- **Forge a ZK proof.** The math is the math. No admin key bypasses the cryptographic verification.
- **Access user secrets.** Secrets are never on-chain. No contract function can reveal them.
