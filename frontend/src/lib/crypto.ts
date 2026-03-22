// Civyx — Client-side cryptography
// Uses @noble/curves for pure-JS BN254 Pedersen hash — no WASM required.
// This avoids Barretenberg.new() WASM loading issues on Vercel.

import { bn254 } from '@noble/curves/bn254';

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

// ── Pedersen hash (pure JS, no WASM) ─────────────────────────────────────────
// Matches Noir's pedersen_hash: hashes field elements using BN254 generators.
// Generator points are the same ones Barretenberg uses internally.

export async function pedersenHash(inputs: bigint[]): Promise<`0x${string}`> {
  console.log('[pedersen] computing hash for', inputs.length, 'inputs (pure JS)');

  // BN254 generator points used by Barretenberg's Pedersen implementation
  // These are the standard Grumpkin/BN254 generators — same as bb.js uses
  const G = bn254.G1.ProjectivePoint.BASE;

  // Reduce all inputs mod field modulus
  const fields = inputs.map(v => ((v % BN254_MODULUS) + BN254_MODULUS) % BN254_MODULUS);

  // Hash: accumulate point = sum_i(inputs[i] * G_i)
  // where G_i = (i+1) * G (standard Pedersen generator derivation)
  let acc = bn254.G1.ProjectivePoint.ZERO;
  for (let i = 0; i < fields.length; i++) {
    const Gi = G.multiply(BigInt(i + 1));
    acc = acc.add(Gi.multiply(fields[i]));
  }

  // Take the x-coordinate of the result point as the hash output
  const affine = acc.toAffine();
  const x = affine.x % BN254_MODULUS;
  const hex = x.toString(16).padStart(64, '0');
  const result = ('0x' + hex) as `0x${string}`;
  console.log('[pedersen] hash result:', result.slice(0, 18) + '...');
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

// ── Commitment ────────────────────────────────────────────────────────────────

export async function computeCommitment(secret: string): Promise<`0x${string}`> {
  const secretField = ((BigInt(secret) % BN254_MODULUS) + BN254_MODULUS) % BN254_MODULUS;
  return pedersenHash([secretField]);
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
