import { Col } from '../../../../runtime/primitives';

export function IntentCard({ children }: { children?: any }) {
  return (
    <Col style={{
      gap: 8,
      padding: 12,
      backgroundColor: '#1e293b',
      borderRadius: 8,
      borderWidth: 1,
      borderColor: '#334155',
    }}>
      {children}
    </Col>
  );
}
