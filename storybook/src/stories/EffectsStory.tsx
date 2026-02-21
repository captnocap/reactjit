import React, { useState } from 'react';
import {
  Box, Text, Pressable, Image,
  Spirograph, Rings, FlowParticles, Mirror, Mandala, Cymatics,
  Constellation, Mycelium, Pipes, StainedGlass, Voronoi, Contours, Feedback, PixelSort,
  Terrain, Automata, Combustion, ReactionDiffusion, EdgeGravity, Orbits, Plotter, LSystem,
} from '../../../packages/shared/src';
import { useThemeColors } from '../../../packages/theme/src';

const effects = [
  { name: 'Spirograph', Component: Spirograph },
  { name: 'Rings', Component: Rings },
  { name: 'FlowParticles', Component: FlowParticles },
  { name: 'Mirror', Component: Mirror },
  { name: 'Mandala', Component: Mandala },
  { name: 'Cymatics', Component: Cymatics },
  { name: 'Constellation', Component: Constellation },
  { name: 'Mycelium', Component: Mycelium },
  { name: 'Pipes', Component: Pipes },
  { name: 'StainedGlass', Component: StainedGlass },
  { name: 'Voronoi', Component: Voronoi },
  { name: 'Contours', Component: Contours },
  { name: 'Feedback', Component: Feedback },
  { name: 'PixelSort', Component: PixelSort },
  { name: 'Terrain', Component: Terrain },
  { name: 'Automata', Component: Automata },
  { name: 'Combustion', Component: Combustion },
  { name: 'ReactionDiffusion', Component: ReactionDiffusion },
  { name: 'EdgeGravity', Component: EdgeGravity },
  { name: 'Orbits', Component: Orbits },
  { name: 'Plotter', Component: Plotter },
  { name: 'LSystem', Component: LSystem },
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

  const modeProps = {
    normal: {},
    infinite: { infinite: true },
    reactive: { reactive: true },
  }[mode];

  return (
    <Box style={{ width: '100%', height: '100%', padding: 12, gap: 10 }}>
      {/* Header + mode toggle */}
      <Box style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
        <Text style={{ color: c.text, fontSize: 14, fontWeight: 'bold' }}>Generative Effects</Text>
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

      {/* Effect selector */}
      <Box style={{ flexDirection: 'row', gap: 5, flexWrap: 'wrap' }}>
        {effects.map((eff, i) => (
          <Pressable
            key={eff.name}
            onPress={() => setSelected(i)}
            style={{
              paddingHorizontal: 8,
              paddingVertical: 4,
              borderRadius: 5,
              backgroundColor: i === selected ? c.primary : c.surface,
              borderWidth: 1,
              borderColor: i === selected ? c.primary : c.border,
            }}
          >
            <Text style={{
              fontSize: 10,
              color: i === selected ? '#fff' : c.textSecondary,
            }}>{eff.name}</Text>
          </Pressable>
        ))}
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

            {/* Profile HUD card using current effect */}
            <Box style={{
              borderRadius: 10,
              borderWidth: 1,
              borderColor: c.border,
              overflow: 'hidden',
              height: 170,
            }}>
              <SelectedEffect background speed={0.55} {...modeProps} />

              <Box style={{
                position: 'absolute',
                left: 0,
                top: 0,
                width: '100%',
                height: '100%',
                backgroundColor: 'rgba(8,10,18,0.34)',
              }} />

              <Box style={{
                position: 'absolute',
                left: 0,
                top: 0,
                width: '100%',
                height: '100%',
                justifyContent: 'center',
                alignItems: 'center',
              }}>
                <Box style={{
                  width: 102,
                  height: 102,
                  borderRadius: 51,
                  borderWidth: 1,
                  borderColor: 'rgba(255,255,255,0.22)',
                  backgroundColor: 'rgba(255,255,255,0.08)',
                  justifyContent: 'center',
                  alignItems: 'center',
                }}>
                  <Image
                    src="lib/placeholders/avatar.png"
                    style={{
                      width: 84,
                      height: 84,
                      borderRadius: 42,
                      objectFit: 'cover',
                    }}
                  />
                </Box>
                <Box style={{
                  position: 'absolute',
                  width: 122,
                  height: 122,
                  borderRadius: 61,
                  borderWidth: 1,
                  borderColor: 'rgba(255,255,255,0.16)',
                }} />
                <Box style={{
                  position: 'absolute',
                  width: 144,
                  height: 144,
                  borderRadius: 72,
                    borderWidth: 1,
                  borderColor: 'rgba(255,255,255,0.08)',
                }} />
              </Box>

              <Box style={{
                position: 'absolute',
                left: 0,
                bottom: 10,
                width: '100%',
                alignItems: 'center',
                gap: 6,
              }}>
                <Text style={{ color: '#ffffff', fontSize: 10, fontWeight: 'bold' }}>Nova Echo</Text>
                <Pressable
                  onPress={() => setSelected(nextIndex)}
                  style={{
                    paddingHorizontal: 12,
                    paddingVertical: 5,
                    borderRadius: 6,
                    backgroundColor: 'rgba(255,255,255,0.18)',
                    borderWidth: 1,
                    borderColor: 'rgba(255,255,255,0.34)',
                  }}
                >
                  <Text style={{ color: '#fff', fontSize: 10, fontWeight: 'bold' }}>
                    {effects[selected].name} Next
                  </Text>
                </Pressable>
              </Box>
            </Box>
          </Box>
        </Box>
      </Box>
    </Box>
  );
}
