import { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { parseEther } from 'viem';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import {
  generateSecret,
  saveSecret,
  downloadSecret,
  shortHash,
} from '@/lib/crypto';
import { CONTRACTS, IDENTITY_REGISTRY_ABI, blockscoutTx } from '@/lib/contracts';
import { TX_OPTIONS } from '@/lib/txOptions';
import { useIdentity } from '@/hooks/useIdentity';

type Step = 'generate' | 'backup' | 'register' | 'done';

// ── Compute commitment via UltraHonkBackend ───────────────────────────────────
// UltraHonkBackend initialises its own Barretenberg WASM internally.
// We access it after instantiation to call pedersenHash.
// This avoids calling Barretenberg.new() directly which hangs on Vercel.

async function computeCommitmentViaCircuit(secret: string): Promise<`0x${string}`> {
  // Strategy: call generateProof which internally initialises Barretenberg WASM.
  // After that call (even if it fails), the WASM worker is running.
  // We then call Barretenberg.new() which reuses the already-loaded WASM.
  //
  // To make generateProof run at all, we need to get past noir.execute().
  // We achieve this by using the wallet_link circuit with dummy inputs — 
  // it will fail at constraint check but the WASM will be fully initialised.
  // Then Barretenberg.new() succeeds immediately.

  const BN254_MOD = 21888242871839275222246405745257275088548364400416034343698204186575808495617n;
  const { Noir } = await import('@noir-lang/noir_js');
  const { UltraHonkBackend, Barretenberg } = await import('@aztec/bb.js');

  const fieldToBytes = (v: bigint): Uint8Array => {
    const reduced = ((v % BN254_MOD) + BN254_MOD) % BN254_MOD;
    const hex = reduced.toString(16).padStart(64, '0');
    const b = new Uint8Array(32);
    for (let i = 0; i < 32; i++) b[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
    return b;
  };

  console.log('[commitment] Warming WASM via UltraHonkBackend...');
  const circuit = await fetch('/identity.json').then(r => r.json());
  const backend = new UltraHonkBackend(circuit.bytecode, { threads: 1 });

  // Call generateProof with dummy inputs to force WASM worker initialisation.
  // This will throw (wrong commitment) but that's expected — we only need
  // the WASM to be loaded as a side effect.
  const noir = new Noir(circuit);
  await noir.init();

  try {
    // Pass secret as both secret and commitment — wrong commitment, will fail.
    // But noir.execute() runs the ACVM which initialises the WASM worker.
    const dummyField = (BigInt(secret) % BN254_MOD).toString();
    await noir.execute({ secret: dummyField, commitment: dummyField });
  } catch {
    // Expected — commitment mismatch. WASM is now warm.
    console.log('[commitment] WASM warmed (expected constraint failure)');
  }

  // Now Barretenberg.new() should succeed quickly — WASM already loaded
  console.log('[commitment] Calling Barretenberg.new() on warm WASM...');
  const bar = await Promise.race([
    Barretenberg.new(),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Barretenberg.new() timed out even after WASM warm-up')), 15000)
    ),
  ]) as any;

  console.log('[commitment] Barretenberg ready, computing pedersen hash...');
  const result = await bar.pedersenHash({
    inputs: [fieldToBytes(BigInt(secret))],
    hashIndex: 0,
  });
  await bar.destroy();

  const commitment = ('0x' + Array.from(result.hash as Uint8Array)
    .map((b: number) => b.toString(16).padStart(2, '0'))
    .join('')) as `0x${string}`;
  console.log('[commitment] commitment:', commitment);
  return commitment;
}

export default function Register() {
  const { address, isConnected } = useAccount();
  const { isRegistered, refetch } = useIdentity();
  const navigate = useNavigate();

  const [step,       setStep]       = useState<Step>('generate');
  const [secret,     setSecret]     = useState<string>('');
  const [commitment, setCommitment] = useState<`0x${string}`>('0x');
  const [downloaded, setDownloaded] = useState(false);
  const [stakeInput, setStakeInput] = useState('0.01');
  const [error,      setError]      = useState('');
  const [computing,  setComputing]  = useState(false);

  const { writeContract, data: txHash, isPending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash: txHash });

  const handleGenerate = useCallback(async () => {
    setError('');
    setComputing(true);
    try {
      const s = generateSecret();
      console.log('[register] secret generated:', s.slice(0, 10) + '...');
      console.log('[register] computing commitment...');
      const c = await computeCommitmentViaCircuit(s);
      console.log('[register] commitment:', c);
      setSecret(s);
      setCommitment(c);
      setStep('backup');
    } catch (e: any) {
      console.error('[register] error:', e);
      setError(e.message);
    } finally {
      setComputing(false);
    }
  }, []);

  const handleDownload = useCallback(() => {
    if (!address) return;
    downloadSecret(secret, address);
    saveSecret(secret, address);
    setDownloaded(true);
  }, [secret, address]);

  const handleRegister = useCallback(async () => {
    setError('');
    try {
      const stake = parseEther(stakeInput || '0.01');
      writeContract({
        address:      CONTRACTS.IdentityRegistry,
        abi:          IDENTITY_REGISTRY_ABI,
        functionName: 'registerIdentity',
        ...TX_OPTIONS,
        args:         [commitment],
        value:        stake,
      });
      setStep('register');
    } catch (e: any) {
      setError(e.message);
    }
  }, [commitment, stakeInput, writeContract]);

  useEffect(() => {
    if (isSuccess && step === 'register') {
      refetch();
      setStep('done');
    }
  }, [isSuccess, step, refetch]);

  if (isRegistered) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="max-w-md w-full text-center">
          <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-green-600 text-xl">✓</span>
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Already Registered</h2>
          <p className="text-sm text-gray-500 mb-6">This wallet already has a Civyx identity.</p>
          <button onClick={() => navigate('/app')}
            className="px-5 py-2.5 bg-green-600 text-white text-sm font-medium rounded hover:bg-green-700 transition-colors">
            View Dashboard
          </button>
        </div>
      </div>
    );
  }

  if (!isConnected) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="max-w-sm w-full text-center">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Connect Wallet</h2>
          <p className="text-sm text-gray-500 mb-6">Connect your wallet to register a Civyx identity.</p>
          <div className="flex justify-center"><ConnectButton /></div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white px-4 py-12">
      <div className="max-w-lg mx-auto">

        <div className="mb-10">
          <h1 className="text-2xl font-semibold text-gray-900">Register Identity</h1>
          <p className="text-sm text-gray-500 mt-1">Create your Civyx identity in three steps.</p>
        </div>

        <div className="flex items-center gap-2 mb-10">
          {(['generate', 'backup', 'register', 'done'] as Step[]).map((s, i) => {
            const steps = ['generate', 'backup', 'register', 'done'];
            const done  = steps.indexOf(s) < steps.indexOf(step) || step === 'done';
            const active = s === step;
            return (
              <div key={s} className="flex items-center gap-2">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium transition-colors ${
                  done ? 'bg-green-600 text-white' : active ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-400'
                }`}>{done ? '✓' : i + 1}</div>
                {i < 3 && <div className={`h-px w-8 transition-colors ${done ? 'bg-green-600' : 'bg-gray-200'}`} />}
              </div>
            );
          })}
          <div className="ml-2 text-xs text-gray-400 capitalize">{step}</div>
        </div>

        {step === 'generate' && (
          <div className="border border-gray-200 rounded-lg p-6">
            <h2 className="text-base font-semibold text-gray-900 mb-1">Generate your secret</h2>
            <p className="text-sm text-gray-500 mb-6 leading-relaxed">
              A random secret will be created in your browser.
              It <strong>never leaves your device</strong> and cannot be recovered if lost.
            </p>
            <div className="bg-gray-50 border border-gray-200 rounded p-4 mb-6">
              <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">How it works</div>
              <ul className="space-y-1.5 text-sm text-gray-600">
                <li>• Your browser generates 32 random bytes</li>
                <li>• A commitment (hash) is computed from the secret</li>
                <li>• Only the commitment is stored on-chain</li>
                <li>• The secret stays on your device</li>
              </ul>
            </div>
            {error && (
              <div className="border border-red-200 bg-red-50 rounded p-3 mb-4 text-xs text-red-600">{error}</div>
            )}
            <button onClick={handleGenerate} disabled={computing}
              className="w-full py-2.5 bg-gray-900 text-white text-sm font-medium rounded hover:bg-gray-800 transition-colors disabled:opacity-50">
              {computing ? 'Computing commitment...' : 'Generate Secret'}
            </button>
          </div>
        )}

        {step === 'backup' && (
          <div className="border border-gray-200 rounded-lg p-6">
            <h2 className="text-base font-semibold text-gray-900 mb-1">Back up your secret</h2>
            <p className="text-sm text-gray-500 mb-6 leading-relaxed">
              Download your secret file now. If you lose it, you cannot link new wallets.
            </p>
            <div className="bg-gray-50 border border-gray-200 rounded p-4 mb-4 font-mono">
              <div className="text-xs text-gray-500 mb-1">Your commitment (stored on-chain)</div>
              <div className="text-xs text-gray-900 break-all">{shortHash(commitment)}</div>
            </div>
            <div className={`border rounded p-4 mb-6 transition-colors ${downloaded ? 'border-green-200 bg-green-50' : 'border-gray-200 bg-gray-50'}`}>
              <div className="text-xs text-gray-500 mb-1">Your secret (never leaves your device)</div>
              <div className="text-xs font-mono text-gray-900 break-all">{secret.slice(0, 16)}...{secret.slice(-8)}</div>
            </div>
            <button onClick={handleDownload}
              className={`w-full py-2.5 text-sm font-medium rounded transition-colors mb-3 ${
                downloaded ? 'bg-green-600 text-white hover:bg-green-700' : 'bg-gray-900 text-white hover:bg-gray-800'
              }`}>
              {downloaded ? '✓ Downloaded' : 'Download Backup File'}
            </button>
            {downloaded && (
              <button onClick={() => setStep('register')}
                className="w-full py-2.5 border border-gray-200 text-gray-700 text-sm font-medium rounded hover:bg-gray-50 transition-colors">
                Continue to Register →
              </button>
            )}
            {!downloaded && (
              <p className="text-xs text-center text-gray-400">You must download the backup before continuing.</p>
            )}
          </div>
        )}

        {step === 'register' && !isSuccess && (
          <div className="border border-gray-200 rounded-lg p-6">
            <h2 className="text-base font-semibold text-gray-900 mb-1">Register on-chain</h2>
            <p className="text-sm text-gray-500 mb-6 leading-relaxed">
              Your commitment will be stored on-chain with a PAS stake.
              The stake is returned when you deactivate your identity.
            </p>
            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1.5">Stake amount (PAS)</label>
                <input type="number" min="0.01" step="0.01" value={stakeInput}
                  onChange={e => setStakeInput(e.target.value)}
                  className="w-full border border-gray-200 rounded px-3 py-2 text-sm font-mono focus:outline-none focus:border-green-500" />
                <p className="text-xs text-gray-400 mt-1">Minimum: 0.01 PAS</p>
              </div>
              <div className="bg-gray-50 border border-gray-200 rounded p-4">
                <div className="text-xs font-medium text-gray-500 mb-2">Transaction summary</div>
                <div className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-500">Commitment</span>
                    <span className="font-mono text-gray-900">{shortHash(commitment)}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-500">Wallet</span>
                    <span className="font-mono text-gray-900">{address?.slice(0,6)}...{address?.slice(-4)}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-500">Stake</span>
                    <span className="font-mono text-gray-900">{stakeInput} PAS</span>
                  </div>
                </div>
              </div>
            </div>
            {error && (
              <div className="border border-red-200 bg-red-50 rounded p-3 mb-4 text-xs text-red-600">{error}</div>
            )}
            <button onClick={handleRegister} disabled={isPending || isConfirming}
              className="w-full py-2.5 bg-green-600 text-white text-sm font-medium rounded hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
              {isPending ? 'Confirm in wallet...' : isConfirming ? 'Confirming...' : 'Register Identity'}
            </button>
            {txHash && (
              <a href={blockscoutTx(txHash)} target="_blank" rel="noopener noreferrer"
                className="block text-center text-xs text-green-600 hover:underline mt-3 font-mono">
                {txHash.slice(0,16)}... ↗
              </a>
            )}
          </div>
        )}

        {step === 'done' && (
          <div className="border border-green-200 bg-green-50 rounded-lg p-8 text-center">
            <div className="w-12 h-12 bg-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-white text-xl">✓</span>
            </div>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">Identity Registered</h2>
            <p className="text-sm text-gray-600 mb-2">Your Civyx identity is live on Polkadot Hub.</p>
            {txHash && (
              <a href={blockscoutTx(txHash)} target="_blank" rel="noopener noreferrer"
                className="text-xs font-mono text-green-600 hover:underline block mb-6">
                View transaction ↗
              </a>
            )}
            <button onClick={() => navigate('/app')}
              className="px-5 py-2.5 bg-green-600 text-white text-sm font-medium rounded hover:bg-green-700 transition-colors">
              View Dashboard
            </button>
          </div>
        )}

      </div>
    </div>
  );
}
