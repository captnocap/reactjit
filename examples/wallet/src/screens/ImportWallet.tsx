import React, { useState } from 'react';
import { Box, Text, Pressable, TextInput } from '@reactjit/core';
import { useWallet } from '../wallet/context';

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

export function ImportWallet() {
  const { state, actions } = useWallet();
  const [mnemonic, setMnemonic] = useState('');

  const wordCount = mnemonic.trim().split(/\s+/).filter(Boolean).length;
  const canImport = wordCount === 12;

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
        <Pressable onPress={() => actions.navigate('welcome')}>
          <Text style={{ fontSize: 13, color: C.dim }}>
            {'< Back'}
          </Text>
        </Pressable>
        <Text style={{ fontSize: 22, color: C.text, fontWeight: '700' }}>
          Import Wallet
        </Text>
        <Text style={{ fontSize: 13, color: C.subtext }}>
          Enter your 12-word recovery phrase
        </Text>
      </Box>

      {/* Mnemonic input */}
      <Box style={{
        backgroundColor: C.surface,
        borderRadius: 12,
        padding: 16,
        minHeight: 120,
      }}>
        <TextInput
          value={mnemonic}
          onChangeText={setMnemonic}
          placeholder="Enter your recovery phrase..."
          placeholderColor={C.dim}
          multiline
          style={{
            width: '100%',
            minHeight: 100,
          }}
          textStyle={{
            fontSize: 15,
            color: C.text,
          }}
        />
      </Box>

      {/* Word count */}
      <Text style={{
        fontSize: 12,
        color: canImport ? '#a6e3a1' : C.dim,
      }}>
        {`${wordCount}/12 words`}
      </Text>

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

      {/* Import button */}
      <Pressable
        onPress={() => {
          if (canImport) actions.importWallet(mnemonic);
        }}
        style={(s) => ({
          backgroundColor: !canImport ? C.overlay : s.pressed ? '#7aa2f7' : C.accent,
          paddingTop: 14, paddingBottom: 14,
          borderRadius: 12,
          alignItems: 'center',
          opacity: canImport ? 1 : 0.4,
        })}
      >
        <Text style={{ fontSize: 15, color: !canImport ? C.dim : C.bg, fontWeight: '700' }}>
          Import
        </Text>
      </Pressable>
    </Box>
  );
}
