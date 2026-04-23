const React: any = require('react');
const { useEffect, useState } = React;

import { Box, Row, Text } from '../../../../runtime/primitives';
import { COLORS } from '../../theme';

export function BeatIndicator(props: { beat: boolean; bpm: number; energy: number }) {
  const { beat, bpm, energy } = props;
  const [pulse, setPulse] = useState(0);

  useEffect(() => {
    if (beat) {
      setPulse(1);
      const t = setTimeout(() => setPulse(0), 150);
      return () => clearTimeout(t);
    }
  }, [beat]);

  return (
    <Row style={{ gap: 12, alignItems: 'center', padding: 8 }}>
      <Box
        style={{
          width: 24,
          height: 24,
          borderRadius: 12,
          backgroundColor: pulse ? COLORS.red : COLORS.grayChip,
          borderWidth: 2,
          borderColor: pulse ? COLORS.red : COLORS.border,
        }}
      />
      <Text fontSize={11} color={COLORS.text}>{bpm > 0 ? `${bpm} BPM` : '—'}</Text>
      <Box style={{ flexGrow: 1, height: 6, borderRadius: 3, backgroundColor: COLORS.grayChip, overflow: 'hidden' }}>
        <Box style={{ width: `${Math.min(100, energy * 100)}%`, height: '100%', backgroundColor: COLORS.blue, borderRadius: 3 }} />
      </Box>
    </Row>
  );
}
