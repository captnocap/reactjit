import { Graph } from '@reactjit/runtime/primitives';
import { DEX_COLORS } from '../dex-frame/DexFrame';

export type DexGraphNodeProps = {
  x?: number;
  y?: number;
  r?: number;
  color?: string;
  selected?: boolean;
};

function circlePath(cx: number, cy: number, r: number) {
  return `M ${cx - r} ${cy} A ${r} ${r} 0 1 1 ${cx + r} ${cy} A ${r} ${r} 0 1 1 ${cx - r} ${cy}`;
}

export function DexGraphNode({
  x = 80,
  y = 60,
  r = 14,
  color = DEX_COLORS.blue,
  selected = false,
}: DexGraphNodeProps) {
  return (
    <Graph.Path
      d={circlePath(x, y, r)}
      fill={selected ? DEX_COLORS.accent : color}
      stroke={DEX_COLORS.ink}
      strokeWidth={selected ? 1.5 : 1}
    />
  );
}
