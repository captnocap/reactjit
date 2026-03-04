import { rpc } from './rpc';
import type { SecureHandle, ProtectMode } from './types';

export async function secureAlloc(dataHex: string): Promise<SecureHandle> {
  const r = await rpc<{ handle: SecureHandle }>('privacy:secmem:alloc', { dataHex });
  return r.handle;
}

export async function secureRead(handle: SecureHandle): Promise<string> {
  const r = await rpc<{ hex: string }>('privacy:secmem:read', { handle });
  return r.hex;
}

export function secureFree(handle: SecureHandle): Promise<void> {
  return rpc<void>('privacy:secmem:free', { handle });
}

export function secureProtect(handle: SecureHandle, mode: ProtectMode): Promise<void> {
  return rpc<void>('privacy:secmem:protect', { handle, mode });
}
