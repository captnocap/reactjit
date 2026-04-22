const React: any = require('react');
const { useState } = React;

import { Box, Col, Pressable, Row, Text, TextInput } from '../../../../runtime/primitives';
import { COLORS, TOKENS } from '../../theme';
import { copyToClipboard } from '../agent/clipboard';
import { compactAddress, normalizeAddress, type WalletContact } from './lib';

function ContactRow(props: { contact: WalletContact; onSelect?: (address: string) => void; onRemove?: (id: string) => void }) {
  return (
    <Row style={{ alignItems: 'center', gap: 8, padding: 10, borderRadius: TOKENS.radiusLg, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.panelBg }}>
      <Col style={{ flexGrow: 1, flexBasis: 0, gap: 2 }}>
        <Text fontSize={10} color={COLORS.textBright} style={{ fontWeight: 'bold' }}>{props.contact.label}</Text>
        <Text fontSize={9} color={COLORS.textDim} style={{ fontFamily: 'monospace' }}>{compactAddress(props.contact.address)}</Text>
      </Col>
      <Pressable onPress={() => copyToClipboard(props.contact.address)} style={{ paddingHorizontal: 8, paddingVertical: 5, borderRadius: TOKENS.radiusSm, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.panelAlt }}>
        <Text fontSize={9} color={COLORS.blue} style={{ fontWeight: 'bold' }}>Copy</Text>
      </Pressable>
      {props.onSelect ? (
        <Pressable onPress={() => props.onSelect?.(props.contact.address)} style={{ paddingHorizontal: 8, paddingVertical: 5, borderRadius: TOKENS.radiusSm, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.panelAlt }}>
          <Text fontSize={9} color={COLORS.green} style={{ fontWeight: 'bold' }}>Use</Text>
        </Pressable>
      ) : null}
      {props.onRemove ? (
        <Pressable onPress={() => props.onRemove?.(props.contact.id)} style={{ paddingHorizontal: 8, paddingVertical: 5, borderRadius: TOKENS.radiusSm, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.panelAlt }}>
          <Text fontSize={9} color={COLORS.red} style={{ fontWeight: 'bold' }}>Remove</Text>
        </Pressable>
      ) : null}
    </Row>
  );
}

export function AddressBook(props: {
  contacts: WalletContact[];
  onAdd: (label: string, address: string) => void;
  onRemove: (id: string) => void;
  onSelect?: (address: string) => void;
}) {
  const [label, setLabel] = useState('');
  const [address, setAddress] = useState('');
  const [message, setMessage] = useState('');

  function addContact() {
    const cleanAddress = normalizeAddress(address);
    if (!cleanAddress) {
      setMessage('Enter a real address first.');
      return;
    }
    props.onAdd(label, cleanAddress);
    setLabel('');
    setAddress('');
    setMessage('Contact saved.');
  }

  return (
    <Col style={{ gap: 10 }}>
      <Box style={{ padding: 10, borderRadius: TOKENS.radiusLg, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.panelAlt, gap: 8 }}>
        <Text fontSize={10} color={COLORS.textMuted} style={{ fontWeight: 'bold' }}>SAVE A CONTACT</Text>
        <Row style={{ gap: 8, flexWrap: 'wrap' }}>
          <TextInput value={label} onChangeText={setLabel} placeholder="label" style={{ flexGrow: 1, flexBasis: 180, height: 34, borderWidth: 1, borderColor: COLORS.border, borderRadius: TOKENS.radiusSm, backgroundColor: COLORS.panelBg, color: COLORS.textBright, fontSize: 10, paddingLeft: 8, paddingRight: 8 }} />
          <TextInput value={address} onChangeText={setAddress} placeholder="wallet address" style={{ flexGrow: 2, flexBasis: 300, height: 34, borderWidth: 1, borderColor: COLORS.border, borderRadius: TOKENS.radiusSm, backgroundColor: COLORS.panelBg, color: COLORS.textBright, fontSize: 10, paddingLeft: 8, paddingRight: 8, fontFamily: 'monospace' }} />
          <Pressable onPress={addContact} style={{ paddingHorizontal: 12, paddingVertical: 7, borderRadius: TOKENS.radiusSm, borderWidth: 1, borderColor: COLORS.blue, backgroundColor: COLORS.blueDeep }}>
            <Text fontSize={9} color={COLORS.blue} style={{ fontWeight: 'bold' }}>Save</Text>
          </Pressable>
        </Row>
        {message ? <Text fontSize={9} color={COLORS.textDim}>{message}</Text> : null}
      </Box>

      <Col style={{ gap: 8 }}>
        {props.contacts.length === 0 ? (
          <Box style={{ padding: 10, borderRadius: TOKENS.radiusLg, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.panelAlt }}>
            <Text fontSize={9} color={COLORS.textDim}>No saved contacts yet.</Text>
          </Box>
        ) : props.contacts.map((contact) => (
          <ContactRow key={contact.id} contact={contact} onSelect={props.onSelect} onRemove={props.onRemove} />
        ))}
      </Col>
    </Col>
  );
}

