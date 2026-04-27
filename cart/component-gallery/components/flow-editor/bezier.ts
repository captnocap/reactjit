// Bezier path helpers for FlowEditor edges. Pure functions, no React.

export type BezierResult = {
  d: string;
  c2x: number;
  c2y: number;
};

// Cubic with horizontal tangents that stays sane when the target is behind,
// above, or below the source. Forward connections (target right of source)
// scale offset with horizontal gap. Backward connections fall back to a
// vertical-distance heuristic so the curve bows around the tiles instead of
// cutting through them.
export function bezierFor(x1: number, y1: number, x2: number, y2: number): BezierResult {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const adx = Math.abs(dx);
  const ady = Math.abs(dy);
  const forward = Math.max(50, adx * 0.5);
  const backward = Math.max(80, ady * 0.5 + 60);
  const horiz = Math.min(240, dx >= 0 ? forward : backward);
  const c1x = x1 + horiz;
  const c2x = x2 - horiz;
  const d = `M ${x1.toFixed(1)} ${y1.toFixed(1)} C ${c1x.toFixed(1)} ${y1.toFixed(1)}, ${c2x.toFixed(1)} ${y2.toFixed(1)}, ${x2.toFixed(1)} ${y2.toFixed(1)}`;
  return { d, c2x, c2y: y2 };
}

// Builds a two-segment 'V' from the endpoint along the actual bezier tangent
// (direction from c2 → endpoint). Pass in the c2 control returned by bezierFor.
export function arrowHeadPath(x2: number, y2: number, fromX: number, fromY: number, len = 10, spread = 0.5): string {
  const ang = Math.atan2(y2 - fromY, x2 - fromX);
  const ax = x2 - Math.cos(ang - spread) * len;
  const ay = y2 - Math.sin(ang - spread) * len;
  const bx = x2 - Math.cos(ang + spread) * len;
  const by = y2 - Math.sin(ang + spread) * len;
  return `M ${x2.toFixed(1)} ${y2.toFixed(1)} L ${ax.toFixed(1)} ${ay.toFixed(1)} M ${x2.toFixed(1)} ${y2.toFixed(1)} L ${bx.toFixed(1)} ${by.toFixed(1)}`;
}
