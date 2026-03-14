import { useState, useCallback } from 'react';
// rjit-ignore: useEffect needed for dep-driven bridge availability
import { useEffect } from 'react';
import { useBridge } from '@reactjit/core';
import type {
  ImagingOperation,
  ImagingApplyRequest,
  ImagingApplyResult,
  ImagingComposeRequest,
  ImagingComposeResult,
  ImagingSelectionState,
  ImagingSelectionShape,
  ImagingSelectionRasterizeOptions,
  ImagingSelectionRasterizeResult,
  ImagingToolState,
  UseImagingResult,
  DetectForegroundParams,
  DetectForegroundResult,
  CompositeBackgroundResult,
  UseObjectDetectResult,
  FloodDetectParams,
  FloodDetectResult,
  UseFloodDetectResult,
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

  // Dep-driven: fetch ops when bridge becomes available.
  // rjit-ignore-next-line
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

  // Dep-driven: fetch blend modes when bridge becomes available.
  // rjit-ignore-next-line
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
    options?: ImagingSelectionRasterizeOptions,
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
          featherRadius: options?.featherRadius,
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

/**
 * Hook for GPU-accelerated foreground detection and background replacement.
 *
 * Usage:
 *   const { detectForeground, compositeBackground, releaseMask } = useObjectDetect();
 *
 *   // Step 1: detect foreground, get a mask handle
 *   const result = await detectForeground('lib/placeholders/avatar.png');
 *
 *   // Step 2: composite with new background
 *   await compositeBackground(
 *     'lib/placeholders/avatar.png',
 *     'lib/placeholders/landscape.png',
 *     result.maskId,
 *     'output.png'
 *   );
 *
 *   // Step 3: release mask when done
 *   await releaseMask(result.maskId);
 */
export function useObjectDetect(): UseObjectDetectResult {
  const bridge = useBridge();
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const detectForeground = useCallback(async (
    src: string,
    params?: DetectForegroundParams,
  ): Promise<DetectForegroundResult | null> => {
    if (!bridge) return null;
    setProcessing(true);
    setError(null);
    try {
      const result = await bridge.rpc<DetectForegroundResult>('imaging:detect_foreground', {
        src,
        threshold: params?.threshold,
        softness: params?.softness,
        borderWidth: params?.borderWidth,
        morphRadius: params?.morphRadius,
        featherRadius: params?.featherRadius,
        edgeWeight: params?.edgeWeight,
        spatialWeight: params?.spatialWeight,
        sharpWeight: params?.sharpWeight,
        refine: params?.refine,
      });
      if (result && !result.ok) {
        setError(result.error || 'Detection failed');
      }
      return result || null;
    } catch (err: any) {
      setError(err?.message || String(err));
      return null;
    } finally {
      setProcessing(false);
    }
  }, [bridge]);

  const compositeBackground = useCallback(async (
    src: string,
    background: string,
    maskId: string,
    output?: string,
  ): Promise<CompositeBackgroundResult | null> => {
    if (!bridge) return null;
    setProcessing(true);
    setError(null);
    try {
      const result = await bridge.rpc<CompositeBackgroundResult>('imaging:composite_background', {
        src,
        background,
        maskId,
        output,
      });
      if (result && !result.ok) {
        setError(result.error || 'Composite failed');
      }
      return result || null;
    } catch (err: any) {
      setError(err?.message || String(err));
      return null;
    } finally {
      setProcessing(false);
    }
  }, [bridge]);

  const releaseMask = useCallback(async (maskId: string): Promise<void> => {
    if (!bridge) return;
    await bridge.rpc('imaging:mask_release', { maskId });
  }, [bridge]);

  return { detectForeground, compositeBackground, releaseMask, processing, error };
}

/**
 * Hook for seed-point flood detection with multi-channel edge consensus.
 *
 * Different approach from useObjectDetect: instead of assuming the border
 * is background, the user clicks a point ON the subject they want to select.
 * The algorithm flood-fills outward by color similarity, then refines the
 * boundary through 4 independent edge detection channels (Sobel, Laplacian,
 * luminance gradient, chroma gradient) averaged into a consensus edge.
 *
 * Usage:
 *   const { floodDetect, compositeBackground, releaseMask } = useFloodDetect();
 *
 *   // Click on robot's chest at (256, 300)
 *   const det = await floodDetect('avatar.png', 256, 300, { tolerance: 0.2 });
 *   await compositeBackground('avatar.png', 'landscape.png', det.maskId, 'out.png');
 *   await releaseMask(det.maskId);
 */
export function useFloodDetect(): UseFloodDetectResult {
  const bridge = useBridge();
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const floodDetect = useCallback(async (
    src: string,
    seedX: number,
    seedY: number,
    params?: FloodDetectParams,
  ): Promise<FloodDetectResult | null> => {
    if (!bridge) return null;
    setProcessing(true);
    setError(null);
    try {
      const result = await bridge.rpc<FloodDetectResult>('imaging:flood_detect', {
        src,
        seedX,
        seedY,
        tolerance: params?.tolerance,
        adaptive: params?.adaptive,
        baseMaskId: params?.baseMaskId,
        edgeStrength: params?.edgeStrength,
        edgeThreshold: params?.edgeThreshold,
        morphRadius: params?.morphRadius,
        featherRadius: params?.featherRadius,
      });
      if (result && !result.ok) {
        setError(result.error || 'Flood detection failed');
      }
      return result || null;
    } catch (err: any) {
      setError(err?.message || String(err));
      return null;
    } finally {
      setProcessing(false);
    }
  }, [bridge]);

  const compositeBackground = useCallback(async (
    src: string,
    background: string,
    maskId: string,
    output?: string,
  ): Promise<CompositeBackgroundResult | null> => {
    if (!bridge) return null;
    setProcessing(true);
    setError(null);
    try {
      const result = await bridge.rpc<CompositeBackgroundResult>('imaging:composite_background', {
        src, background, maskId, output,
      });
      if (result && !result.ok) {
        setError(result.error || 'Composite failed');
      }
      return result || null;
    } catch (err: any) {
      setError(err?.message || String(err));
      return null;
    } finally {
      setProcessing(false);
    }
  }, [bridge]);

  const releaseMask = useCallback(async (maskId: string): Promise<void> => {
    if (!bridge) return;
    await bridge.rpc('imaging:mask_release', { maskId });
  }, [bridge]);

  return { floodDetect, compositeBackground, releaseMask, processing, error };
}
