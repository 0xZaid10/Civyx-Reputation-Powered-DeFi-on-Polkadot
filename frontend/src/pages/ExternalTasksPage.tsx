import { useState, useEffect } from 'react';
import {
  useAccount,
  useReadContract,
  useWriteContract,
  useWaitForTransactionReceipt,
} from 'wagmi';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { Link } from 'react-router-dom';
import { useIdentity } from '@/hooks/useIdentity';
import { CONTRACTS, blockscoutTx, blockscoutAddress } from '@/lib/contracts';
import { TX_OPTIONS } from '@/lib/txOptions';

// ── ABIs ──────────────────────────────────────────────────────────────────────

const EXTERNAL_TASK_ABI = [
  {
    name: 'claimTask',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'schemaId', type: 'bytes32' }],
    outputs: [],
  },
  {
    name: 'canClaim',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'wallet',   type: 'address' },
      { name: 'schemaId', type: 'bytes32' },
    ],
    outputs: [
      { name: 'eligible', type: 'bool'   },
      { name: 'reason',   type: 'string' },
    ],
  },
  {
    name: 'getSchema',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'schemaId', type: 'bytes32' }],
    outputs: [{
      type: 'tuple',
      components: [
        { name: 'schemaId',        type: 'bytes32' },
        { name: 'targetContract',  type: 'address' },
        { name: 'selector',        type: 'bytes4'  },
        { name: 'returnType',      type: 'uint8'   },
        { name: 'thresholdAmount', type: 'uint256' },
        { name: 'active',          type: 'bool'    },
        { name: 'registeredAt',    type: 'uint256' },
        { name: 'description',     type: 'string'  },
        { name: 'claimCount',      type: 'uint256' },
      ],
    }],
  },
  {
    name: 'totalSchemasRegistered',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }],
  },
] as const;

const DISPENSER_ABI = [{
  name: 'hasClaimed',
  type: 'function',
  stateMutability: 'view',
  inputs: [
    { name: 'commitment', type: 'bytes32' },
    { name: 'taskId',     type: 'bytes32' },
  ],
  outputs: [{ type: 'bool' }],
}] as const;

// ── Return type labels ────────────────────────────────────────────────────────

const RETURN_TYPE_LABELS = ['bool = true', 'uint256 > 0', `uint256 ≥ threshold`, 'bytes32 ≠ 0'] as const;

// ── Known schema IDs — add after deploying schemas on-chain ──────────────────
// These are computed as keccak256(abi.encodePacked("civyx:ext:", targetContract, selector))
// Register via scripts/registerExternalTask.ts then paste the schemaIds here.
const KNOWN_SCHEMAS: `0x${string}`[] = [
  // Example — fill with your registered schema IDs:
  // '0x...',
];

// ── Single task card ──────────────────────────────────────────────────────────

function TaskCard({
  schemaId,
  commitment,
  address,
}: {
  schemaId:   `0x${string}`;
  commitment: `0x${string}`;
  address:    `0x${string}`;
}) {
  const [claimedTx, setClaimedTx] = useState<`0x${string}` | undefined>();
  const [error,     setError]     = useState('');

  const { data: schema } = useReadContract({
    address:      CONTRACTS.ExternalTaskVerifier as `0x${string}`,
    abi:          EXTERNAL_TASK_ABI,
    functionName: 'getSchema',
    args:         [schemaId],
  });

  const { data: eligibility } = useReadContract({
    address:      CONTRACTS.ExternalTaskVerifier as `0x${string}`,
    abi:          EXTERNAL_TASK_ABI,
    functionName: 'canClaim',
    args:         [address, schemaId],
    query:        { enabled: !!address },
  });

  const { data: alreadyClaimed } = useReadContract({
    address:      CONTRACTS.TaskRewardDispenser as `0x${string}`,
    abi:          DISPENSER_ABI,
    functionName: 'hasClaimed',
    args:         [commitment, schemaId],
    query:        { enabled: commitment !== ('0x' + '0'.repeat(64)) },
  });

  const { writeContract, data: txHash, isPending, error: writeErr } = useWriteContract();
  const { isSuccess, isLoading: isConfirming } = useWaitForTransactionReceipt({
    hash: txHash, timeout: 60_000, pollingInterval: 3_000,
  });

  useEffect(() => { if (txHash) setClaimedTx(txHash); }, [txHash]);
  useEffect(() => { if (writeErr) setError(writeErr.message?.slice(0, 120) ?? 'Failed'); }, [writeErr]);

  const s          = schema as any;
  const [eligible] = eligibility as [boolean, string] | [undefined, undefined] ?? [undefined, undefined];
  const claimed    = !!alreadyClaimed || isSuccess;

  if (!s || !s.active) return null;

  const retTypeLabel = RETURN_TYPE_LABELS[Number(s.returnType)] ?? 'bool = true';

  return (
    <div className={`border rounded-2xl p-5 transition-all ${
      claimed ? 'border-green-200 bg-green-50/30' : 'border-gray-200 hover:border-gray-300 bg-white'
    }`}>
      {/* Header row */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex-1">
          <div className="font-semibold text-gray-900 text-sm mb-0.5">{s.description}</div>
          <a
            href={`https://blockscout-testnet.polkadot.io/address/${s.targetContract}`}
            target="_blank" rel="noopener noreferrer"
            className="text-xs font-mono text-gray-400 hover:text-green-600 transition-colors"
          >
            {s.targetContract.slice(0,10)}…{s.targetContract.slice(-6)} ↗
          </a>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {claimed && (
            <span className="text-xs font-semibold text-green-700 bg-green-50 border border-green-200 px-2.5 py-1 rounded-full">
              Claimed ✓
            </span>
          )}
          <span className="text-xs font-bold text-green-600 bg-green-50 border border-green-100 px-2.5 py-1 rounded-full">
            +5 pts
          </span>
        </div>
      </div>

      {/* Meta row */}
      <div className="flex flex-wrap gap-2 mb-4">
        <span className="text-xs font-mono bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
          {s.selector}
        </span>
        <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
          {retTypeLabel}
        </span>
        {s.thresholdAmount > 0n && (
          <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
            threshold: {s.thresholdAmount.toString()}
          </span>
        )}
        <span className="text-xs text-gray-400">
          {s.claimCount.toString()} claims
        </span>
      </div>

      {/* Eligibility */}
      {eligible !== undefined && !claimed && (
        <div className={`text-xs rounded-lg px-3 py-2 mb-3 ${
          eligible
            ? 'bg-green-50 border border-green-200 text-green-700'
            : 'bg-gray-50 border border-gray-200 text-gray-500'
        }`}>
          {eligible ? '✓ Eligible — action verified on-chain' : `Not eligible yet`}
        </div>
      )}

      {error && (
        <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg p-2 mb-3 break-all">{error}</div>
      )}

      {/* Claim button */}
      {!claimed ? (
        <button
          onClick={() => {
            setError('');
            writeContract({
              address:      CONTRACTS.ExternalTaskVerifier as `0x${string}`,
              abi:          EXTERNAL_TASK_ABI,
              functionName: 'claimTask',
              args:         [schemaId],
              ...TX_OPTIONS,
            });
          }}
          disabled={!eligible || isPending || isConfirming}
          className="w-full py-2.5 rounded-lg text-sm font-semibold text-white transition-all disabled:opacity-40"
          style={{ background: 'linear-gradient(90deg, #16a34a, #0d9488)' }}
        >
          {isPending ? 'Confirm in wallet...' : isConfirming ? 'Verifying on-chain...' : 'Claim reputation →'}
        </button>
      ) : (
        <div className="space-y-1">
          <div className="text-xs text-green-700 text-center font-medium">Reputation awarded ✓</div>
          {claimedTx && (
            <a href={blockscoutTx(claimedTx)} target="_blank" rel="noopener noreferrer"
              className="block text-xs text-center text-green-600 hover:text-green-800 underline underline-offset-2">
              View transaction →
            </a>
          )}
        </div>
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ExternalTasksPage() {
  const { address, isConnected } = useAccount();
  const identity = useIdentity();

  const { data: totalSchemas } = useReadContract({
    address:      CONTRACTS.ExternalTaskVerifier as `0x${string}`,
    abi:          EXTERNAL_TASK_ABI,
    functionName: 'totalSchemasRegistered',
  });

  return (
    <div className="min-h-screen bg-white px-4 py-12">
      <div className="max-w-2xl mx-auto">

        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-3">
            <p className="text-xs font-semibold text-green-600 uppercase tracking-widest">Universal Reputation</p>
            <span className="text-xs text-gray-300">·</span>
            <a href={blockscoutAddress(CONTRACTS.ExternalTaskVerifier)} target="_blank" rel="noopener noreferrer"
              className="text-xs text-gray-400 hover:text-green-600 font-mono transition-colors">
              {CONTRACTS.ExternalTaskVerifier.slice(0,10)}…{CONTRACTS.ExternalTaskVerifier.slice(-6)} ↗
            </a>
          </div>
          <h1 className="text-2xl font-semibold text-gray-900">External Task Verifier</h1>
          <p className="text-sm text-gray-500 mt-1 leading-relaxed">
            Earn Civyx reputation for actions you've already taken on any dApp —
            without that protocol ever integrating Civyx. Every claim is verified
            entirely on-chain via a read-only call to the external contract.
          </p>
        </div>

        {/* How it works */}
        <div className="bg-gray-50 border border-gray-100 rounded-2xl p-5 mb-8">
          <div className="text-sm font-semibold text-gray-900 mb-4">How it works</div>
          <div className="grid sm:grid-cols-3 gap-4 text-xs">
            {[
              { n: '1', t: 'Act on any dApp', b: 'Vote in a DAO, hold a token, claim a reward — on any protocol.' },
              { n: '2', t: 'Claim here', b: 'The contract calls the external protocol on-chain to verify your action. No off-chain trust.' },
              { n: '3', t: 'Earn reputation', b: 'Points awarded to your Civyx identity. One per task, permanently recorded.' },
            ].map(({ n, t, b }) => (
              <div key={n} className="flex gap-2.5">
                <div className="w-5 h-5 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0 mt-0.5"
                  style={{ background: 'linear-gradient(90deg, #16a34a, #0d9488)' }}>{n}</div>
                <div>
                  <div className="font-semibold text-gray-800 mb-0.5">{t}</div>
                  <p className="text-gray-500 leading-relaxed">{b}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Stats */}
        <div className="flex items-center gap-4 mb-8">
          <div className="bg-gray-50 border border-gray-100 rounded-xl px-4 py-2.5 text-center">
            <div className="text-base font-bold text-gray-900 font-mono">{totalSchemas?.toString() ?? '0'}</div>
            <div className="text-xs text-gray-400">schemas registered</div>
          </div>
          <div className="bg-green-50 border border-green-100 rounded-xl px-4 py-2.5 text-center">
            <div className="text-base font-bold text-green-700 font-mono">+5</div>
            <div className="text-xs text-gray-400">pts per task</div>
          </div>
          <div className="bg-gray-50 border border-gray-100 rounded-xl px-4 py-2.5 text-center">
            <div className="text-xs text-gray-400 mb-0.5">Verification</div>
            <div className="text-xs font-semibold text-gray-700">100% on-chain</div>
          </div>
        </div>

        {!isConnected ? (
          <div className="text-center py-12 border border-gray-200 rounded-2xl">
            <p className="text-sm text-gray-500 mb-4">Connect your wallet to claim external tasks</p>
            <div className="flex justify-center"><ConnectButton /></div>
          </div>
        ) : !identity.isRegistered ? (
          <div className="text-center py-12 border border-gray-200 rounded-2xl">
            <p className="text-sm text-gray-700 font-medium">No Civyx identity found</p>
            <p className="text-xs text-gray-400 mt-1 mb-4">A registered identity is required to claim reputation.</p>
            <Link to="/app/register"
              className="inline-block px-6 py-2.5 rounded-full text-sm font-semibold text-white"
              style={{ background: 'linear-gradient(90deg, #16a34a, #0d9488)' }}>
              Register identity →
            </Link>
          </div>
        ) : KNOWN_SCHEMAS.length === 0 ? (
          <div className="border border-gray-200 rounded-2xl p-8 text-center">
            <div className="text-sm font-semibold text-gray-700 mb-2">No schemas registered yet</div>
            <p className="text-xs text-gray-500 leading-relaxed max-w-sm mx-auto mb-4">
              External task schemas are registered by admins. Each schema points to a specific
              view function on an external dApp contract that verifies your action on-chain.
            </p>
            <div className="bg-gray-50 border border-gray-100 rounded-xl p-4 text-left">
              <div className="text-xs font-semibold text-gray-600 mb-2">Supported verification patterns</div>
              <div className="space-y-1.5">
                {[
                  { fn: 'hasVoted(address) → bool',     ex: 'DAO governance voting' },
                  { fn: 'hasClaimed(address) → bool',   ex: 'Protocol reward claims' },
                  { fn: 'balanceOf(address) → uint256', ex: 'Token or NFT holder' },
                  { fn: 'isMember(address) → bool',     ex: 'Protocol membership' },
                ].map(({ fn, ex }) => (
                  <div key={fn} className="flex items-center gap-3">
                    <span className="font-mono text-xs text-green-700 bg-green-50 border border-green-100 px-2 py-0.5 rounded whitespace-nowrap">{fn}</span>
                    <span className="text-xs text-gray-400">{ex}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm font-semibold text-gray-900">{KNOWN_SCHEMAS.length} task{KNOWN_SCHEMAS.length !== 1 ? 's' : ''} available</div>
              <div className="text-xs text-gray-400">Your rep: <span className="font-semibold text-gray-700">{identity.globalRep.toString()}</span></div>
            </div>
            {KNOWN_SCHEMAS.map(schemaId => (
              <TaskCard
                key={schemaId}
                schemaId={schemaId}
                commitment={identity.commitment}
                address={address!}
              />
            ))}
          </div>
        )}

        {/* Footer note */}
        <div className="mt-8 border border-gray-100 rounded-xl p-4">
          <div className="text-xs text-gray-500 leading-relaxed">
            <span className="font-semibold text-gray-700">For protocol builders</span> — any dApp exposing a view function that takes an address and returns{' '}
            <code className="bg-gray-100 px-1 rounded">bool</code> or{' '}
            <code className="bg-gray-100 px-1 rounded">uint256</code> can be integrated.
            Register a schema via{' '}
            <code className="bg-gray-100 px-1 rounded">ExternalTaskVerifier.registerSchema()</code>.
            Users earn Civyx reputation automatically when they claim.
            No Civyx integration required in your contract.{' '}
            <a href={blockscoutAddress(CONTRACTS.ExternalTaskVerifier)} target="_blank" rel="noopener noreferrer"
              className="text-green-600 hover:underline">View contract →</a>
          </div>
        </div>

      </div>
    </div>
  );
}
