import { expect } from 'chai';
import { ethers } from 'hardhat';
import { SignerWithAddress } from '@nomicfoundation/hardhat-ethers/signers';
import { keccak256, toUtf8Bytes, ZeroHash, parseEther } from 'ethers';

describe('OrganizerRegistry', () => {

  let registry: any;
  let admin: SignerWithAddress;
  let alice: SignerWithAddress;
  let bob: SignerWithAddress;

  const PAUSER_ROLE   = keccak256(toUtf8Bytes('PAUSER_ROLE'));
  const DEFAULT_ADMIN = ZeroHash;

  const orgId   = keccak256(toUtf8Bytes('my-dao-v1'));
  const orgName = 'My DAO v1';

  before(async () => {
    [admin, alice, bob] = await ethers.getSigners();
    const Factory = await ethers.getContractFactory('OrganizerRegistry');
    registry = await Factory.deploy(admin.address);
    await registry.waitForDeployment();
  });

  // ── registerOrganizer ──────────────────────────────────────────────────────

  describe('registerOrganizer()', () => {

    it('registers successfully', async () => {
      await registry.connect(alice).registerOrganizer(orgId, orgName, parseEther('0.01'), 50);
      const org = await registry.getOrganizer(orgId);
      expect(org.active).to.be.true;
      expect(org.name).to.equal(orgName);
      expect(org.owner).to.equal(alice.address);
    });

    it('stores minStake and minReputation correctly', async () => {
      const org = await registry.getOrganizer(orgId);
      expect(org.minStake).to.equal(parseEther('0.01'));
      expect(org.minReputation).to.equal(50);
    });

    it('stores registeredAt block', async () => {
      const org = await registry.getOrganizer(orgId);
      expect(org.registeredAt).to.be.greaterThan(0);
    });

    it('adds to organizersByOwner', async () => {
      const orgs = await registry.getOrganizersByOwner(alice.address);
      expect(orgs).to.include(orgId);
    });

    it('isActive() returns true', async () => {
      expect(await registry.isActive(orgId)).to.be.true;
    });

    it('minStake can be zero (open access)', async () => {
      const freeId = keccak256(toUtf8Bytes('free-org'));
      await registry.connect(alice).registerOrganizer(freeId, 'Free Org', 0, 0);
      const org = await registry.getOrganizer(freeId);
      expect(org.minStake).to.equal(0);
      expect(org.minReputation).to.equal(0);
    });

    it('emits OrganizerRegistered', async () => {
      const newId = keccak256(toUtf8Bytes('emit-test'));
      await expect(registry.connect(alice).registerOrganizer(newId, 'Emit Test', 100, 10))
        .to.emit(registry, 'OrganizerRegistered')
        .withArgs(newId, alice.address, 'Emit Test', 100, 10);
    });

    it('reverts: duplicate orgId', async () => {
      await expect(
        registry.connect(bob).registerOrganizer(orgId, 'dup', 0, 0)
      ).to.be.revertedWithCustomError(registry, 'OrganizerAlreadyExists');
    });

    it('reverts: empty orgId', async () => {
      await expect(
        registry.connect(alice).registerOrganizer(ZeroHash, 'test', 0, 0)
      ).to.be.revertedWithCustomError(registry, 'EmptyOrgId');
    });

    it('reverts: empty name', async () => {
      await expect(
        registry.connect(alice).registerOrganizer(keccak256(toUtf8Bytes('new')), '', 0, 0)
      ).to.be.revertedWithCustomError(registry, 'EmptyName');
    });
  });

  // ── updateRequirements ─────────────────────────────────────────────────────

  describe('updateRequirements()', () => {

    it('owner updates requirements', async () => {
      await registry.connect(alice).updateRequirements(orgId, parseEther('0.05'), 100);
      const org = await registry.getOrganizer(orgId);
      expect(org.minStake).to.equal(parseEther('0.05'));
      expect(org.minReputation).to.equal(100);
    });

    it('can set to zero', async () => {
      await registry.connect(alice).updateRequirements(orgId, 0, 0);
      const [s, r] = await registry.getRequirements(orgId);
      expect(s).to.equal(0);
      expect(r).to.equal(0);
    });

    it('emits RequirementsUpdated', async () => {
      await expect(registry.connect(alice).updateRequirements(orgId, parseEther('0.01'), 50))
        .to.emit(registry, 'RequirementsUpdated');
    });

    it('reverts: non-owner', async () => {
      await expect(registry.connect(bob).updateRequirements(orgId, 0, 0))
        .to.be.revertedWithCustomError(registry, 'NotOrganizerOwner');
    });

    it('reverts: does not exist', async () => {
      await expect(registry.connect(alice).updateRequirements(keccak256(toUtf8Bytes('nope')), 0, 0))
        .to.be.revertedWithCustomError(registry, 'OrganizerDoesNotExist');
    });
  });

  // ── deactivate & reactivate ────────────────────────────────────────────────

  describe('deactivateOrganizer() / reactivateOrganizer()', () => {

    it('owner can deactivate', async () => {
      await registry.connect(alice).deactivateOrganizer(orgId);
      expect(await registry.isActive(orgId)).to.be.false;
    });

    it('emits OrganizerDeactivated', async () => {
      const id = keccak256(toUtf8Bytes('deactivate-emit'));
      await registry.connect(alice).registerOrganizer(id, 'test', 0, 0);
      await expect(registry.connect(alice).deactivateOrganizer(id))
        .to.emit(registry, 'OrganizerDeactivated').withArgs(id, alice.address);
    });

    it('admin can deactivate any organizer', async () => {
      const id = keccak256(toUtf8Bytes('admin-deactivate'));
      await registry.connect(bob).registerOrganizer(id, 'bob org', 0, 0);
      await registry.connect(admin).deactivateOrganizer(id);
      expect(await registry.isActive(id)).to.be.false;
    });

    it('owner can reactivate', async () => {
      await registry.connect(alice).reactivateOrganizer(orgId);
      expect(await registry.isActive(orgId)).to.be.true;
    });

    it('emits OrganizerReactivated', async () => {
      const id = keccak256(toUtf8Bytes('reactivate-emit'));
      await registry.connect(alice).registerOrganizer(id, 'test', 0, 0);
      await registry.connect(alice).deactivateOrganizer(id);
      await expect(registry.connect(alice).reactivateOrganizer(id))
        .to.emit(registry, 'OrganizerReactivated').withArgs(id, alice.address);
    });

    it('reverts: non-owner cannot deactivate', async () => {
      await expect(registry.connect(bob).deactivateOrganizer(orgId))
        .to.be.revertedWithCustomError(registry, 'NotOrganizerOwner');
    });

    it('reverts: deactivate already inactive', async () => {
      const id = keccak256(toUtf8Bytes('double-deactivate'));
      await registry.connect(alice).registerOrganizer(id, 'test', 0, 0);
      await registry.connect(alice).deactivateOrganizer(id);
      await expect(registry.connect(alice).deactivateOrganizer(id))
        .to.be.revertedWithCustomError(registry, 'OrganizerNotActive');
    });

    it('reverts: reactivate already active', async () => {
      await expect(registry.connect(alice).reactivateOrganizer(orgId))
        .to.be.revertedWithCustomError(registry, 'OrganizerAlreadyActive');
    });

    it('reverts: updateRequirements on inactive organizer', async () => {
      const id = keccak256(toUtf8Bytes('inactive-update'));
      await registry.connect(alice).registerOrganizer(id, 'test', 0, 0);
      await registry.connect(alice).deactivateOrganizer(id);
      await expect(registry.connect(alice).updateRequirements(id, 0, 0))
        .to.be.revertedWithCustomError(registry, 'OrganizerNotActive');
    });
  });

  // ── transferOrganizerOwnership ─────────────────────────────────────────────

  describe('transferOrganizerOwnership()', () => {

    it('owner can transfer ownership', async () => {
      const id = keccak256(toUtf8Bytes('transfer-test'));
      await registry.connect(alice).registerOrganizer(id, 'Transfer Test', 0, 0);
      await registry.connect(alice).transferOrganizerOwnership(id, bob.address);
      const org = await registry.getOrganizer(id);
      expect(org.owner).to.equal(bob.address);
    });

    it('emits OwnershipTransferred', async () => {
      const id = keccak256(toUtf8Bytes('transfer-emit'));
      await registry.connect(alice).registerOrganizer(id, 'Transfer Emit', 0, 0);
      await expect(registry.connect(alice).transferOrganizerOwnership(id, bob.address))
        .to.emit(registry, 'OwnershipTransferred');
    });

    it('new owner can update requirements', async () => {
      const id = keccak256(toUtf8Bytes('new-owner-update'));
      await registry.connect(alice).registerOrganizer(id, 'New Owner', 0, 0);
      await registry.connect(alice).transferOrganizerOwnership(id, bob.address);
      await registry.connect(bob).updateRequirements(id, parseEther('0.1'), 200);
      const [s, r] = await registry.getRequirements(id);
      expect(s).to.equal(parseEther('0.1'));
      expect(r).to.equal(200);
    });

    it('reverts: non-owner cannot transfer', async () => {
      await expect(registry.connect(bob).transferOrganizerOwnership(orgId, bob.address))
        .to.be.revertedWithCustomError(registry, 'NotOrganizerOwner');
    });

    it('reverts: transfer to zero address', async () => {
      const id = keccak256(toUtf8Bytes('zero-transfer'));
      await registry.connect(alice).registerOrganizer(id, 'Zero Transfer', 0, 0);
      await expect(registry.connect(alice).transferOrganizerOwnership(id, ethers.ZeroAddress))
        .to.be.revertedWithCustomError(registry, 'ZeroAddress');
    });
  });

  // ── getRequirements ────────────────────────────────────────────────────────

  describe('getRequirements()', () => {

    it('returns correct minStake and minReputation', async () => {
      const [s, r] = await registry.getRequirements(orgId);
      expect(s).to.equal(parseEther('0.01'));
      expect(r).to.equal(50);
    });

    it('reverts for nonexistent orgId', async () => {
      await expect(registry.getRequirements(keccak256(toUtf8Bytes('ghost'))))
        .to.be.revertedWithCustomError(registry, 'OrganizerDoesNotExist');
    });
  });

  // ── OpenZeppelin: AccessControl ────────────────────────────────────────────

  describe('OpenZeppelin: AccessControl', () => {

    it('deployer has DEFAULT_ADMIN_ROLE', async () => {
      expect(await registry.hasRole(DEFAULT_ADMIN, admin.address)).to.be.true;
    });

    it('deployer has PAUSER_ROLE', async () => {
      expect(await registry.hasRole(PAUSER_ROLE, admin.address)).to.be.true;
    });

    it('alice does not have DEFAULT_ADMIN_ROLE', async () => {
      expect(await registry.hasRole(DEFAULT_ADMIN, alice.address)).to.be.false;
    });

    it('admin can grant PAUSER_ROLE to alice', async () => {
      await registry.connect(admin).grantRole(PAUSER_ROLE, alice.address);
      expect(await registry.hasRole(PAUSER_ROLE, alice.address)).to.be.true;
    });

    it('alice can pause after receiving PAUSER_ROLE', async () => {
      await registry.connect(alice).pause();
      expect(await registry.paused()).to.be.true;
      await registry.connect(alice).unpause();
    });

    it('admin can revoke PAUSER_ROLE from alice', async () => {
      await registry.connect(admin).revokeRole(PAUSER_ROLE, alice.address);
      expect(await registry.hasRole(PAUSER_ROLE, alice.address)).to.be.false;
    });

    it('alice cannot pause after role revoked', async () => {
      await expect(registry.connect(alice).pause()).to.be.reverted;
    });

    it('alice can renounce her own role', async () => {
      await registry.connect(admin).grantRole(PAUSER_ROLE, alice.address);
      await registry.connect(alice).renounceRole(PAUSER_ROLE, alice.address);
      expect(await registry.hasRole(PAUSER_ROLE, alice.address)).to.be.false;
    });
  });

  // ── OpenZeppelin: Pausable ─────────────────────────────────────────────────

  describe('OpenZeppelin: Pausable', () => {

    it('starts unpaused', async () => {
      expect(await registry.paused()).to.be.false;
    });

    it('only PAUSER_ROLE can pause', async () => {
      await expect(registry.connect(alice).pause()).to.be.reverted;
    });

    it('admin can pause', async () => {
      await registry.connect(admin).pause();
      expect(await registry.paused()).to.be.true;
    });

    it('registerOrganizer blocked when paused', async () => {
      await expect(
        registry.connect(alice).registerOrganizer(keccak256(toUtf8Bytes('paused')), 'test', 0, 0)
      ).to.be.revertedWithCustomError(registry, 'EnforcedPause');
    });

    it('updateRequirements blocked when paused', async () => {
      await expect(registry.connect(alice).updateRequirements(orgId, 0, 0))
        .to.be.revertedWithCustomError(registry, 'EnforcedPause');
    });

    it('admin can unpause', async () => {
      await registry.connect(admin).unpause();
      expect(await registry.paused()).to.be.false;
    });

    it('operations resume after unpause', async () => {
      const id = keccak256(toUtf8Bytes('post-unpause'));
      await registry.connect(alice).registerOrganizer(id, 'Post Unpause', 0, 0);
      expect(await registry.isActive(id)).to.be.true;
    });
  });
});
