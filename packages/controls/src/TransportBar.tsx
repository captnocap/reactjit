import React from 'react';
import type { Style, Color } from '@reactjit/core';
import { Box, Text, Pressable } from '@reactjit/core';
import { useRendererMode } from '@reactjit/core';
import { useScaledStyle, useScale } from '@reactjit/core';
import { LEDIndicator } from './LEDIndicator';

export interface TransportBarProps {
  playing?: boolean;
  recording?: boolean;
  onPlay?: () => void;
  onStop?: () => void;
  onRecord?: () => void;
  position?: string;
  bpm?: number;
  style?: Style;
}

function TransportButton({
  label,
  onPress,
  color,
  active,
}: {
  label: string;
  onPress?: () => void;
  color: string;
  active?: boolean;
}) {
  const scale = useScale();

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed, hovered }) => ({
        backgroundColor: pressed
          ? color + '40'
          : active
            ? color
            : hovered ? color + '20' : '#252836',
        borderWidth: 1,
        borderColor: active ? color : '#2e3348',
        paddingLeft: Math.round(12 * scale),
        paddingRight: Math.round(12 * scale),
        paddingTop: Math.round(6 * scale),
        paddingBottom: Math.round(6 * scale),
        borderRadius: Math.round(4 * scale),
        alignItems: 'center' as const,
      })}
    >
      <Text
        style={{
          color: active ? '#fff' : color,
          fontSize: Math.round(11 * scale),
          fontWeight: '600',
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export function TransportBar({
  playing = false,
  recording = false,
  onPlay,
  onStop,
  onRecord,
  position,
  bpm,
  style,
}: TransportBarProps) {
  const scale = useScale();
  const scaledStyle = useScaledStyle(style);

  return (
    <Box
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: Math.round(10 * scale),
        backgroundColor: '#1a1d27',
        borderWidth: 1,
        borderColor: '#2e3348',
        borderRadius: Math.round(6 * scale),
        padding: Math.round(8 * scale),
        width: '100%',
        ...scaledStyle,
      }}
    >
      {/* Transport buttons */}
      <Box style={{ flexDirection: 'row', gap: Math.round(6 * scale) }}>
        <TransportButton
          label={playing ? 'STOP' : 'PLAY'}
          onPress={playing ? onStop : onPlay}
          color={playing ? '#ef4444' : '#22c55e'}
          active={playing}
        />
        {onRecord && (
          <TransportButton
            label="REC"
            onPress={onRecord}
            color="#ef4444"
            active={recording}
          />
        )}
      </Box>

      {/* Recording indicator */}
      {onRecord && (
        <LEDIndicator on={recording} color="#ef4444" size={6} />
      )}

      {/* BPM display */}
      {bpm !== undefined && (
        <Box
          style={{
            backgroundColor: '#0f1117',
            borderRadius: Math.round(4 * scale),
            paddingLeft: Math.round(8 * scale),
            paddingRight: Math.round(8 * scale),
            paddingTop: Math.round(4 * scale),
            paddingBottom: Math.round(4 * scale),
            alignItems: 'center',
          }}
        >
          <Text
            style={{
              color: '#f59e0b',
              fontSize: Math.round(14 * scale),
              fontWeight: '700',
            }}
          >
            {`${bpm}`}
          </Text>
          <Text
            style={{
              color: '#64748b',
              fontSize: Math.round(8 * scale),
            }}
          >
            BPM
          </Text>
        </Box>
      )}

      {/* Position display */}
      {position && (
        <Box
          style={{
            backgroundColor: '#0f1117',
            borderRadius: Math.round(4 * scale),
            paddingLeft: Math.round(8 * scale),
            paddingRight: Math.round(8 * scale),
            paddingTop: Math.round(4 * scale),
            paddingBottom: Math.round(4 * scale),
            alignItems: 'center',
          }}
        >
          <Text
            style={{
              color: '#fbbf24',
              fontSize: Math.round(14 * scale),
              fontWeight: '700',
            }}
          >
            {position}
          </Text>
          <Text
            style={{
              color: '#64748b',
              fontSize: Math.round(8 * scale),
            }}
          >
            POS
          </Text>
        </Box>
      )}

      {/* Status LEDs */}
      <Box style={{ flexDirection: 'row', gap: Math.round(6 * scale), marginLeft: 'auto' }}>
        <LEDIndicator on={playing} color="#22c55e" size={6} />
      </Box>
    </Box>
  );
}
