import { expect }      from 'chai';
import { ethers }      from 'hardhat';
import { loadFixture } from '@nomicfoundation/hardhat-toolbox/network-helpers';

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const PAS        = ethers.parseEther('1');              // 1 PAS in wei
// PAS/USD price: $0.05 = 5_000_000 (8 decimal precision)
const PAS_PRICE  = 5_000_000n;
const MINT_FEE   = 50n;   // 0.5% in basis points
const FEE_PREC   = 10_000n;

// Collateral ratios
const RATIO_T0 = 180n; // 0–49 rep
const RATIO_T1 = 150n; // 50–99 rep
const RATIO_T2 = 130n; // 100–299 rep
const RATIO_T3 = 115n; // 300–599 rep
const RATIO_T4 = 110n; // 600+ rep

// Compute max mintable for given collateral + ratio (gross, before fee)
function maxGross(collateralWei: bigint, ratio: bigint): bigint {
  const collateralUsd = (collateralWei * PAS_PRICE) / (10n ** 18n);
  return (collateralUsd * 100n * 1_000_000_0000n) / ratio; // 1e10
}

function netMint(gross: bigint): bigint {
  const fee = (gross * MINT_FEE) / FEE_PREC;
  return gross - fee;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

async function deployFixture() {
  const [admin, alice, bob, liquidator, stranger] = await ethers.getSigners();

  // Mock TrustOracle
  const MockOracle = await ethers.getContractFactory('MockTrustOracle');
  const oracle     = await MockOracle.deploy();

  // CivUSD
  const CivUSD = await ethers.getContractFactory('CivUSD');
  const civUsd = await CivUSD.deploy(
    await oracle.getAddress(),
    PAS_PRICE,
    admin.address
  );

  // Register alice with 0 rep (Tier 0)
  await oracle.setIdentity(alice.address, true, 0n);
  // Register bob with 113 rep (Tier 2)
  await oracle.setIdentity(bob.address, true, 113n);

  return { admin, alice, bob, liquidator, stranger, oracle, civUsd };
}

// ─────────────────────────────────────────────────────────────────────────────
// Deployment
// ─────────────────────────────────────────────────────────────────────────────

describe('CivUSD — deployment', () => {
  it('has correct name and symbol', async () => {
    const { civUsd } = await loadFixture(deployFixture);
    expect(await civUsd.name()).to.equal('Civyx USD');
    expect(await civUsd.symbol()).to.equal('CivUSD');
  });

  it('stores oracle and price', async () => {
    const { civUsd, oracle } = await loadFixture(deployFixture);
    expect(await civUsd.trustOracle()).to.equal(await oracle.getAddress());
    expect(await civUsd.pasUsdPrice()).to.equal(PAS_PRICE);
  });

  it('reverts ZeroAddress on zero oracle', async () => {
    const [admin] = await ethers.getSigners();
    const CivUSD = await ethers.getContractFactory('CivUSD');
    await expect(CivUSD.deploy(ethers.ZeroAddress, PAS_PRICE, admin.address))
      .to.be.revertedWithCustomError({ interface: CivUSD.interface }, 'ZeroAddress');
  });

  it('reverts ZeroPrice on zero price', async () => {
    const [admin] = await ethers.getSigners();
    const MockOracle = await ethers.getContractFactory('MockTrustOracle');
    const oracle     = await MockOracle.deploy();
    const CivUSD     = await ethers.getContractFactory('CivUSD');
    await expect(CivUSD.deploy(await oracle.getAddress(), 0n, admin.address))
      .to.be.revertedWithCustomError({ interface: CivUSD.interface }, 'ZeroPrice');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Collateral ratios
// ─────────────────────────────────────────────────────────────────────────────

describe('CivUSD — collateral ratios', () => {
  it('returns 180% for Tier 0 (rep 0–49)', async () => {
    const { civUsd, alice, oracle } = await loadFixture(deployFixture);
    await oracle.setIdentity(alice.address, true, 0n);
    expect(await civUsd.collateralRatioFor(alice.address)).to.equal(RATIO_T0);
  });

  it('returns 150% for Tier 1 (rep 50–99)', async () => {
    const { civUsd, alice, oracle } = await loadFixture(deployFixture);
    await oracle.setIdentity(alice.address, true, 75n);
    expect(await civUsd.collateralRatioFor(alice.address)).to.equal(RATIO_T1);
  });

  it('returns 130% for Tier 2 (rep 100–299)', async () => {
    const { civUsd, bob } = await loadFixture(deployFixture);
    expect(await civUsd.collateralRatioFor(bob.address)).to.equal(RATIO_T2);
  });

  it('returns 115% for Tier 3 (rep 300–599)', async () => {
    const { civUsd, alice, oracle } = await loadFixture(deployFixture);
    await oracle.setIdentity(alice.address, true, 400n);
    expect(await civUsd.collateralRatioFor(alice.address)).to.equal(RATIO_T3);
  });

  it('returns 110% for Tier 4 (rep 600+)', async () => {
    const { civUsd, alice, oracle } = await loadFixture(deployFixture);
    await oracle.setIdentity(alice.address, true, 700n);
    expect(await civUsd.collateralRatioFor(alice.address)).to.equal(RATIO_T4);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Mint — happy paths
// ─────────────────────────────────────────────────────────────────────────────

describe('CivUSD — mint happy paths', () => {
  it('alice mints CivUSD at Tier 0 ratio (180%)', async () => {
    const { civUsd, alice } = await loadFixture(deployFixture);

    const collateral = 10n * PAS;
    const gross      = maxGross(collateral, RATIO_T0);
    const net        = netMint(gross);

    await expect(
      civUsd.connect(alice).mint(net, { value: collateral })
    ).to.emit(civUsd, 'Minted');

    expect(await civUsd.balanceOf(alice.address)).to.equal(net);
    expect(await civUsd.debtOf(alice.address)).to.equal(net);
    expect(await civUsd.collateralOf(alice.address)).to.equal(collateral);
  });

  it('bob mints at Tier 2 ratio (130%) with better terms', async () => {
    const { civUsd, bob } = await loadFixture(deployFixture);

    const collateral = 10n * PAS;
    const gross      = maxGross(collateral, RATIO_T2);
    const net        = netMint(gross);

    await civUsd.connect(bob).mint(net, { value: collateral });
    expect(await civUsd.balanceOf(bob.address)).to.equal(net);
  });

  it('bob gets more CivUSD than alice for same collateral', async () => {
    const { civUsd, alice, bob } = await loadFixture(deployFixture);

    const collateral = 10n * PAS;
    const aliceNet   = netMint(maxGross(collateral, RATIO_T0));
    const bobNet     = netMint(maxGross(collateral, RATIO_T2));

    expect(bobNet).to.be.gt(aliceNet);
  });

  it('maxMintable view returns correct values', async () => {
    const { civUsd, alice } = await loadFixture(deployFixture);
    const collateral = 10n * PAS;
    const [net, fee, ratio] = await civUsd.maxMintable(alice.address, collateral);

    expect(ratio).to.equal(RATIO_T0);
    expect(fee + net).to.equal(maxGross(collateral, RATIO_T0));
  });

  it('position is healthy after minting', async () => {
    const { civUsd, alice } = await loadFixture(deployFixture);
    const collateral = 10n * PAS;
    const net = netMint(maxGross(collateral, RATIO_T0));

    await civUsd.connect(alice).mint(net, { value: collateral });
    expect(await civUsd.isHealthy(alice.address)).to.be.true;
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Mint — revert paths
// ─────────────────────────────────────────────────────────────────────────────

describe('CivUSD — mint revert paths', () => {
  it('reverts NotRegisteredIdentity for unregistered wallet', async () => {
    const { civUsd, stranger } = await loadFixture(deployFixture);
    await expect(
      civUsd.connect(stranger).mint(1n, { value: PAS })
    ).to.be.revertedWithCustomError(civUsd, 'NotRegisteredIdentity');
  });

  it('reverts InsufficientCollateral when trying to mint too much', async () => {
    const { civUsd, alice } = await loadFixture(deployFixture);
    const collateral = 10n * PAS;
    const tooMuch    = maxGross(collateral, RATIO_T0) * 2n; // 2x max

    await expect(
      civUsd.connect(alice).mint(tooMuch, { value: collateral })
    ).to.be.revertedWithCustomError(civUsd, 'InsufficientCollateral');
  });

  it('reverts ZeroAmount on zero collateral', async () => {
    const { civUsd, alice } = await loadFixture(deployFixture);
    await expect(
      civUsd.connect(alice).mint(100n, { value: 0n })
    ).to.be.revertedWithCustomError(civUsd, 'ZeroAmount');
  });

  it('reverts when paused', async () => {
    const { civUsd, alice, admin } = await loadFixture(deployFixture);
    await civUsd.connect(admin).pause();
    await expect(
      civUsd.connect(alice).mint(1n, { value: PAS })
    ).to.be.revertedWithCustomError(civUsd, 'EnforcedPause');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Burn
// ─────────────────────────────────────────────────────────────────────────────

describe('CivUSD — burn', () => {
  it('full burn returns all collateral', async () => {
    const { civUsd, alice } = await loadFixture(deployFixture);

    const collateral = 10n * PAS;
    const net        = netMint(maxGross(collateral, RATIO_T0));
    await civUsd.connect(alice).mint(net, { value: collateral });

    const balBefore = await ethers.provider.getBalance(alice.address);
    const tx        = await civUsd.connect(alice).burn(net);
    const rcpt      = await tx.wait();
    const gasUsed   = rcpt!.gasUsed * rcpt!.gasPrice;
    const balAfter  = await ethers.provider.getBalance(alice.address);

    expect(balAfter).to.equal(balBefore + collateral - gasUsed);
    expect(await civUsd.debtOf(alice.address)).to.equal(0n);
    expect(await civUsd.collateralOf(alice.address)).to.equal(0n);
  });

  it('partial burn reduces debt and collateral proportionally', async () => {
    const { civUsd, alice } = await loadFixture(deployFixture);

    const collateral = 10n * PAS;
    const net        = netMint(maxGross(collateral, RATIO_T0));
    await civUsd.connect(alice).mint(net, { value: collateral });

    const halfDebt       = net / 2n;
    const expectedReturn = (collateral * halfDebt) / net;

    await civUsd.connect(alice).burn(halfDebt);

    expect(await civUsd.debtOf(alice.address)).to.equal(net - halfDebt);
    expect(await civUsd.collateralOf(alice.address)).to.be.closeTo(
      collateral - expectedReturn, 1n // rounding tolerance
    );
  });

  it('reverts InsufficientDebt if burning more than owed', async () => {
    const { civUsd, alice } = await loadFixture(deployFixture);
    const net = netMint(maxGross(10n * PAS, RATIO_T0));
    await civUsd.connect(alice).mint(net, { value: 10n * PAS });

    await expect(civUsd.connect(alice).burn(net + 1n))
      .to.be.revertedWithCustomError(civUsd, 'InsufficientDebt');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Liquidation
// ─────────────────────────────────────────────────────────────────────────────

describe('CivUSD — liquidation', () => {
  it('position becomes unhealthy after price drop', async () => {
    const { civUsd, alice, admin } = await loadFixture(deployFixture);

    const collateral = 10n * PAS;
    const net = netMint(maxGross(collateral, RATIO_T0));
    await civUsd.connect(alice).mint(net, { value: collateral });

    expect(await civUsd.isHealthy(alice.address)).to.be.true;

    // Drop price by 50%
    await civUsd.connect(admin).updatePrice(PAS_PRICE / 2n);

    expect(await civUsd.isHealthy(alice.address)).to.be.false;
  });

  it('liquidator can liquidate unhealthy position', async () => {
    const { civUsd, alice, liquidator, admin, oracle } = await loadFixture(deployFixture);

    // Mint for alice
    const collateral = 10n * PAS;
    const net = netMint(maxGross(collateral, RATIO_T0));
    await civUsd.connect(alice).mint(net, { value: collateral });

    // Make liquidator a registered identity with CivUSD
    await oracle.setIdentity(liquidator.address, true, 113n);
    const liqCollateral = 100n * PAS;
    const liqNet = netMint(maxGross(liqCollateral, RATIO_T2));
    await civUsd.connect(liquidator).mint(liqNet, { value: liqCollateral });

    // Drop price to make alice's position unhealthy
    await civUsd.connect(admin).updatePrice(PAS_PRICE / 2n);
    expect(await civUsd.isHealthy(alice.address)).to.be.false;

    const liquidatorBalBefore = await ethers.provider.getBalance(liquidator.address);
    const debtBefore = await civUsd.debtOf(alice.address);

    const tx   = await civUsd.connect(liquidator).liquidate(alice.address, debtBefore);
    const rcpt = await tx.wait();
    const gas  = rcpt!.gasUsed * rcpt!.gasPrice;

    const liquidatorBalAfter = await ethers.provider.getBalance(liquidator.address);

    // Liquidator received collateral (net of gas)
    expect(liquidatorBalAfter).to.be.gt(liquidatorBalBefore - gas);
    expect(await civUsd.debtOf(alice.address)).to.equal(0n);

    await expect(tx).to.emit(civUsd, 'Liquidated');
  });

  it('reverts PositionHealthy on healthy position', async () => {
    const { civUsd, alice, liquidator } = await loadFixture(deployFixture);
    const net = netMint(maxGross(10n * PAS, RATIO_T0));
    await civUsd.connect(alice).mint(net, { value: 10n * PAS });

    await expect(civUsd.connect(liquidator).liquidate(alice.address, net))
      .to.be.revertedWithCustomError(civUsd, 'PositionHealthy');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Price oracle
// ─────────────────────────────────────────────────────────────────────────────

describe('CivUSD — price oracle', () => {
  it('admin can update price', async () => {
    const { civUsd, admin } = await loadFixture(deployFixture);
    await expect(civUsd.connect(admin).updatePrice(10_000_000n))
      .to.emit(civUsd, 'PriceUpdated')
      .withArgs(PAS_PRICE, 10_000_000n);
    expect(await civUsd.pasUsdPrice()).to.equal(10_000_000n);
  });

  it('reverts ZeroPrice on zero', async () => {
    const { civUsd, admin } = await loadFixture(deployFixture);
    await expect(civUsd.connect(admin).updatePrice(0n))
      .to.be.revertedWithCustomError(civUsd, 'ZeroPrice');
  });

  it('stranger cannot update price', async () => {
    const { civUsd, stranger } = await loadFixture(deployFixture);
    await expect(civUsd.connect(stranger).updatePrice(1n))
      .to.be.reverted;
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Admin
// ─────────────────────────────────────────────────────────────────────────────

describe('CivUSD — admin', () => {
  it('admin can update mint fee', async () => {
    const { civUsd, admin } = await loadFixture(deployFixture);
    await civUsd.connect(admin).setMintFee(100n);
    expect(await civUsd.mintFeeBps()).to.equal(100n);
  });

  it('reverts if fee exceeds 500 bps (5%)', async () => {
    const { civUsd, admin } = await loadFixture(deployFixture);
    await expect(civUsd.connect(admin).setMintFee(501n))
      .to.be.revertedWithCustomError(civUsd, 'FeeTooHigh');
  });

  it('admin can set trust oracle', async () => {
    const { civUsd, admin } = await loadFixture(deployFixture);
    const MockOracle = await ethers.getContractFactory('MockTrustOracle');
    const newOracle  = await MockOracle.deploy();
    await civUsd.connect(admin).setTrustOracle(await newOracle.getAddress());
    expect(await civUsd.trustOracle()).to.equal(await newOracle.getAddress());
  });

  it('admin can pause and unpause', async () => {
    const { civUsd, admin } = await loadFixture(deployFixture);
    await civUsd.connect(admin).pause();
    expect(await civUsd.paused()).to.be.true;
    await civUsd.connect(admin).unpause();
    expect(await civUsd.paused()).to.be.false;
  });
});
