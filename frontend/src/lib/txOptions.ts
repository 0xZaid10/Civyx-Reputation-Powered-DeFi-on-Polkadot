// Polkadot Hub requires type 0 legacy transactions.
// gasPrice must equal block base fee (1000 gwei).
// Without explicit gas settings, MetaMask shows absurd fee estimates.

export const TX_OPTIONS = {
  gas:      300000n,
  gasPrice: 1000000000000n, // 1000 gwei
} as const;
