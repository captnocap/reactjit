/**
 * StyleStory — Layout1 documentation for all visual concerns:
 * style properties, icons, and theming.
 *
 * Left: interactive visual demos (gradients, borders, shadows, transforms,
 *       icons, theme swatches & gallery).
 * Right: API reference for style props, Icon component, and theme hooks.
 * Playground: editable JSX with live preview.
 */

import React, { useState } from 'react';
import { Box, Text, Image, TextEditor, CodeBlock, Pressable, ScrollView, TextInput, useMount, classifiers as S} from '../../../packages/core/src';
import { useThemeColors, ThemeSwitcher, useTheme, themeNames, themes } from '../../../packages/theme/src';
import { Icon } from '../../../packages/icons/src';
import * as AllIcons from '../../../packages/icons/src/icons';
import { iconNames } from '../../../packages/icons/src/iconNames';
import { transformJSX } from '../playground/lib/jsx-transform';
import { evalComponent } from '../playground/lib/eval-component';
import { Preview } from '../playground/Preview';

// ── Syntax colors ────────────────────────────────────────

const SYN = {
  tag: '#f38ba8',
  prop: '#cba6f7',
  value: '#f9e2af',
};

// ── Palette ──────────────────────────────────────────────

const P = {
  red: '#ef4444', orange: '#f97316',
  green: '#22c55e', cyan: '#06b6d4',
  blue: '#3b82f6', indigo: '#6366f1', violet: '#8b5cf6',
  rose: '#f43f5e', yellow: '#eab308',
};

// ── Icon constants ───────────────────────────────────────

const iconMap: Record<string, number[][]> = AllIcons as any;
const ICONS_PER_PAGE = 80;
const ICON_SIZES = [16, 20, 24, 32, 48];

// ── Helpers ──────────────────────────────────────────────

function styleTooltip(style: Record<string, any>): { content: string; layout: string; type: string } | undefined {
  const STRUCTURAL = new Set([
    'flexGrow', 'flexShrink', 'flexBasis', 'flexDirection', 'flexWrap',
    'alignItems', 'alignSelf', 'justifyContent', 'overflow',
    'position', 'zIndex', 'display',
  ]);
  const entries = Object.entries(style).filter(([k, v]) => !STRUCTURAL.has(k) && v !== undefined);
  if (entries.length === 0) return undefined;
  const content = entries.map(([k, v]) =>
    typeof v === 'object' ? `${k}: ${JSON.stringify(v)}` : `${k}: ${v}`
  ).join('\n');
  return { content, layout: 'table', type: 'cursor' };
}

function HorizontalDivider() {
  const c = useThemeColors();
  return <S.StoryDivider />;
}

function VerticalDivider() {
  const c = useThemeColors();
  return <S.VertDivider style={{ flexShrink: 0, alignSelf: 'stretch' }} />;
}

function SectionLabel({ children }: { children: string }) {
  const c = useThemeColors();
  return <S.StoryTiny style={{ fontWeight: 'bold' }}>{children}</S.StoryTiny>;
}

function ColorSwatch({ color, label }: { color: string; label: string }) {
  const c = useThemeColors();
  return (
    <S.RowCenterG6 style={{ paddingLeft: 8, paddingRight: 8, paddingTop: 5, paddingBottom: 5, borderRadius: 6, borderWidth: 1, borderColor: c.border, backgroundColor: c.surface }}>
      <Box style={{
        width: 14,
        height: 14,
        backgroundColor: color,
        borderRadius: 3,
        borderWidth: 1,
        borderColor: c.border,
      }} />
      <S.StoryCap>{label}</S.StoryCap>
    </S.RowCenterG6>
  );
}

function ThemeCard({
  id,
  isActive,
  onPress,
}: {
  id: string;
  isActive: boolean;
  onPress: () => void;
}) {
  const theme = themes[id];
  if (!theme) return null;
  const tc = theme.colors;
  const swatches = [
    tc.bg, tc.bgAlt, tc.bgElevated, tc.surface, tc.border,
    tc.text, tc.primary, tc.accent, tc.error, tc.warning, tc.success, tc.info,
  ];

  return (
    <Pressable onPress={onPress} style={{
      flexGrow: 1,
      flexBasis: 100,
      maxWidth: '49%',
      padding: 6,
      borderRadius: 6,
      borderWidth: isActive ? 2 : 1,
      borderColor: isActive ? tc.primary : tc.border,
      backgroundColor: tc.bg,
      gap: 3,
    }}>
      <S.RowCenterG4>
        <Text style={{ color: tc.text, fontSize: 8, flexGrow: 1 }}>
          {theme.displayName}
        </Text>
        <Box style={{
          paddingLeft: 4, paddingRight: 4, paddingTop: 1, paddingBottom: 1,
          backgroundColor: tc.primary, borderRadius: 2,
        }}>
          <Text style={{ color: tc.bg, fontSize: 6 }}>{'A'}</Text>
        </Box>
      </S.RowCenterG4>
      <S.RowWrap style={{ gap: 1 }}>
        {swatches.map((color, i) => (
          <Box key={i} style={{
            width: 8, height: 8,
            backgroundColor: color,
            borderRadius: 1,
          }} />
        ))}
      </S.RowWrap>
    </Pressable>
  );
}

// ── Static data (hoisted — never recreated) ──────────────

const STYLE_USAGE_CODE = `import { Box, Text } from '@reactjit/core';

// Gradient background
<Box style={{
  backgroundGradient: {
    direction: 'horizontal',
    colors: ['#3b82f6', '#8b5cf6'],
  },
  borderRadius: 8,
  height: 50,
}} />

// Border + shadow
<Box style={{
  borderWidth: 2,
  borderColor: '#3b82f6',
  borderRadius: 8,
  shadowColor: 'rgba(0,0,0,0.15)',
  shadowOffsetY: 8,
  shadowBlur: 20,
  padding: 16,
}}>
  <Text style={{ color: '#3b82f6' }}>
    {'Bordered + shadow'}
  </Text>
</Box>

// Transform
<Box style={{
  transform: { rotate: 15, scaleX: 1.1, scaleY: 1.1 },
  backgroundColor: '#8b5cf6',
  borderRadius: 8,
  padding: 16,
}} />`;

const ICON_USAGE_CODE = `import { Icon } from '@reactjit/icons';
import { Heart, Star, Home, Plus } from '@reactjit/icons';

// Basic
<Icon icon={Heart} size={24} color="#ef4444" />

// Inline with text
<Box style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
  <Icon icon={Home} size={16} color={c.text} />
  <Text>Home</Text>
</Box>

// In a button
<Pressable style={{ flexDirection: 'row', gap: 6, ... }}>
  <Icon icon={Plus} size={14} color="#fff" />
  <Text style={{ color: '#fff' }}>New Item</Text>
</Pressable>`;

const THEME_USAGE_CODE = `import {
  useThemeColors, useTheme, ThemeSwitcher,
} from '@reactjit/theme';

// Access color tokens
const c = useThemeColors();
<Box style={{ backgroundColor: c.bg }}>
  <Text style={{ color: c.text }}>Themed</Text>
  <Text style={{ color: c.primary }}>Primary</Text>
</Box>

// Switch themes programmatically
const { themeId, setTheme } = useTheme();
setTheme('catppuccin-mocha');

// Built-in switcher widget
<ThemeSwitcher />`;

const STARTER_CODE = `<Box style={{ gap: 14, padding: 16 }}>
  {/* Gradient card with shadow */}
  <Box style={{
    backgroundGradient: {
      direction: 'horizontal',
      colors: ['#3b82f6', '#8b5cf6'],
    },
    borderRadius: 12,
    padding: 16,
    shadowColor: 'rgba(0,0,0,0.25)',
    shadowOffsetY: 10,
    shadowBlur: 24,
    gap: 6,
  }}>
    <Text style={{
      color: '#fff',
      fontSize: 18,
      fontWeight: 'bold',
    }}>
      Visual Styles
    </Text>
    <Text style={{
      color: 'rgba(255,255,255,0.7)',
      fontSize: 11,
    }}>
      Gradient + shadow + border radius
    </Text>
  </Box>

  {/* Badge row */}
  <Box style={{ flexDirection: 'row', gap: 6 }}>
    <Badge text="default" />
    <Badge text="success" color="#22c55e" />
    <Badge text="warning" color="#f97316" />
    <Badge text="info" color="#06b6d4" />
  </Box>

  {/* Bordered cards */}
  <Box style={{ flexDirection: 'row', gap: 8 }}>
    <Card style={{
      flexGrow: 1,
      borderWidth: 2,
      borderColor: '#ef4444',
    }}>
      <Text style={{
        color: '#ef4444',
        fontSize: 12,
        fontWeight: 'bold',
      }}>
        Left border accent
      </Text>
    </Card>
    <Card style={{
      flexGrow: 1,
      borderWidth: 2,
      borderColor: '#22c55e',
    }}>
      <Text style={{
        color: '#22c55e',
        fontSize: 12,
        fontWeight: 'bold',
      }}>
        Green variant
      </Text>
    </Card>
  </Box>

  {/* Transform tilt */}
  <Box style={{
    backgroundGradient: {
      direction: 'diagonal',
      colors: ['#f97316', '#ef4444'],
    },
    borderRadius: 8,
    padding: 14,
    transform: { rotate: 2 },
    alignItems: 'center',
  }}>
    <Text style={{ color: '#fff', fontSize: 12 }}>
      Slight tilt via transform
    </Text>
  </Box>

  {/* Opacity scale */}
  <Box style={{ flexDirection: 'row', gap: 4 }}>
    {[1, 0.7, 0.4, 0.2].map(op => (
      <Box key={op} style={{
        flexGrow: 1,
        height: 32,
        backgroundColor: '#8b5cf6',
        opacity: op,
        borderRadius: 6,
        justifyContent: 'center',
        alignItems: 'center',
      }}>
        <Text style={{
          color: '#fff',
          fontSize: 9,
        }}>
          {String(op)}
        </Text>
      </Box>
    ))}
  </Box>
</Box>`;

// Style props — [name, type, icon]
const STYLE_PROPS: [string, string, string][] = [
  ['backgroundGradient', '{ direction, colors[] }', 'sunrise'],
  ['borderWidth / borderColor', 'number / Color', 'square'],
  ['borderTopWidth ... borderLeftWidth', 'number', 'minus'],
  ['borderRadius', 'number', 'circle'],
  ['opacity', 'number (0\u20131)', 'eye'],
  ['shadowColor', 'Color', 'droplets'],
  ['shadowOffsetX / shadowOffsetY', 'number', 'move'],
  ['shadowBlur', 'number', 'wind'],
  ['transform', '{ rotate, scaleX, scaleY, translateX, translateY }', 'refresh-cw'],
  ['position', "'absolute' | 'relative'", 'anchor'],
  ['top / right / bottom / left', 'number | string', 'move'],
  ['zIndex', 'number', 'layers'],
  ['overflow', "'hidden' | 'visible' | 'scroll'", 'scissors'],
];

const ICON_PROPS: [string, string][] = [
  ['icon', 'number[][] \u2014 path data from @reactjit/icons'],
  ['size', 'number \u2014 width & height in px (default 24)'],
  ['color', 'Color \u2014 fill color'],
];

const THEME_TOKENS: [string, string][] = [
  ['bg', 'Page background'],
  ['bgAlt', 'Alternate background'],
  ['bgElevated', 'Elevated surface (cards, modals)'],
  ['text', 'Primary text'],
  ['textSecondary', 'Secondary text'],
  ['textDim', 'Dimmed / subtle text'],
  ['primary', 'Primary brand color'],
  ['accent', 'Accent color'],
  ['surface', 'Card / panel surface'],
  ['border', 'Dividers and borders'],
  ['error', 'Error state'],
  ['warning', 'Warning state'],
  ['success', 'Success state'],
  ['info', 'Informational state'],
  ['muted', 'Muted / disabled'],
];

const STYLE_BEHAVIOR_NOTES = [
  'backgroundGradient overrides backgroundColor. Use direction: "horizontal", "vertical", or "diagonal" with a colors array.',
  'Per-side borders (borderTopWidth etc.) require borderColor to also be set. borderWidth sets all four sides at once.',
  'transform is applied as a single object: { rotate, scaleX, scaleY, translateX, translateY }. All fields are optional.',
  'overflow: "hidden" clips children to the box bounds. overflow: "visible" lets children paint outside (default).',
  'position: "absolute" removes the element from flex flow. Use top/right/bottom/left for placement. zIndex controls stacking order.',
];

// ── Component ────────────────────────────────────────────

export function StyleStory() {
  const c = useThemeColors();
  const { themeId, setTheme } = useTheme();

  // Playground
  const [playground, setPlayground] = useState(false);
  const [code, setCode] = useState(STARTER_CODE);
  const [UserComponent, setUserComponent] = useState<React.ComponentType | null>(null);
  const [errors, setErrors] = useState<string[]>([]);

  // Style demos

  // Icon browser
  const [iconFilter, setIconFilter] = useState('');
  const [iconSize, setIconSize] = useState(24);
  const [selectedIcon, setSelectedIcon] = useState<string | null>(null);
  const [iconPage, setIconPage] = useState(0);

  const filteredIcons = (() => {
    if (!iconFilter) return iconNames;
    const lower = iconFilter.toLowerCase();
    return iconNames.filter(n => n.toLowerCase().includes(lower));
  })();

  const iconTotalPages = Math.ceil(filteredIcons.length / ICONS_PER_PAGE);
  const pageIcons = filteredIcons.slice(iconPage * ICONS_PER_PAGE, (iconPage + 1) * ICONS_PER_PAGE);

  // Playground helpers
  const processCode = (src: string) => {
    const result = transformJSX(src);
    if (result.errors.length > 0) {
      setErrors(result.errors.map(e => `Line ${e.line}:${e.col}: ${e.message}`));
      return;
    }
    const evalResult = evalComponent(result.code);
    if (evalResult.error) { setErrors([evalResult.error]); return; }
    setErrors([]);
    setUserComponent(() => evalResult.component);
  };

  useMount(() => {
    if (code) processCode(code);
  });

  const handleCodeChange = (src: string) => {
    setCode(src);
    processCode(src);
  };

  return (
    <S.StoryRoot>

      {/* ── Header ── */}
      <S.RowCenterBorder style={{ flexShrink: 0, backgroundColor: c.bgElevated, borderBottomWidth: 1, paddingLeft: 20, paddingRight: 20, paddingTop: 12, paddingBottom: 12, gap: 14 }}>
        <S.PrimaryIcon20 src="palette" />

        <S.StoryTitle>
          {'Style'}
        </S.StoryTitle>

        <S.StoryBtnSm style={{ flexDirection: 'row', backgroundColor: c.surface, borderWidth: 1, borderColor: c.border }}>
          <Text style={{ color: SYN.tag, fontSize: 10 }}>{'style'}</Text>
          <S.StoryMuted>{`={{ `}</S.StoryMuted>
          <Text style={{ color: SYN.prop, fontSize: 10 }}>{'opacity'}</Text>
          <S.StoryMuted>{': '}</S.StoryMuted>
          <Text style={{ color: SYN.value, fontSize: 10 }}>{'0.8'}</Text>
          <S.StoryMuted>{' }}'}</S.StoryMuted>
        </S.StoryBtnSm>

        <Box style={{ flexGrow: 1 }} />

        <S.StoryMuted>
          {'Making rectangles feel feelings'}
        </S.StoryMuted>
      </S.RowCenterBorder>

      {/* ── Center ── */}
      <S.RowGrow>
        {playground ? (
          <>
            <S.Half>
              <TextEditor
                initialValue={code}
                onChange={handleCodeChange}
                onBlur={handleCodeChange}
                onSubmit={handleCodeChange}
                changeDelay={3}
                syntaxHighlight
                placeholder="Write JSX here..."
                style={{ flexGrow: 1, width: '100%' }}
                textStyle={{ fontSize: 13, fontFamily: 'monospace' }}
              />
            </S.Half>
            <VerticalDivider />
            <Preview UserComponent={UserComponent} errors={errors} />
          </>
        ) : (
          <>
            {/* ══════════════ LEFT: Visual Demos ══════════════ */}
            <ScrollView style={{ flexGrow: 1, flexBasis: 0, justifyContent: 'center', alignItems: 'center' }}>
              <Box style={{ width: '100%', padding: 20, gap: 14 }}>

                {/* ── Gradients ── */}
                <SectionLabel>{'GRADIENTS'}</SectionLabel>
                <Box style={{ gap: 6 }}>
                  {([
                    ['horizontal', ['#3b82f6', '#8b5cf6']],
                    ['vertical', ['#f97316', '#ef4444']],
                    ['diagonal', ['#22c55e', '#06b6d4']],
                  ] as const).map(([dir, colors]) => {
                    const custom = { backgroundGradient: { direction: dir, colors: [...colors] }, borderRadius: 8 };
                    return (
                      <Box key={dir} style={{ ...custom, height: 36, justifyContent: 'center', alignItems: 'center' }} tooltip={styleTooltip(custom)}>
                        <S.WhiteCaption>{dir}</S.WhiteCaption>
                      </Box>
                    );
                  })}
                </Box>

                {/* ── Borders ── */}
                <SectionLabel>{'BORDERS'}</SectionLabel>
                <S.RowG6 style={{ justifyContent: 'center' }}>
                  {([1, 2, 4] as const).map(w => {
                    const custom = { borderWidth: w, borderColor: P.blue, borderRadius: 6 };
                    return (
                      <Box key={w} style={{ ...custom, padding: 10, justifyContent: 'center', alignItems: 'center' }} tooltip={styleTooltip(custom)}>
                        <S.StoryBreadcrumbActive>{`${w}px`}</S.StoryBreadcrumbActive>
                      </Box>
                    );
                  })}
                </S.RowG6>
                <S.RowG6 style={{ justifyContent: 'center' }}>
                  {([
                    ['borderTopWidth', P.red, 'T'],
                    ['borderRightWidth', P.blue, 'R'],
                    ['borderBottomWidth', P.green, 'B'],
                    ['borderLeftWidth', P.orange, 'L'],
                  ] as const).map(([side, color, label]) => {
                    const custom = { [side]: 3, borderColor: color };
                    return (
                      <Box key={side} style={{ ...custom, width: 52, height: 52, backgroundColor: c.bg, justifyContent: 'center', alignItems: 'center' }} tooltip={styleTooltip(custom)}>
                        <S.StoryCap>{label}</S.StoryCap>
                      </Box>
                    );
                  })}
                </S.RowG6>

                {/* ── Shadows ── */}
                <SectionLabel>{'SHADOW'}</SectionLabel>
                <Box style={{ flexDirection: 'row', gap: 10, justifyContent: 'center' }}>
                  {([
                    ['sm', { shadowColor: 'rgba(0,0,0,0.08)', shadowOffsetX: 0, shadowOffsetY: 1, shadowBlur: 2 }],
                    ['md', { shadowColor: 'rgba(0,0,0,0.12)', shadowOffsetX: 0, shadowOffsetY: 4, shadowBlur: 6 }],
                    ['lg', { shadowColor: 'rgba(0,0,0,0.12)', shadowOffsetX: 0, shadowOffsetY: 10, shadowBlur: 15 }],
                    ['xl', { shadowColor: 'rgba(0,0,0,0.12)', shadowOffsetX: 0, shadowOffsetY: 20, shadowBlur: 25 }],
                  ] as const).map(([name, shadow]) => {
                    const custom = { ...shadow, backgroundColor: c.surface, borderRadius: 8 };
                    return (
                      <Box key={name} style={{ ...custom, padding: 10, minWidth: 52, alignItems: 'center', justifyContent: 'center' }} tooltip={styleTooltip(custom)}>
                        <Text style={{ color: c.text, fontSize: 8 }}>{name}</Text>
                      </Box>
                    );
                  })}
                </Box>

                {/* ── Opacity ── */}
                <SectionLabel>{'OPACITY'}</SectionLabel>
                <S.RowG4>
                  {([1.0, 0.75, 0.5, 0.25, 0.1] as const).map(op => {
                    const custom = { backgroundColor: P.blue, opacity: op };
                    return (
                      <Box key={op} style={{ ...custom, flexGrow: 1, height: 36, borderRadius: 6, justifyContent: 'center', alignItems: 'center' }} tooltip={styleTooltip(custom)}>
                        <S.WhiteTiny>{`${op}`}</S.WhiteTiny>
                      </Box>
                    );
                  })}
                </S.RowG4>

                {/* ── Transforms ── */}
                <SectionLabel>{'TRANSFORM \u2014 ROTATE'}</SectionLabel>
                <Box style={{ flexDirection: 'row', gap: 14, justifyContent: 'center', paddingTop: 4, paddingBottom: 4 }}>
                  {([0, 15, 45, 90] as const).map(deg => {
                    const custom = { backgroundColor: P.blue, transform: { rotate: deg } };
                    return (
                      <Box key={deg} style={{ ...custom, width: 40, height: 40, borderRadius: 6, justifyContent: 'center', alignItems: 'center' }} tooltip={styleTooltip(custom)}>
                        <S.WhiteTiny>{`${deg}\u00b0`}</S.WhiteTiny>
                      </Box>
                    );
                  })}
                </Box>

                <SectionLabel>{'TRANSFORM \u2014 SCALE'}</SectionLabel>
                <Box style={{ flexDirection: 'row', gap: 14, justifyContent: 'center', paddingTop: 4, paddingBottom: 4 }}>
                  {([0.5, 0.75, 1.0, 1.25] as const).map(s => {
                    const custom = { backgroundColor: P.green, transform: { scaleX: s, scaleY: s } };
                    return (
                      <Box key={s} style={{ ...custom, width: 40, height: 40, borderRadius: 6, justifyContent: 'center', alignItems: 'center' }} tooltip={styleTooltip(custom)}>
                        <S.WhiteTiny>{`${s}x`}</S.WhiteTiny>
                      </Box>
                    );
                  })}
                </Box>

                <SectionLabel>{'TRANSFORM \u2014 TRANSLATE + COMBO'}</SectionLabel>
                <Box style={{ flexDirection: 'row', gap: 20, justifyContent: 'center', paddingTop: 8, paddingBottom: 8 }}>
                  {(() => {
                    const t1 = { backgroundColor: P.red, transform: { translateX: 8, translateY: -5 } };
                    const t2 = { backgroundColor: P.violet, transform: { rotate: 30, scaleX: 1.15, scaleY: 1.15, translateX: 4 } };
                    return (
                      <>
                        <Box style={{ ...t1, width: 40, height: 40, borderRadius: 6, justifyContent: 'center', alignItems: 'center' }} tooltip={styleTooltip(t1)}>
                          <Text style={{ color: '#fff', fontSize: 7 }}>{'8,-5'}</Text>
                        </Box>
                        <Box style={{ ...t2, width: 40, height: 40, borderRadius: 6, justifyContent: 'center', alignItems: 'center' }} tooltip={styleTooltip(t2)}>
                          <Text style={{ color: '#fff', fontSize: 7 }}>{'combo'}</Text>
                        </Box>
                      </>
                    );
                  })()}
                </Box>

                {/* ── Position + zIndex ── */}
                <SectionLabel>{'POSITION + ZINDEX'}</SectionLabel>
                <Box style={{ alignItems: 'center' }}>
                  <Box style={{ width: 200, height: 110, position: 'relative' }}>
                    <Box style={{
                      position: 'absolute', top: 0, left: 0, width: 70, height: 70,
                      borderRadius: 8, backgroundColor: P.red, zIndex: 1,
                      justifyContent: 'center', alignItems: 'center',
                    }} tooltip={{ content: 'position: absolute\ntop: 0 / left: 0\nzIndex: 1', layout: 'table', type: 'cursor' }}>
                      <S.WhiteCaption>{'z:1'}</S.WhiteCaption>
                    </Box>
                    <Box style={{
                      position: 'absolute', top: 18, left: 30, width: 70, height: 70,
                      borderRadius: 8, backgroundColor: P.blue, zIndex: 3,
                      justifyContent: 'center', alignItems: 'center',
                    }} tooltip={{ content: 'position: absolute\ntop: 18 / left: 30\nzIndex: 3', layout: 'table', type: 'cursor' }}>
                      <S.WhiteCaption>{'z:3'}</S.WhiteCaption>
                    </Box>
                    <Box style={{
                      position: 'absolute', top: 36, left: 60, width: 70, height: 70,
                      borderRadius: 8, backgroundColor: P.green, zIndex: 2,
                      justifyContent: 'center', alignItems: 'center',
                    }} tooltip={{ content: 'position: absolute\ntop: 36 / left: 60\nzIndex: 2', layout: 'table', type: 'cursor' }}>
                      <S.WhiteCaption>{'z:2'}</S.WhiteCaption>
                    </Box>
                  </Box>
                </Box>

                {/* ── Overflow ── */}
                <SectionLabel>{'OVERFLOW'}</SectionLabel>
                <Box style={{ flexDirection: 'row', gap: 40, justifyContent: 'center', paddingTop: 10, paddingBottom: 30 }}>
                  <S.CenterG4>
                    <Box style={{ width: 80, height: 56, overflow: 'hidden', borderWidth: 2, borderColor: P.blue, borderRadius: 6, backgroundColor: c.surface }}>
                      <Box style={{ width: 120, height: 80, backgroundColor: P.blue, opacity: 0.4, borderRadius: 4, justifyContent: 'center', alignItems: 'center' }}>
                        <Text style={{ color: '#fff', fontSize: 8 }}>{'clipped'}</Text>
                      </Box>
                    </Box>
                    <S.StoryTiny>{'hidden'}</S.StoryTiny>
                  </S.CenterG4>
                  <S.CenterG4>
                    <Box style={{ width: 80, height: 56, overflow: 'visible', borderWidth: 2, borderColor: P.orange, borderRadius: 6, backgroundColor: c.surface }}>
                      <Box style={{ width: 120, height: 80, backgroundColor: P.orange, opacity: 0.4, borderRadius: 4, justifyContent: 'center', alignItems: 'center' }}>
                        <Text style={{ color: '#fff', fontSize: 8 }}>{'paints out'}</Text>
                      </Box>
                    </Box>
                    <S.StoryTiny>{'visible'}</S.StoryTiny>
                  </S.CenterG4>
                </Box>

                {/* ── Recipes ── */}
                <SectionLabel>{'RECIPES'}</SectionLabel>

                {/* Card */}
                <S.Bordered style={{ width: '100%', backgroundColor: c.bgElevated, borderRadius: 10, padding: 14, gap: 6 }} tooltip={{ content: 'Card recipe\nbgElevated + borderRadius + borderWidth + padding', layout: 'table', type: 'cursor' }}>
                  <Text style={{ fontSize: 14, color: c.text }}>{'Card'}</Text>
                  <S.DimBody11>{'borderRadius + borderWidth + bgElevated + padding'}</S.DimBody11>
                </S.Bordered>

                {/* Badges */}
                <S.RowG8 style={{ flexWrap: 'wrap', justifyContent: 'center' }}>
                  {([
                    ['default', c.primary],
                    ['success', P.green],
                    ['warning', P.orange],
                    ['danger', P.red],
                    ['info', P.blue],
                  ] as const).map(([label, bg]) => (
                    <Box key={label} style={{
                      paddingLeft: 8, paddingRight: 8, paddingTop: 3, paddingBottom: 3,
                      borderRadius: 10, backgroundColor: bg,
                    }} tooltip={{ content: 'Badge: borderRadius:10 + backgroundColor', layout: 'table', type: 'cursor' }}>
                      <S.WhiteBody>{label}</S.WhiteBody>
                    </Box>
                  ))}
                </S.RowG8>

                {/* Divider */}
                <Box style={{ gap: 6 }}>
                  <S.DimBody11>{'Divider: height:1 + backgroundColor'}</S.DimBody11>
                  <S.HorzDivider style={{ width: '100%' }} />
                  <S.DimBody11>{'Just a styled Box \u2014 no special component needed.'}</S.DimBody11>
                </Box>

                {/* Composed notification */}
                <S.Bordered style={{ width: '100%', backgroundColor: c.bgElevated, borderRadius: 10, padding: 14, gap: 6 }}>
                  <Text style={{ fontSize: 14, color: c.text }}>{'Notification'}</Text>
                  <S.DimBody11>{'Card + Badge + Divider combined'}</S.DimBody11>
                  <S.RowG6>
                    <Box style={{ paddingLeft: 8, paddingRight: 8, paddingTop: 3, paddingBottom: 3, borderRadius: 10, backgroundColor: P.green }}>
                      <S.WhiteBody>{'new'}</S.WhiteBody>
                    </Box>
                    <Box style={{ paddingLeft: 8, paddingRight: 8, paddingTop: 3, paddingBottom: 3, borderRadius: 10, backgroundColor: P.red }}>
                      <S.WhiteBody>{'urgent'}</S.WhiteBody>
                    </Box>
                  </S.RowG6>
                  <S.HorzDivider style={{ width: '100%' }} />
                  <Box style={{ gap: 6 }}>
                    {(['Alert: system ready', 'Update available', 'Build passed'] as const).map((msg, i) => (
                      <S.RowCenterG8 key={i}>
                        <Box style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: c.primary }} />
                        <Text style={{ fontSize: 11, color: c.text }}>{msg}</Text>
                      </S.RowCenterG8>
                    ))}
                  </Box>
                </S.Bordered>

                {/* ═══════════════ Icons ═══════════════ */}
                <S.HorzDivider style={{ marginTop: 10 }} />
                <SectionLabel>{'ICONS'}</SectionLabel>

                {/* Search + size controls */}
                <S.RowCenterG6>
                  <Box style={{ flexGrow: 1 }}>
                    <TextInput
                      placeholder={`Search ${iconNames.length} icons\u2026`}
                      value={iconFilter}
                      onChangeText={(t: string) => { setIconFilter(t); setIconPage(0); }}
                      style={{
                        backgroundColor: c.bg,
                        color: c.text,
                        borderWidth: 1,
                        borderColor: c.border,
                        borderRadius: 6,
                        padding: 6,
                        fontSize: 11,
                      }}
                    />
                  </Box>
                  {ICON_SIZES.map(sz => (
                    <Pressable
                      key={sz}
                      onPress={() => setIconSize(sz)}
                      style={{
                        backgroundColor: sz === iconSize ? c.primary : c.surface,
                        borderRadius: 4,
                        paddingTop: 3,
                        paddingBottom: 3,
                        paddingLeft: 6,
                        paddingRight: 6,
                      }}
                    >
                      <Text style={{ color: sz === iconSize ? '#fff' : c.text, fontSize: 9 }}>
                        {`${sz}`}
                      </Text>
                    </Pressable>
                  ))}
                </S.RowCenterG6>

                <S.StoryCap>
                  {`${filteredIcons.length} of ${iconNames.length} icons`}
                </S.StoryCap>

                {/* Icon grid */}
                <S.RowCenter style={{ flexWrap: 'wrap', gap: 3, justifyContent: 'center' }}>
                  {pageIcons.map(name => {
                    const data = iconMap[name];
                    if (!data) return null;
                    const isSelected = selectedIcon === name;
                    return (
                      <Pressable
                        key={name}
                        onPress={() => setSelectedIcon(isSelected ? null : name)}
                        style={{
                          width: 52,
                          height: 52,
                          alignItems: 'center',
                          justifyContent: 'center',
                          backgroundColor: isSelected ? c.primary : c.surface,
                          borderRadius: 5,
                          borderWidth: isSelected ? 1 : 0,
                          borderColor: c.primary,
                        }}
                      >
                        <Icon icon={data} size={iconSize} color={isSelected ? '#fff' : c.text} />
                      </Pressable>
                    );
                  })}
                </S.RowCenter>

                {/* Pagination */}
                {iconTotalPages > 1 && (
                  <S.RowCenterG8 style={{ justifyContent: 'center' }}>
                    <Pressable
                      onPress={() => setIconPage(Math.max(0, iconPage - 1))}
                      style={{ paddingTop: 3, paddingBottom: 3, paddingLeft: 8, paddingRight: 8, backgroundColor: c.surface, borderRadius: 4 }}
                    >
                      <S.StoryBody>{'< Prev'}</S.StoryBody>
                    </Pressable>
                    <S.StoryMuted>
                      {`${iconPage + 1} / ${iconTotalPages}`}
                    </S.StoryMuted>
                    <Pressable
                      onPress={() => setIconPage(Math.min(iconTotalPages - 1, iconPage + 1))}
                      style={{ paddingTop: 3, paddingBottom: 3, paddingLeft: 8, paddingRight: 8, backgroundColor: c.surface, borderRadius: 4 }}
                    >
                      <S.StoryBody>{'Next >'}</S.StoryBody>
                    </Pressable>
                  </S.RowCenterG8>
                )}

                {/* Selected icon detail */}
                {selectedIcon && iconMap[selectedIcon] && (
                  <S.CenterW100 style={{ backgroundColor: c.bgElevated, borderRadius: 8, borderWidth: 1, borderColor: c.border, padding: 12, gap: 8 }}>
                    <Icon icon={iconMap[selectedIcon]} size={48} color={c.text} />
                    <S.BoldText style={{ fontSize: 12 }}>{selectedIcon}</S.BoldText>
                    <Box style={{
                      width: '100%',
                      backgroundColor: c.bg,
                      borderRadius: 6,
                      padding: 8,
                    }}>
                      <S.StoryCap style={{ fontFamily: 'monospace' }}>
                        {`import { ${selectedIcon} } from '@reactjit/icons';\n<Icon icon={${selectedIcon}} size={24} color="#fff" />`}
                      </S.StoryCap>
                    </Box>
                    {/* Size variants */}
                    // rjit-ignore-next-line
                    <S.RowG12 style={{ alignItems: 'flex-end' }}>
                      {ICON_SIZES.map(sz => (
                        <Box key={sz} style={{ alignItems: 'center', gap: 3 }}>
                          <Icon icon={iconMap[selectedIcon]} size={sz} color={c.text} />
                          <S.StoryTiny>{`${sz}`}</S.StoryTiny>
                        </Box>
                      ))}
                    </S.RowG12>
                  </S.CenterW100>
                )}

                {/* Icon usage examples */}
                <SectionLabel>{'ICON USAGE'}</SectionLabel>

                {/* Inline with text */}
                <S.RowCenterG8>
                  <Icon icon={iconMap.Home} size={16} color={c.text} />
                  <Text style={{ color: c.text, fontSize: 12 }}>{'Home'}</Text>
                  <S.VertDivider style={{ height: 14 }} />
                  <Icon icon={iconMap.Settings} size={16} color={c.text} />
                  <Text style={{ color: c.text, fontSize: 12 }}>{'Settings'}</Text>
                  <S.VertDivider style={{ height: 14 }} />
                  <Icon icon={iconMap.Search} size={16} color={c.text} />
                  <Text style={{ color: c.text, fontSize: 12 }}>{'Search'}</Text>
                </S.RowCenterG8>

                {/* Colored icons */}
                <Box style={{ flexDirection: 'row', gap: 10 }}>
                  <Icon icon={iconMap.Heart} size={24} color={P.red} />
                  <Icon icon={iconMap.Star} size={24} color={P.yellow} />
                  <Icon icon={iconMap.Zap} size={24} color={P.blue} />
                  <Icon icon={iconMap.Leaf} size={24} color={P.green} />
                  <Icon icon={iconMap.Flame} size={24} color={P.orange} />
                  <Icon icon={iconMap.Sparkles} size={24} color={P.violet} />
                </Box>

                {/* Button-like usage */}
                <S.RowG6>
                  <Pressable onPress={() => {}} style={{
                    flexDirection: 'row', gap: 5, alignItems: 'center',
                    backgroundColor: c.primary, borderRadius: 6,
                    paddingTop: 6, paddingBottom: 6, paddingLeft: 10, paddingRight: 10,
                  }}>
                    <Icon icon={iconMap.Plus} size={12} color="#fff" />
                    <S.WhiteBody>{'New'}</S.WhiteBody>
                  </Pressable>
                  <Pressable onPress={() => {}} style={{
                    flexDirection: 'row', gap: 5, alignItems: 'center',
                    backgroundColor: c.surface, borderRadius: 6, borderWidth: 1, borderColor: c.border,
                    paddingTop: 6, paddingBottom: 6, paddingLeft: 10, paddingRight: 10,
                  }}>
                    <Icon icon={iconMap.Download} size={12} color={c.text} />
                    <S.StoryBody>{'Download'}</S.StoryBody>
                  </Pressable>
                  <Pressable onPress={() => {}} style={{
                    flexDirection: 'row', gap: 5, alignItems: 'center',
                    backgroundColor: P.red, borderRadius: 6,
                    paddingTop: 6, paddingBottom: 6, paddingLeft: 10, paddingRight: 10,
                  }}>
                    <Icon icon={iconMap.Trash2} size={12} color="#fff" />
                    <S.WhiteBody>{'Delete'}</S.WhiteBody>
                  </Pressable>
                </S.RowG6>

                {/* ═══════════════ Theme ═══════════════ */}
                <S.HorzDivider style={{ marginTop: 10 }} />
                <SectionLabel>{'THEME'}</SectionLabel>

                {/* Active theme + switcher */}
                <S.RowCenter style={{ gap: 10 }}>
                  <Box style={{ gap: 2, flexGrow: 1 }}>
                    <S.StoryCap>{'Active theme'}</S.StoryCap>
                    <Text style={{ color: c.primary, fontSize: 12, fontWeight: 'bold' }}>{themeId}</Text>
                  </Box>
                  <ThemeSwitcher />
                </S.RowCenter>

                {/* Semantic tokens */}
                <SectionLabel>{'SEMANTIC TOKENS'}</SectionLabel>
                <S.RowWrap style={{ gap: 5 }}>
                  <ColorSwatch color={c.bg} label="bg" />
                  <ColorSwatch color={c.bgAlt} label="bgAlt" />
                  <ColorSwatch color={c.bgElevated} label="bgElevated" />
                  <ColorSwatch color={c.text} label="text" />
                  <ColorSwatch color={c.textSecondary} label="textSecondary" />
                  <ColorSwatch color={c.textDim} label="textDim" />
                  <ColorSwatch color={c.primary} label="primary" />
                  <ColorSwatch color={c.accent} label="accent" />
                  <ColorSwatch color={c.surface} label="surface" />
                  <ColorSwatch color={c.border} label="border" />
                  <ColorSwatch color={c.error} label="error" />
                  <ColorSwatch color={c.warning} label="warning" />
                  <ColorSwatch color={c.success} label="success" />
                  <ColorSwatch color={c.info} label="info" />
                </S.RowWrap>

                {/* Theme gallery */}
                <SectionLabel>{'THEME GALLERY'}</SectionLabel>
                <S.StoryCap>
                  {`${themeNames.length} themes. Click to switch.`}
                </S.StoryCap>
                <S.RowG6 style={{ flexWrap: 'wrap' }}>
                  {themeNames.map(id => (
                    <ThemeCard
                      key={id}
                      id={id}
                      isActive={id === themeId}
                      onPress={() => setTheme(id)}
                    />
                  ))}
                </S.RowG6>

              </Box>
            </ScrollView>

            <VerticalDivider />

            {/* ══════════════ RIGHT: API Reference ══════════════ */}
            <ScrollView style={{ flexGrow: 1, flexBasis: 0, justifyContent: 'center', alignItems: 'center' }}>
              <S.StackG10W100 style={{ padding: 14 }}>

                {/* ── Overview ── */}
                <SectionLabel>{'OVERVIEW'}</SectionLabel>
                <S.StoryBody>
                  {'Style properties control the visual appearance of nodes beyond layout. Gradients add color depth. Borders define edges. Shadows lift elements. Transform rotates, scales, and translates without affecting flow. Icons provide vector glyphs at any size. The theme system delivers semantic color tokens that adapt across palettes.'}
                </S.StoryBody>

                <HorizontalDivider />

                {/* ── Style Usage ── */}
                <SectionLabel>{'STYLE USAGE'}</SectionLabel>
                <CodeBlock language="tsx" fontSize={9} code={STYLE_USAGE_CODE} />

                <HorizontalDivider />

                {/* ── Style Behavior ── */}
                <SectionLabel>{'STYLE BEHAVIOR'}</SectionLabel>
                <Box style={{ gap: 4, width: '100%' }}>
                  {STYLE_BEHAVIOR_NOTES.map((note, i) => (
                    <S.RowG6 key={i} style={{ alignItems: 'flex-start', width: '100%' }}>
                      <Image src="chevron-right" style={{ width: 8, height: 8, flexShrink: 0, marginTop: 2 }} tintColor={c.muted} />
                      <S.StoryBody style={{ flexGrow: 1, flexShrink: 1, flexBasis: 0 }}>{note}</S.StoryBody>
                    </S.RowG6>
                  ))}
                </Box>

                <HorizontalDivider />

                {/* ── Style Props ── */}
                <SectionLabel>{'STYLE PROPS'}</SectionLabel>
                <Box style={{ gap: 3 }}>
                  {STYLE_PROPS.map(([prop, type, icon]) => (
                    <S.RowCenterG5 key={prop}>
                      <S.StorySectionIcon src={icon} tintColor={SYN.prop} />
                      <Text style={{ color: SYN.prop, fontSize: 9, fontWeight: 'bold' }}>{prop}</Text>
                      <S.StoryCap>{type}</S.StoryCap>
                    </S.RowCenterG5>
                  ))}
                </Box>

                <HorizontalDivider />

                {/* ── Icon API ── */}
                <SectionLabel>{'ICON API'}</SectionLabel>
                <S.StoryBody>
                  {'The Icon component renders vector path data as geometry. Import named icons from @reactjit/icons \u2014 each export is a number[][] of path segments. Pass it to <Icon> with a size and color.'}
                </S.StoryBody>
                <CodeBlock language="tsx" fontSize={9} code={ICON_USAGE_CODE} />

                <SectionLabel>{'ICON PROPS'}</SectionLabel>
                <Box style={{ gap: 3 }}>
                  {ICON_PROPS.map(([prop, desc]) => (
                    <S.RowCenterG5 key={prop}>
                      <Text style={{ color: SYN.prop, fontSize: 9, fontWeight: 'bold' }}>{prop}</Text>
                      <S.StoryCap>{desc}</S.StoryCap>
                    </S.RowCenterG5>
                  ))}
                </Box>

                <HorizontalDivider />

                {/* ── Theme API ── */}
                <SectionLabel>{'THEME API'}</SectionLabel>
                <S.StoryBody>
                  {'The theme system provides semantic color tokens that adapt to any palette. useThemeColors() returns the active token set. useTheme() gives programmatic switching. ThemeSwitcher is a drop-in picker widget.'}
                </S.StoryBody>
                <CodeBlock language="tsx" fontSize={9} code={THEME_USAGE_CODE} />

                <SectionLabel>{'THEME TOKENS'}</SectionLabel>
                <Box style={{ gap: 3 }}>
                  {THEME_TOKENS.map(([token, desc]) => (
                    <S.RowCenterG5 key={token}>
                      <Text style={{ color: SYN.prop, fontSize: 9, fontWeight: 'bold' }}>{token}</Text>
                      <S.StoryCap>{desc}</S.StoryCap>
                    </S.RowCenterG5>
                  ))}
                </Box>

              </S.StackG10W100>
            </ScrollView>
          </>
        )}
      </S.RowGrow>

      {/* ── Footer ── */}
      <S.RowCenterBorder style={{ flexShrink: 0, backgroundColor: c.bgElevated, borderTopWidth: 1, paddingLeft: 20, paddingRight: 20, paddingTop: 6, paddingBottom: 6, gap: 12 }}>
        <S.DimIcon12 src="folder" />
        <S.StoryCap>{'Core'}</S.StoryCap>
        <S.StoryCap>{'/'}</S.StoryCap>
        <S.TextIcon12 src="palette" />
        <S.StoryBreadcrumbActive>{'Style'}</S.StoryBreadcrumbActive>

        <Box style={{ flexGrow: 1 }} />

        <Pressable
          onPress={() => setPlayground(p => !p)}
          style={(state) => ({
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
            backgroundColor: playground ? c.primary : (state.hovered ? c.surface : c.border),
            paddingLeft: 10,
            paddingRight: 10,
            paddingTop: 3,
            paddingBottom: 3,
            borderRadius: 4,
          })}
        >
          <S.StorySectionIcon src={playground ? 'book-open' : 'play'} tintColor={playground ? 'white' : c.text} />
          <Text style={{
            color: playground ? 'white' : c.text,
            fontSize: 9,
            fontWeight: 'bold',
          }}>
            {playground ? 'Exit Playground' : 'Playground'}
          </Text>
        </Pressable>

        <S.StoryCap>{'v0.1.0'}</S.StoryCap>
      </S.RowCenterBorder>

    </S.StoryRoot>
  );
}
