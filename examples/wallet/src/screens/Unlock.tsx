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

export function Unlock() {
  const { state, actions } = useWallet();
  const [password, setPassword] = useState('');

  return (
    <Box style={{
      width: '100%',
      height: '100%',
      backgroundColor: C.bg,
      alignItems: 'center',
      justifyContent: 'center',
      padding: 32,
      gap: 32,
    }}>
      {/* Logo */}
      <Box style={{ alignItems: 'center', gap: 12 }}>
        <Box style={{
          width: 64, height: 64,
          backgroundColor: C.surface,
          borderRadius: 18,
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <Text style={{ fontSize: 32, color: C.accent }}>
            {'{}'}
          </Text>
        </Box>
        <Text style={{ fontSize: 22, color: C.text, fontWeight: '700' }}>
          EtherVault
        </Text>
      </Box>

      {/* Password input */}
      <Box style={{ width: '100%', maxWidth: 320, gap: 12 }}>
        <Box style={{
          backgroundColor: C.surface,
          borderRadius: 10,
          paddingLeft: 14, paddingRight: 14,
          paddingTop: 12, paddingBottom: 12,
        }}>
          <TextInput
            value={password}
            onChangeText={setPassword}
            placeholder="Enter password"
            placeholderColor={C.dim}
            secureTextEntry
            onSubmit={() => { if (password.length > 0) actions.unlock(password); }}
            style={{ width: '100%' }}
            textStyle={{ fontSize: 15, color: C.text }}
          />
        </Box>

        {state.error && (
          <Text style={{ fontSize: 12, color: C.red, textAlign: 'center' }}>
            {state.error}
          </Text>
        )}

        <Pressable
          onPress={() => { if (password.length > 0) actions.unlock(password); }}
          style={(s) => ({
            backgroundColor: password.length === 0 ? C.overlay : s.pressed ? '#7aa2f7' : C.accent,
            paddingTop: 14, paddingBottom: 14,
            borderRadius: 12,
            alignItems: 'center',
            opacity: password.length > 0 ? 1 : 0.4,
          })}
        >
          <Text style={{ fontSize: 15, color: password.length === 0 ? C.dim : C.bg, fontWeight: '700' }}>
            Unlock
          </Text>
        </Pressable>
      </Box>
    </Box>
  );
}
