import { useState, useCallback } from 'react';
import { useAccount } from 'wagmi';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useProof } from '@/hooks/useProof';
import { loadSecret } from '@/lib/crypto';
import { CONTRACTS, blockscoutTx } from '@/lib/contracts';

const BN254_MOD = 21888242871839275222246405745257275088548364400416034343698204186575808495617n;

async function computePedersenHash(inputs: bigint[]): Promise<string> {
  const { pedersenHash } = await import('@/lib/crypto');
  return pedersenHash(inputs);
}

function StepCard({ n, title, done, children }: { n: number; title: string; done?: boolean; children: React.ReactNode }) {
  return (
    <div className={`border rounded-lg p-5 ${done ? 'border-green-200 bg-green-50' : 'border-gray-200'}`}>
      <div className="flex items-center gap-3 mb-3">
        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold ${done ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-600'}`}>
          {done ? '✓' : n}
        </div>
        <div className="text-sm font-semibold text-gray-900">{title}</div>
      </div>
      {children}
    </div>
  );
}

export default function NullifierDemo() {
  const { address, isConnected } = useAccount();
  const proofHook = useProof();

  const [secret,     setSecret]     = useState('');
  const [actionId,   setActionId]   = useState('civyx-demo-action-001');
  const [commitment, setCommitment] = useState('');
  const [nullifier,  setNullifier]  = useState('');
  const [proofHex,   setProofHex]   = useState('');
  const [step,       setStep]       = useState<'setup' | 'compute' | 'prove' | 'done'>('setup');
  const [error,      setError]      = useState('');
  const [computing,  setComputing]  = useState(false);

  // Load secret from localStorage
  const handleLoadSecret = useCallback(() => {
    if (!address) return;
    const stored = loadSecret(address);
    if (stored) {
      setSecret(stored);
      setError('');
    } else {
      setError('No secret found for this wallet. Register an identity first.');
    }
  }, [address]);

  // Step 1 → 2: compute commitment + nullifier
  const handleCompute = useCallback(async () => {
    setError('');
    if (!secret.startsWith('0x') || secret.length !== 66) {
      setError('Invalid secret format.');
      return;
    }
    setComputing(true);
    try {
      const secretBig   = BigInt(secret);
      const actionBig   = BigInt('0x' + Buffer.from(actionId).toString('hex').slice(0, 62).padEnd(62, '0'));
      const c = await computePedersenHash([secretBig]);
      const n = await computePedersenHash([secretBig, actionBig]);
      setCommitment(c);
      setNullifier(n);
      setStep('prove');
    } catch(e: any) {
      setError('Computation failed: ' + e.message);
    } finally {
      setComputing(false);
    }
  }, [secret, actionId]);

  // Step 2 → 3: generate ZK proof
  const handleGenerateProof = useCallback(async () => {
    setError('');
    const mod = BN254_MOD;
    const actionBig = BigInt('0x' + Buffer.from(actionId).toString('hex').slice(0, 62).padEnd(62, '0'));
    const inputs = {
      secret:     (BigInt(secret) % mod).toString(),
      commitment: (BigInt(commitment) % mod).toString(),
      nullifier:  (BigInt(nullifier) % mod).toString(),
      action_id:  (actionBig % mod).toString(),
    };

    const result = await proofHook.generate(async (onProgress) => {
      const { generateNullifierProof } = await import('@/lib/proof');
      return generateNullifierProof(secret, commitment, nullifier, actionBig.toString(), onProgress);
    });

    if (result) {
      setProofHex(result.proof);
      setStep('done');
    }
  }, [secret, commitment, nullifier, actionId, proofHook]);

  return (
    <div className="min-h-screen bg-white px-4 py-12">
      <div className="max-w-2xl mx-auto">

        {/* Header */}
        <div className="mb-8">
          <p className="text-xs font-semibold text-green-600 uppercase tracking-widest mb-2">Developer Demo</p>
          <h1 className="text-2xl font-semibold text-gray-900">Nullifier Proof</h1>
          <p className="text-sm text-gray-500 mt-1 leading-relaxed">
            Prove you participated in an action (e.g. voted, claimed, attended) exactly once —
            without revealing which wallet you used.
          </p>
        </div>

        {/* Explainer */}
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-8 text-xs text-gray-600 leading-relaxed">
          <div className="font-semibold text-gray-900 mb-1">How it works</div>
          A nullifier is <code className="bg-white px-1 rounded border border-gray-200">pedersen_hash([secret, action_id])</code>.
          The ZK proof proves you know the secret behind a valid commitment AND computed the nullifier correctly.
          Organizers store used nullifiers on-chain — if your nullifier already exists, you can't participate again.
          Your wallet address is never revealed.
        </div>

        {!isConnected ? (
          <div className="text-center py-12">
            <p className="text-sm text-gray-500 mb-4">Connect your wallet to try the nullifier demo</p>
            <div className="flex justify-center"><ConnectButton /></div>
          </div>
        ) : (
          <div className="space-y-4">

            {/* Step 1 — Setup */}
            <StepCard n={1} title="Load secret & set action ID" done={step !== 'setup'}>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Secret</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={secret}
                      onChange={e => setSecret(e.target.value)}
                      placeholder="0x0000...0000"
                      className="flex-1 border border-gray-200 rounded px-3 py-1.5 text-xs font-mono focus:outline-none focus:border-green-500"
                    />
                    <button onClick={handleLoadSecret}
                      className="px-3 py-1.5 border border-gray-200 rounded text-xs hover:bg-gray-50 transition-colors whitespace-nowrap">
                      Load from storage
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Action ID</label>
                  <input
                    type="text"
                    value={actionId}
                    onChange={e => setActionId(e.target.value)}
                    placeholder="civyx-demo-action-001"
                    className="w-full border border-gray-200 rounded px-3 py-1.5 text-xs font-mono focus:outline-none focus:border-green-500"
                  />
                  <p className="text-xs text-gray-400 mt-1">Organizer-defined string identifying this specific action/event.</p>
                </div>
                {error && <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded p-2">{error}</div>}
                <button onClick={handleCompute} disabled={!secret || computing}
                  className="w-full py-2 bg-gray-900 text-white text-sm font-medium rounded hover:bg-gray-800 transition-colors disabled:opacity-50">
                  {computing ? 'Computing...' : 'Compute commitment & nullifier →'}
                </button>
              </div>
            </StepCard>

            {/* Step 2 — Computed values */}
            {step !== 'setup' && (
              <StepCard n={2} title="Computed values" done={step === 'prove' || step === 'done'}>
                <div className="space-y-2 text-xs font-mono">
                  <div>
                    <span className="text-gray-500 mr-2">Commitment:</span>
                    <span className="text-gray-900 break-all">{commitment.slice(0,20)}...{commitment.slice(-6)}</span>
                  </div>
                  <div>
                    <span className="text-gray-500 mr-2">Nullifier:  </span>
                    <span className="text-gray-900 break-all">{nullifier.slice(0,20)}...{nullifier.slice(-6)}</span>
                  </div>
                  <div>
                    <span className="text-gray-500 mr-2">Action ID:  </span>
                    <span className="text-gray-900">{actionId}</span>
                  </div>
                </div>
                {step === 'prove' && (
                  <div className="mt-3">
                    {proofHook.state.status === 'running' && (
                      <div className="mb-3">
                        <div className="flex justify-between text-xs text-gray-500 mb-1">
                          <span>{proofHook.state.progress.label}</span>
                          <span>{proofHook.state.progress.pct}%</span>
                        </div>
                        <div className="w-full bg-gray-100 rounded-full h-1.5">
                          <div className="bg-green-600 h-1.5 rounded-full transition-all" style={{ width: `${proofHook.state.progress.pct}%` }} />
                        </div>
                      </div>
                    )}
                    {proofHook.state.error && (
                      <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded p-2 mb-3">{proofHook.state.error}</div>
                    )}
                    <button onClick={handleGenerateProof} disabled={proofHook.state.status === 'running'}
                      className="w-full py-2 bg-gray-900 text-white text-sm font-medium rounded hover:bg-gray-800 transition-colors disabled:opacity-50">
                      {proofHook.state.status === 'running' ? 'Generating proof...' : 'Generate ZK proof →'}
                    </button>
                  </div>
                )}
              </StepCard>
            )}

            {/* Step 3 — Proof generated */}
            {step === 'done' && (
              <StepCard n={3} title="Proof ready" done>
                <div className="space-y-2 text-xs">
                  <div className="bg-white border border-green-200 rounded p-3">
                    <div className="text-gray-500 mb-1">Proof (8640 bytes, UltraHonk)</div>
                    <div className="font-mono text-gray-900 break-all">
                      {proofHex.slice(0, 40)}...{proofHex.slice(-8)}
                    </div>
                  </div>
                  <div className="bg-white border border-gray-200 rounded p-3">
                    <div className="text-gray-500 mb-1">Nullifier to store on-chain</div>
                    <div className="font-mono text-gray-900 break-all">{nullifier}</div>
                  </div>
                  <div className="bg-gray-50 border border-gray-200 rounded p-3 text-gray-600 leading-relaxed">
                    <div className="font-medium text-gray-900 mb-1">Integration</div>
                    Your smart contract should call <code className="bg-white px-1 rounded border border-gray-200">NullifierVerifier.verify(proof, [commitment, nullifier, action_id])</code>,
                    then store the nullifier to prevent replay.
                  </div>
                  <button onClick={() => { setStep('setup'); setProofHex(''); setNullifier(''); setCommitment(''); }}
                    className="w-full py-2 border border-gray-200 text-sm text-gray-600 rounded hover:bg-gray-50 transition-colors">
                    Try again
                  </button>
                </div>
              </StepCard>
            )}

          </div>
        )}
      </div>
    </div>
  );
}
