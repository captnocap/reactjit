const React: any = require('react');
const { useMemo, useState } = React;

import { Col, Row, Text } from '../../../../runtime/primitives';
import { COLORS } from '../../theme';
import { type KdfAlgorithm, useKDF } from '../../lib/crypto/kdf';
import { Banner, Card, Chip, Field } from './crypto-ui';

const ALGORITHMS: Array<{ id: KdfAlgorithm; label: string }> = [
  { id: 'argon2id', label: 'Argon2id' },
  { id: 'pbkdf2', label: 'PBKDF2' },
  { id: 'scrypt', label: 'scrypt' },
];

export function KDFTab() {
  const [algorithm, setAlgorithm] = useState<KdfAlgorithm>('argon2id');
  const [password, setPassword] = useState('correct horse battery staple');
  const [salt, setSalt] = useState('sweatshop');
  const [length, setLength] = useState('32');
  const [iterations, setIterations] = useState('210000');
  const [opslimit, setOpslimit] = useState('3');
  const [memlimit, setMemlimit] = useState('67108864');
  const [N, setN] = useState('16384');
  const [r, setR] = useState('8');
  const [p, setP] = useState('1');

  const params = useMemo(() => {
    if (algorithm === 'pbkdf2') return { iterations: Number(iterations) || 210000 };
    if (algorithm === 'scrypt') return { N: Number(N) || 16384, r: Number(r) || 8, p: Number(p) || 1 };
    return { opslimit: Number(opslimit) || 3, memlimit: Number(memlimit) || 67108864 };
  }, [algorithm, iterations, opslimit, memlimit, N, r, p]);

  const derived = useKDF(password, salt, algorithm, params, Number(length) || 32);

  return (
    <Col style={{ gap: 12 }}>
      <Banner {...derived} />
      <Card title="Key derivation" subtitle="Tune the work factor and derive a key from a password + salt.">
        <Row style={{ gap: 6, flexWrap: 'wrap' }}>
          {ALGORITHMS.map((entry) => <Chip key={entry.id} label={entry.label} active={algorithm === entry.id} onPress={() => setAlgorithm(entry.id)} />)}
        </Row>
        <Row style={{ gap: 12, flexWrap: 'wrap' }}>
          <Field label="Password" value={password} onChange={setPassword} style={{ flexGrow: 1, flexBasis: 0, minWidth: 220 }} />
          <Field label="Salt" value={salt} onChange={setSalt} style={{ flexGrow: 1, flexBasis: 0, minWidth: 220 }} />
          <Field label="Length" value={length} onChange={setLength} style={{ width: 120 }} />
        </Row>
        {algorithm === 'pbkdf2' ? <Field label="Iterations" value={iterations} onChange={setIterations} style={{ width: 160 }} /> : null}
        {algorithm === 'argon2id' ? (
          <Row style={{ gap: 12, flexWrap: 'wrap' }}>
            <Field label="opslimit" value={opslimit} onChange={setOpslimit} style={{ width: 160 }} />
            <Field label="memlimit" value={memlimit} onChange={setMemlimit} style={{ width: 160 }} />
          </Row>
        ) : null}
        {algorithm === 'scrypt' ? (
          <Row style={{ gap: 12, flexWrap: 'wrap' }}>
            <Field label="N" value={N} onChange={setN} style={{ width: 120 }} />
            <Field label="r" value={r} onChange={setR} style={{ width: 120 }} />
            <Field label="p" value={p} onChange={setP} style={{ width: 120 }} />
          </Row>
        ) : null}
      </Card>

      <Card title="Derived key" subtitle={derived.pending ? 'Deriving...' : 'Host result'}>
        <Text fontSize={10} color={COLORS.textBright} style={{ fontFamily: 'monospace' }}>{derived.derivedKey || '—'}</Text>
        <Text fontSize={9} color={COLORS.textDim}>params: {JSON.stringify(params)}</Text>
      </Card>
    </Col>
  );
}
