// =============================================================================
// useChartBrush — drag-along-an-axis range select, commits to zoom one axis
// =============================================================================
// The zoom-rect hook widens+shrinks BOTH axes from a freeform drag.
// Brush is the 1D variant: drag along the x-axis (default) to pick a
// time/data range, the commit narrows only x — y stays natural. Meant for
// time-series line/area charts where users want to zoom into a window
// without accidentally cropping the y-range.
// =============================================================================

import type { DataViewport, DomainRect, PlotRect } from './useChartZoom';

export type BrushAxis = 'x' | 'y';

export interface BrushState {
  active: boolean;
  /** pixel-space start / end while dragging */
  startPx: number;
  endPx:   number;
}

export interface UseChartBrushOpts {
  enabled?: boolean;
  axis?: BrushAxis;        // default 'x'
  bounds?: DomainRect;
  /** Minimum brush width in pixels before a release commits (default 8). */
  minPx?: number;
}

function clamp(v: number, lo: number, hi: number): number { return Math.max(lo, Math.min(hi, v)); }

export function useChartBrush(
  viewport: DataViewport,
  setViewport: (vp: DataViewport) => void,
  plot: PlotRect,
  opts: UseChartBrushOpts = {},
): {
  state: BrushState;
  begin: (px: number, py: number) => void;
  move:  (px: number, py: number) => void;
  end:   () => void;
  cancel: () => void;
} {
  const enabled = opts.enabled !== false;
  const axis = opts.axis ?? 'x';
  const minPx = Math.max(2, opts.minPx ?? 8);

  const [state, setState] = useState<BrushState>({ active: false, startPx: 0, endPx: 0 });

  const pxToDataAxis = (px: number): number => {
    if (axis === 'x') {
      const xs = viewport.x1 - viewport.x0;
      return viewport.x0 + ((px - plot.x) / Math.max(1, plot.w)) * xs;
    } else {
      const ys = viewport.y1 - viewport.y0;
      return viewport.y1 - ((px - plot.y) / Math.max(1, plot.h)) * ys;
    }
  };

  const begin = (px: number, py: number) => {
    if (!enabled) return;
    const anchor = axis === 'x' ? px : py;
    setState({ active: true, startPx: anchor, endPx: anchor });
  };
  const move = (px: number, py: number) => {
    if (!enabled || !state.active) return;
    const cur = axis === 'x' ? px : py;
    setState((s) => ({ ...s, endPx: cur }));
  };
  const end = () => {
    if (!enabled || !state.active) { setState({ active: false, startPx: 0, endPx: 0 }); return; }
    const lo = Math.min(state.startPx, state.endPx);
    const hi = Math.max(state.startPx, state.endPx);
    if (hi - lo < minPx) { setState({ active: false, startPx: 0, endPx: 0 }); return; }
    const b = opts.bounds;
    if (axis === 'x') {
      const x0 = pxToDataAxis(lo);
      const x1 = pxToDataAxis(hi);
      const next: DataViewport = {
        x0: b ? clamp(x0, b.xMin, b.xMax) : x0,
        x1: b ? clamp(x1, b.xMin, b.xMax) : x1,
        y0: viewport.y0, y1: viewport.y1,
      };
      setViewport(next);
    } else {
      const y1 = pxToDataAxis(lo);  // top pixel → higher data value
      const y0 = pxToDataAxis(hi);
      const next: DataViewport = {
        x0: viewport.x0, x1: viewport.x1,
        y0: b ? clamp(y0, b.yMin, b.yMax) : y0,
        y1: b ? clamp(y1, b.yMin, b.yMax) : y1,
      };
      setViewport(next);
    }
    setState({ active: false, startPx: 0, endPx: 0 });
  };
  const cancel = () => setState({ active: false, startPx: 0, endPx: 0 });

  return { state, begin, move, end, cancel };
}
