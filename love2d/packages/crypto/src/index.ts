// ── Types ───────────────────────────────────────────────
export type {
  EncryptedData,
  KeyPair,
  SignedMessage,
  HashResult,
  EncryptOptions,
  ScryptParams,
  Argon2idParams,
  Pbkdf2Params,
} from './types';

// ── Bridge setup ──────────────────────────────────────
export { setCryptoBridge } from './rpc';

// ── React hook ────────────────────────────────────────
export { useCrypto } from './hooks';
export type { CryptoAPI } from './hooks';

// ── Hashing (libsodium + libcrypto + libblake3) ──────
export {
  sha256,
  sha512,
  hash_blake2b,
  hash_blake2s,
  hash_blake3,
  hmacSHA256,
  hmacSHA512,
  timingSafeEqual,
} from './hash';

// ── Symmetric Encryption (libsodium) ─────────────────
export {
  encrypt,
  decrypt,
  encryptRaw,
  decryptRaw,
  randomBytes,
} from './encrypt';

// ── Signing & Key Exchange (libsodium) ───────────────
export {
  generateSigningKeys,
  sign,
  verify,
  verifyDetached,
  generateDHKeys,
  diffieHellman,
} from './sign';

// ── Token Generation (libsodium) ─────────────────────
export { randomToken, randomBase64, randomId } from './token';

// ── Encoding (pure JS, no bridge needed) ─────────────
export { toHex, fromHex, toBase64, fromBase64 } from './encoding';
