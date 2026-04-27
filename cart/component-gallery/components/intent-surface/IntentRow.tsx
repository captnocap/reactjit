import { Row } from '../../../../runtime/primitives';

export function IntentRow({ children }: { children?: any }) {
  return (
    <Row style={{ gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
      {children}
    </Row>
  );
}
