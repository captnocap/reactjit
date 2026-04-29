import { Canvas } from '@reactjit/runtime/primitives';
import { DEX_COLORS } from '../dex-frame/DexFrame';

export type DexCanvasEdgeProps = {
  x1?: number;
  y1?: number;
  x2?: number;
  y2?: number;
  weight?: number;
  hot?: boolean;
};

export function DexCanvasEdge({
  x1 = 20,
  y1 = 20,
  x2 = 160,
  y2 = 80,
  weight = 0.5,
  hot = false,
}: DexCanvasEdgeProps) {
  return (
    <Canvas.Path
      d={`M ${x1} ${y1} L ${x2} ${y2}`}
      stroke={hot ? DEX_COLORS.accent : DEX_COLORS.ruleBright}
      strokeWidth={0.5 + weight * 2}
      opacity={hot ? 0.9 : 0.45}
    />
  );
}
