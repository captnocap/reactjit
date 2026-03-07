import React from 'react';
import { Box, Text, Pressable } from '../../../packages/core/src';
import { useThemeColors } from '../../../packages/theme/src';
import { useVoice } from './VoiceProvider';

export function VoiceToggle() {
  const c = useThemeColors();
  const { voice, setVoice } = useVoice();
  const isShitpost = voice === 'shitpost';

  return (
    <Pressable
      onPress={() => setVoice(isShitpost ? 'corpo' : 'shitpost')}
      style={(state) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingLeft: 8,
        paddingRight: 8,
        paddingTop: 3,
        paddingBottom: 3,
        borderRadius: 4,
        backgroundColor: state.hovered ? c.surface : 'transparent',
      })}
    >
      <Text style={{ fontSize: 10, color: c.textDim }}>
        {isShitpost ? 'unhinged' : 'corporate'}
      </Text>
      <Box style={{
        width: 26,
        height: 14,
        borderRadius: 7,
        backgroundColor: isShitpost ? c.accent : c.border,
        justifyContent: 'center',
        paddingLeft: isShitpost ? 0 : 2,
        paddingRight: isShitpost ? 2 : 0,
        alignItems: isShitpost ? 'flex-end' : 'flex-start',
      }}>
        <Box style={{
          width: 10,
          height: 10,
          borderRadius: 5,
          backgroundColor: '#ffffff',
        }} />
      </Box>
    </Pressable>
  );
}
