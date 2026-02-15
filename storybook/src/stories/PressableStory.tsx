import React, { useState } from 'react';
import { Box, Text, Pressable } from '../../../../packages/shared/src';

export function PressableStory() {
  const [pressCount, setPressCount] = useState(0);
  const [lastAction, setLastAction] = useState('none');

  return (
    <Box style={{ gap: 12, padding: 16 }}>
      {/* Basic pressable */}
      <Pressable
        onPress={() => {
          setPressCount(c => c + 1);
          setLastAction('press');
        }}
        style={({ pressed, hovered }) => ({
          backgroundColor: pressed ? '#1d4ed8' : hovered ? '#2563eb' : '#3b82f6',
          padding: 12,
          borderRadius: 6,
          alignItems: 'center',
        })}
      >
        {({ pressed, hovered }) => (
          <Text style={{ color: '#fff', fontSize: 13 }}>
            {pressed ? 'Pressing...' : hovered ? 'Hovering!' : 'Press me'}
          </Text>
        )}
      </Pressable>

      {/* Long press */}
      <Pressable
        onPress={() => setLastAction('short press')}
        onLongPress={() => setLastAction('LONG PRESS')}
        style={({ pressed }) => ({
          backgroundColor: pressed ? '#b91c1c' : '#ef4444',
          padding: 12,
          borderRadius: 6,
          alignItems: 'center',
        })}
      >
        <Text style={{ color: '#fff', fontSize: 13 }}>Long press me</Text>
      </Pressable>

      {/* Disabled */}
      <Pressable
        disabled
        onPress={() => {}}
        style={{
          backgroundColor: '#374151',
          padding: 12,
          borderRadius: 6,
          alignItems: 'center',
        }}
      >
        <Text style={{ color: '#6b7280', fontSize: 13 }}>Disabled</Text>
      </Pressable>

      {/* Status */}
      <Box style={{ padding: 8, backgroundColor: '#1e293b', borderRadius: 4, gap: 4 }}>
        <Text style={{ color: '#888', fontSize: 11 }}>
          {`Press count: ${pressCount}`}
        </Text>
        <Text style={{ color: '#888', fontSize: 11 }}>
          {`Last action: ${lastAction}`}
        </Text>
      </Box>
    </Box>
  );
}
