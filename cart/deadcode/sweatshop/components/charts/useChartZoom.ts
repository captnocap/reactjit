// =============================================================================
// useChartZoom — viewport state + drag-rect + wheel-zoom + reset
// =============================================================================
// The viewport is a sub-rectangle of the chart's natural [xMin..xMax,
// yMin..yMax] domain. Null means "no override, use the natural domain".
// Drag produces a zoom-rect while the user is mousing; release commits it
// as the new viewport. Wheel zooms around the pointer. Double-click resets.
//
// Pure behaviour — no painting. ChartInteractions composes this with
// overlay events and passes the viewport back to the chart.
// =============================================================================

export interface DataViewport { x0: number; x1: number; y0: number; y1: number }
export interface PlotRect     { x: number; y: number; w: number; h: number }

export interface DomainRect { xMin: number; xMax: number; yMin: number; yMax: number }

export interface ZoomRect { x: number; y: number; w: number; h: number }

export interface UseChartZoomOpts {
  enabled?: boolean;
  /** Optional bounds clamp: output viewport always inside this. */
  bounds?: DomainRect;
}

function pxToData(px: number, py: number, plot: PlotRect, vp: DataViewport): { x: number; y: number } {
  const xs = vp.x1 - vp.x0;
  const ys = vp.y1 - vp.y0;
  const x = vp.x0 + ((px - plot.x) / Math.max(1, plot.w)) * xs;
  // Screen Y grows downward; data Y grows upward — invert.
  const y = vp.y1 - ((py - plot.y) / Math.max(1, plot.h)) * ys;
  return { x, y };
}

function clamp(v: number, lo: number, hi: number): number { return Math.max(lo, Math.min(hi, v)); }

function clampViewport(vp: DataViewport, b?: DomainRect): DataViewport {
  if (!b) return vp;
  const w = vp.x1 - vp.x0;
  const h = vp.y1 - vp.y0;
  let x0 = clamp(vp.x0, b.xMin, b.xMax - w);
  let y0 = clamp(vp.y0, b.yMin, b.yMax - h);
  if (x0 < b.xMin) x0 = b.xMin;
  if (y0 < b.yMin) y0 = b.yMin;
  return { x0, x1: x0 + w, y0, y1: y0 + h };
}

export function useChartZoom(
  natural: DomainRect,
  plot: PlotRect,
  opts: UseChartZoomOpts = {},
): {
  viewport: DataViewport;
  zoomRect: ZoomRect | null;
  beginDrag: (px: number, py: number) => void;
  moveDrag:  (px: number, py: number) => void;
  endDrag:   () => void;
  cancelDrag: () => void;
  wheel: (delta: number, px: number, py: number) => void;
  reset: () => void;
  active: boolean;
} {
  const enabled = opts.enabled !== false;
  const naturalVp: DataViewport = {
    x0: natural.xMin, x1: natural.xMax, y0: natural.yMin, y1: natural.yMax,
  };
  const [viewport, setViewport]   = useState<DataViewport>(naturalVp);
  const [zoomRect, setZoomRect]   = useState<ZoomRect | null>(null);
  const dragStart = useRef<{ px: number; py: number } | null>(null);

  const active =
    viewport.x0 !== naturalVp.x0 || viewport.x1 !== naturalVp.x1 ||
    viewport.y0 !== naturalVp.y0 || viewport.y1 !== naturalVp.y1;

  const beginDrag = (px: number, py: number) => {
    if (!enabled) return;
    dragStart.current = { px, py };
    setZoomRect({ x: px, y: py, w: 0, h: 0 });
  };

  const moveDrag = (px: number, py: number) => {
    if (!enabled || !dragStart.current) return;
    const s = dragStart.current;
    setZoomRect({
      x: Math.min(s.px, px),
      y: Math.min(s.py, py),
      w: Math.abs(px - s.px),
      h: Math.abs(py - s.py),
    });
  };

  const endDrag = () => {
    if (!enabled || !dragStart.current || !zoomRect) { dragStart.current = null; setZoomRect(null); return; }
    // Minimum 6px drag before committing — avoids accidental zooms on a click.
    if (zoomRect.w < 6 || zoomRect.h < 6) { dragStart.current = null; setZoomRect(null); return; }
    const a = pxToData(zoomRect.x,             zoomRect.y + zoomRect.h, plot, viewport);
    const b = pxToData(zoomRect.x + zoomRect.w, zoomRect.y,             plot, viewport);
    const next = clampViewport({ x0: a.x, x1: b.x, y0: a.y, y1: b.y }, opts.bounds || natural);
    setViewport(next);
    dragStart.current = null;
    setZoomRect(null);
  };

  const cancelDrag = () => { dragStart.current = null; setZoomRect(null); };

  const wheel = (delta: number, px: number, py: number) => {
    if (!enabled) return;
    // Normalise: wheel up = zoom in = shrink viewport by 0.9.
    const factor = delta > 0 ? 1.1 : 0.9;
    const pt = pxToData(px, py, plot, viewport);
    const xs = (viewport.x1 - viewport.x0) * factor;
    const ys = (viewport.y1 - viewport.y0) * factor;
    const tx = (pt.x - viewport.x0) / Math.max(1e-9, viewport.x1 - viewport.x0);
    const ty = (pt.y - viewport.y0) / Math.max(1e-9, viewport.y1 - viewport.y0);
    const next: DataViewport = {
      x0: pt.x - tx * xs,
      x1: pt.x + (1 - tx) * xs,
      y0: pt.y - ty * ys,
      y1: pt.y + (1 - ty) * ys,
    };
    setViewport(clampViewport(next, opts.bounds || natural));
  };

  const reset = () => setViewport(naturalVp);

  return { viewport, zoomRect, beginDrag, moveDrag, endDrag, cancelDrag, wheel, reset, active };
}
