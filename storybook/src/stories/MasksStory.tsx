/**
 * Masks — Layout3 tabbed showcase for all 15 post-processing mask components.
 *
 * Masks overlay existing content as foreground post-processing. The preview
 * shows the active mask applied over a generative effect background + UI card,
 * so you can see exactly what each mask does to real content.
 */

import React, { useState } from 'react';
import {
  Box, Text, Image, Pressable, ScrollView, CodeBlock, TextInput,
  Scanlines, CRT, VHS, Dither, Ascii,
  LumaMesh, OpticalFlow, DataMosh, FeedbackLoop,
  HardGlitch, SoftGlitch, Stretch, FishEye, Tile, Watercolor, classifiers as S} from '../../../packages/core/src';
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
  step?: number;
  min?: number;
  max?: number;
  options?: string[];
}

const BASE_PROPS: PropDef[] = [
  { name: 'mask', kind: 'bool', icon: 'layers', defaultVal: true },
  { name: 'speed', kind: 'num', icon: 'fast-forward', defaultVal: 1, step: 0.1, min: 0, max: 5 },
  { name: 'intensity', kind: 'num', icon: 'sliders', defaultVal: 0.5, step: 0.05, min: 0, max: 1 },
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
    id: 'scanlines', label: 'Scanlines', icon: 'minus', cat: 'Retro',
    Component: Scanlines,
    desc: 'Horizontal scanline overlay for retro CRT display aesthetic.',
    usage: '<Scanlines mask spacing={2} />',
    extraProps: [
      { name: 'spacing', kind: 'num', icon: 'maximize', defaultVal: 2, step: 1, min: 1, max: 8 },
      { name: 'tint', kind: 'enum', icon: 'palette', defaultVal: '', options: ['', '#00ff00', '#ff6600', '#00ccff', '#ff00ff'] },
    ],
  },
  {
    id: 'crt', label: 'CRT', icon: 'monitor', cat: 'Retro',
    Component: CRT,
    desc: 'Full CRT monitor post-processing with shader grade — scanlines, barrel distortion, RGB phosphor shift, vignette, flicker.',
    usage: '<CRT mask curvature={0.3} shaderTint="#a6e3a1" />',
    extraProps: [
      { name: 'curvature', kind: 'num', icon: 'circle', defaultVal: 0.3, step: 0.05, min: 0, max: 1 },
      { name: 'scanlineIntensity', kind: 'num', icon: 'minus', defaultVal: 0.25, step: 0.05, min: 0, max: 1 },
      { name: 'rgbShift', kind: 'num', icon: 'droplet', defaultVal: 1.5, step: 0.5, min: 0, max: 8 },
      { name: 'vignette', kind: 'num', icon: 'aperture', defaultVal: 0.4, step: 0.05, min: 0, max: 1 },
      { name: 'flicker', kind: 'num', icon: 'zap', defaultVal: 0.03, step: 0.01, min: 0, max: 0.2 },
      { name: 'shaderContrast', kind: 'num', icon: 'sliders', defaultVal: 1.08, step: 0.02, min: 0.7, max: 1.6 },
      { name: 'shaderGrain', kind: 'num', icon: 'radio', defaultVal: 0.05, step: 0.01, min: 0, max: 0.2 },
      { name: 'shaderTintMix', kind: 'num', icon: 'palette', defaultVal: 0.18, step: 0.02, min: 0, max: 1 },
      { name: 'shaderTint', kind: 'enum', icon: 'droplet', defaultVal: '', options: ['', '#a6e3a1', '#89b4fa', '#f9e2af', '#cba6f7'] },
    ],
  },
  {
    id: 'vhs', label: 'VHS', icon: 'film', cat: 'Retro',
    Component: VHS,
    desc: 'VHS playback artifacts plus shader grade — tracking distortion, color bleed, noise, head switching.',
    usage: '<VHS mask tracking={0.5} shaderTint="#fab387" />',
    extraProps: [
      { name: 'tracking', kind: 'num', icon: 'activity', defaultVal: 0.3, step: 0.05, min: 0, max: 1 },
      { name: 'noise', kind: 'num', icon: 'radio', defaultVal: 0.2, step: 0.05, min: 0, max: 1 },
      { name: 'colorBleed', kind: 'num', icon: 'droplet', defaultVal: 2, step: 0.5, min: 0, max: 8 },
      { name: 'shaderHue', kind: 'num', icon: 'refresh-cw', defaultVal: -6, step: 1, min: -40, max: 40 },
      { name: 'shaderContrast', kind: 'num', icon: 'sliders', defaultVal: 1.08, step: 0.02, min: 0.7, max: 1.8 },
      { name: 'shaderGrain', kind: 'num', icon: 'radio', defaultVal: 0.08, step: 0.01, min: 0, max: 0.25 },
      { name: 'shaderTintMix', kind: 'num', icon: 'palette', defaultVal: 0.2, step: 0.02, min: 0, max: 1 },
      { name: 'shaderTint', kind: 'enum', icon: 'droplet', defaultVal: '', options: ['', '#fab387', '#f38ba8', '#f9e2af', '#cba6f7'] },
    ],
  },
  {
    id: 'dither', label: 'Dither', icon: 'grid', cat: 'Retro',
    Component: Dither,
    desc: 'Ordered Bayer-matrix dithering for retro pixel-art aesthetic with quantized color levels.',
    usage: '<Dither mask levels={4} scale={2} />',
    extraProps: [
      { name: 'levels', kind: 'num', icon: 'sliders', defaultVal: 4, step: 1, min: 2, max: 8 },
      { name: 'scale', kind: 'num', icon: 'maximize', defaultVal: 2, step: 1, min: 1, max: 6 },
    ],
  },
  {
    id: 'ascii', label: 'Ascii', icon: 'type', cat: 'Retro',
    Component: Ascii,
    desc: 'ASCII art conversion — maps brightness to characters for terminal aesthetic.',
    usage: '<Ascii mask cellSize={6} colored />',
    extraProps: [
      { name: 'cellSize', kind: 'num', icon: 'hash', defaultVal: 8, step: 1, min: 3, max: 16 },
      { name: 'opacity', kind: 'num', icon: 'eye', defaultVal: 0.6, step: 0.05, min: 0, max: 1 },
      { name: 'colored', kind: 'bool', icon: 'palette', defaultVal: true },
    ],
  },
  {
    id: 'lumamesh', label: 'LumaMesh', icon: 'triangle', cat: 'Analysis',
    Component: LumaMesh,
    desc: 'Wireframe mesh displaced by brightness — luminance-driven terrain visualization.',
    usage: '<LumaMesh mask gridSize={12} />',
    extraProps: [
      { name: 'gridSize', kind: 'num', icon: 'grid', defaultVal: 16, step: 2, min: 4, max: 32 },
      { name: 'displacement', kind: 'num', icon: 'move', defaultVal: 30, step: 5, min: 0, max: 80 },
      { name: 'lineWidth', kind: 'num', icon: 'minus', defaultVal: 1, step: 0.5, min: 0.5, max: 4 },
      { name: 'colored', kind: 'bool', icon: 'palette', defaultVal: true },
    ],
  },
  {
    id: 'opticalflow', label: 'OpticalFlow', icon: 'wind', cat: 'Analysis',
    Component: OpticalFlow,
    desc: 'Motion trail / optical flow — accumulated frames with displacement and decay.',
    usage: '<OpticalFlow mask decay={0.9} />',
    extraProps: [
      { name: 'decay', kind: 'num', icon: 'clock', defaultVal: 0.92, step: 0.01, min: 0.5, max: 0.99 },
      { name: 'displacement', kind: 'num', icon: 'move', defaultVal: 3, step: 0.5, min: 0, max: 10 },
      { name: 'colorShift', kind: 'bool', icon: 'droplet', defaultVal: true },
    ],
  },
  {
    id: 'datamosh', label: 'DataMosh', icon: 'hard-drive', cat: 'Glitch',
    Component: DataMosh,
    desc: 'Corrupted video codec look — frozen blocks and drift simulating I-frame loss.',
    usage: '<DataMosh mask corruption={0.5} />',
    extraProps: [
      { name: 'blockSize', kind: 'num', icon: 'grid', defaultVal: 32, step: 4, min: 8, max: 64 },
      { name: 'corruption', kind: 'num', icon: 'alert-triangle', defaultVal: 0.3, step: 0.05, min: 0, max: 1 },
    ],
  },
  {
    id: 'feedback', label: 'FeedbackLoop', icon: 'repeat', cat: 'Glitch',
    Component: FeedbackLoop,
    desc: 'Recursive self-sampling with zoom and rotation creating tunnel and spiral effects.',
    usage: '<FeedbackLoop mask zoom={1.03} />',
    extraProps: [
      { name: 'zoom', kind: 'num', icon: 'zoom-in', defaultVal: 1.02, step: 0.005, min: 0.95, max: 1.1 },
      { name: 'rotation', kind: 'num', icon: 'rotate-cw', defaultVal: 0.005, step: 0.002, min: 0, max: 0.05 },
      { name: 'decay', kind: 'num', icon: 'clock', defaultVal: 0.94, step: 0.01, min: 0.5, max: 0.99 },
      { name: 'hueShift', kind: 'bool', icon: 'palette', defaultVal: true },
    ],
  },
  {
    id: 'hardglitch', label: 'HardGlitch', icon: 'zap', cat: 'Glitch',
    Component: HardGlitch,
    desc: 'Aggressive digital glitch — block displacement, RGB splits, random fills, corruption.',
    usage: '<HardGlitch mask chaos={0.7} />',
    extraProps: [
      { name: 'chaos', kind: 'num', icon: 'shuffle', defaultVal: 0.5, step: 0.05, min: 0, max: 1 },
      { name: 'blockSize', kind: 'num', icon: 'grid', defaultVal: 40, step: 5, min: 10, max: 80 },
      { name: 'rgbSplit', kind: 'num', icon: 'droplet', defaultVal: 6, step: 1, min: 0, max: 20 },
    ],
  },
  {
    id: 'softglitch', label: 'SoftGlitch', icon: 'feather', cat: 'Glitch',
    Component: SoftGlitch,
    desc: 'Subtle digital glitch — gentle horizontal drift, color fringing, micro-stutter.',
    usage: '<SoftGlitch mask drift={0.3} />',
    extraProps: [
      { name: 'drift', kind: 'num', icon: 'arrow-right', defaultVal: 0.4, step: 0.05, min: 0, max: 1 },
      { name: 'fringe', kind: 'num', icon: 'droplet', defaultVal: 1, step: 0.5, min: 0, max: 5 },
      { name: 'bandHeight', kind: 'num', icon: 'minus', defaultVal: 20, step: 2, min: 4, max: 60 },
    ],
  },
  {
    id: 'stretch', label: 'Stretch', icon: 'move', cat: 'Distortion',
    Component: Stretch,
    desc: 'Pixel stretch / smear with noise-driven displacement of horizontal or vertical strips.',
    usage: '<Stretch mask amount={0.6} />',
    extraProps: [
      { name: 'amount', kind: 'num', icon: 'sliders', defaultVal: 0.5, step: 0.05, min: 0, max: 1 },
      { name: 'stripHeight', kind: 'num', icon: 'minus', defaultVal: 2, step: 1, min: 1, max: 10 },
      { name: 'vertical', kind: 'bool', icon: 'rotate-cw', defaultVal: false },
    ],
  },
  {
    id: 'fisheye', label: 'FishEye', icon: 'aperture', cat: 'Distortion',
    Component: FishEye,
    desc: 'Fisheye / barrel distortion via GLSL shader. Negative strength for pincushion.',
    usage: '<FishEye mask strength={0.6} />',
    extraProps: [
      { name: 'strength', kind: 'num', icon: 'maximize', defaultVal: 0.4, step: 0.1, min: -1, max: 2 },
      { name: 'animated', kind: 'bool', icon: 'play', defaultVal: false },
    ],
  },
  {
    id: 'tile', label: 'Tile', icon: 'copy', cat: 'Distortion',
    Component: Tile,
    desc: 'Tiling / kaleidoscope — repeats source content in a grid, optionally mirrored.',
    usage: '<Tile mask columns={4} rows={3} mirror />',
    extraProps: [
      { name: 'columns', kind: 'num', icon: 'grid', defaultVal: 3, step: 1, min: 1, max: 8 },
      { name: 'rows', kind: 'num', icon: 'grid', defaultVal: 3, step: 1, min: 1, max: 8 },
      { name: 'mirror', kind: 'bool', icon: 'copy', defaultVal: false },
      { name: 'gap', kind: 'num', icon: 'maximize', defaultVal: 0, step: 1, min: 0, max: 8 },
      { name: 'animated', kind: 'bool', icon: 'play', defaultVal: false },
    ],
  },
  {
    id: 'watercolor', label: 'Watercolor', icon: 'droplet', cat: 'Artistic',
    Component: Watercolor,
    desc: 'Painterly wash with imaging-derived shader grade, edge bleeding, paper texture, and wet-on-wet diffusion.',
    usage: '<Watercolor mask bleed={0.6} shaderTint="#cba6f7" />',
    extraProps: [
      { name: 'bleed', kind: 'num', icon: 'droplet', defaultVal: 0.5, step: 0.05, min: 0, max: 1 },
      { name: 'paper', kind: 'num', icon: 'file', defaultVal: 0.3, step: 0.05, min: 0, max: 1 },
      { name: 'wetness', kind: 'num', icon: 'cloud-rain', defaultVal: 0.4, step: 0.05, min: 0, max: 1 },
      { name: 'shaderHue', kind: 'num', icon: 'refresh-cw', defaultVal: 8, step: 1, min: -40, max: 40 },
      { name: 'shaderSaturation', kind: 'num', icon: 'sliders', defaultVal: 0.9, step: 0.05, min: 0.4, max: 1.6 },
      { name: 'shaderContrast', kind: 'num', icon: 'sliders', defaultVal: 0.94, step: 0.02, min: 0.5, max: 1.4 },
      { name: 'shaderTintMix', kind: 'num', icon: 'palette', defaultVal: 0.14, step: 0.02, min: 0, max: 1 },
      { name: 'shaderTint', kind: 'enum', icon: 'droplet', defaultVal: '', options: ['', '#cba6f7', '#f5c2e7', '#fab387', '#a6e3a1'] },
    ],
  },
];

// ── Helpers ──────────────────────────────────────────────

// ── MasksStory ───────────────────────────────────────────

export function MasksStory() {
  const c = useThemeColors();
  const [activeId, setActiveId] = useState(TABS[0].id);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [propOverrides, setPropOverrides] = useState<Record<string, any>>({});
  const [editingProp, setEditingProp] = useState<string | null>(null);
  const tab = TABS.find(it => it.id === activeId) || TABS[0];
  const MaskComp = tab.Component;

  // All props for this tab: extra + base
  const allProps = [...tab.extraProps, ...BASE_PROPS];

  // Resolved values
  const resolved: Record<string, any> = {};
  for (const p of allProps) {
    resolved[p.name] = propOverrides[p.name] !== undefined ? propOverrides[p.name] : p.defaultVal;
  }

  // Build mask props (skip false bools, zero nums, empty strings)
  const maskProps: Record<string, any> = {};
  for (const p of allProps) {
    const v = resolved[p.name];
    if (p.kind === 'bool' && v) maskProps[p.name] = true;
    else if (p.kind === 'num') maskProps[p.name] = v;
    else if (p.kind === 'enum' && v !== '') maskProps[p.name] = v;
  }

  const setVal = (name: string, val: any) => {
    setPropOverrides(prev => ({ ...prev, [name]: val }));
  };

  const switchTab = (id: string) => {
    setActiveId(id);
    setPropOverrides({});
    setEditingProp(null);
  };

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
        <Image src="layers" style={{ width: 18, height: 18 }} tintColor={C.accent} />
        <Text style={{ color: c.text, fontSize: 20, fontWeight: 'bold' }}>
          {'Masks'}
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
          {'15 post-processing masks — overlay on any content'}
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

      {/* ── Preview — before (clean) vs after (masked) ── */}
      <Box style={{ flexGrow: 1, flexDirection: 'row', borderBottomWidth: 1, borderColor: c.border, minHeight: 0 }}>

        {/* Left: BEFORE — clean content, no mask */}
        <Box style={{ flexGrow: 1, flexBasis: 0, overflow: 'hidden', backgroundColor: '#ffffff' }}>
          <Box style={{
            position: 'absolute', left: 0, top: 0, width: '100%', height: '100%',
            justifyContent: 'center', alignItems: 'center', gap: 14,
          }}>
            <Text style={{ color: '#111', fontSize: 24, fontWeight: 'bold' }}>{tab.label}</Text>
            <Box style={{ flexDirection: 'row', gap: 8 }}>
              {[C.accent, '#3b82f6', '#10b981', '#f59e0b'].map(col => (
                <Box key={col} style={{ width: 32, height: 32, borderRadius: 6, backgroundColor: col }} />
              ))}
            </Box>
            <Box style={{ width: 160, gap: 5 }}>
              <Box style={{ width: '100%', height: 6, borderRadius: 3, backgroundColor: '#e5e7eb' }}>
                <Box style={{ width: '65%', height: 6, borderRadius: 3, backgroundColor: C.accent }} />
              </Box>
              <Box style={{ width: '100%', height: 6, borderRadius: 3, backgroundColor: '#e5e7eb' }}>
                <Box style={{ width: '40%', height: 6, borderRadius: 3, backgroundColor: '#3b82f6' }} />
              </Box>
              <Box style={{ width: '100%', height: 6, borderRadius: 3, backgroundColor: '#e5e7eb' }}>
                <Box style={{ width: '80%', height: 6, borderRadius: 3, backgroundColor: '#10b981' }} />
              </Box>
            </Box>
            <Text style={{ color: '#999', fontSize: 9 }}>{'BEFORE'}</Text>
          </Box>
        </Box>

        {/* Divider */}
        <Box style={{ width: 1, flexShrink: 0, backgroundColor: c.border }} />

        {/* Right: AFTER — same content with mask applied */}
        <Box style={{ flexGrow: 1, flexBasis: 0, overflow: 'hidden', backgroundColor: '#ffffff' }}>
          <Box style={{
            position: 'absolute', left: 0, top: 0, width: '100%', height: '100%',
            justifyContent: 'center', alignItems: 'center', gap: 14,
          }}>
            <Text style={{ color: '#111', fontSize: 24, fontWeight: 'bold' }}>{tab.label}</Text>
            <Box style={{ flexDirection: 'row', gap: 8 }}>
              {[C.accent, '#3b82f6', '#10b981', '#f59e0b'].map(col => (
                <Box key={col} style={{ width: 32, height: 32, borderRadius: 6, backgroundColor: col }} />
              ))}
            </Box>
            <Box style={{ width: 160, gap: 5 }}>
              <Box style={{ width: '100%', height: 6, borderRadius: 3, backgroundColor: '#e5e7eb' }}>
                <Box style={{ width: '65%', height: 6, borderRadius: 3, backgroundColor: C.accent }} />
              </Box>
              <Box style={{ width: '100%', height: 6, borderRadius: 3, backgroundColor: '#e5e7eb' }}>
                <Box style={{ width: '40%', height: 6, borderRadius: 3, backgroundColor: '#3b82f6' }} />
              </Box>
              <Box style={{ width: '100%', height: 6, borderRadius: 3, backgroundColor: '#e5e7eb' }}>
                <Box style={{ width: '80%', height: 6, borderRadius: 3, backgroundColor: '#10b981' }} />
              </Box>
            </Box>
            <Text style={{ color: '#999', fontSize: 9 }}>{'AFTER'}</Text>
          </Box>
          <MaskComp {...maskProps} />
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
        {/* Props row */}
        <Box style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
          {allProps.map(p => {
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
              const display = val === '' ? 'none' : val;
              return (
                <Pressable key={p.name} onPress={() => setVal(p.name, next)}>
                  <Box style={{
                    flexDirection: 'row', alignItems: 'center', gap: 4,
                    paddingLeft: 6, paddingRight: 6, paddingTop: 3, paddingBottom: 3,
                    borderRadius: 4, borderWidth: 1, borderColor: c.border, backgroundColor: c.surface,
                  }}>
                    <Image src={p.icon} style={{ width: 9, height: 9 }} tintColor={c.muted} />
                    <Text style={{ color: c.muted, fontSize: 9 }}>{p.name}</Text>
                    <Text style={{ color: C.accent, fontSize: 9 }}>{display}</Text>
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
                      {step >= 1 ? String(val) : val.toFixed(step < 0.01 ? 3 : 2)}
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
      </Box>

      </Box>{/* end middle section */}

      {/* ── Tab bar ── */}
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
                    backgroundColor: active ? C.selected : hovered ? C.accentDim : c.surface,
                    borderRadius: 6,
                    borderWidth: active ? 2 : hovered ? 2 : 1,
                    borderColor: active ? C.accent : hovered ? C.accent : c.border,
                    justifyContent: 'center',
                    alignItems: 'center',
                    gap: 6,
                  }}>
                    <Image src={comp.icon} style={{ width: 16, height: 16 }} tintColor={active || hovered ? C.accent : c.muted} />
                    <Text style={{
                      color: active || hovered ? c.text : c.muted,
                      fontSize: 7,
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
        <Image src="layers" style={{ width: 12, height: 12 }} tintColor={c.muted} />
        <Text style={{ color: c.muted, fontSize: 9 }}>{'Masks'}</Text>
        <Text style={{ color: c.muted, fontSize: 9 }}>{'/'}</Text>
        <Image src={tab.icon} style={{ width: 12, height: 12 }} tintColor={c.text} />
        <Text style={{ color: c.text, fontSize: 9 }}>{tab.label}</Text>
        <Box style={{ flexGrow: 1 }} />
        <Text style={{ color: c.muted, fontSize: 9 }}>{`${TABS.indexOf(tab) + 1} of ${TABS.length}`}</Text>
      </Box>

    </S.StoryRoot>
  );
}
