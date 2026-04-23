const React: any = require('react');
const { useCallback } = React;

import { Box, Effect } from '../../../../runtime/primitives';
import { COLORS } from '../../theme';

export function Waveform(props: { samples: Float32Array | null; width?: number; height?: number }) {
  const { samples, width = 512, height = 120 } = props;

  const onRender = useCallback((e: any) => {
    e.clearColor(0.02, 0.02, 0.04, 1);
    if (!samples || samples.length === 0) {
      // Draw center line
      const mid = Math.floor(e.height / 2);
      for (let x = 0; x < e.width; x++) {
        e.setPixelRaw(x, mid, 40, 40, 60, 255);
      }
      return;
    }

    const mid = e.height / 2;
    const step = samples.length / e.width;

    for (let x = 0; x < e.width; x++) {
      const idx = Math.floor(x * step);
      const sample = Math.max(-1, Math.min(1, samples[idx]));
      const y = Math.floor(mid - sample * mid * 0.9);
      const intensity = Math.min(255, Math.floor(80 + Math.abs(sample) * 175));
      e.setPixelRaw(x, y, intensity, intensity, 255, 255);
      // Fill from center to peak for solid waveform look
      const centerY = Math.floor(mid);
      const targetY = Math.floor(y);
      const startY = Math.min(centerY, targetY);
      const endY = Math.max(centerY, targetY);
      for (let fy = startY; fy <= endY; fy++) {
        e.setPixelRaw(x, fy, intensity * 0.4, intensity * 0.5, 255, 120);
      }
    }
  }, [samples]);

  return (
    <Box style={{ width, height, borderRadius: 6, overflow: 'hidden', borderWidth: 1, borderColor: COLORS.border }}>
      <Effect onRender={onRender} style={{ width: '100%', height: '100%' }} />
    </Box>
  );
}
