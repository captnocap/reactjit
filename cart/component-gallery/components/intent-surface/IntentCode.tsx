import { Box, Col, Row, Text } from '../../../../runtime/primitives';

export function IntentCode({ lang, children }: { lang?: string; children?: any }) {
  return (
    <Col style={{
      backgroundColor: '#0f172a',
      borderRadius: 6,
      borderWidth: 1,
      borderColor: '#1e293b',
      overflow: 'hidden',
    }}>
      {lang ? (
        <Row style={{
          paddingLeft: 12,
          paddingRight: 12,
          paddingTop: 4,
          paddingBottom: 4,
          backgroundColor: '#1e293b',
        }}>
          <Text style={{ fontSize: 10, color: '#94a3b8', fontFamily: 'monospace' }}>{lang}</Text>
        </Row>
      ) : null}
      <Box style={{ padding: 12 }}>
        <Text style={{
          fontSize: 13,
          color: '#e2e8f0',
          fontFamily: 'monospace',
          lineHeight: 1.5,
        }}>{children}</Text>
      </Box>
    </Col>
  );
}
