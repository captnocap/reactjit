import { Box, Row } from '@reactjit/runtime/primitives';
import { DEX_COLORS } from '../dex-frame/DexFrame';

export type DexSparkHistogramProps = {
  bins?: number[];
  color?: string;
};

export function DexSparkHistogram({
  bins = [2, 5, 7, 3, 8, 4, 6, 9, 5, 2],
  color = DEX_COLORS.accent,
}: DexSparkHistogramProps) {
  const max = Math.max(...bins, 1);
  return (
    <Row style={{ height: 14, alignItems: 'flex-end', gap: 1 }}>
      {bins.map((bin, index) => (
        <Box
          key={index}
          style={{
            width: 3,
            height: 2 + (bin / max) * 12,
            backgroundColor: color,
            opacity: 0.35 + (bin / max) * 0.65,
          }}
        />
      ))}
    </Row>
  );
}
