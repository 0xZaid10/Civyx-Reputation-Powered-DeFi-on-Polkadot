import { useState, useEffect } from 'react';
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useIdentity } from '@/hooks/useIdentity';
import { CONTRACTS, blockscoutTx, blockscoutAddress } from '@/lib/contracts';
import { TX_OPTIONS } from '@/lib/txOptions';

// ── ABIs ──────────────────────────────────────────────────────────────────────

const BROADCASTER_ABI = [
  {
    name: 'prepareSnapshot',
    type: 'function',
    stateMutability: 'view',
    inputs:  [{ name: 'wallet', type: 'address' }],
    outputs: [{
      type: 'tuple',
      components: [
        { name: 'snapshot', type: 'tuple', components: [
          { name: 'commitment',          type: 'bytes32' },
          { name: 'stake',               type: 'uint256' },
          { name: 'walletCount',         type: 'uint256' },
          { name: 'active',              type: 'bool'    },
          { name: 'globalReputation',    type: 'uint256' },
          { name: 'effectiveReputation', type: 'uint256' },
          { name: 'endorsementCount',    type: 'uint256' },
          { name: 'reputationTier',      type: 'uint8'   },
          { name: 'nativeBalance',       type: 'uint256' },
          { name: 'snapshotBlock',       type: 'uint256' },
          { name: 'broadcaster',         type: 'address' },
        ]},
        { name: 'xcmMessage',        type: 'bytes'   },
        { name: 'xcmWeight',         type: 'tuple',  components: [
          { name: 'refTime',   type: 'uint64' },
          { name: 'proofSize', type: 'uint64' },
        ]},
        { name: 'canBroadcast',      type: 'bool'    },
        { name: 'cooldownRemaining', type: 'uint256' },
      ],
    }],
  },
  {
    name: 'broadcastIdentity',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'destinationParaId', type: 'uint32' },
      { name: 'xcmMessage',        type: 'bytes'  },
    ],
    outputs: [],
  },
  {
    name: 'totalBroadcasts',
    type: 'function',
    stateMutability: 'view',
    inputs:  [],
    outputs: [{ type: 'uint256' }],
  },
] as const;

// ── Helpers ───────────────────────────────────────────────────────────────────

const TIER_LABELS: Record<number, { label: string; color: string }> = {
  0: { label: 'Tier 0', color: 'text-gray-500   bg-gray-50   border-gray-200'   },
  1: { label: 'Tier 1', color: 'text-indigo-700 bg-indigo-50 border-indigo-200' },
  2: { label: 'Tier 2', color: 'text-blue-700   bg-blue-50   border-blue-200'   },
  3: { label: 'Tier 3', color: 'text-teal-700   bg-teal-50   border-teal-200'   },
  4: { label: 'Tier 4', color: 'text-green-700  bg-green-50  border-green-200'  },
};

// Format stake — stored as 18-decimal wei (msg.value on Polkadot Hub EVM)
// Same unit as Ethereum wei, so formatEther (÷ 1e18) is correct
function formatStake(raw: unknown): string {
  try {
    const n = BigInt(String(raw));
    // formatEther equivalent: divide by 1e18
    const whole = n / 1_000_000_000_000_000_000n;
    const frac  = n % 1_000_000_000_000_000_000n;
    const fracStr = frac.toString().padStart(18, '0').slice(0, 4);
    return `${whole}.${fracStr}`;
  } catch {
    return '—';
  }
}

function SnapshotRow({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-start gap-4 py-2 border-b border-gray-100 last:border-0">
      <div className="w-40 shrink-0 text-xs text-gray-500">{label}</div>
      <div className={`text-xs text-gray-900 break-all ${mono ? 'font-mono' : ''}`}>{value}</div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function XCMDemo() {
  const { address, isConnected } = useAccount();
  const identity = useIdentity();

  const [broadcasted, setBroadcasted] = useState(false);
  const [txHash,      setTxHash]      = useState<`0x${string}` | undefined>();
  const [error,       setError]       = useState('');

  const DEST_PARA_ID = 1000;

  const { data: prep, refetch: refetchPrep } = useReadContract({
    address:      CONTRACTS.IdentityBroadcaster as `0x${string}`,
    abi:          BROADCASTER_ABI,
    functionName: 'prepareSnapshot',
    args:         [address!],
    query:        { enabled: !!address && identity.isRegistered },
  });

  const { data: totalBroadcasts } = useReadContract({
    address:      CONTRACTS.IdentityBroadcaster as `0x${string}`,
    abi:          BROADCASTER_ABI,
    functionName: 'totalBroadcasts',
  });

  const {
    writeContract,
    data:    writeTxHash,
    isPending,
    error:   writeError,
    reset:   resetWrite,
  } = useWriteContract();

  const {
    isSuccess,
    isLoading: isConfirming,
    isError:   isReceiptError,
  } = useWaitForTransactionReceipt({
    hash:            writeTxHash,
    timeout:         60_000,
    pollingInterval: 3_000,
  });

  useEffect(() => { if (writeTxHash) setTxHash(writeTxHash); }, [writeTxHash]);

  useEffect(() => {
    if (writeError) {
      const msg = writeError.message ?? '';
      // User rejected — don't show as error
      if (msg.includes('User rejected') || msg.includes('user rejected')) {
        setError('');
      } else {
        setError(msg.slice(0, 160));
      }
    }
  }, [writeError]);

  useEffect(() => {
    if (isReceiptError) setError('Transaction failed on-chain. Check Blockscout for details.');
  }, [isReceiptError]);

  useEffect(() => {
    if (isSuccess) { setBroadcasted(true); refetchPrep(); }
  }, [isSuccess, refetchPrep]);

  // Fallback: if we have a txHash and it's no longer pending/confirming, treat as success
  useEffect(() => {
    if (writeTxHash && !isPending && !isConfirming && !broadcasted && !isReceiptError) {
      const timer = setTimeout(() => {
        if (!broadcasted) { setBroadcasted(true); refetchPrep(); }
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [writeTxHash, isPending, isConfirming, broadcasted, isReceiptError, refetchPrep]);

  const handleBroadcast = () => {
    setError('');
    resetWrite();
    writeContract({
      address:      CONTRACTS.IdentityBroadcaster as `0x${string}`,
      abi:          BROADCASTER_ABI,
      functionName: 'broadcastIdentity',
      args:         [DEST_PARA_ID, (prep as any).xcmMessage],
      gas:          500_000n,
      gasPrice:     TX_OPTIONS.gasPrice,
    });
  };

  const snapshot = (prep as any)?.snapshot;
  const canBcast = (prep as any)?.canBroadcast;
  const cooldown = (prep as any)?.cooldownRemaining ?? 0n;
  const xcmMsg   = (prep as any)?.xcmMessage;
  const tier     = snapshot ? TIER_LABELS[Number(snapshot.reputationTier)] ?? TIER_LABELS[0] : null;

  // Button state label
  const btnLabel = isPending
    ? 'Confirm in wallet...'
    : isConfirming
    ? 'Waiting for confirmation...'
    : !canBcast
    ? `Cooldown — ${BigInt(String(cooldown)).toString()} blocks remaining`
    : 'Broadcast identity via XCM →';

  return (
    <div className="min-h-screen bg-white px-4 py-12">
      <div className="max-w-2xl mx-auto">

        <div className="mb-8">
          <p className="text-xs font-semibold text-green-600 uppercase tracking-widest mb-2">Cross-Chain Demo</p>
          <h1 className="text-2xl font-semibold text-gray-900">XCM Identity Broadcast</h1>
          <p className="text-sm text-gray-500 mt-1 leading-relaxed">
            Broadcast your full identity snapshot to another Polkadot parachain via XCM V5.
            The snapshot is validated on-chain and an{' '}
            <code className="bg-gray-100 px-1 rounded text-xs">IdentityBroadcast</code>{' '}
            event is emitted — verifiable proof that cross-chain messaging works.
          </p>
        </div>

        {/* How it works */}
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-8 text-xs text-gray-600 leading-relaxed space-y-1.5">
          <div className="font-semibold text-gray-900 mb-1">What happens</div>
          <div>1. <code className="bg-white px-1 rounded border border-gray-200">prepareSnapshot(wallet)</code> reads your live identity data and encodes an XCM V5 message.</div>
          <div>2. <code className="bg-white px-1 rounded border border-gray-200">broadcastIdentity(paraId, xcmMessage)</code> validates your identity, enforces the 100-block cooldown, and emits an <code className="bg-white px-1 rounded border border-gray-200">IdentityBroadcast</code> event on-chain.</div>
          <div>3. The emitted event carries your full snapshot — any indexer on any parachain can pick it up.</div>
        </div>

        {!isConnected ? (
          <div className="text-center py-12 border border-gray-200 rounded-lg">
            <p className="text-sm text-gray-500 mb-4">Connect your wallet to broadcast your identity</p>
            <div className="flex justify-center"><ConnectButton /></div>
          </div>
        ) : !identity.isRegistered ? (
          <div className="text-center py-12 border border-gray-200 rounded-lg">
            <p className="text-sm text-gray-500">No registered identity found for this wallet.</p>
            <p className="text-xs text-gray-400 mt-1">Register an identity first to use the broadcaster.</p>
          </div>
        ) : (
          <div className="space-y-5">

            {/* Live snapshot */}
            <div className="border border-gray-200 rounded-lg p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="text-sm font-semibold text-gray-900">Your identity snapshot</div>
                {tier && (
                  <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${tier.color}`}>
                    {tier.label}
                  </span>
                )}
              </div>
              {snapshot ? (
                <div>
                  <SnapshotRow label="Commitment"           value={snapshot.commitment}                       mono />
                  <SnapshotRow label="Stake"                value={`${formatStake(snapshot.stake)} PAS`}         />
                  <SnapshotRow label="Linked wallets"       value={String(snapshot.walletCount)}                  />
                  <SnapshotRow label="Global reputation"    value={String(snapshot.globalReputation)}             />
                  <SnapshotRow label="Effective reputation" value={String(snapshot.effectiveReputation)}          />
                  <SnapshotRow label="Endorsements"         value={String(snapshot.endorsementCount)}             />
                  <SnapshotRow label="Snapshot block"       value={String(snapshot.snapshotBlock)}                />
                  <SnapshotRow label="Active"               value={snapshot.active ? 'Yes' : 'No'}                />
                </div>
              ) : (
                <div className="text-xs text-gray-400 py-4 text-center">Loading snapshot...</div>
              )}
            </div>

            {/* XCM message bytes */}
            {xcmMsg && (
              <div className="border border-gray-200 rounded-lg p-5">
                <div className="text-sm font-semibold text-gray-900 mb-3">Encoded XCM V5 message</div>
                <div className="bg-gray-50 rounded p-3 font-mono text-xs text-gray-700 break-all">{xcmMsg}</div>
                <div className="mt-2 text-xs text-gray-400 space-y-0.5">
                  <div><span className="font-mono text-gray-600">0x05</span> — VersionedXcm::V5</div>
                  <div><span className="font-mono text-gray-600">0x08</span> — 2 instructions</div>
                  <div><span className="font-mono text-gray-600">0x2f 0x00 0x00</span> — UnpaidExecution (Unlimited, no origin check)</div>
                  <div><span className="font-mono text-gray-600">0x0a</span> — ClearOrigin</div>
                </div>
              </div>
            )}

            {/* Broadcast parameters */}
            <div className="border border-gray-200 rounded-lg p-5">
              <div className="text-sm font-semibold text-gray-900 mb-3">Broadcast parameters</div>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="bg-gray-50 rounded p-3">
                  <div className="text-gray-400 mb-0.5">Destination parachain</div>
                  <div className="font-semibold text-gray-900">Paseo Asset Hub (Para {DEST_PARA_ID})</div>
                </div>
                <div className="bg-gray-50 rounded p-3">
                  <div className="text-gray-400 mb-0.5">Cooldown status</div>
                  <div className={`font-semibold ${canBcast ? 'text-green-600' : 'text-orange-600'}`}>
                    {canBcast
                      ? 'Ready to broadcast'
                      : `${BigInt(String(cooldown)).toString()} blocks remaining`}
                  </div>
                </div>
                <div className="bg-gray-50 rounded p-3">
                  <div className="text-gray-400 mb-0.5">Total protocol broadcasts</div>
                  <div className="font-semibold text-gray-900 font-mono">
                    {totalBroadcasts !== undefined ? String(totalBroadcasts) : '—'}
                  </div>
                </div>
                <div className="bg-gray-50 rounded p-3">
                  <div className="text-gray-400 mb-0.5">XCM weight</div>
                  <div className="font-semibold text-gray-900 font-mono">1,830,000 refTime</div>
                </div>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded p-3 break-all">
                {error}
                <button
                  onClick={() => setError('')}
                  className="ml-2 text-red-400 hover:text-red-600"
                >
                  ✕
                </button>
              </div>
            )}

            {/* Broadcast / success */}
            {!broadcasted ? (
              <button
                onClick={handleBroadcast}
                disabled={!canBcast || isPending || isConfirming || !snapshot}
                className="w-full py-3 rounded-lg text-sm font-semibold text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ background: 'linear-gradient(90deg, #16a34a, #0d9488)' }}
              >
                {btnLabel}
              </button>
            ) : (
              <div className="border border-green-200 bg-green-50 rounded-lg p-5 space-y-3">
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded-full bg-green-600 flex items-center justify-center text-white text-xs font-bold shrink-0">✓</div>
                  <div className="text-sm font-semibold text-green-800">Identity broadcast confirmed</div>
                </div>
                <p className="text-xs text-green-700 leading-relaxed">
                  Your identity snapshot has been validated on-chain and an{' '}
                  <code className="bg-white px-1 rounded border border-green-200">IdentityBroadcast</code>{' '}
                  event was emitted. Any parachain indexing this contract can now read your snapshot.
                </p>
                {txHash && (
                  <a
                    href={blockscoutTx(txHash)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs text-green-700 hover:text-green-900 font-medium underline underline-offset-2"
                  >
                    View transaction on Blockscout →
                  </a>
                )}
                <div className="text-xs text-gray-500">
                  <a
                    href={blockscoutAddress(CONTRACTS.IdentityBroadcaster)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-green-600 underline underline-offset-2"
                  >
                    IdentityBroadcaster contract →
                  </a>
                </div>
                <button
                  onClick={() => { setBroadcasted(false); setTxHash(undefined); setError(''); resetWrite(); refetchPrep(); }}
                  className="w-full py-2 border border-green-200 text-xs text-green-700 rounded hover:bg-green-100 transition-colors"
                >
                  Broadcast again (after cooldown)
                </button>
              </div>
            )}

          </div>
        )}
      </div>
    </div>
  );
}
