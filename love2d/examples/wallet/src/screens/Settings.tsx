import React from 'react';
import { Box, Text, Pressable } from '@reactjit/core';
import { useWallet } from '../wallet/context';
import { chains, type NetworkId } from '../network/chains';

const C = {
  bg: '#11111b',
  surface: '#1e1e2e',
  overlay: '#313244',
  text: '#cdd6f4',
  subtext: '#a6adc8',
  dim: '#585b70',
  accent: '#89b4fa',
  green: '#a6e3a1',
  red: '#f38ba8',
  yellow: '#f9e2af',
};

function SettingsRow({ label, value, onPress }: { label: string; value: string; onPress?: () => void }) {
  const inner = (
    <Box style={{
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      width: '100%',
      paddingTop: 14, paddingBottom: 14,
      paddingLeft: 14, paddingRight: 14,
    }}>
      <Text style={{ fontSize: 14, color: C.text }}>
        {label}
      </Text>
      <Text style={{ fontSize: 14, color: C.subtext }}>
        {value}
      </Text>
    </Box>
  );

  if (onPress) {
    return <Pressable onPress={onPress} style={{ width: '100%' }}>{inner}</Pressable>;
  }
  return inner;
}

export function Settings() {
  const { state, actions } = useWallet();
  const chain = chains[state.network];

  const networkOptions: NetworkId[] = ['mainnet', 'sepolia'];

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
          Settings
        </Text>
      </Box>

      {/* Network selection */}
      <Box style={{ gap: 8 }}>
        <Text style={{ fontSize: 12, color: C.dim, fontWeight: '600' }}>
          NETWORK
        </Text>
        <Box style={{
          backgroundColor: C.surface,
          borderRadius: 12,
          overflow: 'hidden',
        }}>
          {networkOptions.map((id, idx) => {
            const c = chains[id];
            const active = state.network === id;
            return (
              <Pressable
                key={id}
                onPress={() => actions.switchNetwork(id)}
                style={(s) => ({
                  backgroundColor: active ? '#1a2438' : s.hovered ? C.overlay : 'transparent',
                  paddingTop: 12, paddingBottom: 12,
                  paddingLeft: 14, paddingRight: 14,
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  width: '100%',
                  borderTopWidth: idx > 0 ? 1 : 0,
                  borderColor: C.overlay,
                })}
              >
                <Box style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                  <Box style={{
                    width: 8, height: 8,
                    borderRadius: 4,
                    backgroundColor: id === 'mainnet' ? C.green : C.yellow,
                  }} />
                  <Text style={{ fontSize: 14, color: active ? C.accent : C.text }}>
                    {c.name}
                  </Text>
                </Box>
                {active && (
                  <Text style={{ fontSize: 12, color: C.accent }}>
                    Active
                  </Text>
                )}
              </Pressable>
            );
          })}
        </Box>
      </Box>

      {/* Privacy */}
      <Box style={{ gap: 8 }}>
        <Text style={{ fontSize: 12, color: C.dim, fontWeight: '600' }}>
          PRIVACY
        </Text>
        <Box style={{
          backgroundColor: C.surface,
          borderRadius: 12,
        }}>
          <Pressable
            onPress={() => actions.toggleTor()}
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              width: '100%',
              paddingTop: 14, paddingBottom: 14,
              paddingLeft: 14, paddingRight: 14,
            }}
          >
            <Box style={{ gap: 2 }}>
              <Text style={{ fontSize: 14, color: C.text }}>
                Route through Tor
              </Text>
              <Text style={{ fontSize: 11, color: C.dim }}>
                Hides your IP from RPC nodes
              </Text>
            </Box>
            <Box style={{
              width: 44, height: 24,
              borderRadius: 12,
              backgroundColor: state.useTor ? C.green : C.overlay,
              justifyContent: 'center',
              paddingLeft: state.useTor ? 22 : 2,
            }}>
              <Box style={{
                width: 20, height: 20,
                borderRadius: 10,
                backgroundColor: '#ffffff',
              }} />
            </Box>
          </Pressable>
        </Box>
      </Box>

      {/* RPC Info */}
      <Box style={{ gap: 8 }}>
        <Text style={{ fontSize: 12, color: C.dim, fontWeight: '600' }}>
          RPC ENDPOINT
        </Text>
        <Box style={{
          backgroundColor: C.surface,
          borderRadius: 12,
          padding: 14,
        }}>
          <Text style={{ fontSize: 12, color: C.subtext }}>
            {chain.rpc}
          </Text>
        </Box>
      </Box>

      {/* Spacer */}
      <Box style={{ flexGrow: 1 }} />

      {/* Danger zone */}
      <Box style={{ gap: 8 }}>
        <Pressable
          onPress={() => actions.lock()}
          style={(s) => ({
            backgroundColor: s.pressed ? '#45475a' : C.surface,
            paddingTop: 14, paddingBottom: 14,
            borderRadius: 12,
            alignItems: 'center',
            borderWidth: 1,
            borderColor: C.overlay,
          })}
        >
          <Text style={{ fontSize: 15, color: C.text, fontWeight: '600' }}>
            Lock Wallet
          </Text>
        </Pressable>
      </Box>
    </Box>
  );
}
