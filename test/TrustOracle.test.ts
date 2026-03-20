import { expect } from 'chai';
import { ethers } from 'hardhat';
import { SignerWithAddress } from '@nomicfoundation/hardhat-ethers/signers';
import { parseEther, keccak256, toUtf8Bytes, ZeroHash } from 'ethers';

function makeCommitment(label: string): string {
  return keccak256(toUtf8Bytes(label));
}

describe('TrustOracle', () => {

  let registry:   any;
  let reputation: any;
  let oracle:     any;
  let admin:      SignerWithAddress;
  let alice:      SignerWithAddress;
  let bob:        SignerWithAddress;

  const MIN_STAKE          = parseEther('0.01');
  const REPUTATION_UPDATER = keccak256(toUtf8Bytes('REPUTATION_UPDATER'));
  const aliceCommitment    = makeCommitment('oracle-alice');

  before(async () => {
    [admin, alice, bob] = await ethers.getSigners();

    // Deploy ZKTranscriptLib + WalletLinkVerifier
    const LibFactory = await ethers.getContractFactory(
      'contracts/WalletLinkVerifier.sol:ZKTranscriptLib'
    );
    const zkLib = await LibFactory.deploy();
    await zkLib.waitForDeployment();

    const VerifierFactory = await ethers.getContractFactory('WalletLinkVerifier', {
      libraries: {
        'contracts/WalletLinkVerifier.sol:ZKTranscriptLib': await zkLib.getAddress(),
      },
    });
    const verifier = await VerifierFactory.deploy();
    await verifier.waitForDeployment();

    // Deploy IdentityRegistry
    const RegistryFactory = await ethers.getContractFactory('IdentityRegistry');
    registry = await RegistryFactory.deploy(MIN_STAKE, await verifier.getAddress(), admin.address);
    await registry.waitForDeployment();

    // Deploy ReputationRegistry — now takes IdentityRegistry address as second arg
    const ReputationFactory = await ethers.getContractFactory('ReputationRegistry');
    reputation = await ReputationFactory.deploy(
      admin.address,
      await registry.getAddress()
    );
    await reputation.waitForDeployment();

    // Deploy OrganizerRegistry
    const OrganizerFactory = await ethers.getContractFactory('OrganizerRegistry');
    const organizerRegistry = await OrganizerFactory.deploy(admin.address);
    await organizerRegistry.waitForDeployment();

    // Deploy TrustOracle — now takes OrganizerRegistry as 3rd arg
    const OracleFactory = await ethers.getContractFactory('TrustOracle');
    oracle = await OracleFactory.deploy(
      await registry.getAddress(),
      await reputation.getAddress(),
      await organizerRegistry.getAddress(),
      admin.address
    );
    await oracle.waitForDeployment();

    // Grant roles and set up state
    await reputation.connect(admin).grantRole(REPUTATION_UPDATER, admin.address);
    await registry.connect(alice).registerIdentity(aliceCommitment, { value: MIN_STAKE });
    await reputation.connect(admin).addGlobalReputation(aliceCommitment, 250);
  });

  describe('verifyIdentity()', () => {

    it('returns false for unregistered wallet', async () => {
      expect(await oracle.verifyIdentity(bob.address)).to.be.false;
    });

    it('returns true for registered wallet', async () => {
      expect(await oracle.verifyIdentity(alice.address)).to.be.true;
    });
  });

  describe('getTrustProfile()', () => {

    it('returns empty profile for unregistered wallet', async () => {
      const profile = await oracle.getTrustProfile(bob.address);
      expect(profile.isRegistered).to.be.false;
      expect(profile.stake).to.equal(0);
      expect(profile.globalReputation).to.equal(0);
      expect(profile.commitment).to.equal(ZeroHash);
    });

    it('returns full profile for registered wallet', async () => {
      const profile = await oracle.getTrustProfile(alice.address);
      expect(profile.isRegistered).to.be.true;
      expect(profile.stake).to.equal(MIN_STAKE);
      expect(profile.globalReputation).to.equal(250);
      expect(profile.commitment).to.equal(aliceCommitment);
      expect(profile.linkedWalletCount).to.equal(1);
    });
  });

  describe('meetsRequirements()', () => {

    it('passes with zero requirements', async () => {
      expect(await oracle.meetsRequirements(alice.address, 0, 0)).to.be.true;
    });

    it('passes when all requirements met', async () => {
      expect(await oracle.meetsRequirements(alice.address, MIN_STAKE, 100)).to.be.true;
    });

    it('fails when stake too low', async () => {
      expect(
        await oracle.meetsRequirements(alice.address, parseEther('1.0'), 0)
      ).to.be.false;
    });

    it('fails when reputation too low', async () => {
      expect(
        await oracle.meetsRequirements(alice.address, 0, 500)
      ).to.be.false;
    });

    it('fails for unregistered wallet', async () => {
      expect(await oracle.meetsRequirements(bob.address, 0, 0)).to.be.false;
    });
  });

  describe('Admin', () => {

    it('owner can update identity registry', async () => {
      const newAddr = ethers.Wallet.createRandom().address;
      await expect(oracle.connect(admin).setIdentityRegistry(newAddr))
        .to.emit(oracle, 'RegistryUpdated');
      // Reset
      await oracle.connect(admin).setIdentityRegistry(await registry.getAddress());
    });

    it('non-owner cannot update identity registry', async () => {
      await expect(
        oracle.connect(alice).setIdentityRegistry(ethers.Wallet.createRandom().address)
      ).to.be.reverted;
    });
  });
});
