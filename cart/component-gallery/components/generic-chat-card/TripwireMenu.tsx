import { Box, Col, Row, Text } from '../../../../runtime/primitives';
import { CHAT_CARD } from './tokens';

const OPTIONS = ['mirror-universe', 'quick-hack', 'trust-decay'];

export type SignalAnchor = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type SignalHighlightProps = {
  id: string;
  selected: string;
  anchor: SignalAnchor;
};

export function TripwireMenu({ selected = 'runtime counterpart' }: { selected?: string }) {
  return (
    <Box
      style={{
        width: 194,
        backgroundColor: '#1d1b27',
        borderWidth: 1,
        borderColor: '#c55adb',
        borderRadius: 5,
      }}
    >
      <Col style={{ gap: 1, padding: 4 }}>
        <Box
          style={{
            paddingLeft: 8,
            paddingRight: 8,
            paddingTop: 7,
            paddingBottom: 7,
            backgroundColor: '#2a203a',
            borderBottomWidth: 1,
            borderColor: '#4d315f',
            borderRadius: 3,
          }}
        >
          <Text style={{ fontFamily: 'monospace', fontSize: 8, fontWeight: 'bold', color: '#f0a6ff' }}>TAG PATHOLOGY</Text>
        </Box>
        <Box style={{ paddingLeft: 9, paddingRight: 9, paddingTop: 6, paddingBottom: 6, borderBottomWidth: 1, borderColor: '#4d315f' }}>
          <Text style={{ fontFamily: 'monospace', fontSize: 8, color: '#f7c3ff' }}>{selected}</Text>
        </Box>
        {OPTIONS.map((option, index) => (
          <Row
            key={option}
            style={{
              gap: 7,
              alignItems: 'center',
              paddingLeft: 9,
              paddingRight: 9,
              paddingTop: 7,
              paddingBottom: 7,
              backgroundColor: index === 0 ? '#352041' : '#1d1b27',
              borderRadius: 3,
            }}
          >
            <Text style={{ width: 8, fontFamily: 'monospace', fontSize: 8, color: index === 0 ? CHAT_CARD.pink : CHAT_CARD.faint }}>
              {index === 0 ? '*' : 'o'}
            </Text>
            <Text style={{ fontFamily: 'monospace', fontSize: 8, color: index === 0 ? CHAT_CARD.text : CHAT_CARD.muted }}>{option}</Text>
          </Row>
        ))}
      </Col>
    </Box>
  );
}
