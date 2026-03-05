/**
 * BoxStory — Layout1 documentation for Box.
 *
 * Box is the root layout primitive. All layout, spacing, color,
 * borders, and event handling flow through it.
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

// ── Static data (hoisted — never recreated) ──────────────

const USAGE_CODE = `import { Box, Text } from '@reactjit/core';

// Bare — a layout surface with no style
<Box />

// With children — auto-sizes to content
<Box>
  <Text>{'Hello'}</Text>
</Box>

// With style — background, padding, radius
<Box style={{ backgroundColor: '#3b82f6', padding: 16, borderRadius: 8 }}>
  <Text style={{ color: 'white' }}>{'Styled box'}</Text>
</Box>

// Flex row — horizontal layout with gap
<Box style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
  <Box style={{ width: 32, height: 32, backgroundColor: '#89b4fa', borderRadius: 4 }} />
  <Box style={{ flexGrow: 1 }}>
    <Text>{'Title'}</Text>
    <Text>{'Subtitle'}</Text>
  </Box>
</Box>`;

const STARTER_CODE = `<Box style={{
  backgroundColor: '#3b82f6',
  borderRadius: 8,
  padding: 16,
  gap: 8,
}}>
  <Text style={{ color: 'white', fontSize: 16, fontWeight: 'bold' }}>
    Hello from Box
  </Text>
  <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12 }}>
    The root layout primitive. Edit to see live changes.
  </Text>
</Box>`;

// Props — [name, type, icon]
const PROPS: [string, string, string][] = [
  ['style', 'Style', 'layout'],
  ['bg', 'Color', 'palette'],
  ['radius', 'number', 'circle'],
  ['padding / px / py', 'number | string', 'move'],
  ['gap', 'number | string', 'minimize-2'],
  ['direction', "'row' | 'col'", 'arrow-right'],
  ['fill / grow', 'boolean', 'maximize-2'],
  ['tooltip', 'string | TooltipConfig', 'message-circle'],
  ['hoverStyle / activeStyle', 'Style', 'eye'],
  ['children', 'ReactNode', 'layers'],
];

// Callbacks — [name, signature, icon]
const CALLBACKS: [string, string, string][] = [
  ['onClick', '(e: LoveEvent) => void', 'mouse-pointer'],
  ['onRelease', '(e: LoveEvent) => void', 'mouse-pointer'],
  ['onPointerEnter', '(e: LoveEvent) => void', 'log-in'],
  ['onPointerLeave', '(e: LoveEvent) => void', 'log-out'],
  ['onKeyDown', '(e: LoveEvent) => void', 'terminal'],
  ['onWheel', '(e: LoveEvent) => void', 'chevrons-up-down'],
  ['onFileDrop', '(e: LoveEvent) => void', 'upload'],
  ['onDragStart / onDrag / onDragEnd', '(e: LoveEvent) => void', 'move'],
  ['onFocus / onBlur', '(e: LoveEvent) => void', 'radio'],
  ['onLayout', '(e: LayoutEvent) => void', 'ruler'],
];

const BEHAVIOR_NOTES = [
  'Auto-sizes to content by default. Add flexGrow:1 to fill remaining space, or set explicit width/height for fixed dims.',
  'Shorthand props (bg, radius, gap, direction, fill, grow) map to style={}. Explicit style={} wins on conflict.',
  'hoverStyle and activeStyle apply automatically — no event handlers needed for hover/press visual state.',
  'Empty surfaces with no children and no explicit size fall back to 1/4 of their parent\'s available space.',
];

// Palette (hoisted)
const P = {
  blue: '#3b82f6', violet: '#8b5cf6', cyan: '#06b6d4',
};

// ── Component ────────────────────────────────────────────

export function BoxStory() {
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
          {'Box'}
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
          <Text style={{ color: SYN.tag, fontSize: 10 }}>{'<'}</Text>
          <Text style={{ color: SYN.component, fontSize: 10 }}>{'Box'}</Text>
          <Text style={{ color: c.muted, fontSize: 10 }}>{' '}</Text>
          <Text style={{ color: SYN.tag, fontSize: 10 }}>{'/>'}</Text>
        </Box>

        <Box style={{ flexGrow: 1 }} />

        <Text style={{ color: c.muted, fontSize: 10 }}>
          {'Root layout primitive. Flex container, event target, and visual surface.'}
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

                {/* Containment — wireframe nesting */}
                <Text style={{ color: c.muted, fontSize: 8, fontWeight: 'bold' }}>{'CONTAINMENT'}</Text>
                <Box style={{ alignItems: 'center' }}>
                  <Box
                    tooltip={{ content: 'Outer\n260x140', type: 'cursor', layout: 'descriptive' }}
                    style={{ width: 260, height: 140, borderWidth: 1, borderColor: c.border, justifyContent: 'center', alignItems: 'center' }}
                  >
                    <Box
                      tooltip={{ content: 'Middle\n180x90', type: 'cursor', layout: 'descriptive' }}
                      style={{ width: 180, height: 90, borderWidth: 1, borderColor: c.border, justifyContent: 'center', alignItems: 'center' }}
                    >
                      <Box
                        tooltip={{ content: 'Inner\n100x45', type: 'cursor', layout: 'descriptive' }}
                        style={{ width: 100, height: 45, borderWidth: 1, borderColor: c.border, justifyContent: 'center', alignItems: 'center' }}
                      >
                        <Text style={{ color: c.muted, fontSize: 8 }}>{'children'}</Text>
                      </Box>
                    </Box>
                  </Box>
                </Box>

                {/* Styled nesting */}
                <Text style={{ color: c.muted, fontSize: 8, fontWeight: 'bold' }}>{'STYLED'}</Text>
                {(() => {
                  const outer = { backgroundColor: c.surface, borderRadius: 14, padding: 16 };
                  const mid = { backgroundColor: P.blue, borderRadius: 10, padding: 12 };
                  const inner = { backgroundColor: P.violet, borderRadius: 8, padding: 10 };
                  return (
                    <Box style={{ alignItems: 'center' }}>
                      <Box style={{ ...outer, width: 260, justifyContent: 'center', alignItems: 'center' }} tooltip={styleTooltip(outer)}>
                        <Box style={{ ...mid, width: 200, justifyContent: 'center', alignItems: 'center' }} tooltip={styleTooltip(mid)}>
                          <Box style={{ ...inner, width: 140, justifyContent: 'center', alignItems: 'center' }} tooltip={styleTooltip(inner)}>
                            <Text style={{ color: '#fff', fontSize: 10 }}>{'Nested'}</Text>
                          </Box>
                        </Box>
                      </Box>
                    </Box>
                  );
                })()}

                {/* Border radius scale */}
                <Text style={{ color: c.muted, fontSize: 8, fontWeight: 'bold' }}>{'BORDER RADIUS'}</Text>
                <Box style={{ flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'center' }}>
                  {(['0', '4', '8', '12', '\u221e'] as const).map((label, i) => {
                    const r = [0, 4, 8, 12, 9999][i];
                    const custom = { backgroundColor: P.cyan, borderRadius: r };
                    return (
                      <Box key={label} style={{ ...custom, width: 36, height: 36, justifyContent: 'center', alignItems: 'center' }} tooltip={styleTooltip(custom)}>
                        <Text style={{ color: '#fff', fontSize: 8 }}>{label}</Text>
                      </Box>
                    );
                  })}
                </Box>

                {/* Color formats */}
                <Text style={{ color: c.muted, fontSize: 8, fontWeight: 'bold' }}>{'COLOR'}</Text>
                <Box style={{ flexDirection: 'row', gap: 6 }}>
                  {(() => {
                    const hex = { backgroundColor: P.blue, borderRadius: 6 };
                    const theme = { backgroundColor: c.primary, borderRadius: 6 };
                    return (
                      <>
                        <Box style={{ ...hex, flexGrow: 1, height: 32, justifyContent: 'center', alignItems: 'center' }} tooltip={styleTooltip(hex)}>
                          <Text style={{ color: '#fff', fontSize: 8 }}>{'hex'}</Text>
                        </Box>
                        <Box style={{ ...theme, flexGrow: 1, height: 32, justifyContent: 'center', alignItems: 'center' }} tooltip={styleTooltip(theme)}>
                          <Text style={{ color: '#fff', fontSize: 8 }}>{'theme'}</Text>
                        </Box>
                      </>
                    );
                  })()}
                </Box>

                {/* Shadow scale */}
                <Text style={{ color: c.muted, fontSize: 8, fontWeight: 'bold' }}>{'SHADOW'}</Text>
                <Box style={{ flexDirection: 'row', gap: 8, justifyContent: 'center' }}>
                  {([
                    ['sm', { shadowColor: 'rgba(0,0,0,0.08)', shadowOffsetX: 0, shadowOffsetY: 1, shadowBlur: 2 }],
                    ['md', { shadowColor: 'rgba(0,0,0,0.12)', shadowOffsetX: 0, shadowOffsetY: 4, shadowBlur: 6 }],
                    ['lg', { shadowColor: 'rgba(0,0,0,0.12)', shadowOffsetX: 0, shadowOffsetY: 10, shadowBlur: 15 }],
                  ] as const).map(([name, shadow]) => {
                    const custom = { ...shadow, backgroundColor: c.surface, borderRadius: 8, padding: 10 };
                    return (
                      <Box key={name} style={{ ...custom, minWidth: 56, alignItems: 'center', justifyContent: 'center' }} tooltip={styleTooltip(custom)}>
                        <Text style={{ color: c.text, fontSize: 8 }}>{name}</Text>
                      </Box>
                    );
                  })}
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
                  {'Box is the universal layout primitive in ReactJIT. It maps directly to a Lua view node — a flex container that paints a background, clips children, and dispatches input events. Every panel, card, row, column, and decorative surface is a Box. It is the only component that accepts all style, event, and focus props.'}
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

                <HorizontalDivider />

                {/* Callbacks */}
                <Text style={{ color: c.muted, fontSize: 8, fontWeight: 'bold' }}>
                  {'CALLBACKS'}
                </Text>
                <Box style={{ gap: 3 }}>
                  {CALLBACKS.map(([name, sig, icon]) => (
                    <Box key={name} style={{ flexDirection: 'row', gap: 5, alignItems: 'center' }}>
                      <Image src={icon} style={{ width: 10, height: 10 }} tintColor={SYN.tag} />
                      <Text style={{ color: SYN.tag, fontSize: 9, fontWeight: 'bold' }}>{name}</Text>
                      <Text style={{ color: c.muted, fontSize: 9 }}>{sig}</Text>
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
        <Image src="box" style={{ width: 12, height: 12 }} tintColor={c.text} />
        <Text style={{ color: c.text, fontSize: 9 }}>{'Box'}</Text>

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
