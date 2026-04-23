const React: any = require('react');
const { useMemo, useState } = React;

import { Box, Col, Row, Text } from '../../../../runtime/primitives';
import { COLORS } from '../../theme';
import { toBase64, toHex, utf8ToBytes } from '../../lib/crypto/encoding';
import { type HashAlgorithm, useHash } from '../../lib/crypto/hash';
import { Banner, Card, Chip, Field } from './crypto-ui';

const ALGORITHMS: Array<{ id: HashAlgorithm; label: string; desc: string }> = [
  { id: 'sha256', label: 'SHA-256', desc: 'Standard digest' },
  { id: 'sha512', label: 'SHA-512', desc: 'Long digest' },
  { id: 'blake3', label: 'BLAKE3', desc: 'Fast modern hash' },
  { id: 'md5', label: 'MD5', desc: 'Legacy compatibility' },
];

export function HashTab() {
  const [algorithm, setAlgorithm] = useState<HashAlgorithm>('sha256');
  const [input, setInput] = useState('hello world');
  const state = useHash(input, algorithm);
  const inputBytes = useMemo(() => utf8ToBytes(input), [input]);

  return (
    <Col style={{ gap: 12 }}>
      <Banner {...state} />
      <Card title="Hash input" subtitle="Type text and pick an algorithm. When host bindings land, the digest updates live.">
        <Field label="Input" value={input} onChange={setInput} multiline={true} rows={4} placeholder="message to hash" />
        <Row style={{ gap: 6, flexWrap: 'wrap' }}>
          {ALGORITHMS.map((entry) => <Chip key={entry.id} label={entry.label} active={algorithm === entry.id} onPress={() => setAlgorithm(entry.id)} />)}
        </Row>
      </Card>

      <Row style={{ gap: 12, alignItems: 'stretch', flexWrap: 'wrap' }}>
        <Card title="Digest" subtitle={state.pending ? 'Computing...' : 'Host result'} style={{ flexGrow: 1, flexBasis: 0, minWidth: 240 }}>
          <Box style={{ gap: 6 }}>
            <Text fontSize={9} color={COLORS.textDim} style={{ letterSpacing: 0.5, fontWeight: 'bold' }}>HEX</Text>
            <Text fontSize={10} color={COLORS.textBright} style={{ fontFamily: 'monospace' }}>{state.digest?.hex || '—'}</Text>
          </Box>
          <Box style={{ gap: 6 }}>
            <Text fontSize={9} color={COLORS.textDim} style={{ letterSpacing: 0.5, fontWeight: 'bold' }}>BASE64</Text>
            <Text fontSize={10} color={COLORS.textBright} style={{ fontFamily: 'monospace' }}>{state.digest?.base64 || '—'}</Text>
          </Box>
        </Card>

        <Card title="Input bytes" subtitle="Pure JS encoding helpers, no host needed." style={{ flexGrow: 1, flexBasis: 0, minWidth: 240 }}>
          <Box style={{ gap: 6 }}>
            <Text fontSize={9} color={COLORS.textDim} style={{ letterSpacing: 0.5, fontWeight: 'bold' }}>UTF-8 HEX</Text>
            <Text fontSize={10} color={COLORS.textBright} style={{ fontFamily: 'monospace' }}>{toHex(inputBytes) || '—'}</Text>
          </Box>
          <Box style={{ gap: 6 }}>
            <Text fontSize={9} color={COLORS.textDim} style={{ letterSpacing: 0.5, fontWeight: 'bold' }}>UTF-8 BASE64</Text>
            <Text fontSize={10} color={COLORS.textBright} style={{ fontFamily: 'monospace' }}>{toBase64(inputBytes) || '—'}</Text>
          </Box>
        </Card>
      </Row>
    </Col>
  );
}
