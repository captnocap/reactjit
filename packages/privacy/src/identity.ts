import { rpc } from './rpc';
import type { IsolatedCredential } from './types';

export async function anonymousId(domain: string, seed?: string): Promise<string> {
  const r = await rpc<{ id: string }>('privacy:identity:anonymousId', { domain, seed });
  return r.id;
}

export async function pseudonym(masterSecret: string, context: string): Promise<string> {
  const r = await rpc<{ pseudonym: string }>('privacy:identity:pseudonym', { masterSecret, context });
  return r.pseudonym;
}

export async function isolatedCredential(domain: string): Promise<IsolatedCredential> {
  const r = await rpc<{ domain: string; publicKey: string; keyId: string }>('privacy:identity:isolatedCredential', { domain });
  return { domain: r.domain, publicKey: r.publicKey, keyId: r.keyId };
}
