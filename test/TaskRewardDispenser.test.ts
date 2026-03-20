import { expect }      from 'chai';
import { ethers }      from 'hardhat';
import { loadFixture } from '@nomicfoundation/hardhat-toolbox/network-helpers';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const THRESHOLD   = 50n;
const POINTS_HIGH = 5n;
const POINTS_LOW  = 3n;

const TASK_ORACLE_ROLE = ethers.keccak256(ethers.toUtf8Bytes('TASK_ORACLE'));
const PAUSER_ROLE      = ethers.keccak256(ethers.toUtf8Bytes('PAUSER_ROLE'));

// Produce a deterministic bytes32 from a plain string — mirrors how
// commitments and taskIds will be generated in production.
const comm = (s: string) => ethers.keccak256(ethers.toUtf8Bytes(s));
const tid  = (s: string) => ethers.keccak256(ethers.toUtf8Bytes(s));

// ─────────────────────────────────────────────────────────────────────────────
// Fixture
// ─────────────────────────────────────────────────────────────────────────────

async function deployFixture() {
  // signers[0] = deployer / admin
  // signers[1] = oracle (stands in for a task contract)
  // signers[2] = alice
  // signers[3] = bob
  // signers[4] = stranger (no roles)
  const [admin, oracle, alice, bob, stranger] = await ethers.getSigners();

  const MockRep     = await ethers.getContractFactory('MockReputationRegistry');
  const repRegistry = await MockRep.deploy();

  const Dispenser = await ethers.getContractFactory('TaskRewardDispenser');
  const dispenser = await Dispenser.deploy(
    await repRegistry.getAddress(),
    admin.address
  );

  // Wire up: give dispenser write access on the mock registry
  await repRegistry.grantUpdater(await dispenser.getAddress());

  // Give oracle the TASK_ORACLE role so it can call awardTask()
  await dispenser.connect(admin).grantTaskOracle(oracle.address);

  return { admin, oracle, alice, bob, stranger, repRegistry, dispenser };
}

// ─────────────────────────────────────────────────────────────────────────────
// Deployment
// ─────────────────────────────────────────────────────────────────────────────

describe('TaskRewardDispenser — deployment', () => {
  it('stores the reputationRegistry address', async () => {
    const { dispenser, repRegistry } = await loadFixture(deployFixture);
    expect(await dispenser.reputationRegistry())
      .to.equal(await repRegistry.getAddress());
  });

  it('grants admin DEFAULT_ADMIN_ROLE and PAUSER_ROLE', async () => {
    const { dispenser, admin } = await loadFixture(deployFixture);
    expect(await dispenser.hasRole(await dispenser.DEFAULT_ADMIN_ROLE(), admin.address)).to.be.true;
    expect(await dispenser.hasRole(PAUSER_ROLE, admin.address)).to.be.true;
  });

  it('oracle has TASK_ORACLE after grantTaskOracle', async () => {
    const { dispenser, oracle } = await loadFixture(deployFixture);
    expect(await dispenser.hasRole(TASK_ORACLE_ROLE, oracle.address)).to.be.true;
  });

  it('constants are correct', async () => {
    const { dispenser } = await loadFixture(deployFixture);
    expect(await dispenser.THRESHOLD()).to.equal(THRESHOLD);
    expect(await dispenser.POINTS_HIGH()).to.equal(POINTS_HIGH);
    expect(await dispenser.POINTS_LOW()).to.equal(POINTS_LOW);
  });

  it('reverts with ZeroAddress if registry is zero', async () => {
    const [admin] = await ethers.getSigners();
    const Dispenser = await ethers.getContractFactory('TaskRewardDispenser');
    await expect(
      Dispenser.deploy(ethers.ZeroAddress, admin.address)
    ).to.be.revertedWithCustomError({ interface: Dispenser.interface }, 'ZeroAddress');
  });

  it('reverts with ZeroAddress if admin is zero', async () => {
    const MockRep = await ethers.getContractFactory('MockReputationRegistry');
    const mock    = await MockRep.deploy();
    const Dispenser = await ethers.getContractFactory('TaskRewardDispenser');
    await expect(
      Dispenser.deploy(await mock.getAddress(), ethers.ZeroAddress)
    ).to.be.revertedWithCustomError({ interface: Dispenser.interface }, 'ZeroAddress');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// awardTask — happy paths
// ─────────────────────────────────────────────────────────────────────────────

describe('TaskRewardDispenser — awardTask happy paths', () => {
  it('awards 5 pts and emits TaskRewarded when rep is 0', async () => {
    const { dispenser, repRegistry, oracle } = await loadFixture(deployFixture);
    const commitment = comm('alice');
    const taskId     = tid('civyx:task:register_identity');

    await expect(dispenser.connect(oracle).awardTask(commitment, taskId))
      .to.emit(dispenser, 'TaskRewarded')
      .withArgs(commitment, taskId, POINTS_HIGH, POINTS_HIGH, oracle.address);

    expect(await repRegistry.globalReputation(commitment)).to.equal(POINTS_HIGH);
  });

  it('awards 5 pts when rep is 49 (one below threshold)', async () => {
    const { dispenser, repRegistry, oracle } = await loadFixture(deployFixture);
    const commitment = comm('bob');
    await repRegistry.setReputation(commitment, 49n);

    await dispenser.connect(oracle).awardTask(commitment, tid('t:1'));
    expect(await repRegistry.globalReputation(commitment)).to.equal(54n);
  });

  it('awards 3 pts when rep is exactly 50 (at threshold)', async () => {
    const { dispenser, repRegistry, oracle } = await loadFixture(deployFixture);
    const commitment = comm('charlie');
    await repRegistry.setReputation(commitment, THRESHOLD);

    await expect(dispenser.connect(oracle).awardTask(commitment, tid('t:1')))
      .to.emit(dispenser, 'TaskRewarded')
      .withArgs(commitment, tid('t:1'), POINTS_LOW, THRESHOLD + POINTS_LOW, oracle.address);
  });

  it('awards 3 pts when rep is well above threshold', async () => {
    const { dispenser, repRegistry, oracle } = await loadFixture(deployFixture);
    const commitment = comm('dave');
    await repRegistry.setReputation(commitment, 500n);

    await dispenser.connect(oracle).awardTask(commitment, tid('t:1'));
    expect(await repRegistry.globalReputation(commitment)).to.equal(503n);
  });

  it('transitions from 5 pts to 3 pts exactly at the 50-point boundary', async () => {
    const { dispenser, repRegistry, oracle } = await loadFixture(deployFixture);
    const commitment = comm('curve-test');

    // 10 × 5 = 50 — should all be POINTS_HIGH
    for (let i = 0; i < 10; i++) {
      await dispenser.connect(oracle).awardTask(commitment, tid(`t:${i}`));
    }
    expect(await repRegistry.globalReputation(commitment)).to.equal(50n);

    // 11th task — should now be POINTS_LOW
    await expect(dispenser.connect(oracle).awardTask(commitment, tid('t:10')))
      .to.emit(dispenser, 'TaskRewarded')
      .withArgs(commitment, tid('t:10'), POINTS_LOW, 53n, oracle.address);
  });

  it('same commitment can claim multiple different taskIds', async () => {
    const { dispenser, repRegistry, oracle } = await loadFixture(deployFixture);
    const commitment = comm('multi');

    await dispenser.connect(oracle).awardTask(commitment, tid('t:1'));
    await dispenser.connect(oracle).awardTask(commitment, tid('t:2'));
    await dispenser.connect(oracle).awardTask(commitment, tid('t:3'));

    // 3 × 5 = 15
    expect(await repRegistry.globalReputation(commitment)).to.equal(15n);
  });

  it('different commitments can each claim the same taskId', async () => {
    const { dispenser, repRegistry, oracle } = await loadFixture(deployFixture);
    const taskId = tid('civyx:task:register_identity');

    await dispenser.connect(oracle).awardTask(comm('user:1'), taskId);
    await dispenser.connect(oracle).awardTask(comm('user:2'), taskId);
    await dispenser.connect(oracle).awardTask(comm('user:3'), taskId);

    expect(await repRegistry.globalReputation(comm('user:1'))).to.equal(POINTS_HIGH);
    expect(await repRegistry.globalReputation(comm('user:2'))).to.equal(POINTS_HIGH);
    expect(await repRegistry.globalReputation(comm('user:3'))).to.equal(POINTS_HIGH);
  });

  it('increments totalTasksCompleted correctly', async () => {
    const { dispenser, oracle } = await loadFixture(deployFixture);

    await dispenser.connect(oracle).awardTask(comm('a'), tid('t:1'));
    await dispenser.connect(oracle).awardTask(comm('a'), tid('t:2'));
    await dispenser.connect(oracle).awardTask(comm('b'), tid('t:1'));

    expect(await dispenser.totalTasksCompleted()).to.equal(3n);
  });

  it('increments tasksCompletedBy per commitment', async () => {
    const { dispenser, oracle } = await loadFixture(deployFixture);
    const c1 = comm('c1');
    const c2 = comm('c2');

    await dispenser.connect(oracle).awardTask(c1, tid('t:1'));
    await dispenser.connect(oracle).awardTask(c1, tid('t:2'));
    await dispenser.connect(oracle).awardTask(c2, tid('t:1'));

    expect(await dispenser.tasksCompletedBy(c1)).to.equal(2n);
    expect(await dispenser.tasksCompletedBy(c2)).to.equal(1n);
  });

  it('hasClaimed returns false before and true after', async () => {
    const { dispenser, oracle } = await loadFixture(deployFixture);
    const commitment = comm('x');
    const taskId     = tid('t:1');

    expect(await dispenser.hasClaimed(commitment, taskId)).to.be.false;
    await dispenser.connect(oracle).awardTask(commitment, taskId);
    expect(await dispenser.hasClaimed(commitment, taskId)).to.be.true;
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// awardTask — revert paths
// ─────────────────────────────────────────────────────────────────────────────

describe('TaskRewardDispenser — awardTask revert paths', () => {
  it('reverts if caller lacks TASK_ORACLE', async () => {
    const { dispenser, stranger } = await loadFixture(deployFixture);
    await expect(
      dispenser.connect(stranger).awardTask(comm('x'), tid('t'))
    ).to.be.reverted;
  });

  it('reverts on zero commitment', async () => {
    const { dispenser, oracle } = await loadFixture(deployFixture);
    await expect(
      dispenser.connect(oracle).awardTask(ethers.ZeroHash, tid('t'))
    ).to.be.revertedWithCustomError(dispenser, 'ZeroCommitment');
  });

  it('reverts on zero taskId', async () => {
    const { dispenser, oracle } = await loadFixture(deployFixture);
    await expect(
      dispenser.connect(oracle).awardTask(comm('x'), ethers.ZeroHash)
    ).to.be.revertedWithCustomError(dispenser, 'ZeroTaskId');
  });

  it('reverts on double claim with AlreadyClaimed error', async () => {
    const { dispenser, oracle } = await loadFixture(deployFixture);
    const commitment = comm('alice');
    const taskId     = tid('t:once');

    await dispenser.connect(oracle).awardTask(commitment, taskId);

    await expect(
      dispenser.connect(oracle).awardTask(commitment, taskId)
    ).to.be.revertedWithCustomError(dispenser, 'AlreadyClaimed')
     .withArgs(commitment, taskId);
  });

  it('reverts when paused', async () => {
    const { dispenser, oracle, admin } = await loadFixture(deployFixture);
    await dispenser.connect(admin).pause();

    await expect(
      dispenser.connect(oracle).awardTask(comm('x'), tid('t'))
    ).to.be.revertedWithCustomError(dispenser, 'EnforcedPause');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// previewPoints
// ─────────────────────────────────────────────────────────────────────────────

describe('TaskRewardDispenser — previewPoints', () => {
  it('returns POINTS_HIGH for a fresh commitment', async () => {
    const { dispenser } = await loadFixture(deployFixture);
    expect(await dispenser.previewPoints(comm('new'))).to.equal(POINTS_HIGH);
  });

  it('returns POINTS_HIGH for rep = 49', async () => {
    const { dispenser, repRegistry } = await loadFixture(deployFixture);
    const c = comm('p49');
    await repRegistry.setReputation(c, 49n);
    expect(await dispenser.previewPoints(c)).to.equal(POINTS_HIGH);
  });

  it('returns POINTS_LOW for rep = 50', async () => {
    const { dispenser, repRegistry } = await loadFixture(deployFixture);
    const c = comm('p50');
    await repRegistry.setReputation(c, 50n);
    expect(await dispenser.previewPoints(c)).to.equal(POINTS_LOW);
  });

  it('returns POINTS_LOW for rep = 999', async () => {
    const { dispenser, repRegistry } = await loadFixture(deployFixture);
    const c = comm('p999');
    await repRegistry.setReputation(c, 999n);
    expect(await dispenser.previewPoints(c)).to.equal(POINTS_LOW);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Admin
// ─────────────────────────────────────────────────────────────────────────────

describe('TaskRewardDispenser — admin', () => {
  it('admin can grant TASK_ORACLE to a new address', async () => {
    const { dispenser, admin, alice } = await loadFixture(deployFixture);
    await dispenser.connect(admin).grantTaskOracle(alice.address);
    expect(await dispenser.hasRole(TASK_ORACLE_ROLE, alice.address)).to.be.true;
  });

  it('newly granted oracle can call awardTask', async () => {
    const { dispenser, repRegistry, admin, alice } = await loadFixture(deployFixture);
    await dispenser.connect(admin).grantTaskOracle(alice.address);

    const commitment = comm('via-alice');
    await dispenser.connect(alice).awardTask(commitment, tid('t:1'));
    expect(await repRegistry.globalReputation(commitment)).to.equal(POINTS_HIGH);
  });

  it('admin can revoke TASK_ORACLE', async () => {
    const { dispenser, admin, oracle } = await loadFixture(deployFixture);
    await dispenser.connect(admin).revokeTaskOracle(oracle.address);
    expect(await dispenser.hasRole(TASK_ORACLE_ROLE, oracle.address)).to.be.false;

    await expect(
      dispenser.connect(oracle).awardTask(comm('x'), tid('t'))
    ).to.be.reverted;
  });

  it('stranger cannot grant TASK_ORACLE', async () => {
    const { dispenser, stranger, alice } = await loadFixture(deployFixture);
    await expect(
      dispenser.connect(stranger).grantTaskOracle(alice.address)
    ).to.be.reverted;
  });

  it('grantTaskOracle reverts on zero address', async () => {
    const { dispenser, admin } = await loadFixture(deployFixture);
    await expect(
      dispenser.connect(admin).grantTaskOracle(ethers.ZeroAddress)
    ).to.be.revertedWithCustomError(dispenser, 'ZeroAddress');
  });

  it('admin can update reputationRegistry and emits event', async () => {
    const { dispenser, admin } = await loadFixture(deployFixture);
    const MockRep     = await ethers.getContractFactory('MockReputationRegistry');
    const newRegistry = await MockRep.deploy();

    await expect(
      dispenser.connect(admin).setReputationRegistry(await newRegistry.getAddress())
    ).to.emit(dispenser, 'ReputationRegistryUpdated');

    expect(await dispenser.reputationRegistry())
      .to.equal(await newRegistry.getAddress());
  });

  it('setReputationRegistry reverts on zero address', async () => {
    const { dispenser, admin } = await loadFixture(deployFixture);
    await expect(
      dispenser.connect(admin).setReputationRegistry(ethers.ZeroAddress)
    ).to.be.revertedWithCustomError(dispenser, 'ZeroAddress');
  });

  it('pauser can pause and unpause', async () => {
    const { dispenser, admin } = await loadFixture(deployFixture);

    await dispenser.connect(admin).pause();
    expect(await dispenser.paused()).to.be.true;

    await dispenser.connect(admin).unpause();
    expect(await dispenser.paused()).to.be.false;
  });

  it('stranger cannot pause', async () => {
    const { dispenser, stranger } = await loadFixture(deployFixture);
    await expect(dispenser.connect(stranger).pause()).to.be.reverted;
  });
});
