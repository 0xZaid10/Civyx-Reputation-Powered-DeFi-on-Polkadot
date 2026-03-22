import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useProof } from '@/hooks/useProof';
import { generateWalletLinkProof } from '@/lib/proof';
import { loadSecret, parseSecretFromFile, shortHash } from '@/lib/crypto';
import { CONTRACTS, IDENTITY_REGISTRY_ABI, blockscoutTx } from '@/lib/contracts';
import { TX_OPTIONS } from '@/lib/txOptions';

// ── Commitment + Nullifier ───────────────────────────────────────────────────
// Commitment: read from chain (always correct, matches original Barretenberg value).
// Nullifier:  computed via hash_oracle2 circuit — pedersen([secret, wallet_address]).

async function fetchCommitmentFromChain(walletAddress: string): Promise<string> {
  const { createPublicClient, http } = await import('viem');
  const client = createPublicClient({
    chain: {
      id: 420420417,
      name: 'Polkadot Asset Hub Testnet',
      nativeCurrency: { name: 'PAS', symbol: 'PAS', decimals: 18 },
      rpcUrls: { default: { http: ['https://eth-rpc-testnet.polkadot.io'] } },
    } as any,
    transport: http('https://eth-rpc-testnet.polkadot.io'),
  });
  return client.readContract({
    address: CONTRACTS.IdentityRegistry as `0x${string}`,
    abi:     IDENTITY_REGISTRY_ABI,
    functionName: 'getCommitment',
    args:    [walletAddress],
  }) as Promise<string>;
}

async function computeNullifierViaCircuit(secret: string, walletAddress: string): Promise<string> {
  const { pedersenHash2 } = await import('@/lib/crypto');
  const BN254_MOD = 21888242871839275222246405745257275088548364400416034343698204186575808495617n;
  const secretField = (BigInt(secret)      % BN254_MOD + BN254_MOD) % BN254_MOD;
  const walletField = (BigInt(walletAddress) % BN254_MOD + BN254_MOD) % BN254_MOD;
  return pedersenHash2(secretField, walletField);
}
// ── Progress Bar ──────────────────────────────────────────────────────────────

function ProofProgressBar({ pct, label }: { pct: number; label: string }) {
  return (
    <div className="space-y-2">
      <div className="flex justify-between text-xs text-gray-500">
        <span>{label}</span>
        <span className="font-mono">{pct}%</span>
      </div>
      <div className="w-full bg-gray-100 rounded-full h-1.5">
        <div className="bg-green-600 h-1.5 rounded-full transition-all duration-300"
          style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function LinkWallet() {
  const { address, isConnected } = useAccount();
  const navigate  = useNavigate();
  const proofHook = useProof();

  // Secret state
  const [secret,       setSecret]       = useState<string>('');
  const [secretSource, setSecretSource] = useState<'manual' | 'file'>('manual');

  // Derived commitment from secret (not from chain)
  const [commitment,   setCommitment]   = useState<string>('');
  const [computing,    setComputing]    = useState(false);

  const [error,     setError]     = useState('');
  const [nullifier, setNullifier] = useState('');
  const [proofHex,  setProofHex]  = useState('');
  const [step,      setStep]      = useState<'secret' | 'prove' | 'submit' | 'done'>('secret');

  const { writeContract, data: txHash, isPending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash: txHash });

  if (isSuccess && step === 'submit') setStep('done');

  // Handle file upload
  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const content = ev.target?.result as string;
      const parsed  = parseSecretFromFile(content);
      if (parsed) {
        setSecret(parsed);
        setSecretSource('file');
        setError('');
      } else {
        setError('Could not find secret in file.');
      }
    };
    reader.readAsText(file);
  }, []);

  // Step 1 → 2: read commitment from chain (correct Barretenberg value)
  const handleContinue = useCallback(async () => {
    setError('');
    if (!secret.startsWith('0x') || secret.length !== 66) {
      setError('Secret must be 0x-prefixed 32-byte hex (66 chars).');
      return;
    }
    if (!address) {
      setError('Wallet not connected.');
      return;
    }
    setComputing(true);
    try {
      console.log('[link] Reading commitment from chain...');
      const c = await fetchCommitmentFromChain(address);
      console.log('[link] commitment from chain:', c);
      if (!c || c === '0x' + '0'.repeat(64)) {
        setError('No identity found for this wallet. Please register first.');
        return;
      }
      setCommitment(c);
      setStep('prove');
    } catch (e: any) {
      setError('Failed to read commitment: ' + e.message);
    } finally {
      setComputing(false);
    }
  }, [secret, address]);

  // Step 2: generate ZK proof
  const handleGenerateProof = useCallback(async () => {
    setError('');
    if (!address || !commitment) return;

    try {
      console.log('[link] Computing nullifier...');
      const nullifierHex = await computeNullifierViaCircuit(secret, address);
      setNullifier(nullifierHex);

      const result = await proofHook.generate((onProgress) =>
        generateWalletLinkProof(secret, commitment, nullifierHex, address, onProgress)
      );

      if (result) {
        setProofHex(result.proof);
        setStep('submit');
      }
    } catch (e: any) {
      setError(e.message ?? 'Proof generation failed');
    }
  }, [secret, address, commitment, proofHook]);

  // Step 3: submit on-chain
  const handleSubmit = useCallback(() => {
    setError('');
    writeContract({
      address:      CONTRACTS.IdentityRegistry,
      abi:          IDENTITY_REGISTRY_ABI,
      functionName: 'linkWallet',
      ...TX_OPTIONS,
      args: [
        commitment as `0x${string}`,
        proofHex   as `0x${string}`,
        nullifier  as `0x${string}`,
      ],
    });
  }, [commitment, proofHex, nullifier, writeContract]);

  if (!isConnected) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="max-w-sm w-full text-center">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Connect New Wallet</h2>
          <p className="text-sm text-gray-500 mb-6">
            Connect the wallet you want to add to your identity.
          </p>
          <div className="flex justify-center"><ConnectButton /></div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white px-4 py-12">
      <div className="max-w-lg mx-auto">

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-gray-900">Link Wallet</h1>
          <p className="text-sm text-gray-500 mt-1">
            Link this wallet to an existing Civyx identity using a zero-knowledge proof.
          </p>
        </div>

        {/* How it works */}
        <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 mb-6 text-xs text-blue-700 leading-relaxed">
          <div className="font-semibold mb-1">How wallet linking works</div>
          You are currently connected as <span className="font-mono">{address?.slice(0,8)}...</span> — this is the wallet being linked.
          Load the <strong>secret file</strong> from your existing identity (created during registration).
          The ZK proof will bind this wallet to that identity without revealing the secret.
        </div>

        {/* Current wallet */}
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-6">
          <div className="text-xs text-gray-500 mb-1">Wallet being linked</div>
          <div className="font-mono text-xs text-gray-900">{address}</div>
          <div className="text-xs text-gray-400 mt-1">
            Switch wallets in MetaMask to link a different one.
          </div>
        </div>

        {/* Step 1 — Load Secret */}
        {step === 'secret' && (
          <div className="border border-gray-200 rounded-lg p-6">
            <h2 className="text-base font-semibold text-gray-900 mb-1">Load identity secret</h2>
            <p className="text-sm text-gray-500 mb-5 leading-relaxed">
              Upload the secret file from your existing identity.
              The commitment will be derived from it automatically.
            </p>

            <div className="space-y-4 mb-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1.5">
                  Upload secret file
                </label>
                <input
                  type="file"
                  accept=".txt"
                  onChange={handleFileUpload}
                  className="block w-full text-xs text-gray-500 file:mr-3 file:py-1.5 file:px-3 file:rounded file:border file:border-gray-200 file:text-xs file:font-medium file:bg-white hover:file:bg-gray-50 cursor-pointer"
                />
              </div>
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-200" />
                </div>
                <div className="relative flex justify-center">
                  <span className="bg-white px-2 text-xs text-gray-400">or paste manually</span>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1.5">
                  Secret (0x...)
                </label>
                <input
                  type="text"
                  value={secret}
                  onChange={e => { setSecret(e.target.value); setSecretSource('manual'); }}
                  placeholder="0x0000...0000"
                  className="w-full border border-gray-200 rounded px-3 py-2 text-xs font-mono focus:outline-none focus:border-green-500"
                />
              </div>
            </div>

            {secretSource === 'file' && secret && (
              <div className="border border-green-200 bg-green-50 rounded p-3 mb-4">
                <div className="text-xs text-green-700 font-medium">✓ Secret loaded from file</div>
                <div className="text-xs font-mono text-green-600 mt-1">
                  {secret.slice(0, 12)}...{secret.slice(-6)}
                </div>
              </div>
            )}

            {error && (
              <div className="border border-red-200 bg-red-50 rounded p-3 mb-4 text-xs text-red-600">
                {error}
              </div>
            )}

            <button
              onClick={handleContinue}
              disabled={!secret || computing}
              className="w-full py-2.5 bg-gray-900 text-white text-sm font-medium rounded hover:bg-gray-800 transition-colors disabled:opacity-50"
            >
              {computing ? 'Computing commitment...' : 'Continue →'}
            </button>
          </div>
        )}

        {/* Step 2 — Generate Proof */}
        {step === 'prove' && (
          <div className="border border-gray-200 rounded-lg p-6">
            <h2 className="text-base font-semibold text-gray-900 mb-1">Generate proof</h2>
            <p className="text-sm text-gray-500 mb-5 leading-relaxed">
              Generating a ZK proof in your browser. Takes 10–30 seconds.
              Your secret is never revealed.
            </p>

            <div className="bg-gray-50 border border-gray-200 rounded p-4 mb-5 space-y-1">
              <div className="text-xs text-gray-500">Commitment (derived from secret)</div>
              <div className="font-mono text-xs text-gray-900 break-all">{shortHash(commitment)}</div>
              <div className="text-xs text-gray-500 mt-2">Wallet being linked</div>
              <div className="font-mono text-xs text-gray-900">{address}</div>
            </div>

            {proofHook.state.status === 'running' && (
              <div className="mb-5">
                <ProofProgressBar
                  pct={proofHook.state.progress.pct}
                  label={proofHook.state.progress.label}
                />
              </div>
            )}

            {(error || proofHook.state.error) && (
              <div className="border border-red-200 bg-red-50 rounded p-3 mb-4 text-xs text-red-600">
                {error || proofHook.state.error}
              </div>
            )}

            <button
              onClick={handleGenerateProof}
              disabled={proofHook.state.status === 'running'}
              className="w-full py-2.5 bg-gray-900 text-white text-sm font-medium rounded hover:bg-gray-800 transition-colors disabled:opacity-50"
            >
              {proofHook.state.status === 'running' ? 'Generating proof...' : 'Generate Proof'}
            </button>
          </div>
        )}

        {/* Step 3 — Submit */}
        {step === 'submit' && !isSuccess && (
          <div className="border border-gray-200 rounded-lg p-6">
            <h2 className="text-base font-semibold text-gray-900 mb-1">Submit on-chain</h2>
            <p className="text-sm text-gray-500 mb-5">
              Proof generated. Submit to link this wallet on-chain.
            </p>
            <div className="space-y-2 mb-5">
              <div className="bg-gray-50 border border-gray-200 rounded p-3">
                <div className="text-xs text-gray-500 mb-1">Proof</div>
                <div className="font-mono text-xs text-gray-900 break-all">
                  {proofHex.slice(0, 32)}...{proofHex.slice(-8)}
                </div>
              </div>
              <div className="bg-gray-50 border border-gray-200 rounded p-3">
                <div className="text-xs text-gray-500 mb-1">Nullifier</div>
                <div className="font-mono text-xs text-gray-900 break-all">
                  {shortHash(nullifier)}
                </div>
              </div>
            </div>
            {error && (
              <div className="border border-red-200 bg-red-50 rounded p-3 mb-4 text-xs text-red-600">
                {error}
              </div>
            )}
            <button
              onClick={handleSubmit}
              disabled={isPending || isConfirming}
              className="w-full py-2.5 bg-green-600 text-white text-sm font-medium rounded hover:bg-green-700 transition-colors disabled:opacity-50"
            >
              {isPending ? 'Confirm in wallet...' : isConfirming ? 'Confirming...' : 'Link Wallet'}
            </button>
            {txHash && (
              <a href={blockscoutTx(txHash)} target="_blank" rel="noopener noreferrer"
                className="block text-center text-xs text-green-600 hover:underline mt-3 font-mono">
                {txHash.slice(0, 16)}... ↗
              </a>
            )}
          </div>
        )}

        {/* Done */}
        {step === 'done' && (
          <div className="border border-green-200 bg-green-50 rounded-lg p-8 text-center">
            <div className="w-12 h-12 bg-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-white text-xl">✓</span>
            </div>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">Wallet Linked</h2>
            <p className="text-sm text-gray-600 mb-2">
              This wallet is now linked to your Civyx identity.
            </p>
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
