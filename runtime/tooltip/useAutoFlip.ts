import { useMemo } from 'react';

type TooltipSide = 'top' | 'bottom' | 'left' | 'right';

export type TooltipRect = { x: number; y: number; width: number; height: number };
export type TooltipViewport = { width: number; height: number };

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function chooseSide(anchor: TooltipRect, side: TooltipSide, tip: { width: number; height: number }, viewport: TooltipViewport, gap: number): TooltipSide {
  const space = {
    top: anchor.y - gap,
    bottom: viewport.height - (anchor.y + anchor.height) - gap,
    left: anchor.x - gap,
    right: viewport.width - (anchor.x + anchor.width) - gap,
  };
  const fits = (picked: TooltipSide) => {
    if (picked === 'top') return space.top >= tip.height;
    if (picked === 'bottom') return space.bottom >= tip.height;
    if (picked === 'left') return space.left >= tip.width;
    return space.right >= tip.width;
  };
  if (fits(side)) return side;
  const opposite: Record<TooltipSide, TooltipSide> = { top: 'bottom', bottom: 'top', left: 'right', right: 'left' };
  if (fits(opposite[side])) return opposite[side];
  return (['top', 'bottom', 'left', 'right'] as TooltipSide[]).sort((a, b) => {
    const score = (picked: TooltipSide) => {
      if (picked === 'top') return space.top - tip.height;
      if (picked === 'bottom') return space.bottom - tip.height;
      if (picked === 'left') return space.left - tip.width;
      return space.right - tip.width;
    };
    return score(b) - score(a);
  })[0];
}

export function useAutoFlip(props: {
  anchor: TooltipRect | null;
  side?: TooltipSide;
  size: { width: number; height: number };
  viewport: TooltipViewport;
  gap?: number;
  padding?: number;
}) {
  return useMemo(() => {
    const anchor = props.anchor;
    const viewport = props.viewport;
    const gap = props.gap ?? 8;
    const padding = props.padding ?? 8;
    const side = props.side || 'top';
    const size = props.size;

    if (!anchor || viewport.width <= 0 || viewport.height <= 0) {
      return {
        side,
        left: padding,
        top: padding,
        maxWidth: Math.max(0, viewport.width - padding * 2),
      };
    }

    const actualSide = chooseSide(anchor, side, size, viewport, gap);
    let left = anchor.x;
    let top = anchor.y;

    if (actualSide === 'top') {
      left = anchor.x + anchor.width / 2 - size.width / 2;
      top = anchor.y - size.height - gap;
    } else if (actualSide === 'bottom') {
      left = anchor.x + anchor.width / 2 - size.width / 2;
      top = anchor.y + anchor.height + gap;
    } else if (actualSide === 'left') {
      left = anchor.x - size.width - gap;
      top = anchor.y + anchor.height / 2 - size.height / 2;
    } else {
      left = anchor.x + anchor.width + gap;
      top = anchor.y + anchor.height / 2 - size.height / 2;
    }

    left = clamp(left, padding, Math.max(padding, viewport.width - size.width - padding));
    top = clamp(top, padding, Math.max(padding, viewport.height - size.height - padding));

    return {
      side: actualSide,
      left,
      top,
      maxWidth: Math.max(0, viewport.width - padding * 2),
    };
  }, [props.anchor, props.gap, props.padding, props.side, props.size, props.viewport.height, props.viewport.width]);
}
