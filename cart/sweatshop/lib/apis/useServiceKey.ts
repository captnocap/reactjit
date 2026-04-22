const React: any = require('react');

export interface ServiceKeys {
  [field: string]: string | undefined;
}

export function useServiceKey(serviceId: string): ServiceKeys {
  const keys: ServiceKeys = {};
  try {
    const raw = (globalThis as any).__store_get?.('api.' + serviceId);
    if (raw) {
      const parsed = JSON.parse(raw);
      for (const k in parsed) keys[k] = parsed[k];
    }
  } catch {}
  return keys;
}

export function getServiceKey(serviceId: string, field: string): string | undefined {
  const keys = useServiceKey(serviceId);
  return keys[field];
}

export function setServiceKey(serviceId: string, data: ServiceKeys): void {
  try {
    (globalThis as any).__store_set?.('api.' + serviceId, JSON.stringify(data));
  } catch {}
}

export function deleteServiceKey(serviceId: string): void {
  try {
    (globalThis as any).__store_set?.('api.' + serviceId, '');
  } catch {}
}

export function isServiceEnabled(serviceId: string): boolean {
  try {
    const raw = (globalThis as any).__store_get?.('api.' + serviceId);
    return raw != null && raw !== '';
  } catch { return false; }
}
