const { useState, useEffect } = require('react');

function lsGetJson<T>(key: string, fallback: T): T {
  try {
    const host: any = globalThis;
    const fn = host.__store_get;
    if (typeof fn !== 'function') return fallback;
    const raw = fn(key);
    if (raw == null) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function lsSetJson(key: string, value: any): void {
  try {
    const host: any = globalThis;
    const fn = host.__store_set;
    if (typeof fn !== 'function') return;
    fn(key, JSON.stringify(value));
  } catch {}
}

export function usePersistentState<T>(key: string, initial: T): [T, (v: T | ((prev: T) => T)) => void] {
  const [state, setState] = useState<T>(() => lsGetJson(key, initial));

  useEffect(() => {
    lsSetJson(key, state);
  }, [key, state]);

  return [state, setState];
}
