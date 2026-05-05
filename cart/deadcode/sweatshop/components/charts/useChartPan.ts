// =============================================================================
// useChartPan — drag-to-pan the current viewport
// =============================================================================
// Produces a panned DataViewport on every moveDrag — data under the pointer
// tracks the pointer 1:1. Only meaningful when the caller is already zoomed
// in (if the viewport matches the natural domain, panning would push data
// off-chart, so the natural-bounds clamp would snap right back).
//
// Composable with useChartZoom: the wrapper panel chooses ONE modifier-free
// drag gesture (zoom-rect OR pan) via a `mode` flag; this hook only acts
// when the caller says so.
// =============================================================================

import type { DataViewport, DomainRect, PlotRect } from './useChartZoom';

export interface UseChartPanOpts {
  enabled?: boolean;
  bounds?: DomainRect;
}

function clamp(v: number, lo: number, hi: number): number { return Math.max(lo, Math.min(hi, v)); }

function clampPan(vp: DataViewport, b?: DomainRect): DataViewport {
  if (!b) return vp;
  const w = vp.x1 - vp.x0;
  const h = vp.y1 - vp.y0;
  let x0 = clamp(vp.x0, b.xMin, b.xMax - w);
  let y0 = clamp(vp.y0, b.yMin, b.yMax - h);
  return { x0, x1: x0 + w, y0, y1: y0 + h };
}

export function useChartPan(
  viewport: DataViewport,
  setViewport: (vp: DataViewport) => void,
  plot: PlotRect,
  opts: UseChartPanOpts = {},
): {
  beginPan: (px: number, py: number) => void;
  movePan:  (px: number, py: number) => void;
  endPan:   () => void;
  panning:  boolean;
} {
  const enabled = opts.enabled !== false;
  const startRef = useRef<{ px: number; py: number; vp: DataViewport } | null>(null);
  const [panning, setPanning] = useState(false);

  const beginPan = (px: number, py: number) => {
    if (!enabled) return;
    startRef.current = { px, py, vp: { ...viewport } };
    setPanning(true);
  };
  const movePan = (px: number, py: number) => {
    if (!enabled || !startRef.current) return;
    const s = startRef.current;
    const xs = s.vp.x1 - s.vp.x0;
    const ys = s.vp.y1 - s.vp.y0;
    const dxData = -((px - s.px) / Math.max(1, plot.w)) * xs;
    // Screen Y grows down, data Y grows up — invert.
    const dyData =  ((py - s.py) / Math.max(1, plot.h)) * ys;
    const next: DataViewport = {
      x0: s.vp.x0 + dxData, x1: s.vp.x1 + dxData,
      y0: s.vp.y0 + dyData, y1: s.vp.y1 + dyData,
    };
    setViewport(clampPan(next, opts.bounds));
  };
  const endPan = () => { startRef.current = null; setPanning(false); };

  return { beginPan, movePan, endPan, panning };
}
