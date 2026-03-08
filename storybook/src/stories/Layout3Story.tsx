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
import { Box, Text, Image, Pressable, ScrollView, CodeBlock, classifiers as S} from '../../../packages/core/src';
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
          <S.Center style={{ width: 280, height: 180, backgroundColor: c.surface, borderRadius: 16, borderWidth: 1, borderColor: c.border }}>
            <Text style={{ color: c.muted, fontSize: 24, fontWeight: 'bold' }}>{'radius: 8'}</Text>
            <S.StoryMuted>{'Gaussian blur on children'}</S.StoryMuted>
          </S.Center>
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
          <S.Center style={{ width: 240, height: 160, backgroundColor: c.surface, borderRadius: 12, borderWidth: 1, borderColor: c.border }}>
            <Text style={{ color: c.text, fontSize: 14 }}>{'Card with shadow'}</Text>
            <S.StoryCap>{'offset: 4,4  blur: 8'}</S.StoryCap>
          </S.Center>
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
            <S.StoryCap>{'Circle mask'}</S.StoryCap>
          </Box>
        </Box>
      );
    case 'noise':
      return (
        <S.GrowCenterAlign style={{ backgroundColor: c.surface }}>
          <Text style={{ color: c.muted, fontSize: 48, fontWeight: 'bold', opacity: 0.2 }}>{'NOISE'}</Text>
          <S.StoryMuted>{'intensity: 0.15  scale: 2'}</S.StoryMuted>
        </S.GrowCenterAlign>
      );
    case 'pixelate':
      return (
        <S.GrowCenterAlign style={{ backgroundColor: c.surface }}>
          <S.RowWrap style={{ width: 160, gap: 2 }}>
            {Array.from({ length: 64 }).map((_, i) => (
              <Box key={i} style={{ width: 18, height: 18, backgroundColor: i % 3 === 0 ? C.accent : i % 2 === 0 ? c.border : c.surface, opacity: 0.6 + (i % 5) * 0.08 }} />
            ))}
          </S.RowWrap>
        </S.GrowCenterAlign>
      );
    default:
      return (
        <Box style={{ ...fill }}>
          <Image src={tab.icon} style={{ width: 48, height: 48 }} tintColor={C.accent} />
          <Text style={{ color: c.muted, fontSize: 12, fontWeight: 'bold' }}>{tab.label}</Text>
          <S.StoryCap>{tab.desc}</S.StoryCap>
        </Box>
      );
  }
}

// ── Helpers ──────────────────────────────────────────────

function HorizontalDivider() {
  const c = useThemeColors();
  return <S.StoryDivider />;
}

function VerticalDivider() {
  const c = useThemeColors();
  return <S.VertDivider style={{ flexShrink: 0, alignSelf: 'stretch' }} />;
}

// ── Layout3Story ─────────────────────────────────────────

export function Layout3Story() {
  const c = useThemeColors();
  const [activeId, setActiveId] = useState(TABS[0].id);
  const tab = TABS.find(it => it.id === activeId) || TABS[0];

  return (
    <S.StoryRoot>

      {/* ── Header ── */}
      <S.RowCenterBorder style={{ flexShrink: 0, backgroundColor: c.bgElevated, borderBottomWidth: 1, paddingLeft: 20, paddingRight: 20, paddingTop: 12, paddingBottom: 12, gap: 14 }}>
        <S.StoryHeaderIcon src="sparkles" tintColor={C.accent} />
        <S.StoryTitle>
          {'Effects'}
        </S.StoryTitle>
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
        <S.StoryMuted>
          {'Visual effects — blur, glow, shadow, gradient, mask, noise'}
        </S.StoryMuted>
      </S.RowCenterBorder>

      {/* ── Preview area — LIVE DEMO of the active tab ── */}
      <S.BorderBottom style={{ flexGrow: 1 }}>
        {renderPreview(tab, c)}
      </S.BorderBottom>

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
        <S.Half style={{ padding: 12, gap: 6 }}>
          <S.BoldText style={{ fontSize: 14 }}>
            {tab.label}
          </S.BoldText>
          <S.StoryMuted>
            {tab.desc}
          </S.StoryMuted>
        </S.Half>

        <VerticalDivider />

        {/* ── Usage code ── */}
        <S.Half style={{ padding: 12, gap: 6 }}>
          <S.StoryLabelText>
            {'USAGE'}
          </S.StoryLabelText>
          <CodeBlock language="tsx" fontSize={9} code={tab.usage} />
        </S.Half>

        <VerticalDivider />

        {/* ── Props + callbacks ── */}
        <S.Half style={{ padding: 12, gap: 6 }}>
          <S.StoryLabelText>
            {'PROPS'}
          </S.StoryLabelText>
          <Box style={{ gap: 3 }}>
            {tab.props.map(([name, type, icon]) => (
              <S.RowCenterG5 key={name}>
                <S.StorySectionIcon src={icon} tintColor={c.muted} />
                <S.StoryBreadcrumbActive>{name}</S.StoryBreadcrumbActive>
                <S.StoryCap>{type}</S.StoryCap>
              </S.RowCenterG5>
            ))}
          </Box>
          {tab.callbacks.length > 0 && (
            <>
              <HorizontalDivider />
              <S.StoryLabelText>
                {'CALLBACKS'}
              </S.StoryLabelText>
              <Box style={{ gap: 3 }}>
                {tab.callbacks.map(([name, sig, icon]) => (
                  <S.RowCenterG5 key={name}>
                    <S.StorySectionIcon src={icon} tintColor={c.muted} />
                    <S.StoryBreadcrumbActive>{name}</S.StoryBreadcrumbActive>
                    <S.StoryCap>{sig}</S.StoryCap>
                  </S.RowCenterG5>
                ))}
              </Box>
            </>
          )}
        </S.Half>

      </Box>

      {/* ── Tab bar — switches the active component shown above ── */}
      <ScrollView style={{
        height: 86,
        flexShrink: 0,
        borderTopWidth: 1,
        borderColor: c.border,
        backgroundColor: c.bgElevated,
      }}>
          <S.RowG8 style={{ flexWrap: 'wrap', justifyContent: 'center', paddingLeft: 8, paddingRight: 8, paddingTop: 8, paddingBottom: 8 }}>
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
          </S.RowG8>
      </ScrollView>

      {/* ── Footer ── */}
      <S.RowCenterBorder style={{ flexShrink: 0, backgroundColor: c.bgElevated, borderTopWidth: 1, paddingLeft: 20, paddingRight: 20, paddingTop: 6, paddingBottom: 6, gap: 12 }}>
        <S.DimIcon12 src="folder" />
        <S.StoryCap>{'Packages'}</S.StoryCap>
        <S.StoryCap>{'/'}</S.StoryCap>
        <S.DimIcon12 src="sparkles" />
        <S.StoryCap>{'Effects'}</S.StoryCap>
        <S.StoryCap>{'/'}</S.StoryCap>
        <S.TextIcon12 src={tab.icon} />
        <S.StoryBreadcrumbActive>{tab.label}</S.StoryBreadcrumbActive>
        <Box style={{ flexGrow: 1 }} />
        <S.StoryCap>{`${TABS.indexOf(tab) + 1} of ${TABS.length}`}</S.StoryCap>
      </S.RowCenterBorder>

    </S.StoryRoot>
  );
}
