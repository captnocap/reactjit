import { useMemo, useState } from 'react';
import { Box, Col, Pressable, Row, ScrollView, Text } from '@reactjit/runtime/primitives';
import { COLORS, TOKENS } from '../../theme';
import { formatTimestamp, type WalletAccount } from './lib';
import { useTxHistory } from './hooks/useTxHistory';
import { TransactionRow } from './TransactionRow';

type DirectionFilter = 'all' | 'sent' | 'received' | 'self';
type TypeFilter = 'all' | 'transfer' | 'self';

function Chip(props: { active: boolean; label: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={props.onPress}
      style={{
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: TOKENS.radiusPill,
        borderWidth: 1,
        borderColor: props.active ? COLORS.blue : COLORS.border,
        backgroundColor: props.active ? COLORS.blueDeep : COLORS.panelBg,
      }}
    >
      <Text fontSize={9} color={props.active ? COLORS.blue : COLORS.textDim} style={{ fontWeight: 'bold', textTransform: 'uppercase' }}>
        {props.label}
      </Text>
    </Pressable>
  );
}

export function TransactionList(props: { account: WalletAccount | null }) {
  const [directionFilter, setDirectionFilter] = useState<DirectionFilter>('all');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [activeHash, setActiveHash] = useState('');
  const history = props.account ? useTxHistory(props.account) : null;

  const filtered = useMemo(() => {
    const items = history?.transactions || [];
    return items.filter((tx) => {
      const directionOk = directionFilter === 'all' || tx.direction === directionFilter;
      const typeOk = typeFilter === 'all' || tx.kind === typeFilter;
      return directionOk && typeOk;
    });
  }, [history?.transactions, directionFilter, typeFilter]);

  if (!props.account) {
    return (
      <Box style={{ padding: 12, borderRadius: TOKENS.radiusLg, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.panelAlt, gap: 8 }}>
        <Text fontSize={11} color={COLORS.textBright} style={{ fontWeight: 'bold' }}>Select an account</Text>
        <Text fontSize={9} color={COLORS.textDim}>Pick a watch-only account to load live explorer history.</Text>
      </Box>
    );
  }

  return (
    <Col style={{ gap: 10 }}>
      <Row style={{ gap: 6, flexWrap: 'wrap' }}>
        <Chip active={directionFilter === 'all'} label="all" onPress={() => setDirectionFilter('all')} />
        <Chip active={directionFilter === 'sent'} label="sent" onPress={() => setDirectionFilter('sent')} />
        <Chip active={directionFilter === 'received'} label="received" onPress={() => setDirectionFilter('received')} />
        <Chip active={directionFilter === 'self'} label="self" onPress={() => setDirectionFilter('self')} />
      </Row>
      <Row style={{ gap: 6, flexWrap: 'wrap' }}>
        <Chip active={typeFilter === 'all'} label="any type" onPress={() => setTypeFilter('all')} />
        <Chip active={typeFilter === 'transfer'} label="transfer" onPress={() => setTypeFilter('transfer')} />
        <Chip active={typeFilter === 'self'} label="self" onPress={() => setTypeFilter('self')} />
        <Box style={{ flexGrow: 1 }} />
        <Text fontSize={9} color={COLORS.textDim}>
          {history?.loading ? 'loading…' : `${filtered.length} tx · refreshed ${history?.lastUpdated ? formatTimestamp(history.lastUpdated) : '—'}`}
        </Text>
      </Row>

      <ScrollView style={{ flexGrow: 1, minHeight: 0 }}>
        <Col style={{ gap: 8, paddingBottom: 10 }}>
          {filtered.length === 0 ? (
            <Box style={{ padding: 12, borderRadius: TOKENS.radiusLg, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.panelAlt }}>
              <Text fontSize={10} color={COLORS.textDim}>No matching transactions yet.</Text>
            </Box>
          ) : filtered.map((tx) => (
            <TransactionRow
              key={tx.hash}
              tx={tx}
              networkDecimals={props.account ? (props.account.address.toLowerCase().startsWith('0x') ? 18 : 8) : 8}
              symbol={props.account.address.toLowerCase().startsWith('0x') ? 'ETH' : 'BTC'}
              active={activeHash === tx.hash}
              onPress={() => setActiveHash(activeHash === tx.hash ? '' : tx.hash)}
            />
          ))}
        </Col>
      </ScrollView>
    </Col>
  );
}

