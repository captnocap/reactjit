import { useState, useCallback, useRef, useEffect } from 'react';
import { useBridge } from '@reactjit/core';
import type { ImagingOperation, UseImagingResult } from './types';

/**
 * Hook for image processing operations.
 *
 * Sends operations to the Lua imaging pipeline via bridge RPC.
 * Operations execute on the GPU when possible.
 *
 * Usage:
 *   const { apply, processing, error } = useImaging();
 *   apply([
 *     { op: 'brightness', amount: 0.2 },
 *     { op: 'gaussian_blur', radius: 3 },
 *   ]);
 */
export function useImaging(): UseImagingResult {
  const bridge = useBridge();
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const apply = useCallback((operations: ImagingOperation[]) => {
    if (!bridge) return;
    setProcessing(true);
    setError(null);

    bridge.rpc('imaging:apply', {
      operations: JSON.stringify(operations),
    }).then(() => {
      setProcessing(false);
    }).catch((err: Error) => {
      setError(err.message);
      setProcessing(false);
    });
  }, [bridge]);

  return { apply, processing, error };
}

/**
 * Hook that returns the list of available imaging operations.
 */
export function useImagingOps(): string[] {
  const bridge = useBridge();
  const [ops, setOps] = useState<string[]>([]);

  useEffect(() => {
    if (!bridge) return;
    bridge.rpc('imaging:list_ops', {}).then((result: string[]) => {
      setOps(result);
    });
  }, [bridge]);

  return ops;
}

/**
 * Hook that returns the list of available blend modes.
 */
export function useBlendModes(): string[] {
  const bridge = useBridge();
  const [modes, setModes] = useState<string[]>([]);

  useEffect(() => {
    if (!bridge) return;
    bridge.rpc('imaging:blend_modes', {}).then((result: string[]) => {
      setModes(result);
    });
  }, [bridge]);

  return modes;
}
