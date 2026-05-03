import { Canvas } from '@reactjit/runtime/primitives';
import { DEX_COLORS } from '../dex-frame/DexFrame';

export type DexCanvasRingProps = {
  x?: number;
  y?: number;
  r?: number;
  hot?: boolean;
  dashed?: boolean;
};

function circlePath(cx: number, cy: number, r: number) {
  return `M ${cx - r} ${cy} A ${r} ${r} 0 1 1 ${cx + r} ${cy} A ${r} ${r} 0 1 1 ${cx - r} ${cy}`;
}

export function DexCanvasRing({
  x = 160,
  y = 120,
  r = 80,
  hot = false,
  dashed = false,
}: DexCanvasRingProps) {
  return (
    <Canvas.Path
      d={circlePath(x, y, r)}
      fill="none"
      stroke={hot ? DEX_COLORS.ruleBright : DEX_COLORS.rule}
      strokeWidth={1}
      strokeDasharray={dashed ? '3,3' : undefined}
    />
  );
}
