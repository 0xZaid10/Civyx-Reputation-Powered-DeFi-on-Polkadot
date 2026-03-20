import { useState, useCallback } from 'react';
import { useAccount, useReadContract } from 'wagmi';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useProof } from '@/hooks/useProof';
import { loadSecret } from '@/lib/crypto';
import { CONTRACTS, IDENTITY_REGISTRY_ABI, blockscoutAddress } from '@/lib/contracts';

const BN254_MOD = 21888242871839275222246405745257275088548364400416034343698204186575808495617n;

function InfoRow({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-start gap-4 py-2 border-b border-gray-100 last:border-0">
      <div className="w-36 shrink-0 text-xs text-gray-500">{label}</div>
      <div className={`text-xs ${mono ? 'font-mono' : ''} text-gray-900 break-all`}>{value}</div>
    </div>
  );
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

export default function IdentityDemo() {
  const { address, isConnected } = useAccount();
  const proofHook = useProof();

  const [secret,     setSecret]     = useState('');
  const [commitment, setCommitment] = useState('');
  const [proofHex,   setProofHex]   = useState('');
  const [step,       setStep]       = useState<'setup' | 'prove' | 'done'>('setup');
  const [error,      setError]      = useState('');
  const [computing,  setComputing]  = useState(false);
  const [queryAddr,  setQueryAddr]  = useState('');

  // Read identity from registry
  const { data: isRegistered } = useReadContract({
    address: CONTRACTS.IdentityRegistry,
    abi:     IDENTITY_REGISTRY_ABI,
    functionName: 'verifyIdentity',
    args:    [queryAddr as `0x${string}`],
    query:   { enabled: queryAddr.length === 42 },
  });

  const { data: storedCommitment } = useReadContract({
    address: CONTRACTS.IdentityRegistry,
    abi:     IDENTITY_REGISTRY_ABI,
    functionName: 'getCommitment',
    args:    [queryAddr as `0x${string}`],
    query:   { enabled: queryAddr.length === 42 },
  });

  const { data: linkedWallets } = useReadContract({
    address: CONTRACTS.IdentityRegistry,
    abi:     IDENTITY_REGISTRY_ABI,
    functionName: 'getLinkedWallets',
    args:    [storedCommitment as `0x${string}`],
    query:   { enabled: !!storedCommitment && storedCommitment !== '0x' + '0'.repeat(64) },
  });

  const handleLoadSecret = useCallback(() => {
    if (!address) return;
    const stored = loadSecret(address);
    if (stored) { setSecret(stored); setError(''); }
    else setError('No secret found. Register an identity first.');
  }, [address]);

  const handleComputeCommitment = useCallback(async () => {
    setError('');
    if (!secret.startsWith('0x') || secret.length !== 66) {
      setError('Invalid secret format.');
      return;
    }
    setComputing(true);
    try {
      const { Barretenberg } = await import('@aztec/bb.js');
      const cbind = await import(/* @vite-ignore */ new URL(
        '../../node_modules/@aztec/bb.js/dest/browser/cbind/generated/async.js',
        import.meta.url
      ).href);
      function fieldToBytes(v: bigint): Uint8Array {
        const r   = ((v % BN254_MOD) + BN254_MOD) % BN254_MOD;
        const hex = r.toString(16).padStart(64, '0');
        const b   = new Uint8Array(32);
        for (let i = 0; i < 32; i++) b[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
        return b;
      }
      const bar = await Barretenberg.new(1);
      const api = new cbind.AsyncApi(bar.backend);
      const r   = await api.pedersenHash({ inputs: [fieldToBytes(BigInt(secret))], hashIndex: 0 });
      const c   = '0x' + Array.from(r.hash as Uint8Array).map((b: number) => b.toString(16).padStart(2, '0')).join('');
      await bar.destroy();
      setCommitment(c);
      setStep('prove');
    } catch(e: any) {
      setError('Failed: ' + e.message);
    } finally {
      setComputing(false);
    }
  }, [secret]);

  const handleGenerateProof = useCallback(async () => {
    setError('');
    const result = await proofHook.generate(async (onProgress) => {
      const { generateIdentityProof } = await import('@/lib/proof');
      return generateIdentityProof(secret, commitment, onProgress);
    });
    if (result) {
      setProofHex(result.proof);
      setStep('done');
    }
  }, [secret, commitment, proofHook]);

  return (
    <div className="min-h-screen bg-white px-4 py-12">
      <div className="max-w-2xl mx-auto">

        {/* Header */}
        <div className="mb-8">
          <p className="text-xs font-semibold text-green-600 uppercase tracking-widest mb-2">Developer Demo</p>
          <h1 className="text-2xl font-semibold text-gray-900">Identity Proof</h1>
          <p className="text-sm text-gray-500 mt-1 leading-relaxed">
            Prove you own a valid Civyx identity without revealing your wallet address or commitment.
          </p>
        </div>

        {/* Explainer */}
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-8 text-xs text-gray-600 leading-relaxed">
          <div className="font-semibold text-gray-900 mb-1">How it works</div>
          The identity proof shows: <code className="bg-white px-1 rounded border border-gray-200">pedersen_hash([secret]) == commitment</code>,
          where the commitment is registered on-chain. This proves you know the secret behind a valid identity —
          without revealing which wallet registered it, or the commitment itself.
        </div>

        {/* Lookup tool */}
        <div className="border border-gray-200 rounded-lg p-5 mb-6">
          <h2 className="text-sm font-semibold text-gray-900 mb-3">Look up any identity</h2>
          <div className="flex gap-2 mb-3">
            <input
              type="text"
              value={queryAddr}
              onChange={e => setQueryAddr(e.target.value)}
              placeholder="0x address..."
              className="flex-1 border border-gray-200 rounded px-3 py-1.5 text-xs font-mono focus:outline-none focus:border-green-500"
            />
            {isConnected && (
              <button onClick={() => setQueryAddr(address ?? '')}
                className="px-3 py-1.5 border border-gray-200 rounded text-xs hover:bg-gray-50 transition-colors whitespace-nowrap">
                Use mine
              </button>
            )}
          </div>
          {queryAddr.length === 42 && (
            <div className="border border-gray-100 rounded p-3 bg-gray-50">
              <InfoRow label="Registered" value={isRegistered === true ? '✅ Yes' : isRegistered === false ? '❌ No' : '...'} />
              {storedCommitment && storedCommitment !== '0x' + '0'.repeat(64) && (
                <>
                  <InfoRow label="Commitment" value={storedCommitment as string} mono />
                  <InfoRow label="Explorer" value={blockscoutAddress(CONTRACTS.IdentityRegistry)} />
                </>
              )}
              {linkedWallets && (linkedWallets as string[]).length > 0 && (
                <div className="py-2">
                  <div className="text-xs text-gray-500 mb-1">Linked wallets ({(linkedWallets as string[]).length})</div>
                  {(linkedWallets as string[]).map((w: string) => (
                    <div key={w} className="font-mono text-xs text-gray-900">{w}</div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Proof generator */}
        <div className="border-t border-gray-100 pt-6">
          <h2 className="text-sm font-semibold text-gray-900 mb-4">Generate identity proof</h2>

          {!isConnected ? (
            <div className="text-center py-8">
              <p className="text-sm text-gray-500 mb-4">Connect your wallet to generate a proof</p>
              <div className="flex justify-center"><ConnectButton /></div>
            </div>
          ) : (
            <div className="space-y-4">

              <StepCard n={1} title="Load secret" done={step !== 'setup'}>
                <div className="space-y-2">
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
                  {error && <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded p-2">{error}</div>}
                  <button onClick={handleComputeCommitment} disabled={!secret || computing}
                    className="w-full py-2 bg-gray-900 text-white text-sm font-medium rounded hover:bg-gray-800 transition-colors disabled:opacity-50">
                    {computing ? 'Computing...' : 'Compute commitment →'}
                  </button>
                </div>
              </StepCard>

              {step !== 'setup' && (
                <StepCard n={2} title="Generate proof" done={step === 'done'}>
                  <div className="mb-3 text-xs font-mono text-gray-600 break-all">
                    <span className="text-gray-400 mr-2">Commitment:</span>{commitment.slice(0,20)}...{commitment.slice(-6)}
                  </div>
                  {step === 'prove' && (
                    <>
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
                      <button onClick={handleGenerateProof} disabled={proofHook.state.status === 'running'}
                        className="w-full py-2 bg-gray-900 text-white text-sm font-medium rounded hover:bg-gray-800 transition-colors disabled:opacity-50">
                        {proofHook.state.status === 'running' ? 'Generating proof...' : 'Generate ZK proof →'}
                      </button>
                    </>
                  )}
                </StepCard>
              )}

              {step === 'done' && (
                <StepCard n={3} title="Proof ready" done>
                  <div className="space-y-2 text-xs">
                    <div className="bg-white border border-green-200 rounded p-3">
                      <div className="text-gray-500 mb-1">Identity proof (8640 bytes, UltraHonk)</div>
                      <div className="font-mono text-gray-900 break-all">
                        {proofHex.slice(0, 40)}...{proofHex.slice(-8)}
                      </div>
                    </div>
                    <div className="bg-gray-50 border border-gray-200 rounded p-3 text-gray-600 leading-relaxed">
                      <div className="font-medium text-gray-900 mb-1">Integration</div>
                      Pass this proof to <code className="bg-white px-1 rounded border border-gray-200">IdentityVerifier.verify(proof, [commitment])</code>
                      to gate any on-chain action behind a verified Civyx identity.
                    </div>
                    <button onClick={() => { setStep('setup'); setProofHex(''); setCommitment(''); }}
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
    </div>
  );
}
