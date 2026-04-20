/**
 * crypto — cryptographic primitives backed by framework/crypto.zig.
 *
 * Surface mirrors what the Zig module already has: HMAC-SHA256 (RFC 4231),
 * HKDF-SHA256 (RFC 5869), Shamir Secret Sharing over GF(256), and
 * XChaCha20-Poly1305 envelope encryption. Random bytes via the OS CSPRNG.
 *
 * Binary data crosses the bridge as base64 strings — cheaper and simpler
 * than typed arrays over QuickJS. Typed-array conversion happens in this
 * module before/after the call.
 *
 * Registration (Zig side):
 *
 *   qjs_runtime.registerHostFn("__crypto_random_b64", @ptrCast(&crypto_random_b64), 1);
 *   qjs_runtime.registerHostFn("__crypto_hmac_sha256_b64", @ptrCast(&crypto_hmac_sha256_b64), 2);
 *   qjs_runtime.registerHostFn("__crypto_hkdf_sha256_b64", @ptrCast(&crypto_hkdf_sha256_b64), 4);
 *   qjs_runtime.registerHostFn("__crypto_xchacha_encrypt_b64", @ptrCast(&crypto_xchacha_encrypt_b64), 3);
 *   qjs_runtime.registerHostFn("__crypto_xchacha_decrypt_b64", @ptrCast(&crypto_xchacha_decrypt_b64), 3);
 *   qjs_runtime.registerHostFn("__crypto_shamir_split_json", @ptrCast(&crypto_shamir_split_json), 3);
 *   qjs_runtime.registerHostFn("__crypto_shamir_combine_b64", @ptrCast(&crypto_shamir_combine_b64), 1);
 */

import { callHost } from '../ffi';

// ── base64 ↔ Uint8Array helpers ────────────────────────────────────

function b64encode(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s);
}
function b64decode(s: string): Uint8Array {
  const raw = atob(s);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}
function strToBytes(s: string): Uint8Array {
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i) & 0xff;
  return out;
}

// ── Random ─────────────────────────────────────────────────────────

/** Cryptographically-secure random bytes from the OS CSPRNG. */
export function randomBytes(n: number): Uint8Array {
  const b64 = callHost<string>('__crypto_random_b64', '', n);
  return b64decode(b64);
}

// ── HMAC + HKDF ────────────────────────────────────────────────────

export function hmacSha256(key: Uint8Array | string, message: Uint8Array | string): Uint8Array {
  const k = typeof key === 'string' ? strToBytes(key) : key;
  const m = typeof message === 'string' ? strToBytes(message) : message;
  const b64 = callHost<string>('__crypto_hmac_sha256_b64', '', b64encode(k), b64encode(m));
  return b64decode(b64);
}

export function hkdfSha256(
  ikm: Uint8Array,
  salt: Uint8Array,
  info: Uint8Array,
  length: number,
): Uint8Array {
  const b64 = callHost<string>('__crypto_hkdf_sha256_b64', '', b64encode(ikm), b64encode(salt), b64encode(info), length);
  return b64decode(b64);
}

// ── XChaCha20-Poly1305 ─────────────────────────────────────────────

export function xchachaEncrypt(plaintext: Uint8Array, key: Uint8Array, nonce: Uint8Array): Uint8Array {
  const b64 = callHost<string>('__crypto_xchacha_encrypt_b64', '', b64encode(plaintext), b64encode(key), b64encode(nonce));
  return b64decode(b64);
}

export function xchachaDecrypt(ciphertext: Uint8Array, key: Uint8Array, nonce: Uint8Array): Uint8Array | null {
  const b64 = callHost<string>('__crypto_xchacha_decrypt_b64', '', b64encode(ciphertext), b64encode(key), b64encode(nonce));
  return b64.length === 0 ? null : b64decode(b64);
}

// ── Shamir Secret Sharing ──────────────────────────────────────────

export interface ShamirShare { x: number; y: string; /* base64 */ }

/** Split a secret into N shares, any K of which recombine it. */
export function shamirSplit(secret: Uint8Array, n: number, k: number): ShamirShare[] {
  const raw = callHost<string>('__crypto_shamir_split_json', '[]', b64encode(secret), n, k);
  try { return JSON.parse(raw); } catch { return []; }
}

export function shamirCombine(shares: ShamirShare[]): Uint8Array | null {
  const b64 = callHost<string>('__crypto_shamir_combine_b64', '', JSON.stringify(shares));
  return b64.length === 0 ? null : b64decode(b64);
}
