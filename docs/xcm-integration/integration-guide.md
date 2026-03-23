# Integration Guide for Destination Parachains

## Overview

A parachain that wants to use Civyx as a trust layer needs to complete four steps: deploy the receiver contract, register with the broadcaster, integrate the receiver into local contracts, and implement a freshness policy.

---

## Step 1 — Deploy the Receiver Contract

Deploy the Civyx receiver contract on the destination parachain, configuring it with the Asset Hub `IdentityBroadcaster` address as the authorized XCM origin:

```solidity
CivyxReceiver receiver = new CivyxReceiver(
    0x9A5710098B845e7841E1D09E1bde0dC1e30374AC, // Asset Hub broadcaster
    ADMIN_ADDRESS
);
```

---

## Step 2 — Register With the Broadcaster

Contact the Civyx core team or submit a governance proposal to register the new parachain's receiver address on the `IdentityBroadcaster`:

```solidity
// Called by Civyx admin on Asset Hub
identityBroadcaster.setDestinationContract(
    DEST_PARACHAIN_ID,
    address(receiver)
);

identityBroadcaster.setFeeConfig(
    DEST_PARACHAIN_ID,
    0.01 ether,    // fee per message
    1_000_000_000  // weight limit
);
```

---

## Step 3 — Integrate Into Local Contracts

Import the receiver interface and call it from your protocol contracts:

```solidity
interface ICivyxReceiver {
    function getScore(address wallet) external view returns (uint256);
    function getTier(address wallet) external view returns (uint8);
    function isVerified(address wallet) external view returns (bool);
    function isFresh(address wallet, uint256 maxAge) external view returns (bool);
}

contract MyDeFiProtocol {
    ICivyxReceiver public civyxReceiver;

    constructor(address _receiver) {
        civyxReceiver = ICivyxReceiver(_receiver);
    }

    function getCollateralRatio(address user) public view returns (uint256) {
        require(civyxReceiver.isVerified(user), "Civyx identity required");
        require(civyxReceiver.isFresh(user, 24 hours), "Reputation data stale");

        uint8 tier = civyxReceiver.getTier(user);

        if (tier >= 5) return 110;
        if (tier >= 4) return 125;
        if (tier >= 3) return 140;
        if (tier >= 2) return 160;
        return 180;
    }
}
```

---

## Step 4 — Implement a Freshness Policy

Decide on a maximum data age appropriate for your protocol's risk profile. Implement it using `isFresh(wallet, maxAge)`.

Communicate clearly to users when their reputation data needs to be refreshed on Asset Hub before they can interact with your protocol. A user-facing error message like: *"Your Civyx reputation data is outdated. Please visit Asset Hub to refresh."* prevents confusion.

---

## Checklist

- [ ] Receiver contract deployed on destination parachain
- [ ] Broadcaster address set correctly in receiver constructor
- [ ] Receiver address registered with Asset Hub `IdentityBroadcaster`
- [ ] Fee config set for the destination parachain
- [ ] Receiver interface integrated into local protocol contracts
- [ ] `isVerified()` check implemented before reputation-gated actions
- [ ] `isFresh()` check implemented with appropriate max age
- [ ] User-facing error messages for stale data and unverified identity
- [ ] Fallback behavior defined for when receiver is paused or unavailable
