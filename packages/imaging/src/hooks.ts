import { useState, useCallback, useEffect } from 'react';
import { useBridge } from '@reactjit/core';
import type {
  ImagingOperation,
  ImagingApplyRequest,
  ImagingApplyResult,
  ImagingComposeRequest,
  ImagingComposeResult,
  ImagingSelectionState,
  ImagingSelectionShape,
  ImagingSelectionRasterizeResult,
  ImagingToolState,
  UseImagingResult,
} from './types';
import {
  commitImagingHistory,
  createImagingHistoryEntry,
  createImagingHistoryState,
  redoImagingHistory,
  type UseImagingHistoryResult,
  undoImagingHistory,
} from './history';

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

  const apply = useCallback(async (input: ImagingApplyRequest | ImagingOperation[]): Promise<ImagingApplyResult | null> => {
    if (!bridge) return null;
    setProcessing(true);
    setError(null);

    const req: ImagingApplyRequest = Array.isArray(input)
      ? { operations: input }
      : input;

    try {
      const result = await bridge.rpc<ImagingApplyResult>('imaging:apply', {
        src: req.src,
        operations: JSON.stringify(req.operations || []),
        output: req.output,
        width: req.width,
        height: req.height,
        maskId: req.maskId,
      });
      return result || null;
    } catch (err: any) {
      setError(err?.message || String(err));
      return null;
    } finally {
      setProcessing(false);
    }
  }, [bridge]);

  return { apply, processing, error };
}

/**
 * Hook for non-destructive layer composition.
 */
export function useImagingComposer() {
  const bridge = useBridge();
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const compose = useCallback(async (request: ImagingComposeRequest): Promise<ImagingComposeResult | null> => {
    if (!bridge) return null;
    setProcessing(true);
    setError(null);
    try {
      const compositionJson = JSON.stringify(request.composition);
      const result = await bridge.rpc<ImagingComposeResult>('imaging:compose', {
        composition: compositionJson,
        cacheKey: compositionJson,
        output: request.output,
      });
      return result || null;
    } catch (err: any) {
      setError(err?.message || String(err));
      return null;
    } finally {
      setProcessing(false);
    }
  }, [bridge]);

  return { compose, processing, error };
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

/**
 * Pure JS undo/redo history for composition state snapshots.
 */
export function useImagingHistory<TState>(initialState: TState): UseImagingHistoryResult<TState> {
  const [history, setHistory] = useState(() => createImagingHistoryState(initialState));

  const commit = useCallback((state: TState, label: string) => {
    setHistory((prev) => commitImagingHistory(prev, createImagingHistoryEntry(state, label)));
  }, []);

  const undo = useCallback(() => {
    setHistory((prev) => undoImagingHistory(prev));
  }, []);

  const redo = useCallback(() => {
    setHistory((prev) => redoImagingHistory(prev));
  }, []);

  const canUndo = history.past.length > 0;
  const canRedo = history.future.length > 0;

  return {
    history,
    canUndo,
    canRedo,
    commit,
    undo,
    redo,
  };
}

/**
 * Selection model — manages geometric shapes and rasterizes them to an
 * in-memory Lua mask canvas via imaging:selection_rasterize.
 *
 * Typical workflow:
 *   const { addShape, rasterize, activeMaskId, clearMask } = useImagingSelection();
 *   addShape({ type: 'rect', x: 0, y: 0, width: 130, height: 180 });
 *   const maskId = await rasterize(260, 180);
 *   await apply({ src: 'photo.jpg', operations: [...], maskId, output: 'out.png' });
 */
export function useImagingSelection(initial?: ImagingSelectionState) {
  const bridge = useBridge();
  const [selection, setSelection] = useState<ImagingSelectionState>(
    initial || { mode: 'replace', rects: [] },
  );
  const [shapes, setShapes] = useState<ImagingSelectionShape[]>([]);
  const [activeMaskId, setActiveMaskId] = useState<string | null>(null);

  /** Add or replace the current selection shapes.
   *  In 'replace' mode the list is cleared first; in other modes the shape is appended. */
  const addShape = useCallback((shape: ImagingSelectionShape) => {
    setShapes(prev =>
      selection.mode === 'replace' ? [shape] : [...prev, shape],
    );
  }, [selection.mode]);

  /** Clear all pending shapes (does not release the active mask). */
  const clearShapes = useCallback(() => {
    setShapes([]);
  }, []);

  /**
   * Rasterize the current (or provided) shapes to a grayscale mask canvas on
   * the Lua side.  Returns the maskId handle to pass to imaging:apply, or null
   * on failure.
   *
   * @param width  Canvas width the mask should cover (pixels).
   * @param height Canvas height the mask should cover (pixels).
   * @param shapesOverride  If provided, use these instead of the hook's shape state.
   */
  const rasterize = useCallback(async (
    width: number,
    height: number,
    shapesOverride?: ImagingSelectionShape[],
  ): Promise<string | null> => {
    if (!bridge) return null;
    const toRasterize = shapesOverride ?? shapes;
    if (toRasterize.length === 0) return null;
    try {
      const result = await bridge.rpc<ImagingSelectionRasterizeResult>(
        'imaging:selection_rasterize',
        {
          shapes: toRasterize,
          width,
          height,
          mode: selection.mode,
          baseMaskId: activeMaskId ?? undefined,
        },
      );
      if (result?.ok) {
        setActiveMaskId(result.maskId);
        return result.maskId;
      }
      return null;
    } catch {
      return null;
    }
  }, [bridge, shapes, selection.mode, activeMaskId]);

  /** Release the currently active mask canvas from Lua memory. */
  const clearMask = useCallback(async () => {
    if (!bridge || !activeMaskId) return;
    await bridge.rpc('imaging:mask_release', { maskId: activeMaskId });
    setActiveMaskId(null);
  }, [bridge, activeMaskId]);

  return {
    selection,
    setSelection,
    shapes,
    addShape,
    clearShapes,
    activeMaskId,
    rasterize,
    clearMask,
  };
}

/**
 * Tool state for brush/erase/transform tools.
 * Runtime brush engine wired via canvas:paint / canvas:erase RPCs.
 */
export function useImagingTools(initial?: Partial<ImagingToolState>) {
  const [tools, setTools] = useState<ImagingToolState>({
    activeTool: initial?.activeTool || 'move',
    brushSize: initial?.brushSize ?? 24,
    brushOpacity: initial?.brushOpacity ?? 1,
  });
  return { tools, setTools };
}
