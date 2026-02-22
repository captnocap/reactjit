/**
 * useServiceKey — Read API keys stored by the Lua settings overlay.
 *
 * Uses bridge RPC to query keys from Lua's persistent storage.
 * Keys are set via the settings overlay (F10) and persisted in
 * love.filesystem at save/settings/api_keys.json.
 *
 * @example
 * import { useServiceKey } from '@reactjit/apis';
 * import { useSpotifyNowPlaying } from '@reactjit/apis';
 *
 * function NowPlaying() {
 *   const { key } = useServiceKey('spotify', 'token');
 *   const { data } = useSpotifyNowPlaying(key);
 *   return <Text fontSize={14}>{data?.item?.name ?? 'Not playing'}</Text>;
 * }
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useBridgeOptional } from '../../core/src/context';

export interface ServiceKeyResult {
  /** The stored key value, or null if not configured. */
  key: string | null;
  /** True while the initial load is in progress. */
  loading: boolean;
  /** Whether the key has been set (non-empty string). */
  configured: boolean;
  /** Re-fetch the key from storage. */
  refetch: () => void;
}

/**
 * Read an API key from the Lua settings overlay's persistent storage.
 *
 * @param serviceId - The service ID (e.g., 'spotify', 'github', 'openai')
 * @param fieldKey - The field key within the service (e.g., 'token', 'apiKey').
 *                   If omitted, returns the first field's value.
 */
export function useServiceKey(
  serviceId: string,
  fieldKey?: string,
): ServiceKeyResult {
  const bridge = useBridgeOptional();
  const [key, setKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);
  const serviceIdRef = useRef(serviceId);
  const fieldKeyRef = useRef(fieldKey);
  serviceIdRef.current = serviceId;
  fieldKeyRef.current = fieldKey;

  const refetch = useCallback(() => setTick(t => t + 1), []);

  useEffect(() => {
    if (!bridge) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    bridge.rpc<string | null>('settings:getKey', {
      serviceId: serviceIdRef.current,
      fieldKey: fieldKeyRef.current,
    }).then(value => {
      if (!cancelled) {
        setKey(typeof value === 'string' ? value : null);
        setLoading(false);
      }
    }).catch(() => {
      if (!cancelled) setLoading(false);
    });

    return () => { cancelled = true; };
  }, [bridge, serviceId, fieldKey, tick]);

  return {
    key,
    loading,
    configured: key != null && key !== '',
    refetch,
  };
}

/**
 * Read all API keys for a service from the Lua settings overlay.
 *
 * @param serviceId - The service ID
 * @returns Object mapping fieldKey → value
 */
export function useServiceKeys(
  serviceId: string,
): { keys: Record<string, string>; loading: boolean; refetch: () => void } {
  const bridge = useBridgeOptional();
  const [keys, setKeys] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);

  const refetch = useCallback(() => setTick(t => t + 1), []);

  useEffect(() => {
    if (!bridge) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    bridge.rpc<Record<string, string>>('settings:getKeys').then(allKeys => {
      if (!cancelled && allKeys) {
        const prefix = serviceId + '.';
        const filtered: Record<string, string> = {};
        for (const [k, v] of Object.entries(allKeys)) {
          if (k.startsWith(prefix)) {
            filtered[k.slice(prefix.length)] = v;
          }
        }
        setKeys(filtered);
        setLoading(false);
      }
    }).catch(() => {
      if (!cancelled) setLoading(false);
    });

    return () => { cancelled = true; };
  }, [bridge, serviceId, tick]);

  return { keys, loading, refetch };
}
