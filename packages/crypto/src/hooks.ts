/**
 * React hooks for crypto operations.
 *
 * useCrypto() returns all crypto functions pre-bound to the bridge
 * from React context. This is the primary API for React components.
 */

import { useMemo } from 'react';
import { setCryptoBridge } from './rpc';
import * as hashFns from './hash';
import * as encryptFns from './encrypt';
import * as signFns from './sign';
import * as tokenFns from './token';

// Re-export for convenience
export { setCryptoBridge };

/** All crypto operations available from useCrypto() */
export interface CryptoAPI {
  // Hashing
  sha256: typeof hashFns.sha256;
  sha512: typeof hashFns.sha512;
  hash_blake2b: typeof hashFns.hash_blake2b;
  hash_blake2s: typeof hashFns.hash_blake2s;
  hash_blake3: typeof hashFns.hash_blake3;
  hmacSHA256: typeof hashFns.hmacSHA256;
  hmacSHA512: typeof hashFns.hmacSHA512;
  timingSafeEqual: typeof hashFns.timingSafeEqual;

  // Encryption
  encrypt: typeof encryptFns.encrypt;
  decrypt: typeof encryptFns.decrypt;
  encryptRaw: typeof encryptFns.encryptRaw;
  decryptRaw: typeof encryptFns.decryptRaw;
  randomBytes: typeof encryptFns.randomBytes;

  // Signing
  generateSigningKeys: typeof signFns.generateSigningKeys;
  sign: typeof signFns.sign;
  verify: typeof signFns.verify;
  verifyDetached: typeof signFns.verifyDetached;
  generateDHKeys: typeof signFns.generateDHKeys;
  diffieHellman: typeof signFns.diffieHellman;

  // Tokens
  randomToken: typeof tokenFns.randomToken;
  randomBase64: typeof tokenFns.randomBase64;
  randomId: typeof tokenFns.randomId;
}

/**
 * React hook that returns all crypto functions.
 *
 * The bridge must be set via setCryptoBridge() before using this hook.
 * In the native target, this happens automatically during renderer init.
 *
 * @example
 * const crypto = useCrypto();
 * const hash = await crypto.sha256('hello');
 * const encrypted = await crypto.encrypt('data', 'password');
 */
export function useCrypto(): CryptoAPI {
  return useMemo<CryptoAPI>(() => ({
    // Hashing
    sha256: hashFns.sha256,
    sha512: hashFns.sha512,
    hash_blake2b: hashFns.hash_blake2b,
    hash_blake2s: hashFns.hash_blake2s,
    hash_blake3: hashFns.hash_blake3,
    hmacSHA256: hashFns.hmacSHA256,
    hmacSHA512: hashFns.hmacSHA512,
    timingSafeEqual: hashFns.timingSafeEqual,

    // Encryption
    encrypt: encryptFns.encrypt,
    decrypt: encryptFns.decrypt,
    encryptRaw: encryptFns.encryptRaw,
    decryptRaw: encryptFns.decryptRaw,
    randomBytes: encryptFns.randomBytes,

    // Signing
    generateSigningKeys: signFns.generateSigningKeys,
    sign: signFns.sign,
    verify: signFns.verify,
    verifyDetached: signFns.verifyDetached,
    generateDHKeys: signFns.generateDHKeys,
    diffieHellman: signFns.diffieHellman,

    // Tokens
    randomToken: tokenFns.randomToken,
    randomBase64: tokenFns.randomBase64,
    randomId: tokenFns.randomId,
  }), []);
}
