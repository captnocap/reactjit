import { useEffect, useState } from 'react';
import { Box, Col, Pressable, Row, ScrollView, Text, TextInput } from '@reactjit/runtime/primitives';
import { COLORS, TOKENS } from '../../theme';
import { AccountCard } from './AccountCard';
import { AddressBook } from './AddressBook';
import { ReceiveTab } from './ReceiveTab';
import { SendTab } from './SendTab';
import { TransactionList } from './TransactionList';
import { usePersistentState } from '../../hooks/usePersistentState';
import { useWalletAccounts } from './hooks/useWalletAccounts';
import { useAddressBook } from './hooks/useAddressBook';
import { type WalletAccount } from './lib';

type WalletTab = 'accounts' | 'history' | 'send' | 'receive' | 'contacts';

function TabChip(props: { active: boolean; label: string; onPress: () => void }) {
  return (
    <Pressable onPress={props.onPress} style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: TOKENS.radiusPill, borderWidth: 1, borderColor: props.active ? COLORS.blue : COLORS.border, backgroundColor: props.active ? COLORS.blueDeep : COLORS.panelBg }}>
      <Text fontSize={9} color={props.active ? COLORS.blue : COLORS.textDim} style={{ fontWeight: 'bold', textTransform: 'uppercase' }}>{props.label}</Text>
    </Pressable>
  );
}

export function WalletPanel() {
  const { accounts, addAccount, removeAccount } = useWalletAccounts();
  const { contacts, addContact, removeContact } = useAddressBook();
  const [tab, setTab] = usePersistentState<WalletTab>('sweatshop.wallet.tab.v1', 'accounts');
  const [selectedAccountId, setSelectedAccountId] = usePersistentState<string>('sweatshop.wallet.active.v1', '');
  const [labelDraft, setLabelDraft] = useState('');
  const [addressDraft, setAddressDraft] = useState('');
  const [sendRecipientSeed, setSendRecipientSeed] = useState('');
  const [banner, setBanner] = useState('');

  useEffect(() => {
    if (!selectedAccountId && accounts.length > 0) setSelectedAccountId(accounts[0].id);
    if (selectedAccountId && !accounts.find((item) => item.id === selectedAccountId) && accounts.length > 0) {
      setSelectedAccountId(accounts[0].id);
    }
  }, [accounts, selectedAccountId, setSelectedAccountId]);

  const selectedAccount = accounts.find((item) => item.id === selectedAccountId) || accounts[0] || null;

  function addWatchAccount() {
    const cleanAddress = String(addressDraft || '').trim();
    if (!cleanAddress) {
      setBanner('Add a real address first.');
      return;
    }
    addAccount(labelDraft, cleanAddress);
    setBanner('Watch-only account saved.');
    setLabelDraft('');
    setAddressDraft('');
  }

  return (
    <Col style={{ width: '100%', height: '100%', backgroundColor: COLORS.panelBg }}>
      <Col style={{ padding: 12, gap: 10, borderBottomWidth: 1, borderColor: COLORS.borderSoft }}>
        <Box style={{ padding: 10, borderRadius: TOKENS.radiusLg, borderWidth: 1, borderColor: COLORS.yellow, backgroundColor: COLORS.yellowDeep, gap: 4 }}>
          <Text fontSize={10} color={COLORS.yellow} style={{ fontWeight: 'bold' }}>WATCH-ONLY WALLET</Text>
          <Text fontSize={9} color={COLORS.textBright}>Add real addresses, inspect live balances and explorer history, and hand off transfers to an external wallet. No private keys are stored here.</Text>
        </Box>

        <Box style={{ padding: 10, borderRadius: TOKENS.radiusLg, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.panelAlt, gap: 8 }}>
          <Text fontSize={10} color={COLORS.textMuted} style={{ fontWeight: 'bold' }}>ADD ACCOUNT</Text>
          <Row style={{ gap: 8, flexWrap: 'wrap' }}>
            <TextInput value={labelDraft} onChangeText={setLabelDraft} placeholder="label" style={{ flexGrow: 1, flexBasis: 160, height: 34, borderWidth: 1, borderColor: COLORS.border, borderRadius: TOKENS.radiusSm, backgroundColor: COLORS.panelBg, color: COLORS.textBright, fontSize: 10, paddingLeft: 8, paddingRight: 8 }} />
            <TextInput value={addressDraft} onChangeText={setAddressDraft} placeholder="wallet address" style={{ flexGrow: 2, flexBasis: 320, height: 34, borderWidth: 1, borderColor: COLORS.border, borderRadius: TOKENS.radiusSm, backgroundColor: COLORS.panelBg, color: COLORS.textBright, fontSize: 10, paddingLeft: 8, paddingRight: 8, fontFamily: 'monospace' }} />
            <Pressable onPress={addWatchAccount} style={{ paddingHorizontal: 12, paddingVertical: 7, borderRadius: TOKENS.radiusSm, borderWidth: 1, borderColor: COLORS.green, backgroundColor: COLORS.greenDeep }}>
              <Text fontSize={9} color={COLORS.green} style={{ fontWeight: 'bold' }}>Save</Text>
            </Pressable>
          </Row>
          {banner ? <Text fontSize={9} color={COLORS.textDim}>{banner}</Text> : null}
        </Box>

        <ScrollView style={{ maxHeight: 280 }}>
          <Col style={{ gap: 8 }}>
            {accounts.length === 0 ? <Text fontSize={9} color={COLORS.textDim}>No watch-only accounts yet.</Text> : null}
            {accounts.map((account) => (
              <AccountCard
                key={account.id}
                account={account}
                active={selectedAccount?.id === account.id}
                onSelect={setSelectedAccountId}
                onRemove={removeAccount}
              />
            ))}
          </Col>
        </ScrollView>

        <Row style={{ gap: 6, flexWrap: 'wrap', paddingTop: 2, paddingBottom: 2 }}>
          <TabChip active={tab === 'accounts'} label="accounts" onPress={() => setTab('accounts')} />
          <TabChip active={tab === 'history'} label="history" onPress={() => setTab('history')} />
          <TabChip active={tab === 'send'} label="send" onPress={() => setTab('send')} />
          <TabChip active={tab === 'receive'} label="receive" onPress={() => setTab('receive')} />
          <TabChip active={tab === 'contacts'} label="address book" onPress={() => setTab('contacts')} />
          <Box style={{ flexGrow: 1 }} />
        </Row>
      </Col>

      <Box style={{ flexGrow: 1, minHeight: 0, padding: 12, gap: 10 }}>
        {tab === 'accounts' ? (
          <Box style={{ gap: 8 }}>
            <Text fontSize={10} color={COLORS.textMuted} style={{ fontWeight: 'bold' }}>SELECTED ACCOUNT</Text>
            {selectedAccount ? <AccountCard account={selectedAccount as WalletAccount} active={true} onSelect={setSelectedAccountId} onRemove={removeAccount} /> : null}
          </Box>
        ) : null}

        {tab === 'history' ? <TransactionList account={selectedAccount} /> : null}
        {tab === 'send' ? <SendTab account={selectedAccount} contacts={contacts} initialRecipient={sendRecipientSeed} /> : null}
        {tab === 'receive' ? <ReceiveTab account={selectedAccount} /> : null}
        {tab === 'contacts' ? <AddressBook contacts={contacts} onAdd={addContact} onRemove={removeContact} onSelect={(address) => { setSendRecipientSeed(address); setTab('send'); }} /> : null}
      </Box>
    </Col>
  );
}
