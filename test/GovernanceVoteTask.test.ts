import { expect }      from 'chai';
import { ethers }      from 'hardhat';
import { loadFixture } from '@nomicfoundation/hardhat-toolbox/network-helpers';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const POINTS_HIGH = 5n;
const POINTS_LOW  = 3n;

const id   = (s: string) => ethers.keccak256(ethers.toUtf8Bytes(s));
const comm = (s: string) => ethers.keccak256(ethers.toUtf8Bytes(s));

const PROPOSAL_REGISTRAR_ROLE = ethers.keccak256(ethers.toUtf8Bytes('PROPOSAL_REGISTRAR'));

// ─────────────────────────────────────────────────────────────────────────────
// Mocks
// ─────────────────────────────────────────────────────────────────────────────

// MockOrganizerRegistry — controls isActive per orgId
async function deployMockOrganizerRegistry() {
  const MockOrg = await ethers.getContractFactory('MockOrganizerRegistry');
  return MockOrg.deploy();
}

// ─────────────────────────────────────────────────────────────────────────────
// Fixture
// ─────────────────────────────────────────────────────────────────────────────

async function deployFixture() {
  const [admin, registrar, alice, bob, stranger] = await ethers.getSigners();

  const MockRegistry = await ethers.getContractFactory('MockIdentityRegistry');
  const registry     = await MockRegistry.deploy();

  const MockRep     = await ethers.getContractFactory('MockReputationRegistry');
  const repRegistry = await MockRep.deploy();

  const MockOrg  = await ethers.getContractFactory('MockOrganizerRegistry');
  const orgReg   = await MockOrg.deploy();

  const Dispenser = await ethers.getContractFactory('TaskRewardDispenser');
  const dispenser = await Dispenser.deploy(
    await repRegistry.getAddress(),
    admin.address
  );
  await repRegistry.grantUpdater(await dispenser.getAddress());

  const Task = await ethers.getContractFactory('GovernanceVoteTask');
  const task = await Task.deploy(
    await registry.getAddress(),
    await dispenser.getAddress(),
    await orgReg.getAddress(),
    admin.address
  );

  await dispenser.connect(admin).grantTaskOracle(await task.getAddress());

  // Grant registrar role to `registrar` signer
  await task.connect(admin).grantRole(PROPOSAL_REGISTRAR_ROLE, registrar.address);

  // Setup alice as registered identity
  const aliceCommitment = comm('alice-secret');
  await registry.setCommitment(alice.address, aliceCommitment);

  // Setup a default active orgId
  const orgId = id('MyDAO-v1');
  await orgReg.setActive(orgId, true);

  const proposalId = id('proposal-1');

  return {
    admin, registrar, alice, bob, stranger,
    registry, repRegistry, orgReg, dispenser, task,
    aliceCommitment, orgId, proposalId,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Deployment
// ─────────────────────────────────────────────────────────────────────────────

describe('GovernanceVoteTask — deployment', () => {
  it('stores all addresses correctly', async () => {
    const { task, registry, dispenser, orgReg } = await loadFixture(deployFixture);
    expect(await task.identityRegistry()).to.equal(await registry.getAddress());
    expect(await task.dispenser()).to.equal(await dispenser.getAddress());
    expect(await task.organizerRegistry()).to.equal(await orgReg.getAddress());
  });

  it('reverts with ZeroAddress on any zero constructor arg', async () => {
    const [admin] = await ethers.getSigners();
    const MockReg = await ethers.getContractFactory('MockIdentityRegistry');
    const reg     = await MockReg.deploy();
    const MockRep = await ethers.getContractFactory('MockReputationRegistry');
    const rep     = await MockRep.deploy();
    const Disp    = await ethers.getContractFactory('TaskRewardDispenser');
    const disp    = await Disp.deploy(await rep.getAddress(), admin.address);
    const MockOrg = await ethers.getContractFactory('MockOrganizerRegistry');
    const org     = await MockOrg.deploy();
    const Task    = await ethers.getContractFactory('GovernanceVoteTask');

    await expect(Task.deploy(ethers.ZeroAddress, await disp.getAddress(), await org.getAddress(), admin.address))
      .to.be.revertedWithCustomError({ interface: Task.interface }, 'ZeroAddress');
    await expect(Task.deploy(await reg.getAddress(), ethers.ZeroAddress, await org.getAddress(), admin.address))
      .to.be.revertedWithCustomError({ interface: Task.interface }, 'ZeroAddress');
    await expect(Task.deploy(await reg.getAddress(), await disp.getAddress(), ethers.ZeroAddress, admin.address))
      .to.be.revertedWithCustomError({ interface: Task.interface }, 'ZeroAddress');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// registerProposal
// ─────────────────────────────────────────────────────────────────────────────

describe('GovernanceVoteTask — registerProposal', () => {
  it('registers a proposal successfully', async () => {
    const { task, registrar, orgId, proposalId } = await loadFixture(deployFixture);

    await expect(task.connect(registrar).registerProposal(orgId, proposalId))
      .to.emit(task, 'ProposalRegistered')
      .withArgs(orgId, proposalId, ethers.keccak256(ethers.concat([orgId, proposalId])), registrar.address);

    const p = await task.getProposal(orgId, proposalId);
    expect(p.active).to.be.true;
    expect(p.claimCount).to.equal(0n);
  });

  it('increments totalProposals', async () => {
    const { task, registrar, orgId, proposalId } = await loadFixture(deployFixture);
    await task.connect(registrar).registerProposal(orgId, proposalId);
    expect(await task.totalProposals()).to.equal(1n);
  });

  it('reverts if organizer is not active', async () => {
    const { task, registrar, orgReg, proposalId } = await loadFixture(deployFixture);
    const inactiveOrg = ethers.keccak256(ethers.toUtf8Bytes('InactiveDAO'));
    await orgReg.setActive(inactiveOrg, false);

    await expect(
      task.connect(registrar).registerProposal(inactiveOrg, proposalId)
    ).to.be.revertedWithCustomError(task, 'OrganizerNotActive');
  });

  it('reverts if proposal already registered', async () => {
    const { task, registrar, orgId, proposalId } = await loadFixture(deployFixture);
    await task.connect(registrar).registerProposal(orgId, proposalId);
    await expect(
      task.connect(registrar).registerProposal(orgId, proposalId)
    ).to.be.revertedWithCustomError(task, 'ProposalAlreadyExists');
  });

  it('reverts with ZeroId for zero orgId', async () => {
    const { task, registrar, proposalId } = await loadFixture(deployFixture);
    await expect(
      task.connect(registrar).registerProposal(ethers.ZeroHash, proposalId)
    ).to.be.revertedWithCustomError(task, 'ZeroId');
  });

  it('reverts if caller lacks PROPOSAL_REGISTRAR', async () => {
    const { task, stranger, orgId, proposalId } = await loadFixture(deployFixture);
    await expect(
      task.connect(stranger).registerProposal(orgId, proposalId)
    ).to.be.reverted;
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// claim — happy paths
// ─────────────────────────────────────────────────────────────────────────────

describe('GovernanceVoteTask — claim happy paths', () => {
  it('claims successfully and awards 5 pts', async () => {
    const { task, repRegistry, registrar, alice, aliceCommitment, orgId, proposalId } =
      await loadFixture(deployFixture);

    await task.connect(registrar).registerProposal(orgId, proposalId);

    await expect(task.connect(alice).claim(orgId, proposalId))
      .to.emit(task, 'GovernanceVoteClaimed')
      .withArgs(alice.address, aliceCommitment, orgId, proposalId);

    expect(await repRegistry.globalReputation(aliceCommitment)).to.equal(POINTS_HIGH);
  });

  it('increments proposal claimCount', async () => {
    const { task, registrar, alice, orgId, proposalId } = await loadFixture(deployFixture);
    await task.connect(registrar).registerProposal(orgId, proposalId);
    await task.connect(alice).claim(orgId, proposalId);

    const p = await task.getProposal(orgId, proposalId);
    expect(p.claimCount).to.equal(1n);
  });

  it('different identities can each claim the same proposal', async () => {
    const { task, repRegistry, registry, registrar, alice, bob, orgId, proposalId } =
      await loadFixture(deployFixture);

    const bobCommitment = comm('bob-secret');
    await registry.setCommitment(bob.address, bobCommitment);

    await task.connect(registrar).registerProposal(orgId, proposalId);
    await task.connect(alice).claim(orgId, proposalId);
    await task.connect(bob).claim(orgId, proposalId);

    expect(await repRegistry.globalReputation(comm('alice-secret'))).to.equal(POINTS_HIGH);
    expect(await repRegistry.globalReputation(bobCommitment)).to.equal(POINTS_HIGH);
  });

  it('same identity can claim different proposals', async () => {
    const { task, repRegistry, registrar, alice, aliceCommitment, orgId } =
      await loadFixture(deployFixture);

    const p1 = id('proposal-1');
    const p2 = id('proposal-2');
    await task.connect(registrar).registerProposal(orgId, p1);
    await task.connect(registrar).registerProposal(orgId, p2);

    await task.connect(alice).claim(orgId, p1);
    await task.connect(alice).claim(orgId, p2);

    expect(await repRegistry.globalReputation(aliceCommitment)).to.equal(POINTS_HIGH * 2n);
  });

  it('awards 3 pts when rep >= 50', async () => {
    const { task, repRegistry, registrar, alice, aliceCommitment, orgId, proposalId } =
      await loadFixture(deployFixture);

    await repRegistry.setReputation(aliceCommitment, 50n);
    await task.connect(registrar).registerProposal(orgId, proposalId);
    await task.connect(alice).claim(orgId, proposalId);

    expect(await repRegistry.globalReputation(aliceCommitment)).to.equal(53n);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// claim — revert paths
// ─────────────────────────────────────────────────────────────────────────────

describe('GovernanceVoteTask — claim revert paths', () => {
  it('reverts NotRegistered for unregistered wallet', async () => {
    const { task, registrar, stranger, orgId, proposalId } = await loadFixture(deployFixture);
    await task.connect(registrar).registerProposal(orgId, proposalId);
    await expect(
      task.connect(stranger).claim(orgId, proposalId)
    ).to.be.revertedWithCustomError(task, 'NotRegistered');
  });

  it('reverts ProposalNotFound for non-existent proposal', async () => {
    const { task, alice, orgId } = await loadFixture(deployFixture);
    await expect(
      task.connect(alice).claim(orgId, id('nonexistent'))
    ).to.be.revertedWithCustomError(task, 'ProposalNotFound');
  });

  it('reverts ProposalNotActive for closed proposal', async () => {
    const { task, registrar, alice, orgId, proposalId } = await loadFixture(deployFixture);
    await task.connect(registrar).registerProposal(orgId, proposalId);
    await task.connect(registrar).closeProposal(orgId, proposalId);

    await expect(
      task.connect(alice).claim(orgId, proposalId)
    ).to.be.revertedWithCustomError(task, 'ProposalNotActive');
  });

  it('reverts AlreadyClaimed on double claim', async () => {
    const { task, dispenser, registrar, alice, orgId, proposalId } =
      await loadFixture(deployFixture);
    await task.connect(registrar).registerProposal(orgId, proposalId);
    await task.connect(alice).claim(orgId, proposalId);

    await expect(
      task.connect(alice).claim(orgId, proposalId)
    ).to.be.revertedWithCustomError(dispenser, 'AlreadyClaimed');
  });

  it('reverts when paused', async () => {
    const { task, registrar, alice, admin, orgId, proposalId } =
      await loadFixture(deployFixture);
    await task.connect(registrar).registerProposal(orgId, proposalId);
    await task.connect(admin).pause();

    await expect(
      task.connect(alice).claim(orgId, proposalId)
    ).to.be.revertedWithCustomError(task, 'EnforcedPause');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Admin
// ─────────────────────────────────────────────────────────────────────────────

describe('GovernanceVoteTask — admin', () => {
  it('admin can grant PROPOSAL_REGISTRAR', async () => {
    const { task, admin, alice } = await loadFixture(deployFixture);
    await task.connect(admin).grantRole(PROPOSAL_REGISTRAR_ROLE, alice.address);
    expect(await task.hasRole(PROPOSAL_REGISTRAR_ROLE, alice.address)).to.be.true;
  });

  it('stranger cannot register a proposal', async () => {
    const { task, stranger, orgId, proposalId } = await loadFixture(deployFixture);
    await expect(
      task.connect(stranger).registerProposal(orgId, proposalId)
    ).to.be.reverted;
  });

  it('admin can update identityRegistry', async () => {
    const { task, admin } = await loadFixture(deployFixture);
    const MockReg     = await ethers.getContractFactory('MockIdentityRegistry');
    const newRegistry = await MockReg.deploy();
    await task.connect(admin).setIdentityRegistry(await newRegistry.getAddress());
    expect(await task.identityRegistry()).to.equal(await newRegistry.getAddress());
  });

  it('owner can pause and unpause', async () => {
    const { task, admin } = await loadFixture(deployFixture);
    await task.connect(admin).pause();
    expect(await task.paused()).to.be.true;
    await task.connect(admin).unpause();
    expect(await task.paused()).to.be.false;
  });
});
