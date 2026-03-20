import { ethers } from 'hardhat';
import { Barretenberg, UltraHonkBackend } from '@aztec/bb.js';
import { Noir } from '@noir-lang/noir_js';
import fs from 'fs';
import path from 'path';

async function main() {
  const verifier = await ethers.getContractAt('WalletLinkVerifier', '0xb7568B0281C1D35A04aF796844C5Dcfff8E53aCf');
  const registry = await ethers.getContractAt('IdentityRegistry',   '0x70EdA143E87481Befd349367dA12E03145655cB0');

  const BN254_MOD = 21888242871839275222246405745257275088548364400416034343698204186575808495617n;
  const circuit   = JSON.parse(fs.readFileSync(
    path.join(__dirname, '../circuits/target/wallet.json'), 'utf8'
  ));

  const secret     = '0x0ee4c4d32a3b877e700796a25b710576b2e9b093f796c56a923b7e6b7e0cf1c5';
  const commitment = '0x1bd3f634d2cec51dd349a9872637f637f25e3e48fd5f0ee11562dca720820444';
  const nullifier  = '0x036a0fb894db29f2642ec1299f945e8954093630a2493486855fe11c2f402d44';
  const wallet     = '0xD37c015359a7D45b296fdd6a1CAAEE323c6E77c0';

  const inputs = {
    secret:         (BigInt(secret) % BN254_MOD).toString(),
    commitment:     (BigInt(commitment) % BN254_MOD).toString(),
    nullifier:      (BigInt(nullifier) % BN254_MOD).toString(),
    wallet_address: (BigInt(wallet) % BN254_MOD).toString(),
  };

  console.log('Generating proof on node...');
  // Import AsyncApi from node cbind path
  const { AsyncApi } = await import(
    '../node_modules/@aztec/bb.js/dest/node/cbind/generated/async.js' as any
  );

  const bar     = await (Barretenberg as any).new(1);
  const api     = new AsyncApi(bar.backend);
  const backend = new UltraHonkBackend(circuit.bytecode, api);
  const noir    = new Noir(circuit);
  await noir.init();

  const { witness } = await noir.execute(inputs);
  console.log('Witness length:', witness.length);

  const { proof } = await backend.generateProof(witness, { keccak: true });
  const proofHex  = '0x' + Buffer.from(proof).toString('hex');
  console.log('Proof length (bytes):', proof.length);

  // Build publicInputs[19] — exactly as IdentityRegistry.linkWallet() does internally
  const walletPadded = ('0x' + wallet.slice(2).toLowerCase().padStart(64, '0')) as `0x${string}`;
  const ZERO64 = ('0x' + '0'.repeat(64)) as `0x${string}`;
  const publicInputs: string[] = [
    commitment,
    nullifier,
    walletPadded,
    ...Array(16).fill(ZERO64),
  ];
  console.log('publicInputs.length:', publicInputs.length);
  console.log('publicInputs[0] (commitment):', publicInputs[0]);
  console.log('publicInputs[1] (nullifier): ', publicInputs[1]);
  console.log('publicInputs[2] (wallet):    ', publicInputs[2]);

  // 1. Test verifier directly
  console.log('\n--- Testing WalletLinkVerifier.verify() directly ---');
  try {
    const valid = await verifier.verify(proofHex, publicInputs);
    console.log('✅ verify() =', valid);
  } catch(e: any) {
    console.log('❌ verify() reverted:', e.message.slice(0, 300));
  }

  // 2. Test linkWallet via IdentityRegistry
  console.log('\n--- Testing IdentityRegistry.linkWallet() ---');
  const walletSigner = new ethers.Wallet(
    '1274743e5c048873405e6dd5c38b1b04042c80c06da55cfe7010e1070844cdb7',
    ethers.provider
  );
  const block = await ethers.provider.getBlock('latest');
  const gas   = { type: 0, gasPrice: block!.baseFeePerGas! };

  console.log('Wallet:', walletSigner.address);
  console.log('Wallet commitment on-chain:', await registry.getCommitment(walletSigner.address));

  try {
    const tx      = await registry.connect(walletSigner).linkWallet(commitment, proofHex, nullifier, gas);
    const receipt = await tx.wait(1);
    console.log('✅ linkWallet success! Tx:', receipt!.hash);
  } catch(e: any) {
    console.log('❌ linkWallet reverted:', e.message.slice(0, 300));
  }

  await bar.destroy();
}

main().catch(console.error);
