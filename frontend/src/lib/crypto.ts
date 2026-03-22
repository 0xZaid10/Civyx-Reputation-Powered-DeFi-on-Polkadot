// Civyx — Client-side cryptography 

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

// ── Pedersen hash (FIXED — no AsyncApi) ───────────────────────────────────────

export async function pedersenHash(inputs: bigint[]): Promise<`0x${string}`> {
  console.log('[pedersen] 1 — starting import @aztec/bb.js');

  // Check SharedArrayBuffer availability (required for WASM threading)
  const sabAvailable = typeof SharedArrayBuffer !== 'undefined';
  console.log('[pedersen] 2 — SharedArrayBuffer available:', sabAvailable);
  if (!sabAvailable) {
    console.error('[pedersen] SharedArrayBuffer is NOT available. COOP/COEP headers may be missing.');
  }

  const { Barretenberg } = await import('@aztec/bb.js');
  console.log('[pedersen] 3 — bb.js imported, calling Barretenberg.new(1)...');

  // Race against a timeout so we can detect a hang vs a real error
  const barPromise = Barretenberg.new(1);
  const timeoutPromise = new Promise((_, reject) =>
    setTimeout(() => reject(new Error('[pedersen] TIMEOUT: Barretenberg.new(1) took >15s — likely WASM or SharedArrayBuffer failure')), 15000)
  );

  const bar = await Promise.race([barPromise, timeoutPromise]) as any;
  console.log('[pedersen] 4 — Barretenberg ready, calling pedersenHash...');

  try {
    const result = await bar.pedersenHash({
      inputs: inputs.map(fieldToBytes),
      hashIndex: 0,
    });
    console.log('[pedersen] 5 — hash computed:', result?.hash ? 'OK' : 'NO HASH');
    return bytesToHex(result.hash);
  } finally {
    await bar.destroy();
    console.log('[pedersen] 6 — bar destroyed');
  }
}

// ── Secret generation ─────────────────────────────────────────────────────────

export function generateSecret(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);

  // Ensure it's a valid field element
  bytes[0] &= 0x1f;

  return '0x' + Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

// ── Commitment ────────────────────────────────────────────────────────────────

export async function computeCommitment(secret: string): Promise<`0x${string}`> {
  const secretField =
    ((BigInt(secret) % BN254_MODULUS) + BN254_MODULUS) % BN254_MODULUS;

  return pedersenHash([secretField]);
}

// ── Secret storage ────────────────────────────────────────────────────────────

const storageKey = (address: string) =>
  `civyx_secret_${address.toLowerCase()}`;

export function saveSecret(secret: string, address: string): void {
  try {
    localStorage.setItem(storageKey(address), secret);
  } catch {
    console.warn('localStorage unavailable');
  }
}

export function loadSecret(address: string): string | null {
  try {
    return localStorage.getItem(storageKey(address));
  } catch {
    return null;
  }
}

export function clearSecret(address: string): void {
  try {
    localStorage.removeItem(storageKey(address));
  } catch {
    console.warn('localStorage unavailable');
  }
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

  const a = document.createElement('a');
  a.href = url;
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
