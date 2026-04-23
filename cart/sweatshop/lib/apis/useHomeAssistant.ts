import { useAPI, useAPIMutation, bearer } from './base';
import { useServiceKey } from './useServiceKey';

export interface HAConfig { baseUrl?: string; token?: string; }

export function useHomeAssistant(config?: HAConfig) {
  const keys = useServiceKey('homeassistant');
  const base = config?.baseUrl ?? keys.baseUrl ?? 'http://homeassistant.local:8123';
  const token = config?.token ?? keys.token;
  const headers: Record<string, string> = token
    ? { ...bearer(token), 'Content-Type': 'application/json' }
    : { 'Content-Type': 'application/json' };

  const states = () => useAPI<any[]>(token ? `${base}/api/states` : null, { headers });
  const state = (entityId: string) =>
    useAPI<any>(token && entityId ? `${base}/api/states/${entityId}` : null, { headers });
  const services = () => useAPI<any[]>(token ? `${base}/api/services` : null, { headers });
  const callService = (domain: string, service: string) =>
    useAPIMutation<any>(`${base}/api/services/${domain}/${service}`, { method: 'POST', headers });

  return { states, state, services, callService };
}
