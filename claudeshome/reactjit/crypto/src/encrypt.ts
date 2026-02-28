/**
 * Symmetric encryption — routed to Lua/C via RPC.
 *
 * Password-based encryption using Argon2id (default) or scrypt KDF.
 * XChaCha20-Poly1305 (default), ChaCha20-Poly1305, or AES-256-GCM.
 */

import { rpc } from './rpc';
import type { EncryptedData, EncryptOptions } from './types';

/**
 * Encrypt a string with a password.
 *
 * Default: XChaCha20-Poly1305 + Argon2id KDF.
 *
 * @example
 * const encrypted = await encrypt('my secret data', 'strong-password');
 *
 * @example
 * // ChaCha20-Poly1305 with scrypt (backward compat)
 * const encrypted = await encrypt(data, password, {
 *   algorithm: 'chacha20-poly1305',
 *   kdf: 'scrypt',
 *   kdfParams: { N: 2**14 }
 * });
 */
export function encrypt(
  plaintext: string,
  password: string,
  options?: EncryptOptions,
): Promise<EncryptedData> {
  return rpc<EncryptedData>('crypto:encrypt', {
    plaintext,
    password,
    algorithm: options?.algorithm,
    kdf: options?.kdf,
    kdfParams: options?.kdfParams,
  });
}

/**
 * Decrypt an EncryptedData envelope with a password.
 *
 * @example
 * const plaintext = await decrypt(encrypted, 'strong-password');
 */
export function decrypt(data: EncryptedData, password: string): Promise<string> {
  return rpc<{ plaintext: string }>('crypto:decrypt', { data, password })
    .then(r => r.plaintext);
}

/**
 * Encrypt raw bytes with a key (no KDF — you manage the key).
 * Input and output are hex-encoded.
 *
 * @example
 * const { ciphertext, nonce } = await encryptRaw(dataHex, keyHex);
 */
export function encryptRaw(
  plaintextHex: string,
  keyHex: string,
  algorithm?: EncryptedData['algorithm'],
): Promise<{ ciphertext: string; nonce: string }> {
  return rpc<{ ciphertext: string; nonce: string }>('crypto:encryptRaw', {
    plaintext: plaintextHex,
    key: keyHex,
    algorithm,
  });
}

/**
 * Decrypt raw bytes with a key. Hex-encoded I/O.
 */
export function decryptRaw(
  ciphertextHex: string,
  keyHex: string,
  nonceHex: string,
  algorithm?: EncryptedData['algorithm'],
): Promise<string> {
  return rpc<{ plaintext: string }>('crypto:decryptRaw', {
    ciphertext: ciphertextHex,
    key: keyHex,
    nonce: nonceHex,
    algorithm,
  }).then(r => r.plaintext);
}

/**
 * Generate cryptographically secure random bytes (hex-encoded).
 */
export function randomBytes(count: number = 32): Promise<string> {
  return rpc<{ bytes: string }>('crypto:randomBytes', { count })
    .then(r => r.bytes);
}
