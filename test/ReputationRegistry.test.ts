import { expect } from 'chai';
import { ethers, network } from 'hardhat';
import { SignerWithAddress } from '@nomicfoundation/hardhat-ethers/signers';
import { keccak256, toUtf8Bytes } from 'ethers';

function makeCommitment(label: string): string {
  return keccak256(toUtf8Bytes(label));
}

// Mine N empty blocks to bypass cooldown on local Hardhat network
async function mineBlocks(n: number) {
  for (let i = 0; i < n; i++) {
    await network.provider.send('evm_mine', []);
  }
}

describe('ReputationRegistry', () => {

  let registry: any;
  let mockIdentityRegistry: any;
  let admin: SignerWithAddress;
  let updater: SignerWithAddress;
  let alice: SignerWithAddress;
  let bob: SignerWithAddress;
  let carol: SignerWithAddress;

  const REPUTATION_UPDATER = keccak256(toUtf8Bytes('REPUTATION_UPDATER'));
  const APP_MANAGER        = keccak256(toUtf8Bytes('APP_MANAGER'));

  const aliceCommitment = makeCommitment('alice');
  const bobCommitment   = makeCommitment('bob');
  const appId           = makeCommitment('civyx-dao');

  before(async () => {
    [admin, updater, alice, bob, carol] = await ethers.getSigners();

    // Deploy mock IdentityRegistry
    const MockFactory = await ethers.getContractFactory('MockIdentityRegistry');
    mockIdentityRegistry = await MockFactory.deploy();
    await mockIdentityRegistry.waitForDeployment();

    await mockIdentityRegistry.setCommitment(alice.address, aliceCommitment);
    await mockIdentityRegistry.setCommitment(bob.address, bobCommitment);

    const Factory = await ethers.getContractFactory('ReputationRegistry');
    registry = await Factory.deploy(admin.address, await mockIdentityRegistry.getAddress());
    await registry.waitForDeployment();

    await registry.connect(admin).grantRole(REPUTATION_UPDATER, updater.address);
    await registry.connect(admin).grantRole(APP_MANAGER, updater.address);
  });

  // ── Global Reputation ───────────────────────────────────────────────────────

  describe('addGlobalReputation()', () => {

    it('adds reputation correctly', async () => {
      await registry.connect(updater).addGlobalReputation(aliceCommitment, 100);
      expect(await registry.globalReputation(aliceCommitment)).to.equal(100);
    });

    it('caps at MAX_REPUTATION (1000)', async () => {
      await registry.connect(updater).addGlobalReputation(bobCommitment, 999);
      await registry.connect(updater).addGlobalReputation(bobCommitment, 999);
      expect(await registry.globalReputation(bobCommitment)).to.equal(1000);
    });

    it('emits GlobalReputationUpdated', async () => {
      const carolCommitment = makeCommitment('carol');
      await expect(registry.connect(updater).addGlobalReputation(carolCommitment, 50))
        .to.emit(registry, 'GlobalReputationUpdated')
        .withArgs(carolCommitment, 0, 50);
    });

    it('reverts for non-updater', async () => {
      await expect(
        registry.connect(alice).addGlobalReputation(aliceCommitment, 100)
      ).to.be.reverted;
    });

    it('reverts for zero commitment', async () => {
      await expect(
        registry.connect(updater).addGlobalReputation(ethers.ZeroHash, 100)
      ).to.be.revertedWithCustomError(registry, 'ZeroCommitment');
    });
  });

  describe('slashGlobalReputation()', () => {

    it('reduces reputation', async () => {
      const before = await registry.globalReputation(aliceCommitment);
      await registry.connect(updater).slashGlobalReputation(aliceCommitment, 10);
      expect(await registry.globalReputation(aliceCommitment)).to.equal(BigInt(before) - 10n);
    });

    it('floors at zero — no underflow', async () => {
      await registry.connect(updater).slashGlobalReputation(aliceCommitment, 99999);
      expect(await registry.globalReputation(aliceCommitment)).to.equal(0);
    });
  });

  // ── Endorsement Weight Tiers ────────────────────────────────────────────────

  describe('getEndorsementWeight()', () => {

    it('returns 0 for rep below minimum (49)', async () => {
      expect(await registry.getEndorsementWeight(49)).to.equal(0);
    });

    it('returns 1 for Tier 1 (50-99 rep)', async () => {
      expect(await registry.getEndorsementWeight(50)).to.equal(1);
      expect(await registry.getEndorsementWeight(99)).to.equal(1);
    });

    it('returns 3 for Tier 2 (100-299 rep)', async () => {
      expect(await registry.getEndorsementWeight(100)).to.equal(3);
      expect(await registry.getEndorsementWeight(299)).to.equal(3);
    });

    it('returns 5 for Tier 3 (300-599 rep)', async () => {
      expect(await registry.getEndorsementWeight(300)).to.equal(5);
      expect(await registry.getEndorsementWeight(599)).to.equal(5);
    });

    it('returns 10 for Tier 4 (600+ rep)', async () => {
      expect(await registry.getEndorsementWeight(600)).to.equal(10);
      expect(await registry.getEndorsementWeight(1000)).to.equal(10);
    });
  });

  // ── Endorsements ────────────────────────────────────────────────────────────

  describe('endorseIdentity()', () => {

    before(async () => {
      // Give alice 100 rep so she can endorse (Tier 2, weight 3)
      await registry.connect(updater).addGlobalReputation(aliceCommitment, 100);
    });

    it('reverts if endorser has insufficient reputation', async () => {
      // fresh commitment with 0 rep — cannot endorse
      const zeroRepCommitment = makeCommitment('zero-rep');
      const [,,,,, stranger]  = await ethers.getSigners();
      await mockIdentityRegistry.setCommitment(stranger.address, zeroRepCommitment);

      await expect(
        registry.connect(stranger).endorseIdentity(zeroRepCommitment, bobCommitment)
      ).to.be.revertedWithCustomError(registry, 'InsufficientReputationToEndorse');
    });

    it('reverts if msg.sender does not own endorserCommitment', async () => {
      await expect(
        registry.connect(bob).endorseIdentity(aliceCommitment, bobCommitment)
      ).to.be.revertedWithCustomError(registry, 'NotCommitmentOwner');
    });

    it('reverts on self endorsement', async () => {
      await expect(
        registry.connect(alice).endorseIdentity(aliceCommitment, aliceCommitment)
      ).to.be.revertedWithCustomError(registry, 'CannotEndorseSelf');
    });

    it('records endorsement and adds correct weighted points', async () => {
      // Mine past cooldown period (600 blocks)
      await mineBlocks(601);

      const aliceRep       = await registry.globalReputation(aliceCommitment);
      const expectedWeight = await registry.getEndorsementWeight(aliceRep);

      await expect(
        registry.connect(alice).endorseIdentity(aliceCommitment, bobCommitment)
      )
        .to.emit(registry, 'IdentityEndorsed')
        .withArgs(aliceCommitment, bobCommitment, expectedWeight, aliceRep);

      expect(await registry.endorsementCount(bobCommitment)).to.equal(1);
      expect(await registry.endorsementPoints(bobCommitment)).to.equal(expectedWeight);
      expect(await registry.hasEndorsed(aliceCommitment, bobCommitment)).to.be.true;
    });

    it('reverts on cooldown after endorsing', async () => {
      // Immediately after endorsing — cooldown is active
      const newTarget = makeCommitment('new-target');
      await expect(
        registry.connect(alice).endorseIdentity(aliceCommitment, newTarget)
      ).to.be.revertedWithCustomError(registry, 'EndorsementCooldownActive');
    });

    it('reverts on double endorsement of same target after cooldown', async () => {
      await mineBlocks(601);
      // alice already endorsed bob — should get AlreadyEndorsed not CooldownActive
      await expect(
        registry.connect(alice).endorseIdentity(aliceCommitment, bobCommitment)
      ).to.be.revertedWithCustomError(registry, 'AlreadyEndorsed');
    });
  });

  // ── Effective Reputation ─────────────────────────────────────────────────────

  describe('getEffectiveReputation()', () => {

    it('returns base + weighted endorsement points', async () => {
      const base    = await registry.globalReputation(bobCommitment);
      const points  = await registry.endorsementPoints(bobCommitment);
      const total   = base + points > 1000n ? 1000n : base + points;
      expect(await registry.getEffectiveReputation(bobCommitment)).to.equal(total);
    });

    it('caps at MAX_REPUTATION', async () => {
      // bob already has 1000 global rep from earlier
      expect(await registry.getEffectiveReputation(bobCommitment)).to.equal(1000);
    });
  });

  // ── Local Reputation ────────────────────────────────────────────────────────

  describe('Local Reputation', () => {

    before(async () => {
      await registry.connect(updater).registerApp(appId, 'Civyx DAO');
    });

    it('registers an app', async () => {
      expect(await registry.registeredApps(appId)).to.be.true;
      expect(await registry.appNames(appId)).to.equal('Civyx DAO');
    });

    it('sets and gets local reputation', async () => {
      await registry.connect(updater).setLocalReputation(appId, aliceCommitment, 75);
      expect(await registry.getLocalReputation(appId, aliceCommitment)).to.equal(75);
    });

    it('reverts if app not registered', async () => {
      await expect(
        registry.connect(updater).setLocalReputation(makeCommitment('fake'), aliceCommitment, 50)
      ).to.be.revertedWithCustomError(registry, 'AppNotRegistered');
    });

    it('reverts if score exceeds MAX', async () => {
      await expect(
        registry.connect(updater).setLocalReputation(appId, aliceCommitment, 1001)
      ).to.be.revertedWithCustomError(registry, 'ScoreExceedsMax');
    });

    it('reverts on duplicate app registration', async () => {
      await expect(
        registry.connect(updater).registerApp(appId, 'Duplicate')
      ).to.be.revertedWithCustomError(registry, 'AppAlreadyRegistered');
    });
  });

  // ── Pause ────────────────────────────────────────────────────────────────────

  describe('Pause', () => {

    it('pausing blocks reputation updates', async () => {
      await registry.connect(admin).pause();
      await expect(
        registry.connect(updater).addGlobalReputation(aliceCommitment, 100)
      ).to.be.revertedWithCustomError(registry, 'EnforcedPause');
      await registry.connect(admin).unpause();
    });
  });
});
