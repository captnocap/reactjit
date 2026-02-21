/**
 * Simplified grid-based flexbox layout engine.
 *
 * Operates on the reconciler's Instance tree and computes
 * { x, y, w, h } in integer coordinates. Works for both
 * character grids (CC, Neovim) and pixel grids (Hammerspoon, AwesomeWM).
 *
 * Supports: width, height (absolute or %), flexDirection, flexGrow,
 * padding, gap, and pass-through of style props (backgroundColor, color).
 */

import type { Instance } from '@reactjit/native';

export interface LayoutNode {
  id: number;
  type: string;
  x: number;
  y: number;
  w: number;
  h: number;
  text?: string;
  style: Record<string, any>;
  children: LayoutNode[];
}

export interface LayoutOptions {
  /** Starting coordinate (0 for pixel targets, 1 for 1-based char grids like CC). Default 0. */
  coordBase?: number;
}

/** Resolve a dimension value (number, "50%", etc.) against a parent size. */
function resolveDim(value: any, parentSize: number): number | null {
  if (value == null) return null;
  if (typeof value === 'number') return Math.round(value);
  if (typeof value === 'string' && value.endsWith('%')) {
    const pct = parseFloat(value) / 100;
    return Math.round(parentSize * pct);
  }
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? null : parsed;
}

/** Get text content from an Instance (looks at children for text nodes). */
function getTextContent(instance: Instance): string | undefined {
  if ((instance as any).text != null) return String((instance as any).text);
  for (const child of instance.children) {
    // Match __TEXT__ typed nodes or TextInstance objects (which have text but no type)
    if ((child as any).text != null) {
      return String((child as any).text);
    }
  }
  return undefined;
}

/** Extract padding from style, returns all 4 sides. */
function getPadding(style: Record<string, any>): { t: number; r: number; b: number; l: number } {
  const p = Math.round(Number(style.padding) || 0);
  return {
    t: Math.round(Number(style.paddingTop) || p),
    r: Math.round(Number(style.paddingRight) || p),
    b: Math.round(Number(style.paddingBottom) || p),
    l: Math.round(Number(style.paddingLeft) || p),
  };
}

/**
 * Estimate the intrinsic (content-based) size of an Instance along an axis.
 * Used for auto-sizing children without explicit dimensions or flexGrow.
 *
 * For text/leaf nodes: 1 row/col.
 * For containers: sum (column) or max (row) of children's intrinsic sizes + padding + gaps.
 */
function estimateIntrinsicMain(instance: Instance, axis: 'row' | 'column'): number {
  const style = instance.props?.style || {};
  const pad = getPadding(style);
  const padMain = axis === 'column' ? pad.t + pad.b : pad.l + pad.r;

  // Text/leaf nodes: 1 content unit + padding
  const type = instance.type;
  if (type === 'Text' || type === 'text' || type === '__TEXT__') {
    return padMain + 1;
  }

  const layoutChildren = instance.children.filter(
    (c): c is Instance => 'type' in c && (c as any).type !== '__TEXT__'
  );

  if (layoutChildren.length === 0) {
    return padMain + 1;
  }

  const direction: string = style.flexDirection || 'column';
  const gap = Math.round(Number(style.gap) || 0);
  const totalGaps = Math.max(0, layoutChildren.length - 1) * gap;

  // Determine the axis this container lays out on
  const isRow = direction === 'row';

  if ((axis === 'column' && !isRow) || (axis === 'row' && isRow)) {
    // Same axis as parent: sum children's sizes along this axis
    let sum = 0;
    for (const child of layoutChildren) {
      const cs = child.props?.style || {};
      const explicit = axis === 'column'
        ? (cs.height != null ? Math.round(Number(cs.height) || 0) : null)
        : (cs.width != null ? Math.round(Number(cs.width) || 0) : null);
      if (explicit != null && typeof cs[axis === 'column' ? 'height' : 'width'] === 'number') {
        sum += explicit;
      } else {
        sum += estimateIntrinsicMain(child, axis);
      }
    }
    return padMain + sum + totalGaps;
  } else {
    // Cross axis: max of children's sizes
    let max = 0;
    for (const child of layoutChildren) {
      const size = estimateIntrinsicMain(child, axis);
      if (size > max) max = size;
    }
    return padMain + max;
  }
}

/**
 * Compute layout for an Instance tree within a given grid.
 *
 * @param root The root Instance from the reconciler
 * @param gridW Grid width (characters or pixels)
 * @param gridH Grid height (characters or pixels)
 * @param options Layout options (coordBase, etc.)
 * @returns Root LayoutNode with computed positions
 */
export function computeLayout(
  root: Instance,
  gridW: number,
  gridH: number,
  options?: LayoutOptions,
): LayoutNode {
  const base = options?.coordBase ?? 0;
  return layoutNode(root, base, base, gridW, gridH);
}

function layoutNode(
  instance: Instance,
  x: number,
  y: number,
  availW: number,
  availH: number,
): LayoutNode {
  const style = instance.props?.style || {};

  // Resolve own dimensions
  const explicitW = resolveDim(style.width, availW);
  const explicitH = resolveDim(style.height, availH);
  const w = Math.min(explicitW ?? availW, availW);
  const h = Math.min(explicitH ?? availH, availH);

  const pad = getPadding(style);
  const innerX = x + pad.l;
  const innerY = y + pad.t;
  const innerW = Math.max(0, w - pad.l - pad.r);
  const innerH = Math.max(0, h - pad.t - pad.b);

  // Text nodes are leaf nodes
  const text = getTextContent(instance);
  if (instance.type === 'Text' || instance.type === 'text' || instance.type === '__TEXT__') {
    return {
      id: instance.id,
      type: instance.type,
      x, y, w, h,
      text: text?.slice(0, w),
      style,
      children: [],
    };
  }

  // Layout children with flexbox
  const direction: string = style.flexDirection || 'column';
  const isRow = direction === 'row';
  const gap = Math.round(Number(style.gap) || 0);

  const childInstances = instance.children.filter(
    (c): c is Instance => 'type' in c && (c as any).type !== '__TEXT__'
  );

  // First pass: measure fixed-size children, collect flex growers
  interface ChildMeasure {
    instance: Instance;
    fixedMain: number | null;
    fixedCross: number | null;
    autoMain: number;  // estimated intrinsic size for unsized children
    flexGrow: number;
  }

  const measures: ChildMeasure[] = [];
  let totalFixed = 0;
  let totalAuto = 0;
  let totalGrow = 0;
  const totalGaps = Math.max(0, childInstances.length - 1) * gap;

  const mainAvail = isRow ? innerW : innerH;
  const crossAvail = isRow ? innerH : innerW;

  for (const child of childInstances) {
    const cs = child.props?.style || {};
    const grow = Number(cs.flexGrow) || 0;
    const fixedMain = resolveDim(isRow ? cs.width : cs.height, mainAvail);
    const fixedCross = resolveDim(isRow ? cs.height : cs.width, crossAvail);

    // Estimate intrinsic size for unsized children
    const autoMain = estimateIntrinsicMain(child, isRow ? 'row' : 'column');

    measures.push({ instance: child, fixedMain, fixedCross, autoMain, flexGrow: grow });

    if (fixedMain != null) {
      totalFixed += fixedMain;
    } else if (grow === 0) {
      totalAuto += autoMain;
    }
    totalGrow += grow;
  }

  // Distribute remaining space: auto-sized children get their intrinsic size,
  // flex-grow children split whatever remains after fixed + auto + gaps
  const remainingForGrow = Math.max(0, mainAvail - totalFixed - totalAuto - totalGaps);
  const childLayouts: LayoutNode[] = [];
  let cursor = 0;

  for (const m of measures) {
    let childMain: number;
    if (m.fixedMain != null) {
      childMain = m.fixedMain;
    } else if (m.flexGrow > 0 && totalGrow > 0) {
      childMain = Math.round((m.flexGrow / totalGrow) * remainingForGrow);
    } else {
      childMain = m.autoMain;
    }

    const childCross = m.fixedCross ?? crossAvail;

    const cx = isRow ? innerX + cursor : innerX;
    const cy = isRow ? innerY : innerY + cursor;
    const cw = isRow ? childMain : Math.min(childCross, innerW);
    const ch = isRow ? Math.min(childCross, innerH) : childMain;

    if (cw > 0 && ch > 0) {
      childLayouts.push(layoutNode(m.instance, cx, cy, cw, ch));
    }

    cursor += childMain + gap;
  }

  return {
    id: instance.id,
    type: instance.type,
    x, y, w, h,
    text,
    style,
    children: childLayouts,
  };
}
