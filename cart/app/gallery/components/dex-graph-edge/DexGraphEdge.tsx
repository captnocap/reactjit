import { Graph } from '@reactjit/runtime/primitives';
import { DEX_COLORS } from '../dex-frame/DexFrame';

export type DexGraphEdgeProps = {
  x1?: number;
  y1?: number;
  x2?: number;
  y2?: number;
  weight?: number;
  hot?: boolean;
};

export function DexGraphEdge({
  x1 = 20,
  y1 = 20,
  x2 = 120,
  y2 = 70,
  weight = 0.7,
  hot = false,
}: DexGraphEdgeProps) {
  return (
    <Graph.Path
      d={`M ${x1} ${y1} L ${x2} ${y2}`}
      stroke={hot ? DEX_COLORS.accent : DEX_COLORS.ruleBright}
      strokeWidth={0.5 + weight * 2}
      opacity={hot ? 0.9 : 0.45}
    />
  );
}
