/**
 * Secure token/password generation — routed to Lua/C via RPC.
 * Uses libsodium's randombytes_buf().
 */

import { rpc } from './rpc';

/**
 * Generate a cryptographically random hex token.
 *
 * @example
 * const token = await randomToken(32); // 64 hex chars
 */
export function randomToken(bytes: number = 32): Promise<string> {
  return rpc<{ token: string }>('crypto:randomToken', { bytes })
    .then(r => r.token);
}

/**
 * Generate a cryptographically random base64 token.
 */
export function randomBase64(bytes: number = 32): Promise<string> {
  return rpc<{ token: string }>('crypto:randomBase64', { bytes })
    .then(r => r.token);
}

/**
 * Generate a URL-safe random string (alphanumeric).
 */
export function randomId(length: number = 16): Promise<string> {
  return rpc<{ id: string }>('crypto:randomId', { length })
    .then(r => r.id);
}
