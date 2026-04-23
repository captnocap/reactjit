import { Box, Row, Text } from '../../../../runtime/primitives';
import { CHAT_CARD } from './tokens';

function clamp(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

export function ProgressMeter({ progress, label }: { progress: number; label: string }) {
  const fill = Math.round(clamp(progress) * 96);

  return (
    <Row style={{ alignItems: 'center', gap: 7 }}>
      <Box style={{ width: 96, height: 6, backgroundColor: '#333956', borderRadius: 99 }}>
        <Box style={{ width: fill, height: 6, backgroundColor: CHAT_CARD.orange, borderRadius: 99 }} />
      </Box>
      <Text style={{ fontFamily: 'monospace', fontSize: 8, fontWeight: 'bold', color: CHAT_CARD.orange }}>{label}</Text>
    </Row>
  );
}

