/**
 * LayoutStory — Flex layout, spacing, and sizing documentation.
 *
 * How things sit next to each other. Containment, alignment, proportional
 * sizing, and the flex algorithm in action.
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
  component: '#89b4fa',
  prop: '#cba6f7',
  value: '#f9e2af',
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
  const content = entries.map(([k, v]) => `${k}: ${v}`).join('\n');
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

function Chip({ label, color, size = 36 }: { label: string; color: string; size?: number }) {
  return (
    <Box style={{
      width: size, height: size, backgroundColor: color,
      borderRadius: 6, justifyContent: 'center', alignItems: 'center',
    }}>
      <Text style={{ color: '#fff', fontSize: 9, textAlign: 'center' }}>{label}</Text>
    </Box>
  );
}

function Bar({ label, width, color }: { label: string; width: number; color: string }) {
  return (
    <Box style={{
      width, height: 26, backgroundColor: color,
      borderRadius: 5, justifyContent: 'center', alignItems: 'center',
    }}>
      <Text style={{ color: '#fff', fontSize: 10, textAlign: 'center' }}>{label}</Text>
    </Box>
  );
}

// ── Static data (hoisted — never recreated) ──────────────

const USAGE_CODE = `import { Box, Text } from '@reactjit/core';

// Auto-size to children
<Box style={{ gap: 8 }}>
  <Text>{'Header'}</Text>
  <Text>{'Body'}</Text>
</Box>

// Flex row — distribute space
<Box style={{ flexDirection: 'row', gap: 8 }}>
  <Text>{'Left'}</Text>
  <Box style={{ flexGrow: 1 }} />
  <Text>{'Right'}</Text>
</Box>

// Padding + alignment
<Box style={{
  padding: 16,
  alignItems: 'center',
  justifyContent: 'center'
}}>
  <Text>{'Centered'}</Text>
</Box>`;

const STARTER_CODE = `<Box style={{
  gap: 12,
  padding: 16,
  backgroundColor: '#f3f4f6',
  borderRadius: 8,
}}>
  <Text>{'Container with children'}</Text>
  <Text style={{ fontSize: 12, color: '#666' }}>
    {'Edit to see live layout changes.'}
  </Text>
</Box>`;

// Props — [name, type]
const PROPS: [string, string][] = [
  ['padding / px / py', 'number'],
  ['gap', 'number'],
  ['flexDirection', "'row' | 'column'"],
  ['justifyContent', "'start' | 'center' | 'end' | 'space-between' | 'space-around'"],
  ['alignItems', "'start' | 'center' | 'end'"],
  ['width / height', 'number | string'],
  ['flexGrow', 'number'],
  ['flexShrink', 'number'],
  ['aspectRatio', 'number'],
  ['flexWrap', "'wrap' | 'nowrap'"],
];

const BEHAVIOR_NOTES = [
  'Containers auto-size to fit their children by default.',
  'Use flexGrow: 1 to make an element absorb remaining space in its flex container.',
  'justifyContent controls distribution along the main axis (horizontal in row, vertical in column).',
  'alignItems controls positioning along the cross axis.',
  'Empty surfaces (no children, no explicit size) get 1/4 of parent size as fallback.',
  'flexShrink: 0 prevents an element from shrinking when space is constrained.',
];

// Palette (hoisted)
const P = {
  red: '#ef4444', orange: '#f97316', amber: '#eab308',
  green: '#22c55e', teal: '#14b8a6', cyan: '#06b6d4',
  blue: '#3b82f6', indigo: '#6366f1', violet: '#8b5cf6',
};

// ── Component ────────────────────────────────────────────

export function LayoutStory() {
  const c = useThemeColors();
  const [playground, setPlayground] = useState(false);
  const [code, setCode] = useState(STARTER_CODE);
  const [UserComponent, setUserComponent] = useState<React.ComponentType | null>(null);
  const [errors, setErrors] = useState<string[]>([]);

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
        <Image src="box" style={{ width: 20, height: 20 }} tintColor={c.primary} />

        <Text style={{ color: c.text, fontSize: 20, fontWeight: 'bold' }}>
          {'Layout'}
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
          <Text style={{ color: SYN.tag, fontSize: 10 }}>{'{'}</Text>
          <Text style={{ color: SYN.prop, fontSize: 10 }}>{'flexDirection'}</Text>
          <Text style={{ color: SYN.tag, fontSize: 10 }}>{': '}</Text>
          <Text style={{ color: SYN.value, fontSize: 10 }}>{'row'}</Text>
          <Text style={{ color: SYN.tag, fontSize: 10 }}>{' }'}</Text>
        </Box>

        <Box style={{ flexGrow: 1 }} />

        <Text style={{ color: c.muted, fontSize: 10 }}>
          {'Flex layout, spacing, sizing. How things sit next to each other.'}
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
              <Box style={{ width: '100%', padding: 20, gap: 16 }}>

                {/* SPACING */}
                <Text style={{ color: c.muted, fontSize: 8, fontWeight: 'bold' }}>{'SPACING'}</Text>
                <Box style={{ gap: 8, width: '100%' }}>
                  <Box style={{ backgroundColor: c.surface, borderRadius: 6, padding: 16, width: '100%', alignItems: 'center' }}>
                    <Box bg={P.blue} style={{ height: 28, width: '100%', justifyContent: 'center', alignItems: 'center', borderRadius: 5 }} tooltip={styleTooltip({ backgroundColor: P.blue, borderRadius: 5 })}>
                      <Text style={{ color: '#fff', fontSize: 9, textAlign: 'center' }}>{'padding: 16'}</Text>
                    </Box>
                  </Box>
                  <Box style={{ flexDirection: 'row', gap: 8, width: '100%', justifyContent: 'center' }}>
                    {(['A', 'B', 'C'] as const).map(label => <Chip key={label} label={label} color={P.orange} size={32} />)}
                  </Box>
                </Box>

                {/* FLEX DIRECTION */}
                <Text style={{ color: c.muted, fontSize: 8, fontWeight: 'bold' }}>{'FLEX DIRECTION'}</Text>
                <Box style={{ gap: 6, width: '100%' }}>
                  <Box style={{ backgroundColor: c.surface, borderRadius: 6, padding: 6, width: '100%' }}>
                    <Box style={{ flexDirection: 'row', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
                      <Chip label="A" color={P.red} size={28} />
                      <Chip label="B" color={P.orange} size={28} />
                      <Chip label="C" color={P.amber} size={28} />
                    </Box>
                    <Text style={{ color: c.muted, fontSize: 7, marginTop: 4 }}>{'row'}</Text>
                  </Box>
                  <Box style={{ backgroundColor: c.surface, borderRadius: 6, padding: 6, width: '100%', alignItems: 'center' }}>
                    <Box style={{ flexDirection: 'column', gap: 4, width: '100%', alignItems: 'center' }}>
                      <Chip label="A" color={P.green} size={28} />
                      <Chip label="B" color={P.teal} size={28} />
                      <Chip label="C" color={P.cyan} size={28} />
                    </Box>
                    <Text style={{ color: c.muted, fontSize: 7, marginTop: 4 }}>{'column'}</Text>
                  </Box>
                </Box>

                {/* JUSTIFY CONTENT */}
                <Text style={{ color: c.muted, fontSize: 8, fontWeight: 'bold' }}>{'JUSTIFY CONTENT'}</Text>
                <Box style={{ gap: 4, width: '100%' }}>
                  {(['start', 'center', 'space-between'] as const).map(justify => (
                    <Box key={justify} style={{
                      backgroundColor: c.surface, borderRadius: 6, padding: 6, width: '100%',
                      flexDirection: 'row', justifyContent: justify,
                    }}>
                      <Chip label="A" color={P.blue} size={24} />
                      <Chip label="B" color={P.indigo} size={24} />
                      <Text style={{ color: c.muted, fontSize: 7 }}>{justify}</Text>
                    </Box>
                  ))}
                </Box>

                {/* ALIGN ITEMS */}
                <Text style={{ color: c.muted, fontSize: 8, fontWeight: 'bold' }}>{'ALIGN ITEMS'}</Text>
                <Box style={{ flexDirection: 'row', gap: 4, width: '100%', justifyContent: 'center' }}>
                  {(['start', 'center', 'end'] as const).map(align => (
                    <Box key={align} style={{
                      flexGrow: 1, height: 60, backgroundColor: c.surface,
                      borderRadius: 6, padding: 4, gap: 2, alignItems: align,
                    }}>
                      <Bar label="Short" width={36} color={P.violet} />
                      <Bar label="Long" width={52} color={P.blue} />
                      <Text style={{ color: c.muted, fontSize: 6, marginTop: 2 }}>{align}</Text>
                    </Box>
                  ))}
                </Box>

                {/* SIZING */}
                <Text style={{ color: c.muted, fontSize: 8, fontWeight: 'bold' }}>{'SIZING'}</Text>
                <Box style={{ gap: 6, width: '100%' }}>
                  <Box style={{ width: '100%', alignItems: 'center' }}>
                    <Box style={{ width: 140, height: 50, backgroundColor: P.blue, borderRadius: 6, justifyContent: 'center', alignItems: 'center' }} tooltip={styleTooltip({ width: 140, height: 50, backgroundColor: P.blue, borderRadius: 6 })}>
                      <Text style={{ color: '#fff', fontSize: 8 }}>{'fixed: 140x50'}</Text>
                    </Box>
                  </Box>
                  <Box style={{ width: '100%', flexDirection: 'row', gap: 4, height: 40, justifyContent: 'center' }}>
                    <Box style={{ width: 50, height: 40, backgroundColor: P.red, borderRadius: 4, justifyContent: 'center', alignItems: 'center' }}>
                      <Text style={{ color: '#fff', fontSize: 8 }}>{'50'}</Text>
                    </Box>
                    <Box style={{ flexGrow: 1, backgroundColor: P.green, borderRadius: 4, justifyContent: 'center', alignItems: 'center' }} tooltip={styleTooltip({ flexGrow: 1, backgroundColor: P.green, borderRadius: 4 })}>
                      <Text style={{ color: '#fff', fontSize: 8 }}>{'grow'}</Text>
                    </Box>
                    <Box style={{ width: 50, height: 40, backgroundColor: P.orange, borderRadius: 4, justifyContent: 'center', alignItems: 'center' }}>
                      <Text style={{ color: '#fff', fontSize: 8 }}>{'50'}</Text>
                    </Box>
                  </Box>
                </Box>

                {/* FLEX WRAP */}
                <Text style={{ color: c.muted, fontSize: 8, fontWeight: 'bold' }}>{'FLEX WRAP'}</Text>
                <Box style={{
                  flexDirection: 'row', flexWrap: 'wrap', gap: 4,
                  backgroundColor: c.surface, borderRadius: 6, padding: 6, width: '100%',
                  justifyContent: 'center',
                }}>
                  {[P.red, P.orange, P.amber, P.green, P.teal, P.cyan, P.blue, P.indigo].map((color, i) => (
                    <Chip key={i} label={`${i + 1}`} color={color} size={28} />
                  ))}
                </Box>

                {/* FLEX SHRINK */}
                <Text style={{ color: c.muted, fontSize: 8, fontWeight: 'bold' }}>{'FLEX SHRINK'}</Text>
                <Box style={{ gap: 4, width: '100%' }}>
                  <Box style={{ width: 200, flexDirection: 'row', gap: 2, backgroundColor: c.surface, borderRadius: 6, padding: 4, justifyContent: 'center' }}>
                    <Box style={{ width: 80, height: 24, backgroundColor: P.blue, borderRadius: 4, justifyContent: 'center', alignItems: 'center' }}>
                      <Text style={{ color: '#fff', fontSize: 7 }}>{'Default'}</Text>
                    </Box>
                    <Box style={{ width: 80, height: 24, backgroundColor: P.indigo, borderRadius: 4, justifyContent: 'center', alignItems: 'center' }}>
                      <Text style={{ color: '#fff', fontSize: 7 }}>{'Shrinks'}</Text>
                    </Box>
                    <Box style={{ width: 80, height: 24, backgroundColor: P.violet, borderRadius: 4, justifyContent: 'center', alignItems: 'center' }}>
                      <Text style={{ color: '#fff', fontSize: 7 }}>{'Shrinks'}</Text>
                    </Box>
                  </Box>
                  <Text style={{ color: c.muted, fontSize: 7 }}>{'Items shrink equally'}</Text>
                </Box>

                {/* ASPECT RATIO */}
                <Text style={{ color: c.muted, fontSize: 8, fontWeight: 'bold' }}>{'ASPECT RATIO'}</Text>
                <Box style={{ flexDirection: 'row', gap: 6, width: '100%', justifyContent: 'center' }}>
                  <Box style={{ width: 50, aspectRatio: 1, backgroundColor: P.violet, borderRadius: 6, justifyContent: 'center', alignItems: 'center' }} tooltip={styleTooltip({ width: 50, aspectRatio: 1, backgroundColor: P.violet, borderRadius: 6 })}>
                    <Text style={{ color: '#fff', fontSize: 7 }}>{'1:1'}</Text>
                  </Box>
                  <Box style={{ width: 80, aspectRatio: 16 / 9, backgroundColor: P.blue, borderRadius: 6, justifyContent: 'center', alignItems: 'center' }} tooltip={styleTooltip({ width: 80, aspectRatio: 16 / 9, backgroundColor: P.blue, borderRadius: 6 })}>
                    <Text style={{ color: '#fff', fontSize: 7 }}>{'16:9'}</Text>
                  </Box>
                  <Box style={{ height: 30, aspectRatio: 2, backgroundColor: P.green, borderRadius: 6, justifyContent: 'center', alignItems: 'center' }} tooltip={styleTooltip({ height: 30, aspectRatio: 2, backgroundColor: P.green, borderRadius: 6 })}>
                    <Text style={{ color: '#fff', fontSize: 7 }}>{'2:1'}</Text>
                  </Box>
                </Box>

              </Box>
            </ScrollView>

            <VerticalDivider />

            {/* ── Right: Documentation ── */}
            <ScrollView style={{ flexGrow: 1, flexBasis: 0 }}>
              <Box style={{ padding: 20, gap: 16 }}>

                {/* OVERVIEW */}
                <Box>
                  <Text style={{ color: c.text, fontSize: 12, fontWeight: 'bold', marginBottom: 6 }}>{'OVERVIEW'}</Text>
                  <Text style={{ color: c.muted, fontSize: 10 }}>
                    {'Layout in ReactJIT uses Flex. Containers auto-size to their children by default. Use flexGrow to distribute space, gap for spacing between children, and justifyContent/alignItems to position them. The engine is pixel-perfect — if something looks wrong, check the component\'s explicit dimensions, not the layout math.'}
                  </Text>
                </Box>

                <HorizontalDivider />

                {/* USAGE */}
                <Box>
                  <Text style={{ color: c.text, fontSize: 12, fontWeight: 'bold', marginBottom: 6 }}>{'USAGE'}</Text>
                  <CodeBlock language="tsx" fontSize={9} code={USAGE_CODE} />
                </Box>

                <HorizontalDivider />

                {/* BEHAVIOR */}
                <Box>
                  <Text style={{ color: c.text, fontSize: 12, fontWeight: 'bold', marginBottom: 6 }}>{'BEHAVIOR'}</Text>
                  <Box style={{ gap: 6 }}>
                    {BEHAVIOR_NOTES.map((note, i) => (
                      <Text key={i} style={{ color: c.muted, fontSize: 10 }}>
                        {`• ${note}`}
                      </Text>
                    ))}
                  </Box>
                </Box>

                <HorizontalDivider />

                {/* PROPS */}
                <Box>
                  <Text style={{ color: c.text, fontSize: 12, fontWeight: 'bold', marginBottom: 8 }}>{'LAYOUT PROPERTIES'}</Text>
                  <Box style={{ gap: 6 }}>
                    {PROPS.map(([name, type], i) => (
                      <Box key={i} style={{ flexDirection: 'row', gap: 8 }}>
                        <Text style={{ color: c.primary, fontSize: 10, fontFamily: 'monospace', flexBasis: 180, flexShrink: 0 }}>
                          {name}
                        </Text>
                        <Text style={{ color: c.muted, fontSize: 10, fontFamily: 'monospace' }}>
                          {type}
                        </Text>
                      </Box>
                    ))}
                  </Box>
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
        paddingTop: 8,
        paddingBottom: 8,
        gap: 8,
      }}>
        <Text style={{ color: c.muted, fontSize: 9 }}>
          {'Layout / Flex'}
        </Text>
        <Box style={{ flexGrow: 1 }} />
        <Pressable
          style={{
            paddingLeft: 12,
            paddingRight: 12,
            paddingTop: 4,
            paddingBottom: 4,
            backgroundColor: playground ? c.primary : c.surface,
            borderRadius: 4,
            justifyContent: 'center',
          }}
          onClick={() => setPlayground(!playground)}
        >
          <Text style={{ color: playground ? '#fff' : c.text, fontSize: 9 }}>
            {playground ? 'Back' : 'Playground'}
          </Text>
        </Pressable>
      </Box>

    </Box>
  );
}
