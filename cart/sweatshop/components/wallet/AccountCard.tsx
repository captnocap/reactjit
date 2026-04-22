const React: any = require('react');
const { useMemo } = React;

import { Box, Col, Pressable, Row, Text } from '../../../../runtime/primitives';
import { COLORS, TOKENS } from '../../theme';
import { copyToClipboard } from '../agent/clipboard';
import { Icon } from '../icons';
import { compactAddress, formatFiat, formatTimestamp, getWalletNetwork, readableAddressLine, type WalletAccount } from './lib';
import { useBalance } from './hooks/useBalance';

export function AccountCard(props: {
  account: WalletAccount;
  active?: boolean;
  onSelect?: (id: string) => void;
  onRemove?: (id: string) => void;
}) {
  const balance = useBalance(props.account);
  const network = useMemo(() => getWalletNetwork(props.account.address), [props.account.address]);

  return (
    <Pressable
      onPress={() => props.onSelect?.(props.account.id)}
      style={{
        padding: 12,
        borderRadius: TOKENS.radiusLg,
        borderWidth: 1,
        borderColor: props.active ? network.tone : COLORS.border,
        backgroundColor: props.active ? COLORS.panelRaised : COLORS.panelAlt,
        gap: 10,
      }}
    >
      <Row style={{ alignItems: 'center', gap: 8 }}>
        <Box style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: network.tone }} />
        <Col style={{ flexGrow: 1, flexBasis: 0, gap: 2 }}>
          <Row style={{ alignItems: 'center', gap: 6 }}>
            <Text fontSize={11} color={COLORS.textBright} style={{ fontWeight: 'bold' }}>{props.account.label}</Text>
            <Box style={{ paddingHorizontal: 6, paddingVertical: 2, borderRadius: TOKENS.radiusPill, backgroundColor: COLORS.panelBg, borderWidth: 1, borderColor: COLORS.border }}>
              <Text fontSize={9} color={network.tone} style={{ fontWeight: 'bold' }}>{network.symbol}</Text>
            </Box>
          </Row>
          <Text fontSize={9} color={COLORS.textDim} style={{ fontFamily: 'monospace' }}>{compactAddress(props.account.address)}</Text>
        </Col>
        <Pressable onPress={() => copyToClipboard(props.account.address)} style={{ padding: 6, borderRadius: 8, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.panelBg }}>
          <Icon name="copy" size={13} color={COLORS.textMuted} />
        </Pressable>
        {props.onRemove ? (
          <Pressable onPress={() => props.onRemove?.(props.account.id)} style={{ padding: 6, borderRadius: 8, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.panelBg }}>
            <Icon name="trash" size={13} color={COLORS.textMuted} />
          </Pressable>
        ) : null}
      </Row>

      <Col style={{ gap: 4 }}>
        <Text fontSize={16} color={COLORS.textBright} style={{ fontWeight: 'bold' }}>
          {balance.loading ? 'Refreshing…' : `${balance.native} ${balance.symbol}`}
        </Text>
        <Row style={{ gap: 6, flexWrap: 'wrap' }}>
          <Box style={{ paddingHorizontal: 8, paddingVertical: 4, borderRadius: TOKENS.radiusPill, backgroundColor: COLORS.panelBg, borderWidth: 1, borderColor: COLORS.border }}>
            <Text fontSize={10} color={COLORS.textBright}>{formatFiat(balance.usd, 'USD')}</Text>
          </Box>
          <Box style={{ paddingHorizontal: 8, paddingVertical: 4, borderRadius: TOKENS.radiusPill, backgroundColor: COLORS.panelBg, borderWidth: 1, borderColor: COLORS.border }}>
            <Text fontSize={10} color={COLORS.textBright}>{formatFiat(balance.eur, 'EUR')}</Text>
          </Box>
          <Box style={{ paddingHorizontal: 8, paddingVertical: 4, borderRadius: TOKENS.radiusPill, backgroundColor: COLORS.panelBg, borderWidth: 1, borderColor: COLORS.border }}>
            <Text fontSize={10} color={COLORS.textBright}>{formatFiat(balance.gbp, 'GBP')}</Text>
          </Box>
        </Row>
        <Text fontSize={9} color={COLORS.textDim}>
          {balance.error ? `Explorer error: ${balance.error.message}` : `Last refreshed ${formatTimestamp(balance.lastUpdated || Date.now())}`}
        </Text>
      </Col>

      <Text fontSize={9} color={COLORS.textDim} style={{ fontFamily: 'monospace' }}>{readableAddressLine(props.account.address)}</Text>
    </Pressable>
  );
}

