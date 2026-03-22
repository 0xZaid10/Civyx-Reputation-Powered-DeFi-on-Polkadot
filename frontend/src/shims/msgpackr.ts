// bb.js's browser bundle imports msgpackr for internal serialization.
// This shim provides the minimal surface area it needs.

export function pack(data: unknown): Uint8Array {
  const json = JSON.stringify(data);
  return new TextEncoder().encode(json);
}

export function unpack(data: Uint8Array): unknown {
  return JSON.parse(new TextDecoder().decode(data));
}

export function packr(data: unknown): Uint8Array {
  return pack(data);
}

export class Packr {
  pack(data: unknown): Uint8Array { return pack(data); }
  unpack(data: Uint8Array): unknown { return unpack(data); }
}

export class Unpackr {
  unpack(data: Uint8Array): unknown { return unpack(data); }
}

export default { pack, unpack, Packr, Unpackr };
