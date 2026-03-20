import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useReadContract } from 'wagmi';
import { formatEther, parseEther } from 'viem';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useIdentity, useLinkedWallets } from '@/hooks/useIdentity';
import { shortHash, shortAddress } from '@/lib/crypto';
import { CONTRACTS, IDENTITY_REGISTRY_ABI, REPUTATION_REGISTRY_ABI, blockscoutAddress, blockscoutTx } from '@/lib/contracts';
import { TX_OPTIONS } from '@/lib/txOptions';

// ── Stat Card ─────────────────────────────────────────────────────────────────

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="border border-gray-200 rounded-lg p-4">
      <div className="text-xl font-semibold text-gray-900 font-mono">{value}</div>
      <div className="text-xs font-medium text-gray-600 mt-0.5">{label}</div>
      {sub && <div className="text-xs text-gray-400 mt-0.5">{sub}</div>}
    </div>
  );
}

// ── Reputation Bar ────────────────────────────────────────────────────────────

function RepBar({ value, max = 1000 }: { value: bigint; max?: number }) {
  const pct = Math.min(Number(value) / max * 100, 100);
  return (
    <div className="w-full bg-gray-100 rounded-full h-1.5 mt-2">
      <div
        className="bg-green-600 h-1.5 rounded-full transition-all"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

// ── Linked Wallets ────────────────────────────────────────────────────────────

function LinkedWallets({ commitment, currentWallet }: {
  commitment: `0x${string}`;
  currentWallet: string;
}) {
  const { wallets, refetch } = useLinkedWallets(commitment);
  const { writeContract, data: txHash, isPending } = useWriteContract();
  const { isSuccess } = useWaitForTransactionReceipt({ hash: txHash });

  useEffect(() => { if (isSuccess) refetch(); }, [isSuccess, refetch]);

  const handleUnlink = () => {
    writeContract({
      address:      CONTRACTS.IdentityRegistry,
      abi:          IDENTITY_REGISTRY_ABI,
      functionName: 'unlinkWallet',
      ...TX_OPTIONS,
    });
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div className="text-sm font-semibold text-gray-900">Linked Wallets</div>
        <Link
          to="/app/link"
          className="text-xs text-green-600 hover:text-green-700 font-medium"
        >
          + Link wallet
        </Link>
      </div>
      <div className="space-y-2">
        {wallets.map((w) => (
          <div key={w} className="flex items-center justify-between border border-gray-200 rounded p-3">
            <div>
              <a
                href={blockscoutAddress(w)}
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono text-xs text-gray-900 hover:text-green-600 transition-colors"
              >
                {w}
              </a>
              {w.toLowerCase() === currentWallet.toLowerCase() && (
                <span className="ml-2 text-xs text-green-600 font-medium">current</span>
              )}
            </div>
            {wallets.length > 1 && w.toLowerCase() === currentWallet.toLowerCase() && (
              <button
                onClick={handleUnlink}
                disabled={isPending}
                className="text-xs text-gray-400 hover:text-red-500 transition-colors disabled:opacity-50 ml-3 shrink-0"
              >
                Unlink
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Deactivate Modal ──────────────────────────────────────────────────────────

function DeactivateSection({ stake, refetch }: { stake: bigint; refetch: () => void }) {
  const [open, setOpen] = useState(false);
  const { writeContract, data: txHash, isPending } = useWriteContract();
  const { isSuccess } = useWaitForTransactionReceipt({ hash: txHash });

  useEffect(() => {
    if (isSuccess) { refetch(); setOpen(false); }
  }, [isSuccess, refetch]);

  return (
    <div className="border border-gray-200 rounded-lg p-4">
      <div className="text-sm font-semibold text-gray-900 mb-1">Deactivate Identity</div>
      <p className="text-xs text-gray-500 mb-3 leading-relaxed">
        Deactivating returns your {formatEther(stake)} PAS stake.
        Your commitment and reputation are preserved — you can reactivate anytime.
      </p>
      {!open ? (
        <button
          onClick={() => setOpen(true)}
          className="text-xs text-red-500 hover:text-red-600 font-medium"
        >
          Deactivate and withdraw stake →
        </button>
      ) : (
        <div className="border border-red-200 bg-red-50 rounded p-3">
          <p className="text-xs text-red-700 mb-3">
            This will mark your identity inactive and return {formatEther(stake)} PAS.
            You can reactivate later.
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => writeContract({
                address:      CONTRACTS.IdentityRegistry,
                abi:          IDENTITY_REGISTRY_ABI,
                functionName: 'deactivateIdentity',
                ...TX_OPTIONS,
              })}
              disabled={isPending}
              className="px-3 py-1.5 bg-red-500 text-white text-xs font-medium rounded hover:bg-red-600 transition-colors disabled:opacity-50"
            >
              {isPending ? 'Confirming...' : 'Confirm Deactivate'}
            </button>
            <button
              onClick={() => setOpen(false)}
              className="px-3 py-1.5 border border-gray-200 text-gray-600 text-xs rounded hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
          </div>
          {txHash && (
            <a href={blockscoutTx(txHash)} target="_blank" rel="noopener noreferrer"
              className="block text-xs text-green-600 hover:underline mt-2 font-mono">
              {txHash.slice(0,16)}... ↗
            </a>
          )}
        </div>
      )}
    </div>
  );
}

// ── Stake Section ─────────────────────────────────────────────────────────────

function StakeSection({ stake, minStake, refetch }: {
  stake: bigint;
  minStake: bigint;
  refetch: () => void;
}) {
  const [mode,      setMode]      = useState<'add' | 'withdraw'>('add');
  const [amount,    setAmount]    = useState('');
  const [error,     setError]     = useState('');
  const [lastTx,    setLastTx]    = useState<string>('');
  const [done,      setDone]      = useState(false);
  const [submitted, setSubmitted] = useState(false);  // ← prevents double-click

  const { writeContract, data: txHash, isPending, reset } = useWriteContract();
  const { isSuccess, isLoading: isConfirming } = useWaitForTransactionReceipt({
    hash: txHash,
    confirmations: 1,
    timeout: 30_000,
    pollingInterval: 2_000,
  });

  useEffect(() => {
    if (isSuccess && txHash) {
      setLastTx(txHash);
      setDone(true);
      setAmount('');
      setSubmitted(false);
      refetch();
    }
  }, [isSuccess, txHash, refetch]);

  const surplus     = stake > minStake ? stake - minStake : 0n;
  const maxWithdraw = surplus;

  const handleSubmit = () => {
    if (submitted) return;  // ← hard guard
    setError('');
    setDone(false);
    let wei: bigint;
    try { wei = parseEther(amount); } catch { setError('Invalid amount'); return; }
    if (wei <= 0n) { setError('Amount must be greater than 0'); return; }

    setSubmitted(true);  // ← lock immediately before async call

    if (mode === 'add') {
      writeContract({
        address:      CONTRACTS.IdentityRegistry,
        abi:          IDENTITY_REGISTRY_ABI,
        functionName: 'addStake',
        gas:          TX_OPTIONS.gas,
        gasPrice:     TX_OPTIONS.gasPrice,
        value:        wei,
      });
    } else {
      if (wei > maxWithdraw) {
        setError(`Max withdrawable: ${formatEther(maxWithdraw)} PAS`);
        return;
      }
      writeContract({
        address:      CONTRACTS.IdentityRegistry,
        abi:          IDENTITY_REGISTRY_ABI,
        functionName: 'withdrawStake',
        ...TX_OPTIONS,
        args:         [wei],
      });
    }
  };

  const handleModeChange = (m: 'add' | 'withdraw') => {
    setMode(m);
    setError('');
    setAmount('');
    setDone(false);
    setSubmitted(false);
    reset();
  };

  return (
    <div className="border border-gray-200 rounded-lg p-4">
      <div className="text-sm font-semibold text-gray-900 mb-1">Manage Stake</div>
      <p className="text-xs text-gray-500 mb-3 leading-relaxed">
        Current: <span className="font-mono text-gray-900">{formatEther(stake)} PAS</span>
        {' · '}
        Min: <span className="font-mono text-gray-900">{formatEther(minStake)} PAS</span>
        {' · '}
        Withdrawable: <span className="font-mono text-gray-900">{formatEther(maxWithdraw)} PAS</span>
      </p>

      <div className="flex border border-gray-200 rounded overflow-hidden mb-3 text-xs font-medium">
        <button onClick={() => handleModeChange('add')}
          className={`flex-1 py-1.5 transition-colors ${mode === 'add' ? 'bg-gray-900 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>
          + Add stake
        </button>
        <button onClick={() => handleModeChange('withdraw')}
          className={`flex-1 py-1.5 transition-colors ${mode === 'withdraw' ? 'bg-gray-900 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>
          − Withdraw
        </button>
      </div>

      {done ? (
        <div className="text-xs text-green-600 font-medium">
          ✓ {mode === 'add' ? 'Stake added' : 'Withdrawal successful'}
          {lastTx && (
            <a href={blockscoutTx(lastTx as `0x${string}`)} target="_blank" rel="noopener noreferrer"
              className="ml-2 hover:underline font-mono">{lastTx.slice(0,16)}... ↗</a>
          )}
          <button onClick={() => { setDone(false); reset(); }}
            className="ml-3 text-gray-400 hover:text-gray-600">Try again</button>
        </div>
      ) : (
        <>
          <div className="flex gap-2">
            <input
              type="number" min="0" step="0.01"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              placeholder={mode === 'add' ? 'Amount (PAS)' : `Max ${formatEther(maxWithdraw)} PAS`}
              className="flex-1 border border-gray-200 rounded px-3 py-2 text-xs font-mono focus:outline-none focus:border-green-500"
            />
            {mode === 'withdraw' && maxWithdraw > 0n && (
              <button onClick={() => setAmount(formatEther(maxWithdraw))}
                className="px-3 py-2 border border-gray-200 rounded text-xs hover:bg-gray-50 transition-colors whitespace-nowrap">
                Max
              </button>
            )}
          </div>
          {error && <p className="text-xs text-red-500 mt-1.5">{error}</p>}
          <button
            onClick={handleSubmit}
            disabled={submitted || isPending || isConfirming || !amount || (mode === 'withdraw' && maxWithdraw === 0n)}
            className="mt-2 w-full py-2 bg-gray-900 text-white text-xs font-medium rounded hover:bg-gray-800 transition-colors disabled:opacity-50"
          >
            {isPending     ? 'Confirm in wallet...' :
             isConfirming  ? 'Confirming...' :
             mode === 'add' ? `Add ${amount || '0'} PAS` :
                              `Withdraw ${amount || '0'} PAS`}
          </button>
          {isConfirming && txHash && (
            <div className="mt-2 text-xs text-gray-500">
              Tx submitted —{' '}
              <a href={blockscoutTx(txHash)} target="_blank" rel="noopener noreferrer"
                className="text-green-600 hover:underline font-mono">
                {txHash.slice(0,16)}... ↗
              </a>
              <button onClick={() => { setDone(true); setLastTx(txHash); setSubmitted(false); refetch(); }}
                className="ml-3 text-gray-400 hover:text-gray-600 underline">
                Mark as done
              </button>
            </div>
          )}
          {mode === 'withdraw' && maxWithdraw === 0n && (
            <p className="text-xs text-gray-400 mt-1.5">Nothing to withdraw — stake equals minimum required.</p>
          )}
        </>
      )}
    </div>
  );
}

// ── Endorse Section ───────────────────────────────────────────────────────────

function EndorseSection({ myCommitment }: { myCommitment: `0x${string}` }) {
  const [targetCommitment, setTargetCommitment] = useState('');
  const [error, setError] = useState('');
  const { writeContract, data: txHash, isPending } = useWriteContract();
  const { isSuccess } = useWaitForTransactionReceipt({ hash: txHash });

  const handleEndorse = () => {
    setError('');
    if (!targetCommitment.startsWith('0x') || targetCommitment.length !== 66) {
      setError('Enter a valid bytes32 commitment (0x + 64 hex chars)');
      return;
    }
    writeContract({
      address:      CONTRACTS.ReputationRegistry,
      abi:          REPUTATION_REGISTRY_ABI,
      functionName: 'endorseIdentity',
      ...TX_OPTIONS,
      args:         [myCommitment, targetCommitment as `0x${string}`],
    });
  };

  return (
    <div className="border border-gray-200 rounded-lg p-4">
      <div className="text-sm font-semibold text-gray-900 mb-1">Endorse an Identity</div>
      <p className="text-xs text-gray-500 mb-3 leading-relaxed">
        Endorsing adds weighted reputation points to another identity.
        Requires ≥50 global reputation. Cooldown: 600 blocks (~1 hour).
      </p>
      {isSuccess ? (
        <div className="text-xs text-green-600 font-medium">
          ✓ Endorsement recorded
          {txHash && (
            <a href={blockscoutTx(txHash)} target="_blank" rel="noopener noreferrer"
              className="ml-2 hover:underline font-mono">{txHash.slice(0,16)}... ↗</a>
          )}
        </div>
      ) : (
        <>
          <input
            value={targetCommitment}
            onChange={e => setTargetCommitment(e.target.value)}
            placeholder="0x... commitment to endorse"
            className="w-full border border-gray-200 rounded px-3 py-2 text-xs font-mono mb-2 focus:outline-none focus:border-green-500"
          />
          {error && <p className="text-xs text-red-500 mb-2">{error}</p>}
          <button
            onClick={handleEndorse}
            disabled={isPending}
            className="px-4 py-2 bg-gray-900 text-white text-xs font-medium rounded hover:bg-gray-800 transition-colors disabled:opacity-50"
          >
            {isPending ? 'Confirming...' : 'Endorse'}
          </button>
        </>
      )}
    </div>
  );
}

// ── Dashboard ─────────────────────────────────────────────────────────────────

export default function Dashboard() {
  const { address, isConnected } = useAccount();
  const identity = useIdentity();
  const navigate = useNavigate();

  const { data: minimumStake = 0n } = useReadContract({
    address:      CONTRACTS.IdentityRegistry,
    abi:          IDENTITY_REGISTRY_ABI,
    functionName: 'minimumStake',
  });

  if (!isConnected) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="max-w-sm w-full text-center">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Connect Wallet</h2>
          <p className="text-sm text-gray-500 mb-6">Connect your wallet to view your identity dashboard.</p>
          <div className="flex justify-center">
            <ConnectButton />
          </div>
        </div>
      </div>
    );
  }

  if (identity.isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-sm text-gray-400">Loading identity...</div>
      </div>
    );
  }

  if (!identity.isRegistered) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="max-w-sm w-full text-center">
          <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-gray-400 text-xl">○</span>
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">No Identity Found</h2>
          <p className="text-sm text-gray-500 mb-6">
            This wallet doesn't have a Civyx identity yet.
          </p>
          <button
            onClick={() => navigate('/app/register')}
            className="px-5 py-2.5 bg-green-600 text-white text-sm font-medium rounded hover:bg-green-700 transition-colors"
          >
            Register Identity
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white px-4 py-12">
      <div className="max-w-2xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Dashboard</h1>
            <p className="text-sm text-gray-500 mt-0.5 font-mono">
              {address?.slice(0,6)}...{address?.slice(-4)}
            </p>
          </div>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-green-50 text-green-700 text-xs font-medium rounded-full border border-green-200">
            <span className="w-1.5 h-1.5 bg-green-500 rounded-full" />
            Active
          </span>
        </div>

        {/* Identity Card */}
        <div className="border border-gray-200 rounded-lg p-6">
          <div className="text-sm font-semibold text-gray-900 mb-4">Identity</div>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <StatCard
              label="Stake"
              value={`${formatEther(identity.stake)} PAS`}
              sub="locked as Sybil resistance"
            />
            <StatCard
              label="Linked Wallets"
              value={identity.walletCount.toString()}
              sub="across this identity"
            />
          </div>
          <div className="bg-gray-50 border border-gray-200 rounded p-3">
            <div className="text-xs text-gray-500 mb-1">Commitment</div>
            <a
              href={blockscoutAddress(identity.commitment)}
              target="_blank"
              rel="noopener noreferrer"
              className="font-mono text-xs text-gray-900 break-all hover:text-green-600 transition-colors"
            >
              {identity.commitment}
            </a>
          </div>
        </div>

        {/* Reputation Card */}
        <div className="border border-gray-200 rounded-lg p-6">
          <div className="text-sm font-semibold text-gray-900 mb-4">Reputation</div>
          <div className="grid grid-cols-3 gap-4 mb-4">
            <StatCard
              label="Global Rep"
              value={identity.globalRep.toString()}
              sub="awarded by oracles"
            />
            <StatCard
              label="Effective Rep"
              value={identity.effectiveRep.toString()}
              sub="global + endorsements"
            />
            <StatCard
              label="Endorsements"
              value={identity.endorsements.toString()}
              sub="received"
            />
          </div>
          <div>
            <div className="flex justify-between text-xs text-gray-500 mb-1">
              <span>Effective reputation</span>
              <span className="font-mono">{identity.effectiveRep.toString()} / 1000</span>
            </div>
            <RepBar value={identity.effectiveRep} />
          </div>
          {identity.effectiveRep < 50n && (
            <p className="text-xs text-gray-400 mt-3">
              You need 50+ reputation to endorse other identities.
            </p>
          )}
        </div>

        {/* Secret Status */}
        <div className={`border rounded-lg p-4 ${identity.hasSecret ? 'border-green-200 bg-green-50' : 'border-amber-200 bg-amber-50'}`}>
          <div className="flex items-center gap-2">
            <span className={`text-sm font-medium ${identity.hasSecret ? 'text-green-700' : 'text-amber-700'}`}>
              {identity.hasSecret ? '✓ Secret available in this browser' : '⚠ Secret not found for this wallet'}
            </span>
          </div>
          {!identity.hasSecret && (
            <p className="text-xs text-amber-600 mt-1 leading-relaxed">
              This wallet is linked to an identity, but the secret isn't stored in this browser.
              To link more wallets, switch to the wallet you used when registering and export the secret file,
              then import it on the <a href="/app/link" className="underline font-medium">Link Wallet</a> page.
            </p>
          )}
        </div>

        {/* Linked Wallets */}
        <div className="border border-gray-200 rounded-lg p-6">
          <LinkedWallets
            commitment={identity.commitment}
            currentWallet={address!}
          />
        </div>

        {/* Endorse */}
        {identity.effectiveRep >= 50n && (
          <EndorseSection myCommitment={identity.commitment} />
        )}

        {/* Stake Management */}
        <StakeSection
          stake={identity.stake}
          minStake={minimumStake as bigint}
          refetch={identity.refetch}
        />

        {/* Deactivate */}
        <DeactivateSection stake={identity.stake} refetch={identity.refetch} />

      </div>
    </div>
  );
}
