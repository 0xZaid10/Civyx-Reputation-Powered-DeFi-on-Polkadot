// Shim for msgpackr — used by @aztec/bb.js/dest/browser/cbind/generated/async.js
// We provide compatible classes using native TextEncoder/TextDecoder + JSON.

export class Encoder {
  encode(value: unknown): Uint8Array {
    const json = JSON.stringify(value);
    return new TextEncoder().encode(json);
  }
  encodeMultiple(values: unknown[]): Uint8Array {
    return this.encode(values);
  }
}

export class Decoder {
  decode(buffer: Uint8Array): unknown {
    return JSON.parse(new TextDecoder().decode(buffer));
  }
  decodeMultiple(buffer: Uint8Array): unknown[] {
    const result = this.decode(buffer);
    return Array.isArray(result) ? result : [result];
  }
}

export class Packr extends Encoder {}
export class Unpackr extends Decoder {}

export function pack(value: unknown): Uint8Array {
  return new Encoder().encode(value);
}

export function unpack(buffer: Uint8Array): unknown {
  return new Decoder().decode(buffer);
}

export default { pack, unpack, Encoder, Decoder, Packr, Unpackr };
