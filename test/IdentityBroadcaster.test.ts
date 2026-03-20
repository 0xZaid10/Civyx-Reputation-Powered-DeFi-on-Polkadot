import { expect }               from 'chai';
import { ethers, network }      from 'hardhat';
import { SignerWithAddress }     from '@nomicfoundation/hardhat-ethers/signers';
import { parseEther, keccak256, toUtf8Bytes, ZeroHash } from 'ethers';
import { waitForTx, isLiveNetwork, sleep } from './helpers';

describe('IdentityBroadcaster', () => {

  let broadcaster:        any;
  let identityRegistry:   any;
  let reputationRegistry: any;
  let trustOracle:        any;
  let organizerRegistry:  any;
  let mockVerifier:       any;
  let mockXcm:            any;

  let admin:  SignerWithAddress;
  let alice:  SignerWithAddress;
  let bob:    SignerWithAddress;
  let carol:  SignerWithAddress;

  const MIN_STAKE       = parseEther('0.01');
  const aliceCommitment = keccak256(toUtf8Bytes('alice-broadcaster-secret'));
  const bobCommitment   = keccak256(toUtf8Bytes('bob-broadcaster-secret'));
  const TEST_MSG        = '0x04040100000000';

  before(async () => {
    [admin, alice, bob, carol] = await ethers.getSigners();

    const MockVerifier = await ethers.getContractFactory('MockVerifier');
    mockVerifier = await MockVerifier.deploy();
    await mockVerifier.waitForDeployment();
    if (isLiveNetwork()) await sleep(3000);

    const MockXcm = await ethers.getContractFactory('MockXcm');
    mockXcm = await MockXcm.deploy();
    await mockXcm.waitForDeployment();
    if (isLiveNetwork()) await sleep(3000);

    const IdentityRegistry = await ethers.getContractFactory('IdentityRegistry');
    identityRegistry = await IdentityRegistry.deploy(MIN_STAKE, await mockVerifier.getAddress(), admin.address);
    await identityRegistry.waitForDeployment();
    if (isLiveNetwork()) await sleep(3000);

    const ReputationRegistry = await ethers.getContractFactory('ReputationRegistry');
    reputationRegistry = await ReputationRegistry.deploy(admin.address, await identityRegistry.getAddress());
    await reputationRegistry.waitForDeployment();
    if (isLiveNetwork()) await sleep(3000);

    const OrganizerRegistry = await ethers.getContractFactory('OrganizerRegistry');
    organizerRegistry = await OrganizerRegistry.deploy(admin.address);
    await organizerRegistry.waitForDeployment();
    if (isLiveNetwork()) await sleep(3000);

    const TrustOracle = await ethers.getContractFactory('TrustOracle');
    trustOracle = await TrustOracle.deploy(
      await identityRegistry.getAddress(),
      await reputationRegistry.getAddress(),
      await organizerRegistry.getAddress(),
      admin.address
    );
    await trustOracle.waitForDeployment();
    if (isLiveNetwork()) await sleep(3000);

    const Broadcaster = await ethers.getContractFactory('IdentityBroadcaster');
    broadcaster = await Broadcaster.deploy(await trustOracle.getAddress(), admin.address);
    await broadcaster.waitForDeployment();
    if (isLiveNetwork()) await sleep(3000);

    await waitForTx(broadcaster.connect(admin).setXcm(await mockXcm.getAddress()));
    if (isLiveNetwork()) await sleep(3000);

    await waitForTx(
      identityRegistry.connect(alice).registerIdentity(aliceCommitment, { value: MIN_STAKE })
    );
    if (isLiveNetwork()) await sleep(3000);
  });

  // ── deployment ──────────────────────────────────────────────────────────────

  describe('deployment', () => {
    it('sets trustOracle correctly', async () => {
      expect(await broadcaster.trustOracle()).to.equal(await trustOracle.getAddress());
    });
    it('sets default broadcastCooldown to 100 blocks', async () => {
      expect(await broadcaster.broadcastCooldown()).to.equal(100n);
    });
    it('totalBroadcasts starts at 0', async () => {
      expect(await broadcaster.totalBroadcasts()).to.equal(0n);
    });
  });

  // ── prepareSnapshot ─────────────────────────────────────────────────────────

  describe('prepareSnapshot()', () => {
    it('returns correct commitment for alice', async () => {
      const prep = await broadcaster.prepareSnapshot(alice.address);
      expect(prep.snapshot.commitment).to.equal(aliceCommitment);
    });
    it('returns correct stake', async () => {
      const prep = await broadcaster.prepareSnapshot(alice.address);
      expect(prep.snapshot.stake).to.equal(MIN_STAKE);
    });
    it('returns active = true', async () => {
      const prep = await broadcaster.prepareSnapshot(alice.address);
      expect(prep.snapshot.active).to.be.true;
    });
    it('returns walletCount = 1', async () => {
      const prep = await broadcaster.prepareSnapshot(alice.address);
      expect(prep.snapshot.walletCount).to.equal(1n);
    });
    it('returns nativeBalance > 0', async () => {
      const prep = await broadcaster.prepareSnapshot(alice.address);
      expect(prep.snapshot.nativeBalance).to.be.gt(0n);
    });
    it('returns xcmMessage as non-empty bytes', async () => {
      const prep = await broadcaster.prepareSnapshot(alice.address);
      expect(prep.xcmMessage.length).to.be.gt(2);
    });
    it('xcmMessage starts with V5 byte 0x05', async () => {
      const prep = await broadcaster.prepareSnapshot(alice.address);
      expect(prep.xcmMessage.slice(0, 4)).to.equal('0x05');
    });
    it('returns xcmWeight from MockXcm', async () => {
      const prep = await broadcaster.prepareSnapshot(alice.address);
      expect(prep.xcmWeight.refTime).to.equal(1_830_000n);
    });
    it('canBroadcast = true on first call', async () => {
      const prep = await broadcaster.prepareSnapshot(alice.address);
      expect(prep.canBroadcast).to.be.true;
    });
    it('cooldownRemaining = 0 on first call', async () => {
      const prep = await broadcaster.prepareSnapshot(alice.address);
      expect(prep.cooldownRemaining).to.equal(0n);
    });
    it('returns zeroed snapshot for unregistered wallet', async () => {
      const prep = await broadcaster.prepareSnapshot(carol.address);
      expect(prep.snapshot.commitment).to.equal(ZeroHash);
      expect(prep.canBroadcast).to.be.false;
    });
  });

  // ── broadcastIdentity (Option B step 1) ─────────────────────────────────────

  describe('broadcastIdentity()', () => {
    it('reverts for unregistered wallet', async () => {
      const prep = await broadcaster.prepareSnapshot(carol.address);
      await expect(
        broadcaster.connect(carol).broadcastIdentity(1000, prep.xcmMessage)
      ).to.be.revertedWithCustomError(broadcaster, 'NotRegistered');
    });

    it('succeeds for alice', async () => {
      const prep = await broadcaster.prepareSnapshot(alice.address);
      await expect(
        waitForTx(broadcaster.connect(alice).broadcastIdentity(1000, prep.xcmMessage))
      ).to.not.be.reverted;
      if (isLiveNetwork()) await sleep(3000);
    });

    it('increments totalBroadcasts', async () => {
      expect(await broadcaster.totalBroadcasts()).to.equal(1n);
    });

    it('increments broadcastCount for alice', async () => {
      expect(await broadcaster.broadcastCount(aliceCommitment)).to.equal(1n);
    });

    it('emits IdentityBroadcast event', async () => {
      await waitForTx(broadcaster.connect(admin).setBroadcastCooldown(0));
      if (isLiveNetwork()) await sleep(3000);
      const prep = await broadcaster.prepareSnapshot(alice.address);
      await expect(
        broadcaster.connect(alice).broadcastIdentity(2004, prep.xcmMessage)
      ).to.emit(broadcaster, 'IdentityBroadcast')
       .withArgs(aliceCommitment, alice.address, 2004, (snap: any) => snap.active === true);
    });

    it('restores cooldown to 100 after event test', async () => {
      // Restore cooldown AND do one more broadcast so cooldown is active
      await waitForTx(broadcaster.connect(admin).setBroadcastCooldown(100));
      if (isLiveNetwork()) await sleep(3000);
      const prep = await broadcaster.prepareSnapshot(alice.address);
      // alice just broadcast with cooldown=0, now cooldown=100 — she is already on cooldown
      // Just verify cooldown is back to 100
      expect(await broadcaster.broadcastCooldown()).to.equal(100n);
    });

    it('does NOT call MockXcm.send or execute (contract only emits event)', async () => {
      const callsBefore = await mockXcm.callCount();
      // broadcastIdentity doesn't touch XCM precompile at all now
      expect(callsBefore).to.equal(0n);
    });
  });

  // ── Cooldown ────────────────────────────────────────────────────────────────

  describe('cooldown enforcement', () => {
    it('canBroadcast = false after broadcast', async () => {
      const prep = await broadcaster.prepareSnapshot(alice.address);
      expect(prep.canBroadcast).to.be.false;
      expect(prep.cooldownRemaining).to.be.gt(0n);
    });

    it('broadcastIdentity reverts with BroadcastCooldownActive', async () => {
      const prep = await broadcaster.prepareSnapshot(alice.address);
      await expect(
        broadcaster.connect(alice).broadcastIdentity(1000, prep.xcmMessage)
      ).to.be.revertedWithCustomError(broadcaster, 'BroadcastCooldownActive');
    });

    it('allows broadcast after cooldown set to 0', async () => {
      await waitForTx(broadcaster.connect(admin).setBroadcastCooldown(0));
      if (isLiveNetwork()) await sleep(3000);
      const prep = await broadcaster.prepareSnapshot(alice.address);
      await expect(
        waitForTx(broadcaster.connect(alice).broadcastIdentity(1000, prep.xcmMessage))
      ).to.not.be.reverted;
      if (isLiveNetwork()) await sleep(3000);
      await waitForTx(broadcaster.connect(admin).setBroadcastCooldown(100));
      if (isLiveNetwork()) await sleep(3000);
    });
  });

  // ── Bob independent ─────────────────────────────────────────────────────────

  describe('bob registers and broadcasts independently', () => {
    before(async () => {
      await waitForTx(
        identityRegistry.connect(bob).registerIdentity(bobCommitment, { value: MIN_STAKE })
      );
      if (isLiveNetwork()) await sleep(3000);
    });

    it('bob can broadcast independently', async () => {
      const prep = await broadcaster.prepareSnapshot(bob.address);
      await expect(
        waitForTx(broadcaster.connect(bob).broadcastIdentity(1000, prep.xcmMessage))
      ).to.not.be.reverted;
      if (isLiveNetwork()) await sleep(3000);
    });

    it('totalBroadcasts tracks all', async () => {
      expect(await broadcaster.totalBroadcasts()).to.be.gte(3n);
    });
  });

  // ── Admin ───────────────────────────────────────────────────────────────────

  describe('admin functions', () => {
    it('non-owner cannot setTrustOracle', async () => {
      await expect(broadcaster.connect(alice).setTrustOracle(alice.address)).to.be.reverted;
    });
    it('non-owner cannot setBroadcastCooldown', async () => {
      await expect(broadcaster.connect(alice).setBroadcastCooldown(0)).to.be.reverted;
    });
    it('non-owner cannot setXcm', async () => {
      await expect(broadcaster.connect(alice).setXcm(alice.address)).to.be.reverted;
    });
    it('owner can update cooldown and emit event', async () => {
      await expect(broadcaster.connect(admin).setBroadcastCooldown(200))
        .to.emit(broadcaster, 'CooldownUpdated').withArgs(100n, 200n);
      await waitForTx(broadcaster.connect(admin).setBroadcastCooldown(100));
      if (isLiveNetwork()) await sleep(3000);
    });
    it('setTrustOracle reverts on zero address', async () => {
      await expect(
        broadcaster.connect(admin).setTrustOracle(ethers.ZeroAddress)
      ).to.be.revertedWithCustomError(broadcaster, 'ZeroAddress');
    });
    it('setXcm reverts on zero address', async () => {
      await expect(
        broadcaster.connect(admin).setXcm(ethers.ZeroAddress)
      ).to.be.revertedWithCustomError(broadcaster, 'ZeroAddress');
    });
  });
});
