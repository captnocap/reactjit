const React: any = require('react');

import { Box, Row, Text } from '../../../../runtime/primitives';
import { COLORS } from '../../theme';

export function Spectrum(props: {
  spectrum: Float32Array | null;
  barCount?: number;
  height?: number;
  logScale?: boolean;
}) {
  const { spectrum, barCount = 64, height = 120, logScale = true } = props;

  if (!spectrum || spectrum.length === 0) {
    return (
      <Box style={{ height, borderRadius: 6, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.panelAlt, alignItems: 'center', justifyContent: 'center' }}>
        <Text fontSize={10} color={COLORS.textDim}>No spectrum data</Text>
      </Box>
    );
  }

  const bars: number[] = [];
  const bins = spectrum.length;

  if (logScale) {
    // Log-spaced bin grouping
    for (let i = 0; i < barCount; i++) {
      const start = Math.floor(Math.pow(bins, i / barCount));
      const end = Math.floor(Math.pow(bins, (i + 1) / barCount));
      let sum = 0;
      let count = 0;
      for (let j = start; j < end && j < bins; j++) {
        sum += spectrum[j];
        count++;
      }
      const avg = count > 0 ? sum / count : 0;
      // dB-like scaling
      bars.push(Math.min(1, Math.max(0, 1 + Math.log10(Math.max(0.0001, avg)) / 3)));
    }
  } else {
    // Linear grouping
    const groupSize = Math.ceil(bins / barCount);
    for (let i = 0; i < barCount; i++) {
      let sum = 0;
      let count = 0;
      for (let j = i * groupSize; j < (i + 1) * groupSize && j < bins; j++) {
        sum += spectrum[j];
        count++;
      }
      const avg = count > 0 ? sum / count : 0;
      bars.push(Math.min(1, avg * 4));
    }
  }

  return (
    <Box style={{ height, borderRadius: 6, borderWidth: 1, borderColor: COLORS.border, backgroundColor: '#020205', padding: 4, flexDirection: 'row', alignItems: 'flex-end', gap: 1 }}>
      {bars.map((h, i) => (
        <Box
          key={i}
          style={{
            flexGrow: 1,
            height: Math.max(2, h * (height - 8)),
            backgroundColor: h > 0.7 ? COLORS.red : h > 0.4 ? COLORS.yellow : COLORS.blue,
            borderRadius: 1,
          }}
        />
      ))}
    </Box>
  );
}
