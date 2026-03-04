/**
 * Internal bridge reference for privacy RPC calls.
 *
 * Set during renderer init via setPrivacyBridge().
 * All privacy functions route through this to reach Lua/C.
 */

interface PrivacyBridge {
  rpc<T = any>(method: string, args?: any, timeoutMs?: number): Promise<T>;
}

let _bridge: PrivacyBridge | null = null;

/**
 * Set the bridge instance for privacy RPC calls.
 * Call this once when the native bridge initializes.
 */
export function setPrivacyBridge(bridge: PrivacyBridge): void {
  _bridge = bridge;
}

/**
 * Get the current bridge, or throw if not set.
 */
export function getBridge(): PrivacyBridge {
  if (!_bridge) {
    throw new Error(
      '@reactjit/privacy: bridge not initialized. ' +
      'Call setPrivacyBridge(bridge) before using privacy functions, ' +
      'or use usePrivacy() inside a BridgeProvider.'
    );
  }
  return _bridge;
}

/**
 * Call a privacy RPC method on the Lua side.
 */
export function rpc<T = any>(method: string, args?: any): Promise<T> {
  return getBridge().rpc<T>(method, args);
}
