# External Task Verification

## Overview

External task verification is the mechanism that turns Civyx into a universal reputation layer across DeFi — without requiring any protocol integration or cooperation from the target protocol.

Using `staticcall`, the `ExternalTaskVerifier` contract can verify a user's actions on any contract that exposes readable on-chain state. If a function exists and returns a verifiable result, Civyx can use it as a task condition.

---

## How It Works

The `ExternalTaskVerifier` executes a `staticcall` against any target contract with any calldata. `staticcall` is a read-only EVM operation — it cannot modify state, transfer value, or cause side effects on the target.

```solidity
function verify(
    address target,
    bytes calldata callData,
    bytes calldata expectedResult
) external view returns (bool) {
    (bool success, bytes memory result) = target.staticcall(callData);
    require(success, "External call failed");
    return keccak256(result) == keccak256(expectedResult);
}
```

The verification only passes if the return data matches the schema's `expectedValue` exactly. A target that returns arbitrary or unexpected data fails the check — no reputation is awarded.

---

## Verification Schemas

Each external task defines a verification schema stored in the `ExternalTaskVerifier`:

| Field | Description |
|---|---|
| `target` | The external contract address |
| `selector` | The function selector to call |
| `expectedValue` | The return value that constitutes task completion |
| `argType` | How to encode the user address in the calldata |

Schemas are registered by addresses with the `SCHEMA_MANAGER` role and are identified by a `uint256` schema ID.

---

## What Can Be Verified

At launch, external task verification supports any function that:
- Takes a single `address` parameter
- Returns a `bool`, `uint256`, or `bytes32`
- Is callable via `staticcall` (view or pure)

Examples of verifiable actions:

| External Protocol | Function | What It Proves |
|---|---|---|
| Any governance contract | `hasVoted(address)` | Governance participation |
| Any ERC20 | `balanceOf(address)` | Token holding |
| Any airdrop contract | `hasClaimed(address)` | Airdrop participation |
| Any staking contract | `stakedBalance(address)` | Active staking |
| Any LP contract | `getLiquidityPosition(address)` | Liquidity provision |

More complex verification schemas — multi-parameter functions, return value ranges — are on the roadmap.

---

## Security

**`staticcall` cannot modify state.** It cannot drain funds, emit events, or cause side effects on the target contract.

**Gas griefing protection.** A gas limit is passed to every `staticcall`, preventing a malicious target from consuming unbounded gas:

```solidity
(bool success, bytes memory result) = target.staticcall{
    gas: MAX_EXTERNAL_GAS
}(callData);
```

**Expected value matching.** The verification only passes on an exact match. Arbitrary return data causes the check to fail cleanly.

---

## ExternalTaskVerifier — Key Functions

**Address:** `0x434F288ff599e1f56fe27CF372be2941543b4171`

| Function | Description |
|---|---|
| `verify(address target, bytes callData, bytes expectedResult)` | Execute a single staticcall verification |
| `verifySchema(uint256 schemaId, address user)` | Verify user against stored schema |
| `registerSchema(address target, bytes4 selector, bytes expectedValue, uint8 argType)` | Register new schema |
| `getSchema(uint256 schemaId)` | Read schema details |
