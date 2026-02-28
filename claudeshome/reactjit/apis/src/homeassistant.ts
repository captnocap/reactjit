/**
 * Home Assistant REST API hooks.
 * Auth: Long-lived access token (Bearer). Settings > Profile > Long-Lived Access Tokens.
 */

import { useAPI, useAPIMutation, bearer, type APIResult } from './base';

// ── Types ───────────────────────────────────────────────

export interface HAState {
  entity_id: string;
  state: string;
  attributes: Record<string, any>;
  last_changed: string;
  last_updated: string;
}

export interface HAService {
  domain: string;
  services: Record<string, { description: string; fields: Record<string, any> }>;
}

export interface HAConfig {
  location_name: string;
  latitude: number;
  longitude: number;
  elevation: number;
  unit_system: Record<string, string>;
  time_zone: string;
  version: string;
}

export interface HAEvent {
  event_type: string;
  listener_count: number;
}

export interface HALogEntry {
  name: string;
  message: string;
  entity_id?: string;
  when: string;
}

// ── Hooks ───────────────────────────────────────────────

export function useHAStates(
  baseUrl: string | null,
  token: string | null,
  opts?: { interval?: number },
): APIResult<HAState[]> {
  return useAPI(
    baseUrl && token ? `${baseUrl}/api/states` : null,
    { headers: bearer(token!), interval: opts?.interval },
  );
}

export function useHAEntity(
  baseUrl: string | null,
  token: string | null,
  entityId: string | null,
  opts?: { interval?: number },
): APIResult<HAState> {
  return useAPI(
    baseUrl && token && entityId ? `${baseUrl}/api/states/${entityId}` : null,
    { headers: bearer(token!), interval: opts?.interval },
  );
}

export function useHAConfig(
  baseUrl: string | null,
  token: string | null,
): APIResult<HAConfig> {
  return useAPI(
    baseUrl && token ? `${baseUrl}/api/config` : null,
    { headers: bearer(token!) },
  );
}

export function useHAServices(
  baseUrl: string | null,
  token: string | null,
): APIResult<HAService[]> {
  return useAPI(
    baseUrl && token ? `${baseUrl}/api/services` : null,
    { headers: bearer(token!) },
  );
}

export function useHAHistory(
  baseUrl: string | null,
  token: string | null,
  entityId: string | null,
  opts?: { hours?: number },
): APIResult<HAState[][]> {
  const since = new Date(Date.now() - (opts?.hours ?? 24) * 3600000).toISOString();
  return useAPI(
    baseUrl && token && entityId
      ? `${baseUrl}/api/history/period/${since}?filter_entity_id=${entityId}`
      : null,
    { headers: bearer(token!) },
  );
}

export function useHALogbook(
  baseUrl: string | null,
  token: string | null,
  opts?: { entityId?: string; hours?: number },
): APIResult<HALogEntry[]> {
  const since = new Date(Date.now() - (opts?.hours ?? 24) * 3600000).toISOString();
  const entityFilter = opts?.entityId ? `?entity=${opts.entityId}` : '';
  return useAPI(
    baseUrl && token ? `${baseUrl}/api/logbook/${since}${entityFilter}` : null,
    { headers: bearer(token!) },
  );
}

export function useHACallService(baseUrl: string | null, token: string | null) {
  const { execute, loading, error } = useAPIMutation(token ? bearer(token) : undefined);
  return {
    call: (domain: string, service: string, data?: Record<string, any>) =>
      execute(`${baseUrl}/api/services/${domain}/${service}`, { body: data ?? {} }),
    loading,
    error,
  };
}
