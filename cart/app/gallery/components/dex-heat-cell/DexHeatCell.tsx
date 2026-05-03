import { Box } from '@reactjit/runtime/primitives';
import { DEX_COLORS } from '../dex-frame/DexFrame';

export type DexHeatCellProps = {
  value?: number;
  size?: number;
  selected?: boolean;
};

function heatColor(value: number): string {
  if (value > 0.76) return DEX_COLORS.accent;
  if (value > 0.62) return DEX_COLORS.warn;
  if (value > 0.48) return '#8a4a20';
  if (value > 0.28) return '#1a1511';
  return DEX_COLORS.bg1;
}

export function DexHeatCell({ value = 0.72, size = 20, selected = false }: DexHeatCellProps) {
  return (
    <Box
      style={{
        width: size,
        height: size,
        backgroundColor: heatColor(value),
        borderWidth: selected ? 1 : 0,
        borderColor: DEX_COLORS.ink,
        opacity: 0.45 + Math.min(1, Math.max(0, value)) * 0.55,
      }}
    />
  );
}
