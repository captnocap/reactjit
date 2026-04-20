const React: any = require('react');
import { Box, Col, Text, TextInput } from '../runtime/primitives';

const SAMPLE = 'jumpy pigs qq gg yy — O S M W';

export default function TextChopTest() {
  return (
    <Box style={{ width: '100%', height: '100%', backgroundColor: '#0b1220', padding: 40, gap: 32 }}>
      <Col style={{ gap: 6 }}>
        <Text fontSize={10} color="#64748b">Text node (reference)</Text>
        <Box style={{ backgroundColor: '#111827', padding: 8, borderRadius: 6 }}>
          <Text fontSize={16} color="#f8fafc">{SAMPLE}</Text>
        </Box>
      </Col>

      <Col style={{ gap: 6 }}>
        <Text fontSize={10} color="#64748b">TextInput (placeholder, auto-height)</Text>
        <TextInput
          placeholder={SAMPLE}
          fontSize={16}
          color="#f8fafc"
          style={{ backgroundColor: '#111827', padding: 8, borderRadius: 6 }}
        />
      </Col>

      <Col style={{ gap: 6 }}>
        <Text fontSize={10} color="#64748b">TextInput (placeholder, height: 80)</Text>
        <TextInput
          placeholder={SAMPLE}
          fontSize={16}
          color="#f8fafc"
          style={{ height: 80, backgroundColor: '#111827', padding: 8, borderRadius: 6 }}
        />
      </Col>
    </Box>
  );
}
