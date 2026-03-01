import React, { useState } from 'react';
import {
  Box, Text, Pressable, Image, Tabs,
  Spirograph, Rings, FlowParticles, Mirror, Mandala, Cymatics,
  Constellation, Mycelium, Pipes, StainedGlass, Voronoi, Contours, Feedback, PixelSort,
  Terrain, Automata, Combustion, ReactionDiffusion, EdgeGravity, Orbits, Plotter, LSystem,
  Sunburst,
} from '../../../packages/core/src';
import type { Tab } from '../../../packages/core/src';
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
  { name: 'Sunburst', Component: Sunburst, cat: 'Classic' },
] as const;

const categories = ['All', 'Classic', 'Nature', 'Generative', 'Simulation', 'Physics', 'Glitch'] as const;
type Category = typeof categories[number];
const effectsWithIndex = effects.map((effect, originalIndex) => ({ ...effect, originalIndex }));

type Mode = 'normal' | 'infinite' | 'reactive';
const modes: { label: string; value: Mode }[] = [
  { label: 'Static', value: 'normal' },
  { label: 'Tiling', value: 'infinite' },
  { label: 'Cursor', value: 'reactive' },
];

export function EffectsStory() {
  const c = useThemeColors();
  const [selected, setSelected] = useState(0);
  const [mode, setMode] = useState<Mode>('normal');
  const [category, setCategory] = useState<Category>('Classic');
  const selectedEffect = effects[selected];
  const SelectedEffect = selectedEffect.Component;

  const filteredEffects = category === 'All'
    ? effectsWithIndex
    : effectsWithIndex.filter(e => e.cat === category);

  const currentFilterIdx = filteredEffects.findIndex(e => e.originalIndex === selected);
  const safeCurrentFilterIdx = currentFilterIdx < 0 ? 0 : currentFilterIdx;
  const nextFilterIdx = filteredEffects.length > 0
    ? (safeCurrentFilterIdx + 1) % filteredEffects.length
    : 0;
  const nextEffectName = filteredEffects.length > 0
    ? filteredEffects[nextFilterIdx].name
    : effects[(selected + 1) % effects.length].name;

  const categoryTabs: Tab[] = categories.map((cat) => {
    const count = cat === 'All'
      ? effects.length
      : effects.filter((effect) => effect.cat === cat).length;
    return { id: cat, label: `${cat} ${count}` };
  });

  const effectTabs: Tab[] = filteredEffects.map((effect) => ({
    id: String(effect.originalIndex),
    label: effect.name,
  }));

  const modeTabs: Tab[] = modes.map((m) => ({ id: m.value, label: m.label }));

  const goNext = () => {
    if (filteredEffects.length === 0) return;
    setSelected(filteredEffects[nextFilterIdx].originalIndex);
  };

  const modeProps = {
    normal: {},
    infinite: { infinite: true },
    reactive: { reactive: true },
  }[mode];

  return (
    <Box style={{ width: '100%', height: '100%', padding: 6, gap: 6, minHeight: 0, overflow: 'hidden' }}>
      <Box style={{
        width: '100%',
        gap: 5,
        padding: 8,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: c.border,
        backgroundColor: c.bgElevated,
        flexShrink: 0,
      }}>
        <Box style={{ flexDirection: 'row', alignItems: 'start', width: '100%', gap: 10 }}>
          <Box style={{ flexGrow: 1, minWidth: 0, gap: 2 }}>
            <Text style={{ color: c.text, fontSize: 15, fontWeight: 'normal' }}>Effects</Text>
            <Box style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <Text style={{ color: c.textSecondary, fontSize: 10, fontWeight: 'normal' }}>
                {selectedEffect.name}
              </Text>
              <Box style={{
                paddingLeft: 6,
                paddingRight: 6,
                paddingTop: 2,
                paddingBottom: 2,
                borderRadius: 6,
                borderWidth: 1,
                borderColor: c.border,
                backgroundColor: c.bgAlt,
              }}>
                <Text style={{ color: c.textDim, fontSize: 9, fontWeight: 'normal' }}>
                  {selectedEffect.cat}
                </Text>
              </Box>
            </Box>
          </Box>
          <Box style={{ width: 218, flexShrink: 0 }}>
            <Tabs
              tabs={modeTabs}
              activeId={mode}
              onSelect={(id) => setMode(id as Mode)}
              variant="pill"
              style={{ padding: 3, gap: 3 }}
            />
          </Box>
        </Box>

        <Box style={{ gap: 2 }}>
          <Text style={{ color: c.textSecondary, fontSize: 10, fontWeight: 'normal' }}>Category</Text>
          <Tabs
            tabs={categoryTabs}
            activeId={category}
            onSelect={(id) => {
              const nextCategory = id as Category;
              setCategory(nextCategory);
              const inCategory = nextCategory === 'All' || effects[selected].cat === nextCategory;
              if (!inCategory) {
                const first = effects.findIndex((effect) => effect.cat === nextCategory);
                if (first >= 0) setSelected(first);
              }
            }}
            variant="pill"
            style={{ flexWrap: 'wrap', padding: 3, gap: 3 }}
          />
        </Box>

        <Box style={{ gap: 2 }}>
          <Box style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text style={{ color: c.textSecondary, fontSize: 10, fontWeight: 'normal' }}>Effect</Text>
            <Text style={{ color: c.textSecondary, fontSize: 10 }}>
              {filteredEffects.length > 0 ? `${safeCurrentFilterIdx + 1}/${filteredEffects.length}` : '0/0'}
            </Text>
          </Box>
          <Tabs
            tabs={effectTabs}
            activeId={String(selected)}
            onSelect={(id) => {
              const next = Number(id);
              if (Number.isFinite(next)) setSelected(next);
            }}
            variant="pill"
            style={{ flexWrap: 'wrap', padding: 3, gap: 3 }}
          />
        </Box>
      </Box>

      {/* Main content: standalone + background demo side by side */}
      <Box style={{ flexDirection: 'row', gap: 8, flexGrow: 1, minHeight: 0 }}>
        {/* Standalone effect */}
        <Box style={{ flexGrow: 1, flexBasis: 0, gap: 4, minHeight: 0 }}>
          <Text style={{ color: c.textSecondary, fontSize: 10, fontWeight: 'normal' }}>
            {mode === 'normal' ? 'Standalone' : mode === 'infinite' ? 'Seamless Tiling' : 'Cursor-Reactive'}
          </Text>
          <Box style={{
            flexGrow: 1,
            minHeight: 0,
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
        <Box style={{ width: 208, gap: 4, minHeight: 0 }}>
          <Text style={{ color: c.textSecondary, fontSize: 10, fontWeight: 'normal' }}>
            {mode === 'reactive' ? 'Cursor-Reactive Background' : 'As Background'}
          </Text>
          <Box style={{
            flexGrow: 1,
            minHeight: 0,
            gap: 6,
          }}>
            {/* Card with effect background */}
            <Box style={{
              borderRadius: 10,
              borderWidth: 1,
              borderColor: c.border,
              padding: 12,
              overflow: 'hidden',
              flexGrow: 1,
              minHeight: 0,
              justifyContent: 'flex-end',
            }}>
              <SelectedEffect background {...modeProps} />
              <Text style={{ color: '#fff', fontSize: 13, fontWeight: 'normal' }}>
                {effects[selected].name}
              </Text>
              <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 10, marginTop: 4 }}>
                {mode === 'reactive' ? 'Follows cursor movement' : mode === 'infinite' ? 'Tiles seamlessly' : 'Living background texture'}
              </Text>
            </Box>

            {/* Profile HUD card using current effect */}
            <Box style={{
              borderRadius: 10,
              borderWidth: 1,
              borderColor: c.border,
              overflow: 'hidden',
              flexShrink: 0,
              height: 136,
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
                  width: 72,
                  height: 72,
                  borderRadius: 36,
                  borderWidth: 1,
                  borderColor: 'rgba(255,255,255,0.22)',
                  backgroundColor: 'rgba(255,255,255,0.08)',
                  justifyContent: 'center',
                  alignItems: 'center',
                }}>
                  <Image
                    src="lib/placeholders/avatar.png"
                    style={{
                      width: 60,
                      height: 60,
                      borderRadius: 30,
                      objectFit: 'cover',
                    }}
                  />
                </Box>
                <Box style={{
                  position: 'absolute',
                  width: 88,
                  height: 88,
                  borderRadius: 44,
                  borderWidth: 1,
                  borderColor: 'rgba(255,255,255,0.16)',
                }} />
                <Box style={{
                  position: 'absolute',
                  width: 104,
                  height: 104,
                  borderRadius: 52,
                  borderWidth: 1,
                  borderColor: 'rgba(255,255,255,0.08)',
                }} />
              </Box>

              <Box style={{
                position: 'absolute',
                left: 0,
                bottom: 8,
                width: '100%',
                alignItems: 'center',
                gap: 4,
              }}>
                <Text style={{ color: '#ffffff', fontSize: 10, fontWeight: 'normal' }}>Nova Echo</Text>
                <Pressable
                  onPress={goNext}
                  style={{
                    paddingLeft: 10,
                    paddingRight: 10,
                    paddingTop: 4,
                    paddingBottom: 4,
                    borderRadius: 6,
                    backgroundColor: 'rgba(255,255,255,0.18)',
                    borderWidth: 1,
                    borderColor: 'rgba(255,255,255,0.34)',
                  }}
                >
                  <Text style={{ color: '#fff', fontSize: 10, fontWeight: 'normal' }}>
                    {`Next: ${nextEffectName}`}
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
