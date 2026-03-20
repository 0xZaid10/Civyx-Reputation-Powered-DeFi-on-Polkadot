import { expect }      from 'chai';
import { ethers }      from 'hardhat';
import { loadFixture } from '@nomicfoundation/hardhat-toolbox/network-helpers';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const POINTS_HIGH = 5n;
const TASK_ID     = ethers.keccak256(ethers.toUtf8Bytes('civyx:task:register_identity'));
const comm        = (s: string) => ethers.keccak256(ethers.toUtf8Bytes(s));

// ─────────────────────────────────────────────────────────────────────────────
// Fixture
// ─────────────────────────────────────────────────────────────────────────────

async function deployFixture() {
  const [admin, alice, bob, stranger] = await ethers.getSigners();

  // Mock registry — controls verifyIdentity and getCommitment
  const MockRegistry = await ethers.getContractFactory('MockIdentityRegistry');
  const registry     = await MockRegistry.deploy();

  // Mock reputation registry
  const MockRep     = await ethers.getContractFactory('MockReputationRegistry');
  const repRegistry = await MockRep.deploy();

  // Real dispenser
  const Dispenser = await ethers.getContractFactory('TaskRewardDispenser');
  const dispenser = await Dispenser.deploy(
    await repRegistry.getAddress(),
    admin.address
  );
  await repRegistry.grantUpdater(await dispenser.getAddress());

  // RegisterIdentityTask
  const Task     = await ethers.getContractFactory('RegisterIdentityTask');
  const task     = await Task.deploy(
    await registry.getAddress(),
    await dispenser.getAddress(),
    admin.address
  );

  // Grant TASK_ORACLE to the task contract
  await dispenser.connect(admin).grantTaskOracle(await task.getAddress());

  // Register alice in the mock registry
  const aliceCommitment = comm('alice-secret');
  await registry.setCommitment(alice.address, aliceCommitment);
  

  return { admin, alice, bob, stranger, registry, repRegistry, dispenser, task, aliceCommitment };
}

// ─────────────────────────────────────────────────────────────────────────────
// Deployment
// ─────────────────────────────────────────────────────────────────────────────

describe('RegisterIdentityTask — deployment', () => {
  it('stores identityRegistry and dispenser addresses', async () => {
    const { task, registry, dispenser } = await loadFixture(deployFixture);
    expect(await task.identityRegistry()).to.equal(await registry.getAddress());
    expect(await task.dispenser()).to.equal(await dispenser.getAddress());
  });

  it('TASK_ID is keccak256("civyx:task:register_identity")', async () => {
    const { task } = await loadFixture(deployFixture);
    expect(await task.TASK_ID()).to.equal(TASK_ID);
  });

  it('reverts with ZeroAddress if registry is zero', async () => {
    const [admin] = await ethers.getSigners();
    const MockRep   = await ethers.getContractFactory('MockReputationRegistry');
    const mock      = await MockRep.deploy();
    const Dispenser = await ethers.getContractFactory('TaskRewardDispenser');
    const dispenser = await Dispenser.deploy(await mock.getAddress(), admin.address);
    const Task      = await ethers.getContractFactory('RegisterIdentityTask');
    await expect(
      Task.deploy(ethers.ZeroAddress, await dispenser.getAddress(), admin.address)
    ).to.be.revertedWithCustomError({ interface: Task.interface }, 'ZeroAddress');
  });

  it('reverts with ZeroAddress if dispenser is zero', async () => {
    const [admin]      = await ethers.getSigners();
    const MockRegistry = await ethers.getContractFactory('MockIdentityRegistry');
    const registry     = await MockRegistry.deploy();
    const Task         = await ethers.getContractFactory('RegisterIdentityTask');
    await expect(
      Task.deploy(await registry.getAddress(), ethers.ZeroAddress, admin.address)
    ).to.be.revertedWithCustomError({ interface: Task.interface }, 'ZeroAddress');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// claim — happy paths
// ─────────────────────────────────────────────────────────────────────────────

describe('RegisterIdentityTask — claim happy paths', () => {
  it('emits RegisterIdentityTaskClaimed with correct args', async () => {
    const { task, alice, aliceCommitment } = await loadFixture(deployFixture);
    await expect(task.connect(alice).claim())
      .to.emit(task, 'RegisterIdentityTaskClaimed')
      .withArgs(alice.address, aliceCommitment);
  });

  it('awards 5 pts on ReputationRegistry', async () => {
    const { task, repRegistry, alice, aliceCommitment } = await loadFixture(deployFixture);
    await task.connect(alice).claim();
    expect(await repRegistry.globalReputation(aliceCommitment)).to.equal(POINTS_HIGH);
  });

  it('marks (commitment, TASK_ID) as claimed in dispenser', async () => {
    const { task, dispenser, alice, aliceCommitment } = await loadFixture(deployFixture);
    expect(await dispenser.hasClaimed(aliceCommitment, TASK_ID)).to.be.false;
    await task.connect(alice).claim();
    expect(await dispenser.hasClaimed(aliceCommitment, TASK_ID)).to.be.true;
  });

  it('different wallets with different commitments can both claim', async () => {
    const { task, registry, repRegistry, alice, bob } = await loadFixture(deployFixture);

    const bobCommitment = comm('bob-secret');
    await registry.setCommitment(bob.address, bobCommitment);
    

    await task.connect(alice).claim();
    await task.connect(bob).claim();

    expect(await repRegistry.globalReputation(comm('alice-secret'))).to.equal(POINTS_HIGH);
    expect(await repRegistry.globalReputation(bobCommitment)).to.equal(POINTS_HIGH);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// claim — revert paths
// ─────────────────────────────────────────────────────────────────────────────

describe('RegisterIdentityTask — claim revert paths', () => {
  it('reverts with NotRegistered for unregistered wallet', async () => {
    const { task, stranger } = await loadFixture(deployFixture);
    await expect(
      task.connect(stranger).claim()
    ).to.be.revertedWithCustomError(task, 'NotRegistered')
     .withArgs(stranger.address);
  });

  it('reverts with NotRegistered if identity is deactivated', async () => {
    const { task, registry, alice } = await loadFixture(deployFixture);
    await registry.deactivate(alice.address);
    await expect(
      task.connect(alice).claim()
    ).to.be.revertedWithCustomError(task, 'NotRegistered');
  });

  it('reverts with AlreadyClaimed on double claim', async () => {
    const { task, dispenser, alice } = await loadFixture(deployFixture);
    await task.connect(alice).claim();
    await expect(
      task.connect(alice).claim()
    ).to.be.revertedWithCustomError(dispenser, 'AlreadyClaimed');
  });

  it('reverts when paused', async () => {
    const { task, alice, admin } = await loadFixture(deployFixture);
    await task.connect(admin).pause();
    await expect(
      task.connect(alice).claim()
    ).to.be.revertedWithCustomError(task, 'EnforcedPause');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Admin
// ─────────────────────────────────────────────────────────────────────────────

describe('RegisterIdentityTask — admin', () => {
  it('owner can update identityRegistry', async () => {
    const { task, admin } = await loadFixture(deployFixture);
    const MockRegistry    = await ethers.getContractFactory('MockIdentityRegistry');
    const newRegistry     = await MockRegistry.deploy();
    await task.connect(admin).setIdentityRegistry(await newRegistry.getAddress());
    expect(await task.identityRegistry()).to.equal(await newRegistry.getAddress());
  });

  it('owner can update dispenser', async () => {
    const { task, admin, repRegistry } = await loadFixture(deployFixture);
    const Dispenser   = await ethers.getContractFactory('TaskRewardDispenser');
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
