// Civyx — useIdentity hook
// Reads the connected wallet's full trust profile from TrustOracle.
// Single source of truth for identity state across all pages.

import { useAccount, useReadContract, useReadContracts } from 'wagmi';
import { CONTRACTS, TRUST_ORACLE_ABI, IDENTITY_REGISTRY_ABI, type TrustProfile } from '@/lib/contracts';
import { loadSecret } from '@/lib/crypto';

const ZERO_HASH = '0x' + '0'.repeat(64) as `0x${string}`;

export interface IdentityState {
  // Connection
  address:       `0x${string}` | undefined;
  isConnected:   boolean;

  // Identity
  isRegistered:  boolean;
  isActive:      boolean;
  commitment:    `0x${string}`;
  stake:         bigint;
  walletCount:   bigint;

  // Reputation
  globalRep:     bigint;
  effectiveRep:  bigint;
  endorsements:  bigint;

  // Secret
  hasSecret:     boolean;
  secret:        string | null;

  // Loading
  isLoading:     boolean;
  refetch:       () => void;
}

export function useIdentity(): IdentityState {
  const { address, isConnected } = useAccount();

  // Read TrustProfile from oracle — single call gets everything
  const {
    data: profile,
    isLoading: profileLoading,
    refetch,
  } = useReadContract({
    address:      CONTRACTS.TrustOracle,
    abi:          TRUST_ORACLE_ABI,
    functionName: 'getTrustProfile',
    args:         [address!],
    query:        { enabled: !!address },
  });

  // Read linked wallets (needs commitment)
  const commitment = (profile as any)?.commitment ?? ZERO_HASH;

  const { data: linkedWallets } = useReadContract({
    address:      CONTRACTS.IdentityRegistry,
    abi:          IDENTITY_REGISTRY_ABI,
    functionName: 'getLinkedWallets',
    args:         [commitment],
    query:        { enabled: !!address && commitment !== ZERO_HASH },
  });

  // Check if secret is in localStorage
  const secret     = address ? loadSecret(address) : null;
  const hasSecret  = secret !== null;

  const p = profile as TrustProfile | undefined;

  return {
    address,
    isConnected,

    isRegistered: p?.isRegistered ?? false,
    isActive:     p?.isRegistered ?? false,
    commitment:   p?.commitment   ?? ZERO_HASH,
    stake:        p?.stake        ?? 0n,
    walletCount:  p?.linkedWalletCount ?? 0n,

    globalRep:    p?.globalReputation    ?? 0n,
    effectiveRep: p?.effectiveReputation ?? 0n,
    endorsements: p?.endorsementCount    ?? 0n,

    hasSecret,
    secret,

    isLoading: profileLoading,
    refetch,
  };
}

// ── Minimal hook for just checking registration status ────────────────────────

export function useIsRegistered(address?: `0x${string}`): boolean {
  const { data } = useReadContract({
    address:      CONTRACTS.TrustOracle,
    abi:          TRUST_ORACLE_ABI,
    functionName: 'verifyIdentity',
    args:         [address!],
    query:        { enabled: !!address },
  });
  return (data as boolean) ?? false;
}

// ── Hook for reading linked wallets ──────────────────────────────────────────

export function useLinkedWallets(commitment: `0x${string}`) {
  const { data, isLoading, refetch } = useReadContract({
    address:      CONTRACTS.IdentityRegistry,
    abi:          IDENTITY_REGISTRY_ABI,
    functionName: 'getLinkedWallets',
    args:         [commitment],
    query:        { enabled: commitment !== ZERO_HASH },
  });
  return {
    wallets:   (data as `0x${string}`[]) ?? [],
    isLoading,
    refetch,
  };
}
