import { rpc } from './rpc';
import type { NoiseHandshake, NoiseSessionId } from './types';

export function noiseInitiate(remotePublicKey: string): Promise<NoiseHandshake> {
  return rpc<NoiseHandshake>('privacy:noise:initiate', { remotePublicKey });
}

export function noiseRespond(staticPrivateKey: string, handshakeMessage: string): Promise<NoiseHandshake> {
  return rpc<NoiseHandshake>('privacy:noise:respond', { staticPrivateKey, handshakeMessage });
}

export async function noiseSend(sessionId: NoiseSessionId, plaintext: string): Promise<string> {
  const r = await rpc<{ ciphertext: string }>('privacy:noise:send', { sessionId, plaintext });
  return r.ciphertext;
}

export async function noiseReceive(sessionId: NoiseSessionId, ciphertext: string): Promise<string> {
  const r = await rpc<{ plaintext: string }>('privacy:noise:receive', { sessionId, ciphertext });
  return r.plaintext;
}

export function noiseClose(sessionId: NoiseSessionId): Promise<void> {
  return rpc<void>('privacy:noise:close', { sessionId });
}
