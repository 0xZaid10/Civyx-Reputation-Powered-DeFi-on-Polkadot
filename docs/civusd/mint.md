# Minting CivUSD

## Prerequisites

Before minting, a user must have:
- An active Civyx identity registered on Asset Hub
- Sufficient PAS in their wallet to cover the required collateral
- No existing active CivUSD position (one position per wallet in the current version)

---

## Mint Flow

### Step 1 — Identity Verification

The `mint` function first verifies that the caller has an active Civyx identity:

```solidity
require(
    trustOracle.isVerified(msg.sender),
    "Active Civyx identity required"
);
```

A wallet without a registered identity cannot mint CivUSD under any circumstances.

### Step 2 — Reputation Read

The caller's current reputation tier is read live from the `TrustOracle`:

```solidity
uint8   tier  = trustOracle.getTier(msg.sender);
uint256 ratio = collateralRatios[tier];
```

### Step 3 — Collateral Check

The contract calculates the minimum required collateral and verifies the sent value meets or exceeds it:

```solidity
uint256 requiredCollateral = (civUSDAmount * ratio) / 100;
require(msg.value >= requiredCollateral, "Insufficient collateral");
```

Sending more than the minimum is accepted and stored — this over-collateralizes the position and reduces liquidation risk.

### Step 4 — Mint Fee

A one-time mint fee is deducted and retained by the protocol:

```solidity
uint256 fee = (civUSDAmount * mintFeeBps) / 10000;
protocolFees += fee;
```

Default fee: **50 basis points (0.5%)**.

### Step 5 — Position Created and CivUSD Issued

```solidity
positions[msg.sender] = Position({
    collateral:   msg.value,
    civUSDMinted: civUSDAmount,
    tierAtMint:   tier,
    mintedAt:     block.timestamp,
    active:       true
});

_mint(msg.sender, civUSDAmount);
```

---

## Full Mint Function

```solidity
function mint(
    uint256 civUSDAmount
) external payable nonReentrant whenNotPaused {
    require(civUSDAmount > 0, "Amount must be positive");
    require(
        trustOracle.isVerified(msg.sender),
        "Active Civyx identity required"
    );
    require(
        positions[msg.sender].active == false,
        "Existing position must be closed first"
    );

    uint8   tier  = trustOracle.getTier(msg.sender);
    uint256 ratio = collateralRatios[tier];

    uint256 requiredCollateral = (civUSDAmount * ratio) / 100;
    require(msg.value >= requiredCollateral, "Insufficient collateral");

    uint256 fee = (civUSDAmount * mintFeeBps) / 10000;
    protocolFees += fee;

    positions[msg.sender] = Position({
        collateral:   msg.value,
        civUSDMinted: civUSDAmount,
        tierAtMint:   tier,
        mintedAt:     block.timestamp,
        active:       true
    });

    _mint(msg.sender, civUSDAmount);

    emit Minted(msg.sender, civUSDAmount, msg.value, tier, ratio);
}
```

---

## Notes

**One position per wallet.** The current version allows one active position per wallet. To open a second position, the first must be fully burned.

**Tier is locked at mint time.** The collateral ratio used for the position is the ratio at the time of minting. Subsequent reputation improvements do not retroactively change the ratio for an existing position.

**Mint fee is non-refundable.** The one-time fee is retained by the protocol regardless of how long the position is held or when it is burned.
