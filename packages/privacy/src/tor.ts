import { rpc } from './rpc';
import type { TorStatus } from './types';

export function torStatus(): Promise<TorStatus> {
  return rpc<TorStatus>('tor:status');
}
