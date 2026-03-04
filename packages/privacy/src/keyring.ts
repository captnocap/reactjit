import { rpc } from './rpc';
import type { KeyringHandle, KeyGenOptions, KeyEntry } from './types';

export async function createKeyring(path: string, masterPassword: string): Promise<KeyringHandle> {
  const r = await rpc<{ handle: KeyringHandle }>('privacy:keyring:create', { path, masterPassword });
  return r.handle;
}

export async function openKeyring(path: string, masterPassword: string): Promise<KeyringHandle> {
  const r = await rpc<{ handle: KeyringHandle }>('privacy:keyring:open', { path, masterPassword });
  return r.handle;
}

export function closeKeyring(handle: KeyringHandle): Promise<void> {
  return rpc<void>('privacy:keyring:close', { handle });
}

export async function generateKey(handle: KeyringHandle, opts: KeyGenOptions): Promise<KeyEntry> {
  const r = await rpc<{ key: KeyEntry }>('privacy:keyring:generateKey', { handle, opts });
  return r.key;
}

export async function listKeys(handle: KeyringHandle): Promise<KeyEntry[]> {
  const r = await rpc<{ keys: KeyEntry[] }>('privacy:keyring:listKeys', { handle });
  return r.keys;
}

export async function getKey(handle: KeyringHandle, keyId: string): Promise<KeyEntry | null> {
  const r = await rpc<{ key: KeyEntry | null }>('privacy:keyring:getKey', { handle, keyId });
  return r.key;
}

export async function rotateKey(handle: KeyringHandle, keyId: string, reason?: string): Promise<KeyEntry> {
  const r = await rpc<{ key: KeyEntry }>('privacy:keyring:rotateKey', { handle, keyId, reason });
  return r.key;
}

export function revokeKey(handle: KeyringHandle, keyId: string, reason: string): Promise<void> {
  return rpc<void>('privacy:keyring:revokeKey', { handle, keyId, reason });
}

export async function exportPublic(handle: KeyringHandle, keyId: string): Promise<string> {
  const r = await rpc<{ publicKey: string }>('privacy:keyring:exportPublic', { handle, keyId });
  return r.publicKey;
}
