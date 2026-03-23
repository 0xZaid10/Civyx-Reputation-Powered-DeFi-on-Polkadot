# OpenZeppelin Integration

## Modules Used

Civyx uses three core OpenZeppelin security modules across its 17 contracts. Each is used consistently and for a specific purpose.

---

## AccessControl

**Used by:** All 17 contracts

OpenZeppelin's `AccessControl` provides role-based permission management. Every sensitive function in Civyx is gated to a specific role. Roles are granted and revoked by the `DEFAULT_ADMIN_ROLE`.

```solidity
// Example usage in ReputationRegistry:
function addPoints(
    bytes32 commitment,
    uint256 points
) external onlyRole(REPUTATION_UPDATER) nonReentrant whenNotPaused {
    // Only TaskRewardDispenser can call this
}
```

**Why not Ownable?** `AccessControl` allows multiple roles to be distributed across different addresses. `Ownable` is a single-owner model that creates a harder centralization point. For a protocol with multiple interacting contracts and operational roles, `AccessControl` provides the right granularity.

---

## ReentrancyGuard

**Used by:** IdentityRegistry, ReputationRegistry, OrganizerRegistry, TaskRewardDispenser, all four task contracts, CommunityDrop, CivUSD

Every function in these contracts that transfers PAS to an external address is protected with `nonReentrant`.

```solidity
// Example usage in CivUSD:
function burn(uint256 civUSDAmount)
    external nonReentrant whenNotPaused {
    // ... state changes first (checks-effects-interactions)
    _burn(msg.sender, civUSDAmount);
    (bool success, ) = msg.sender.call{value: collateralToReturn}("");
    require(success, "Transfer failed");
}
```

The pattern used throughout is **checks-effects-interactions**:
1. All `require` statements
2. All state variable updates
3. The external ETH transfer — always last

This ordering ensures that even if a malicious contract attempts a reentrant call during the transfer, all state has already been updated and the reentrant call will fail its own checks.

---

## Pausable

**Used by:** 11 stateful contracts (all except the four pure verifier contracts and IdentityVerifierRouter)

Each contract is independently pausable. This granularity is intentional — a vulnerability in the task system should not require pausing the identity layer or CivUSD.

```solidity
// Pause stops all state-changing operations:
function mint(uint256 civUSDAmount)
    external payable nonReentrant whenNotPaused {
    // Cannot execute if contract is paused
}
```

**Pausability matrix:**

| Contract | Pausable | What Pausing Stops |
|---|---|---|
| IdentityRegistry | ✓ | New registrations, wallet linking |
| ReputationRegistry | ✓ | Score updates |
| OrganizerRegistry | ✓ | Registrations, vote recording |
| TrustOracle | ✓ | Score queries |
| TaskRewardDispenser | ✓ | Reward dispensing |
| ExternalTaskVerifier | ✓ | staticcall verification |
| All four task contracts | ✓ | Task completions |
| CommunityDrop | ✓ | Airdrop claims |
| CivUSD | ✓ | Mint, burn, liquidation |
| IdentityBroadcaster | ✓ | XCM broadcasts |
| WalletLinkVerifier | ✗ | Pure math — nothing to pause |
| NullifierVerifier | ✗ | Pure math |
| IdentityVerifier | ✗ | Pure math |
| IdentityVerifierRouter | ✗ | Routing only |

---

## ERC20

**Used by:** CivUSD only

OpenZeppelin's standard ERC20 implementation provides the token interface for CivUSD. The `_mint` and `_burn` internal functions are called by the CivUSD mint and burn logic.

---

## Emergency Response Procedure

If a vulnerability is discovered, the pause procedure is:

1. Pause the affected contract using the `PAUSER_ROLE`
2. Assess whether adjacent contracts are affected
3. Pause additional contracts as needed
4. Develop and deploy a fix
5. Unpause in reverse order of impact

Pausing is never destructive. No funds are lost when a contract is paused. Existing CivUSD positions retain their collateral. Earned reputation scores are preserved.
