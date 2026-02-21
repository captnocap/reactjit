import React, { useState } from 'react';
import { Box, Text, Pressable, TextInput } from '@reactjit/core';
import { useWallet } from '../wallet/context';
import { formatEther } from '../network/rpc';
import { chains } from '../network/chains';

const C = {
  bg: '#11111b',
  surface: '#1e1e2e',
  overlay: '#313244',
  text: '#cdd6f4',
  subtext: '#a6adc8',
  dim: '#585b70',
  accent: '#89b4fa',
  red: '#f38ba8',
};

export function Send() {
  const { state, actions } = useWallet();
  const [to, setTo] = useState('');
  const [amount, setAmount] = useState('');
  const [sending, setSending] = useState(false);

  const chain = chains[state.network];
  const validAddress = /^0x[0-9a-fA-F]{40}$/.test(to);
  const validAmount = amount.length > 0 && !isNaN(Number(amount)) && Number(amount) > 0;
  const canSend = validAddress && validAmount && !sending;

  const handleSend = async () => {
    if (!canSend) return;
    setSending(true);
    try {
      await actions.send({ to, value: amount });
    } finally {
      setSending(false);
    }
  };

  return (
    <Box style={{
      width: '100%',
      height: '100%',
      backgroundColor: C.bg,
      padding: 24,
      gap: 20,
    }}>
      {/* Header */}
      <Box style={{ gap: 4 }}>
        <Pressable onPress={() => actions.navigate('dashboard')}>
          <Text style={{ fontSize: 13, color: C.dim }}>
            {'< Back'}
          </Text>
        </Pressable>
        <Text style={{ fontSize: 22, color: C.text, fontWeight: '700' }}>
          {`Send ${chain.symbol}`}
        </Text>
      </Box>

      {/* Available balance */}
      <Box style={{
        backgroundColor: C.surface,
        borderRadius: 10,
        paddingLeft: 14, paddingRight: 14,
        paddingTop: 10, paddingBottom: 10,
        flexDirection: 'row',
        justifyContent: 'space-between',
        width: '100%',
      }}>
        <Text style={{ fontSize: 12, color: C.dim }}>
          Available
        </Text>
        <Text style={{ fontSize: 12, color: C.subtext, fontWeight: '600' }}>
          {`${formatEther(state.balance)} ${chain.symbol}`}
        </Text>
      </Box>

      {/* Recipient */}
      <Box style={{ gap: 8 }}>
        <Text style={{ fontSize: 12, color: C.dim, fontWeight: '600' }}>
          RECIPIENT
        </Text>
        <Box style={{
          backgroundColor: C.surface,
          borderRadius: 10,
          paddingLeft: 14, paddingRight: 14,
          paddingTop: 12, paddingBottom: 12,
        }}>
          <TextInput
            value={to}
            onChangeText={setTo}
            placeholder="0x..."
            placeholderColor={C.dim}
            style={{ width: '100%' }}
            textStyle={{ fontSize: 14, color: C.text }}
          />
        </Box>
        {to.length > 0 && !validAddress && (
          <Text style={{ fontSize: 11, color: C.red }}>
            Invalid Ethereum address
          </Text>
        )}
      </Box>

      {/* Amount */}
      <Box style={{ gap: 8 }}>
        <Text style={{ fontSize: 12, color: C.dim, fontWeight: '600' }}>
          AMOUNT (ETH)
        </Text>
        <Box style={{
          backgroundColor: C.surface,
          borderRadius: 10,
          paddingLeft: 14, paddingRight: 14,
          paddingTop: 12, paddingBottom: 12,
        }}>
          <TextInput
            value={amount}
            onChangeText={setAmount}
            placeholder="0.0"
            placeholderColor={C.dim}
            style={{ width: '100%' }}
            textStyle={{ fontSize: 14, color: C.text }}
          />
        </Box>
      </Box>

      {/* Error */}
      {state.error && (
        <Box style={{
          backgroundColor: '#2a1520',
          borderRadius: 8,
          paddingLeft: 12, paddingRight: 12,
          paddingTop: 8, paddingBottom: 8,
        }}>
          <Text style={{ fontSize: 12, color: C.red }}>
            {state.error}
          </Text>
        </Box>
      )}

      {/* Spacer */}
      <Box style={{ flexGrow: 1 }} />

      {/* Gas info */}
      <Box style={{
        backgroundColor: C.surface,
        borderRadius: 10,
        paddingLeft: 14, paddingRight: 14,
        paddingTop: 10, paddingBottom: 10,
        gap: 4,
      }}>
        <Text style={{ fontSize: 11, color: C.dim }}>
          Gas will be estimated at send time
        </Text>
        <Text style={{ fontSize: 11, color: C.dim }}>
          {state.useTor ? 'Routing through Tor' : 'Direct connection (no Tor)'}
        </Text>
      </Box>

      {/* Send button */}
      <Pressable
        onPress={handleSend}
        style={(s) => ({
          backgroundColor: !canSend ? C.overlay : s.pressed ? '#7aa2f7' : C.accent,
          paddingTop: 14, paddingBottom: 14,
          borderRadius: 12,
          alignItems: 'center',
          opacity: canSend ? 1 : 0.4,
        })}
      >
        <Text style={{ fontSize: 15, color: !canSend ? C.dim : C.bg, fontWeight: '700' }}>
          {sending ? 'Signing & Broadcasting...' : `Send ${chain.symbol}`}
        </Text>
      </Pressable>
    </Box>
  );
}
