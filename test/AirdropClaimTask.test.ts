import { expect }      from 'chai';
import { ethers }      from 'hardhat';
import { loadFixture } from '@nomicfoundation/hardhat-toolbox/network-helpers';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const POINTS_HIGH = 5n;

const id   = (s: string) => ethers.keccak256(ethers.toUtf8Bytes(s));
const comm = (s: string) => ethers.keccak256(ethers.toUtf8Bytes(s));

const CAMPAIGN_MANAGER_ROLE = ethers.keccak256(ethers.toUtf8Bytes('CAMPAIGN_MANAGER'));

// ─────────────────────────────────────────────────────────────────────────────
// Merkle tree helper
// Builds a simple tree from an array of commitments and returns root + proofs.
// ─────────────────────────────────────────────────────────────────────────────

function buildMerkleTree(commitments: string[]): {
  root: string;
  proofs: Record<string, string[]>;
} {
  // leaves = keccak256(commitment) — matching the contract
  const leaves = commitments.map(c =>
    ethers.keccak256(ethers.solidityPacked(['bytes32'], [c]))
  );

  // Sort leaves for deterministic root
  const sorted = [...leaves].sort();

  function hashPair(a: string, b: string): string {
    const [lo, hi] = a < b ? [a, b] : [b, a];
    return ethers.keccak256(ethers.concat([lo, hi]));
  }

  function buildLayer(layer: string[]): string[] {
    if (layer.length === 1) return layer;
    const next: string[] = [];
    for (let i = 0; i < layer.length; i += 2) {
      if (i + 1 < layer.length) {
        next.push(hashPair(layer[i], layer[i + 1]));
      } else {
        next.push(layer[i]);
      }
    }
    return buildLayer(next);
  }

  function getProof(leaf: string, layer: string[]): string[] {
    if (layer.length === 1) return [];
    const proof: string[] = [];
    let current = leaf;
    let currentLayer = layer;

    while (currentLayer.length > 1) {
      const idx = currentLayer.indexOf(current);
      const siblingIdx = idx % 2 === 0 ? idx + 1 : idx - 1;
      if (siblingIdx < currentLayer.length) {
        proof.push(currentLayer[siblingIdx]);
      }
      const next: string[] = [];
      for (let i = 0; i < currentLayer.length; i += 2) {
        if (i + 1 < currentLayer.length) {
          next.push(hashPair(currentLayer[i], currentLayer[i + 1]));
        } else {
          next.push(currentLayer[i]);
        }
      }
      current = idx % 2 === 0
        ? (siblingIdx < currentLayer.length ? hashPair(current, currentLayer[siblingIdx]) : current)
        : hashPair(currentLayer[siblingIdx], current);
      currentLayer = next;
    }
    return proof;
  }

  const root = buildLayer(sorted)[0];

  const proofs: Record<string, string[]> = {};
  for (const commitment of commitments) {
    const leaf = ethers.keccak256(ethers.solidityPacked(['bytes32'], [commitment]));
    proofs[commitment] = getProof(leaf, sorted);
  }

  return { root, proofs };
}

// ─────────────────────────────────────────────────────────────────────────────
// Fixture
// ─────────────────────────────────────────────────────────────────────────────

async function deployFixture() {
  const [admin, manager, alice, bob, stranger] = await ethers.getSigners();

  const MockRegistry = await ethers.getContractFactory('MockIdentityRegistry');
  const registry     = await MockRegistry.deploy();

  const MockRep     = await ethers.getContractFactory('MockReputationRegistry');
  const repRegistry = await MockRep.deploy();

  const MockOrg = await ethers.getContractFactory('MockOrganizerRegistry');
  const orgReg  = await MockOrg.deploy();

  const Dispenser = await ethers.getContractFactory('TaskRewardDispenser');
  const dispenser = await Dispenser.deploy(
    await repRegistry.getAddress(),
    admin.address
  );
  await repRegistry.grantUpdater(await dispenser.getAddress());

  const Task = await ethers.getContractFactory('AirdropClaimTask');
  const task = await Task.deploy(
    await registry.getAddress(),
    await dispenser.getAddress(),
    await orgReg.getAddress(),
    admin.address
  );

  await dispenser.connect(admin).grantTaskOracle(await task.getAddress());
  await task.connect(admin).grantRole(CAMPAIGN_MANAGER_ROLE, manager.address);

  // Setup identities
  const aliceCommitment = comm('alice-secret');
  const bobCommitment   = comm('bob-secret');
  await registry.setCommitment(alice.address, aliceCommitment);
  await registry.setCommitment(bob.address,   bobCommitment);

  // Setup organizer
  const orgId      = id('MyDAO-v1');
  const campaignId = id('airdrop-season-1');
  await orgReg.setActive(orgId, true);

  // Build allowlist with alice and bob
  const { root, proofs } = buildMerkleTree([aliceCommitment, bobCommitment]);

  return {
    admin, manager, alice, bob, stranger,
    registry, repRegistry, orgReg, dispenser, task,
    aliceCommitment, bobCommitment,
    orgId, campaignId,
    merkleRoot: root,
    aliceProof: proofs[aliceCommitment],
    bobProof:   proofs[bobCommitment],
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Deployment
// ─────────────────────────────────────────────────────────────────────────────

describe('AirdropClaimTask — deployment', () => {
  it('stores all addresses correctly', async () => {
    const { task, registry, dispenser, orgReg } = await loadFixture(deployFixture);
    expect(await task.identityRegistry()).to.equal(await registry.getAddress());
    expect(await task.dispenser()).to.equal(await dispenser.getAddress());
    expect(await task.organizerRegistry()).to.equal(await orgReg.getAddress());
  });

  it('reverts with ZeroAddress on zero constructor args', async () => {
    const [admin] = await ethers.getSigners();
    const Task    = await ethers.getContractFactory('AirdropClaimTask');
    const MockReg = await ethers.getContractFactory('MockIdentityRegistry');
    const MockRep = await ethers.getContractFactory('MockReputationRegistry');
    const Disp    = await ethers.getContractFactory('TaskRewardDispenser');
    const MockOrg = await ethers.getContractFactory('MockOrganizerRegistry');
    const reg     = await MockReg.deploy();
    const rep     = await MockRep.deploy();
    const disp    = await Disp.deploy(await rep.getAddress(), admin.address);
    const org     = await MockOrg.deploy();

    await expect(Task.deploy(ethers.ZeroAddress, await disp.getAddress(), await org.getAddress(), admin.address))
      .to.be.revertedWithCustomError({ interface: Task.interface }, 'ZeroAddress');
    await expect(Task.deploy(await reg.getAddress(), ethers.ZeroAddress, await org.getAddress(), admin.address))
      .to.be.revertedWithCustomError({ interface: Task.interface }, 'ZeroAddress');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// createCampaign
// ─────────────────────────────────────────────────────────────────────────────

describe('AirdropClaimTask — createCampaign', () => {
  it('creates a campaign successfully', async () => {
    const { task, manager, orgId, campaignId, merkleRoot } = await loadFixture(deployFixture);

    await expect(
      task.connect(manager).createCampaign(orgId, campaignId, merkleRoot, 'Season 1')
    ).to.emit(task, 'CampaignCreated');

    const c = await task.getCampaign(orgId, campaignId);
    expect(c.active).to.be.true;
    expect(c.merkleRoot).to.equal(merkleRoot);
    expect(c.name).to.equal('Season 1');
    expect(c.claimCount).to.equal(0n);
  });

  it('increments totalCampaigns', async () => {
    const { task, manager, orgId, campaignId, merkleRoot } = await loadFixture(deployFixture);
    await task.connect(manager).createCampaign(orgId, campaignId, merkleRoot, 'S1');
    expect(await task.totalCampaigns()).to.equal(1n);
  });

  it('reverts if organizer is not active', async () => {
    const { task, manager, campaignId, merkleRoot, orgReg } = await loadFixture(deployFixture);
    const inactiveOrg = id('InactiveDAO');
    await orgReg.setActive(inactiveOrg, false);

    await expect(
      task.connect(manager).createCampaign(inactiveOrg, campaignId, merkleRoot, 'S1')
    ).to.be.revertedWithCustomError(task, 'OrganizerNotActive');
  });

  it('reverts on duplicate campaign', async () => {
    const { task, manager, orgId, campaignId, merkleRoot } = await loadFixture(deployFixture);
    await task.connect(manager).createCampaign(orgId, campaignId, merkleRoot, 'S1');
    await expect(
      task.connect(manager).createCampaign(orgId, campaignId, merkleRoot, 'S1')
    ).to.be.revertedWithCustomError(task, 'CampaignAlreadyExists');
  });

  it('reverts on zero merkleRoot', async () => {
    const { task, manager, orgId, campaignId } = await loadFixture(deployFixture);
    await expect(
      task.connect(manager).createCampaign(orgId, campaignId, ethers.ZeroHash, 'S1')
    ).to.be.revertedWithCustomError(task, 'ZeroRoot');
  });

  it('reverts if caller lacks CAMPAIGN_MANAGER', async () => {
    const { task, stranger, orgId, campaignId, merkleRoot } = await loadFixture(deployFixture);
    await expect(
      task.connect(stranger).createCampaign(orgId, campaignId, merkleRoot, 'S1')
    ).to.be.reverted;
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// claim — happy paths
// ─────────────────────────────────────────────────────────────────────────────

describe('AirdropClaimTask — claim happy paths', () => {
  it('alice claims successfully with valid proof and earns 5 pts', async () => {
    const { task, repRegistry, manager, alice, aliceCommitment, orgId, campaignId, merkleRoot, aliceProof } =
      await loadFixture(deployFixture);

    await task.connect(manager).createCampaign(orgId, campaignId, merkleRoot, 'S1');

    await expect(task.connect(alice).claim(orgId, campaignId, aliceProof))
      .to.emit(task, 'AirdropClaimed')
      .withArgs(alice.address, aliceCommitment, orgId, campaignId);

    expect(await repRegistry.globalReputation(aliceCommitment)).to.equal(POINTS_HIGH);
  });

  it('bob claims successfully with his own proof', async () => {
    const { task, repRegistry, manager, bob, bobCommitment, orgId, campaignId, merkleRoot, bobProof } =
      await loadFixture(deployFixture);

    await task.connect(manager).createCampaign(orgId, campaignId, merkleRoot, 'S1');
    await task.connect(bob).claim(orgId, campaignId, bobProof);

    expect(await repRegistry.globalReputation(bobCommitment)).to.equal(POINTS_HIGH);
  });

  it('increments campaign claimCount', async () => {
    const { task, manager, alice, orgId, campaignId, merkleRoot, aliceProof } =
      await loadFixture(deployFixture);

    await task.connect(manager).createCampaign(orgId, campaignId, merkleRoot, 'S1');
    await task.connect(alice).claim(orgId, campaignId, aliceProof);

    const c = await task.getCampaign(orgId, campaignId);
    expect(c.claimCount).to.equal(1n);
  });

  it('isEligible returns true for alice with valid proof', async () => {
    const { task, manager, aliceCommitment, orgId, campaignId, merkleRoot, aliceProof } =
      await loadFixture(deployFixture);

    await task.connect(manager).createCampaign(orgId, campaignId, merkleRoot, 'S1');
    expect(await task.isEligible(orgId, campaignId, aliceCommitment, aliceProof)).to.be.true;
  });

  it('isEligible returns false for stranger commitment', async () => {
    const { task, manager, orgId, campaignId, merkleRoot } = await loadFixture(deployFixture);
    await task.connect(manager).createCampaign(orgId, campaignId, merkleRoot, 'S1');

    const strangerCommitment = comm('stranger-secret');
    expect(await task.isEligible(orgId, campaignId, strangerCommitment, [])).to.be.false;
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// claim — revert paths
// ─────────────────────────────────────────────────────────────────────────────

describe('AirdropClaimTask — claim revert paths', () => {
  it('reverts NotRegistered for unregistered wallet', async () => {
    const { task, manager, stranger, orgId, campaignId, merkleRoot } =
      await loadFixture(deployFixture);
    await task.connect(manager).createCampaign(orgId, campaignId, merkleRoot, 'S1');

    await expect(
      task.connect(stranger).claim(orgId, campaignId, [])
    ).to.be.revertedWithCustomError(task, 'NotRegistered');
  });

  it('reverts CampaignNotFound for non-existent campaign', async () => {
    const { task, alice, orgId, aliceProof } = await loadFixture(deployFixture);
    await expect(
      task.connect(alice).claim(orgId, id('nonexistent'), aliceProof)
    ).to.be.revertedWithCustomError(task, 'CampaignNotFound');
  });

  it('reverts CampaignNotActive for closed campaign', async () => {
    const { task, manager, alice, orgId, campaignId, merkleRoot, aliceProof } =
      await loadFixture(deployFixture);
    await task.connect(manager).createCampaign(orgId, campaignId, merkleRoot, 'S1');
    await task.connect(manager).closeCampaign(orgId, campaignId);

    await expect(
      task.connect(alice).claim(orgId, campaignId, aliceProof)
    ).to.be.revertedWithCustomError(task, 'CampaignNotActive');
  });

  it('reverts InvalidMerkleProof for wrong proof', async () => {
    const { task, manager, alice, orgId, campaignId, merkleRoot, bobProof } =
      await loadFixture(deployFixture);
    await task.connect(manager).createCampaign(orgId, campaignId, merkleRoot, 'S1');

    // alice submits bob's proof — should fail
    await expect(
      task.connect(alice).claim(orgId, campaignId, bobProof)
    ).to.be.revertedWithCustomError(task, 'InvalidMerkleProof');
  });

  it('reverts AlreadyClaimed on double claim', async () => {
    const { task, dispenser, manager, alice, orgId, campaignId, merkleRoot, aliceProof } =
      await loadFixture(deployFixture);
    await task.connect(manager).createCampaign(orgId, campaignId, merkleRoot, 'S1');
    await task.connect(alice).claim(orgId, campaignId, aliceProof);

    await expect(
      task.connect(alice).claim(orgId, campaignId, aliceProof)
    ).to.be.revertedWithCustomError(dispenser, 'AlreadyClaimed');
  });

  it('reverts when paused', async () => {
    const { task, manager, alice, admin, orgId, campaignId, merkleRoot, aliceProof } =
      await loadFixture(deployFixture);
    await task.connect(manager).createCampaign(orgId, campaignId, merkleRoot, 'S1');
    await task.connect(admin).pause();

    await expect(
      task.connect(alice).claim(orgId, campaignId, aliceProof)
    ).to.be.revertedWithCustomError(task, 'EnforcedPause');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// updateMerkleRoot
// ─────────────────────────────────────────────────────────────────────────────

describe('AirdropClaimTask — updateMerkleRoot', () => {
  it('updates the root successfully and emits event', async () => {
    const { task, manager, orgId, campaignId, merkleRoot } = await loadFixture(deployFixture);
    await task.connect(manager).createCampaign(orgId, campaignId, merkleRoot, 'S1');

    const newRoot = id('new-root');
    await expect(
      task.connect(manager).updateMerkleRoot(orgId, campaignId, newRoot)
    ).to.emit(task, 'CampaignMerkleRootUpdated')
     .withArgs(orgId, campaignId, merkleRoot, newRoot);

    const c = await task.getCampaign(orgId, campaignId);
    expect(c.merkleRoot).to.equal(newRoot);
  });

  it('reverts ZeroRoot for zero new root', async () => {
    const { task, manager, orgId, campaignId, merkleRoot } = await loadFixture(deployFixture);
    await task.connect(manager).createCampaign(orgId, campaignId, merkleRoot, 'S1');
    await expect(
      task.connect(manager).updateMerkleRoot(orgId, campaignId, ethers.ZeroHash)
    ).to.be.revertedWithCustomError(task, 'ZeroRoot');
  });

  it('stranger cannot update merkle root', async () => {
    const { task, stranger, orgId, campaignId, merkleRoot } = await loadFixture(deployFixture);
    await expect(
      task.connect(stranger).updateMerkleRoot(orgId, campaignId, id('new'))
    ).to.be.reverted;
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Admin
// ─────────────────────────────────────────────────────────────────────────────

describe('AirdropClaimTask — admin', () => {
  it('admin can grant CAMPAIGN_MANAGER', async () => {
    const { task, admin, alice } = await loadFixture(deployFixture);
    await task.connect(admin).grantRole(CAMPAIGN_MANAGER_ROLE, alice.address);
    expect(await task.hasRole(CAMPAIGN_MANAGER_ROLE, alice.address)).to.be.true;
  });

  it('admin can update identityRegistry', async () => {
    const { task, admin } = await loadFixture(deployFixture);
    const MockReg     = await ethers.getContractFactory('MockIdentityRegistry');
    const newRegistry = await MockReg.deploy();
    await task.connect(admin).setIdentityRegistry(await newRegistry.getAddress());
    expect(await task.identityRegistry()).to.equal(await newRegistry.getAddress());
  });

  it('admin can pause and unpause', async () => {
    const { task, admin } = await loadFixture(deployFixture);
    await task.connect(admin).pause();
    expect(await task.paused()).to.be.true;
    await task.connect(admin).unpause();
    expect(await task.paused()).to.be.false;
  });

  it('stranger cannot pause', async () => {
    const { task, stranger } = await loadFixture(deployFixture);
    await expect(task.connect(stranger).pause())
      .to.be.revertedWithCustomError(task, 'AccessControlUnauthorizedAccount');
  });
});
