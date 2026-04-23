const React: any = require('react');
const { useMemo, useState } = React;

import { Col, Row, Text } from '../../../../runtime/primitives';
import { COLORS } from '../../theme';
import { type EncryptAlgorithm, type KdfAlgorithm, useDecrypt, useEncrypt } from '../../lib/crypto/encrypt';
import { Banner, Card, Chip, Field } from './crypto-ui';

const ALGORITHMS: Array<{ id: EncryptAlgorithm; label: string }> = [
  { id: 'aes-256-gcm', label: 'AES-256-GCM' },
  { id: 'chacha20-poly1305', label: 'ChaCha20-Poly1305' },
];

const KDFS: Array<{ id: KdfAlgorithm; label: string }> = [
  { id: 'argon2id', label: 'Argon2id' },
  { id: 'pbkdf2', label: 'PBKDF2' },
  { id: 'scrypt', label: 'scrypt' },
];

function kdfDefaults(kdf: KdfAlgorithm): Record<string, number> {
  if (kdf === 'pbkdf2') return { iterations: 210000 };
  if (kdf === 'scrypt') return { N: 16384, r: 8, p: 1 };
  return { opslimit: 3, memlimit: 67108864 };
}

export function EncryptTab() {
  const [plaintext, setPlaintext] = useState('secret message');
  const [password, setPassword] = useState('correct horse battery staple');
  const [algorithm, setAlgorithm] = useState<EncryptAlgorithm>('chacha20-poly1305');
  const [kdf, setKdf] = useState<KdfAlgorithm>('argon2id');
  const options = useMemo(() => ({ algorithm, kdf, kdfParams: kdfDefaults(kdf) }), [algorithm, kdf]);
  const encrypted = useEncrypt(plaintext, password, options);
  const decrypted = useDecrypt(encrypted.result, password);

  return (
    <Col style={{ gap: 12 }}>
      <Banner {...encrypted} />
      <Card title="Encrypt / decrypt" subtitle="Password-based sealing uses the selected cipher and KDF when host bindings are present.">
        <Row style={{ gap: 6, flexWrap: 'wrap' }}>
          {ALGORITHMS.map((entry) => <Chip key={entry.id} label={entry.label} active={algorithm === entry.id} onPress={() => setAlgorithm(entry.id)} />)}
          {KDFS.map((entry) => <Chip key={entry.id} label={entry.label} active={kdf === entry.id} onPress={() => setKdf(entry.id)} />)}
        </Row>
        <Field label="Plaintext" value={plaintext} onChange={setPlaintext} multiline={true} rows={4} placeholder="message to seal" />
        <Field label="Password" value={password} onChange={setPassword} placeholder="password" />
        <Text fontSize={9} color={COLORS.textDim}>KDF params: {JSON.stringify(options.kdfParams)}</Text>
      </Card>

      <Row style={{ gap: 12, alignItems: 'stretch', flexWrap: 'wrap' }}>
        <Card title="Ciphertext" subtitle={encrypted.pending ? 'Sealing...' : 'Host result'} style={{ flexGrow: 1, flexBasis: 0, minWidth: 240 }}>
          <Text fontSize={10} color={COLORS.textBright} style={{ fontFamily: 'monospace' }}>{encrypted.result?.ciphertext || '—'}</Text>
          <Text fontSize={9} color={COLORS.textDim}>nonce: {encrypted.result?.nonce || '—'}</Text>
          <Text fontSize={9} color={COLORS.textDim}>salt: {encrypted.result?.salt || '—'}</Text>
        </Card>
        <Card title="Decrypt" subtitle={decrypted.pending ? 'Opening...' : 'Round-trip check'} style={{ flexGrow: 1, flexBasis: 0, minWidth: 240 }}>
          <Text fontSize={10} color={COLORS.textBright} style={{ fontFamily: 'monospace' }}>{decrypted.result || '—'}</Text>
        </Card>
      </Row>
    </Col>
  );
}
