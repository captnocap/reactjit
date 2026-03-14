/**
 * BoxStory — Layout1 documentation for Box.
 *
 * Box is the root layout primitive. All layout, spacing, color,
 * borders, and event handling flow through it.
 */

import React, { useState } from 'react';
import { Box, Text, Image, TextEditor, CodeBlock, Pressable, ScrollView, useMount, classifiers as S} from '../../../packages/core/src';
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
  return <S.StoryDivider />;
}

function VerticalDivider() {
  const c = useThemeColors();
  return <S.VertDivider style={{ flexShrink: 0, alignSelf: 'stretch' }} />;
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
        <S.PrimaryIcon20 src="box" />

        <S.StoryTitle>
          {'Box'}
        </S.StoryTitle>

        <S.StoryBtnSm style={{ flexDirection: 'row', backgroundColor: c.surface, borderWidth: 1, borderColor: c.border }}>
          <Text style={{ color: SYN.tag, fontSize: 10 }}>{'<'}</Text>
          <Text style={{ color: SYN.component, fontSize: 10 }}>{'Box'}</Text>
          <S.StoryMuted>{' '}</S.StoryMuted>
          <Text style={{ color: SYN.tag, fontSize: 10 }}>{'/>'}</Text>
        </S.StoryBtnSm>

        <Box style={{ flexGrow: 1 }} />

        <S.StoryMuted>
          {'Something to put something else inside of'}
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
            {/* ── Left: Preview ── */}
            <ScrollView style={{ flexGrow: 1, flexBasis: 0, justifyContent: 'center', alignItems: 'center' }}>
              <Box style={{ width: '100%', padding: 20, gap: 14 }}>

                {/* Containment — wireframe nesting */}
                <S.StoryTiny style={{ fontWeight: 'bold' }}>{'CONTAINMENT'}</S.StoryTiny>
                <Box style={{ alignItems: 'center' }}>
                  <S.Center tooltip={{ content: 'Outer\n260x140', type: 'cursor', layout: 'descriptive' }} style={{ width: 260, height: 140, borderWidth: 1, borderColor: c.border }}>
                    <S.Center tooltip={{ content: 'Middle\n180x90', type: 'cursor', layout: 'descriptive' }} style={{ width: 180, height: 90, borderWidth: 1, borderColor: c.border }}>
                      <S.Center tooltip={{ content: 'Inner\n100x45', type: 'cursor', layout: 'descriptive' }} style={{ width: 100, height: 45, borderWidth: 1, borderColor: c.border }}>
                        <Text style={{ color: c.muted, fontSize: 8 }}>{'children'}</Text>
                      </S.Center>
                    </S.Center>
                  </S.Center>
                </Box>

                {/* Styled nesting */}
                <S.StoryTiny style={{ fontWeight: 'bold' }}>{'STYLED'}</S.StoryTiny>
                {(() => {
                  const outer = { backgroundColor: c.surface, borderRadius: 14, padding: 16 };
                  const mid = { backgroundColor: P.blue, borderRadius: 10, padding: 12 };
                  const inner = { backgroundColor: P.violet, borderRadius: 8, padding: 10 };
                  return (
                    <Box style={{ alignItems: 'center' }}>
                      <Box style={{ ...outer, width: 260, justifyContent: 'center', alignItems: 'center' }} tooltip={styleTooltip(outer)}>
                        <Box style={{ ...mid, width: 200, justifyContent: 'center', alignItems: 'center' }} tooltip={styleTooltip(mid)}>
                          <Box style={{ ...inner, width: 140, justifyContent: 'center', alignItems: 'center' }} tooltip={styleTooltip(inner)}>
                            <S.WhiteBody>{'Nested'}</S.WhiteBody>
                          </Box>
                        </Box>
                      </Box>
                    </Box>
                  );
                })()}

                {/* Border radius scale */}
                <S.StoryTiny style={{ fontWeight: 'bold' }}>{'BORDER RADIUS'}</S.StoryTiny>
                <S.RowCenterG6 style={{ justifyContent: 'center' }}>
                  {(['0', '4', '8', '12', '\u221e'] as const).map((label, i) => {
                    const r = [0, 4, 8, 12, 9999][i];
                    const custom = { backgroundColor: P.cyan, borderRadius: r };
                    return (
                      <Box key={label} style={{ ...custom, width: 36, height: 36, justifyContent: 'center', alignItems: 'center' }} tooltip={styleTooltip(custom)}>
                        <S.WhiteTiny>{label}</S.WhiteTiny>
                      </Box>
                    );
                  })}
                </S.RowCenterG6>

                {/* Color formats */}
                <S.StoryTiny style={{ fontWeight: 'bold' }}>{'COLOR'}</S.StoryTiny>
                <S.RowG6>
                  {(() => {
                    const hex = { backgroundColor: P.blue, borderRadius: 6 };
                    const theme = { backgroundColor: c.primary, borderRadius: 6 };
                    return (
                      <>
                        <Box style={{ ...hex, flexGrow: 1, height: 32, justifyContent: 'center', alignItems: 'center' }} tooltip={styleTooltip(hex)}>
                          <S.WhiteTiny>{'hex'}</S.WhiteTiny>
                        </Box>
                        <Box style={{ ...theme, flexGrow: 1, height: 32, justifyContent: 'center', alignItems: 'center' }} tooltip={styleTooltip(theme)}>
                          <S.WhiteTiny>{'theme'}</S.WhiteTiny>
                        </Box>
                      </>
                    );
                  })()}
                </S.RowG6>

                {/* Shadow scale */}
                <S.StoryTiny style={{ fontWeight: 'bold' }}>{'SHADOW'}</S.StoryTiny>
                <S.RowG8 style={{ justifyContent: 'center' }}>
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
                </S.RowG8>


              </Box>
            </ScrollView>

            <VerticalDivider />

            {/* ── Right: API Reference ── */}
            <ScrollView style={{ flexGrow: 1, flexBasis: 0, justifyContent: 'center', alignItems: 'center' }}>
              <S.StackG10W100 style={{ padding: 14 }}>

                {/* Overview */}
                <S.StoryTiny style={{ fontWeight: 'bold' }}>
                  {'OVERVIEW'}
                </S.StoryTiny>
                <S.StoryBody>
                  {'Box is the universal layout primitive in ReactJIT. It maps directly to a Lua view node — a flex container that paints a background, clips children, and dispatches input events. Every panel, card, row, column, and decorative surface is a Box. It is the only component that accepts all style, event, and focus props.'}
                </S.StoryBody>

                <HorizontalDivider />

                {/* Usage */}
                <S.StoryTiny style={{ fontWeight: 'bold' }}>
                  {'USAGE'}
                </S.StoryTiny>
                <CodeBlock language="tsx" fontSize={9} code={USAGE_CODE} />

                <HorizontalDivider />

                {/* Behavior */}
                <S.StoryTiny style={{ fontWeight: 'bold' }}>
                  {'BEHAVIOR'}
                </S.StoryTiny>
                <Box style={{ gap: 4, width: '100%' }}>
                  {BEHAVIOR_NOTES.map((note, i) => (
                    <S.RowG6 key={i} style={{ alignItems: 'flex-start', width: '100%' }}>
                      <Image src="chevron-right" style={{ width: 8, height: 8, flexShrink: 0, marginTop: 2 }} tintColor={c.muted} />
                      <S.StoryBody style={{ flexGrow: 1, flexShrink: 1, flexBasis: 0 }}>{note}</S.StoryBody>
                    </S.RowG6>
                  ))}
                </Box>

                <HorizontalDivider />

                {/* Props */}
                <S.StoryTiny style={{ fontWeight: 'bold' }}>
                  {'PROPS'}
                </S.StoryTiny>
                <Box style={{ gap: 3 }}>
                  {PROPS.map(([prop, type, icon]) => (
                    <S.RowCenterG5 key={prop}>
                      <S.StorySectionIcon src={icon} tintColor={SYN.prop} />
                      <Text style={{ color: SYN.prop, fontSize: 9, fontWeight: 'bold' }}>{prop}</Text>
                      <S.StoryCap>{type}</S.StoryCap>
                    </S.RowCenterG5>
                  ))}
                </Box>

                <HorizontalDivider />

                {/* Callbacks */}
                <S.StoryTiny style={{ fontWeight: 'bold' }}>
                  {'CALLBACKS'}
                </S.StoryTiny>
                <Box style={{ gap: 3 }}>
                  {CALLBACKS.map(([name, sig, icon]) => (
                    <S.RowCenterG5 key={name}>
                      <S.StorySectionIcon src={icon} tintColor={SYN.tag} />
                      <Text style={{ color: SYN.tag, fontSize: 9, fontWeight: 'bold' }}>{name}</Text>
                      <S.StoryCap>{sig}</S.StoryCap>
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
        <S.TextIcon12 src="box" />
        <S.StoryBreadcrumbActive>{'Box'}</S.StoryBreadcrumbActive>

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
