import { rpc } from './rpc';
import type { FileEncryptOptions, EnvelopeEncrypted } from './types';

export function encryptFile(path: string, outputPath: string, password: string, opts?: FileEncryptOptions): Promise<void> {
  return rpc<void>('privacy:file:encrypt', { path, outputPath, password, algorithm: opts?.algorithm });
}

export function decryptFile(path: string, outputPath: string, password: string): Promise<void> {
  return rpc<void>('privacy:file:decrypt', { path, outputPath, password });
}

export function envelopeEncrypt(data: string, kekHex: string): Promise<EnvelopeEncrypted> {
  return rpc<EnvelopeEncrypted>('privacy:envelope:encrypt', { data, kek: kekHex });
}

export async function envelopeDecrypt(envelope: EnvelopeEncrypted, kekHex: string): Promise<string> {
  const r = await rpc<{ data: string }>('privacy:envelope:decrypt', { envelope, kek: kekHex });
  return r.data;
}
