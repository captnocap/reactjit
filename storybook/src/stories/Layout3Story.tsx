/**
 * Layout 3 — Tabbed multi-component showcase.
 *
 * Structure:
 *   Header   — package title + badge + description
 *   Preview  — LIVE DEMO of the active tab's component (flexGrow: 1)
 *   Info row — horizontal strip: description | code example | props
 *   Tab bar  — clickable tabs (one per component)
 *   Footer   — breadcrumbs with "N of M" counter
 *
 * The TABS array drives the info row, tab bar, and footer.
 * The renderPreview function drives the preview area — one case per tab.
 * Clicking a tab swaps everything: preview, description, usage, and props.
 *
 * To scaffold a new story from this layout: copy the file, replace
 * TABS and renderPreview with your own entries. Done.
 *
 * TEMPLATE: Content below uses a fictional "Effects" package as placeholder.
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

// ── Tabs ─────────────────────────────────────────────────
// Each tab represents one component/feature in the package.
// The selection bar at the bottom switches between them.
// To scaffold a new story from this layout, replace TABS with
// your own entries — the rest of the layout adapts automatically.

interface TabDef {
  id: string;
  label: string;
  icon: string;
  desc: string;
  usage: string;
  props: [string, string, string][]; // [name, type, icon]
  callbacks: [string, string, string][];
}

const TABS: TabDef[] = [
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
  {
    id: 'pixelate',
    label: 'Pixelate',
    icon: 'grid',
    desc: 'Reduces resolution to create a mosaic/pixel art effect. Block size controls granularity. Animatable for retro transitions.',
    usage: `<Pixelate blockSize={8}>
  <Image src="photo.jpg" />
</Pixelate>`,
    props: [
      ['blockSize', 'number', 'grid'],
      ['children', 'ReactNode', 'layers'],
    ],
    callbacks: [],
  },
  {
    id: 'vignette',
    label: 'Vignette',
    icon: 'aperture',
    desc: 'Darkens edges with a smooth radial falloff. Classic camera lens effect. Adjustable radius and softness.',
    usage: `<Vignette
  radius={0.7}
  softness={0.4}
  color="#000"
/>`,
    props: [
      ['radius', 'number', 'circle'],
      ['softness', 'number', 'feather'],
      ['color', 'string', 'palette'],
    ],
    callbacks: [],
  },
  {
    id: 'distort',
    label: 'Distort',
    icon: 'zap',
    desc: 'Barrel or pincushion distortion. Warps geometry through a lens model. Strength controls intensity and direction.',
    usage: `<Distort strength={0.5} mode="barrel">
  <Box style={{ padding: 20 }}>
    <Text>Warped</Text>
  </Box>
</Distort>`,
    props: [
      ['strength', 'number', 'sliders'],
      ['mode', 'enum', 'settings'],
      ['children', 'ReactNode', 'layers'],
    ],
    callbacks: [],
  },
  {
    id: 'chromatic',
    label: 'Chromatic',
    icon: 'droplet',
    desc: 'Chromatic aberration — splits RGB channels with configurable offset. Creates a glitchy, prismatic look.',
    usage: `<Chromatic offset={3}>
  <Image src="photo.jpg" />
</Chromatic>`,
    props: [
      ['offset', 'number', 'move'],
      ['angle', 'number', 'rotate-cw'],
      ['children', 'ReactNode', 'layers'],
    ],
    callbacks: [],
  },
  {
    id: 'threshold',
    label: 'Threshold',
    icon: 'contrast',
    desc: 'Converts to black and white at a configurable cutoff. Hard binary output — no antialiasing. Good for stencil masks.',
    usage: `<Threshold cutoff={0.5}>
  <Image src="photo.jpg" />
</Threshold>`,
    props: [
      ['cutoff', 'number', 'sliders'],
      ['children', 'ReactNode', 'layers'],
    ],
    callbacks: [],
  },
  {
    id: 'bloom',
    label: 'Bloom',
    icon: 'star',
    desc: 'Bright areas bleed light into surroundings. Threshold controls which pixels bloom. Intensity scales the glow.',
    usage: `<Bloom
  threshold={0.8}
  intensity={1.2}
  radius={6}
/>`,
    props: [
      ['threshold', 'number', 'sliders'],
      ['intensity', 'number', 'sun'],
      ['radius', 'number', 'circle'],
    ],
    callbacks: [],
  },
  {
    id: 'tint',
    label: 'Tint',
    icon: 'edit-3',
    desc: 'Applies a color overlay with blend mode control. Multiply, screen, overlay, and soft light modes available.',
    usage: `<Tint
  color="#8b5cf6"
  mode="multiply"
  opacity={0.6}
/>`,
    props: [
      ['color', 'string', 'palette'],
      ['mode', 'enum', 'layers'],
      ['opacity', 'number', 'eye'],
    ],
    callbacks: [],
  },
  {
    id: 'ripple',
    label: 'Ripple',
    icon: 'activity',
    desc: 'Animated concentric wave distortion emanating from a center point. Speed and amplitude are configurable.',
    usage: `<Ripple
  centerX={0.5} centerY={0.5}
  amplitude={8} speed={2}
>
  <Image src="water.jpg" />
</Ripple>`,
    props: [
      ['centerX', 'number', 'arrow-right'],
      ['centerY', 'number', 'arrow-down'],
      ['amplitude', 'number', 'sliders'],
      ['speed', 'number', 'fast-forward'],
      ['children', 'ReactNode', 'layers'],
    ],
    callbacks: [],
  },
  {
    id: 'scanlines',
    label: 'Scanlines',
    icon: 'minus',
    desc: 'CRT-style horizontal scanlines. Line width, spacing, and opacity are adjustable. Pair with Noise for full retro look.',
    usage: `<Scanlines
  lineWidth={1}
  spacing={3}
  opacity={0.4}
/>`,
    props: [
      ['lineWidth', 'number', 'minus'],
      ['spacing', 'number', 'maximize'],
      ['opacity', 'number', 'eye'],
    ],
    callbacks: [],
  },
  {
    id: 'invert',
    label: 'Invert',
    icon: 'refresh-cw',
    desc: 'Inverts all colors. Simple 1-complement operation. Optional channel mask to invert only R, G, or B independently.',
    usage: `<Invert channels="rgb">
  <Image src="photo.jpg" />
</Invert>`,
    props: [
      ['channels', 'string', 'sliders'],
      ['children', 'ReactNode', 'layers'],
    ],
    callbacks: [],
  },
  {
    id: 'freeze',
    label: 'Freeze',
    icon: 'pause',
    desc: 'Captures a single frame and holds it. Useful for before/after comparisons or transition freeze-frames.',
    usage: `<Freeze frame={42}>
  <AnimatedScene />
</Freeze>`,
    props: [
      ['frame', 'number', 'hash'],
      ['children', 'ReactNode', 'layers'],
    ],
    callbacks: [
      ['onCapture', '(frame: number) => void', 'camera'],
    ],
  },
  {
    id: 'tile',
    label: 'Tile',
    icon: 'copy',
    desc: 'Repeats children in a grid pattern. Columns and rows control repetition count. Each tile is clipped to cell bounds.',
    usage: `<Tile columns={3} rows={3}>
  <Icon name="star" />
</Tile>`,
    props: [
      ['columns', 'number', 'grid'],
      ['rows', 'number', 'grid'],
      ['gap', 'number', 'maximize'],
      ['children', 'ReactNode', 'layers'],
    ],
    callbacks: [],
  },
];

// ── Preview renderer ─────────────────────────────────────
// Renders a LIVE DEMO for each tab. This fills the entire preview area.
// Every case MUST produce content that visually fills the space.
// NEVER return a tiny icon centered in a void.
//
// NOTE: This is a TEMPLATE using fictional components. In a real story,
// each case renders the actual component being documented.

function renderPreview(tab: TabDef, c: ReturnType<typeof useThemeColors>) {
  // Shared style for the full-area preview container
  const fill = { flexGrow: 1, justifyContent: 'center' as const, alignItems: 'center' as const };

  switch (tab.id) {
    case 'blur':
      return (
        <Box style={{ ...fill, backgroundColor: 'rgba(139, 92, 246, 0.05)' }}>
          <Box style={{ width: 280, height: 180, backgroundColor: c.surface, borderRadius: 16, borderWidth: 1, borderColor: c.border, justifyContent: 'center', alignItems: 'center' }}>
            <Text style={{ color: c.muted, fontSize: 24, fontWeight: 'bold' }}>{'radius: 8'}</Text>
            <Text style={{ color: c.muted, fontSize: 10 }}>{'Gaussian blur on children'}</Text>
          </Box>
        </Box>
      );
    case 'glow':
      return (
        <Box style={{ ...fill, backgroundColor: 'rgba(139, 92, 246, 0.08)' }}>
          <Box style={{ width: 200, height: 200, backgroundColor: C.accent, borderRadius: 100, opacity: 0.3 }} />
        </Box>
      );
    case 'shadow':
      return (
        <Box style={{ ...fill }}>
          <Box style={{ width: 240, height: 160, backgroundColor: c.surface, borderRadius: 12, borderWidth: 1, borderColor: c.border, justifyContent: 'center', alignItems: 'center' }}>
            <Text style={{ color: c.text, fontSize: 14 }}>{'Card with shadow'}</Text>
            <Text style={{ color: c.muted, fontSize: 9 }}>{'offset: 4,4  blur: 8'}</Text>
          </Box>
        </Box>
      );
    case 'gradient':
      return (
        <Box style={{ flexGrow: 1, backgroundColor: C.accent, opacity: 0.15 }} />
      );
    case 'mask':
      return (
        <Box style={{ ...fill }}>
          <Box style={{ width: 200, height: 200, backgroundColor: c.surface, borderRadius: 100, borderWidth: 2, borderColor: C.accent, justifyContent: 'center', alignItems: 'center' }}>
            <Image src="crop" style={{ width: 48, height: 48 }} tintColor={C.accent} />
            <Text style={{ color: c.muted, fontSize: 9 }}>{'Circle mask'}</Text>
          </Box>
        </Box>
      );
    case 'noise':
      return (
        <Box style={{ flexGrow: 1, backgroundColor: c.surface, justifyContent: 'center', alignItems: 'center' }}>
          <Text style={{ color: c.muted, fontSize: 48, fontWeight: 'bold', opacity: 0.2 }}>{'NOISE'}</Text>
          <Text style={{ color: c.muted, fontSize: 10 }}>{'intensity: 0.15  scale: 2'}</Text>
        </Box>
      );
    case 'pixelate':
      return (
        <Box style={{ flexGrow: 1, backgroundColor: c.surface, justifyContent: 'center', alignItems: 'center' }}>
          <Box style={{ flexDirection: 'row', flexWrap: 'wrap', width: 160, gap: 2 }}>
            {Array.from({ length: 64 }).map((_, i) => (
              <Box key={i} style={{ width: 18, height: 18, backgroundColor: i % 3 === 0 ? C.accent : i % 2 === 0 ? c.border : c.surface, opacity: 0.6 + (i % 5) * 0.08 }} />
            ))}
          </Box>
        </Box>
      );
    default:
      return (
        <Box style={{ ...fill }}>
          <Image src={tab.icon} style={{ width: 48, height: 48 }} tintColor={C.accent} />
          <Text style={{ color: c.muted, fontSize: 12, fontWeight: 'bold' }}>{tab.label}</Text>
          <Text style={{ color: c.muted, fontSize: 9 }}>{tab.desc}</Text>
        </Box>
      );
  }
}

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
  const [activeId, setActiveId] = useState(TABS[0].id);
  const tab = TABS.find(it => it.id === activeId) || TABS[0];

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

      {/* ── Preview area — LIVE DEMO of the active tab ── */}
      <Box style={{ flexGrow: 1, borderBottomWidth: 1, borderColor: c.border }}>
        {renderPreview(tab, c)}
      </Box>

      {/* ── Info row — description | code | props ── */}
      <Box style={{
        height: 120,
        flexShrink: 0,
        flexDirection: 'row',
        borderTopWidth: 1,
        borderColor: c.border,
        backgroundColor: c.bgElevated,
        overflow: 'hidden',
      }}>

        {/* ── Description ── */}
        <Box style={{ flexGrow: 1, flexBasis: 0, padding: 12, gap: 6 }}>
          <Text style={{ color: c.text, fontSize: 14, fontWeight: 'bold' }}>
            {tab.label}
          </Text>
          <Text style={{ color: c.muted, fontSize: 10 }}>
            {tab.desc}
          </Text>
        </Box>

        <VerticalDivider />

        {/* ── Usage code ── */}
        <Box style={{ flexGrow: 1, flexBasis: 0, padding: 12, gap: 6 }}>
          <Text style={{ color: c.muted, fontSize: 8, fontWeight: 'bold', letterSpacing: 1 }}>
            {'USAGE'}
          </Text>
          <CodeBlock language="tsx" fontSize={9} code={tab.usage} />
        </Box>

        <VerticalDivider />

        {/* ── Props + callbacks ── */}
        <Box style={{ flexGrow: 1, flexBasis: 0, padding: 12, gap: 6 }}>
          <Text style={{ color: c.muted, fontSize: 8, fontWeight: 'bold', letterSpacing: 1 }}>
            {'PROPS'}
          </Text>
          <Box style={{ gap: 3 }}>
            {tab.props.map(([name, type, icon]) => (
              <Box key={name} style={{ flexDirection: 'row', gap: 5, alignItems: 'center' }}>
                <Image src={icon} style={{ width: 10, height: 10 }} tintColor={c.muted} />
                <Text style={{ color: c.text, fontSize: 9 }}>{name}</Text>
                <Text style={{ color: c.muted, fontSize: 9 }}>{type}</Text>
              </Box>
            ))}
          </Box>
          {tab.callbacks.length > 0 && (
            <>
              <HorizontalDivider />
              <Text style={{ color: c.muted, fontSize: 8, fontWeight: 'bold', letterSpacing: 1 }}>
                {'CALLBACKS'}
              </Text>
              <Box style={{ gap: 3 }}>
                {tab.callbacks.map(([name, sig, icon]) => (
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

      </Box>

      {/* ── Tab bar — switches the active component shown above ── */}
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
              return (
                <Pressable key={comp.id} onPress={() => setActiveId(comp.id)}>
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
        <Image src={tab.icon} style={{ width: 12, height: 12 }} tintColor={c.text} />
        <Text style={{ color: c.text, fontSize: 9 }}>{tab.label}</Text>
        <Box style={{ flexGrow: 1 }} />
        <Text style={{ color: c.muted, fontSize: 9 }}>{`${TABS.indexOf(tab) + 1} of ${TABS.length}`}</Text>
      </Box>

    </Box>
  );
}
