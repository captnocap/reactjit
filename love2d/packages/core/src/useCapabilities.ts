/**
 * useCapabilities — AI discovery hook.
 *
 * Returns the list of all registered native capabilities and their schemas.
 * An AI agent calls this once to know what's available, then generates JSX.
 *
 * @example
 * const { capabilities, loading } = useCapabilities();
 * // capabilities = {
 * //   Audio: { schema: { src: { type: "string" }, playing: { type: "bool" }, ... }, events: ["onProgress", "onEnded"] },
 * //   Timer: { schema: { interval: { type: "number" }, ... }, events: ["onTick"] },
 * // }
 */

import { useState, useEffect } from 'react';
import { useBridgeOptional } from './context';
import type { CapabilitySchema } from './types';

export function useCapabilities(): {
  capabilities: Record<string, CapabilitySchema> | null;
  loading: boolean;
} {
  const bridge = useBridgeOptional();
  const [capabilities, setCapabilities] = useState<Record<string, CapabilitySchema> | null>(null);
  const [loading, setLoading] = useState(true);

  // rjit-ignore-next-line — Dep-driven: re-fetches capabilities when bridge changes
  useEffect(() => {
    if (!bridge) {
      setLoading(false);
      return;
    }

    bridge.rpc<Record<string, CapabilitySchema>>('capabilities:list')
      .then((result) => {
        setCapabilities(result);
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
      });
  }, [bridge]);

  return { capabilities, loading };
}
