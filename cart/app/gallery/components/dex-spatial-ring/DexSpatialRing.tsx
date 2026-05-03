import { Graph } from '@reactjit/runtime/primitives';
import { DEX_COLORS } from '../dex-frame/DexFrame';

export type DexSpatialRingProps = {
  x?: number;
  y?: number;
  r?: number;
  hot?: boolean;
  dashed?: boolean;
};

function circlePath(cx: number, cy: number, r: number) {
  return `M ${cx - r} ${cy} A ${r} ${r} 0 1 1 ${cx + r} ${cy} A ${r} ${r} 0 1 1 ${cx - r} ${cy}`;
}

export function DexSpatialRing({
  x = 120,
  y = 90,
  r = 70,
  hot = false,
  dashed = false,
}: DexSpatialRingProps) {
  return (
    <Graph.Path
      d={circlePath(x, y, r)}
      fill="none"
      stroke={hot ? DEX_COLORS.ruleBright : DEX_COLORS.rule}
      strokeWidth={1}
      strokeDasharray={dashed ? '3,3' : undefined}
    />
  );
}
