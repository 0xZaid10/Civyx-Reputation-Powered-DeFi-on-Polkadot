import { useState, useEffect } from 'react';
import {
  useAccount,
  useReadContract,
  useWriteContract,
  useWaitForTransactionReceipt,
  useBalance,
} from 'wagmi';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { formatEther }   from 'viem';
import { useIdentity }   from '@/hooks/useIdentity';
import {
  CONTRACTS,
  REPUTATION_REGISTRY_ABI,
  blockscoutTx,
} from '@/lib/contracts';
import { TX_OPTIONS } from '@/lib/txOptions';

// ── ABIs ──────────────────────────────────────────────────────────────────────

const GOVERNANCE_TASK_ABI = [
  {
    name: 'claim',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'orgId',      type: 'bytes32' },
      { name: 'proposalId', type: 'bytes32' },
    ],
    outputs: [],
  },
  {
    name: 'hasClaimed',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'commitment', type: 'bytes32' },
      { name: 'orgId',      type: 'bytes32' },
      { name: 'proposalId', type: 'bytes32' },
    ],
    outputs: [{ type: 'bool' }],
  },
  {
    name: 'getProposal',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'orgId',      type: 'bytes32' },
      { name: 'proposalId', type: 'bytes32' },
    ],
    outputs: [{
      type: 'tuple',
      components: [
        { name: 'orgId',        type: 'bytes32' },
        { name: 'proposalId',   type: 'bytes32' },
        { name: 'active',       type: 'bool'    },
        { name: 'registeredAt', type: 'uint256' },
        { name: 'claimCount',   type: 'uint256' },
      ],
    }],
  },
] as const;

const COMMUNITY_DROP_ABI = [
  {
    name: 'claim',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs:  [],
    outputs: [],
  },
  {
    name: 'contractBalance',
    type: 'function',
    stateMutability: 'view',
    inputs:  [],
    outputs: [{ type: 'uint256' }],
  },
  {
    name: 'remainingClaims',
    type: 'function',
    stateMutability: 'view',
    inputs:  [],
    outputs: [{ type: 'uint256' }],
  },
  {
    name: 'claimAmount',
    type: 'function',
    stateMutability: 'view',
    inputs:  [],
    outputs: [{ type: 'uint256' }],
  },
  {
    name: 'totalClaims',
    type: 'function',
    stateMutability: 'view',
    inputs:  [],
    outputs: [{ type: 'uint256' }],
  },
  {
    name: 'TASK_ID',
    type: 'function',
    stateMutability: 'view',
    inputs:  [],
    outputs: [{ type: 'bytes32' }],
  },
] as const;

// ── Proposal constants — update after registerProposal() is called on-chain ──
// These are the keccak256 values for your orgId and proposalId.
// Replace with actual values after calling GovernanceVoteTask.registerProposal().
const GOV_ORG_ID      = '0xfa77fe2bb2f7ea6a53a0767759cf0daff1b1e47056033ad6774d5911f256c06e' as `0x${string}`;
const GOV_PROPOSAL_ID = '0xf01bf01569eee860b9e4b7fc1e74ca49e436fd3521a5976c8e6a183f4dec9130' as `0x${string}`;

// ── Helpers ───────────────────────────────────────────────────────────────────

const PAS_DECIMALS = 10n;
const formatPAS    = (planck: bigint) => {
  const whole = planck / 10_000_000_000n;
  const frac  = planck % 10_000_000_000n;
  const fracStr = frac.toString().padStart(10, '0').slice(0, 2);
  return `${whole}.${fracStr}`;
};

function RepBar({ value }: { value: bigint }) {
  const pct = Math.min(Number(value) / 1000 * 100, 100);
  return (
    <div className="w-full bg-gray-100 rounded-full h-2">
      <div
        className="h-2 rounded-full transition-all duration-700"
        style={{ width: `${pct}%`, background: 'linear-gradient(90deg, #16a34a, #0d9488)' }}
      />
    </div>
  );
}

// ── Vote Section ──────────────────────────────────────────────────────────────

function VoteSection({
  commitment,
  globalRep,
  onVoted,
}: {
  commitment: `0x${string}`;
  globalRep:  bigint;
  onVoted:    (txHash: `0x${string}`) => void;
}) {
  const [choice,   setChoice]   = useState<'yes' | 'no' | null>(null);
  const [error,    setError]    = useState('');

  const { data: alreadyClaimed } = useReadContract({
    address:      CONTRACTS.GovernanceVoteTask as `0x${string}`,
    abi:          GOVERNANCE_TASK_ABI,
    functionName: 'hasClaimed',
    args:         [commitment, GOV_ORG_ID, GOV_PROPOSAL_ID],
    query:        { enabled: commitment !== ('0x' + '0'.repeat(64)) },
  });

  const { data: proposal } = useReadContract({
    address:      CONTRACTS.GovernanceVoteTask as `0x${string}`,
    abi:          GOVERNANCE_TASK_ABI,
    functionName: 'getProposal',
    args:         [GOV_ORG_ID, GOV_PROPOSAL_ID],
  });

  const { writeContract, data: txHash, isPending, error: writeError } = useWriteContract();
  const { isSuccess, isLoading: isConfirming } = useWaitForTransactionReceipt({ hash: txHash });

  useEffect(() => {
    if (writeError) setError(writeError.message?.slice(0, 120) ?? 'Transaction failed');
  }, [writeError]);

  useEffect(() => {
    if (isSuccess && txHash) onVoted(txHash);
  }, [isSuccess, txHash]);

  const proposalActive = (proposal as any)?.active ?? false;
  const claimCount     = (proposal as any)?.claimCount ?? 0n;
  const pointsPreview  = globalRep < 50n ? 5 : 3;
  const voted          = !!alreadyClaimed;

  const handleVote = () => {
    setError('');
    writeContract({
      address:      CONTRACTS.GovernanceVoteTask as `0x${string}`,
      abi:          GOVERNANCE_TASK_ABI,
      functionName: 'claim',
      args:         [GOV_ORG_ID, GOV_PROPOSAL_ID],
      ...TX_OPTIONS,
    });
  };

  return (
    <div className="border border-gray-200 rounded-xl p-6">

      {/* Section header */}
      <div className="flex items-center justify-between mb-1">
        <div className="text-base font-semibold text-gray-900">Governance vote</div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-green-600 bg-green-50 border border-green-100 px-2.5 py-1 rounded-full">
            +{pointsPreview} rep pts
          </span>
          {voted && (
            <span className="text-xs font-semibold text-green-700 bg-green-50 border border-green-200 px-2.5 py-1 rounded-full">
              Voted ✓
            </span>
          )}
        </div>
      </div>
      <p className="text-xs text-gray-400 mb-5">
        Cast your vote as a verified identity holder and earn reputation points on-chain.
        One vote per identity, permanently recorded.
      </p>

      {/* Proposal */}
      <div className="bg-gray-50 rounded-lg p-4 mb-5">
        <div className="text-xs font-bold text-purple-600 uppercase tracking-widest mb-2">
          Genesis Proposal · {claimCount.toString()} votes cast
        </div>
        <div className="text-sm font-semibold text-gray-900 mb-2">
          Should Civyx expand its identity protocol to additional Polkadot parachains?
        </div>
        <p className="text-xs text-gray-500 leading-relaxed">
          This is the first governance vote in the Civyx ecosystem. Your participation
          is recorded on-chain and earns reputation points — proving the governance
          reward system works end to end.
        </p>
      </div>

      {voted ? (
        <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-700 font-medium text-center">
          Vote already recorded for this identity ✓
        </div>
      ) : !proposalActive ? (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-sm text-gray-500 text-center">
          Proposal not yet active
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 mb-4">
            {(['yes', 'no'] as const).map(opt => (
              <button
                key={opt}
                onClick={() => setChoice(opt)}
                className={`py-2.5 rounded-lg text-sm font-medium border transition-all ${
                  choice === opt
                    ? opt === 'yes'
                      ? 'bg-green-50 border-green-400 text-green-700'
                      : 'bg-red-50 border-red-400 text-red-700'
                    : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}
              >
                {opt === 'yes' ? 'Yes, expand' : 'No, stay focused'}
              </button>
            ))}
          </div>

          {error && (
            <div className="mb-3 text-xs text-red-600 bg-red-50 border border-red-200 rounded p-2.5 break-all">{error}</div>
          )}

          <button
            onClick={handleVote}
            disabled={!choice || isPending || isConfirming}
            className="w-full py-2.5 rounded-lg text-sm font-semibold text-white transition-all disabled:opacity-40"
            style={{ background: 'linear-gradient(90deg, #16a34a, #0d9488)' }}
          >
            {isPending    ? 'Confirm in wallet...' :
             isConfirming ? 'Recording vote...'    :
             !choice      ? 'Select an option'     :
                            'Submit vote & earn rep →'}
          </button>
        </>
      )}

    </div>
  );
}

// ── Airdrop Section ───────────────────────────────────────────────────────────

function AirdropSection({
  commitment,
  globalRep,
  onClaimed,
}: {
  commitment: `0x${string}`;
  globalRep:  bigint;
  onClaimed:  (txHash: `0x${string}`) => void;
}) {
  const [error, setError] = useState('');

  const { data: contractBalance, refetch: refetchBalance } = useReadContract({
    address:      CONTRACTS.CommunityDrop as `0x${string}`,
    abi:          COMMUNITY_DROP_ABI,
    functionName: 'contractBalance',
  });

  const { data: remainingClaims } = useReadContract({
    address:      CONTRACTS.CommunityDrop as `0x${string}`,
    abi:          COMMUNITY_DROP_ABI,
    functionName: 'remainingClaims',
  });

  const { data: claimAmount } = useReadContract({
    address:      CONTRACTS.CommunityDrop as `0x${string}`,
    abi:          COMMUNITY_DROP_ABI,
    functionName: 'claimAmount',
  });

  const { data: totalClaims } = useReadContract({
    address:      CONTRACTS.CommunityDrop as `0x${string}`,
    abi:          COMMUNITY_DROP_ABI,
    functionName: 'totalClaims',
  });

  // Check if already claimed via dispenser hasClaimed
  const { data: dropTaskId } = useReadContract({
    address:      CONTRACTS.CommunityDrop as `0x${string}`,
    abi:          COMMUNITY_DROP_ABI,
    functionName: 'TASK_ID',
  });

  const DISPENSER_HAS_CLAIMED_ABI = [{
    name: 'hasClaimed',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'commitment', type: 'bytes32' },
      { name: 'taskId',     type: 'bytes32' },
    ],
    outputs: [{ type: 'bool' }],
  }] as const;

  const { data: alreadyClaimed, refetch: refetchClaimed } = useReadContract({
    address:      CONTRACTS.TaskRewardDispenser as `0x${string}`,
    abi:          DISPENSER_HAS_CLAIMED_ABI,
    functionName: 'hasClaimed',
    args:         [commitment, dropTaskId as `0x${string}`],
    query:        { enabled: !!dropTaskId && commitment !== ('0x' + '0'.repeat(64)) },
  });

  const { writeContract, data: txHash, isPending, error: writeError } = useWriteContract();
  const { isSuccess, isLoading: isConfirming } = useWaitForTransactionReceipt({ hash: txHash });

  useEffect(() => {
    if (writeError) setError(writeError.message?.slice(0, 120) ?? 'Transaction failed');
  }, [writeError]);

  useEffect(() => {
    if (isSuccess && txHash) {
      onClaimed(txHash);
      refetchBalance();
      refetchClaimed();
    }
  }, [isSuccess, txHash]);

  const pasAmount      = claimAmount ? formatPAS(claimAmount as bigint) : '—';
  const pointsPreview  = globalRep < 50n ? 5 : 3;
  const claimed        = !!alreadyClaimed;
  const hasBalance     = contractBalance && (contractBalance as bigint) >= (claimAmount as bigint ?? 0n);

  const handleClaim = () => {
    setError('');
    writeContract({
      address:      CONTRACTS.CommunityDrop as `0x${string}`,
      abi:          COMMUNITY_DROP_ABI,
      functionName: 'claim',
      ...TX_OPTIONS,
    });
  };

  return (
    <div className="border border-gray-200 rounded-xl p-6">

      {/* Section header */}
      <div className="flex items-center justify-between mb-1">
        <div className="text-base font-semibold text-gray-900">PAS airdrop</div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-teal-600 bg-teal-50 border border-teal-100 px-2.5 py-1 rounded-full">
            {pasAmount} PAS
          </span>
          <span className="text-xs font-bold text-green-600 bg-green-50 border border-green-100 px-2.5 py-1 rounded-full">
            +{pointsPreview} rep pts
          </span>
          {claimed && (
            <span className="text-xs font-semibold text-green-700 bg-green-50 border border-green-200 px-2.5 py-1 rounded-full">
              Claimed ✓
            </span>
          )}
        </div>
      </div>
      <p className="text-xs text-gray-400 mb-5">
        Verified Civyx identity holders receive a one-time PAS airdrop directly to their wallet.
        Reputation points are awarded in the same transaction.
      </p>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        <div className="bg-gray-50 rounded-lg p-3 text-center">
          <div className="text-base font-bold text-gray-900 font-mono">{pasAmount}</div>
          <div className="text-xs text-gray-400 mt-0.5">PAS per claim</div>
        </div>
        <div className="bg-gray-50 rounded-lg p-3 text-center">
          <div className="text-base font-bold text-gray-900 font-mono">
            {remainingClaims?.toString() ?? '—'}
          </div>
          <div className="text-xs text-gray-400 mt-0.5">Claims remaining</div>
        </div>
        <div className="bg-gray-50 rounded-lg p-3 text-center">
          <div className="text-base font-bold text-gray-900 font-mono">
            {totalClaims?.toString() ?? '0'}
          </div>
          <div className="text-xs text-gray-400 mt-0.5">Total claimed</div>
        </div>
      </div>

      {error && (
        <div className="mb-3 text-xs text-red-600 bg-red-50 border border-red-200 rounded p-2.5 break-all">{error}</div>
      )}

      {claimed ? (
        <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-700 font-medium text-center">
          Airdrop already claimed for this identity ✓
        </div>
      ) : !hasBalance ? (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-700 text-center">
          Contract is being funded — check back shortly
        </div>
      ) : (
        <button
          onClick={handleClaim}
          disabled={isPending || isConfirming}
          className="w-full py-2.5 rounded-lg text-sm font-semibold text-white transition-all disabled:opacity-40"
          style={{ background: 'linear-gradient(90deg, #0d9488, #0891b2)' }}
        >
          {isPending    ? 'Confirm in wallet...' :
           isConfirming ? 'Claiming...'           :
                          `Claim ${pasAmount} PAS + earn rep →`}
        </button>
      )}

    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function CommunityPage() {
  const { address, isConnected } = useAccount();
  const identity = useIdentity();

  const [voteTxHash,  setVoteTxHash]  = useState<`0x${string}` | undefined>();
  const [dropTxHash,  setDropTxHash]  = useState<`0x${string}` | undefined>();
  const [repBefore,   setRepBefore]   = useState<bigint>(0n);
  const [repAfter,    setRepAfter]    = useState<bigint>(0n);

  const { data: liveRep, refetch: refetchRep } = useReadContract({
    address:      CONTRACTS.ReputationRegistry as `0x${string}`,
    abi:          REPUTATION_REGISTRY_ABI,
    functionName: 'globalReputation',
    args:         [identity.commitment],
    query:        { enabled: identity.isRegistered },
  });

  const { data: balance } = useBalance({ address });

  // Snapshot rep before any action
  useEffect(() => {
    if (liveRep !== undefined && repBefore === 0n) {
      setRepBefore(liveRep as bigint);
    }
  }, [liveRep]);

  const handleVoted = (txHash: `0x${string}`) => {
    setVoteTxHash(txHash);
    setTimeout(() => {
      refetchRep().then(r => { if (r.data) setRepAfter(r.data as bigint); });
      identity.refetch();
    }, 2500);
  };

  const handleClaimed = (txHash: `0x${string}`) => {
    setDropTxHash(txHash);
    setTimeout(() => {
      refetchRep().then(r => { if (r.data) setRepAfter(r.data as bigint); });
      identity.refetch();
    }, 2500);
  };

  const currentRep  = (liveRep as bigint) ?? identity.globalRep;
  const displayRep  = repAfter > 0n ? repAfter : currentRep;

  return (
    <div className="min-h-screen bg-white px-4 py-12">
      <div className="max-w-2xl mx-auto">

        {/* Page header */}
        <div className="mb-8">
          <p className="text-xs font-semibold text-green-600 uppercase tracking-widest mb-2">Community</p>
          <h1 className="text-2xl font-semibold text-gray-900">Vote & Claim</h1>
          <p className="text-sm text-gray-500 mt-1 leading-relaxed">
            Participate in the Civyx genesis vote and claim your PAS airdrop.
            Both actions reward reputation points — live on-chain, instantly visible on your dashboard.
          </p>
        </div>

        {!isConnected ? (
          <div className="text-center py-16 border border-gray-200 rounded-xl">
            <p className="text-sm text-gray-500 mb-4">Connect your wallet to participate</p>
            <div className="flex justify-center"><ConnectButton /></div>
          </div>
        ) : !identity.isRegistered ? (
          <div className="text-center py-16 border border-gray-200 rounded-xl">
            <p className="text-sm text-gray-700 font-medium">No registered Civyx identity found</p>
            <p className="text-xs text-gray-400 mt-1">Register an identity to participate in the community drop.</p>
          </div>
        ) : (
          <div className="space-y-5">

            {/* Identity snapshot */}
            <div className="border border-gray-100 rounded-xl p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="text-sm font-semibold text-gray-900">Your identity</div>
                <span className="text-xs text-green-700 bg-green-50 border border-green-200 px-2.5 py-1 rounded-full font-medium">
                  Verified
                </span>
              </div>
              <div className="grid grid-cols-3 gap-3 mb-3">
                <div className="bg-gray-50 rounded-lg p-3 text-center">
                  <div className="text-lg font-bold text-gray-900 font-mono">
                    {displayRep.toString()}
                    {repAfter > repBefore && repBefore > 0n && (
                      <span className="text-xs font-bold text-green-600 ml-1">
                        +{(repAfter - repBefore).toString()}
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-gray-400 mt-0.5">Global rep</div>
                </div>
                <div className="bg-gray-50 rounded-lg p-3 text-center">
                  <div className="text-lg font-bold text-gray-900 font-mono">
                    {identity.effectiveRep.toString()}
                  </div>
                  <div className="text-xs text-gray-400 mt-0.5">Effective rep</div>
                </div>
                <div className="bg-gray-50 rounded-lg p-3 text-center">
                  <div className="text-lg font-bold text-gray-900 font-mono">
                    {balance ? parseFloat(formatEther(balance.value)).toFixed(2) : '—'}
                  </div>
                  <div className="text-xs text-gray-400 mt-0.5">PAS balance</div>
                </div>
              </div>
              <RepBar value={displayRep} />
              <div className="flex justify-between text-xs text-gray-400 mt-1">
                <span>0</span>
                <span>{displayRep.toString()} / 1000</span>
              </div>
            </div>

            {/* Vote section */}
            <VoteSection
              commitment={identity.commitment}
              globalRep={currentRep}
              onVoted={handleVoted}
            />

            {/* Airdrop section */}
            <AirdropSection
              commitment={identity.commitment}
              globalRep={currentRep}
              onClaimed={handleClaimed}
            />

            {/* Tx confirmations */}
            {(voteTxHash || dropTxHash) && (
              <div className="border border-green-200 bg-green-50 rounded-xl p-4 space-y-2">
                <div className="text-xs font-semibold text-green-800 mb-1">Transactions confirmed</div>
                {voteTxHash && (
                  <a href={`https://blockscout-testnet.polkadot.io/tx/${voteTxHash}`}
                     target="_blank" rel="noopener noreferrer"
                     className="block text-xs text-green-700 hover:text-green-900 underline underline-offset-2">
                    Vote transaction →
                  </a>
                )}
                {dropTxHash && (
                  <a href={`https://blockscout-testnet.polkadot.io/tx/${dropTxHash}`}
                     target="_blank" rel="noopener noreferrer"
                     className="block text-xs text-green-700 hover:text-green-900 underline underline-offset-2">
                    Airdrop claim transaction →
                  </a>
                )}
                <p className="text-xs text-green-600 pt-1">
                  Reputation score updated on-chain. Check your dashboard to see the new total.
                </p>
              </div>
            )}

          </div>
        )}
      </div>
    </div>
  );
}
