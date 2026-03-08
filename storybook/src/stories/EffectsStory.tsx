/**
 * Effects — Layout3 tabbed showcase for all 23 generative effect components.
 *
 * Layout: Header → thin bar (label + usage) → dual preview (standalone + background)
 * → command center (live-editable props) → tab bar (hover = mini effect) → footer.
 */

import React, { useState } from 'react';
import {
  Box, Text, Image, Pressable, ScrollView, CodeBlock, TextInput,
  Spirograph, Rings, FlowParticles, Mirror, Mandala, Cymatics,
  Constellation, Mycelium, Pipes, StainedGlass, Voronoi, Contours, Feedback, PixelSort,
  Terrain, Automata, Combustion, ReactionDiffusion, EdgeGravity, Orbits, Plotter, LSystem,
  Sunburst, classifiers as S} from '../../../packages/core/src';
import { useThemeColors } from '../../../packages/theme/src';

// ── Palette ──────────────────────────────────────────────

const C = {
  accent: '#8b5cf6',
  accentDim: 'rgba(139, 92, 246, 0.12)',
  selected: 'rgba(139, 92, 246, 0.2)',
};

// ── Prop definitions ─────────────────────────────────────

type PropKind = 'bool' | 'num' | 'enum';

interface PropDef {
  name: string;
  kind: PropKind;
  icon: string;
  defaultVal: any;
  step?: number;      // for num: nudge amount
  min?: number;
  max?: number;
  options?: string[]; // for enum: cycle values
  group?: 'audio';    // visual grouping
}

const BASE_PROPS: PropDef[] = [
  { name: 'background', kind: 'bool', icon: 'layers', defaultVal: false },
  { name: 'speed', kind: 'num', icon: 'fast-forward', defaultVal: 1, step: 0.1, min: 0, max: 5 },
  { name: 'decay', kind: 'num', icon: 'clock', defaultVal: 0.03, step: 0.01, min: 0, max: 1 },
  { name: 'infinite', kind: 'bool', icon: 'maximize', defaultVal: false },
  { name: 'reactive', kind: 'bool', icon: 'mouse-pointer', defaultVal: false },
];

const AUDIO_PROPS: PropDef[] = [
  { name: 'bass', kind: 'num', icon: 'volume-2', defaultVal: 0, step: 0.05, min: 0, max: 1, group: 'audio' },
  { name: 'mid', kind: 'num', icon: 'volume-1', defaultVal: 0, step: 0.05, min: 0, max: 1, group: 'audio' },
  { name: 'high', kind: 'num', icon: 'volume', defaultVal: 0, step: 0.05, min: 0, max: 1, group: 'audio' },
  { name: 'amplitude', kind: 'num', icon: 'sliders', defaultVal: 0, step: 0.05, min: 0, max: 1, group: 'audio' },
  { name: 'beat', kind: 'bool', icon: 'zap', defaultVal: false, group: 'audio' },
];

// ── Tabs ─────────────────────────────────────────────────

interface TabDef {
  id: string;
  label: string;
  icon: string;
  cat: string;
  desc: string;
  usage: string;
  Component: React.ComponentType<any>;
  extraProps: PropDef[];
}

const TABS: TabDef[] = [
  {
    id: 'spirograph', label: 'Spirograph', icon: 'pen-tool', cat: 'Classic',
    Component: Spirograph,
    desc: 'Parametric spirograph curves with smooth color evolution.',
    usage: '<Spirograph chaos={0.6} speed={1.5} />',
    extraProps: [
      { name: 'chaos', kind: 'num', icon: 'shuffle', defaultVal: 0.3, step: 0.05, min: 0, max: 1 },
    ],
  },
  {
    id: 'rings', label: 'Rings', icon: 'circle', cat: 'Classic',
    Component: Rings,
    desc: 'Expanding concentric circles that pulse outward from center.',
    usage: '<Rings speed={1.2} />',
    extraProps: [],
  },
  {
    id: 'flow-particles', label: 'FlowParticles', icon: 'wind', cat: 'Classic',
    Component: FlowParticles,
    desc: 'Particles flowing through a Perlin noise field with organic trails.',
    usage: '<FlowParticles decay={0.03} />',
    extraProps: [],
  },
  {
    id: 'mirror', label: 'Mirror', icon: 'copy', cat: 'Classic',
    Component: Mirror,
    desc: 'Kaleidoscope — flow particles reflected N times around center.',
    usage: '<Mirror segments={12} speed={0.8} />',
    extraProps: [
      { name: 'segments', kind: 'num', icon: 'grid', defaultVal: 8, step: 1, min: 2, max: 24 },
    ],
  },
  {
    id: 'mandala', label: 'Mandala', icon: 'sun', cat: 'Classic',
    Component: Mandala,
    desc: 'Radial symmetry patterns built from layered geometric forms.',
    usage: '<Mandala speed={0.5} />',
    extraProps: [],
  },
  {
    id: 'cymatics', label: 'Cymatics', icon: 'radio', cat: 'Classic',
    Component: Cymatics,
    desc: 'Chladni plate standing wave simulation — particles on nodal lines.',
    usage: '<Cymatics n={3} m={5} />',
    extraProps: [
      { name: 'n', kind: 'num', icon: 'hash', defaultVal: 3, step: 1, min: 1, max: 12 },
      { name: 'm', kind: 'num', icon: 'hash', defaultVal: 5, step: 1, min: 1, max: 12 },
    ],
  },
  {
    id: 'sunburst', label: 'Sunburst', icon: 'sunrise', cat: 'Classic',
    Component: Sunburst,
    desc: 'Claude-inspired radial sunburst with independently breathing rays.',
    usage: '<Sunburst activity={0.8} mode="thinking" />',
    extraProps: [
      { name: 'hue', kind: 'num', icon: 'palette', defaultVal: 0.042, step: 0.01, min: 0, max: 1 },
      { name: 'saturation', kind: 'num', icon: 'droplet', defaultVal: 0.64, step: 0.05, min: 0, max: 1 },
      { name: 'lightness', kind: 'num', icon: 'sun', defaultVal: 0.59, step: 0.05, min: 0, max: 1 },
      { name: 'activity', kind: 'num', icon: 'activity', defaultVal: 0.5, step: 0.05, min: 0, max: 1 },
      { name: 'mode', kind: 'enum', icon: 'settings', defaultVal: 'idle', options: ['idle', 'thinking', 'streaming', 'permission', 'active'] },
      { name: 'transparent', kind: 'bool', icon: 'eye', defaultVal: false },
    ],
  },
  {
    id: 'constellation', label: 'Constellation', icon: 'star', cat: 'Nature',
    Component: Constellation,
    desc: 'Star field with connecting lines between nearby points.',
    usage: '<Constellation speed={0.3} />',
    extraProps: [],
  },
  {
    id: 'mycelium', label: 'Mycelium', icon: 'share-2', cat: 'Nature',
    Component: Mycelium,
    desc: 'Organic branching networks that grow like fungal mycelium.',
    usage: '<Mycelium decay={0.01} />',
    extraProps: [],
  },
  {
    id: 'lsystem', label: 'LSystem', icon: 'git-branch', cat: 'Nature',
    Component: LSystem,
    desc: 'Lindenmayer system fractals — recursive rewriting rules produce plant-like structures.',
    usage: '<LSystem speed={0.6} />',
    extraProps: [],
  },
  {
    id: 'terrain', label: 'Terrain', icon: 'triangle', cat: 'Nature',
    Component: Terrain,
    desc: 'Procedural landscape with layered noise and elevation coloring.',
    usage: '<Terrain speed={0.4} />',
    extraProps: [],
  },
  {
    id: 'pipes', label: 'Pipes', icon: 'git-commit', cat: 'Generative',
    Component: Pipes,
    desc: 'Maze-like pipe networks that grow step by step. Classic screensaver.',
    usage: '<Pipes speed={2} />',
    extraProps: [],
  },
  {
    id: 'stained-glass', label: 'StainedGlass', icon: 'hexagon', cat: 'Generative',
    Component: StainedGlass,
    desc: 'Voronoi tessellation with stained glass coloring and shifting cells.',
    usage: '<StainedGlass speed={0.5} />',
    extraProps: [],
  },
  {
    id: 'voronoi', label: 'Voronoi', icon: 'maximize', cat: 'Generative',
    Component: Voronoi,
    desc: 'Procedural Voronoi diagrams with drifting seed points.',
    usage: '<Voronoi />',
    extraProps: [],
  },
  {
    id: 'contours', label: 'Contours', icon: 'map', cat: 'Generative',
    Component: Contours,
    desc: 'Topographic contour lines from animated noise fields.',
    usage: '<Contours speed={0.3} />',
    extraProps: [],
  },
  {
    id: 'plotter', label: 'Plotter', icon: 'edit-3', cat: 'Generative',
    Component: Plotter,
    desc: 'Simulated pen plotter tracing mathematical curves.',
    usage: '<Plotter speed={1.5} />',
    extraProps: [],
  },
  {
    id: 'automata', label: 'Automata', icon: 'grid', cat: 'Simulation',
    Component: Automata,
    desc: 'Cellular automata — cells live, die, reproduce by neighbor rules.',
    usage: '<Automata speed={2} />',
    extraProps: [],
  },
  {
    id: 'combustion', label: 'Combustion', icon: 'flame', cat: 'Simulation',
    Component: Combustion,
    desc: 'Particle combustion and fire. Hot particles rise, cool, and fade.',
    usage: '<Combustion speed={1.2} />',
    extraProps: [],
  },
  {
    id: 'reaction-diffusion', label: 'ReactionDiffusion', icon: 'droplet', cat: 'Simulation',
    Component: ReactionDiffusion,
    desc: 'Gray-Scott model — two chemicals form spots, stripes, and coral.',
    usage: '<ReactionDiffusion speed={0.8} />',
    extraProps: [],
  },
  {
    id: 'orbits', label: 'Orbits', icon: 'compass', cat: 'Physics',
    Component: Orbits,
    desc: 'Orbital mechanics — bodies trace elliptical paths with gravity.',
    usage: '<Orbits speed={0.6} />',
    extraProps: [],
  },
  {
    id: 'edge-gravity', label: 'EdgeGravity', icon: 'crosshair', cat: 'Physics',
    Component: EdgeGravity,
    desc: 'Particles attracted toward screen edges and corners.',
    usage: '<EdgeGravity decay={0.02} />',
    extraProps: [],
  },
  {
    id: 'feedback', label: 'Feedback', icon: 'repeat', cat: 'Glitch',
    Component: Feedback,
    desc: 'Visual feedback loops — output feeds back as input with transforms.',
    usage: '<Feedback speed={0.5} />',
    extraProps: [],
  },
  {
    id: 'pixel-sort', label: 'PixelSort', icon: 'bar-chart-2', cat: 'Glitch',
    Component: PixelSort,
    desc: 'Sorts pixel rows by brightness creating glitchy horizontal streaks.',
    usage: '<PixelSort />',
    extraProps: [],
  },
];

// ── Helpers ──────────────────────────────────────────────

function VerticalDivider() {
  const c = useThemeColors();
  return <Box style={{ width: 1, flexShrink: 0, alignSelf: 'stretch', backgroundColor: c.border }} />;
}

// ── EffectsStory ─────────────────────────────────────────

export function EffectsStory() {
  const c = useThemeColors();
  const [activeId, setActiveId] = useState(TABS[0].id);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [propOverrides, setPropOverrides] = useState<Record<string, any>>({});
  const [editingProp, setEditingProp] = useState<string | null>(null);
  const tab = TABS.find(it => it.id === activeId) || TABS[0];
  const EffComp = tab.Component;

  // All props for this tab: extra + base + audio
  const allProps = [...tab.extraProps, ...BASE_PROPS, ...AUDIO_PROPS];

  // Resolved values: defaults merged with overrides
  const resolved: Record<string, any> = {};
  for (const p of allProps) {
    resolved[p.name] = propOverrides[p.name] !== undefined ? propOverrides[p.name] : p.defaultVal;
  }

  // Build props to pass to the effect component (only non-default, non-false, non-zero)
  const effectProps: Record<string, any> = {};
  for (const p of allProps) {
    const v = resolved[p.name];
    if (p.kind === 'bool' && v) effectProps[p.name] = true;
    else if (p.kind === 'num' && v !== 0) effectProps[p.name] = v;
    else if (p.kind === 'enum') effectProps[p.name] = v;
  }

  const setVal = (name: string, val: any) => {
    setPropOverrides(prev => ({ ...prev, [name]: val }));
  };

  const switchTab = (id: string) => {
    setActiveId(id);
    setPropOverrides({});
    setEditingProp(null);
  };

  // Separate audio vs main props
  const mainProps = allProps.filter(p => p.group !== 'audio');
  const audioProps = allProps.filter(p => p.group === 'audio');

  return (
    <S.StoryRoot>

      {/* ── Header ── */}
      <Box style={{
        flexShrink: 0,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: c.bgElevated,
        borderBottomWidth: 1,
        borderColor: c.border,
        paddingLeft: 20,
        paddingRight: 20,
        paddingTop: 12,
        paddingBottom: 12,
        gap: 14,
      }}>
        <Image src="sparkles" style={{ width: 18, height: 18 }} tintColor={C.accent} />
        <Text style={{ color: c.text, fontSize: 20, fontWeight: 'bold' }}>
          {'Effects'}
        </Text>
        <Box style={{
          backgroundColor: C.accentDim,
          borderRadius: 4,
          paddingLeft: 8,
          paddingRight: 8,
          paddingTop: 3,
          paddingBottom: 3,
        }}>
          <Text style={{ color: C.accent, fontSize: 10 }}>{'@reactjit/core'}</Text>
        </Box>
        <Box style={{ flexGrow: 1 }} />
        <Text style={{ color: c.muted, fontSize: 10 }}>
          {'23 generative effects — procedural, reactive, audio-driven'}
        </Text>
      </Box>

      {/* ── Subtitle bar — two rows: title+snippet / description ── */}
      <Box style={{
        flexShrink: 0,
        height: 46,
        overflow: 'hidden',
        backgroundColor: c.bgElevated,
        borderBottomWidth: 1,
        borderColor: c.border,
        paddingLeft: 20,
        paddingRight: 20,
        paddingTop: 5,
        paddingBottom: 5,
        gap: 2,
      }}>
        <Box style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Image src={tab.icon} style={{ width: 12, height: 12 }} tintColor={C.accent} />
          <Text style={{ color: c.text, fontSize: 12, fontWeight: 'bold' }}>{tab.label}</Text>
          <Box style={{
            backgroundColor: c.surface, borderRadius: 3,
            paddingLeft: 5, paddingRight: 5, paddingTop: 1, paddingBottom: 1,
          }}>
            <Text style={{ color: c.muted, fontSize: 8 }}>{tab.cat}</Text>
          </Box>
          <Box style={{ flexGrow: 1 }} />
          <CodeBlock language="tsx" fontSize={8} code={tab.usage} />
        </Box>
        <Text style={{ color: c.muted, fontSize: 9 }} numberOfLines={1}>{tab.desc}</Text>
      </Box>

      {/* ── Middle section: preview + command center share remaining space ── */}
      <Box style={{ flexGrow: 1, flexShrink: 1, minHeight: 0 }}>

      {/* ── Dual preview — standalone + as-background ── */}
      <Box style={{ flexGrow: 1, flexDirection: 'row', gap: 0, borderBottomWidth: 1, borderColor: c.border, minHeight: 0 }}>

        {/* Standalone effect */}
        <Box style={{ flexGrow: 1, flexBasis: 0, overflow: 'hidden', backgroundColor: '#0a0c12' }}>
          <EffComp style={{ width: '100%', height: '100%' }} {...effectProps} />
        </Box>

        <VerticalDivider />

        {/* As-background demo */}
        <Box style={{ width: 220, gap: 6, padding: 6 }}>
          {/* Card with effect background */}
          <Box style={{
            borderRadius: 10,
            borderWidth: 1,
            borderColor: c.border,
            padding: 12,
            overflow: 'hidden',
            flexGrow: 1,
            justifyContent: 'flex-end',
          }}>
            <EffComp background {...effectProps} />
            <Text style={{ color: '#fff', fontSize: 13, fontWeight: 'normal' }}>
              {tab.label}
            </Text>
            <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 10, marginTop: 4 }}>
              {'Living background texture'}
            </Text>
          </Box>

          {/* Profile HUD card */}
          <Box style={{
            borderRadius: 10,
            borderWidth: 1,
            borderColor: c.border,
            overflow: 'hidden',
            flexShrink: 0,
            height: 120,
          }}>
            <EffComp background speed={0.55} />
            <Box style={{
              position: 'absolute',
              left: 0, top: 0, width: '100%', height: '100%',
              backgroundColor: 'rgba(8,10,18,0.34)',
            }} />
            <Box style={{
              position: 'absolute',
              left: 0, top: 0, width: '100%', height: '100%',
              justifyContent: 'center',
              alignItems: 'center',
            }}>
              <Box style={{
                width: 52, height: 52, borderRadius: 26,
                borderWidth: 1, borderColor: 'rgba(255,255,255,0.22)',
                backgroundColor: 'rgba(255,255,255,0.08)',
                justifyContent: 'center', alignItems: 'center',
              }}>
                <Image
                  src="lib/placeholders/avatar.png"
                  style={{ width: 44, height: 44, borderRadius: 22, objectFit: 'cover' }}
                />
              </Box>
              <Box style={{
                position: 'absolute', width: 68, height: 68, borderRadius: 34,
                borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)',
              }} />
            </Box>
            <Box style={{
              position: 'absolute', left: 0, bottom: 6, width: '100%',
              alignItems: 'center', gap: 2,
            }}>
              <Text style={{ color: '#ffffff', fontSize: 9 }}>{'Nova Echo'}</Text>
            </Box>
          </Box>
        </Box>
      </Box>

      {/* ── Command center — live-editable props ── */}
      <Box style={{
        flexShrink: 1,
        overflow: 'hidden',
        borderBottomWidth: 1,
        borderColor: c.border,
        backgroundColor: c.bgElevated,
        paddingLeft: 12,
        paddingRight: 12,
        paddingTop: 6,
        paddingBottom: 6,
        gap: 4,
      }}>
        {/* Main props row */}
        <Box style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
          {mainProps.map(p => {
            const val = resolved[p.name];
            if (p.kind === 'bool') {
              return (
                <Pressable key={p.name} onPress={() => setVal(p.name, !val)}>
                  <Box style={{
                    flexDirection: 'row', alignItems: 'center', gap: 4,
                    paddingLeft: 6, paddingRight: 6, paddingTop: 3, paddingBottom: 3,
                    borderRadius: 4, borderWidth: 1,
                    borderColor: val ? C.accent : c.border,
                    backgroundColor: val ? C.accentDim : c.surface,
                  }}>
                    <Image src={p.icon} style={{ width: 9, height: 9 }} tintColor={val ? C.accent : c.muted} />
                    <Text style={{ color: val ? C.accent : c.muted, fontSize: 9 }}>{p.name}</Text>
                    <Text style={{ color: val ? C.accent : c.muted, fontSize: 8 }}>{val ? '\u25CF' : '\u25CB'}</Text>
                  </Box>
                </Pressable>
              );
            }
            if (p.kind === 'enum') {
              const opts = p.options || [];
              const idx = opts.indexOf(val);
              const next = opts[(idx + 1) % opts.length];
              return (
                <Pressable key={p.name} onPress={() => setVal(p.name, next)}>
                  <Box style={{
                    flexDirection: 'row', alignItems: 'center', gap: 4,
                    paddingLeft: 6, paddingRight: 6, paddingTop: 3, paddingBottom: 3,
                    borderRadius: 4, borderWidth: 1, borderColor: c.border, backgroundColor: c.surface,
                  }}>
                    <Image src={p.icon} style={{ width: 9, height: 9 }} tintColor={c.muted} />
                    <Text style={{ color: c.muted, fontSize: 9 }}>{p.name}</Text>
                    <Text style={{ color: C.accent, fontSize: 9 }}>{val}</Text>
                  </Box>
                </Pressable>
              );
            }
            // num
            const step = p.step || 0.1;
            const clamp = (v: number) => {
              let r = Math.round(v * 1000) / 1000;
              if (p.min !== undefined) r = Math.max(p.min, r);
              if (p.max !== undefined) r = Math.min(p.max, r);
              return r;
            };
            const isEditing = editingProp === p.name;
            return (
              <Box key={p.name} style={{
                flexDirection: 'row', alignItems: 'center', gap: 2,
                paddingLeft: 4, paddingRight: 4, paddingTop: 2, paddingBottom: 2,
                borderRadius: 4, borderWidth: 1, borderColor: c.border, backgroundColor: c.surface,
                overflow: 'hidden',
              }}>
                <Image src={p.icon} style={{ width: 9, height: 9 }} tintColor={c.muted} />
                <Text style={{ color: c.muted, fontSize: 9, marginRight: 2 }}>{p.name}</Text>
                <Pressable onPress={() => setVal(p.name, clamp(val - step))}>
                  <Box style={{
                    width: 14, height: 14, borderRadius: 3,
                    backgroundColor: c.bg, justifyContent: 'center', alignItems: 'center',
                  }}>
                    <Text style={{ color: c.muted, fontSize: 10 }}>{'\u2212'}</Text>
                  </Box>
                </Pressable>
                {isEditing ? (
                  <TextInput
                    style={{
                      width: 40, fontSize: 9, color: c.text,
                      paddingLeft: 2, paddingRight: 2, paddingTop: 1, paddingBottom: 1,
                      backgroundColor: c.bg, borderRadius: 2,
                    }}
                    value={String(val)}
                    autoFocus
                    onSubmit={(text: string) => {
                      const n = parseFloat(text);
                      if (Number.isFinite(n)) setVal(p.name, clamp(n));
                      setEditingProp(null);
                    }}
                    onBlur={() => setEditingProp(null)}
                  />
                ) : (
                  <Pressable onPress={() => setEditingProp(p.name)}>
                    <Text style={{ color: c.text, fontSize: 9, width: 30 }}>
                      {step >= 1 ? String(val) : val.toFixed(2)}
                    </Text>
                  </Pressable>
                )}
                <Pressable onPress={() => setVal(p.name, clamp(val + step))}>
                  <Box style={{
                    width: 14, height: 14, borderRadius: 3,
                    backgroundColor: c.bg, justifyContent: 'center', alignItems: 'center',
                  }}>
                    <Text style={{ color: c.muted, fontSize: 10 }}>{'+'}</Text>
                  </Box>
                </Pressable>
              </Box>
            );
          })}
        </Box>

        {/* Audio props row */}
        {audioProps.length > 0 && (
          <Box style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
            <Text style={{ color: c.muted, fontSize: 8, fontWeight: 'bold', letterSpacing: 1 }}>{'AUDIO'}</Text>
            {audioProps.map(p => {
              const val = resolved[p.name];
              if (p.kind === 'bool') {
                return (
                  <Pressable key={p.name} onPress={() => setVal(p.name, !val)}>
                    <Box style={{
                      flexDirection: 'row', alignItems: 'center', gap: 4,
                      paddingLeft: 6, paddingRight: 6, paddingTop: 3, paddingBottom: 3,
                      borderRadius: 4, borderWidth: 1,
                      borderColor: val ? C.accent : c.border,
                      backgroundColor: val ? C.accentDim : c.surface,
                    }}>
                      <Image src={p.icon} style={{ width: 9, height: 9 }} tintColor={val ? C.accent : c.muted} />
                      <Text style={{ color: val ? C.accent : c.muted, fontSize: 9 }}>{p.name}</Text>
                      <Text style={{ color: val ? C.accent : c.muted, fontSize: 8 }}>{val ? '\u25CF' : '\u25CB'}</Text>
                    </Box>
                  </Pressable>
                );
              }
              const step = p.step || 0.05;
              const clamp = (v: number) => {
                let r = Math.round(v * 1000) / 1000;
                if (p.min !== undefined) r = Math.max(p.min, r);
                if (p.max !== undefined) r = Math.min(p.max, r);
                return r;
              };
              return (
                <Box key={p.name} style={{
                  flexDirection: 'row', alignItems: 'center', gap: 2,
                  paddingLeft: 4, paddingRight: 4, paddingTop: 2, paddingBottom: 2,
                  borderRadius: 4, borderWidth: 1, borderColor: c.border, backgroundColor: c.surface,
                  overflow: 'hidden',
                }}>
                  <Image src={p.icon} style={{ width: 9, height: 9 }} tintColor={c.muted} />
                  <Text style={{ color: c.muted, fontSize: 9, marginRight: 2 }}>{p.name}</Text>
                  <Pressable onPress={() => setVal(p.name, clamp(val - step))}>
                    <Box style={{
                      width: 14, height: 14, borderRadius: 3,
                      backgroundColor: c.bg, justifyContent: 'center', alignItems: 'center',
                    }}>
                      <Text style={{ color: c.muted, fontSize: 10 }}>{'\u2212'}</Text>
                    </Box>
                  </Pressable>
                  <Pressable onPress={() => setEditingProp(p.name)}>
                    <Text style={{ color: c.text, fontSize: 9, width: 30 }}>
                      {val.toFixed(2)}
                    </Text>
                  </Pressable>
                  <Pressable onPress={() => setVal(p.name, clamp(val + step))}>
                    <Box style={{
                      width: 14, height: 14, borderRadius: 3,
                      backgroundColor: c.bg, justifyContent: 'center', alignItems: 'center',
                    }}>
                      <Text style={{ color: c.muted, fontSize: 10 }}>{'+'}</Text>
                    </Box>
                  </Pressable>
                </Box>
              );
            })}
          </Box>
        )}
      </Box>

      </Box>{/* end middle section */}

      {/* ── Tab bar — hover shows mini effect preview ── */}
      <ScrollView style={{
        height: 86,
        flexShrink: 0,
        borderTopWidth: 1,
        borderColor: c.border,
        backgroundColor: c.bgElevated,
      }}>
          <Box style={{
            flexDirection: 'row',
            flexWrap: 'wrap',
            justifyContent: 'center',
            paddingLeft: 8,
            paddingRight: 8,
            paddingTop: 8,
            paddingBottom: 8,
            gap: 8,
          }}>
            {TABS.map(comp => {
              const active = comp.id === activeId;
              const hovered = comp.id === hoveredId;
              const HoverComp = comp.Component;
              return (
                <Pressable
                  key={comp.id}
                  onPress={() => switchTab(comp.id)}
                  onHoverIn={() => setHoveredId(comp.id)}
                  onHoverOut={() => setHoveredId(null)}
                >
                  <Box style={{
                    width: 50,
                    height: 50,
                    backgroundColor: active ? C.selected : c.surface,
                    borderRadius: 6,
                    borderWidth: active ? 2 : 1,
                    borderColor: active ? C.accent : c.border,
                    justifyContent: 'center',
                    alignItems: 'center',
                    gap: 6,
                    overflow: 'hidden',
                  }}>
                    {hovered ? (
                      <HoverComp background speed={0.8} />
                    ) : (
                      <Image src={comp.icon} style={{ width: 16, height: 16 }} tintColor={active ? C.accent : c.muted} />
                    )}
                    <Text style={{
                      color: hovered ? '#fff' : active ? c.text : c.muted,
                      fontSize: 7,
                      position: hovered ? 'absolute' : undefined,
                      bottom: hovered ? 2 : undefined,
                    }}>
                      {comp.label}
                    </Text>
                  </Box>
                </Pressable>
              );
            })}
          </Box>
      </ScrollView>

      {/* ── Footer ── */}
      <Box style={{
        flexShrink: 0,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: c.bgElevated,
        borderTopWidth: 1,
        borderColor: c.border,
        paddingLeft: 20,
        paddingRight: 20,
        paddingTop: 6,
        paddingBottom: 6,
        gap: 12,
      }}>
        <Image src="folder" style={{ width: 12, height: 12 }} tintColor={c.muted} />
        <Text style={{ color: c.muted, fontSize: 9 }}>{'Packages'}</Text>
        <Text style={{ color: c.muted, fontSize: 9 }}>{'/'}</Text>
        <Image src="sparkles" style={{ width: 12, height: 12 }} tintColor={c.muted} />
        <Text style={{ color: c.muted, fontSize: 9 }}>{'Effects'}</Text>
        <Text style={{ color: c.muted, fontSize: 9 }}>{'/'}</Text>
        <Image src={tab.icon} style={{ width: 12, height: 12 }} tintColor={c.text} />
        <Text style={{ color: c.text, fontSize: 9 }}>{tab.label}</Text>
        <Box style={{ flexGrow: 1 }} />
        <Text style={{ color: c.muted, fontSize: 9 }}>{`${TABS.indexOf(tab) + 1} of ${TABS.length}`}</Text>
      </Box>

    </S.StoryRoot>
  );
}
