// =============================================================================
// useChartCrosshair — hover-follow vertical+horizontal reticle
// =============================================================================
// Tracks the pointer inside the plot rect; reports the nearest series point
// within a radius so a tooltip can render a real data readout. The pointer
// position (data-space + pixel-space) is exposed too, so consumers can draw
// the crosshair lines themselves in Graph.Path / Canvas.Node space.
// =============================================================================

import type { DataViewport, PlotRect } from './useChartZoom';

export interface CrosshairSeriesPoint {
  seriesId: string;
  seriesName: string;
  color: string;
  /** data-space x */
  x: number;
  /** data-space y */
  y: number;
  /** screen-pixel position (relative to the containing Pressable overlay) */
  px: number;
  py: number;
  /** distance from pointer in pixels */
  distance: number;
}

export interface CrosshairState {
  visible: boolean;
  /** pointer position in screen-pixel space */
  px: number;
  py: number;
  /** same in data space, computed from viewport */
  dataX: number;
  dataY: number;
  /** ranked list of near series points (empty when no series within snapRadius) */
  hits: CrosshairSeriesPoint[];
}

export interface UseChartCrosshairOpts {
  enabled?: boolean;
  /** pixel radius within which a data point 'counts'. Default 40. */
  snapRadius?: number;
}

export interface CrosshairInputPoint {
  seriesId: string;
  seriesName: string;
  color: string;
  x: number;
  y: number;
  px: number;
  py: number;
}

export function useChartCrosshair(
  plot: PlotRect,
  viewport: DataViewport,
  seriesPoints: CrosshairInputPoint[],
  opts: UseChartCrosshairOpts = {},
): {
  state: CrosshairState;
  onMove: (px: number, py: number) => void;
  onLeave: () => void;
} {
  const enabled = opts.enabled !== false;
  const snap = Math.max(2, opts.snapRadius ?? 40);
  const [state, setState] = useState<CrosshairState>({
    visible: false, px: 0, py: 0, dataX: 0, dataY: 0, hits: [],
  });

  const onMove = (px: number, py: number) => {
    if (!enabled) return;
    const inside = px >= plot.x && px <= plot.x + plot.w && py >= plot.y && py <= plot.y + plot.h;
    if (!inside) { setState((s) => s.visible ? { ...s, visible: false } : s); return; }
    const xs = viewport.x1 - viewport.x0;
    const ys = viewport.y1 - viewport.y0;
    const dataX = viewport.x0 + ((px - plot.x) / Math.max(1, plot.w)) * xs;
    const dataY = viewport.y1 - ((py - plot.y) / Math.max(1, plot.h)) * ys;

    const hits: CrosshairSeriesPoint[] = [];
    for (const p of seriesPoints) {
      const dx = p.px - px;
      const dy = p.py - py;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d <= snap) hits.push({ ...p, distance: d });
    }
    hits.sort((a, b) => a.distance - b.distance);

    setState({ visible: true, px, py, dataX, dataY, hits });
  };

  const onLeave = () => setState((s) => s.visible ? { ...s, visible: false } : s);

  return { state, onMove, onLeave };
}
