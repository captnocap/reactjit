import { Box, Canvas, Col, Pressable, Row, Text } from '../../../../runtime/primitives';
import { COLORS, TOKENS } from '../../theme';
import { copyToClipboard } from '../agent/clipboard';
import { buildPaymentUri, buildQrMatrix, compactAddress, getWalletNetwork, type WalletAccount } from './lib';

export function ReceiveTab(props: { account: WalletAccount | null }) {
  if (!props.account) {
    return (
      <Box style={{ padding: 12, borderRadius: TOKENS.radiusLg, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.panelAlt }}>
        <Text fontSize={9} color={COLORS.textDim}>Select an account to show its receive code.</Text>
      </Box>
    );
  }

  const network = getWalletNetwork(props.account.address);
  const matrix = buildQrMatrix(`${network.id}:${props.account.address}:${props.account.label}`);
  const cell = 7;
  const size = matrix.length * cell;
  const uri = buildPaymentUri(network, props.account.address, '');

  return (
    <Col style={{ gap: 10 }}>
      <Box style={{ padding: 10, borderRadius: TOKENS.radiusLg, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.panelAlt, gap: 6 }}>
        <Row style={{ alignItems: 'center', gap: 8 }}>
          <Box style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: network.tone }} />
          <Text fontSize={10} color={network.tone} style={{ fontWeight: 'bold' }}>{network.label} receive</Text>
          <Box style={{ flexGrow: 1 }} />
          <Pressable onPress={() => copyToClipboard(props.account.address)} style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: TOKENS.radiusSm, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.panelBg }}>
            <Text fontSize={9} color={COLORS.blue} style={{ fontWeight: 'bold' }}>Copy address</Text>
          </Pressable>
        </Row>
        <Text fontSize={9} color={COLORS.textDim}>Share this address or the QR code below. Nothing is signed here.</Text>
      </Box>

      <Box style={{ padding: 12, borderRadius: TOKENS.radiusLg, borderWidth: 1, borderColor: COLORS.border, backgroundColor: '#fff', alignSelf: 'flex-start' }}>
        <Canvas style={{ width: size, height: size, backgroundColor: '#fff' }}>
          {matrix.map((row, y) => row.map((on, x) => on ? (
            <Canvas.Node key={`${x}-${y}`} gx={x * cell} gy={y * cell} gw={cell} gh={cell} fill="#0b0f14" />
          ) : null))}
        </Canvas>
      </Box>

      <Box style={{ padding: 10, borderRadius: TOKENS.radiusLg, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.panelAlt, gap: 6 }}>
        <Text fontSize={9} color={COLORS.textDim}>Address</Text>
        <Text fontSize={10} color={COLORS.textBright} style={{ fontFamily: 'monospace' }}>{props.account.address}</Text>
        <Row style={{ gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <Text fontSize={9} color={COLORS.textDim}>Compact</Text>
          <Text fontSize={9} color={COLORS.textBright} style={{ fontFamily: 'monospace' }}>{compactAddress(props.account.address)}</Text>
          <Box style={{ flexGrow: 1 }} />
          <Text fontSize={9} color={COLORS.textDim} style={{ fontFamily: 'monospace' }}>{uri}</Text>
        </Row>
      </Box>
    </Col>
  );
}

