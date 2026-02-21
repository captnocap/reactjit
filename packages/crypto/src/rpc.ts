/**
 * Internal bridge reference for crypto RPC calls.
 *
 * Set during native renderer init via setCryptoBridge().
 * All crypto functions route through this to reach Lua/C.
 */

interface CryptoBridge {
  rpc<T = any>(method: string, args?: any, timeoutMs?: number): Promise<T>;
}

let _bridge: CryptoBridge | null = null;

/**
 * Set the bridge instance for crypto RPC calls.
 * Call this once when the native bridge initializes.
 */
export function setCryptoBridge(bridge: CryptoBridge): void {
  _bridge = bridge;
}

/**
 * Get the current bridge, or throw if not set.
 */
export function getBridge(): CryptoBridge {
  if (!_bridge) {
    throw new Error(
      '@ilovereact/crypto: bridge not initialized. ' +
      'Call setCryptoBridge(bridge) before using crypto functions, ' +
      'or use useCrypto() inside a BridgeProvider.'
    );
  }
  return _bridge;
}

/**
 * Call a crypto RPC method on the Lua side.
 */
export function rpc<T = any>(method: string, args?: any): Promise<T> {
  return getBridge().rpc<T>(method, args);
}
