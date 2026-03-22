// Civyx — ZK Proof Generation
// Runs Noir circuits in the browser using noir_js + bb.js.
//
// Key architecture (bb.js 3.0.0-nightly.20260102):
//   UltraHonkBackend(bytecode, api) — api must be passed in explicitly
//   api = AsyncApi(bar.backend)     — wraps BarretenbergWasmAsyncBackend
//   bar = Barretenberg.new(1)       — initializes WASM backend

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

// Load AsyncApi — the msgpack wrapper that gives the WASM backend named methods
async function getAsyncApi(backend: any): Promise<any> {
  // @ts-ignore — /bb-async.js is served as a static asset, not a TS module
  // @ts-ignore
  const cbind = await import(/* @vite-ignore */ '/bb-async.js');
  return new cbind.AsyncApi(backend);
}

// ── Core proof generation helper ──────────────────────────────────────────────

async function generateProof(
  circuitPath: string,
  inputs:      Record<string, string>,
  options:     { keccak: boolean },
  onProgress:  OnProgress
): Promise<ProofResult> {
  onProgress({ step: 'loading', pct: 5, label: 'Preparing...' });

  console.log('[proof] Loading circuit and libraries...');
  const [{ Noir }, { Barretenberg, UltraHonkBackend }, circuit] = await Promise.all([
    import('@noir-lang/noir_js'),
    import('@aztec/bb.js'),
    loadCircuit(circuitPath),
  ]);
  console.log('[proof] Circuit loaded, bytecode length:', circuit.bytecode?.length);

  onProgress({ step: 'loading', pct: 20, label: 'Preparing...' });

  console.log('[proof] Initializing Barretenberg WASM...');
  const bar = await (Barretenberg as any).new(1);
  console.log('[proof] WASM backend type:', (bar as any).backend?.constructor?.name);

  const api = await getAsyncApi((bar as any).backend);
  console.log('[proof] AsyncApi ready');

  onProgress({ step: 'preparing', pct: 35, label: 'Preparing...' });

  const backend = new UltraHonkBackend(circuit.bytecode, api);
  const noir    = new Noir(circuit);

  // noir.init() is required in beta.18 before execute()
  console.log('[proof] Initializing Noir...');
  await noir.init();

  console.log('[proof] Executing circuit with inputs:', Object.fromEntries(
    Object.entries(inputs).map(([k, v]) => [k, v.slice(0, 10) + '...'])
  ));
  onProgress({ step: 'proving', pct: 50, label: 'Generating proof...' });

  const { witness } = await noir.execute(inputs);
  console.log('[proof] Witness generated, length:', witness?.length ?? witness?.byteLength);

  onProgress({ step: 'proving', pct: 75, label: 'Generating proof...' });

  console.log('[proof] Generating UltraHonk proof...');
  // Use keccak:true for EVM-compatible proofs (equivalent to -t evm in bb CLI)
  const result = await backend.generateProof(witness, { keccak: true });
  console.log('[proof] Proof generated! proof.length:', result.proof?.length);
  console.log('[proof] publicInputs count:', result.publicInputs?.length);
  console.log('[proof] publicInputs:', result.publicInputs);

  onProgress({ step: 'done', pct: 100, label: 'Done' });

  // proof is Uint8Array → hex
  const proofHex = ('0x' + Array.from(result.proof as Uint8Array)
    .map((b: number) => b.toString(16).padStart(2, '0'))
    .join('')) as `0x${string}`;

  // publicInputs are already hex strings from bb.js (3 items for wallet_link)
  return {
    proof:        proofHex,
    publicInputs: result.publicInputs as string[],
  };
}

// ── Wallet Link Proof ─────────────────────────────────────────────────────────

/**
 * Proves: pedersen_hash([secret]) == commitment
 *         pedersen_hash([secret, wallet_address]) == nullifier
 */
export async function generateWalletLinkProof(
  secret:        string,
  commitment:    string,
  nullifier:     string,
  walletAddress: string,
  onProgress:    OnProgress
): Promise<ProofResult> {
  const inputs = {
    secret:         toField(secret),
    commitment:     toField(commitment),
    nullifier:      toField(nullifier),
    wallet_address: (BigInt(walletAddress) % BN254_MOD).toString(),
  };
  return generateProof('/wallet_link.json', inputs, { keccak: true }, onProgress);
}

// ── Nullifier Proof ───────────────────────────────────────────────────────────

/**
 * Proves: pedersen_hash([secret]) == commitment
 *         pedersen_hash([secret, action_id]) == nullifier
 */
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
  return generateProof('/nullifier.json', inputs, { keccak: true }, onProgress);
}

// ── Identity Proof ────────────────────────────────────────────────────────────

/**
 * Proves: pedersen_hash([secret]) == commitment
 */
export async function generateIdentityProof(
  secret:      string,
  commitment:  string,
  onProgress:  OnProgress
): Promise<ProofResult> {
  const inputs = {
    secret:     toField(secret),
    commitment: toField(commitment),
  };
  return generateProof('/identity.json', inputs, { keccak: true }, onProgress);
}
