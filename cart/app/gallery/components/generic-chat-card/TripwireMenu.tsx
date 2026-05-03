import { Box, Col, Row, Text } from '@reactjit/runtime/primitives';
import { Check, Circle } from '@reactjit/runtime/icons/icons';
import { Icon } from '../../../sweatshop/components/icons';
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
        backgroundColor: '#14100d',
        borderWidth: 1,
        borderColor: '#8a7fd4',
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
            backgroundColor: '#1a1511',
            borderBottomWidth: 1,
            borderColor: '#8a7fd4',
            borderRadius: 3,
          }}
        >
          <Text style={{ fontFamily: 'monospace', fontSize: 8, fontWeight: 'bold', color: '#d48aa7' }}>TAG PATHOLOGY</Text>
        </Box>
        <Box style={{ paddingLeft: 9, paddingRight: 9, paddingTop: 6, paddingBottom: 6, borderBottomWidth: 1, borderColor: '#8a7fd4' }}>
          <Text style={{ fontFamily: 'monospace', fontSize: 8, color: '#d48aa7' }}>{selected}</Text>
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
              backgroundColor: index === 0 ? '#1a1511' : '#14100d',
              borderRadius: 3,
            }}
          >
            <Box style={{ width: 8, alignItems: 'center', justifyContent: 'center' }}>
              <Icon icon={index === 0 ? Check : Circle} size={8} color={index === 0 ? CHAT_CARD.pink : CHAT_CARD.faint} strokeWidth={2.4} />
            </Box>
            <Text style={{ fontFamily: 'monospace', fontSize: 8, color: index === 0 ? CHAT_CARD.text : CHAT_CARD.muted }}>{option}</Text>
          </Row>
        ))}
      </Col>
    </Box>
  );
}
