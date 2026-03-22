// Civyx — Client-side cryptography
//
// Pedersen hashing uses hash_oracle.json — a tiny Noir circuit:
//   fn main(secret: Field) -> pub Field { pedersen_hash([secret]) }
//
// noir.execute({ secret }) returns { returnValue } which IS the hash.
// No Barretenberg.new(). No workers. No hangs. Works on Vercel.

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

// ── Pedersen hash via hash_oracle circuit ─────────────────────────────────────
// hash_oracle.json: fn main(secret: Field) -> pub Field { pedersen_hash([secret]) }
// noir.execute() runs the ACVM internally — same Barretenberg Pedersen as on-chain.
// returnValue is the field element output of the circuit.

let _hashCircuit: any = null;

async function getHashCircuit(): Promise<any> {
  if (_hashCircuit) return _hashCircuit;
  const res = await fetch('/hash_oracle.json');
  if (!res.ok) throw new Error('Failed to load hash_oracle.json');
  _hashCircuit = await res.json();
  return _hashCircuit;
}

export async function pedersenHash(inputs: bigint[]): Promise<`0x${string}`> {
  if (inputs.length !== 1) {
    throw new Error(`hash_oracle circuit takes exactly 1 input, got ${inputs.length}. Use pedersenHash2 for 2 inputs.`);
  }

  const { Noir } = await import('@noir-lang/noir_js');
  const circuit  = await getHashCircuit();
  const noir     = new Noir(circuit);
  await noir.init();

  const secretField = ((inputs[0] % BN254_MODULUS) + BN254_MODULUS) % BN254_MODULUS;

  const { returnValue } = await noir.execute({
    secret: secretField.toString(),
  });

  // returnValue is a hex string field element from the circuit
  const hex = (returnValue as string).replace('0x', '').padStart(64, '0');
  return `0x${hex}` as `0x${string}`;
}

// ── Pedersen hash for 2 inputs ───────────────────────────────────────────────
// Uses hash_oracle2.json circuit:
//   fn main(a: Field, b: Field) -> pub Field { pedersen_hash([a, b]) }
// Compile with: nargo compile in circuits/hash_oracle2/

let _hash2Circuit: any = null;

async function getHash2Circuit(): Promise<any> {
  if (_hash2Circuit) return _hash2Circuit;
  const res = await fetch('/hash_oracle2.json');
  if (!res.ok) throw new Error(
    'hash_oracle2.json not found. Compile circuits/hash_oracle2 with nargo and copy to public/.'
  );
  _hash2Circuit = await res.json();
  return _hash2Circuit;
}

export async function pedersenHash2(a: bigint, b: bigint): Promise<`0x${string}`> {
  const { Noir } = await import('@noir-lang/noir_js');
  const circuit  = await getHash2Circuit();
  const noir     = new Noir(circuit);
  await noir.init();

  const aField = ((a % BN254_MODULUS) + BN254_MODULUS) % BN254_MODULUS;
  const bField = ((b % BN254_MODULUS) + BN254_MODULUS) % BN254_MODULUS;

  const { returnValue } = await noir.execute({
    a: aField.toString(),
    b: bField.toString(),
  });

  const hex = (returnValue as string).replace('0x', '').padStart(64, '0');
  return `0x${hex}` as `0x${string}`;
}

export async function computeCommitment(secret: string): Promise<`0x${string}`> {
  console.log('[crypto] computing commitment via hash_oracle circuit...');
  const secretBig = BigInt(secret);
  const result = await pedersenHash([secretBig]);
  console.log('[crypto] commitment:', result.slice(0, 18) + '...');
  return result;
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
