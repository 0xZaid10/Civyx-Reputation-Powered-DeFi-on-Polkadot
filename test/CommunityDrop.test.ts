import { expect }      from 'chai';
import { ethers }      from 'hardhat';
import { loadFixture } from '@nomicfoundation/hardhat-toolbox/network-helpers';

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const PAS          = 10_000_000_000n;   // 1 PAS in planck
const CLAIM_AMOUNT = 50n * PAS;         // 50 PAS per claim
const POINTS_HIGH  = 5n;
const POINTS_LOW   = 3n;

const comm = (s: string) => ethers.keccak256(ethers.toUtf8Bytes(s));

// ─────────────────────────────────────────────────────────────────────────────
// Fixture
// ─────────────────────────────────────────────────────────────────────────────

async function deployFixture() {
  const [admin, alice, bob, stranger] = await ethers.getSigners();

  const MockRegistry = await ethers.getContractFactory('MockIdentityRegistry');
  const registry     = await MockRegistry.deploy();

  const MockRep     = await ethers.getContractFactory('MockReputationRegistry');
  const repRegistry = await MockRep.deploy();

  const Dispenser = await ethers.getContractFactory('TaskRewardDispenser');
  const dispenser = await Dispenser.deploy(
    await repRegistry.getAddress(),
    admin.address
  );
  await repRegistry.grantUpdater(await dispenser.getAddress());

  const Drop = await ethers.getContractFactory('CommunityDrop');
  const drop = await Drop.deploy(
    await registry.getAddress(),
    await dispenser.getAddress(),
    CLAIM_AMOUNT,
    admin.address
  );

  // Grant TASK_ORACLE to the drop contract
  await dispenser.connect(admin).grantTaskOracle(await drop.getAddress());

  // Register alice
  const aliceCommitment = comm('alice-secret');
  await registry.setCommitment(alice.address, aliceCommitment);

  // Fund the contract with 500 PAS
  await admin.sendTransaction({ to: await drop.getAddress(), value: 500n * PAS });

  return { admin, alice, bob, stranger, registry, repRegistry, dispenser, drop, aliceCommitment };
}

// ─────────────────────────────────────────────────────────────────────────────
// Deployment
// ─────────────────────────────────────────────────────────────────────────────

describe('CommunityDrop — deployment', () => {
  it('stores addresses and claimAmount', async () => {
    const { drop, registry, dispenser } = await loadFixture(deployFixture);
    expect(await drop.identityRegistry()).to.equal(await registry.getAddress());
    expect(await drop.dispenser()).to.equal(await dispenser.getAddress());
    expect(await drop.claimAmount()).to.equal(CLAIM_AMOUNT);
  });

  it('holds the funded PAS balance', async () => {
    const { drop } = await loadFixture(deployFixture);
    expect(await drop.contractBalance()).to.equal(500n * PAS);
  });

  it('remainingClaims reflects balance / claimAmount', async () => {
    const { drop } = await loadFixture(deployFixture);
    expect(await drop.remainingClaims()).to.equal(10n); // 500 / 50
  });

  it('TASK_ID matches expected value', async () => {
    const { drop } = await loadFixture(deployFixture);
    const expected = ethers.keccak256(ethers.toUtf8Bytes('civyx:task:community_drop:genesis'));
    expect(await drop.TASK_ID()).to.equal(expected);
  });

  it('reverts ZeroAddress on zero registry', async () => {
    const [admin] = await ethers.getSigners();
    const MockRep = await ethers.getContractFactory('MockReputationRegistry');
    const rep     = await MockRep.deploy();
    const Disp    = await ethers.getContractFactory('TaskRewardDispenser');
    const disp    = await Disp.deploy(await rep.getAddress(), admin.address);
    const Drop    = await ethers.getContractFactory('CommunityDrop');
    await expect(
      Drop.deploy(ethers.ZeroAddress, await disp.getAddress(), CLAIM_AMOUNT, admin.address)
    ).to.be.revertedWithCustomError({ interface: Drop.interface }, 'ZeroAddress');
  });

  it('reverts ZeroAmount on zero claimAmount', async () => {
    const [admin]      = await ethers.getSigners();
    const MockRegistry = await ethers.getContractFactory('MockIdentityRegistry');
    const reg          = await MockRegistry.deploy();
    const MockRep      = await ethers.getContractFactory('MockReputationRegistry');
    const rep          = await MockRep.deploy();
    const Disp         = await ethers.getContractFactory('TaskRewardDispenser');
    const disp         = await Disp.deploy(await rep.getAddress(), admin.address);
    const Drop         = await ethers.getContractFactory('CommunityDrop');
    await expect(
      Drop.deploy(await reg.getAddress(), await disp.getAddress(), 0n, admin.address)
    ).to.be.revertedWithCustomError({ interface: Drop.interface }, 'ZeroAmount');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// claim — happy paths
// ─────────────────────────────────────────────────────────────────────────────

describe('CommunityDrop — claim happy paths', () => {
  it('sends PAS to claimer', async () => {
    const { drop, alice } = await loadFixture(deployFixture);

    const balBefore = await ethers.provider.getBalance(alice.address);
    const tx        = await drop.connect(alice).claim();
    const receipt   = await tx.wait();
    const gasUsed   = receipt!.gasUsed * receipt!.gasPrice;
    const balAfter  = await ethers.provider.getBalance(alice.address);

    expect(balAfter).to.equal(balBefore + CLAIM_AMOUNT - gasUsed);
  });

  it('awards 5 pts when rep is 0', async () => {
    const { drop, repRegistry, alice, aliceCommitment } = await loadFixture(deployFixture);
    await drop.connect(alice).claim();
    expect(await repRegistry.globalReputation(aliceCommitment)).to.equal(POINTS_HIGH);
  });

  it('awards 3 pts when rep >= 50', async () => {
    const { drop, repRegistry, alice, aliceCommitment } = await loadFixture(deployFixture);
    await repRegistry.setReputation(aliceCommitment, 50n);
    await drop.connect(alice).claim();
    expect(await repRegistry.globalReputation(aliceCommitment)).to.equal(53n);
  });

  it('emits Claimed event with correct args', async () => {
    const { drop, alice, aliceCommitment } = await loadFixture(deployFixture);
    await expect(drop.connect(alice).claim())
      .to.emit(drop, 'Claimed')
      .withArgs(alice.address, aliceCommitment, CLAIM_AMOUNT);
  });

  it('increments totalClaims', async () => {
    const { drop, registry, alice, bob } = await loadFixture(deployFixture);
    await drop.connect(alice).claim();

    const bobCommitment = comm('bob-secret');
    await registry.setCommitment(bob.address, bobCommitment);
    await drop.connect(bob).claim();

    expect(await drop.totalClaims()).to.equal(2n);
  });

  it('reduces contractBalance by claimAmount', async () => {
    const { drop, alice } = await loadFixture(deployFixture);
    const before = await drop.contractBalance();
    await drop.connect(alice).claim();
    expect(await drop.contractBalance()).to.equal(before - CLAIM_AMOUNT);
  });

  it('reduces remainingClaims by 1', async () => {
    const { drop, alice } = await loadFixture(deployFixture);
    const before = await drop.remainingClaims();
    await drop.connect(alice).claim();
    expect(await drop.remainingClaims()).to.equal(before - 1n);
  });

  it('multiple different identities can each claim', async () => {
    const { drop, registry, alice, bob } = await loadFixture(deployFixture);
    const bobCommitment = comm('bob-secret');
    await registry.setCommitment(bob.address, bobCommitment);

    await drop.connect(alice).claim();
    await drop.connect(bob).claim();

    expect(await drop.totalClaims()).to.equal(2n);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// claim — revert paths
// ─────────────────────────────────────────────────────────────────────────────

describe('CommunityDrop — claim revert paths', () => {
  it('reverts NotRegistered for unregistered wallet', async () => {
    const { drop, stranger } = await loadFixture(deployFixture);
    await expect(
      drop.connect(stranger).claim()
    ).to.be.revertedWithCustomError(drop, 'NotRegistered')
     .withArgs(stranger.address);
  });

  it('reverts AlreadyClaimed on double claim', async () => {
    const { drop, dispenser, alice } = await loadFixture(deployFixture);
    await drop.connect(alice).claim();
    await expect(
      drop.connect(alice).claim()
    ).to.be.revertedWithCustomError(dispenser, 'AlreadyClaimed');
  });

  it('reverts InsufficientContractBalance when contract is empty', async () => {
    const { drop, registry, dispenser, admin, repRegistry } = await loadFixture(deployFixture);

    // Deploy a fresh unfunded drop
    const Drop2 = await ethers.getContractFactory('CommunityDrop');
    const drop2 = await Drop2.deploy(
      await registry.getAddress(),
      await dispenser.getAddress(),
      CLAIM_AMOUNT,
      admin.address
    );
    await dispenser.connect(admin).grantTaskOracle(await drop2.getAddress());

    const [,, charlie] = await ethers.getSigners();
    await registry.setCommitment(charlie.address, comm('charlie-secret'));

    await expect(
      drop2.connect(charlie).claim()
    ).to.be.revertedWithCustomError(drop2, 'InsufficientContractBalance');
  });

  it('reverts when paused', async () => {
    const { drop, alice, admin } = await loadFixture(deployFixture);
    await drop.connect(admin).pause();
    await expect(
      drop.connect(alice).claim()
    ).to.be.revertedWithCustomError(drop, 'EnforcedPause');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Admin
// ─────────────────────────────────────────────────────────────────────────────

describe('CommunityDrop — admin', () => {
  it('owner can update claimAmount', async () => {
    const { drop, admin } = await loadFixture(deployFixture);
    await expect(drop.connect(admin).setClaimAmount(100n * PAS))
      .to.emit(drop, 'ClaimAmountUpdated')
      .withArgs(CLAIM_AMOUNT, 100n * PAS);
    expect(await drop.claimAmount()).to.equal(100n * PAS);
  });

  it('setClaimAmount reverts on zero', async () => {
    const { drop, admin } = await loadFixture(deployFixture);
    await expect(
      drop.connect(admin).setClaimAmount(0n)
    ).to.be.revertedWithCustomError(drop, 'ZeroAmount');
  });

  it('owner can withdraw PAS', async () => {
    const { drop, admin } = await loadFixture(deployFixture);
    const before = await ethers.provider.getBalance(admin.address);
    const tx     = await drop.connect(admin).withdraw(100n * PAS, admin.address);
    const rcpt   = await tx.wait();
    const gas    = rcpt!.gasUsed * rcpt!.gasPrice;
    const after  = await ethers.provider.getBalance(admin.address);
    expect(after).to.equal(before + 100n * PAS - gas);
  });

  it('stranger cannot withdraw', async () => {
    const { drop, stranger } = await loadFixture(deployFixture);
    await expect(
      drop.connect(stranger).withdraw(1n, stranger.address)
    ).to.be.revertedWithCustomError(drop, 'OwnableUnauthorizedAccount');
  });

  it('owner can pause and unpause', async () => {
    const { drop, admin } = await loadFixture(deployFixture);
    await drop.connect(admin).pause();
    expect(await drop.paused()).to.be.true;
    await drop.connect(admin).unpause();
    expect(await drop.paused()).to.be.false;
  });

  it('contract receives PAS via receive()', async () => {
    const { drop, admin } = await loadFixture(deployFixture);
    const before = await drop.contractBalance();
    await admin.sendTransaction({ to: await drop.getAddress(), value: 10n * PAS });
    expect(await drop.contractBalance()).to.equal(before + 10n * PAS);
  });
});
