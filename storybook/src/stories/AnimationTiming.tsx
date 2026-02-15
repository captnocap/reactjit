import React, { useState } from 'react';
import { Box, Text, Pressable, useSpring } from '../../../../packages/shared/src';

export function AnimationTimingStory() {
  const [expanded, setExpanded] = useState(false);
  const width = useSpring(expanded ? 260 : 80, { stiffness: 120, damping: 14 });

  return (
    <Box style={{ gap: 16, padding: 16 }}>
      <Pressable
        onPress={() => setExpanded(e => !e)}
        style={{
          backgroundColor: '#3b82f6',
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
        backgroundColor: '#8b5cf6',
        borderRadius: 6,
        justifyContent: 'center',
        alignItems: 'center',
        overflow: 'hidden',
      }}>
        <Text style={{ color: '#fff', fontSize: 12 }}>
          {`${Math.round(width)}px`}
        </Text>
      </Box>

      <Text style={{ color: '#666', fontSize: 10 }}>
        Uses useSpring for physics-based animation
      </Text>
    </Box>
  );
}
