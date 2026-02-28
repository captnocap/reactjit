/**
 * Digital signatures and key exchange — routed to Lua/C via RPC.
 *
 * libsodium: Ed25519 signing, X25519 Diffie-Hellman.
 */

import { rpc } from './rpc';
import type { KeyPair, SignedMessage } from './types';

/**
 * Generate an Ed25519 key pair for signing.
 *
 * @example
 * const keys = await generateSigningKeys();
 * const signed = await sign(keys.privateKey, 'hello');
 * await verify(signed); // true
 */
export function generateSigningKeys(): Promise<KeyPair> {
  return rpc<KeyPair>('crypto:generateSigningKeys');
}

/**
 * Sign a message with an Ed25519 private key.
 */
export function sign(privateKeyHex: string, message: string): Promise<SignedMessage> {
  return rpc<SignedMessage>('crypto:sign', { privateKey: privateKeyHex, message });
}

/**
 * Verify an Ed25519 signed message.
 */
export function verify(signed: SignedMessage): Promise<boolean> {
  return rpc<{ valid: boolean }>('crypto:verify', {
    message: signed.message,
    signature: signed.signature,
    publicKey: signed.publicKey,
  }).then(r => r.valid);
}

/**
 * Verify a detached signature.
 */
export function verifyDetached(
  message: string,
  signatureHex: string,
  publicKeyHex: string,
): Promise<boolean> {
  return rpc<{ valid: boolean }>('crypto:verify', {
    message,
    signature: signatureHex,
    publicKey: publicKeyHex,
  }).then(r => r.valid);
}

/**
 * Generate an X25519 key pair for Diffie-Hellman key exchange.
 */
export function generateDHKeys(): Promise<KeyPair> {
  return rpc<KeyPair>('crypto:generateDHKeys');
}

/**
 * X25519 Diffie-Hellman key exchange.
 * Returns a shared secret (hex) from your private key + their public key.
 */
export function diffieHellman(privateKeyHex: string, publicKeyHex: string): Promise<string> {
  return rpc<{ sharedSecret: string }>('crypto:diffieHellman', {
    privateKey: privateKeyHex,
    publicKey: publicKeyHex,
  }).then(r => r.sharedSecret);
}
