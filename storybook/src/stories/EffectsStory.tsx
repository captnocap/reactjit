import React, { useState } from 'react';
import {
  Box, Text, Pressable, Image,
  Spirograph, Rings, FlowParticles, Mirror, Mandala, Cymatics,
  Constellation, Mycelium, Pipes, StainedGlass, Voronoi, Contours, Feedback, PixelSort,
  Terrain, Automata, Combustion, ReactionDiffusion, EdgeGravity, Orbits, Plotter, LSystem,
} from '../../../packages/shared/src';
import { useThemeColors } from '../../../packages/theme/src';

const effects = [
  { name: 'Spirograph', Component: Spirograph, cat: 'Classic' },
  { name: 'Rings', Component: Rings, cat: 'Classic' },
  { name: 'FlowParticles', Component: FlowParticles, cat: 'Classic' },
  { name: 'Mirror', Component: Mirror, cat: 'Classic' },
  { name: 'Mandala', Component: Mandala, cat: 'Classic' },
  { name: 'Cymatics', Component: Cymatics, cat: 'Classic' },
  { name: 'Constellation', Component: Constellation, cat: 'Nature' },
  { name: 'Mycelium', Component: Mycelium, cat: 'Nature' },
  { name: 'LSystem', Component: LSystem, cat: 'Nature' },
  { name: 'Terrain', Component: Terrain, cat: 'Nature' },
  { name: 'Pipes', Component: Pipes, cat: 'Generative' },
  { name: 'StainedGlass', Component: StainedGlass, cat: 'Generative' },
  { name: 'Voronoi', Component: Voronoi, cat: 'Generative' },
  { name: 'Contours', Component: Contours, cat: 'Generative' },
  { name: 'Plotter', Component: Plotter, cat: 'Generative' },
  { name: 'Automata', Component: Automata, cat: 'Simulation' },
  { name: 'Combustion', Component: Combustion, cat: 'Simulation' },
  { name: 'ReactionDiffusion', Component: ReactionDiffusion, cat: 'Simulation' },
  { name: 'Orbits', Component: Orbits, cat: 'Physics' },
  { name: 'EdgeGravity', Component: EdgeGravity, cat: 'Physics' },
  { name: 'Feedback', Component: Feedback, cat: 'Glitch' },
  { name: 'PixelSort', Component: PixelSort, cat: 'Glitch' },
] as const;

const categories = ['All', 'Classic', 'Nature', 'Generative', 'Simulation', 'Physics', 'Glitch'] as const;
type Category = typeof categories[number];

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
  const [category, setCategory] = useState<Category>('All');
  const SelectedEffect = effects[selected].Component;
  const nextIndex = (selected + 1) % effects.length;
  const prevIndex = (selected - 1 + effects.length) % effects.length;

  const filteredEffects = category === 'All'
    ? effects.map((e, i) => ({ ...e, originalIndex: i }))
    : effects.map((e, i) => ({ ...e, originalIndex: i })).filter(e => e.cat === category);

  const currentFilterIdx = filteredEffects.findIndex(e => e.originalIndex === selected);

  const goNext = () => {
    if (filteredEffects.length === 0) return;
    const nextFilterIdx = (currentFilterIdx + 1) % filteredEffects.length;
    setSelected(filteredEffects[nextFilterIdx].originalIndex);
  };

  const goPrev = () => {
    if (filteredEffects.length === 0) return;
    const prevFilterIdx = (currentFilterIdx - 1 + filteredEffects.length) % filteredEffects.length;
    setSelected(filteredEffects[prevFilterIdx].originalIndex);
  };

  const modeProps = {
    normal: {},
    infinite: { infinite: true },
    reactive: { reactive: true },
  }[mode];

  return (
    <Box style={{ width: '100%', height: '100%', padding: 12, gap: 8 }}>
      {/* Row 1: Title + category tabs + mode toggle */}
      <Box style={{ flexDirection: 'row', alignItems: 'center', width: '100%', gap: 10 }}>
        <Text style={{ color: c.text, fontSize: 13, fontWeight: 'bold' }}>Effects</Text>

        {/* Category tabs */}
        <Box style={{ flexDirection: 'row', gap: 2, flexGrow: 1 }}>
          {categories.map((cat) => {
            const isActive = category === cat;
            const count = cat === 'All' ? effects.length : effects.filter(e => e.cat === cat).length;
            return (
              <Pressable
                key={cat}
                onPress={() => {
                  setCategory(cat);
                  // Select first effect in new category if current isn't in it
                  const inCat = cat === 'All' || effects[selected].cat === cat;
                  if (!inCat) {
                    const first = effects.findIndex(e => e.cat === cat);
                    if (first >= 0) setSelected(first);
                  }
                }}
                style={{
                  paddingHorizontal: 6,
                  paddingVertical: 3,
                  borderRadius: 4,
                  backgroundColor: isActive ? 'rgba(108,92,231,0.2)' : 'transparent',
                }}
              >
                <Text style={{
                  fontSize: 9,
                  color: isActive ? '#a29bfe' : c.textSecondary,
                  fontWeight: isActive ? 'bold' : 'normal',
                }}>{cat} {count}</Text>
              </Pressable>
            );
          })}
        </Box>

        {/* Mode toggle */}
        <Box style={{ flexDirection: 'row', gap: 3 }}>
          {modes.map((m) => (
            <Pressable
              key={m.value}
              onPress={() => setMode(m.value)}
              style={{
                paddingHorizontal: 7,
                paddingVertical: 3,
                borderRadius: 4,
                backgroundColor: mode === m.value ? '#6c5ce7' : c.surface,
                borderWidth: 1,
                borderColor: mode === m.value ? '#6c5ce7' : c.border,
              }}
            >
              <Text style={{
                fontSize: 9,
                color: mode === m.value ? '#fff' : c.textSecondary,
              }}>{m.label}</Text>
            </Pressable>
          ))}
        </Box>
      </Box>

      {/* Row 2: Prev/Next navigator + effect name */}
      <Box style={{ flexDirection: 'row', alignItems: 'center', width: '100%', gap: 6 }}>
        <Pressable
          onPress={goPrev}
          style={{
            paddingHorizontal: 8,
            paddingVertical: 4,
            borderRadius: 4,
            backgroundColor: c.surface,
            borderWidth: 1,
            borderColor: c.border,
          }}
        >
          <Text style={{ fontSize: 10, color: c.textSecondary }}>&lt;</Text>
        </Pressable>

        <Text style={{ color: '#fff', fontSize: 14, fontWeight: 'bold', minWidth: 140 }}>
          {effects[selected].name}
        </Text>

        <Pressable
          onPress={goNext}
          style={{
            paddingHorizontal: 8,
            paddingVertical: 4,
            borderRadius: 4,
            backgroundColor: c.surface,
            borderWidth: 1,
            borderColor: c.border,
          }}
        >
          <Text style={{ fontSize: 10, color: c.textSecondary }}>&gt;</Text>
        </Pressable>

        <Text style={{ color: c.textSecondary, fontSize: 9 }}>
          {currentFilterIdx + 1}/{filteredEffects.length}
        </Text>

        {/* Quick-pick dots for filtered set */}
        <Box style={{ flexDirection: 'row', gap: 3, flexGrow: 1, flexWrap: 'wrap' }}>
          {filteredEffects.map((eff, i) => {
            const isActive = eff.originalIndex === selected;
            return (
              <Pressable
                key={eff.name}
                onPress={() => setSelected(eff.originalIndex)}
                style={{
                  width: isActive ? undefined : 6,
                  height: 6,
                  borderRadius: 3,
                  paddingHorizontal: isActive ? 5 : 0,
                  backgroundColor: isActive ? '#6c5ce7' : 'rgba(255,255,255,0.15)',
                }}
              >
                {isActive && (
                  <Text style={{ fontSize: 7, color: '#fff', lineHeight: 6 }}>{eff.name}</Text>
                )}
              </Pressable>
            );
          })}
        </Box>
      </Box>

      {/* Main content: standalone + background demo side by side */}
      <Box style={{ flexDirection: 'row', gap: 10, flexGrow: 1 }}>
        {/* Standalone effect */}
        <Box style={{ flexGrow: 1, gap: 4 }}>
          <Text style={{ color: c.textSecondary, fontSize: 9 }}>
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
        <Box style={{ width: 220, gap: 4 }}>
          <Text style={{ color: c.textSecondary, fontSize: 9 }}>
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
                  onPress={goNext}
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
                    Next: {effects[nextIndex].name}
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
