const React: any = require('react');
const { useState } = React;

import { Col, Row, Text, TextArea } from '../../../../runtime/primitives';
import { COLORS } from '../../theme';
import { decodeJwtToken, useJWT } from '../../lib/crypto/jwt';
import { Banner, Card, Field } from './crypto-ui';

const HEADER_DEFAULT = JSON.stringify({ alg: 'HS256', typ: 'JWT', kid: 'sweatshop' }, null, 2);
const PAYLOAD_DEFAULT = JSON.stringify({ sub: 'user-123', aud: 'sweatshop', iat: Math.floor(Date.now() / 1000) }, null, 2);

export function JWTTab() {
  const [header, setHeader] = useState(HEADER_DEFAULT);
  const [payload, setPayload] = useState(PAYLOAD_DEFAULT);
  const [secret, setSecret] = useState('sweatshop-secret');
  const [keyId, setKeyId] = useState('sweatshop');
  const state = useJWT(header, payload, secret, keyId);
  const decoded = decodeJwtToken(state.token);

  return (
    <Col style={{ gap: 12 }}>
      <Banner {...state} />
      <Card title="JWT builder" subtitle="Edit header and payload JSON, then sign and verify with a key id and secret.">
        <Row style={{ gap: 12, flexWrap: 'wrap' }}>
          <Field label="Secret" value={secret} onChange={setSecret} style={{ flexGrow: 1, flexBasis: 0, minWidth: 220 }} />
          <Field label="Key ID" value={keyId} onChange={setKeyId} style={{ width: 180 }} />
        </Row>
        <Row style={{ gap: 12, alignItems: 'stretch', flexWrap: 'wrap' }}>
          <Col style={{ flexGrow: 1, flexBasis: 0, minWidth: 260, gap: 4 }}>
            <Text fontSize={9} color={COLORS.textDim} style={{ letterSpacing: 0.5, fontWeight: 'bold' }}>HEADER</Text>
            <TextArea value={header} onChange={setHeader} fontSize={10} color={COLORS.textBright} style={{ minHeight: 150, padding: 10, borderRadius: 12, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.panelBg, fontFamily: 'monospace' }} />
          </Col>
          <Col style={{ flexGrow: 1, flexBasis: 0, minWidth: 260, gap: 4 }}>
            <Text fontSize={9} color={COLORS.textDim} style={{ letterSpacing: 0.5, fontWeight: 'bold' }}>PAYLOAD</Text>
            <TextArea value={payload} onChange={setPayload} fontSize={10} color={COLORS.textBright} style={{ minHeight: 150, padding: 10, borderRadius: 12, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.panelBg, fontFamily: 'monospace' }} />
          </Col>
        </Row>
      </Card>

      <Row style={{ gap: 12, alignItems: 'stretch', flexWrap: 'wrap' }}>
        <Card title="Signed token" subtitle={state.pending ? 'Signing...' : 'Host result'} style={{ flexGrow: 1, flexBasis: 0, minWidth: 260 }}>
          <Text fontSize={10} color={COLORS.textBright} style={{ fontFamily: 'monospace' }}>{state.token || '—'}</Text>
          <Text fontSize={9} color={COLORS.textDim}>verified: {state.verified === null ? '—' : state.verified ? 'true' : 'false'}</Text>
        </Card>
        <Card title="Decoded claims" subtitle="Pure parsing of the current token, no host required." style={{ flexGrow: 1, flexBasis: 0, minWidth: 260 }}>
          <Text fontSize={9} color={COLORS.textDim}>header</Text>
          <Text fontSize={10} color={COLORS.textBright} style={{ fontFamily: 'monospace' }}>{JSON.stringify(decoded.header || state.header || {}, null, 2)}</Text>
          <Text fontSize={9} color={COLORS.textDim}>payload</Text>
          <Text fontSize={10} color={COLORS.textBright} style={{ fontFamily: 'monospace' }}>{JSON.stringify(decoded.payload || state.payload || {}, null, 2)}</Text>
        </Card>
      </Row>
    </Col>
  );
}
