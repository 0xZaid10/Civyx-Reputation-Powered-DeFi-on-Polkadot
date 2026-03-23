# Security — Overview

## Security Model

Security in Civyx operates at four distinct levels:

| Level | Mechanism |
|---|---|
| **Cryptographic** | ZK proofs, Pedersen commitments, nullifier scheme |
| **Protocol** | Smart contract design, access control, reentrancy protection |
| **Operational** | OpenZeppelin primitives, pausability, role separation |
| **Economic** | Staking, trust level caps, task completion costs |

This section covers every security mechanism in the protocol — how it works, what it protects against, and where the residual risks lie.

---

## Audit Status

**Civyx has not undergone a formal security audit.**

The contracts were written with security best practices in mind and use audited OpenZeppelin components throughout. However, smart contract security requires formal verification and expert review that has not yet been performed.

**Do not use Civyx to secure real capital until a formal audit has been completed.**

---

## Sections in This Chapter

| Page | What You Will Find |
|---|---|
| [Cryptographic Security](cryptographic.md) | ZK proof guarantees, Pedersen hash properties, privacy model |
| [OpenZeppelin Integration](openzeppelin.md) | AccessControl, ReentrancyGuard, Pausable — how each is used |
| [Access Control](access-control.md) | Full role matrix, principle of least privilege, admin key risk |
| [Economic Security](economic.md) | Sybil resistance, task completion costs, liquidation incentives |
| [External Call Security](external-calls.md) | staticcall isolation, gas griefing protection, XCM message security |
| [Known Risks](known-risks.md) | Honest accounting of all known limitations |
