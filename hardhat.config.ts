import type { HardhatUserConfig } from 'hardhat/config';
import '@nomicfoundation/hardhat-toolbox';
import '@nomicfoundation/hardhat-verify';
import { vars } from 'hardhat/config';

const PRIVATE_KEY = vars.get(
  'PRIVATE_KEY',
  '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80'
);

const config: HardhatUserConfig = {
  solidity: {
    compilers: [
      {
        version: '0.8.28',
        settings: {
          optimizer: { enabled: true, runs: 200 },
          viaIR: true,
        },
      },
    ],
    overrides: {
      'contracts/WalletLinkVerifier.sol': {
        version: '0.8.28',
        settings: { optimizer: { enabled: true, runs: 1 }, viaIR: false },
      },
      'contracts/NullifierVerifier.sol': {
        version: '0.8.28',
        settings: { optimizer: { enabled: true, runs: 1 }, viaIR: false },
      },
      'contracts/IdentityVerifier.sol': {
        version: '0.8.28',
        settings: { optimizer: { enabled: true, runs: 1 }, viaIR: false },
      },
    },
  },

  networks: {
    polkadotTestnet: {
      url:           'https://eth-rpc-testnet.polkadot.io',
      chainId:       420420417,
      accounts:      [PRIVATE_KEY, '0x7ce63e2a2e20eb1bda7a09157916dc7523dac692df6d48552a39531156f7a933'],
      timeout:       120000
    },
    localNode: {
      url:      'http://127.0.0.1:8545',
      chainId:  420420420,
      accounts: [PRIVATE_KEY],
    },
  },

  etherscan: {
    apiKey: { polkadotTestnet: 'no-api-key-needed' },
    customChains: [
      {
        network: 'polkadotTestnet',
        chainId: 420420417,
        urls: {
          apiURL:     'https://blockscout-testnet.polkadot.io/api',
          browserURL: 'https://blockscout-testnet.polkadot.io/',
        },
      },
    ],
  },

  ignition: {
    requiredConfirmations: 1,
  },

  mocha: {
    timeout: 300000, // 5 minutes per test — needed for testnet block times
  },
};

export default config;
