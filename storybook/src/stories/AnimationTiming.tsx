import React, { useState } from 'react';
import { Box, Text, Pressable, useSpring } from '../../../packages/shared/src';
import { useThemeColors } from '../../../packages/theme/src';

export function AnimationTimingStory() {
  const c = useThemeColors();
  const [expanded, setExpanded] = useState(false);
  const width = useSpring(expanded ? 260 : 80, { stiffness: 120, damping: 14 });

  return (
    <Box style={{ width: '100%', gap: 16, padding: 16 }}>
      <Pressable
        onPress={() => setExpanded(e => !e)}
        style={{
          backgroundColor: c.primary,
          padding: 10,
          borderRadius: 6,
          alignItems: 'center',
          width: 120,
        }}
      >
        <Text style={{ color: '#fff', fontSize: 12 }}>
          {expanded ? 'Collapse' : 'Expand'}
        </Text>
      </Pressable>

      <Box style={{
        width,
        height: 50,
        backgroundColor: c.accent,
        borderRadius: 6,
        justifyContent: 'center',
        alignItems: 'center',
        overflow: 'hidden',
      }}>
        <Text style={{ color: '#fff', fontSize: 12 }}>
          {`${Math.round(width)}px`}
        </Text>
      </Box>

      <Text style={{ color: c.textDim, fontSize: 10 }}>
        Uses useSpring for physics-based animation
      </Text>
    </Box>
  );
}
