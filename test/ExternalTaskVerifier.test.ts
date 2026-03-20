import { expect }      from 'chai';
import { ethers }      from 'hardhat';
import { loadFixture } from '@nomicfoundation/hardhat-toolbox/network-helpers';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const comm = (s: string) => ethers.keccak256(ethers.toUtf8Bytes(s));
const sel  = (sig: string) => ethers.id(sig).slice(0, 10) as `0x${string}`;

const HAS_VOTED_SEL  = sel('hasVoted(address)');
const BALANCE_OF_SEL = sel('balanceOf(address)');
const COMMITMENT_SEL = sel('getCommitment(address)');

const RT = { BOOL_TRUE: 0, UINT_NONZERO: 1, UINT_GTE_AMOUNT: 2, BYTES32_NONZERO: 3 };

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
  const dispenser = await Dispenser.deploy(await repRegistry.getAddress(), admin.address);
  await repRegistry.grantUpdater(await dispenser.getAddress());

  const Verifier = await ethers.getContractFactory('ExternalTaskVerifier');
  const verifier = await Verifier.deploy(
    await registry.getAddress(),
    await dispenser.getAddress(),
    admin.address
  );
  await dispenser.connect(admin).grantTaskOracle(await verifier.getAddress());

  const MockExt = await ethers.getContractFactory('MockExternalContract');
  const ext     = await MockExt.deploy();

  const aliceCommitment = comm('alice-secret');
  await registry.setCommitment(alice.address, aliceCommitment);

  const schemaId = comm('schema:1');

  return { admin, alice, bob, stranger, registry, repRegistry, dispenser, verifier, ext, aliceCommitment, schemaId };
}

// ─────────────────────────────────────────────────────────────────────────────
// Deployment
// ─────────────────────────────────────────────────────────────────────────────

describe('ExternalTaskVerifier — deployment', () => {
  it('stores identityRegistry and dispenser', async () => {
    const { verifier, registry, dispenser } = await loadFixture(deployFixture);
    expect(await verifier.identityRegistry()).to.equal(await registry.getAddress());
    expect(await verifier.dispenser()).to.equal(await dispenser.getAddress());
  });

  it('reverts ZeroAddress on zero registry', async () => {
    const [admin] = await ethers.getSigners();
    const V = await ethers.getContractFactory('ExternalTaskVerifier');
    await expect(V.deploy(ethers.ZeroAddress, admin.address, admin.address))
      .to.be.revertedWithCustomError({ interface: V.interface }, 'ZeroAddress');
  });

  it('reverts ZeroAddress on zero dispenser', async () => {
    const [admin] = await ethers.getSigners();
    const V   = await ethers.getContractFactory('ExternalTaskVerifier');
    const Reg = await ethers.getContractFactory('MockIdentityRegistry');
    const reg = await Reg.deploy();
    await expect(V.deploy(await reg.getAddress(), ethers.ZeroAddress, admin.address))
      .to.be.revertedWithCustomError({ interface: V.interface }, 'ZeroAddress');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// registerSchema
// ─────────────────────────────────────────────────────────────────────────────

describe('ExternalTaskVerifier — registerSchema', () => {
  it('registers schema and emits SchemaRegistered', async () => {
    const { verifier, ext, admin, schemaId } = await loadFixture(deployFixture);
    await expect(
      verifier.connect(admin).registerSchema(schemaId, await ext.getAddress(), HAS_VOTED_SEL, RT.BOOL_TRUE, 0, 'Voted')
    ).to.emit(verifier, 'SchemaRegistered');
    const s = await verifier.getSchema(schemaId);
    expect(s.active).to.be.true;
    expect(s.label).to.equal('Voted');
    expect(Number(s.returnType)).to.equal(RT.BOOL_TRUE);
  });

  it('increments totalSchemas', async () => {
    const { verifier, ext, admin, schemaId } = await loadFixture(deployFixture);
    await verifier.connect(admin).registerSchema(schemaId, await ext.getAddress(), HAS_VOTED_SEL, RT.BOOL_TRUE, 0, 'T');
    expect(await verifier.totalSchemas()).to.equal(1n);
  });

  it('reverts SchemaAlreadyExists on duplicate', async () => {
    const { verifier, ext, admin, schemaId } = await loadFixture(deployFixture);
    await verifier.connect(admin).registerSchema(schemaId, await ext.getAddress(), HAS_VOTED_SEL, RT.BOOL_TRUE, 0, 'T');
    await expect(
      verifier.connect(admin).registerSchema(schemaId, await ext.getAddress(), HAS_VOTED_SEL, RT.BOOL_TRUE, 0, 'T')
    ).to.be.revertedWithCustomError(verifier, 'SchemaAlreadyExists');
  });

  it('reverts EmptyLabel', async () => {
    const { verifier, ext, admin, schemaId } = await loadFixture(deployFixture);
    await expect(
      verifier.connect(admin).registerSchema(schemaId, await ext.getAddress(), HAS_VOTED_SEL, RT.BOOL_TRUE, 0, '')
    ).to.be.revertedWithCustomError(verifier, 'EmptyLabel');
  });

  it('reverts ZeroAddress on zero targetContract', async () => {
    const { verifier, admin, schemaId } = await loadFixture(deployFixture);
    await expect(
      verifier.connect(admin).registerSchema(schemaId, ethers.ZeroAddress, HAS_VOTED_SEL, RT.BOOL_TRUE, 0, 'T')
    ).to.be.revertedWithCustomError(verifier, 'ZeroAddress');
  });

  it('reverts if caller lacks SCHEMA_MANAGER', async () => {
    const { verifier, ext, stranger, schemaId } = await loadFixture(deployFixture);
    await expect(
      verifier.connect(stranger).registerSchema(schemaId, await ext.getAddress(), HAS_VOTED_SEL, RT.BOOL_TRUE, 0, 'T')
    ).to.be.reverted;
  });

  it('getTaskId is deterministic', async () => {
    const { verifier, schemaId } = await loadFixture(deployFixture);
    const expected = ethers.keccak256(ethers.solidityPacked(['string', 'bytes32'], ['civyx:external:', schemaId]));
    expect(await verifier.getTaskId(schemaId)).to.equal(expected);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// BOOL_TRUE
// ─────────────────────────────────────────────────────────────────────────────

describe('ExternalTaskVerifier — BOOL_TRUE', () => {
  async function f() {
    const base = await deployFixture();
    await base.verifier.connect(base.admin).registerSchema(base.schemaId, await base.ext.getAddress(), HAS_VOTED_SEL, RT.BOOL_TRUE, 0, 'Voted');
    return base;
  }

  it('awards 5 pts when returns true', async () => {
    const { verifier, repRegistry, ext, alice, aliceCommitment, schemaId } = await f();
    await ext.setHasVoted(alice.address, true);
    await verifier.connect(alice).claimExternal(schemaId);
    expect(await repRegistry.globalReputation(aliceCommitment)).to.equal(5n);
  });

  it('emits ExternalTaskClaimed', async () => {
    const { verifier, ext, alice, aliceCommitment, schemaId } = await f();
    await ext.setHasVoted(alice.address, true);
    await expect(verifier.connect(alice).claimExternal(schemaId))
      .to.emit(verifier, 'ExternalTaskClaimed')
      .withArgs(alice.address, aliceCommitment, schemaId, await ext.getAddress(), 1n);
  });

  it('reverts VerificationFailed when returns false', async () => {
    const { verifier, ext, alice, schemaId } = await f();
    await ext.setHasVoted(alice.address, false);
    await expect(verifier.connect(alice).claimExternal(schemaId))
      .to.be.revertedWithCustomError(verifier, 'VerificationFailed');
  });

  it('reverts NotRegistered for unregistered wallet', async () => {
    const { verifier, ext, stranger, schemaId } = await f();
    await ext.setHasVoted(stranger.address, true);
    await expect(verifier.connect(stranger).claimExternal(schemaId))
      .to.be.revertedWithCustomError(verifier, 'NotRegistered');
  });

  it('reverts AlreadyClaimed on second claim', async () => {
    const { verifier, dispenser, ext, alice, schemaId } = await f();
    await ext.setHasVoted(alice.address, true);
    await verifier.connect(alice).claimExternal(schemaId);
    await expect(verifier.connect(alice).claimExternal(schemaId))
      .to.be.revertedWithCustomError(dispenser, 'AlreadyClaimed');
  });

  it('increments totalExternalClaims and schema totalClaims', async () => {
    const { verifier, ext, alice, schemaId } = await f();
    await ext.setHasVoted(alice.address, true);
    await verifier.connect(alice).claimExternal(schemaId);
    expect(await verifier.totalExternalClaims()).to.equal(1n);
    expect((await verifier.getSchema(schemaId)).totalClaims).to.equal(1n);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// UINT_NONZERO
// ─────────────────────────────────────────────────────────────────────────────

describe('ExternalTaskVerifier — UINT_NONZERO', () => {
  async function f() {
    const base = await deployFixture();
    await base.verifier.connect(base.admin).registerSchema(base.schemaId, await base.ext.getAddress(), BALANCE_OF_SEL, RT.UINT_NONZERO, 0, 'Holds token');
    return base;
  }

  it('claims when balance > 0', async () => {
    const { verifier, repRegistry, ext, alice, aliceCommitment, schemaId } = await f();
    await ext.setBalance(alice.address, 1000n);
    await verifier.connect(alice).claimExternal(schemaId);
    expect(await repRegistry.globalReputation(aliceCommitment)).to.equal(5n);
  });

  it('reverts when balance == 0', async () => {
    const { verifier, ext, alice, schemaId } = await f();
    await ext.setBalance(alice.address, 0n);
    await expect(verifier.connect(alice).claimExternal(schemaId))
      .to.be.revertedWithCustomError(verifier, 'VerificationFailed');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// UINT_GTE_AMOUNT
// ─────────────────────────────────────────────────────────────────────────────

describe('ExternalTaskVerifier — UINT_GTE_AMOUNT', () => {
  const REQUIRED = ethers.parseEther('100');

  async function f() {
    const base = await deployFixture();
    await base.verifier.connect(base.admin).registerSchema(base.schemaId, await base.ext.getAddress(), BALANCE_OF_SEL, RT.UINT_GTE_AMOUNT, REQUIRED, 'Holds 100+');
    return base;
  }

  it('claims when balance >= required', async () => {
    const { verifier, repRegistry, ext, alice, aliceCommitment, schemaId } = await f();
    await ext.setBalance(alice.address, REQUIRED);
    await verifier.connect(alice).claimExternal(schemaId);
    expect(await repRegistry.globalReputation(aliceCommitment)).to.equal(5n);
  });

  it('claims when balance > required', async () => {
    const { verifier, ext, alice, schemaId } = await f();
    await ext.setBalance(alice.address, REQUIRED * 2n);
    await verifier.connect(alice).claimExternal(schemaId);
  });

  it('reverts when balance < required', async () => {
    const { verifier, ext, alice, schemaId } = await f();
    await ext.setBalance(alice.address, REQUIRED - 1n);
    await expect(verifier.connect(alice).claimExternal(schemaId))
      .to.be.revertedWithCustomError(verifier, 'VerificationFailed');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// BYTES32_NONZERO
// ─────────────────────────────────────────────────────────────────────────────

describe('ExternalTaskVerifier — BYTES32_NONZERO', () => {
  async function f() {
    const base = await deployFixture();
    await base.verifier.connect(base.admin).registerSchema(base.schemaId, await base.ext.getAddress(), COMMITMENT_SEL, RT.BYTES32_NONZERO, 0, 'Has commitment');
    return base;
  }

  it('claims when bytes32 nonzero', async () => {
    const { verifier, repRegistry, ext, alice, aliceCommitment, schemaId } = await f();
    await ext.setCommitment(alice.address, comm('some'));
    await verifier.connect(alice).claimExternal(schemaId);
    expect(await repRegistry.globalReputation(aliceCommitment)).to.equal(5n);
  });

  it('reverts when bytes32 is zero', async () => {
    const { verifier, ext, alice, schemaId } = await f();
    await ext.setCommitment(alice.address, ethers.ZeroHash);
    await expect(verifier.connect(alice).claimExternal(schemaId))
      .to.be.revertedWithCustomError(verifier, 'VerificationFailed');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// wouldVerify
// ─────────────────────────────────────────────────────────────────────────────

describe('ExternalTaskVerifier — wouldVerify', () => {
  it('returns true + Verified', async () => {
    const { verifier, ext, admin, alice, schemaId } = await loadFixture(deployFixture);
    await verifier.connect(admin).registerSchema(schemaId, await ext.getAddress(), HAS_VOTED_SEL, RT.BOOL_TRUE, 0, 'T');
    await ext.setHasVoted(alice.address, true);
    const [passes,, reason] = await verifier.wouldVerify(schemaId, alice.address);
    expect(passes).to.be.true;
    expect(reason).to.equal('Verified');
  });

  it('returns false when state fails', async () => {
    const { verifier, ext, admin, alice, schemaId } = await loadFixture(deployFixture);
    await verifier.connect(admin).registerSchema(schemaId, await ext.getAddress(), HAS_VOTED_SEL, RT.BOOL_TRUE, 0, 'T');
    const [passes] = await verifier.wouldVerify(schemaId, alice.address);
    expect(passes).to.be.false;
  });

  it('returns Schema not found for unknown schemaId', async () => {
    const { verifier, alice } = await loadFixture(deployFixture);
    const [passes,, reason] = await verifier.wouldVerify(comm('none'), alice.address);
    expect(passes).to.be.false;
    expect(reason).to.equal('Schema not found');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Schema lifecycle
// ─────────────────────────────────────────────────────────────────────────────

describe('ExternalTaskVerifier — lifecycle', () => {
  it('deactivated schema blocks claims with SchemaNotActive', async () => {
    const { verifier, ext, admin, alice, schemaId } = await loadFixture(deployFixture);
    await verifier.connect(admin).registerSchema(schemaId, await ext.getAddress(), HAS_VOTED_SEL, RT.BOOL_TRUE, 0, 'T');
    await ext.setHasVoted(alice.address, true);
    await verifier.connect(admin).deactivateSchema(schemaId);
    await expect(verifier.connect(alice).claimExternal(schemaId))
      .to.be.revertedWithCustomError(verifier, 'SchemaNotActive');
  });

  it('reactivated schema allows claims again', async () => {
    const { verifier, repRegistry, ext, admin, alice, aliceCommitment, schemaId } = await loadFixture(deployFixture);
    await verifier.connect(admin).registerSchema(schemaId, await ext.getAddress(), HAS_VOTED_SEL, RT.BOOL_TRUE, 0, 'T');
    await ext.setHasVoted(alice.address, true);
    await verifier.connect(admin).deactivateSchema(schemaId);
    await verifier.connect(admin).reactivateSchema(schemaId);
    await verifier.connect(alice).claimExternal(schemaId);
    expect(await repRegistry.globalReputation(aliceCommitment)).to.equal(5n);
  });

  it('pause blocks claimExternal', async () => {
    const { verifier, ext, admin, alice, schemaId } = await loadFixture(deployFixture);
    await verifier.connect(admin).registerSchema(schemaId, await ext.getAddress(), HAS_VOTED_SEL, RT.BOOL_TRUE, 0, 'T');
    await ext.setHasVoted(alice.address, true);
    await verifier.connect(admin).pause();
    await expect(verifier.connect(alice).claimExternal(schemaId))
      .to.be.revertedWithCustomError(verifier, 'EnforcedPause');
  });

  it('stranger cannot deactivate schema', async () => {
    const { verifier, ext, admin, stranger, schemaId } = await loadFixture(deployFixture);
    await verifier.connect(admin).registerSchema(schemaId, await ext.getAddress(), HAS_VOTED_SEL, RT.BOOL_TRUE, 0, 'T');
    await expect(verifier.connect(stranger).deactivateSchema(schemaId)).to.be.reverted;
  });
});
