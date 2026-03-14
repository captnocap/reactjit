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

export function SetPassword() {
  const { state, actions } = useWallet();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');

  const valid = password.length >= 8 && password === confirm;
  const mismatch = confirm.length > 0 && password !== confirm;
  const tooShort = password.length > 0 && password.length < 8;

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
          Set Password
        </Text>
        <Text style={{ fontSize: 13, color: C.subtext }}>
          This encrypts your wallet on this device. Min 8 characters.
        </Text>
      </Box>

      {/* Password field */}
      <Box style={{ gap: 8 }}>
        <Text style={{ fontSize: 12, color: C.dim, fontWeight: '600' }}>
          PASSWORD
        </Text>
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
            style={{ width: '100%' }}
            textStyle={{ fontSize: 15, color: C.text }}
          />
        </Box>
        {tooShort && (
          <Text style={{ fontSize: 11, color: C.red }}>
            Must be at least 8 characters
          </Text>
        )}
      </Box>

      {/* Confirm field */}
      <Box style={{ gap: 8 }}>
        <Text style={{ fontSize: 12, color: C.dim, fontWeight: '600' }}>
          CONFIRM PASSWORD
        </Text>
        <Box style={{
          backgroundColor: C.surface,
          borderRadius: 10,
          paddingLeft: 14, paddingRight: 14,
          paddingTop: 12, paddingBottom: 12,
        }}>
          <TextInput
            value={confirm}
            onChangeText={setConfirm}
            placeholder="Confirm password"
            placeholderColor={C.dim}
            secureTextEntry
            style={{ width: '100%' }}
            textStyle={{ fontSize: 15, color: C.text }}
          />
        </Box>
        {mismatch && (
          <Text style={{ fontSize: 11, color: C.red }}>
            Passwords do not match
          </Text>
        )}
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

      {/* Encrypt & Continue */}
      <Pressable
        onPress={() => { if (valid) actions.setPassword(password); }}
        style={(s) => ({
          backgroundColor: !valid ? C.overlay : s.pressed ? '#7aa2f7' : C.accent,
          paddingTop: 14, paddingBottom: 14,
          borderRadius: 12,
          alignItems: 'center',
          opacity: valid ? 1 : 0.4,
        })}
      >
        <Text style={{ fontSize: 15, color: !valid ? C.dim : C.bg, fontWeight: '700' }}>
          Encrypt & Continue
        </Text>
      </Pressable>
    </Box>
  );
}
