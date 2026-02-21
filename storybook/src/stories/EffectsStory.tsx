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

type Mode = 'normal' | 'infinite' | 'reactive';
const modes: { label: string; value: Mode }[] = [
  { label: 'Normal', value: 'normal' },
  { label: 'Infinite', value: 'infinite' },
  { label: 'Reactive', value: 'reactive' },
];

export function EffectsStory() {
  const c = useThemeColors();
  const [selected, setSelected] = useState(0);
  const [mode, setMode] = useState<Mode>('normal');
  const SelectedEffect = effects[selected].Component;
  const nextIndex = (selected + 1) % effects.length;
  const NextEffect = effects[nextIndex].Component;

  const modeProps = {
    normal: {},
    infinite: { infinite: true },
    reactive: { reactive: true },
  }[mode];

  return (
    <Box style={{ width: '100%', height: '100%', padding: 12, gap: 10 }}>
      {/* Header */}
      <Text style={{ color: c.text, fontSize: 14, fontWeight: 'bold' }}>Generative Effects</Text>

      {/* Effect selector + mode selector */}
      <Box style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
        <Box style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap', flexGrow: 1 }}>
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

        {/* Mode toggle */}
        <Box style={{ flexDirection: 'row', gap: 4 }}>
          {modes.map((m) => (
            <Pressable
              key={m.value}
              onPress={() => setMode(m.value)}
              style={{
                paddingHorizontal: 8,
                paddingVertical: 4,
                borderRadius: 4,
                backgroundColor: mode === m.value ? '#6c5ce7' : c.surface,
                borderWidth: 1,
                borderColor: mode === m.value ? '#6c5ce7' : c.border,
              }}
            >
              <Text style={{
                fontSize: 10,
                color: mode === m.value ? '#fff' : c.textSecondary,
              }}>{m.label}</Text>
            </Pressable>
          ))}
        </Box>
      </Box>

      {/* Main content: standalone + background demo side by side */}
      <Box style={{ flexDirection: 'row', gap: 10, flexGrow: 1 }}>
        {/* Standalone effect */}
        <Box style={{ flexGrow: 1, gap: 6 }}>
          <Text style={{ color: c.textSecondary, fontSize: 10 }}>
            {mode === 'normal' ? 'Standalone' : mode === 'infinite' ? 'Infinite Canvas' : 'Move your mouse'}
          </Text>
          <Box style={{
            flexGrow: 1,
            borderRadius: 8,
            borderWidth: 1,
            borderColor: c.border,
            overflow: 'hidden',
            backgroundColor: '#0a0c12',
          }}>
            <SelectedEffect style={{ width: '100%', height: '100%' }} {...modeProps} />
          </Box>
        </Box>

        {/* Background texture demo */}
        <Box style={{ width: 220, gap: 6 }}>
          <Text style={{ color: c.textSecondary, fontSize: 10 }}>
            {mode === 'reactive' ? 'Reactive Background' : 'As Background'}
          </Text>
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
              <SelectedEffect background {...modeProps} />
              <Text style={{ color: '#fff', fontSize: 13, fontWeight: 'bold' }}>
                {effects[selected].name}
              </Text>
              <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 10, marginTop: 4 }}>
                {mode === 'reactive' ? 'Hover to activate' : mode === 'infinite' ? 'Infinite scroll' : 'Living background texture'}
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
              <NextEffect background speed={0.5} {...modeProps} />
              <Pressable
                onPress={() => setSelected(nextIndex)}
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
