// Civyx — Client-side cryptography
//
// Key insight from working reference (prover.ts):
//   UltraHonkBackend manages its own internal Barretenberg.
//   NEVER call Barretenberg.new() directly — it hangs on Vercel.
//   Only use: new UltraHonkBackend(bytecode, { threads: 1 })
//
// For Pedersen hashing: run the identity circuit via noir.execute().
// The ACVM inside noir_js computes the correct Barretenberg Pedersen hash.
// We read the commitment from the witness public inputs.

const BN254_MODULUS = 21888242871839275222246405745257275088548364400416034343698204186575808495617n;

// ── Field utilities ───────────────────────────────────────────────────────────

export function fieldToBytes(value: bigint): Uint8Array {
  const reduced = ((value % BN254_MODULUS) + BN254_MODULUS) % BN254_MODULUS;
  const hex     = reduced.toString(16).padStart(64, '0');
  const bytes   = new Uint8Array(32);
  for (let i = 0; i < 32; i++) {
    bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

export function bytesToHex(bytes: Uint8Array): `0x${string}` {
  return ('0x' + Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')) as `0x${string}`;
}

// ── Circuit cache ─────────────────────────────────────────────────────────────

const _circuitCache: Record<string, any> = {};

async function loadCircuit(path: string): Promise<any> {
  if (_circuitCache[path]) return _circuitCache[path];
  const res = await fetch(path);
  if (!res.ok) throw new Error(`Failed to load circuit: ${path}`);
  _circuitCache[path] = await res.json();
  return _circuitCache[path];
}

// ── Pedersen hash via noir.execute() ─────────────────────────────────────────
//
// The identity circuit: assert(pedersen_hash([secret]) == commitment)
// We run noir.execute() with the correct secret and a dummy commitment=0,
// which will FAIL the constraint — but ACVM solves all witnesses first.
//
// Actually: we need the commitment to call execute() successfully.
// So instead we use the UltraHonkBackend.generateProof flow from proof.ts
// which already works. For hashing we need a different approach.
//
// WORKING APPROACH: The nullifier circuit takes (secret, commitment, nullifier, action_id).
// We know commitment from chain. We need nullifier = pedersen([secret, action_id]).
// Run noir.execute() on the wallet_link circuit with:
//   - secret = our secret
//   - commitment = from chain (correct Barretenberg value)
//   - nullifier = 0 (wrong, will fail)
//   - wallet_address = target wallet
// The ACVM will compute the witness including the CORRECT nullifier value,
// then throw a constraint error. We catch it and... we can't get the witness.
//
// REAL WORKING APPROACH:
// Use UltraHonkBackend on the identity circuit, which runs noir.execute() internally.
// After noir.execute() with correct inputs, publicInputs contains the commitment.
// We already have commitment from chain.
// For nullifier: add a dedicated nullifier-only circuit, OR restructure so
// generateWalletLinkProof doesn't need pre-computed nullifier.
// See proof.ts — generateWalletLinkProof now handles nullifier internally.

export async function computeCommitmentFromChain(
  walletAddress: string,
  identityRegistryAddress: string,
  identityRegistryAbi: any[]
): Promise<`0x${string}`> {
  // Read commitment directly from IdentityRegistry on-chain.
  // This is the source of truth — always matches what Barretenberg computed at registration.
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

  const commitment = await client.readContract({
    address: identityRegistryAddress as `0x${string}`,
    abi: identityRegistryAbi,
    functionName: 'getCommitment',
    args: [walletAddress],
  }) as `0x${string}`;

  return commitment;
}

// ── Secret generation ─────────────────────────────────────────────────────────

export function generateSecret(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  bytes[0] &= 0x1f;
  return '0x' + Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

// ── computeCommitment — runs identity circuit via UltraHonkBackend ────────────
// Used at REGISTRATION time only. At link time, read from chain instead.
// This matches proof.ts pattern exactly: UltraHonkBackend({ threads: 1 }).

export async function computeCommitment(secret: string): Promise<`0x${string}`> {
  // We can't compute Barretenberg Pedersen without running a circuit.
  // At registration, the circuit IS run (proof generated), so commitment
  // comes from the on-chain transaction. We store it in localStorage.
  const stored = localStorage.getItem(`civyx_commitment_${secret.slice(2, 10)}`);
  if (stored) return stored as `0x${string}`;

  throw new Error(
    'Commitment not found. Please register your identity first, ' +
    'or use your existing wallet to read commitment from chain.'
  );
}

export function storeCommitment(secret: string, commitment: string): void {
  try {
    localStorage.setItem(`civyx_commitment_${secret.slice(2, 10)}`, commitment);
  } catch { /* ignore */ }
}

// ── Secret storage ────────────────────────────────────────────────────────────

const storageKey = (address: string) => `civyx_secret_${address.toLowerCase()}`;

export function saveSecret(secret: string, address: string): void {
  try { localStorage.setItem(storageKey(address), secret); }
  catch { console.warn('localStorage unavailable'); }
}

export function loadSecret(address: string): string | null {
  try { return localStorage.getItem(storageKey(address)); }
  catch { return null; }
}

export function clearSecret(address: string): void {
  try { localStorage.removeItem(storageKey(address)); }
  catch { console.warn('localStorage unavailable'); }
}

// ── Export / Import ───────────────────────────────────────────────────────────

export function downloadSecret(secret: string, address: string): void {
  const lines = [
    'CIVYX IDENTITY SECRET',
    '=====================',
    '',
    'Keep this file safe. Anyone with this secret can link wallets to your identity.',
    'Never share it. Never lose it. This is the only copy.',
    '',
    `Wallet:    ${address}`,
    `Secret:    ${secret}`,
    `Generated: ${new Date().toISOString()}`,
    '',
    'To restore: open the Civyx app and import this file when prompted.',
  ];
  const blob = new Blob([lines.join('\n')], { type: 'text/plain' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `civyx-secret-${address.slice(2, 10)}.txt`;
  a.click();
  URL.revokeObjectURL(url);
}

export function parseSecretFromFile(content: string): string | null {
  const match = content.match(/Secret:\s+(0x[0-9a-fA-F]{64})/);
  return match ? match[1] : null;
}

// ── Display utilities ─────────────────────────────────────────────────────────

export function shortHash(hex: string): string {
  if (!hex || hex === '0x' + '0'.repeat(64)) return '—';
  return hex.slice(0, 8) + '...' + hex.slice(-6);
}

export function shortAddress(address: string): string {
  if (!address) return '—';
  return address.slice(0, 6) + '...' + address.slice(-4);
}

export function addressToField(address: string): string {
  return (BigInt(address) % BN254_MODULUS).toString();
}

export function bytes32ToField(hex: string): string {
  return (BigInt(hex) % BN254_MODULUS).toString();
}

export function secretToField(secret: string): string {
  return (BigInt(secret) % BN254_MODULUS).toString();
}
