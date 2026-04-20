import { Col, Row, Text } from '../../../runtime/primitives';
import { InspectorNode } from '../types';
import { COLORS } from '../constants';
import SectionHeader from '../components/SectionHeader';
import Badge from '../components/Badge';

export default function EventList({ node }: { node: InspectorNode }) {
  const handlers = node.handlers || [];
  return (
    <Col style={{ gap: 6 }}>
      <SectionHeader title="Event Handlers" />
      <Col style={{ gap: 4 }}>
        {handlers.length === 0 ? (
          <Text fontSize={10} color={COLORS.textDim} style={{ padding: 8 }}>
            No handlers registered on this node.
          </Text>
        ) : (
          handlers.map((h) => (
            <Row
              key={h}
              style={{
                backgroundColor: COLORS.bg,
                borderRadius: 6,
                padding: 8,
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <Badge text={h} color={COLORS.purple} />
              <Text fontSize={9} color={COLORS.textDim}>function</Text>
            </Row>
          ))
        )}
      </Col>
    </Col>
  );
}
