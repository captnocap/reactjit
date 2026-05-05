import { Box, Col, Pressable, Row, Text } from '@reactjit/runtime/primitives';
import { COLORS, TOKENS } from '../../theme';
import { copyToClipboard } from '../agent/clipboard';
import { compactAddress, formatAtomic, formatTimestamp, type WalletTransaction } from './lib';

export function TransactionRow(props: {
  tx: WalletTransaction;
  networkDecimals: number;
  symbol: string;
  active?: boolean;
  onPress?: () => void;
}) {
  const tone = props.tx.direction === 'sent' ? COLORS.red : props.tx.direction === 'received' ? COLORS.green : COLORS.purple;
  return (
    <Pressable
      onPress={props.onPress}
      style={{
        padding: 10,
        borderRadius: TOKENS.radiusLg,
        borderWidth: 1,
        borderColor: props.active ? tone : COLORS.border,
        backgroundColor: props.active ? COLORS.panelRaised : COLORS.panelAlt,
        gap: 8,
      }}
    >
      <Row style={{ alignItems: 'center', gap: 8 }}>
        <Box style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: tone }} />
        <Text fontSize={10} color={tone} style={{ fontWeight: 'bold', textTransform: 'uppercase' }}>{props.tx.direction}</Text>
        <Text fontSize={10} color={COLORS.textBright} style={{ flexGrow: 1, flexBasis: 0 }}>{props.tx.kind}</Text>
        <Text fontSize={10} color={COLORS.textBright} style={{ fontWeight: 'bold' }}>{formatAtomic(Math.round(props.tx.amount * Math.pow(10, props.networkDecimals)), props.networkDecimals, props.networkDecimals === 8 ? 8 : 6)} {props.symbol}</Text>
      </Row>
      <Row style={{ gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <Text fontSize={9} color={COLORS.textDim}>fee {formatAtomic(Math.round(props.tx.fee * Math.pow(10, props.networkDecimals)), props.networkDecimals, props.networkDecimals === 8 ? 8 : 6)} {props.symbol}</Text>
        <Text fontSize={9} color={COLORS.textDim}>{formatTimestamp(props.tx.timestamp)}</Text>
        <Text fontSize={9} color={props.tx.status === 'confirmed' ? COLORS.green : COLORS.yellow}>{props.tx.status}</Text>
        <Text fontSize={9} color={COLORS.textDim} style={{ flexGrow: 1, flexBasis: 0, fontFamily: 'monospace' }}>{compactAddress(props.tx.hash)}</Text>
        <Pressable onPress={() => copyToClipboard(props.tx.hash)} style={{ padding: 5, borderRadius: 8, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.panelBg }}>
          <Text fontSize={9} color={COLORS.blue}>copy hash</Text>
        </Pressable>
      </Row>
      {props.active ? (
        <Col style={{ gap: 4, paddingTop: 6, borderTopWidth: 1, borderColor: COLORS.borderSoft }}>
          <Text fontSize={9} color={COLORS.textDim} style={{ fontFamily: 'monospace' }}>from {compactAddress(props.tx.from)}</Text>
          <Text fontSize={9} color={COLORS.textDim} style={{ fontFamily: 'monospace' }}>to {compactAddress(props.tx.to)}</Text>
          <Text fontSize={9} color={COLORS.textDim} style={{ fontFamily: 'monospace' }}>counterparty {compactAddress(props.tx.counterparty)}</Text>
          <Text fontSize={9} color={COLORS.textDim}>confirmations {String(props.tx.confirmations || 0)}</Text>
        </Col>
      ) : null}
    </Pressable>
  );
}

