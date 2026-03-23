# Smart Contracts Reference — Overview

## All Deployed Contracts

Civyx is composed of 17 smart contracts deployed across three protocol layers on Polkadot Asset Hub Testnet (chainId: 420420417).

---

## Deployment Configuration

| Parameter | Value |
|---|---|
| Network | Polkadot Asset Hub Testnet |
| Chain ID | 420420417 |
| RPC | https://eth-rpc-testnet.polkadot.io |
| Gas price | 1000 Gwei |
| Transaction type | Legacy (type 0) |
| Deployer | `0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266` |

---

## Complete Contract Directory

| Contract | Layer | Address |
|---|---|---|
| IdentityRegistry | Identity | `0x56BBC4969818d4E27Fe39983f8aDee4F3e1C5c6f` |
| WalletLinkVerifier | Identity | `0x72CC5BA2958CB688B00dFE2E578Db3BbB79eD311` |
| NullifierVerifier | Identity | `0x0454a4798602babb16529F49920E8B2f4a747Bb2` |
| IdentityVerifier | Identity | `0xa2Cd20296027836dbD67874Ebd4a11Eeede292C8` |
| IdentityVerifierRouter | Identity | `0xC2D5F1C13e2603624a717409356DD48253f17319` |
| IdentityBroadcaster | Identity | `0x9A5710098B845e7841E1D09E1bde0dC1e30374AC` |
| ReputationRegistry | Reputation | `0xa9FCD9102fbe420a40B380a891f94a3Fc1D4Fb2c` |
| OrganizerRegistry | Reputation | `0x8A472Ca618c74FdF270A9A75bE6034a7d98BB9B9` |
| TrustOracle | Reputation | `0xe6aD6C8f4943CC39b5dFb46FB88a1597bdF4b467` |
| TaskRewardDispenser | Reputation | `0xF5971713619e7622e82f329a3f46B7280E781c58` |
| ExternalTaskVerifier | Reputation | `0x434F288ff599e1f56fe27CF372be2941543b4171` |
| RegisterIdentityTask | Reputation | `0x2b17aDAcd236a6A1641be06f1Ba8F5257109Cce6` |
| StakeMilestoneTask | Reputation | `0x1825B4c62A70f5E53323F1b3fEAAA22F451E033b` |
| GovernanceVoteTask | Reputation | `0x5f9dD176ea5282d392225ceC5c2E7A24d5d02672` |
| AirdropClaimTask | Reputation | `0x2C834EFcDd2E9D04C1a34367BA9D8aa587F90fBe` |
| CommunityDrop | Reputation | `0x3A5fBC501c5D515383fADFf5ebD92C393f5eFee9` |
| CivUSD | DeFi | `0xa3ce5424489ed5D8cff238009c61ab48Ef852F6D` |

---

## OpenZeppelin Usage Summary

| Module | Contracts Using It | Purpose |
|---|---|---|
| `AccessControl` | All 17 contracts | Role-based permission management |
| `ReentrancyGuard` | IdentityRegistry, ReputationRegistry, OrganizerRegistry, TaskRewardDispenser, all task contracts, CommunityDrop, CivUSD | Protect ETH-transferring functions |
| `Pausable` | 11 stateful contracts | Emergency stop per contract |
| `ERC20` | CivUSD | Standard token implementation |

---

## Detailed References

- [Identity Layer Contracts](identity.md)
- [Reputation Layer Contracts](reputation.md)
- [DeFi Layer Contracts](defi.md)
