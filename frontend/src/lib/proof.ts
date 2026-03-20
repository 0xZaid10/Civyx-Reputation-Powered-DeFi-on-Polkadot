// Civyx — ZK Proof Generation 

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

  onProgress({ step: 'loading', pct: 20, label: 'Preparing...' });

  console.log('[proof] Initializing Barretenberg WASM...');
  const bar = await Barretenberg.new(1);

  onProgress({ step: 'preparing', pct: 35, label: 'Preparing...' });

  // ✅ FIX: pass bar directly (NO AsyncApi, NO internal imports)
  const backend = new UltraHonkBackend(circuit.bytecode, bar);
  const noir    = new Noir(circuit);

  console.log('[proof] Initializing Noir...');
  await noir.init();

  console.log('[proof] Executing circuit...');
  onProgress({ step: 'proving', pct: 50, label: 'Generating proof...' });

  const { witness } = await noir.execute(inputs);

  onProgress({ step: 'proving', pct: 75, label: 'Generating proof...' });

  console.log('[proof] Generating proof...');
  const result = await backend.generateProof(witness, { keccak: true });

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
