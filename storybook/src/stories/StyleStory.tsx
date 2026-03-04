/**
 * StyleStory — Layout1 documentation for visual style properties.
 *
 * Gradients, borders, shadows, opacity, transforms, position, overflow,
 * and spring transitions — everything that makes a Box look like more
 * than a rectangle.
 */

import React, { useState, useCallback, useEffect } from 'react';
import { Box, Text, Image, TextEditor, CodeBlock, Pressable, ScrollView } from '../../../packages/core/src';
import { useThemeColors } from '../../../packages/theme/src';
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
  rose: '#f43f5e',
};

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

// ── Static data (hoisted — never recreated) ──────────────

const USAGE_CODE = `import { Box, Text } from '@reactjit/core';

// Bare — a Box with no visual style
<Box />

// Gradient background
<Box style={{
  backgroundGradient: { direction: 'horizontal', colors: ['#3b82f6', '#8b5cf6'] },
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
  <Text style={{ color: '#3b82f6' }}>{'Bordered + shadow'}</Text>
</Box>

// Transform (rotate + scale combined)
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
  transition: { width: { duration: 600, easing: 'spring' } },
}} />`;

const STARTER_CODE = `<Box style={{
  backgroundGradient: {
    direction: 'horizontal',
    colors: ['#3b82f6', '#8b5cf6'],
  },
  borderRadius: 12,
  padding: 20,
  shadowColor: 'rgba(0,0,0,0.2)',
  shadowOffsetY: 8,
  shadowBlur: 20,
}}>
  <Text style={{ color: 'white', fontSize: 16, fontWeight: 'bold' }}>
    Visual styles
  </Text>
  <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12 }}>
    Edit to experiment.
  </Text>
</Box>`;

// Props — [name, type, icon]
const PROPS: [string, string, string][] = [
  ['backgroundGradient', '{ direction, colors[] }', 'sunrise'],
  ['borderWidth / borderColor', 'number / Color', 'square'],
  ['borderTopWidth … borderLeftWidth', 'number', 'minus'],
  ['borderRadius', 'number', 'circle'],
  ['opacity', 'number (0–1)', 'eye'],
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

const BEHAVIOR_NOTES = [
  'backgroundGradient overrides backgroundColor. Use direction: "horizontal", "vertical", or "diagonal" with a colors array.',
  'Per-side borders (borderTopWidth etc.) require borderColor to also be set. borderWidth sets all four sides at once.',
  'transform is applied as a single object: { rotate, scaleX, scaleY, translateX, translateY }. All fields are optional.',
  'transition animates style changes using spring physics. Specify the property key and { duration, easing } — supported easings: "spring", "ease-in", "ease-out", "ease-in-out", "linear".',
  'overflow: "hidden" clips children to the box bounds. overflow: "visible" lets children paint outside (default).',
  'position: "absolute" removes the element from flex flow. Use top/right/bottom/left for placement. zIndex controls stacking order.',
];

// ── Component ────────────────────────────────────────────

export function StyleStory() {
  const c = useThemeColors();
  const [playground, setPlayground] = useState(false);
  const [code, setCode] = useState(STARTER_CODE);
  const [UserComponent, setUserComponent] = useState<React.ComponentType | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [expanded, setExpanded] = useState(false);
  const [toggled, setToggled] = useState(false);

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
          {'Visual properties beyond layout.'}
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
            {/* ── Left: Preview ── */}
            <ScrollView style={{ flexGrow: 1, flexBasis: 0, justifyContent: 'center', alignItems: 'center' }}>
              <Box style={{ width: '100%', padding: 20, gap: 14 }}>

                {/* Gradients */}
                <Text style={{ color: c.muted, fontSize: 8, fontWeight: 'bold' }}>{'GRADIENTS'}</Text>
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

                {/* Borders */}
                <Text style={{ color: c.muted, fontSize: 8, fontWeight: 'bold' }}>{'BORDERS'}</Text>
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

                {/* Shadows */}
                <Text style={{ color: c.muted, fontSize: 8, fontWeight: 'bold' }}>{'SHADOW'}</Text>
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

                {/* Opacity */}
                <Text style={{ color: c.muted, fontSize: 8, fontWeight: 'bold' }}>{'OPACITY'}</Text>
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

                {/* Transforms */}
                <Text style={{ color: c.muted, fontSize: 8, fontWeight: 'bold' }}>{'TRANSFORM — ROTATE'}</Text>
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

                <Text style={{ color: c.muted, fontSize: 8, fontWeight: 'bold' }}>{'TRANSFORM — SCALE'}</Text>
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

                <Text style={{ color: c.muted, fontSize: 8, fontWeight: 'bold' }}>{'TRANSFORM — TRANSLATE + COMBO'}</Text>
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

                {/* Position + zIndex */}
                <Text style={{ color: c.muted, fontSize: 8, fontWeight: 'bold' }}>{'POSITION + ZINDEX'}</Text>
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

                {/* Overflow */}
                <Text style={{ color: c.muted, fontSize: 8, fontWeight: 'bold' }}>{'OVERFLOW'}</Text>
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

                {/* Spring Transitions */}
                <Text style={{ color: c.muted, fontSize: 8, fontWeight: 'bold' }}>{'TRANSITION — WIDTH (SPRING)'}</Text>
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

                <Text style={{ color: c.muted, fontSize: 8, fontWeight: 'bold' }}>{'TRANSITION — TRANSFORM (SPRING)'}</Text>
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

              </Box>
            </ScrollView>

            <VerticalDivider />

            {/* ── Right: API Reference ── */}
            <ScrollView style={{ flexGrow: 1, flexBasis: 0, justifyContent: 'center', alignItems: 'center' }}>
              <Box style={{ width: '100%', padding: 14, gap: 10 }}>

                {/* Overview */}
                <Text style={{ color: c.muted, fontSize: 8, fontWeight: 'bold' }}>
                  {'OVERVIEW'}
                </Text>
                <Text style={{ color: c.text, fontSize: 10 }}>
                  {'Style properties control the visual appearance of Box nodes beyond layout. Gradients and backgrounds add color depth. Borders define edges and corners. Shadows lift elements off the surface. Transform rotates, scales, and translates elements without affecting layout flow. The transition property animates any style change using spring or easing curves.'}
                </Text>

                <HorizontalDivider />

                {/* Usage */}
                <Text style={{ color: c.muted, fontSize: 8, fontWeight: 'bold' }}>
                  {'USAGE'}
                </Text>
                <CodeBlock language="tsx" fontSize={9} code={USAGE_CODE} />

                <HorizontalDivider />

                {/* Behavior */}
                <Text style={{ color: c.muted, fontSize: 8, fontWeight: 'bold' }}>
                  {'BEHAVIOR'}
                </Text>
                <Box style={{ gap: 4 }}>
                  {BEHAVIOR_NOTES.map((note, i) => (
                    <Box key={i} style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
                      <Image src="chevron-right" style={{ width: 8, height: 8 }} tintColor={c.muted} />
                      <Text style={{ color: c.text, fontSize: 10 }}>{note}</Text>
                    </Box>
                  ))}
                </Box>

                <HorizontalDivider />

                {/* Props */}
                <Text style={{ color: c.muted, fontSize: 8, fontWeight: 'bold' }}>
                  {'PROPS'}
                </Text>
                <Box style={{ gap: 3 }}>
                  {PROPS.map(([prop, type, icon]) => (
                    <Box key={prop} style={{ flexDirection: 'row', gap: 5, alignItems: 'center' }}>
                      <Image src={icon} style={{ width: 10, height: 10 }} tintColor={SYN.prop} />
                      <Text style={{ color: SYN.prop, fontSize: 9, fontWeight: 'bold' }}>{prop}</Text>
                      <Text style={{ color: c.muted, fontSize: 9 }}>{type}</Text>
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
