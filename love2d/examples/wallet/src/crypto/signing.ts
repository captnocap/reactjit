import { keccak_256 } from '@noble/hashes/sha3.js';
import { sign as secp256k1Sign } from '@noble/secp256k1';
import { bytesToHex, hexToBytes } from './keys';

// EIP-1559 (Type 2) transaction
export interface Transaction {
  chainId: bigint;
  nonce: bigint;
  maxPriorityFeePerGas: bigint;
  maxFeePerGas: bigint;
  gasLimit: bigint;
  to: string;       // 0x-prefixed address
  value: bigint;
  data: string;      // 0x-prefixed hex (or '0x' for empty)
  accessList: [];    // empty for simple transfers
}

// ── RLP Encoding ─────────────────────────────────────────

function rlpEncodeLength(len: number, offset: number): Uint8Array {
  if (len < 56) {
    return new Uint8Array([len + offset]);
  }
  const hexLen = len.toString(16);
  const lenBytes = hexToBytes(hexLen.length % 2 ? '0' + hexLen : hexLen);
  const result = new Uint8Array(1 + lenBytes.length);
  result[0] = offset + 55 + lenBytes.length;
  result.set(lenBytes, 1);
  return result;
}

export function rlpEncode(input: Uint8Array | Uint8Array[]): Uint8Array {
  if (input instanceof Uint8Array) {
    // Single byte in [0x00, 0x7f] range
    if (input.length === 1 && input[0] < 0x80) {
      return input;
    }
    // Empty byte string
    if (input.length === 0) {
      return new Uint8Array([0x80]);
    }
    const prefix = rlpEncodeLength(input.length, 0x80);
    const result = new Uint8Array(prefix.length + input.length);
    result.set(prefix);
    result.set(input, prefix.length);
    return result;
  }

  // List: encode each item, concatenate, prepend list header
  const encoded = input.map(item => rlpEncode(item));
  const totalLen = encoded.reduce((sum, e) => sum + e.length, 0);
  const prefix = rlpEncodeLength(totalLen, 0xc0);
  const result = new Uint8Array(prefix.length + totalLen);
  result.set(prefix);
  let offset = prefix.length;
  for (const e of encoded) {
    result.set(e, offset);
    offset += e.length;
  }
  return result;
}

// ── Helper: bigint to minimal byte encoding ──────────────

function bigintToBytes(n: bigint): Uint8Array {
  if (n === 0n) return new Uint8Array(0);
  let hex = n.toString(16);
  if (hex.length % 2) hex = '0' + hex;
  return hexToBytes(hex);
}

function addressToBytes(addr: string): Uint8Array {
  return hexToBytes(addr.replace('0x', ''));
}

// ── Transaction Serialization ────────────────────────────

export function serializeUnsignedTx(tx: Transaction): Uint8Array {
  const fields: Uint8Array[] = [
    bigintToBytes(tx.chainId),
    bigintToBytes(tx.nonce),
    bigintToBytes(tx.maxPriorityFeePerGas),
    bigintToBytes(tx.maxFeePerGas),
    bigintToBytes(tx.gasLimit),
    addressToBytes(tx.to),
    bigintToBytes(tx.value),
    hexToBytes(tx.data.replace('0x', '') || ''),
    new Uint8Array(0), // empty access list (RLP-encoded as empty list)
  ];

  // Type 2 envelope: 0x02 || RLP(fields)
  const rlpPayload = rlpEncode(fields);
  const result = new Uint8Array(1 + rlpPayload.length);
  result[0] = 0x02;
  result.set(rlpPayload, 1);
  return result;
}

export function signTransaction(tx: Transaction, privateKey: Uint8Array): string {
  const unsigned = serializeUnsignedTx(tx);
  const msgHash = keccak_256(unsigned);

  const sig = secp256k1Sign(msgHash, privateKey);
  const r = bigintToBytes(sig.r);
  const s = bigintToBytes(sig.s);
  const v = sig.recovery;

  // Signed: 0x02 || RLP([...fields, v, r, s])
  const fields: Uint8Array[] = [
    bigintToBytes(tx.chainId),
    bigintToBytes(tx.nonce),
    bigintToBytes(tx.maxPriorityFeePerGas),
    bigintToBytes(tx.maxFeePerGas),
    bigintToBytes(tx.gasLimit),
    addressToBytes(tx.to),
    bigintToBytes(tx.value),
    hexToBytes(tx.data.replace('0x', '') || ''),
    new Uint8Array(0), // access list
    bigintToBytes(BigInt(v)),
    r,
    s,
  ];

  const rlpPayload = rlpEncode(fields);
  const signed = new Uint8Array(1 + rlpPayload.length);
  signed[0] = 0x02;
  signed.set(rlpPayload, 1);

  return '0x' + bytesToHex(signed);
}

export function hashTransaction(rawTx: string): string {
  const bytes = hexToBytes(rawTx.replace('0x', ''));
  return '0x' + bytesToHex(keccak_256(bytes));
}
