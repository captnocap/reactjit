import React, { useState } from 'react';
import { Box, Text, Pressable, useHotState, useLoveRPC, useGifRecorder } from '@reactjit/core';

const C = {
  bg: '#0f172a',
  surface: '#1e293b',
  text: '#e2e8f0',
  muted: '#64748b',
  dim: '#475569',
  hot: '#22c55e',
  hotDim: '#166534',
  cold: '#ef4444',
  coldDim: '#991b1b',
  accent: '#3b82f6',
  accentHover: '#2563eb',
  accentActive: '#1d4ed8',
  rec: '#ef4444',
  recDim: '#7f1d1d',
};

function Counter({
  label,
  count,
  onPress,
  color,
}: {
  label: string;
  count: number;
  onPress: () => void;
  color: string;
}) {
  return (
    <Box style={{ alignItems: 'center', gap: 8 }}>
      <Text style={{ color: C.muted, fontSize: 11, fontWeight: '700' }}>
        {label}
      </Text>
      <Text style={{ color, fontSize: 48, fontWeight: '700' }}>
        {`${count}`}
      </Text>
      <Pressable
        onPress={onPress}
        style={(s) => ({
          backgroundColor: s.pressed ? C.accentActive : s.hovered ? C.accentHover : C.accent,
          paddingLeft: 20,
          paddingRight: 20,
          paddingTop: 8,
          paddingBottom: 8,
          borderRadius: 6,
        })}
      >
        <Text style={{ color: '#fff', fontSize: 13, fontWeight: '700' }}>
          +1
        </Text>
      </Pressable>
    </Box>
  );
}

export function App() {
  // This one dies on HMR — plain React state
  const [coldCount, setColdCount] = useState(0);

  // This one survives HMR — lives in Lua memory
  const [hotCount, setHotCount] = useHotState('demo.counter', 0);

  const reload = useLoveRPC('dev:reload');
  const gif = useGifRecorder();

  return (
    <Box style={{
      width: '100%',
      height: '100%',
      backgroundColor: C.bg,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 32,
      padding: 32,
    }}>

      <Box style={{ alignItems: 'center', gap: 4 }}>
        <Text style={{ color: C.text, fontSize: 24, fontWeight: '700' }}>
          useHotState Demo
        </Text>
        <Text style={{ color: C.muted, fontSize: 13 }}>
          Click both counters, then hit Reload
        </Text>
      </Box>

      {/* ── Side by side counters ──────────────── */}
      <Box style={{
        flexDirection: 'row',
        gap: 48,
        alignItems: 'center',
      }}>
        <Box style={{
          backgroundColor: C.surface,
          borderRadius: 12,
          padding: 24,
          alignItems: 'center',
          gap: 4,
        }}>
          <Box style={{
            backgroundColor: C.coldDim,
            borderRadius: 4,
            paddingLeft: 8,
            paddingRight: 8,
            paddingTop: 2,
            paddingBottom: 2,
          }}>
            <Text style={{ color: C.cold, fontSize: 10, fontWeight: '700' }}>
              useState
            </Text>
          </Box>
          <Counter
            label="RESETS ON HMR"
            count={coldCount}
            onPress={() => setColdCount(c => c + 1)}
            color={C.cold}
          />
        </Box>

        <Text style={{ color: C.dim, fontSize: 20 }}>
          vs
        </Text>

        <Box style={{
          backgroundColor: C.surface,
          borderRadius: 12,
          padding: 24,
          alignItems: 'center',
          gap: 4,
        }}>
          <Box style={{
            backgroundColor: C.hotDim,
            borderRadius: 4,
            paddingLeft: 8,
            paddingRight: 8,
            paddingTop: 2,
            paddingBottom: 2,
          }}>
            <Text style={{ color: C.hot, fontSize: 10, fontWeight: '700' }}>
              useHotState
            </Text>
          </Box>
          <Counter
            label="SURVIVES HMR"
            count={hotCount}
            onPress={() => setHotCount(c => c + 1)}
            color={C.hot}
          />
        </Box>
      </Box>

      {/* ── Action buttons ────────────────────── */}
      <Box style={{ flexDirection: 'row', gap: 16, alignItems: 'center' }}>
        <Pressable
          onPress={() => reload()}
          style={(s) => ({
            backgroundColor: s.pressed ? '#7c3aed' : s.hovered ? '#8b5cf6' : '#6d28d9',
            paddingLeft: 24,
            paddingRight: 24,
            paddingTop: 10,
            paddingBottom: 10,
            borderRadius: 8,
          })}
        >
          <Text style={{ color: '#fff', fontSize: 14, fontWeight: '700' }}>
            Trigger HMR Reload
          </Text>
        </Pressable>

        <Pressable
          onPress={() => gif.recording ? gif.stop() : gif.start({ fps: 15 })}
          style={(s) => ({
            backgroundColor: gif.recording
              ? (s.pressed ? '#991b1b' : s.hovered ? '#b91c1c' : '#dc2626')
              : (s.pressed ? '#065f46' : s.hovered ? '#047857' : '#059669'),
            paddingLeft: 24,
            paddingRight: 24,
            paddingTop: 10,
            paddingBottom: 10,
            borderRadius: 8,
            flexDirection: 'row',
            gap: 8,
            alignItems: 'center',
          })}
        >
          {gif.recording ? (
            <Box style={{
              width: 10,
              height: 10,
              backgroundColor: '#fff',
              borderRadius: 2,
            }} />
          ) : (
            <Box style={{
              width: 10,
              height: 10,
              backgroundColor: C.rec,
              borderRadius: 5,
            }} />
          )}
          <Text style={{ color: '#fff', fontSize: 14, fontWeight: '700' }}>
            {gif.recording ? `Stop (${gif.frames})` : 'Record GIF'}
          </Text>
        </Pressable>
      </Box>

      <Text style={{ color: C.dim, fontSize: 11 }}>
        {gif.gifPath
          ? `GIF saved: ${gif.gifPath}`
          : 'The red counter resets to 0. The green counter keeps its value.'}
      </Text>
    </Box>
  );
}
