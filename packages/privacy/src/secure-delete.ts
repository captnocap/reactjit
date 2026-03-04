import { rpc } from './rpc';

export function secureDelete(path: string, passes?: number): Promise<{ success: boolean; method: string }> {
  return rpc<{ success: boolean; method: string }>('privacy:file:secureDelete', { path, passes });
}
