import { useEffect, useState } from 'react';
import { Box, Text } from '@reactjit/runtime/primitives';

const STATIC_ANGLES = [-90, -45, 0, 45, 90, 135, 180, -135];

export default function RotateText() {
  const [angle, setAngle] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setAngle((a: number) => (a + 4) % 360), 32);
    return () => clearInterval(id);
  }, []);

  return (
    <Box
      style={{
        width: '100%',
        height: '100%',
        backgroundColor: '#0b1020',
        padding: 32,
        flexDirection: 'column',
        gap: 32,
      }}
    >
      <Text style={{ fontSize: 24, fontWeight: 700, color: '#f8fafc' }}>
        rotate text
      </Text>

      {/* Static angles row */}
      <Box
        style={{
          flexDirection: 'row',
          gap: 32,
          alignItems: 'center',
          justifyContent: 'center',
          height: 160,
        }}
      >
        {STATIC_ANGLES.map((deg) => (
          <Box
            key={deg}
            style={{
              width: 100,
              height: 100,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Box style={{ transform: { rotate: deg } }}>
              <Text style={{ fontSize: 18, color: '#7dd3fc', fontWeight: 600 }}>
                {deg}°
              </Text>
            </Box>
          </Box>
        ))}
      </Box>

      {/* Animated spinning text */}
      <Box
        style={{
          flexDirection: 'row',
          gap: 48,
          alignItems: 'center',
          justifyContent: 'center',
          flexGrow: 1,
        }}
      >
        <Box
          style={{
            width: 200,
            height: 200,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#111827',
            borderRadius: 12,
          }}
        >
          <Box style={{ transform: { rotate: angle } }}>
            <Text style={{ fontSize: 28, color: '#fbbf24', fontWeight: 700 }}>
              spin →
            </Text>
          </Box>
        </Box>

        <Box
          style={{
            width: 200,
            height: 200,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#111827',
            borderRadius: 12,
          }}
        >
          <Box style={{ transform: { rotate: -angle } }}>
            <Text style={{ fontSize: 28, color: '#a7f3d0', fontWeight: 700 }}>
              ← spin
            </Text>
          </Box>
        </Box>

        <Box
          style={{
            width: 200,
            height: 200,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#111827',
            borderRadius: 12,
            gap: 4,
          }}
        >
          <Box style={{ transform: { rotate: angle } }}>
            <Text style={{ fontSize: 14, color: '#f472b6' }}>outer</Text>
          </Box>
          <Box style={{ transform: { rotate: -angle * 2 } }}>
            <Text style={{ fontSize: 20, color: '#f8fafc', fontWeight: 700 }}>
              {angle}°
            </Text>
          </Box>
          <Box style={{ transform: { rotate: angle } }}>
            <Text style={{ fontSize: 14, color: '#f472b6' }}>inner</Text>
          </Box>
        </Box>
      </Box>

      <Text style={{ fontSize: 12, color: '#64748b' }}>
        rotation via style.transform.rotate (degrees)
      </Text>
    </Box>
  );
}
