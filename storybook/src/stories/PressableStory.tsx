import React, { useState } from 'react';
import { Box, Text, Pressable } from '../../../packages/shared/src';
import { useThemeColors } from '../../../packages/theme/src';

export function PressableStory() {
  const c = useThemeColors();
  const [pressCount, setPressCount] = useState(0);
  const [lastAction, setLastAction] = useState('none');

  return (
    <Box style={{ width: '100%', gap: 20, padding: 20 }}>

      {/* Primary buttons */}
      <Box style={{ gap: 6 }}>
        <Text style={{ color: c.textSecondary, fontSize: 11, fontWeight: 'bold' }}>Primary</Text>
        <Box style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap' }}>
          <Pressable
            onPress={() => {
              setPressCount(c2 => c2 + 1);
              setLastAction('press');
            }}
            style={({ pressed, hovered }) => ({
              backgroundColor: pressed ? c.primaryPressed : hovered ? c.primaryHover : c.primary,
              paddingLeft: 20,
              paddingRight: 20,
              paddingTop: 10,
              paddingBottom: 10,
              borderRadius: 6,
              alignItems: 'center',
            })}
          >
            {({ pressed, hovered }) => (
              <Text style={{ color: '#ffffff', fontSize: 14, fontWeight: '600' }}>
                {pressed ? 'Pressing...' : hovered ? 'Hovering!' : 'Press me'}
              </Text>
            )}
          </Pressable>

          <Pressable
            onPress={() => setLastAction('success')}
            style={({ pressed, hovered }) => ({
              backgroundColor: pressed ? '#16a34a' : hovered ? c.success : '#15803d',
              paddingLeft: 20,
              paddingRight: 20,
              paddingTop: 10,
              paddingBottom: 10,
              borderRadius: 6,
              alignItems: 'center',
            })}
          >
            <Text style={{ color: '#ffffff', fontSize: 14, fontWeight: '600' }}>Confirm</Text>
          </Pressable>

          <Pressable
            onPress={() => setLastAction('danger')}
            style={({ pressed, hovered }) => ({
              backgroundColor: pressed ? '#b91c1c' : hovered ? c.error : c.error,
              paddingLeft: 20,
              paddingRight: 20,
              paddingTop: 10,
              paddingBottom: 10,
              borderRadius: 6,
              alignItems: 'center',
            })}
          >
            <Text style={{ color: '#ffffff', fontSize: 14, fontWeight: '600' }}>Delete</Text>
          </Pressable>
        </Box>
      </Box>

      {/* Secondary / outlined buttons */}
      <Box style={{ gap: 6 }}>
        <Text style={{ color: c.textSecondary, fontSize: 11, fontWeight: 'bold' }}>Secondary</Text>
        <Box style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap' }}>
          <Pressable
            onPress={() => setLastAction('secondary')}
            style={({ pressed, hovered }) => ({
              backgroundColor: pressed ? c.surface : hovered ? c.bgElevated : 'transparent',
              borderWidth: 1,
              borderColor: hovered ? c.textSecondary : c.border,
              paddingLeft: 20,
              paddingRight: 20,
              paddingTop: 10,
              paddingBottom: 10,
              borderRadius: 6,
              alignItems: 'center',
            })}
          >
            <Text style={{ color: c.text, fontSize: 14 }}>Outlined</Text>
          </Pressable>

          <Pressable
            onPress={() => setLastAction('ghost')}
            style={({ pressed, hovered }) => ({
              backgroundColor: pressed ? c.bgElevated : hovered ? c.bg : 'transparent',
              paddingLeft: 20,
              paddingRight: 20,
              paddingTop: 10,
              paddingBottom: 10,
              borderRadius: 6,
              alignItems: 'center',
            })}
          >
            {({ hovered }) => (
              <Text style={{ color: hovered ? c.text : c.textSecondary, fontSize: 14 }}>Ghost</Text>
            )}
          </Pressable>
        </Box>
      </Box>

      {/* Long press */}
      <Box style={{ gap: 6 }}>
        <Text style={{ color: c.textSecondary, fontSize: 11, fontWeight: 'bold' }}>Long Press</Text>
        <Box style={{ flexDirection: 'row', gap: 10 }}>
          <Pressable
            onPress={() => setLastAction('short press')}
            onLongPress={() => setLastAction('LONG PRESS')}
            style={({ pressed, hovered }) => ({
              backgroundColor: pressed ? c.accent : hovered ? c.accent : '#6d28d9',
              paddingLeft: 20,
              paddingRight: 20,
              paddingTop: 10,
              paddingBottom: 10,
              borderRadius: 6,
              alignItems: 'center',
            })}
          >
            {({ pressed }) => (
              <Text style={{ color: '#ffffff', fontSize: 14, fontWeight: '600' }}>
                {pressed ? 'Hold...' : 'Long press me'}
              </Text>
            )}
          </Pressable>
        </Box>
      </Box>

      {/* Disabled */}
      <Box style={{ gap: 6 }}>
        <Text style={{ color: c.textSecondary, fontSize: 11, fontWeight: 'bold' }}>Disabled</Text>
        <Box style={{ flexDirection: 'row', gap: 10 }}>
          <Pressable
            disabled
            onPress={() => {}}
            style={{
              backgroundColor: c.bgElevated,
              paddingLeft: 20,
              paddingRight: 20,
              paddingTop: 10,
              paddingBottom: 10,
              borderRadius: 6,
              alignItems: 'center',
            }}
          >
            <Text style={{ color: c.textDim, fontSize: 14 }}>Disabled</Text>
          </Pressable>
        </Box>
      </Box>

      {/* Status */}
      <Box style={{
        padding: 12,
        backgroundColor: c.bgElevated,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: c.border,
        gap: 6,
      }}>
        <Text style={{ color: c.textSecondary, fontSize: 11, fontWeight: 'bold' }}>State</Text>
        <Text style={{ color: c.text, fontSize: 13 }}>
          {`Press count: ${pressCount}`}
        </Text>
        <Text style={{ color: c.text, fontSize: 13 }}>
          {`Last action: ${lastAction}`}
        </Text>
      </Box>
    </Box>
  );
}
