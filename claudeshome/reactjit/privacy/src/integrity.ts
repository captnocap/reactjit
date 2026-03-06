import { rpc } from './rpc';
import type { HashAlgorithm, IntegrityReport } from './types';

export async function hashFile(path: string, algorithm?: HashAlgorithm): Promise<string> {
  const r = await rpc<{ hash: string }>('privacy:integrity:hashFile', { path, algorithm });
  return r.hash;
}

export async function hashDirectory(path: string, opts?: { algorithm?: HashAlgorithm; recursive?: boolean }): Promise<Record<string, string>> {
  const r = await rpc<{ manifest: Record<string, string> }>('privacy:integrity:hashDirectory', { path, ...opts });
  return r.manifest;
}

export function verifyManifest(path: string, manifest: Record<string, string>): Promise<IntegrityReport> {
  return rpc<IntegrityReport>('privacy:integrity:verifyManifest', { path, manifest });
}
