// Civyx — ZK Proof Generation
//
// bb.js 3.0.0-nightly.20260102 API (confirmed from source):
//
// UltraHonkBackend(bytecode, api) — api must be a Barretenberg instance.
// Passing { threads: 1 } causes "this.api.circuitProve is not a function".
//
// Barretenberg.new() in browser uses BackendType.WasmWorker + initSRSChonk().
// WasmWorker creates a Worker thread which hangs on Vercel.
//
// FIX: Use BackendType.Wasm (no worker, single-threaded) and create Barretenberg
// manually via createAsyncBackend + initSRSChonk.

import { Noir } from '@noir-lang/noir_js';
import { UltraHonkBackend } from '@aztec/bb.js';

export type ProofStep = 'idle' | 'loading' | 'preparing' | 'proving' | 'done' | 'error';

export interface ProofProgress {
  step:  ProofStep;
  pct:   number;
  label: string;
}

export interface ProofResult {
  proof:        `0x${string}`;
  publicInputs: string[];
}

export type OnProgress = (p: ProofProgress) => void;

const BN254_MOD = 21888242871839275222246405745257275088548364400416034343698204186575808495617n;

function toField(value: string): string {
  return (BigInt(value) % BN254_MOD).toString();
}

async function loadCircuit(path: string): Promise<any> {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`Failed to load circuit: ${path} (${res.status})`);
  return res.json();
}

// ── Core proof generation ─────────────────────────────────────────────────────
// Runs inside a Web Worker via runInWorker() to avoid Atomics.wait restriction
// on the main thread. BackendType.WasmWorker is the correct browser backend.

async function generateProof(
  circuitPath: string,
  inputs:      Record<string, string>,
  onProgress:  OnProgress
): Promise<ProofResult> {
  onProgress({ step: 'loading', pct: 10, label: 'Loading circuit...' });
  const circuit = await loadCircuit(circuitPath);

  onProgress({ step: 'loading', pct: 20, label: 'Initialising Noir...' });
  const noir = new Noir(circuit);
  await noir.init();

  onProgress({ step: 'proving', pct: 35, label: 'Generating witness...' });
  console.log('[proof] Executing circuit...');
  const { witness } = await noir.execute(inputs);
  console.log('[proof] Witness generated');

  onProgress({ step: 'proving', pct: 50, label: 'Initialising prover...' });
  console.log('[bb] Creating Barretenberg (WasmWorker)...');

  // Use WasmWorker — runs WASM in a dedicated worker thread, avoiding
  // the Atomics.wait restriction on the main thread.
  const { Barretenberg, BackendType } = await import('@aztec/bb.js');
  const bb = await Barretenberg.new({ backend: BackendType.WasmWorker });
  console.log('[bb] Barretenberg ready');

  const backend = new UltraHonkBackend(circuit.bytecode, bb);

  onProgress({ step: 'proving', pct: 65, label: 'Generating proof...' });
  console.log('[proof] Generating proof...');
  const result = await backend.generateProof(witness, { keccakZK: true });
  console.log('[proof] Proof done. publicInputs:', result.publicInputs);

  await bb.destroy();

  onProgress({ step: 'done', pct: 100, label: 'Done' });

  const proofHex = ('0x' + Array.from(result.proof as Uint8Array)
    .map((b: number) => b.toString(16).padStart(2, '0'))
    .join('')) as `0x${string}`;

  return { proof: proofHex, publicInputs: result.publicInputs as string[] };
}

// ── Wallet Link Proof ─────────────────────────────────────────────────────────

export async function generateWalletLinkProof(
  secret:        string,
  commitment:    string,
  nullifier:     string,
  walletAddress: string,
  onProgress:    OnProgress
): Promise<ProofResult> {
  const inputs = {
    secret:         (BigInt(secret)        % BN254_MOD).toString(),
    commitment:     (BigInt(commitment)    % BN254_MOD).toString(),
    nullifier:      (BigInt(nullifier)     % BN254_MOD).toString(),
    wallet_address: (BigInt(walletAddress) % BN254_MOD).toString(),
  };
  return generateProof('/wallet_link.json', inputs, onProgress);
}

// ── Nullifier Proof ───────────────────────────────────────────────────────────

export async function generateNullifierProof(
  secret:      string,
  commitment:  string,
  nullifier:   string,
  actionId:    string,
  onProgress:  OnProgress
): Promise<ProofResult> {
  const inputs = {
    secret:     toField(secret),
    commitment: toField(commitment),
    nullifier:  toField(nullifier),
    action_id:  toField(actionId),
  };
  return generateProof('/nullifier.json', inputs, onProgress);
}

// ── Identity Proof ────────────────────────────────────────────────────────────

export async function generateIdentityProof(
  secret:      string,
  commitment:  string,
  onProgress:  OnProgress
): Promise<ProofResult> {
  const inputs = {
    secret:     toField(secret),
    commitment: toField(commitment),
  };
  return generateProof('/identity.json', inputs, onProgress);
}
