import React from 'react';
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
  accentDim: '#74c7ec',
  green: '#a6e3a1',
};

export function Welcome() {
  const { actions, state } = useWallet();

  return (
    <Box style={{
      width: '100%',
      height: '100%',
      backgroundColor: C.bg,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 48,
      padding: 32,
    }}>
      {/* Logo area */}
      <Box style={{ alignItems: 'center', gap: 12 }}>
        <Box style={{
          width: 72, height: 72,
          backgroundColor: C.surface,
          borderRadius: 20,
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <Text style={{ fontSize: 36, color: C.accent }}>
            {'{}'}
          </Text>
        </Box>

        <Text style={{ fontSize: 28, color: C.text, fontWeight: '700' }}>
          EtherVault
        </Text>
        <Text style={{ fontSize: 13, color: C.dim }}>
          Private Ethereum wallet
        </Text>
      </Box>

      {/* Buttons */}
      <Box style={{ gap: 12, width: '100%', maxWidth: 320 }}>
        <Pressable
          onPress={() => actions.createWallet()}
          style={(s) => ({
            backgroundColor: s.pressed ? '#7aa2f7' : s.hovered ? '#89b4fa' : C.accent,
            paddingTop: 14,
            paddingBottom: 14,
            borderRadius: 12,
            alignItems: 'center',
          })}
        >
          <Text style={{ fontSize: 15, color: C.bg, fontWeight: '700' }}>
            Create New Wallet
          </Text>
        </Pressable>

        <Pressable
          onPress={() => actions.navigate('import')}
          style={(s) => ({
            backgroundColor: s.pressed ? '#45475a' : s.hovered ? '#313244' : C.surface,
            paddingTop: 14,
            paddingBottom: 14,
            borderRadius: 12,
            alignItems: 'center',
            borderWidth: 1,
            borderColor: C.overlay,
          })}
        >
          <Text style={{ fontSize: 15, color: C.text, fontWeight: '600' }}>
            Import Existing
          </Text>
        </Pressable>
      </Box>

      {/* Footer */}
      <Box style={{ alignItems: 'center', gap: 4 }}>
        <Text style={{ fontSize: 11, color: C.dim }}>
          Keys never leave this device
        </Text>
        <Text style={{ fontSize: 11, color: C.dim }}>
          All traffic routed through Tor
        </Text>
      </Box>
    </Box>
  );
}
