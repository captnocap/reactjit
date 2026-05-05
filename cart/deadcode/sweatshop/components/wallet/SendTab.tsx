import { useMemo, useState } from 'react';
import { Box, Col, Pressable, Row, Text, TextInput } from '@reactjit/runtime/primitives';
import { COLORS, TOKENS } from '../../theme';
import { copyToClipboard } from '../agent/clipboard';
import { buildPaymentRequest, compactAddress, getWalletNetwork, normalizeAddress, type WalletAccount, type WalletContact, type WalletFeeLevel } from './lib';

function readClipboard(): string {
  const host: any = globalThis as any;
  if (typeof host.__clipboard_get === 'function') {
    try {
      return String(host.__clipboard_get() || '');
    } catch {}
  }
  return '';
}

function FeeChip(props: { active: boolean; label: string; hint: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={props.onPress}
      style={{
        paddingHorizontal: 10,
        paddingVertical: 7,
        borderRadius: TOKENS.radiusPill,
        borderWidth: 1,
        borderColor: props.active ? COLORS.green : COLORS.border,
        backgroundColor: props.active ? COLORS.greenDeep : COLORS.panelBg,
      }}
    >
      <Col style={{ gap: 1 }}>
        <Text fontSize={9} color={props.active ? COLORS.green : COLORS.textBright} style={{ fontWeight: 'bold' }}>{props.label}</Text>
        <Text fontSize={8} color={COLORS.textDim}>{props.hint}</Text>
      </Col>
    </Pressable>
  );
}

export function SendTab(props: {
  account: WalletAccount | null;
  contacts: WalletContact[];
  initialRecipient?: string;
}) {
  const [recipient, setRecipient] = useState('');
  const [amount, setAmount] = useState('');
  const [feeLevel, setFeeLevel] = useState<WalletFeeLevel>('standard');
  const [reviewed, setReviewed] = useState(false);
  const [notice, setNotice] = useState('');

  const network = useMemo(() => props.account ? getWalletNetwork(props.account.address) : null, [props.account?.address]);
  const request = useMemo(() => {
    if (!props.account || !network) return null;
    return buildPaymentRequest(props.account, recipient, amount, feeLevel);
  }, [props.account?.address, recipient, amount, feeLevel]);

  const canScan = !!(globalThis as any).__camera_start || !!(globalThis as any).__camera_capture || !!(globalThis as any).__camera_stop;

  React.useEffect(() => {
    if (props.initialRecipient) {
      setRecipient(props.initialRecipient);
      setReviewed(false);
    }
  }, [props.initialRecipient]);

  function pickContact(address: string) {
    setRecipient(address);
    setReviewed(false);
    setNotice('');
  }

  function pasteRecipient() {
    const text = normalizeAddress(readClipboard());
    if (!text) {
      setNotice('Clipboard is empty or unavailable.');
      return;
    }
    pickContact(text);
    setNotice('Recipient pasted from clipboard.');
  }

  function confirm() {
    if (!request || !request.uri || !recipient || !amount) {
      setNotice('Enter a recipient and amount first.');
      return;
    }
    if (!reviewed) {
      setReviewed(true);
      setNotice('Review the request, then press confirm again to copy the external-wallet handoff.');
      return;
    }
    copyToClipboard(request.summary);
    setReviewed(false);
    setNotice('Payment request copied to clipboard. Open your external wallet and paste it there.');
  }

  return (
    <Col style={{ gap: 10 }}>
      <Box style={{ padding: 10, borderRadius: TOKENS.radiusLg, borderWidth: 1, borderColor: COLORS.yellow, backgroundColor: COLORS.yellowDeep, gap: 4 }}>
        <Text fontSize={10} color={COLORS.yellow} style={{ fontWeight: 'bold' }}>WATCH-ONLY</Text>
        <Text fontSize={9} color={COLORS.textBright}>This cart never stores private keys or signs transactions. It prepares an external-wallet handoff only.</Text>
      </Box>

      {props.account && network ? (
        <Box style={{ padding: 10, borderRadius: TOKENS.radiusLg, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.panelAlt, gap: 6 }}>
          <Row style={{ alignItems: 'center', gap: 8 }}>
            <Box style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: network.tone }} />
            <Text fontSize={10} color={network.tone} style={{ fontWeight: 'bold' }}>{network.label}</Text>
            <Box style={{ flexGrow: 1 }} />
            <Text fontSize={9} color={COLORS.textDim} style={{ fontFamily: 'monospace' }}>{compactAddress(props.account.address)}</Text>
          </Row>
          <Text fontSize={9} color={COLORS.textDim}>Recipient address, amount, and fee are packaged into a clipboard-ready request for your external wallet.</Text>
        </Box>
      ) : (
        <Box style={{ padding: 10, borderRadius: TOKENS.radiusLg, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.panelAlt }}>
          <Text fontSize={9} color={COLORS.textDim}>Select an account to prepare a watch-only transfer request.</Text>
        </Box>
      )}

      <Box style={{ padding: 10, borderRadius: TOKENS.radiusLg, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.panelAlt, gap: 8 }}>
        <Row style={{ gap: 8, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <Col style={{ flexGrow: 1, flexBasis: 220, gap: 4 }}>
            <Text fontSize={9} color={COLORS.textDim}>Recipient</Text>
            <TextInput value={recipient} onChangeText={(v: string) => { setRecipient(v); setReviewed(false); }} placeholder="paste recipient address" style={{ height: 34, borderWidth: 1, borderColor: COLORS.border, borderRadius: TOKENS.radiusSm, backgroundColor: COLORS.panelBg, color: COLORS.textBright, fontSize: 10, paddingLeft: 8, paddingRight: 8 }} />
          </Col>
          <Pressable onPress={pasteRecipient} style={{ paddingHorizontal: 10, paddingVertical: 7, borderRadius: TOKENS.radiusSm, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.panelBg }}>
            <Text fontSize={9} color={COLORS.blue} style={{ fontWeight: 'bold' }}>Paste</Text>
          </Pressable>
          <Pressable onPress={() => setNotice(canScan ? 'Camera bridge not wired in this runtime yet.' : 'Camera scan unavailable in this runtime. Paste the address or use the clipboard.') } style={{ paddingHorizontal: 10, paddingVertical: 7, borderRadius: TOKENS.radiusSm, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.panelBg }}>
            <Text fontSize={9} color={COLORS.textDim} style={{ fontWeight: 'bold' }}>Scan</Text>
          </Pressable>
        </Row>

        <Row style={{ gap: 8, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <Col style={{ flexGrow: 1, flexBasis: 160, gap: 4 }}>
            <Text fontSize={9} color={COLORS.textDim}>Amount</Text>
            <TextInput value={amount} onChangeText={(v: string) => { setAmount(v); setReviewed(false); }} placeholder="0.00" style={{ height: 34, borderWidth: 1, borderColor: COLORS.border, borderRadius: TOKENS.radiusSm, backgroundColor: COLORS.panelBg, color: COLORS.textBright, fontSize: 10, paddingLeft: 8, paddingRight: 8, fontFamily: 'monospace' }} />
          </Col>
          <Col style={{ flexGrow: 2, flexBasis: 320, gap: 4 }}>
            <Text fontSize={9} color={COLORS.textDim}>Fee</Text>
            <Row style={{ gap: 6, flexWrap: 'wrap' }}>
              {(network ? ['slow', 'standard', 'fast'] : []).map((level) => {
                const preset = network ? (level === 'slow' ? 'Slow' : level === 'fast' ? 'Fast' : 'Standard') : '';
                const hint = network?.id === 'bitcoin'
                  ? (level === 'slow' ? 'low sats/vB' : level === 'fast' ? 'high sats/vB' : 'balanced')
                  : (level === 'slow' ? 'lower gwei' : level === 'fast' ? 'higher gwei' : 'balanced');
                return <FeeChip key={level} active={feeLevel === level} label={preset} hint={hint} onPress={() => { setFeeLevel(level as WalletFeeLevel); setReviewed(false); }} />;
              })}
            </Row>
          </Col>
        </Row>

        <Row style={{ gap: 8, flexWrap: 'wrap' }}>
          <Pressable onPress={confirm} style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: TOKENS.radiusSm, borderWidth: 1, borderColor: reviewed ? COLORS.green : COLORS.blue, backgroundColor: reviewed ? COLORS.greenDeep : COLORS.blueDeep }}>
            <Text fontSize={10} color={reviewed ? COLORS.green : COLORS.blue} style={{ fontWeight: 'bold' }}>{reviewed ? 'Copy request' : 'Review transfer'}</Text>
          </Pressable>
          <Box style={{ flexGrow: 1 }} />
          {request ? <Text fontSize={9} color={COLORS.textDim} style={{ fontFamily: 'monospace' }}>{request.uri || 'uri unavailable'}</Text> : null}
        </Row>

        {notice ? <Text fontSize={9} color={COLORS.textDim}>{notice}</Text> : null}
      </Box>

      <Box style={{ gap: 6 }}>
        <Text fontSize={10} color={COLORS.textMuted} style={{ fontWeight: 'bold' }}>ADDRESS BOOK</Text>
        <Row style={{ gap: 6, flexWrap: 'wrap' }}>
          {props.contacts.length === 0 ? (
            <Text fontSize={9} color={COLORS.textDim}>No saved contacts yet.</Text>
          ) : props.contacts.slice(0, 8).map((contact) => (
            <Pressable key={contact.id} onPress={() => pickContact(contact.address)} style={{ paddingHorizontal: 8, paddingVertical: 5, borderRadius: TOKENS.radiusPill, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.panelBg }}>
              <Text fontSize={9} color={COLORS.textBright} style={{ fontWeight: 'bold' }}>{contact.label}</Text>
            </Pressable>
          ))}
        </Row>
      </Box>
    </Col>
  );
}
