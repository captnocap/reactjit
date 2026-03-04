interface ConvertBridge {
  rpc<T = any>(method: string, args?: any, timeoutMs?: number): Promise<T>;
}

let _bridge: ConvertBridge | null = null;

export function setConvertBridge(bridge: ConvertBridge): void {
  _bridge = bridge;
}

export function getBridge(): ConvertBridge {
  if (!_bridge) {
    throw new Error(
      '@reactjit/convert: bridge not initialized. ' +
      'Call setConvertBridge(bridge) before using bridge-dependent converters.'
    );
  }
  return _bridge;
}

export function rpc<T = any>(method: string, args?: any): Promise<T> {
  return getBridge().rpc<T>(method, args);
}
