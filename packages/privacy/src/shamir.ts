import { rpc } from './rpc';
import type { ShamirShare } from './types';

export async function shamirSplit(secretHex: string, totalShares: number, threshold: number): Promise<ShamirShare[]> {
  const r = await rpc<{ shares: ShamirShare[] }>('privacy:shamir:split', { secret: secretHex, n: totalShares, k: threshold });
  return r.shares;
}

export async function shamirCombine(shares: ShamirShare[]): Promise<string> {
  const r = await rpc<{ secret: string }>('privacy:shamir:combine', { shares });
  return r.secret;
}
