import React, { useState } from 'react';
import { Box, Text, Pressable, useSpring } from '../../../packages/shared/src';
import { useThemeColors } from '../../../packages/theme/src';

export function AnimationSpringStory() {
  const c = useThemeColors();
  const [toggled, setToggled] = useState(false);
  const x = useSpring(toggled ? 160 : 0, { stiffness: 180, damping: 12 });
  const scale = useSpring(toggled ? 1.2 : 1.0, { stiffness: 200, damping: 10 });

  return (
    <Box style={{ width: '100%', gap: 16, padding: 16 }}>
      <Pressable
        onPress={() => setToggled(t => !t)}
        style={{
          backgroundColor: c.success,
          padding: 10,
          borderRadius: 6,
          alignItems: 'center',
          width: 120,
        }}
      >
        <Text style={{ color: '#fff', fontSize: 12 }}>Toggle</Text>
      </Pressable>

      <Box style={{
        width: 60, height: 60,
        backgroundColor: '#ef4444',
        borderRadius: 30,
        transform: { translateX: x, scaleX: scale, scaleY: scale },
        justifyContent: 'center',
        alignItems: 'center',
      }}>
        <Text style={{ color: '#fff', fontSize: 10 }}>
          {Math.round(x)}
        </Text>
      </Box>

      <Box style={{
        padding: 8, backgroundColor: c.bgElevated, borderRadius: 4, gap: 2,
      }}>
        <Text style={{ color: c.textDim, fontSize: 10 }}>
          {`translateX: ${Math.round(x)}px`}
        </Text>
        <Text style={{ color: c.textDim, fontSize: 10 }}>
          {`scale: ${scale.toFixed(2)}`}
        </Text>
      </Box>
    </Box>
  );
}
