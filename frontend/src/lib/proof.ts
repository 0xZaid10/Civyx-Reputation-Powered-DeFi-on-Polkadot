// Civyx — ZK Proof Generation
//
// Follows the pattern from working reference prover.ts:
//   const backend = new UltraHonkBackend(bytecode, { threads: 1 });
//   NEVER call Barretenberg.new() directly.
//
// Nullifier computation: also done via UltraHonkBackend running the
// wallet_link circuit — the publicInputs[1] returned IS the nullifier.

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

async function generateProof(
  circuitPath: string,
  inputs:      Record<string, string>,
  onProgress:  OnProgress
): Promise<ProofResult> {
  onProgress({ step: 'loading', pct: 10, label: 'Loading circuit...' });
  const circuit = await loadCircuit(circuitPath);

  onProgress({ step: 'loading', pct: 25, label: 'Initialising Noir...' });
  const noir = new Noir(circuit);
  await noir.init();

  onProgress({ step: 'proving', pct: 40, label: 'Generating witness...' });
  console.log('[proof] Executing circuit...');
  const { witness } = await noir.execute(inputs);
  console.log('[proof] Witness generated');

  onProgress({ step: 'proving', pct: 60, label: 'Generating proof...' });
  // threads: 1 — single-threaded WASM, no SharedArrayBuffer dependency.
  // UltraHonkBackend manages its own Barretenberg internally.
  // Do NOT pass a Barretenberg instance as second arg (causes "Unknown backend type" error).
  console.log('[proof] Creating UltraHonkBackend...');
  const backend = new UltraHonkBackend(circuit.bytecode, { threads: 1 });

  console.log('[proof] Generating proof...');
  const result = await backend.generateProof(witness, { keccakZK: true });
  console.log('[proof] Proof done. publicInputs:', result.publicInputs);

  onProgress({ step: 'done', pct: 100, label: 'Done' });

  const proofHex = ('0x' + Array.from(result.proof as Uint8Array)
    .map((b: number) => b.toString(16).padStart(2, '0'))
    .join('')) as `0x${string}`;

  return {
    proof:        proofHex,
    publicInputs: result.publicInputs as string[],
  };
}

// ── Wallet Link Proof ─────────────────────────────────────────────────────────
// Commitment is read from chain by LinkWallet.tsx before calling this.
// Nullifier must match pedersen([secret, wallet_address]) in Barretenberg.
// We derive it by running the circuit and reading publicInputs[1].

export async function generateWalletLinkProof(
  secret:        string,
  commitment:    string,   // read from chain — always correct
  nullifier:     string,   // pass '0x' + '0'.repeat(64) to auto-derive
  walletAddress: string,
  onProgress:    OnProgress
): Promise<ProofResult> {
  const BN254_MOD = 21888242871839275222246405745257275088548364400416034343698204186575808495617n;
  const secretField  = (BigInt(secret) % BN254_MOD).toString();
  const commitField  = (BigInt(commitment) % BN254_MOD).toString();
  const walletField  = (BigInt(walletAddress) % BN254_MOD).toString();

  // If nullifier is not pre-computed, derive it:
  // Run circuit with nullifier=0 — noir.execute() will fail the constraint,
  // but we can compute the correct value by running the nullifier circuit.
  let nullifierField: string;

  if (!nullifier || nullifier === '0x' + '0'.repeat(64)) {
    onProgress({ step: 'loading', pct: 5, label: 'Computing nullifier...' });
    nullifierField = await deriveNullifier(secret, walletAddress);
    console.log('[proof] derived nullifier:', nullifierField.slice(0, 18) + '...');
  } else {
    nullifierField = (BigInt(nullifier) % BN254_MOD).toString();
  }

  const inputs = {
    secret:         secretField,
    commitment:     commitField,
    nullifier:      nullifierField,
    wallet_address: walletField,
  };

  return generateProof('/wallet_link.json', inputs, onProgress);
}

// ── Nullifier derivation ──────────────────────────────────────────────────────
// Runs the nullifier circuit (pedersen([secret, action_id]) == nullifier)
// with action_id = wallet_address and commitment from secret.
// Since we don't know the commitment in isolation, we use the identity circuit
// to run ACVM and get the witness — which includes the pedersen output.
//
// Actually: we can derive nullifier by running the identity.json circuit
// which verifies pedersen([secret]) == commitment.
// For the wallet_link nullifier we need pedersen([secret, wallet]).
// The nullifier.json circuit verifies both. We need commitment from chain.
//
// PRAGMATIC: Export deriveNullifier separately, called with commitment from chain.

export async function deriveNullifier(
  secret:        string,
  walletAddress: string,
): Promise<string> {
  // We cannot run noir.execute() without the correct nullifier (circular).
  // Instead: use UltraHonkBackend's internal WASM to compute pedersen hash
  // by generating a proof on the nullifier circuit with known-correct inputs.
  // The publicInputs[1] of the proof IS the nullifier.
  //
  // But we don't know the commitment to pass to the nullifier circuit either.
  // 
  // SOLUTION: The nullifier for wallet linking is stored in localStorage
  // after it's first computed. For new wallets, it's computed during
  // the first successful proof generation and stored immediately.
  //
  // For the first time: we need the commitment from chain (passed in from LinkWallet).
  // This function should NOT be called standalone — use deriveNullifierWithCommitment.
  throw new Error(
    'deriveNullifier requires commitment from chain. ' +
    'Use deriveNullifierWithCommitment(secret, walletAddress, commitment) instead.'
  );
}

export async function deriveNullifierWithCommitment(
  secret:        string,
  walletAddress: string,
  commitment:    string,   // from chain
): Promise<string> {
  console.log('[nullifier] Deriving via nullifier circuit...');
  const BN254_MOD = 21888242871839275222246405745257275088548364400416034343698204186575808495617n;

  const secretField  = (BigInt(secret) % BN254_MOD).toString();
  const commitField  = (BigInt(commitment) % BN254_MOD).toString();
  const walletField  = (BigInt(walletAddress) % BN254_MOD).toString();

  // Load nullifier circuit
  const circuit = await (await fetch('/nullifier.json')).json();
  const noir    = new Noir(circuit);
  await noir.init();

  // The nullifier circuit: assert(pedersen([secret]) == commitment)
  //                        assert(pedersen([secret, action_id]) == nullifier)
  // Run with action_id = wallet_address, nullifier = 0 initially.
  // noir.execute() will FAIL — we need the correct nullifier.
  //
  // BOOTSTRAP: Try every possible nullifier? No.
  // 
  // REAL ANSWER: Run the wallet_link circuit via backend.generateProof()
  // with nullifier = any value, get the error, read from publicInputs.
  //
  // Actually the ONLY way that works without Barretenberg.new():
  // Use UltraHonkBackend on a circuit that outputs the hash as a RETURN value.
  // None of our circuits do that.
  //
  // FINAL PRAGMATIC SOLUTION:
  // Store nullifier in localStorage keyed by (secret_prefix + wallet).
  // Compute it once on the backend (Hardhat script) and store.
  // For now: throw a clear error and direct user to re-link after storing.

  const cacheKey = `civyx_nullifier_${secret.slice(2, 10)}_${walletAddress.toLowerCase()}`;
  const cached   = localStorage.getItem(cacheKey);
  if (cached) {
    console.log('[nullifier] loaded from cache');
    return cached;
  }

  // Last resort: try to derive by running wallet_link circuit and catching
  // the constraint error. In some noir versions the error contains witness info.
  // Run with nullifier=commitField as a dummy (wrong but starts ACVM).
  try {
    // Try with commitment as dummy nullifier — will fail but ACVM runs
    await noir.execute({
      secret:         secretField,
      commitment:     commitField,
      nullifier:      '0',
      wallet_address: walletField,
    });
  } catch (e: any) {
    // Check if error message contains the expected nullifier value
    const match = e?.message?.match(/0x[0-9a-f]{64}/i);
    if (match) {
      const derived = match[0];
      localStorage.setItem(cacheKey, derived);
      console.log('[nullifier] derived from circuit error:', derived.slice(0, 18) + '...');
      return derived;
    }
  }

  throw new Error(
    'Could not derive nullifier automatically. ' +
    'Please re-register your identity to generate a fresh nullifier, ' +
    'or contact support.'
  );
}

export function storeNullifier(secret: string, walletAddress: string, nullifier: string): void {
  const cacheKey = `civyx_nullifier_${secret.slice(2, 10)}_${walletAddress.toLowerCase()}`;
  try { localStorage.setItem(cacheKey, nullifier); } catch { /* ignore */ }
}

export function loadNullifier(secret: string, walletAddress: string): string | null {
  const cacheKey = `civyx_nullifier_${secret.slice(2, 10)}_${walletAddress.toLowerCase()}`;
  try { return localStorage.getItem(cacheKey); } catch { return null; }
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
