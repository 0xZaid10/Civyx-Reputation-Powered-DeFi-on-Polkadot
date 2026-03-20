import { expect } from 'chai';
import { ethers } from 'hardhat';
import { SignerWithAddress } from '@nomicfoundation/hardhat-ethers/signers';
import { parseEther, keccak256, toUtf8Bytes, ZeroHash } from 'ethers';

describe('IdentityRegistry', () => {

  let registry: any;
  let mockVerifier: any;
  let admin: SignerWithAddress;
  let alice: SignerWithAddress;
  let bob: SignerWithAddress;
  let carol: SignerWithAddress;

  const MIN_STAKE        = parseEther('0.01');
  const aliceCommitment  = keccak256(toUtf8Bytes('alice-secret'));
  const bobCommitment    = keccak256(toUtf8Bytes('bob-secret'));
  const carolCommitment  = keccak256(toUtf8Bytes('carol-secret'));

  before(async () => {
    [admin, alice, bob, carol] = await ethers.getSigners();

    // Deploy a mock verifier that always returns true
    const MockVerifier = await ethers.getContractFactory('MockVerifier');
    mockVerifier = await MockVerifier.deploy();
    await mockVerifier.waitForDeployment();

    const Factory = await ethers.getContractFactory('IdentityRegistry');
    registry = await Factory.deploy(
      MIN_STAKE,
      await mockVerifier.getAddress(),
      admin.address
    );
    await registry.waitForDeployment();
  });

  // ── registerIdentity ───────────────────────────────────────────────────────

  describe('registerIdentity()', () => {

    it('registers with valid commitment and stake', async () => {
      await registry.connect(alice).registerIdentity(aliceCommitment, { value: MIN_STAKE });
      expect(await registry.verifyIdentity(alice.address)).to.be.true;
    });

    it('stores correct commitment', async () => {
      expect(await registry.getCommitment(alice.address)).to.equal(aliceCommitment);
    });

    it('stores correct stake', async () => {
      expect(await registry.getIdentityStake(alice.address)).to.equal(MIN_STAKE);
    });

    it('links registrant as first wallet', async () => {
      const wallets = await registry.getLinkedWallets(aliceCommitment);
      expect(wallets).to.include(alice.address);
    });

    it('sets active = true', async () => {
      const id = await registry.getIdentity(aliceCommitment);
      expect(id.active).to.be.true;
    });

    it('bob registers independently', async () => {
      await registry.connect(bob).registerIdentity(bobCommitment, { value: MIN_STAKE });
      expect(await registry.verifyIdentity(bob.address)).to.be.true;
    });

    it('reverts: commitment already registered', async () => {
      await expect(
        registry.connect(carol).registerIdentity(aliceCommitment, { value: MIN_STAKE })
      ).to.be.revertedWithCustomError(registry, 'CommitmentAlreadyRegistered');
    });

    it('reverts: wallet already linked', async () => {
      await expect(
        registry.connect(alice).registerIdentity(carolCommitment, { value: MIN_STAKE })
      ).to.be.revertedWithCustomError(registry, 'WalletAlreadyLinked');
    });

    it('reverts: stake below minimum', async () => {
      await expect(
        registry.connect(carol).registerIdentity(carolCommitment, { value: 1n })
      ).to.be.revertedWithCustomError(registry, 'InsufficientStake');
    });

    it('reverts: zero commitment', async () => {
      await expect(
        registry.connect(carol).registerIdentity(ZeroHash, { value: MIN_STAKE })
      ).to.be.revertedWithCustomError(registry, 'ZeroCommitment');
    });
  });

  // ── verifyIdentity ─────────────────────────────────────────────────────────

  describe('verifyIdentity()', () => {

    it('returns true for registered wallet', async () => {
      expect(await registry.verifyIdentity(alice.address)).to.be.true;
    });

    it('returns false for unregistered wallet', async () => {
      expect(await registry.verifyIdentity(carol.address)).to.be.false;
    });
  });

  // ── getLinkedWallets ───────────────────────────────────────────────────────

  describe('getLinkedWallets()', () => {

    it('returns registrant as first linked wallet', async () => {
      const wallets = await registry.getLinkedWallets(aliceCommitment);
      expect(wallets[0]).to.equal(alice.address);
    });
  });

  // ── unlinkWallet ───────────────────────────────────────────────────────────

  describe('unlinkWallet()', () => {

    it('reverts: cannot unlink last wallet', async () => {
      await expect(
        registry.connect(alice).unlinkWallet()
      ).to.be.revertedWithCustomError(registry, 'CannotUnlinkLastWallet');
    });

    it('reverts: wallet not linked', async () => {
      await expect(
        registry.connect(carol).unlinkWallet()
      ).to.be.revertedWithCustomError(registry, 'WalletNotLinked');
    });
  });

  // ── deactivateIdentity ─────────────────────────────────────────────────────

  describe('deactivateIdentity()', () => {

    it('deactivates identity and returns stake', async () => {
      // Register carol first
      await registry.connect(carol).registerIdentity(carolCommitment, { value: MIN_STAKE });
      expect(await registry.verifyIdentity(carol.address)).to.be.true;

      const balanceBefore = await ethers.provider.getBalance(carol.address);
      const tx     = await registry.connect(carol).deactivateIdentity();
      const receipt = await tx.wait();
      const gasUsed = receipt.gasUsed * receipt.gasPrice;
      const balanceAfter = await ethers.provider.getBalance(carol.address);

      // Balance should increase by stake minus gas
      expect(balanceAfter).to.be.closeTo(
        balanceBefore + MIN_STAKE - gasUsed,
        parseEther('0.001') // tolerance for gas estimation
      );
    });

    it('marks identity as inactive', async () => {
      expect(await registry.verifyIdentity(carol.address)).to.be.false;
    });

    it('zeroes the stake', async () => {
      expect(await registry.getIdentityStake(carol.address)).to.equal(0);
    });

    it('preserves commitment', async () => {
      expect(await registry.getCommitment(carol.address)).to.equal(carolCommitment);
    });

    it('preserves linked wallets', async () => {
      const wallets = await registry.getLinkedWallets(carolCommitment);
      expect(wallets).to.include(carol.address);
    });

    it('reverts: not linked to any identity', async () => {
      const [,,,, stranger] = await ethers.getSigners();
      await expect(
        registry.connect(stranger).deactivateIdentity()
      ).to.be.revertedWithCustomError(registry, 'WalletNotLinked');
    });

    it('reverts: already inactive', async () => {
      await expect(
        registry.connect(carol).deactivateIdentity()
      ).to.be.revertedWithCustomError(registry, 'IdentityNotActive');
    });
  });

  // ── reactivateIdentity ─────────────────────────────────────────────────────

  describe('reactivateIdentity()', () => {

    it('reactivates with new stake', async () => {
      await registry.connect(carol).reactivateIdentity({ value: MIN_STAKE });
      expect(await registry.verifyIdentity(carol.address)).to.be.true;
    });

    it('stores new stake amount', async () => {
      expect(await registry.getIdentityStake(carol.address)).to.equal(MIN_STAKE);
    });

    it('preserves commitment after reactivation', async () => {
      expect(await registry.getCommitment(carol.address)).to.equal(carolCommitment);
    });

    it('reverts: already active', async () => {
      await expect(
        registry.connect(carol).reactivateIdentity({ value: MIN_STAKE })
      ).to.be.revertedWithCustomError(registry, 'IdentityAlreadyActive');
    });

    it('reverts: stake below minimum on reactivation', async () => {
      // Deactivate first
      await registry.connect(carol).deactivateIdentity();
      await expect(
        registry.connect(carol).reactivateIdentity({ value: 1n })
      ).to.be.revertedWithCustomError(registry, 'InsufficientStake');
      // Restore for subsequent tests
      await registry.connect(carol).reactivateIdentity({ value: MIN_STAKE });
    });

    it('reverts: cannot re-register same commitment (use reactivate instead)', async () => {
      await expect(
        registry.connect(carol).registerIdentity(carolCommitment, { value: MIN_STAKE })
      ).to.be.revertedWithCustomError(registry, 'CommitmentAlreadyRegistered');
    });
  });

  // ── Admin ──────────────────────────────────────────────────────────────────

  describe('Admin', () => {

    it('admin can update minimum stake', async () => {
      const newStake = parseEther('0.02');
      await registry.connect(admin).setMinimumStake(newStake);
      expect(await registry.minimumStake()).to.equal(newStake);
      // Reset
      await registry.connect(admin).setMinimumStake(MIN_STAKE);
    });

    it('non-admin cannot update minimum stake', async () => {
      await expect(
        registry.connect(alice).setMinimumStake(1n)
      ).to.be.reverted;
    });

    it('pause blocks registerIdentity', async () => {
      await registry.connect(admin).pause();
      const [,,,, stranger] = await ethers.getSigners();
      await expect(
        registry.connect(stranger).registerIdentity(
          keccak256(toUtf8Bytes('stranger')),
          { value: MIN_STAKE }
        )
      ).to.be.revertedWithCustomError(registry, 'EnforcedPause');
      await registry.connect(admin).unpause();
    });

    it('pause blocks deactivateIdentity', async () => {
      await registry.connect(admin).pause();
      await expect(
        registry.connect(alice).deactivateIdentity()
      ).to.be.revertedWithCustomError(registry, 'EnforcedPause');
      await registry.connect(admin).unpause();
    });
  });
});
