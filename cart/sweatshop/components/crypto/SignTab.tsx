const React: any = require('react');
const { useState } = React;

import { Col, Row, Text } from '../../../../runtime/primitives';
import { COLORS } from '../../theme';
import { type SigningAlgorithm, generateSigningKeys, useSign, useVerify } from '../../lib/crypto/sign';
import { Banner, Card, Chip, Field } from './crypto-ui';

const ALGORITHMS: Array<{ id: SigningAlgorithm; label: string }> = [
  { id: 'ed25519', label: 'Ed25519' },
  { id: 'rsa-pss', label: 'RSA-PSS' },
];

export function SignTab() {
  const [algorithm, setAlgorithm] = useState<SigningAlgorithm>('ed25519');
  const [message, setMessage] = useState('ReactJIT crypto panel');
  const [privateKey, setPrivateKey] = useState('');
  const [publicKey, setPublicKey] = useState('');
  const [loading, setLoading] = useState(false);
  const [localError, setLocalError] = useState('');
  const signState = useSign(privateKey, message, algorithm);
  const verifyState = useVerify(signState.signed?.message || message, signState.signed?.signature || '', signState.signed?.publicKey || publicKey, algorithm);

  async function onGenerate() {
    setLocalError('');
    setLoading(true);
    try {
      const keys = await generateSigningKeys(algorithm);
      if (!keys) {
        setPrivateKey('');
        setPublicKey('');
        setLocalError('host crypto bindings pending');
        return;
      }
      setPrivateKey(keys.privateKey);
      setPublicKey(keys.publicKey);
    } catch (err: any) {
      setLocalError(err?.message || String(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Col style={{ gap: 12 }}>
      <Banner {...signState} />
      {localError ? <Banner available={false} pending={false} banner="" error={localError} hostFns={signState.hostFns} /> : null}
      <Card title="Signing" subtitle="Generate a keypair, sign the message, and verify the signature when host bindings exist.">
        <Row style={{ gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
          {ALGORITHMS.map((entry) => <Chip key={entry.id} label={entry.label} active={algorithm === entry.id} onPress={() => setAlgorithm(entry.id)} />)}
          <Chip label={loading ? 'Generating...' : 'Generate keypair'} active={true} onPress={onGenerate} />
        </Row>
        <Field label="Message" value={message} onChange={setMessage} multiline={true} rows={4} placeholder="message to sign" />
      </Card>

      <Row style={{ gap: 12, alignItems: 'stretch', flexWrap: 'wrap' }}>
        <Card title="Keypair" subtitle="Generated keys stay in memory on this surface." style={{ flexGrow: 1, flexBasis: 0, minWidth: 240 }}>
          <Text fontSize={9} color={COLORS.textDim}>public key</Text>
          <Text fontSize={10} color={COLORS.textBright} style={{ fontFamily: 'monospace' }}>{publicKey || '—'}</Text>
          <Text fontSize={9} color={COLORS.textDim}>private key</Text>
          <Text fontSize={10} color={COLORS.textBright} style={{ fontFamily: 'monospace' }}>{privateKey || '—'}</Text>
        </Card>
        <Card title="Signature" subtitle={signState.pending ? 'Signing...' : 'Host result'} style={{ flexGrow: 1, flexBasis: 0, minWidth: 240 }}>
          <Text fontSize={10} color={COLORS.textBright} style={{ fontFamily: 'monospace' }}>{signState.signed?.signature || '—'}</Text>
          <Text fontSize={9} color={COLORS.textDim}>verified: {verifyState.valid === null ? '—' : verifyState.valid ? 'true' : 'false'}</Text>
        </Card>
      </Row>
    </Col>
  );
}
