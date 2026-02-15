import React from 'react';
import { Box, Text } from '../../../../packages/shared/src';

export function TransformStory() {
  return (
    <Box style={{ gap: 24, padding: 24 }}>
      {/* Rotation */}
      <Box style={{ flexDirection: 'row', gap: 16, alignItems: 'center' }}>
        <Text style={{ color: '#888', fontSize: 10, width: 60 }}>rotate</Text>
        {[0, 15, 45, 90].map(deg => (
          <Box key={deg} style={{
            width: 50, height: 50,
            backgroundColor: '#3b82f6',
            borderRadius: 4,
            transform: { rotate: deg },
            justifyContent: 'center', alignItems: 'center',
          }}>
            <Text style={{ color: '#fff', fontSize: 10 }}>{deg}</Text>
          </Box>
        ))}
      </Box>

      {/* Scale */}
      <Box style={{ flexDirection: 'row', gap: 16, alignItems: 'center' }}>
        <Text style={{ color: '#888', fontSize: 10, width: 60 }}>scale</Text>
        {[0.5, 0.75, 1.0, 1.25].map(s => (
          <Box key={s} style={{
            width: 50, height: 50,
            backgroundColor: '#22c55e',
            borderRadius: 4,
            transform: { scaleX: s, scaleY: s },
            justifyContent: 'center', alignItems: 'center',
          }}>
            <Text style={{ color: '#fff', fontSize: 10 }}>{`${s}x`}</Text>
          </Box>
        ))}
      </Box>

      {/* Translate */}
      <Box style={{ flexDirection: 'row', gap: 16, alignItems: 'center' }}>
        <Text style={{ color: '#888', fontSize: 10, width: 60 }}>translate</Text>
        <Box style={{
          width: 50, height: 50,
          backgroundColor: '#ef4444',
          borderRadius: 4,
          transform: { translateX: 10, translateY: -5 },
          justifyContent: 'center', alignItems: 'center',
        }}>
          <Text style={{ color: '#fff', fontSize: 9 }}>10, -5</Text>
        </Box>
        <Box style={{
          width: 50, height: 50,
          backgroundColor: '#f97316',
          borderRadius: 4,
          transform: { translateX: 0, translateY: 15 },
          justifyContent: 'center', alignItems: 'center',
        }}>
          <Text style={{ color: '#fff', fontSize: 9 }}>0, 15</Text>
        </Box>
      </Box>

      {/* Combined */}
      <Box style={{ flexDirection: 'row', gap: 16, alignItems: 'center' }}>
        <Text style={{ color: '#888', fontSize: 10, width: 60 }}>combined</Text>
        <Box style={{
          width: 50, height: 50,
          backgroundColor: '#8b5cf6',
          borderRadius: 4,
          transform: { rotate: 30, scaleX: 1.2, scaleY: 1.2, translateX: 5 },
          justifyContent: 'center', alignItems: 'center',
        }}>
          <Text style={{ color: '#fff', fontSize: 9 }}>all</Text>
        </Box>
      </Box>
    </Box>
  );
}
