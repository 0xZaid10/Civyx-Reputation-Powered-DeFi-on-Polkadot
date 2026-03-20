import { defineChain } from 'viem';
import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { http } from 'wagmi';

export const polkadotHubTestnet = defineChain({
  id: 420420417,
  name: 'Polkadot Hub Testnet',
  nativeCurrency: {
    name: 'PAS',
    symbol: 'PAS',
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: [
        'https://eth-rpc-testnet.polkadot.io',
        'https://services.polkadothub-rpc.com/testnet',
      ],
    },
  },
  blockExplorers: {
    default: {
      name: 'Blockscout',
      url: 'https://blockscout-testnet.polkadot.io',
    },
  },
  testnet: true,
});

export const wagmiConfig = getDefaultConfig({
  appName:   'Civyx',
  projectId: '0d1a015844b6a50471066ed5551f3fda',
  chains:    [polkadotHubTestnet],
  transports: {
    [polkadotHubTestnet.id]: http(),
  },
  ssr: false,
});
