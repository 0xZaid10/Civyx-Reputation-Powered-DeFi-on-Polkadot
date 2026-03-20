import { expect }      from 'chai';
import { ethers }      from 'hardhat';
import { loadFixture } from '@nomicfoundation/hardhat-toolbox/network-helpers';

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const PAS            = 10_000_000_000n;
const CLAIM_AMOUNT   = 50n * PAS;
const POINTS_HIGH    = 5n;
const POINTS_LOW     = 3n;

const comm = (s: string) => ethers.keccak256(ethers.toUtf8Bytes(s));
const id   = (s: string) => ethers.keccak256(ethers.toUtf8Bytes(s));

const PROPOSAL_REGISTRAR_ROLE = ethers.keccak256(ethers.toUtf8Bytes('PROPOSAL_REGISTRAR'));

// Fixed orgId + proposalId matching the page constants
const ORG_ID      = id('civyx-community-v1');
const PROPOSAL_ID = id('civyx-genesis-vote-1');

// ─────────────────────────────────────────────────────────────────────────────
// Fixture — deploys the full community stack
// ─────────────────────────────────────────────────────────────────────────────

async function deployFixture() {
  const [admin, alice, bob, stranger] = await ethers.getSigners();

  // Mocks
  const MockRegistry = await ethers.getContractFactory('MockIdentityRegistry');
  const registry     = await MockRegistry.deploy();

  const MockRep     = await ethers.getContractFactory('MockReputationRegistry');
  const repRegistry = await MockRep.deploy();

  const MockOrg = await ethers.getContractFactory('MockOrganizerRegistry');
  const orgReg  = await MockOrg.deploy();

  // TaskRewardDispenser
  const Dispenser = await ethers.getContractFactory('TaskRewardDispenser');
  const dispenser = await Dispenser.deploy(
    await repRegistry.getAddress(),
    admin.address
  );
  await repRegistry.grantUpdater(await dispenser.getAddress());

  // GovernanceVoteTask
  const GovTask = await ethers.getContractFactory('GovernanceVoteTask');
  const govTask = await GovTask.deploy(
    await registry.getAddress(),
    await dispenser.getAddress(),
    await orgReg.getAddress(),
    admin.address
  );
  await dispenser.connect(admin).grantTaskOracle(await govTask.getAddress());
  await govTask.connect(admin).grantRole(PROPOSAL_REGISTRAR_ROLE, admin.address);

  // CommunityDrop
  const Drop = await ethers.getContractFactory('CommunityDrop');
  const drop = await Drop.deploy(
    await registry.getAddress(),
    await dispenser.getAddress(),
    CLAIM_AMOUNT,
    admin.address
  );
  await dispenser.connect(admin).grantTaskOracle(await drop.getAddress());

  // Fund drop with 500 PAS
  await admin.sendTransaction({ to: await drop.getAddress(), value: 500n * PAS });

  // Register orgId as active and register the proposal
  await orgReg.setActive(ORG_ID, true);
  await govTask.connect(admin).registerProposal(ORG_ID, PROPOSAL_ID);

  // Register alice
  const aliceCommitment = comm('alice-secret');
  await registry.setCommitment(alice.address, aliceCommitment);

  return {
    admin, alice, bob, stranger,
    registry, repRegistry, orgReg, dispenser, govTask, drop,
    aliceCommitment,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Full community flow
// ─────────────────────────────────────────────────────────────────────────────

describe('CommunityPage — vote + airdrop integration', () => {

  it('alice votes and earns 5 rep pts', async () => {
    const { govTask, repRegistry, alice, aliceCommitment } = await loadFixture(deployFixture);

    await govTask.connect(alice).claim(ORG_ID, PROPOSAL_ID);
    expect(await repRegistry.globalReputation(aliceCommitment)).to.equal(POINTS_HIGH);
  });

  it('alice claims airdrop and earns 5 more rep pts + receives PAS', async () => {
    const { drop, repRegistry, alice, aliceCommitment } = await loadFixture(deployFixture);

    const balBefore = await ethers.provider.getBalance(alice.address);
    const tx        = await drop.connect(alice).claim();
    const receipt   = await tx.wait();
    const gasUsed   = receipt!.gasUsed * receipt!.gasPrice;
    const balAfter  = await ethers.provider.getBalance(alice.address);

    expect(await repRegistry.globalReputation(aliceCommitment)).to.equal(POINTS_HIGH);
    expect(balAfter).to.equal(balBefore + CLAIM_AMOUNT - gasUsed);
  });

  it('alice does both — vote then airdrop — rep increases by 10 total', async () => {
    const { govTask, drop, repRegistry, alice, aliceCommitment } = await loadFixture(deployFixture);

    // Vote
    await govTask.connect(alice).claim(ORG_ID, PROPOSAL_ID);
    expect(await repRegistry.globalReputation(aliceCommitment)).to.equal(POINTS_HIGH);

    // Airdrop claim
    await drop.connect(alice).claim();
    expect(await repRegistry.globalReputation(aliceCommitment)).to.equal(POINTS_HIGH * 2n); // 10
  });

  it('alice does both — airdrop then vote — rep increases by 10 total', async () => {
    const { govTask, drop, repRegistry, alice, aliceCommitment } = await loadFixture(deployFixture);

    await drop.connect(alice).claim();
    await govTask.connect(alice).claim(ORG_ID, PROPOSAL_ID);

    expect(await repRegistry.globalReputation(aliceCommitment)).to.equal(POINTS_HIGH * 2n);
  });

  it('rep transitions to POINTS_LOW after crossing 50 mid-session', async () => {
    const { govTask, drop, repRegistry, alice, aliceCommitment } = await loadFixture(deployFixture);

    // Seed alice at 45 rep — just below threshold
    await repRegistry.setReputation(aliceCommitment, 45n);

    // Vote: 45 < 50 → earns 5, total = 50
    await govTask.connect(alice).claim(ORG_ID, PROPOSAL_ID);
    expect(await repRegistry.globalReputation(aliceCommitment)).to.equal(50n);

    // Airdrop: 50 >= 50 → earns 3, total = 53
    await drop.connect(alice).claim();
    expect(await repRegistry.globalReputation(aliceCommitment)).to.equal(53n);
  });

  it('double vote reverts with AlreadyClaimed', async () => {
    const { govTask, dispenser, alice } = await loadFixture(deployFixture);

    await govTask.connect(alice).claim(ORG_ID, PROPOSAL_ID);
    await expect(
      govTask.connect(alice).claim(ORG_ID, PROPOSAL_ID)
    ).to.be.revertedWithCustomError(dispenser, 'AlreadyClaimed');
  });

  it('double airdrop claim reverts with AlreadyClaimed', async () => {
    const { drop, dispenser, alice } = await loadFixture(deployFixture);

    await drop.connect(alice).claim();
    await expect(
      drop.connect(alice).claim()
    ).to.be.revertedWithCustomError(dispenser, 'AlreadyClaimed');
  });

  it('unregistered wallet cannot vote', async () => {
    const { govTask, stranger } = await loadFixture(deployFixture);

    await expect(
      govTask.connect(stranger).claim(ORG_ID, PROPOSAL_ID)
    ).to.be.revertedWithCustomError(govTask, 'NotRegistered');
  });

  it('unregistered wallet cannot claim airdrop', async () => {
    const { drop, stranger } = await loadFixture(deployFixture);

    await expect(
      drop.connect(stranger).claim()
    ).to.be.revertedWithCustomError(drop, 'NotRegistered');
  });

  it('multiple identities can each vote and claim independently', async () => {
    const { govTask, drop, repRegistry, registry, alice, bob } = await loadFixture(deployFixture);

    const bobCommitment = comm('bob-secret');
    await registry.setCommitment(bob.address, bobCommitment);

    await govTask.connect(alice).claim(ORG_ID, PROPOSAL_ID);
    await drop.connect(alice).claim();

    await govTask.connect(bob).claim(ORG_ID, PROPOSAL_ID);
    await drop.connect(bob).claim();

    expect(await repRegistry.globalReputation(comm('alice-secret'))).to.equal(POINTS_HIGH * 2n);
    expect(await repRegistry.globalReputation(bobCommitment)).to.equal(POINTS_HIGH * 2n);
  });

  it('vote taskId and airdrop taskId are different — both claimable', async () => {
    const { govTask, drop, dispenser, alice, aliceCommitment } = await loadFixture(deployFixture);

    const govTaskId  = ethers.keccak256(
      ethers.solidityPacked(['string', 'bytes32', 'bytes32'],
      ['civyx:task:governance_vote:', ORG_ID, PROPOSAL_ID])
    );
    const dropTaskId = ethers.keccak256(ethers.toUtf8Bytes('civyx:task:community_drop:genesis'));

    expect(govTaskId).to.not.equal(dropTaskId);

    await govTask.connect(alice).claim(ORG_ID, PROPOSAL_ID);
    await drop.connect(alice).claim();

    expect(await dispenser.hasClaimed(aliceCommitment, govTaskId)).to.be.true;
    expect(await dispenser.hasClaimed(aliceCommitment, dropTaskId)).to.be.true;
  });

  it('proposal claimCount reflects all participants', async () => {
    const { govTask, registry, alice, bob } = await loadFixture(deployFixture);

    const bobCommitment = comm('bob-secret');
    await registry.setCommitment(bob.address, bobCommitment);

    await govTask.connect(alice).claim(ORG_ID, PROPOSAL_ID);
    await govTask.connect(bob).claim(ORG_ID, PROPOSAL_ID);

    const proposal = await govTask.getProposal(ORG_ID, PROPOSAL_ID);
    expect(proposal.claimCount).to.equal(2n);
  });

  it('drop totalClaims reflects all participants', async () => {
    const { drop, registry, alice, bob } = await loadFixture(deployFixture);

    const bobCommitment = comm('bob-secret');
    await registry.setCommitment(bob.address, bobCommitment);

    await drop.connect(alice).claim();
    await drop.connect(bob).claim();

    expect(await drop.totalClaims()).to.equal(2n);
  });
});
