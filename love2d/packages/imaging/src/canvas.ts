import { useCallback, useRef } from 'react';
import { useBridge } from '@reactjit/core';
import type { UseDrawCanvasResult } from './types';

let _counter = 0;

/**
 * Hook for the DrawCanvas capability — a mutable Love2D canvas that accumulates
 * paint, erase, and fill operations via bridge RPCs.
 *
 * Usage:
 *   const dc = useDrawCanvas(400, 300);
 *
 *   // Declare the visible canvas node:
 *   <Native type="DrawCanvas" canvasId={dc.canvasId} width={400} height={300} />
 *
 *   // Draw on button press:
 *   await dc.paint([[0,0],[200,150]], [1,0,0,1], 12);
 *   await dc.erase([[100,80],[200,120]], 20);
 *   await dc.fill(50, 50, [0,0,1,1]);
 *   await dc.clear();
 *   await dc.export('drawing.png');
 *
 * The canvasId is stable across renders (generated once from a ref).
 * The canvas on the Lua side is created when the DrawCanvas node mounts.
 */
export function useDrawCanvas(
  _width: number,
  _height: number,
  _background?: string,
): UseDrawCanvasResult {
  const bridge = useBridge();

  const canvasIdRef = useRef<string | null>(null);
  if (!canvasIdRef.current) {
    _counter += 1;
    canvasIdRef.current = `dc_${_counter}`;
  }
  const canvasId = canvasIdRef.current;

  const paint = useCallback(async (
    points: [number, number][],
    color: [number, number, number, number],
    size: number,
    opacity = 1,
    maskId?: string,
  ): Promise<void> => {
    if (!bridge) return;
    await bridge.rpc('canvas:paint', { canvasId, points, color, size, opacity, maskId });
  }, [bridge, canvasId]);

  const erase = useCallback(async (
    points: [number, number][],
    size: number,
  ): Promise<void> => {
    if (!bridge) return;
    await bridge.rpc('canvas:erase', { canvasId, points, size });
  }, [bridge, canvasId]);

  const fill = useCallback(async (
    x: number,
    y: number,
    color: [number, number, number, number],
    tolerance?: number,
  ): Promise<void> => {
    if (!bridge) return;
    await bridge.rpc('canvas:fill', { canvasId, x, y, color, tolerance });
  }, [bridge, canvasId]);

  const clear = useCallback(async (
    color?: [number, number, number, number],
  ): Promise<void> => {
    if (!bridge) return;
    await bridge.rpc('canvas:clear', { canvasId, color });
  }, [bridge, canvasId]);

  const getPixel = useCallback(async (
    x: number,
    y: number,
  ): Promise<{ r: number; g: number; b: number; a: number } | null> => {
    if (!bridge) return null;
    return bridge.rpc<{ r: number; g: number; b: number; a: number }>(
      'canvas:get_pixel',
      { canvasId, x, y },
    );
  }, [bridge, canvasId]);

  const exportCanvas = useCallback(async (
    path: string,
  ): Promise<{ ok: boolean; path: string } | null> => {
    if (!bridge) return null;
    return bridge.rpc<{ ok: boolean; path: string }>(
      'canvas:export',
      { canvasId, path },
    );
  }, [bridge, canvasId]);

  return {
    canvasId,
    paint,
    erase,
    fill,
    clear,
    getPixel,
    export: exportCanvas,
  };
}
