import { Col, Text } from '../../../../runtime/primitives';

export function IntentList({ items }: { items: string[] }) {
  return (
    <Col style={{ gap: 4 }}>
      {items.map((it, i) => (
        <Text key={i} style={{ fontSize: 14, color: '#cbd5e1' }}>{`• ${it}`}</Text>
      ))}
    </Col>
  );
}
