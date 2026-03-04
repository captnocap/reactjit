import { rpc } from './rpc';
import type { GPGKey, GPGVerifyResult } from './types';

export async function gpgEncrypt(plaintext: string, recipientKeyId: string): Promise<string> {
  const r = await rpc<{ ciphertext: string }>('privacy:gpg:encrypt', { plaintext, recipientKeyId });
  return r.ciphertext;
}

export async function gpgDecrypt(ciphertext: string): Promise<string> {
  const r = await rpc<{ plaintext: string }>('privacy:gpg:decrypt', { ciphertext });
  return r.plaintext;
}

export async function gpgSign(message: string, keyId?: string): Promise<string> {
  const r = await rpc<{ signed: string }>('privacy:gpg:sign', { message, keyId });
  return r.signed;
}

export async function gpgVerify(signed: string): Promise<GPGVerifyResult> {
  return rpc<GPGVerifyResult>('privacy:gpg:verify', { signed });
}

export async function gpgListKeys(): Promise<GPGKey[]> {
  const r = await rpc<{ keys: GPGKey[] }>('privacy:gpg:listKeys');
  return r.keys;
}

export async function gpgImportKey(armoredKey: string): Promise<{ imported: number }> {
  return rpc<{ imported: number }>('privacy:gpg:importKey', { armoredKey });
}

export async function gpgExportKey(keyId: string): Promise<string> {
  const r = await rpc<{ key: string }>('privacy:gpg:exportKey', { keyId });
  return r.key;
}
