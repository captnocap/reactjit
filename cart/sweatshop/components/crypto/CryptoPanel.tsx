const React: any = require('react');
const { useState } = React;

import { Box, Col, Row, ScrollView, Text } from '../../../../runtime/primitives';
import { COLORS, TOKENS } from '../../theme';
import { listCryptoHostFunctions } from '../../lib/crypto/support';
import { HoverPressable } from '../shared';
import { HashTab } from './HashTab';
import { EncryptTab } from './EncryptTab';
import { SignTab } from './SignTab';
import { KDFTab } from './KDFTab';
import { JWTTab } from './JWTTab';

type TabId = 'hash' | 'encrypt' | 'sign' | 'kdf' | 'jwt';

const TABS: Array<{ id: TabId; label: string; desc: string }> = [
  { id: 'hash', label: 'Hash', desc: 'Digest input live' },
  { id: 'encrypt', label: 'Encrypt', desc: 'Seal and open' },
  { id: 'sign', label: 'Sign', desc: 'Keypairs and sigs' },
  { id: 'kdf', label: 'KDF', desc: 'Derive keys' },
  { id: 'jwt', label: 'JWT', desc: 'Sign claims' },
];

function TabButton(props: { id: TabId; label: string; desc: string; active: boolean; onPress: (id: TabId) => void }) {
  return (
    <HoverPressable
      onPress={() => props.onPress(props.id)}
      style={{
        flexGrow: 1,
        flexBasis: 0,
        minWidth: 118,
        padding: 10,
        borderRadius: TOKENS.radiusLg,
        borderWidth: 1,
        borderColor: props.active ? COLORS.blue : COLORS.border,
        backgroundColor: props.active ? COLORS.blueDeep : COLORS.panelAlt,
      }}
    >
      <Col style={{ gap: 2 }}>
        <Text fontSize={11} color={props.active ? COLORS.blue : COLORS.textBright} style={{ fontWeight: 'bold' }}>{props.label}</Text>
        <Text fontSize={9} color={COLORS.textDim}>{props.desc}</Text>
      </Col>
    </HoverPressable>
  );
}

export function CryptoPanel(props: { title?: string; onClose?: () => void }) {
  const [tab, setTab] = useState<TabId>('hash');
  const hostFns = listCryptoHostFunctions();
  const content = tab === 'hash' ? <HashTab /> : tab === 'encrypt' ? <EncryptTab /> : tab === 'sign' ? <SignTab /> : tab === 'kdf' ? <KDFTab /> : <JWTTab />;

  return (
    <Col style={{ width: '100%', height: '100%', backgroundColor: COLORS.panelBg }}>
      <Row style={{ alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingLeft: 14, paddingRight: 14, paddingTop: 12, paddingBottom: 12, borderBottomWidth: 1, borderColor: COLORS.borderSoft }}>
        <Col style={{ gap: 2, flexGrow: 1, flexBasis: 0 }}>
          <Text fontSize={13} color={COLORS.textBright} style={{ fontWeight: 'bold' }}>{props.title || 'Crypto'}</Text>
          <Text fontSize={10} color={COLORS.textDim}>Real crypto primitives. On this runtime the host bindings are absent, so the surface reports that honestly.</Text>
        </Col>
        {props.onClose ? (
          <HoverPressable onPress={props.onClose} style={{ paddingLeft: 10, paddingRight: 10, paddingTop: 6, paddingBottom: 6, borderRadius: TOKENS.radiusMd, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.panelAlt }}>
            <Text fontSize={10} color={COLORS.textBright} style={{ fontWeight: 'bold' }}>Close</Text>
          </HoverPressable>
        ) : null}
      </Row>

      <Box style={{ paddingLeft: 14, paddingRight: 14, paddingTop: 10, paddingBottom: 10, gap: 8, borderBottomWidth: 1, borderColor: COLORS.borderSoft }}>
        <Text fontSize={9} color={COLORS.textDim} style={{ letterSpacing: 0.5, fontWeight: 'bold' }}>
          {hostFns.length ? `Detected host crypto fns (${hostFns.length})` : 'No host crypto fns detected'}
        </Text>
        <Text fontSize={9} color={COLORS.textDim} style={{ fontFamily: 'monospace' }}>
          {hostFns.length ? hostFns.join(', ') : 'The panel will stay on the visible pending banner until __crypto_* bindings are added.'}
        </Text>
      </Box>

      <Box style={{ paddingLeft: 14, paddingRight: 14, paddingTop: 10, paddingBottom: 10, borderBottomWidth: 1, borderColor: COLORS.borderSoft }}>
        <Row style={{ gap: 8, flexWrap: 'wrap' }}>
          {TABS.map((entry) => <TabButton key={entry.id} id={entry.id} label={entry.label} desc={entry.desc} active={tab === entry.id} onPress={setTab} />)}
        </Row>
      </Box>

      <ScrollView style={{ flexGrow: 1, flexBasis: 0, minHeight: 0 }}>
        <Col style={{ padding: 14, gap: 12 }}>
          {content}
        </Col>
      </ScrollView>
    </Col>
  );
}
