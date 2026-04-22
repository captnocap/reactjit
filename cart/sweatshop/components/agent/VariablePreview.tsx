const React: any = require('react');
import { Col, Row, Text } from '../../../../runtime/primitives';
import { COLORS } from '../../theme';

export function VariablePreview(props: { results: any[] }) {
  return (
    <Col style={{ gap: 4, padding: 8, borderRadius: 8, backgroundColor: '#0f1520' }}>
      <Text fontSize={9} color={COLORS.textDim} style={{ fontWeight: 'bold' }}>Variable Preview</Text>
      {props.results.map((r: any) => (
        <Row key={r.variable} style={{ gap: 6, alignItems: 'center' }}>
          <Text fontSize={9} color={COLORS.blue} style={{ fontFamily: 'monospace' }}>{'{{' + r.variable + '}'}</Text>
          {r.data !== undefined ? (
            <Text fontSize={9} color={COLORS.green}>{r.data}</Text>
          ) : (
            <Text fontSize={9} color={COLORS.red}>{r.error}</Text>
          )}
        </Row>
      ))}
    </Col>
  );
}
