// =============================================================================
// ChartInteractions — overlay Pressable that drives the four hooks
// =============================================================================
// Host any chart inside this. Pointer events route to the right hook per the
// `interactions` config: drag = zoom-rect (or pan when already zoomed or
// user is holding the pan modifier), wheel = zoom, double-click = reset,
// hover = crosshair, shift-drag = axis brush.
//
// Paints in data-space via Canvas.Node overlays so the zoom rect, crosshair
// lines, and brush band sit on top of the hosted chart without touching its
// internals.
// =============================================================================

import { Box, Canvas, Pressable } from '../../../runtime/primitives';
import { COLORS } from '../../theme';
import { useChartZoom, type DataViewport, type DomainRect, type PlotRect } from './useChartZoom';
import { useChartPan } from './useChartPan';
import { useChartCrosshair, type CrosshairInputPoint, type CrosshairState } from './useChartCrosshair';
import { useChartBrush } from './useChartBrush';

export interface ChartInteractionsConfig {
  zoom?: boolean;
  pan?: boolean;
  crosshair?: boolean;
  brush?: boolean;
  /** For crosshair snap + brush: */
  snapRadius?: number;
  /** 'x' | 'y' — default 'x' (time-range brush). */
  brushAxis?: 'x' | 'y';
}

export interface ChartInteractionsProps {
  plot: PlotRect;
  natural: DomainRect;
  /** Current viewport (driven by zoom/pan/brush combined). */
  viewport: DataViewport;
  setViewport: (vp: DataViewport) => void;
  config: ChartInteractionsConfig;
  /** Series points (in pixel-space) for crosshair snap. */
  points?: CrosshairInputPoint[];
  /** Called with latest crosshair state so the parent can render a tooltip
   *  or a crosshair line wherever it wants. */
  onCrosshair?: (state: CrosshairState) => void;
}

export function ChartInteractions(props: ChartInteractionsProps) {
  const { plot, natural, viewport, setViewport, config } = props;
  const zoomOn      = !!config.zoom;
  const panOn       = !!config.pan;
  const crosshairOn = !!config.crosshair;
  const brushOn     = !!config.brush;

  const zoom = useChartZoom(natural, plot, { enabled: zoomOn, bounds: natural });
  // keep the zoom hook's viewport in sync with the parent-owned one by
  // forwarding setViewport into our own state + feeding it back.
  useEffect(() => { setViewport(zoom.viewport); }, [zoom.viewport.x0, zoom.viewport.x1, zoom.viewport.y0, zoom.viewport.y1]);

  const pan = useChartPan(viewport, setViewport, plot, { enabled: panOn, bounds: natural });
  const brush = useChartBrush(viewport, setViewport, plot, { enabled: brushOn, bounds: natural, axis: config.brushAxis ?? 'x' });
  const crosshair = useChartCrosshair(plot, viewport, props.points || [], { enabled: crosshairOn, snapRadius: config.snapRadius });

  useEffect(() => { if (props.onCrosshair) props.onCrosshair(crosshair.state); }, [crosshair.state]);

  // Hit-test: which mode does THIS drag belong to?
  // shift → brush; active zoom viewport + pan-enabled → pan; else zoom.
  const modeRef = useRef<'zoom' | 'pan' | 'brush' | null>(null);
  const lastClickAt = useRef<number>(0);

  const onDown = (e: any) => {
    const px = (e && (e.x ?? e.offsetX)) ?? 0;
    const py = (e && (e.y ?? e.offsetY)) ?? 0;
    const shift = !!(e && (e.shiftKey || e.shift));
    const now = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
    // Double-click = reset
    if (now - lastClickAt.current < 350) { zoom.reset(); lastClickAt.current = 0; return; }
    lastClickAt.current = now;

    if (shift && brushOn)              { modeRef.current = 'brush'; brush.begin(px, py); return; }
    if (panOn && zoom.active)          { modeRef.current = 'pan';   pan.beginPan(px, py); return; }
    if (zoomOn)                        { modeRef.current = 'zoom';  zoom.beginDrag(px, py); return; }
    if (panOn)                         { modeRef.current = 'pan';   pan.beginPan(px, py); return; }
    modeRef.current = null;
  };
  const onMove = (e: any) => {
    const px = (e && (e.x ?? e.offsetX)) ?? 0;
    const py = (e && (e.y ?? e.offsetY)) ?? 0;
    if (modeRef.current === 'zoom')  zoom.moveDrag(px, py);
    else if (modeRef.current === 'pan')   pan.movePan(px, py);
    else if (modeRef.current === 'brush') brush.move(px, py);
    if (crosshairOn) crosshair.onMove(px, py);
  };
  const onUp = () => {
    if (modeRef.current === 'zoom')  zoom.endDrag();
    else if (modeRef.current === 'pan')   pan.endPan();
    else if (modeRef.current === 'brush') brush.end();
    modeRef.current = null;
  };
  const onOut = () => {
    if (modeRef.current === 'zoom')  zoom.cancelDrag();
    else if (modeRef.current === 'pan')   pan.endPan();
    else if (modeRef.current === 'brush') brush.cancel();
    modeRef.current = null;
    crosshair.onLeave();
  };
  const onWheel = (e: any) => {
    if (!zoomOn) return;
    const px = (e && (e.x ?? e.offsetX)) ?? plot.x + plot.w / 2;
    const py = (e && (e.y ?? e.offsetY)) ?? plot.y + plot.h / 2;
    const dy = (e && (e.deltaY ?? e.delta)) ?? 0;
    zoom.wheel(dy, px, py);
  };

  return (
    <>
      <Pressable
        style={{ position: 'absolute', left: plot.x, top: plot.y, width: plot.w, height: plot.h }}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerLeave={onOut}
        onWheel={onWheel}
      />
      {zoom.zoomRect ? (
        <Box style={{
          position: 'absolute',
          left: zoom.zoomRect.x, top: zoom.zoomRect.y,
          width: zoom.zoomRect.w, height: zoom.zoomRect.h,
          borderWidth: 1, borderColor: COLORS.blue,
          backgroundColor: COLORS.panelHover, opacity: 0.3,
        }} />
      ) : null}
      {brush.state.active ? (() => {
        const axis = config.brushAxis ?? 'x';
        const lo = Math.min(brush.state.startPx, brush.state.endPx);
        const hi = Math.max(brush.state.startPx, brush.state.endPx);
        if (axis === 'x') {
          return (
            <Box style={{
              position: 'absolute', left: lo, top: plot.y, width: hi - lo, height: plot.h,
              borderLeftWidth: 1, borderRightWidth: 1, borderColor: COLORS.orange,
              backgroundColor: COLORS.orangeDeep, opacity: 0.35,
            }} />
          );
        }
        return (
          <Box style={{
            position: 'absolute', left: plot.x, top: lo, width: plot.w, height: hi - lo,
            borderTopWidth: 1, borderBottomWidth: 1, borderColor: COLORS.orange,
            backgroundColor: COLORS.orangeDeep, opacity: 0.35,
          }} />
        );
      })() : null}
      {crosshair.state.visible ? (
        <>
          <Box style={{ position: 'absolute', left: crosshair.state.px, top: plot.y, width: 1, height: plot.h, backgroundColor: COLORS.blue, opacity: 0.6 }} />
          <Box style={{ position: 'absolute', left: plot.x, top: crosshair.state.py, width: plot.w, height: 1, backgroundColor: COLORS.blue, opacity: 0.4 }} />
        </>
      ) : null}
    </>
  );
}
