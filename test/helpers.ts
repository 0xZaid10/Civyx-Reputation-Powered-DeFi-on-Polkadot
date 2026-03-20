import { ethers, network } from 'hardhat';

/**
 * Returns true if running against a live network (not local Hardhat).
 * Used to add delays between transactions on testnet.
 */
export function isLiveNetwork(): boolean {
  return network.name !== 'hardhat' && network.name !== 'localhost';
}

/**
 * On live networks, wait for a transaction to be mined before proceeding.
 * On local Hardhat network, this is a no-op.
 */
export async function waitForTx(txPromise: Promise<any>): Promise<any> {
  const tx = await txPromise;
  if (isLiveNetwork() && tx.wait) {
    await tx.wait(1);
  }
  return tx;
}

/**
 * Deploy a contract and wait for it to be mined on live networks.
 */
export async function deployAndWait(factory: any, args: any[] = []): Promise<any> {
  const contract = await factory.deploy(...args);
  await contract.waitForDeployment();
  return contract;
}

/**
 * Sleep for ms milliseconds — used between deployments on testnet
 * to avoid nonce collisions.
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
