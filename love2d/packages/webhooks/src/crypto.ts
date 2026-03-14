/**
 * HMAC-SHA256 for webhook signature verification.
 * Delegates to @noble/hashes — audited, battle-tested.
 */

import { sha256 } from '@noble/hashes/sha2.js';
import { hmac } from '@noble/hashes/hmac.js';
import { bytesToHex } from '@noble/hashes/utils.js';

/**
 * Compute HMAC-SHA256 and return hex string.
 */
export function hmacSHA256(key: string, message: string): string {
  const keyBytes = new TextEncoder().encode(key);
  const msgBytes = new TextEncoder().encode(message);
  return bytesToHex(hmac(sha256, keyBytes, msgBytes));
}

/**
 * Timing-safe comparison of two hex strings.
 */
export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}
