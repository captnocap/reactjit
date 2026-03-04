/**
 * Layout 3 — Multi-component showcase template.
 *
 * Structure:
 *   Header — package title + description
 *   Center — two-panel like Layout 1 (preview left, props/docs right)
 *   Selection bar — horizontal strip to switch between components
 *   Footer — breadcrumbs
 *
 * The selection bar is the key difference from Layout 1: instead of
 * documenting a single component, this layout showcases a package
 * of related components. Click the bar to switch which one is shown.
 *
 * TEMPLATE: All content below is placeholder (Effects package).
 */

import React, { useState } from 'react';
import { Box, Text, Image, Pressable, ScrollView, CodeBlock } from '../../../packages/core/src';
import { useThemeColors } from '../../../packages/theme/src';

// ── Palette ──────────────────────────────────────────────

const C = {
  accent: '#8b5cf6',
  accentDim: 'rgba(139, 92, 246, 0.12)',
  selected: 'rgba(139, 92, 246, 0.2)',
};

// ── Component definitions ────────────────────────────────
// Each entry is one component in the package.

interface ComponentDef {
  id: string;
  label: string;
  icon: string;
  desc: string;
  usage: string;
  props: [string, string, string][]; // [name, type, icon]
  callbacks: [string, string, string][];
}

const COMPONENTS: ComponentDef[] = [
  {
    id: 'blur',
    label: 'Blur',
    icon: 'eye-off',
    desc: 'Applies a gaussian blur to its children. Radius controls the blur intensity. Works on any subtree — images, text, entire layouts.',
    usage: `<Blur radius={8}>
  <Image src="photo.jpg" />
</Blur>`,
    props: [
      ['radius', 'number', 'circle'],
      ['style', 'ViewStyle', 'layout'],
      ['children', 'ReactNode', 'layers'],
    ],
    callbacks: [],
  },
  {
    id: 'glow',
    label: 'Glow',
    icon: 'sun',
    desc: 'Adds an outer glow effect around its children. Color and spread are configurable. Animatable — pair with useSpring for pulsing effects.',
    usage: `<Glow color="#8b5cf6" spread={12}>
  <Box style={{ padding: 16 }}>
    <Text>Highlighted</Text>
  </Box>
</Glow>`,
    props: [
      ['color', 'string', 'palette'],
      ['spread', 'number', 'maximize'],
      ['opacity', 'number', 'eye'],
      ['children', 'ReactNode', 'layers'],
    ],
    callbacks: [],
  },
  {
    id: 'shadow',
    label: 'Shadow',
    icon: 'layers',
    desc: 'Drop shadow with configurable offset, blur, and color. Multiple shadows can be stacked for depth. GPU-accelerated.',
    usage: `<Shadow
  offsetX={4} offsetY={4}
  blur={8} color="rgba(0,0,0,0.3)"
>
  <Card />
</Shadow>`,
    props: [
      ['offsetX', 'number', 'arrow-right'],
      ['offsetY', 'number', 'arrow-down'],
      ['blur', 'number', 'circle'],
      ['color', 'string', 'palette'],
      ['children', 'ReactNode', 'layers'],
    ],
    callbacks: [],
  },
  {
    id: 'gradient',
    label: 'Gradient',
    icon: 'sunset',
    desc: 'Linear or radial gradient fill. Supports multiple color stops with configurable positions. Use as a background or mask.',
    usage: `<Gradient
  colors={['#8b5cf6', '#3b82f6']}
  direction="horizontal"
  style={{ borderRadius: 8 }}
/>`,
    props: [
      ['colors', 'string[]', 'palette'],
      ['direction', 'enum', 'navigation'],
      ['stops', 'number[]', 'sliders'],
      ['style', 'ViewStyle', 'layout'],
    ],
    callbacks: [],
  },
  {
    id: 'mask',
    label: 'Mask',
    icon: 'crop',
    desc: 'Clips children to the shape of a mask element. The first child is the mask shape, the second is the content. Alpha channel controls visibility.',
    usage: `<Mask>
  <Circle radius={50} />
  <Image src="photo.jpg" />
</Mask>`,
    props: [
      ['inverted', 'boolean', 'refresh-cw'],
      ['children', 'ReactNode', 'layers'],
    ],
    callbacks: [],
  },
  {
    id: 'noise',
    label: 'Noise',
    icon: 'radio',
    desc: 'Perlin noise overlay for texture. Animatable seed creates organic motion. Use as a film grain effect or procedural texture.',
    usage: `<Noise
  intensity={0.15}
  scale={2}
  animated
/>`,
    props: [
      ['intensity', 'number', 'sliders'],
      ['scale', 'number', 'maximize'],
      ['seed', 'number', 'hash'],
      ['animated', 'boolean', 'play'],
    ],
    callbacks: [],
  },
];

// ── Helpers ──────────────────────────────────────────────

function HorizontalDivider() {
  const c = useThemeColors();
  return <Box style={{ height: 1, flexShrink: 0, backgroundColor: c.border }} />;
}

function VerticalDivider() {
  const c = useThemeColors();
  return <Box style={{ width: 1, flexShrink: 0, alignSelf: 'stretch', backgroundColor: c.border }} />;
}

// ── Layout3Story ─────────────────────────────────────────

export function Layout3Story() {
  const c = useThemeColors();
  const [selectedId, setSelectedId] = useState(COMPONENTS[0].id);
  const selected = COMPONENTS.find(it => it.id === selectedId) || COMPONENTS[0];

  return (
    <Box style={{ width: '100%', height: '100%', backgroundColor: c.bg }}>

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
          <Text style={{ color: C.accent, fontSize: 10 }}>{'@reactjit/effects'}</Text>
        </Box>
        <Box style={{ flexGrow: 1 }} />
        <Text style={{ color: c.muted, fontSize: 10 }}>
          {'Visual effects — blur, glow, shadow, gradient, mask, noise'}
        </Text>
      </Box>

      {/* ── Center: two-panel ── */}
      <Box style={{ flexGrow: 1, flexDirection: 'row' }}>

        {/* ── Left: Preview ── */}
        <Box style={{
          flexGrow: 1,
          flexBasis: 0,
          justifyContent: 'center',
          alignItems: 'center',
          gap: 16,
        }}>
          <Box style={{
            width: 140,
            height: 140,
            backgroundColor: c.surface,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: c.border,
            justifyContent: 'center',
            alignItems: 'center',
          }}>
            <Image src={selected.icon} style={{ width: 48, height: 48 }} tintColor={C.accent} />
          </Box>
          <Text style={{ color: c.text, fontSize: 16, fontWeight: 'bold' }}>
            {selected.label}
          </Text>
          <Text style={{ color: c.muted, fontSize: 10, textAlign: 'center', paddingLeft: 40, paddingRight: 40 }}>
            {selected.desc}
          </Text>
        </Box>

        <VerticalDivider />

        {/* ── Right: Props / docs ── */}
        <ScrollView style={{ flexGrow: 1, flexBasis: 0 }}>
          <Box style={{ padding: 14, gap: 10 }}>

            {/* ── Usage ── */}
            <Text style={{ color: c.muted, fontSize: 8, fontWeight: 'bold', letterSpacing: 1 }}>
              {'USAGE'}
            </Text>
            <CodeBlock language="tsx" fontSize={9} code={selected.usage} />

            <HorizontalDivider />

            {/* ── Props ── */}
            <Text style={{ color: c.muted, fontSize: 8, fontWeight: 'bold', letterSpacing: 1 }}>
              {'PROPS'}
            </Text>
            <Box style={{ gap: 3 }}>
              {selected.props.map(([name, type, icon]) => (
                <Box key={name} style={{ flexDirection: 'row', gap: 5, alignItems: 'center' }}>
                  <Image src={icon} style={{ width: 10, height: 10 }} tintColor={c.muted} />
                  <Text style={{ color: c.text, fontSize: 9 }}>{name}</Text>
                  <Text style={{ color: c.muted, fontSize: 9 }}>{type}</Text>
                </Box>
              ))}
            </Box>

            {selected.callbacks.length > 0 && (
              <>
                <HorizontalDivider />
                <Text style={{ color: c.muted, fontSize: 8, fontWeight: 'bold', letterSpacing: 1 }}>
                  {'CALLBACKS'}
                </Text>
                <Box style={{ gap: 3 }}>
                  {selected.callbacks.map(([name, sig, icon]) => (
                    <Box key={name} style={{ flexDirection: 'row', gap: 5, alignItems: 'center' }}>
                      <Image src={icon} style={{ width: 10, height: 10 }} tintColor={c.muted} />
                      <Text style={{ color: c.text, fontSize: 9 }}>{name}</Text>
                      <Text style={{ color: c.muted, fontSize: 9 }}>{sig}</Text>
                    </Box>
                  ))}
                </Box>
              </>
            )}

          </Box>
        </ScrollView>

      </Box>

      {/* ── Selection bar ── */}
      <ScrollView style={{
        flexShrink: 0,
        maxHeight: 124,
        borderTopWidth: 1,
        borderColor: c.border,
        backgroundColor: c.bgElevated,
      }}>
          <Box style={{
            flexDirection: 'row',
            flexWrap: 'wrap',
            paddingLeft: 8,
            paddingRight: 8,
            paddingTop: 8,
            paddingBottom: 8,
            gap: 8,
          }}>
            {COMPONENTS.map(comp => {
              const active = comp.id === selectedId;
              return (
                <Pressable key={comp.id} onPress={() => setSelectedId(comp.id)}>
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
                  }}>
                    <Image src={comp.icon} style={{ width: 16, height: 16 }} tintColor={active ? C.accent : c.muted} />
                    <Text style={{ color: active ? c.text : c.muted, fontSize: 7 }}>
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
        <Image src={selected.icon} style={{ width: 12, height: 12 }} tintColor={c.text} />
        <Text style={{ color: c.text, fontSize: 9 }}>{selected.label}</Text>
        <Box style={{ flexGrow: 1 }} />
        <Text style={{ color: c.muted, fontSize: 9 }}>{`${COMPONENTS.indexOf(selected) + 1} of ${COMPONENTS.length}`}</Text>
      </Box>

    </Box>
  );
}
