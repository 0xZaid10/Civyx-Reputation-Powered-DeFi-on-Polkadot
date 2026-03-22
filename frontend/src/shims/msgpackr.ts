// Shim for msgpackr — used by @aztec/bb.js/dest/browser/cbind/generated/async.js
// async.js uses: new Encoder({ useRecords: false }).pack(input)
// async.js uses: new Decoder({ useRecords: false }).unpack(buffer)
// backend.js uses: new Encoder({ useRecords: false }).encode(data)
// backend.js uses: new Decoder({ useRecords: false }).decode(data)

export class Encoder {
  constructor(_options?: any) {}

  // Used by async.js (cbind layer)
  pack(value: unknown): Uint8Array {
    const json = JSON.stringify(value);
    return new TextEncoder().encode(json);
  }

  // Used by backend.js (AztecClientBackend)
  encode(value: unknown): Uint8Array {
    return this.pack(value);
  }

  encodeMultiple(values: unknown[]): Uint8Array {
    return this.pack(values);
  }
}

export class Decoder {
  constructor(_options?: any) {}

  // Used by async.js (cbind layer)
  unpack(buffer: Uint8Array): unknown {
    return JSON.parse(new TextDecoder().decode(buffer));
  }

  // Used by backend.js (AztecClientBackend)
  decode(buffer: Uint8Array): unknown {
    return this.unpack(buffer);
  }

  decodeMultiple(buffer: Uint8Array): unknown[] {
    const result = this.unpack(buffer);
    return Array.isArray(result) ? result : [result];
  }
}

export class Packr extends Encoder {}
export class Unpackr extends Decoder {}

export function pack(value: unknown): Uint8Array {
  return new Encoder().pack(value);
}

export function unpack(buffer: Uint8Array): unknown {
  return new Decoder().unpack(buffer);
}

export default { pack, unpack, Encoder, Decoder, Packr, Unpackr };
