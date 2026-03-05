/**
 * StyleStory — Layout1 documentation for all visual concerns:
 * style properties, icons, and theming.
 *
 * Left: interactive visual demos (gradients, borders, shadows, transforms,
 *       icons, theme swatches & gallery).
 * Right: API reference for style props, Icon component, and theme hooks.
 * Playground: editable JSX with live preview.
 */

import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { Box, Text, Image, TextEditor, CodeBlock, Pressable, ScrollView, TextInput } from '../../../packages/core/src';
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
  return <Box style={{ height: 1, flexShrink: 0, backgroundColor: c.border }} />;
}

function VerticalDivider() {
  const c = useThemeColors();
  return <Box style={{ width: 1, flexShrink: 0, alignSelf: 'stretch', backgroundColor: c.border }} />;
}

function SectionLabel({ children }: { children: string }) {
  const c = useThemeColors();
  return <Text style={{ color: c.muted, fontSize: 8, fontWeight: 'bold' }}>{children}</Text>;
}

function ColorSwatch({ color, label }: { color: string; label: string }) {
  const c = useThemeColors();
  return (
    <Box style={{
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingLeft: 8,
      paddingRight: 8,
      paddingTop: 5,
      paddingBottom: 5,
      borderRadius: 6,
      borderWidth: 1,
      borderColor: c.border,
      backgroundColor: c.surface,
    }}>
      <Box style={{
        width: 14,
        height: 14,
        backgroundColor: color,
        borderRadius: 3,
        borderWidth: 1,
        borderColor: c.border,
      }} />
      <Text style={{ color: c.muted, fontSize: 9 }}>{label}</Text>
    </Box>
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
      <Box style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
        <Text style={{ color: tc.text, fontSize: 8, flexGrow: 1 }}>
          {theme.displayName}
        </Text>
        <Box style={{
          paddingLeft: 4, paddingRight: 4, paddingTop: 1, paddingBottom: 1,
          backgroundColor: tc.primary, borderRadius: 2,
        }}>
          <Text style={{ color: tc.bg, fontSize: 6 }}>{'A'}</Text>
        </Box>
      </Box>
      <Box style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 1 }}>
        {swatches.map((color, i) => (
          <Box key={i} style={{
            width: 8, height: 8,
            backgroundColor: color,
            borderRadius: 1,
          }} />
        ))}
      </Box>
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
}} />

// Spring transition on width
<Box style={{
  width: active ? 200 : 80,
  backgroundColor: '#06b6d4',
  borderRadius: 8,
  height: 40,
  transition: {
    width: { duration: 600, easing: 'spring' },
  },
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
  ['transition', '{ [prop]: { duration, easing } }', 'activity'],
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
  'transition animates style changes using spring physics. Specify the property key and { duration, easing } \u2014 supported easings: "spring", "ease-in", "ease-out", "ease-in-out", "linear".',
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
  const [expanded, setExpanded] = useState(false);
  const [toggled, setToggled] = useState(false);

  // Icon browser
  const [iconFilter, setIconFilter] = useState('');
  const [iconSize, setIconSize] = useState(24);
  const [selectedIcon, setSelectedIcon] = useState<string | null>(null);
  const [iconPage, setIconPage] = useState(0);

  const filteredIcons = useMemo(() => {
    if (!iconFilter) return iconNames;
    const lower = iconFilter.toLowerCase();
    return iconNames.filter(n => n.toLowerCase().includes(lower));
  }, [iconFilter]);

  const iconTotalPages = Math.ceil(filteredIcons.length / ICONS_PER_PAGE);
  const pageIcons = filteredIcons.slice(iconPage * ICONS_PER_PAGE, (iconPage + 1) * ICONS_PER_PAGE);

  // Playground helpers
  const processCode = useCallback((src: string) => {
    const result = transformJSX(src);
    if (result.errors.length > 0) {
      setErrors(result.errors.map(e => `Line ${e.line}:${e.col}: ${e.message}`));
      return;
    }
    const evalResult = evalComponent(result.code);
    if (evalResult.error) { setErrors([evalResult.error]); return; }
    setErrors([]);
    setUserComponent(() => evalResult.component);
  }, []);

  useEffect(() => {
    if (playground && code && !UserComponent) {
      processCode(code);
    }
  }, [playground]);

  const handleCodeChange = useCallback((src: string) => {
    setCode(src);
    processCode(src);
  }, [processCode]);

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
        <Image src="palette" style={{ width: 20, height: 20 }} tintColor={c.primary} />

        <Text style={{ color: c.text, fontSize: 20, fontWeight: 'bold' }}>
          {'Style'}
        </Text>

        <Box style={{
          flexDirection: 'row',
          backgroundColor: c.surface,
          borderWidth: 1,
          borderColor: c.border,
          borderRadius: 4,
          paddingLeft: 8,
          paddingRight: 8,
          paddingTop: 3,
          paddingBottom: 3,
        }}>
          <Text style={{ color: SYN.tag, fontSize: 10 }}>{'style'}</Text>
          <Text style={{ color: c.muted, fontSize: 10 }}>{`={{ `}</Text>
          <Text style={{ color: SYN.prop, fontSize: 10 }}>{'opacity'}</Text>
          <Text style={{ color: c.muted, fontSize: 10 }}>{': '}</Text>
          <Text style={{ color: SYN.value, fontSize: 10 }}>{'0.8'}</Text>
          <Text style={{ color: c.muted, fontSize: 10 }}>{' }}'}</Text>
        </Box>

        <Box style={{ flexGrow: 1 }} />

        <Text style={{ color: c.muted, fontSize: 10 }}>
          {'Making rectangles feel feelings'}
        </Text>
      </Box>

      {/* ── Center ── */}
      <Box style={{ flexGrow: 1, flexDirection: 'row' }}>
        {playground ? (
          <>
            <Box style={{ flexGrow: 1, flexBasis: 0 }}>
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
            </Box>
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
                        <Text style={{ color: '#fff', fontSize: 9 }}>{dir}</Text>
                      </Box>
                    );
                  })}
                </Box>

                {/* ── Borders ── */}
                <SectionLabel>{'BORDERS'}</SectionLabel>
                <Box style={{ flexDirection: 'row', gap: 6, justifyContent: 'center' }}>
                  {([1, 2, 4] as const).map(w => {
                    const custom = { borderWidth: w, borderColor: P.blue, borderRadius: 6 };
                    return (
                      <Box key={w} style={{ ...custom, padding: 10, justifyContent: 'center', alignItems: 'center' }} tooltip={styleTooltip(custom)}>
                        <Text style={{ color: c.text, fontSize: 9 }}>{`${w}px`}</Text>
                      </Box>
                    );
                  })}
                </Box>
                <Box style={{ flexDirection: 'row', gap: 6, justifyContent: 'center' }}>
                  {([
                    ['borderTopWidth', P.red, 'T'],
                    ['borderRightWidth', P.blue, 'R'],
                    ['borderBottomWidth', P.green, 'B'],
                    ['borderLeftWidth', P.orange, 'L'],
                  ] as const).map(([side, color, label]) => {
                    const custom = { [side]: 3, borderColor: color };
                    return (
                      <Box key={side} style={{ ...custom, width: 52, height: 52, backgroundColor: c.bg, justifyContent: 'center', alignItems: 'center' }} tooltip={styleTooltip(custom)}>
                        <Text style={{ color: c.muted, fontSize: 9 }}>{label}</Text>
                      </Box>
                    );
                  })}
                </Box>

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
                <Box style={{ flexDirection: 'row', gap: 4 }}>
                  {([1.0, 0.75, 0.5, 0.25, 0.1] as const).map(op => {
                    const custom = { backgroundColor: P.blue, opacity: op };
                    return (
                      <Box key={op} style={{ ...custom, flexGrow: 1, height: 36, borderRadius: 6, justifyContent: 'center', alignItems: 'center' }} tooltip={styleTooltip(custom)}>
                        <Text style={{ color: '#fff', fontSize: 8 }}>{`${op}`}</Text>
                      </Box>
                    );
                  })}
                </Box>

                {/* ── Transforms ── */}
                <SectionLabel>{'TRANSFORM \u2014 ROTATE'}</SectionLabel>
                <Box style={{ flexDirection: 'row', gap: 14, justifyContent: 'center', paddingTop: 4, paddingBottom: 4 }}>
                  {([0, 15, 45, 90] as const).map(deg => {
                    const custom = { backgroundColor: P.blue, transform: { rotate: deg } };
                    return (
                      <Box key={deg} style={{ ...custom, width: 40, height: 40, borderRadius: 6, justifyContent: 'center', alignItems: 'center' }} tooltip={styleTooltip(custom)}>
                        <Text style={{ color: '#fff', fontSize: 8 }}>{`${deg}\u00b0`}</Text>
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
                        <Text style={{ color: '#fff', fontSize: 8 }}>{`${s}x`}</Text>
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
                      <Text style={{ color: '#fff', fontSize: 9 }}>{'z:1'}</Text>
                    </Box>
                    <Box style={{
                      position: 'absolute', top: 18, left: 30, width: 70, height: 70,
                      borderRadius: 8, backgroundColor: P.blue, zIndex: 3,
                      justifyContent: 'center', alignItems: 'center',
                    }} tooltip={{ content: 'position: absolute\ntop: 18 / left: 30\nzIndex: 3', layout: 'table', type: 'cursor' }}>
                      <Text style={{ color: '#fff', fontSize: 9 }}>{'z:3'}</Text>
                    </Box>
                    <Box style={{
                      position: 'absolute', top: 36, left: 60, width: 70, height: 70,
                      borderRadius: 8, backgroundColor: P.green, zIndex: 2,
                      justifyContent: 'center', alignItems: 'center',
                    }} tooltip={{ content: 'position: absolute\ntop: 36 / left: 60\nzIndex: 2', layout: 'table', type: 'cursor' }}>
                      <Text style={{ color: '#fff', fontSize: 9 }}>{'z:2'}</Text>
                    </Box>
                  </Box>
                </Box>

                {/* ── Overflow ── */}
                <SectionLabel>{'OVERFLOW'}</SectionLabel>
                <Box style={{ flexDirection: 'row', gap: 40, justifyContent: 'center', paddingTop: 10, paddingBottom: 30 }}>
                  <Box style={{ alignItems: 'center', gap: 4 }}>
                    <Box style={{ width: 80, height: 56, overflow: 'hidden', borderWidth: 2, borderColor: P.blue, borderRadius: 6, backgroundColor: c.surface }}>
                      <Box style={{ width: 120, height: 80, backgroundColor: P.blue, opacity: 0.4, borderRadius: 4, justifyContent: 'center', alignItems: 'center' }}>
                        <Text style={{ color: '#fff', fontSize: 8 }}>{'clipped'}</Text>
                      </Box>
                    </Box>
                    <Text style={{ color: c.muted, fontSize: 8 }}>{'hidden'}</Text>
                  </Box>
                  <Box style={{ alignItems: 'center', gap: 4 }}>
                    <Box style={{ width: 80, height: 56, overflow: 'visible', borderWidth: 2, borderColor: P.orange, borderRadius: 6, backgroundColor: c.surface }}>
                      <Box style={{ width: 120, height: 80, backgroundColor: P.orange, opacity: 0.4, borderRadius: 4, justifyContent: 'center', alignItems: 'center' }}>
                        <Text style={{ color: '#fff', fontSize: 8 }}>{'paints out'}</Text>
                      </Box>
                    </Box>
                    <Text style={{ color: c.muted, fontSize: 8 }}>{'visible'}</Text>
                  </Box>
                </Box>

                {/* ── Spring Transitions ── */}
                <SectionLabel>{'TRANSITION \u2014 WIDTH (SPRING)'}</SectionLabel>
                <Box style={{ alignItems: 'center', gap: 8 }}>
                  <Pressable onPress={() => setExpanded(v => !v)} style={{
                    backgroundColor: c.primary, paddingLeft: 12, paddingRight: 12,
                    paddingTop: 6, paddingBottom: 6, borderRadius: 6, alignItems: 'center',
                  }}>
                    <Text style={{ color: '#fff', fontSize: 10 }}>{expanded ? 'Collapse' : 'Expand'}</Text>
                  </Pressable>
                  <Box style={{
                    width: expanded ? '100%' : 80,
                    height: 36,
                    backgroundColor: c.primary,
                    borderRadius: 6,
                    justifyContent: 'center',
                    alignItems: 'center',
                    overflow: 'hidden',
                    transition: { width: { duration: 600, easing: 'spring' } },
                  }}>
                    <Text style={{ color: '#fff', fontSize: 9 }}>{expanded ? 'expanded' : '80px'}</Text>
                  </Box>
                </Box>

                <SectionLabel>{'TRANSITION \u2014 TRANSFORM (SPRING)'}</SectionLabel>
                <Box style={{ alignItems: 'center', gap: 8 }}>
                  <Pressable onPress={() => setToggled(v => !v)} style={{
                    backgroundColor: c.primary, paddingLeft: 12, paddingRight: 12,
                    paddingTop: 6, paddingBottom: 6, borderRadius: 6, alignItems: 'center',
                  }}>
                    <Text style={{ color: '#fff', fontSize: 10 }}>{'Toggle'}</Text>
                  </Pressable>
                  <Box style={{ width: '100%', height: 80, position: 'relative' }}>
                    <Box style={{
                      position: 'absolute',
                      top: 10,
                      left: 0,
                      width: 60,
                      height: 60,
                      backgroundColor: P.red,
                      borderRadius: 30,
                      transform: {
                        translateX: toggled ? 160 : 0,
                        scaleX: toggled ? 1.2 : 1,
                        scaleY: toggled ? 1.2 : 1,
                      },
                      justifyContent: 'center',
                      alignItems: 'center',
                      transition: { transform: { duration: 600, easing: 'spring' } },
                    }}>
                      <Text style={{ color: '#fff', fontSize: 9 }}>{toggled ? '160' : '0'}</Text>
                    </Box>
                  </Box>
                </Box>

                {/* ── Recipes ── */}
                <SectionLabel>{'RECIPES'}</SectionLabel>

                {/* Card */}
                <Box style={{
                  width: '100%',
                  backgroundColor: c.bgElevated,
                  borderRadius: 10,
                  borderWidth: 1,
                  borderColor: c.border,
                  padding: 14,
                  gap: 6,
                }} tooltip={{ content: 'Card recipe\nbgElevated + borderRadius + borderWidth + padding', layout: 'table', type: 'cursor' }}>
                  <Text style={{ fontSize: 14, color: c.text }}>{'Card'}</Text>
                  <Text style={{ fontSize: 11, color: c.muted }}>{'borderRadius + borderWidth + bgElevated + padding'}</Text>
                </Box>

                {/* Badges */}
                <Box style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
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
                      <Text style={{ fontSize: 10, color: '#fff' }}>{label}</Text>
                    </Box>
                  ))}
                </Box>

                {/* Divider */}
                <Box style={{ gap: 6 }}>
                  <Text style={{ fontSize: 11, color: c.muted }}>{'Divider: height:1 + backgroundColor'}</Text>
                  <Box style={{ width: '100%', height: 1, backgroundColor: c.border }} />
                  <Text style={{ fontSize: 11, color: c.muted }}>{'Just a styled Box \u2014 no special component needed.'}</Text>
                </Box>

                {/* Composed notification */}
                <Box style={{
                  width: '100%',
                  backgroundColor: c.bgElevated,
                  borderRadius: 10,
                  borderWidth: 1,
                  borderColor: c.border,
                  padding: 14,
                  gap: 6,
                }}>
                  <Text style={{ fontSize: 14, color: c.text }}>{'Notification'}</Text>
                  <Text style={{ fontSize: 11, color: c.muted }}>{'Card + Badge + Divider combined'}</Text>
                  <Box style={{ flexDirection: 'row', gap: 6 }}>
                    <Box style={{ paddingLeft: 8, paddingRight: 8, paddingTop: 3, paddingBottom: 3, borderRadius: 10, backgroundColor: P.green }}>
                      <Text style={{ fontSize: 10, color: '#fff' }}>{'new'}</Text>
                    </Box>
                    <Box style={{ paddingLeft: 8, paddingRight: 8, paddingTop: 3, paddingBottom: 3, borderRadius: 10, backgroundColor: P.red }}>
                      <Text style={{ fontSize: 10, color: '#fff' }}>{'urgent'}</Text>
                    </Box>
                  </Box>
                  <Box style={{ width: '100%', height: 1, backgroundColor: c.border }} />
                  <Box style={{ gap: 6 }}>
                    {(['Alert: system ready', 'Update available', 'Build passed'] as const).map((msg, i) => (
                      <Box key={i} style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                        <Box style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: c.primary }} />
                        <Text style={{ fontSize: 11, color: c.text }}>{msg}</Text>
                      </Box>
                    ))}
                  </Box>
                </Box>

                {/* ═══════════════ Icons ═══════════════ */}
                <Box style={{ height: 1, backgroundColor: c.border, marginTop: 10 }} />
                <SectionLabel>{'ICONS'}</SectionLabel>

                {/* Search + size controls */}
                <Box style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
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
                </Box>

                <Text style={{ color: c.muted, fontSize: 9 }}>
                  {`${filteredIcons.length} of ${iconNames.length} icons`}
                </Text>

                {/* Icon grid */}
                <Box style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 3, justifyContent: 'center', alignItems: 'center' }}>
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
                </Box>

                {/* Pagination */}
                {iconTotalPages > 1 && (
                  <Box style={{ flexDirection: 'row', justifyContent: 'center', gap: 8, alignItems: 'center' }}>
                    <Pressable
                      onPress={() => setIconPage(Math.max(0, iconPage - 1))}
                      style={{ paddingTop: 3, paddingBottom: 3, paddingLeft: 8, paddingRight: 8, backgroundColor: c.surface, borderRadius: 4 }}
                    >
                      <Text style={{ color: c.text, fontSize: 10 }}>{'< Prev'}</Text>
                    </Pressable>
                    <Text style={{ color: c.muted, fontSize: 10 }}>
                      {`${iconPage + 1} / ${iconTotalPages}`}
                    </Text>
                    <Pressable
                      onPress={() => setIconPage(Math.min(iconTotalPages - 1, iconPage + 1))}
                      style={{ paddingTop: 3, paddingBottom: 3, paddingLeft: 8, paddingRight: 8, backgroundColor: c.surface, borderRadius: 4 }}
                    >
                      <Text style={{ color: c.text, fontSize: 10 }}>{'Next >'}</Text>
                    </Pressable>
                  </Box>
                )}

                {/* Selected icon detail */}
                {selectedIcon && iconMap[selectedIcon] && (
                  <Box style={{
                    width: '100%',
                    backgroundColor: c.bgElevated,
                    borderRadius: 8,
                    borderWidth: 1,
                    borderColor: c.border,
                    padding: 12,
                    gap: 8,
                    alignItems: 'center',
                  }}>
                    <Icon icon={iconMap[selectedIcon]} size={48} color={c.text} />
                    <Text style={{ color: c.text, fontSize: 12, fontWeight: 'bold' }}>{selectedIcon}</Text>
                    <Box style={{
                      width: '100%',
                      backgroundColor: c.bg,
                      borderRadius: 6,
                      padding: 8,
                    }}>
                      <Text style={{ color: c.muted, fontSize: 9, fontFamily: 'monospace' }}>
                        {`import { ${selectedIcon} } from '@reactjit/icons';\n<Icon icon={${selectedIcon}} size={24} color="#fff" />`}
                      </Text>
                    </Box>
                    {/* Size variants */}
                    // rjit-ignore-next-line
                    <Box style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-end' }}>
                      {ICON_SIZES.map(sz => (
                        <Box key={sz} style={{ alignItems: 'center', gap: 3 }}>
                          <Icon icon={iconMap[selectedIcon]} size={sz} color={c.text} />
                          <Text style={{ color: c.muted, fontSize: 8 }}>{`${sz}`}</Text>
                        </Box>
                      ))}
                    </Box>
                  </Box>
                )}

                {/* Icon usage examples */}
                <SectionLabel>{'ICON USAGE'}</SectionLabel>

                {/* Inline with text */}
                <Box style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                  <Icon icon={iconMap.Home} size={16} color={c.text} />
                  <Text style={{ color: c.text, fontSize: 12 }}>{'Home'}</Text>
                  <Box style={{ width: 1, height: 14, backgroundColor: c.border }} />
                  <Icon icon={iconMap.Settings} size={16} color={c.text} />
                  <Text style={{ color: c.text, fontSize: 12 }}>{'Settings'}</Text>
                  <Box style={{ width: 1, height: 14, backgroundColor: c.border }} />
                  <Icon icon={iconMap.Search} size={16} color={c.text} />
                  <Text style={{ color: c.text, fontSize: 12 }}>{'Search'}</Text>
                </Box>

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
                <Box style={{ flexDirection: 'row', gap: 6 }}>
                  <Pressable onPress={() => {}} style={{
                    flexDirection: 'row', gap: 5, alignItems: 'center',
                    backgroundColor: c.primary, borderRadius: 6,
                    paddingTop: 6, paddingBottom: 6, paddingLeft: 10, paddingRight: 10,
                  }}>
                    <Icon icon={iconMap.Plus} size={12} color="#fff" />
                    <Text style={{ color: '#fff', fontSize: 10 }}>{'New'}</Text>
                  </Pressable>
                  <Pressable onPress={() => {}} style={{
                    flexDirection: 'row', gap: 5, alignItems: 'center',
                    backgroundColor: c.surface, borderRadius: 6, borderWidth: 1, borderColor: c.border,
                    paddingTop: 6, paddingBottom: 6, paddingLeft: 10, paddingRight: 10,
                  }}>
                    <Icon icon={iconMap.Download} size={12} color={c.text} />
                    <Text style={{ color: c.text, fontSize: 10 }}>{'Download'}</Text>
                  </Pressable>
                  <Pressable onPress={() => {}} style={{
                    flexDirection: 'row', gap: 5, alignItems: 'center',
                    backgroundColor: P.red, borderRadius: 6,
                    paddingTop: 6, paddingBottom: 6, paddingLeft: 10, paddingRight: 10,
                  }}>
                    <Icon icon={iconMap.Trash2} size={12} color="#fff" />
                    <Text style={{ color: '#fff', fontSize: 10 }}>{'Delete'}</Text>
                  </Pressable>
                </Box>

                {/* ═══════════════ Theme ═══════════════ */}
                <Box style={{ height: 1, backgroundColor: c.border, marginTop: 10 }} />
                <SectionLabel>{'THEME'}</SectionLabel>

                {/* Active theme + switcher */}
                <Box style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
                  <Box style={{ gap: 2, flexGrow: 1 }}>
                    <Text style={{ color: c.muted, fontSize: 9 }}>{'Active theme'}</Text>
                    <Text style={{ color: c.primary, fontSize: 12, fontWeight: 'bold' }}>{themeId}</Text>
                  </Box>
                  <ThemeSwitcher />
                </Box>

                {/* Semantic tokens */}
                <SectionLabel>{'SEMANTIC TOKENS'}</SectionLabel>
                <Box style={{ flexDirection: 'row', gap: 5, flexWrap: 'wrap' }}>
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
                </Box>

                {/* Theme gallery */}
                <SectionLabel>{'THEME GALLERY'}</SectionLabel>
                <Text style={{ color: c.muted, fontSize: 9 }}>
                  {`${themeNames.length} themes. Click to switch.`}
                </Text>
                <Box style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
                  {themeNames.map(id => (
                    <ThemeCard
                      key={id}
                      id={id}
                      isActive={id === themeId}
                      onPress={() => setTheme(id)}
                    />
                  ))}
                </Box>

              </Box>
            </ScrollView>

            <VerticalDivider />

            {/* ══════════════ RIGHT: API Reference ══════════════ */}
            <ScrollView style={{ flexGrow: 1, flexBasis: 0, justifyContent: 'center', alignItems: 'center' }}>
              <Box style={{ width: '100%', padding: 14, gap: 10 }}>

                {/* ── Overview ── */}
                <SectionLabel>{'OVERVIEW'}</SectionLabel>
                <Text style={{ color: c.text, fontSize: 10 }}>
                  {'Style properties control the visual appearance of nodes beyond layout. Gradients add color depth. Borders define edges. Shadows lift elements. Transform rotates, scales, and translates without affecting flow. Transitions animate changes with spring or easing curves. Icons provide vector glyphs at any size. The theme system delivers semantic color tokens that adapt across palettes.'}
                </Text>

                <HorizontalDivider />

                {/* ── Style Usage ── */}
                <SectionLabel>{'STYLE USAGE'}</SectionLabel>
                <CodeBlock language="tsx" fontSize={9} code={STYLE_USAGE_CODE} />

                <HorizontalDivider />

                {/* ── Style Behavior ── */}
                <SectionLabel>{'STYLE BEHAVIOR'}</SectionLabel>
                <Box style={{ gap: 4 }}>
                  {STYLE_BEHAVIOR_NOTES.map((note, i) => (
                    <Box key={i} style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
                      <Image src="chevron-right" style={{ width: 8, height: 8 }} tintColor={c.muted} />
                      <Text style={{ color: c.text, fontSize: 10 }}>{note}</Text>
                    </Box>
                  ))}
                </Box>

                <HorizontalDivider />

                {/* ── Style Props ── */}
                <SectionLabel>{'STYLE PROPS'}</SectionLabel>
                <Box style={{ gap: 3 }}>
                  {STYLE_PROPS.map(([prop, type, icon]) => (
                    <Box key={prop} style={{ flexDirection: 'row', gap: 5, alignItems: 'center' }}>
                      <Image src={icon} style={{ width: 10, height: 10 }} tintColor={SYN.prop} />
                      <Text style={{ color: SYN.prop, fontSize: 9, fontWeight: 'bold' }}>{prop}</Text>
                      <Text style={{ color: c.muted, fontSize: 9 }}>{type}</Text>
                    </Box>
                  ))}
                </Box>

                <HorizontalDivider />

                {/* ── Icon API ── */}
                <SectionLabel>{'ICON API'}</SectionLabel>
                <Text style={{ color: c.text, fontSize: 10 }}>
                  {'The Icon component renders vector path data as geometry. Import named icons from @reactjit/icons \u2014 each export is a number[][] of path segments. Pass it to <Icon> with a size and color.'}
                </Text>
                <CodeBlock language="tsx" fontSize={9} code={ICON_USAGE_CODE} />

                <SectionLabel>{'ICON PROPS'}</SectionLabel>
                <Box style={{ gap: 3 }}>
                  {ICON_PROPS.map(([prop, desc]) => (
                    <Box key={prop} style={{ flexDirection: 'row', gap: 5, alignItems: 'center' }}>
                      <Text style={{ color: SYN.prop, fontSize: 9, fontWeight: 'bold' }}>{prop}</Text>
                      <Text style={{ color: c.muted, fontSize: 9 }}>{desc}</Text>
                    </Box>
                  ))}
                </Box>

                <HorizontalDivider />

                {/* ── Theme API ── */}
                <SectionLabel>{'THEME API'}</SectionLabel>
                <Text style={{ color: c.text, fontSize: 10 }}>
                  {'The theme system provides semantic color tokens that adapt to any palette. useThemeColors() returns the active token set. useTheme() gives programmatic switching. ThemeSwitcher is a drop-in picker widget.'}
                </Text>
                <CodeBlock language="tsx" fontSize={9} code={THEME_USAGE_CODE} />

                <SectionLabel>{'THEME TOKENS'}</SectionLabel>
                <Box style={{ gap: 3 }}>
                  {THEME_TOKENS.map(([token, desc]) => (
                    <Box key={token} style={{ flexDirection: 'row', gap: 5, alignItems: 'center' }}>
                      <Text style={{ color: SYN.prop, fontSize: 9, fontWeight: 'bold' }}>{token}</Text>
                      <Text style={{ color: c.muted, fontSize: 9 }}>{desc}</Text>
                    </Box>
                  ))}
                </Box>

              </Box>
            </ScrollView>
          </>
        )}
      </Box>

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
        <Text style={{ color: c.muted, fontSize: 9 }}>{'Core'}</Text>
        <Text style={{ color: c.muted, fontSize: 9 }}>{'/'}</Text>
        <Image src="palette" style={{ width: 12, height: 12 }} tintColor={c.text} />
        <Text style={{ color: c.text, fontSize: 9 }}>{'Style'}</Text>

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
          <Image
            src={playground ? 'book-open' : 'play'}
            style={{ width: 10, height: 10 }}
            tintColor={playground ? 'white' : c.text}
          />
          <Text style={{
            color: playground ? 'white' : c.text,
            fontSize: 9,
            fontWeight: 'bold',
          }}>
            {playground ? 'Exit Playground' : 'Playground'}
          </Text>
        </Pressable>

        <Text style={{ color: c.muted, fontSize: 9 }}>{'v0.1.0'}</Text>
      </Box>

    </Box>
  );
}
