/**
 * Hash functions — routed to Lua/C via RPC.
 *
 * libsodium: SHA-256, SHA-512, BLAKE2b
 * OpenSSL:   BLAKE2s
 * libblake3: BLAKE3
 */

import { rpc } from './rpc';
import type { HashResult } from './types';

/**
 * SHA-256.
 * @example
 * const h = await sha256('hello');
 * h.hex // 'b94d27b9...'
 */
export function sha256(input: string): Promise<HashResult> {
  return rpc<HashResult>('crypto:hash', { algorithm: 'sha256', input });
}

/**
 * SHA-512.
 */
export function sha512(input: string): Promise<HashResult> {
  return rpc<HashResult>('crypto:hash', { algorithm: 'sha512', input });
}

/**
 * BLAKE2b (default 32-byte output).
 */
export function hash_blake2b(input: string, outputBytes?: number): Promise<HashResult> {
  return rpc<HashResult>('crypto:hash', { algorithm: 'blake2b', input, outputBytes });
}

/**
 * BLAKE2s (32-byte output, via OpenSSL).
 */
export function hash_blake2s(input: string): Promise<HashResult> {
  return rpc<HashResult>('crypto:hash', { algorithm: 'blake2s', input });
}

/**
 * BLAKE3 (default 32-byte output).
 */
export function hash_blake3(input: string, outputBytes?: number): Promise<HashResult> {
  return rpc<HashResult>('crypto:hash', { algorithm: 'blake3', input, outputBytes });
}

/**
 * HMAC-SHA256.
 */
export function hmacSHA256(key: string, message: string): Promise<HashResult> {
  return rpc<HashResult>('crypto:hmac', { algorithm: 'sha256', key, message });
}

/**
 * HMAC-SHA512.
 */
export function hmacSHA512(key: string, message: string): Promise<HashResult> {
  return rpc<HashResult>('crypto:hmac', { algorithm: 'sha512', key, message });
}

/**
 * Timing-safe comparison (constant-time).
 */
export function timingSafeEqual(a: string, b: string): Promise<boolean> {
  return rpc<{ equal: boolean }>('crypto:timingSafeEqual', { a, b })
    .then(r => r.equal);
}
