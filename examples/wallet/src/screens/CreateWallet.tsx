import React, { useState } from 'react';
import { Box, Text, Pressable } from '@reactjit/core';
import { useWallet } from '../wallet/context';

const C = {
  bg: '#11111b',
  surface: '#1e1e2e',
  overlay: '#313244',
  text: '#cdd6f4',
  subtext: '#a6adc8',
  dim: '#585b70',
  accent: '#89b4fa',
  yellow: '#f9e2af',
  red: '#f38ba8',
};

export function CreateWallet() {
  const { state, actions } = useWallet();
  const words = state.mnemonic?.split(' ') || [];
  const [confirmed, setConfirmed] = useState(false);

  if (!state.mnemonic) return null;

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
        <Text style={{ fontSize: 22, color: C.text, fontWeight: '700' }}>
          Recovery Phrase
        </Text>
        <Text style={{ fontSize: 13, color: C.subtext }}>
          Write these 12 words down. They are the only way to recover your wallet.
        </Text>
      </Box>

      {/* Warning */}
      <Box style={{
        backgroundColor: '#2a2215',
        borderRadius: 8,
        paddingLeft: 12, paddingRight: 12,
        paddingTop: 8, paddingBottom: 8,
      }}>
        <Text style={{ fontSize: 12, color: C.yellow }}>
          Never share these words. Anyone with them controls your funds.
        </Text>
      </Box>

      {/* Word grid: 2 columns x 6 rows */}
      <Box style={{ gap: 6 }}>
        {[0, 1, 2, 3, 4, 5].map(row => (
          <Box key={row} style={{ flexDirection: 'row', gap: 8, width: '100%' }}>
            <Box style={{
              flexGrow: 1,
              backgroundColor: C.surface,
              borderRadius: 8,
              paddingLeft: 12, paddingRight: 12,
              paddingTop: 10, paddingBottom: 10,
              flexDirection: 'row',
              gap: 8,
            }}>
              <Text style={{ fontSize: 13, color: C.dim, width: 20 }}>
                {`${row * 2 + 1}.`}
              </Text>
              <Text style={{ fontSize: 14, color: C.text, fontWeight: '600' }}>
                {words[row * 2] || ''}
              </Text>
            </Box>
            <Box style={{
              flexGrow: 1,
              backgroundColor: C.surface,
              borderRadius: 8,
              paddingLeft: 12, paddingRight: 12,
              paddingTop: 10, paddingBottom: 10,
              flexDirection: 'row',
              gap: 8,
            }}>
              <Text style={{ fontSize: 13, color: C.dim, width: 20 }}>
                {`${row * 2 + 2}.`}
              </Text>
              <Text style={{ fontSize: 14, color: C.text, fontWeight: '600' }}>
                {words[row * 2 + 1] || ''}
              </Text>
            </Box>
          </Box>
        ))}
      </Box>

      {/* Spacer */}
      <Box style={{ flexGrow: 1 }} />

      {/* Confirmation toggle */}
      <Pressable
        onPress={() => setConfirmed(!confirmed)}
        style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}
      >
        <Box style={{
          width: 20, height: 20,
          borderRadius: 4,
          borderWidth: 2,
          borderColor: confirmed ? C.accent : C.dim,
          backgroundColor: confirmed ? C.accent : 'transparent',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          {confirmed && (
            <Text style={{ fontSize: 12, color: C.bg, fontWeight: '700' }}>
              {'v'}
            </Text>
          )}
        </Box>
        <Text style={{ fontSize: 13, color: C.subtext }}>
          {"I've written down my recovery phrase"}
        </Text>
      </Pressable>

      {/* Continue button */}
      <Pressable
        onPress={() => {
          if (confirmed) actions.navigate('create-password');
        }}
        style={(s) => ({
          backgroundColor: !confirmed ? C.overlay : s.pressed ? '#7aa2f7' : C.accent,
          paddingTop: 14, paddingBottom: 14,
          borderRadius: 12,
          alignItems: 'center',
          opacity: confirmed ? 1 : 0.4,
        })}
      >
        <Text style={{ fontSize: 15, color: !confirmed ? C.dim : C.bg, fontWeight: '700' }}>
          Continue
        </Text>
      </Pressable>
    </Box>
  );
}
