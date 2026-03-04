import { rpc } from './rpc';
import type { HKDFOptions } from './types';

export async function hkdfDerive(ikm: string, opts?: HKDFOptions): Promise<string> {
  const r = await rpc<{ key: string }>('privacy:hkdf:derive', { ikm, ...opts });
  return r.key;
}
