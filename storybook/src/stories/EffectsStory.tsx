import React, { useState } from 'react';
import { Box, Text, Pressable, Spirograph, Rings, FlowParticles, Mirror, Mandala, Cymatics } from '../../../packages/shared/src';
import { useThemeColors } from '../../../packages/theme/src';

const effects = [
  { name: 'Spirograph', Component: Spirograph },
  { name: 'Rings', Component: Rings },
  { name: 'FlowParticles', Component: FlowParticles },
  { name: 'Mirror', Component: Mirror },
  { name: 'Mandala', Component: Mandala },
  { name: 'Cymatics', Component: Cymatics },
] as const;

export function EffectsStory() {
  const c = useThemeColors();
  const [selected, setSelected] = useState(0);
  const SelectedEffect = effects[selected].Component;

  return (
    <Box style={{ width: '100%', height: '100%', padding: 12, gap: 10 }}>
      {/* Header */}
      <Text style={{ color: c.text, fontSize: 14, fontWeight: 'bold' }}>Generative Effects</Text>

      {/* Effect selector */}
      <Box style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
        {effects.map((eff, i) => (
          <Pressable
            key={eff.name}
            onPress={() => setSelected(i)}
            style={{
              paddingHorizontal: 10,
              paddingVertical: 5,
              borderRadius: 6,
              backgroundColor: i === selected ? c.primary : c.surface,
              borderWidth: 1,
              borderColor: i === selected ? c.primary : c.border,
            }}
          >
            <Text style={{
              fontSize: 11,
              color: i === selected ? '#fff' : c.textSecondary,
            }}>{eff.name}</Text>
          </Pressable>
        ))}
      </Box>

      {/* Main content: standalone + background demo side by side */}
      <Box style={{ flexDirection: 'row', gap: 10, flexGrow: 1 }}>
        {/* Standalone effect */}
        <Box style={{ flexGrow: 1, gap: 6 }}>
          <Text style={{ color: c.textSecondary, fontSize: 10 }}>Standalone</Text>
          <Box style={{
            flexGrow: 1,
            borderRadius: 8,
            borderWidth: 1,
            borderColor: c.border,
            overflow: 'hidden',
          }}>
            <SelectedEffect />
          </Box>
        </Box>

        {/* Background texture demo */}
        <Box style={{ width: 220, gap: 6 }}>
          <Text style={{ color: c.textSecondary, fontSize: 10 }}>As Background</Text>
          <Box style={{
            flexGrow: 1,
            gap: 8,
          }}>
            {/* Card with effect background */}
            <Box style={{
              borderRadius: 10,
              borderWidth: 1,
              borderColor: c.border,
              padding: 14,
              overflow: 'hidden',
              flexGrow: 1,
              justifyContent: 'flex-end',
            }}>
              <SelectedEffect background />
              <Text style={{ color: '#fff', fontSize: 13, fontWeight: 'bold' }}>
                {effects[selected].name}
              </Text>
              <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 10, marginTop: 4 }}>
                Living background texture
              </Text>
            </Box>

            {/* Second card with different effect */}
            <Box style={{
              borderRadius: 10,
              borderWidth: 1,
              borderColor: c.border,
              padding: 14,
              overflow: 'hidden',
              height: 100,
              justifyContent: 'center',
              alignItems: 'center',
            }}>
              <Spirograph background speed={0.5} />
              <Pressable
                onPress={() => setSelected((selected + 1) % effects.length)}
                style={{
                  paddingHorizontal: 16,
                  paddingVertical: 8,
                  borderRadius: 6,
                  backgroundColor: 'rgba(255,255,255,0.15)',
                  borderWidth: 1,
                  borderColor: 'rgba(255,255,255,0.3)',
                }}
              >
                <Text style={{ color: '#fff', fontSize: 11 }}>Next Effect</Text>
              </Pressable>
            </Box>
          </Box>
        </Box>
      </Box>
    </Box>
  );
}
