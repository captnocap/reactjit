import { Box, Row, Text } from '../../../../runtime/primitives';
import { CHAT_CARD } from './tokens';

export function StuckAlert({ label }: { label: string }) {
  return (
    <Box style={{ paddingLeft: 6, paddingRight: 6, paddingTop: 3, paddingBottom: 3, backgroundColor: '#3d2a17', borderRadius: 3 }}>
      <Row style={{ alignItems: 'center', gap: 4 }}>
        <Text style={{ fontFamily: 'monospace', fontSize: 8, color: CHAT_CARD.orange }}>!</Text>
        <Text style={{ fontFamily: 'monospace', fontSize: 8, fontWeight: 'bold', color: CHAT_CARD.orange }}>{label}</Text>
      </Row>
    </Box>
  );
}

