// Civyx — Contract addresses and ABIs
// Polkadot Hub TestNet (Chain ID: 420420417)
// Deployed: March 15–19, 2026

export const CONTRACTS = {
  // ── Core identity & reputation ─────────────────────────────────────────────
  IdentityRegistry:       '0x56BBC4969818d4E27Fe39983f8aDee4F3e1C5c6f',
  ReputationRegistry:     '0xa9FCD9102fbe420a40B380a891f94a3Fc1D4Fb2c',
  OrganizerRegistry:      '0x8A472Ca618c74FdF270A9A75bE6034a7d98BB9B9',
  TrustOracle:            '0xe6aD6C8f4943CC39b5dFb46FB88a1597bdF4b467',
  IdentityBroadcaster:    '0x9A5710098B845e7841E1D09E1bde0dC1e30374AC',
  // ── ZK verifiers ──────────────────────────────────────────────────────────
  WalletLinkVerifier:     '0x72CC5BA2958CB688B00dFE2E578Db3BbB79eD311',
  NullifierVerifier:      '0x0454a4798602babb16529F49920E8B2f4a747Bb2',
  IdentityVerifier:       '0xa2Cd20296027836dbD67874Ebd4a11Eeede292C8',
  IdentityVerifierRouter: '0xC2D5F1C13e2603624a717409356DD48253f17319',
  // ── Task reward system ─────────────────────────────────────────────────────
  TaskRewardDispenser:    '0xF5971713619e7622e82f329a3f46B7280E781c58',
  RegisterIdentityTask:   '0x2b17aDAcd236a6A1641be06f1Ba8F5257109Cce6',
  StakeMilestoneTask:     '0x1825B4c62A70f5E53323F1b3fEAAA22F451E033b',
  GovernanceVoteTask:     '0x5f9dD176ea5282d392225ceC5c2E7A24d5d02672',
  AirdropClaimTask:       '0x2C834EFcDd2E9D04C1a34367BA9D8aa587F90fBe',
  CommunityDrop:          '0x3A5fBC501c5D515383fADFf5ebD92C393f5eFee9',
  ExternalTaskVerifier:   '0x434F288ff599e1f56fe27CF372be2941543b4171',
  CivUSD:                 '0xa3ce5424489ed5D8cff238009c61ab48Ef852F6D',
} as const;

export const BLOCKSCOUT = 'https://blockscout-testnet.polkadot.io';
export const blockscoutAddress = (a: string) => `${BLOCKSCOUT}/address/${a}`;
export const blockscoutTx      = (h: string) => `${BLOCKSCOUT}/tx/${h}`;

// ── ABIs ──────────────────────────────────────────────────────────────────────

export const IDENTITY_REGISTRY_ABI = [
  { name: 'registerIdentity', type: 'function', stateMutability: 'payable',
    inputs: [{ name: 'commitment', type: 'bytes32' }], outputs: [] },
  { name: 'linkWallet', type: 'function', stateMutability: 'nonpayable',
    inputs: [
      { name: 'commitment', type: 'bytes32' },
      { name: 'proof',      type: 'bytes'   },
      { name: 'nullifier',  type: 'bytes32' },
    ], outputs: [] },
  { name: 'unlinkWallet', type: 'function', stateMutability: 'nonpayable',
    inputs: [], outputs: [] },
  { name: 'deactivateIdentity', type: 'function', stateMutability: 'nonpayable',
    inputs: [], outputs: [] },
  { name: 'reactivateIdentity', type: 'function', stateMutability: 'payable',
    inputs: [], outputs: [] },
  { name: 'addStake', type: 'function', stateMutability: 'payable',
    inputs: [], outputs: [] },
  { name: 'withdrawStake', type: 'function', stateMutability: 'nonpayable',
    inputs: [{ name: 'amount', type: 'uint256' }], outputs: [] },
  { name: 'verifyIdentity', type: 'function', stateMutability: 'view',
    inputs: [{ name: 'wallet', type: 'address' }], outputs: [{ type: 'bool' }] },
  { name: 'getCommitment', type: 'function', stateMutability: 'view',
    inputs: [{ name: 'wallet', type: 'address' }], outputs: [{ type: 'bytes32' }] },
  { name: 'getIdentityStake', type: 'function', stateMutability: 'view',
    inputs: [{ name: 'wallet', type: 'address' }], outputs: [{ type: 'uint256' }] },
  { name: 'getLinkedWalletCount', type: 'function', stateMutability: 'view',
    inputs: [{ name: 'wallet', type: 'address' }], outputs: [{ type: 'uint256' }] },
  { name: 'getLinkedWallets', type: 'function', stateMutability: 'view',
    inputs: [{ name: 'commitment', type: 'bytes32' }], outputs: [{ type: 'address[]' }] },
  { name: 'minimumStake', type: 'function', stateMutability: 'view',
    inputs: [], outputs: [{ type: 'uint256' }] },
  { name: 'getIdentity', type: 'function', stateMutability: 'view',
    inputs: [{ name: 'commitment', type: 'bytes32' }],
    outputs: [{ type: 'tuple', components: [
      { name: 'commitment',   type: 'bytes32' },
      { name: 'stake',        type: 'uint256' },
      { name: 'createdBlock', type: 'uint256' },
      { name: 'walletCount',  type: 'uint256' },
      { name: 'active',       type: 'bool'    },
    ]}] },
] as const;

export const TRUST_ORACLE_ABI = [
  { name: 'getTrustProfile', type: 'function', stateMutability: 'view',
    inputs: [{ name: 'wallet', type: 'address' }],
    outputs: [{ type: 'tuple', components: [
      { name: 'isRegistered',        type: 'bool'    },
      { name: 'stake',               type: 'uint256' },
      { name: 'globalReputation',    type: 'uint256' },
      { name: 'effectiveReputation', type: 'uint256' },
      { name: 'endorsementCount',    type: 'uint256' },
      { name: 'linkedWalletCount',   type: 'uint256' },
      { name: 'commitment',          type: 'bytes32' },
    ]}] },
  { name: 'meetsRequirements', type: 'function', stateMutability: 'view',
    inputs: [
      { name: 'wallet',        type: 'address' },
      { name: 'minStake',      type: 'uint256' },
      { name: 'minReputation', type: 'uint256' },
    ], outputs: [{ type: 'bool' }] },
  { name: 'meetsOrganizerRequirements', type: 'function', stateMutability: 'view',
    inputs: [
      { name: 'wallet', type: 'address' },
      { name: 'orgId',  type: 'bytes32' },
    ], outputs: [{ type: 'bool' }] },
  { name: 'getOrganizerRequirements', type: 'function', stateMutability: 'view',
    inputs: [{ name: 'orgId', type: 'bytes32' }],
    outputs: [
      { name: 'minStake',      type: 'uint256' },
      { name: 'minReputation', type: 'uint256' },
    ] },
  { name: 'verifyIdentity', type: 'function', stateMutability: 'view',
    inputs: [{ name: 'wallet', type: 'address' }], outputs: [{ type: 'bool' }] },
  { name: 'getEffectiveReputation', type: 'function', stateMutability: 'view',
    inputs: [{ name: 'wallet', type: 'address' }], outputs: [{ type: 'uint256' }] },
  { name: 'getLocalReputation', type: 'function', stateMutability: 'view',
    inputs: [
      { name: 'appId',  type: 'bytes32' },
      { name: 'wallet', type: 'address' },
    ], outputs: [{ type: 'uint256' }] },
] as const;

export const REPUTATION_REGISTRY_ABI = [
  { name: 'globalReputation', type: 'function', stateMutability: 'view',
    inputs: [{ name: 'commitment', type: 'bytes32' }], outputs: [{ type: 'uint256' }] },
  { name: 'getEffectiveReputation', type: 'function', stateMutability: 'view',
    inputs: [{ name: 'commitment', type: 'bytes32' }], outputs: [{ type: 'uint256' }] },
  { name: 'endorsementCount', type: 'function', stateMutability: 'view',
    inputs: [{ name: 'commitment', type: 'bytes32' }], outputs: [{ type: 'uint256' }] },
  { name: 'endorsementPoints', type: 'function', stateMutability: 'view',
    inputs: [{ name: 'commitment', type: 'bytes32' }], outputs: [{ type: 'uint256' }] },
  { name: 'hasEndorsed', type: 'function', stateMutability: 'view',
    inputs: [
      { name: 'endorser', type: 'bytes32' },
      { name: 'endorsed', type: 'bytes32' },
    ], outputs: [{ type: 'bool' }] },
  { name: 'getEndorsementWeight', type: 'function', stateMutability: 'view',
    inputs: [{ name: 'rep', type: 'uint256' }], outputs: [{ type: 'uint256' }] },
  { name: 'endorseIdentity', type: 'function', stateMutability: 'nonpayable',
    inputs: [
      { name: 'endorserCommitment', type: 'bytes32' },
      { name: 'endorsedCommitment', type: 'bytes32' },
    ], outputs: [] },
  { name: 'MAX_REPUTATION', type: 'function', stateMutability: 'view',
    inputs: [], outputs: [{ type: 'uint256' }] },
  { name: 'MIN_REPUTATION_TO_ENDORSE', type: 'function', stateMutability: 'view',
    inputs: [], outputs: [{ type: 'uint256' }] },
  { name: 'ENDORSEMENT_COOLDOWN', type: 'function', stateMutability: 'view',
    inputs: [], outputs: [{ type: 'uint256' }] },
  { name: 'lastEndorsedBlock', type: 'function', stateMutability: 'view',
    inputs: [{ name: 'commitment', type: 'bytes32' }], outputs: [{ type: 'uint256' }] },
] as const;

export const ORGANIZER_REGISTRY_ABI = [
  { name: 'registerOrganizer', type: 'function', stateMutability: 'nonpayable',
    inputs: [
      { name: 'orgId',          type: 'bytes32' },
      { name: 'name',           type: 'string'  },
      { name: 'minStake',       type: 'uint256' },
      { name: 'minReputation',  type: 'uint256' },
    ], outputs: [] },
  { name: 'updateRequirements', type: 'function', stateMutability: 'nonpayable',
    inputs: [
      { name: 'orgId',             type: 'bytes32' },
      { name: 'newMinStake',       type: 'uint256' },
      { name: 'newMinReputation',  type: 'uint256' },
    ], outputs: [] },
  { name: 'deactivateOrganizer', type: 'function', stateMutability: 'nonpayable',
    inputs: [{ name: 'orgId', type: 'bytes32' }], outputs: [] },
  { name: 'reactivateOrganizer', type: 'function', stateMutability: 'nonpayable',
    inputs: [{ name: 'orgId', type: 'bytes32' }], outputs: [] },
  { name: 'transferOrganizerOwnership', type: 'function', stateMutability: 'nonpayable',
    inputs: [
      { name: 'orgId',     type: 'bytes32' },
      { name: 'newOwner',  type: 'address' },
    ], outputs: [] },
  { name: 'getOrganizer', type: 'function', stateMutability: 'view',
    inputs: [{ name: 'orgId', type: 'bytes32' }],
    outputs: [{ type: 'tuple', components: [
      { name: 'owner',         type: 'address' },
      { name: 'name',          type: 'string'  },
      { name: 'minStake',      type: 'uint256' },
      { name: 'minReputation', type: 'uint256' },
      { name: 'active',        type: 'bool'    },
      { name: 'registeredAt',  type: 'uint256' },
    ]}] },
  { name: 'isActive', type: 'function', stateMutability: 'view',
    inputs: [{ name: 'orgId', type: 'bytes32' }], outputs: [{ type: 'bool' }] },
  { name: 'getRequirements', type: 'function', stateMutability: 'view',
    inputs: [{ name: 'orgId', type: 'bytes32' }],
    outputs: [
      { name: 'minStake',      type: 'uint256' },
      { name: 'minReputation', type: 'uint256' },
    ] },
  { name: 'getOrganizersByOwner', type: 'function', stateMutability: 'view',
    inputs: [{ name: 'owner', type: 'address' }], outputs: [{ type: 'bytes32[]' }] },
] as const;

// TrustProfile type for use across the frontend
export type TrustProfile = {
  isRegistered:        boolean;
  stake:               bigint;
  globalReputation:    bigint;
  effectiveReputation: bigint;
  endorsementCount:    bigint;
  linkedWalletCount:   bigint;
  commitment:          `0x${string}`;
};
