import { Box } from '@reactjit/runtime/primitives';
import { clamp01, type GutterEdge, useEasedGate } from './gutterMotion';

export type ConditionalGutterProps = {
  edge: GutterEdge;
  open: boolean;
  size: number;
  durationMs?: number;
  children: any;
};

function isHorizontal(edge: GutterEdge): boolean {
  return edge === 'left' || edge === 'right';
}

function innerPosition(edge: GutterEdge): Record<string, any> {
  switch (edge) {
    case 'right':
      return { right: 0, top: 0 };
    case 'bottom':
      return { left: 0, bottom: 0 };
    case 'top':
      return { left: 0, top: 0 };
    case 'left':
    default:
      return { left: 0, top: 0 };
  }
}

function entryTransform(edge: GutterEdge, progress: number): Record<string, number> {
  const drift = Math.round((1 - clamp01(progress)) * 18);
  switch (edge) {
    case 'right':
      return { translateX: drift };
    case 'bottom':
      return { translateY: drift };
    case 'top':
      return { translateY: -drift };
    case 'left':
    default:
      return { translateX: -drift };
  }
}

export function ConditionalGutter({ edge, open, size, durationMs, children }: ConditionalGutterProps) {
  const progress = clamp01(useEasedGate(open, durationMs));
  const axisHorizontal = isHorizontal(edge);
  const visibleSize = Math.round(size * progress);
  const opacity = progress < 0.02 ? 0 : Math.min(1, 0.22 + progress * 0.78);

  return (
    <Box
      style={{
        position: 'relative',
        width: axisHorizontal ? visibleSize : '100%',
        height: axisHorizontal ? '100%' : visibleSize,
        flexShrink: 0,
        overflow: 'hidden',
      }}
    >
      <Box
        style={{
          position: 'absolute',
          ...innerPosition(edge),
          width: axisHorizontal ? size : '100%',
          height: axisHorizontal ? '100%' : size,
          opacity,
          transform: entryTransform(edge, progress),
        }}
      >
        {children}
      </Box>
    </Box>
  );
}

