import { expect }      from 'chai';
import { ethers }      from 'hardhat';
import { loadFixture } from '@nomicfoundation/hardhat-toolbox/network-helpers';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const PAS         = 10_000_000_000n;
const POINTS_HIGH = 5n;

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

  const Task = await ethers.getContractFactory('StakeMilestoneTask');
  const task = await Task.deploy(
    await registry.getAddress(),
    await dispenser.getAddress(),
    admin.address
  );

  await dispenser.connect(admin).grantTaskOracle(await task.getAddress());

  const aliceCommitment = comm('alice-secret');
  await registry.setCommitment(alice.address, aliceCommitment);

  return { admin, alice, bob, stranger, registry, repRegistry, dispenser, task, aliceCommitment };
}

// ─────────────────────────────────────────────────────────────────────────────
// Deployment
// ─────────────────────────────────────────────────────────────────────────────

describe('StakeMilestoneTask — deployment', () => {
  it('stores identityRegistry and dispenser', async () => {
    const { task, registry, dispenser } = await loadFixture(deployFixture);
    expect(await task.identityRegistry()).to.equal(await registry.getAddress());
    expect(await task.dispenser()).to.equal(await dispenser.getAddress());
  });

  it('has 3 milestones at 100, 500, 1000 PAS', async () => {
    const { task } = await loadFixture(deployFixture);
    expect(await task.getMilestoneCount()).to.equal(3n);

    const [t0,,l0] = await task.getMilestone(0);
    const [t1,,l1] = await task.getMilestone(1);
    const [t2,,l2] = await task.getMilestone(2);

    expect(t0).to.equal(100n  * PAS);
    expect(t1).to.equal(500n  * PAS);
    expect(t2).to.equal(1000n * PAS);
    expect(l0).to.equal('100');
    expect(l1).to.equal('500');
    expect(l2).to.equal('1000');
  });

  it('reverts with ZeroAddress if registry is zero', async () => {
    const [admin]   = await ethers.getSigners();
    const MockRep   = await ethers.getContractFactory('MockReputationRegistry');
    const mock      = await MockRep.deploy();
    const Dispenser = await ethers.getContractFactory('TaskRewardDispenser');
    const dispenser = await Dispenser.deploy(await mock.getAddress(), admin.address);
    const Task      = await ethers.getContractFactory('StakeMilestoneTask');
    await expect(
      Task.deploy(ethers.ZeroAddress, await dispenser.getAddress(), admin.address)
    ).to.be.revertedWithCustomError({ interface: Task.interface }, 'ZeroAddress');
  });

  it('reverts with ZeroAddress if dispenser is zero', async () => {
    const [admin]      = await ethers.getSigners();
    const MockRegistry = await ethers.getContractFactory('MockIdentityRegistry');
    const registry     = await MockRegistry.deploy();
    const Task         = await ethers.getContractFactory('StakeMilestoneTask');
    await expect(
      Task.deploy(await registry.getAddress(), ethers.ZeroAddress, admin.address)
    ).to.be.revertedWithCustomError({ interface: Task.interface }, 'ZeroAddress');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// claim — happy paths
// ─────────────────────────────────────────────────────────────────────────────

describe('StakeMilestoneTask — claim happy paths', () => {
  it('claims milestone 0 (100 PAS) at exact threshold', async () => {
    const { task, repRegistry, registry, alice, aliceCommitment } = await loadFixture(deployFixture);
    await registry.setStake(alice.address, 100n * PAS);

    await expect(task.connect(alice).claim(0))
      .to.emit(task, 'StakeMilestoneClaimed')
      .withArgs(alice.address, aliceCommitment, 0n, 100n * PAS, 100n * PAS);

    expect(await repRegistry.globalReputation(aliceCommitment)).to.equal(POINTS_HIGH);
  });

  it('claims milestone 1 (500 PAS)', async () => {
    const { task, repRegistry, registry, alice, aliceCommitment } = await loadFixture(deployFixture);
    await registry.setStake(alice.address, 500n * PAS);

    await task.connect(alice).claim(1);
    expect(await repRegistry.globalReputation(aliceCommitment)).to.equal(POINTS_HIGH);
  });

  it('claims milestone 2 (1000 PAS)', async () => {
    const { task, repRegistry, registry, alice, aliceCommitment } = await loadFixture(deployFixture);
    await registry.setStake(alice.address, 1000n * PAS);

    await task.connect(alice).claim(2);
    expect(await repRegistry.globalReputation(aliceCommitment)).to.equal(POINTS_HIGH);
  });

  it('can claim milestones 0 and 1 independently', async () => {
    const { task, repRegistry, registry, alice, aliceCommitment } = await loadFixture(deployFixture);
    await registry.setStake(alice.address, 500n * PAS);

    await task.connect(alice).claim(0);
    await task.connect(alice).claim(1);

    expect(await repRegistry.globalReputation(aliceCommitment)).to.equal(POINTS_HIGH * 2n);
  });

  it('awards 3 pts when rep >= 50', async () => {
    const { task, repRegistry, registry, alice, aliceCommitment } = await loadFixture(deployFixture);
    await registry.setStake(alice.address, 100n * PAS);
    await repRegistry.setReputation(aliceCommitment, 50n);

    await task.connect(alice).claim(0);
    expect(await repRegistry.globalReputation(aliceCommitment)).to.equal(53n);
  });

  it('claimAll claims all 3 milestones at 1000 PAS', async () => {
    const { task, repRegistry, registry, alice, aliceCommitment } = await loadFixture(deployFixture);
    await registry.setStake(alice.address, 1000n * PAS);

    await task.connect(alice).claimAll();
    expect(await repRegistry.globalReputation(aliceCommitment)).to.equal(POINTS_HIGH * 3n);
  });

  it('claimAll stops at first ineligible milestone', async () => {
    const { task, repRegistry, registry, alice, aliceCommitment } = await loadFixture(deployFixture);
    await registry.setStake(alice.address, 100n * PAS);

    await task.connect(alice).claimAll();
    expect(await repRegistry.globalReputation(aliceCommitment)).to.equal(POINTS_HIGH);
  });

  it('claimAll skips already-claimed milestones silently', async () => {
    const { task, repRegistry, registry, alice, aliceCommitment } = await loadFixture(deployFixture);
    await registry.setStake(alice.address, 1000n * PAS);

    await task.connect(alice).claimAll();
    const repAfter = await repRegistry.globalReputation(aliceCommitment);

    await task.connect(alice).claimAll();
    expect(await repRegistry.globalReputation(aliceCommitment)).to.equal(repAfter);
  });

  it('eligibleMilestones returns correct flags for 500 PAS', async () => {
    const { task, registry, alice } = await loadFixture(deployFixture);
    await registry.setStake(alice.address, 500n * PAS);

    const eligible = await task.eligibleMilestones(alice.address);
    expect(eligible[0]).to.be.true;
    expect(eligible[1]).to.be.true;
    expect(eligible[2]).to.be.false;
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// claim — revert paths
// ─────────────────────────────────────────────────────────────────────────────

describe('StakeMilestoneTask — claim revert paths', () => {
  it('reverts NotRegistered for unregistered wallet', async () => {
    const { task, stranger } = await loadFixture(deployFixture);
    await expect(
      task.connect(stranger).claim(0)
    ).to.be.revertedWithCustomError(task, 'NotRegistered')
     .withArgs(stranger.address);
  });

  it('reverts StakeBelowThreshold when stake is insufficient', async () => {
    const { task, registry, alice } = await loadFixture(deployFixture);
    await registry.setStake(alice.address, 50n * PAS);

    await expect(
      task.connect(alice).claim(0)
    ).to.be.revertedWithCustomError(task, 'StakeBelowThreshold')
     .withArgs(50n * PAS, 100n * PAS);
  });

  it('reverts InvalidMilestoneIndex for out-of-range index', async () => {
    const { task, alice } = await loadFixture(deployFixture);
    await expect(
      task.connect(alice).claim(99)
    ).to.be.revertedWithCustomError(task, 'InvalidMilestoneIndex');
  });

  it('reverts AlreadyClaimed on double claim', async () => {
    const { task, dispenser, registry, alice } = await loadFixture(deployFixture);
    await registry.setStake(alice.address, 100n * PAS);

    await task.connect(alice).claim(0);
    await expect(
      task.connect(alice).claim(0)
    ).to.be.revertedWithCustomError(dispenser, 'AlreadyClaimed');
  });

  it('cannot re-claim after withdrawing and re-staking', async () => {
    const { task, dispenser, registry, alice } = await loadFixture(deployFixture);
    await registry.setStake(alice.address, 100n * PAS);
    await task.connect(alice).claim(0);

    await registry.setStake(alice.address, 0n);
    await registry.setStake(alice.address, 100n * PAS);

    await expect(
      task.connect(alice).claim(0)
    ).to.be.revertedWithCustomError(dispenser, 'AlreadyClaimed');
  });

  it('reverts EnforcedPause when paused', async () => {
    const { task, registry, alice, admin } = await loadFixture(deployFixture);
    await registry.setStake(alice.address, 100n * PAS);
    await task.connect(admin).pause();

    await expect(
      task.connect(alice).claim(0)
    ).to.be.revertedWithCustomError(task, 'EnforcedPause');
  });

  it('claimAll reverts NotRegistered for unregistered wallet', async () => {
    const { task, stranger } = await loadFixture(deployFixture);
    await expect(
      task.connect(stranger).claimAll()
    ).to.be.revertedWithCustomError(task, 'NotRegistered');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Admin
// ─────────────────────────────────────────────────────────────────────────────

describe('StakeMilestoneTask — admin', () => {
  it('owner can update identityRegistry', async () => {
    const { task, admin } = await loadFixture(deployFixture);
    const MockRegistry    = await ethers.getContractFactory('MockIdentityRegistry');
    const newRegistry     = await MockRegistry.deploy();
    await task.connect(admin).setIdentityRegistry(await newRegistry.getAddress());
    expect(await task.identityRegistry()).to.equal(await newRegistry.getAddress());
  });

  it('owner can update dispenser', async () => {
    const { task, admin, repRegistry } = await loadFixture(deployFixture);
    const Dispenser    = await ethers.getContractFactory('TaskRewardDispenser');
    const newDispenser = await Dispenser.deploy(await repRegistry.getAddress(), admin.address);
    await task.connect(admin).setDispenser(await newDispenser.getAddress());
    expect(await task.dispenser()).to.equal(await newDispenser.getAddress());
  });

  it('setIdentityRegistry reverts on zero address', async () => {
    const { task, admin } = await loadFixture(deployFixture);
    await expect(
      task.connect(admin).setIdentityRegistry(ethers.ZeroAddress)
    ).to.be.revertedWithCustomError(task, 'ZeroAddress');
  });

  it('setDispenser reverts on zero address', async () => {
    const { task, admin } = await loadFixture(deployFixture);
    await expect(
      task.connect(admin).setDispenser(ethers.ZeroAddress)
    ).to.be.revertedWithCustomError(task, 'ZeroAddress');
  });

  it('stranger cannot update identityRegistry', async () => {
    const { task, stranger } = await loadFixture(deployFixture);
    const MockRegistry       = await ethers.getContractFactory('MockIdentityRegistry');
    const newRegistry        = await MockRegistry.deploy();
    await expect(
      task.connect(stranger).setIdentityRegistry(await newRegistry.getAddress())
    ).to.be.revertedWithCustomError(task, 'OwnableUnauthorizedAccount');
  });

  it('owner can pause and unpause', async () => {
    const { task, admin } = await loadFixture(deployFixture);
    await task.connect(admin).pause();
    expect(await task.paused()).to.be.true;
    await task.connect(admin).unpause();
    expect(await task.paused()).to.be.false;
  });

  it('stranger cannot pause', async () => {
    const { task, stranger } = await loadFixture(deployFixture);
    await expect(
      task.connect(stranger).pause()
    ).to.be.revertedWithCustomError(task, 'OwnableUnauthorizedAccount');
  });
});
