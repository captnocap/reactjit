/**
 * TextStory — Layout1 documentation for Text.
 *
 * Text is the only primitive with intrinsic width. It measures
 * its string against font metrics and sizes itself accordingly.
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

function HorizontalDivider() {
  const c = useThemeColors();
  return <S.StoryDivider />;
}

function VerticalDivider() {
  const c = useThemeColors();
  return <S.VertDivider style={{ flexShrink: 0, alignSelf: 'stretch' }} />;
}

// ── Static data from content/sections/05-components/text.txt ──

const USAGE_CODE = `import { Text } from '@reactjit/core';

// Basic text
<Text style={{ fontSize: 16, color: '#cdd6f4' }}>
  Hello, world
</Text>

// Styled heading
<Text style={{
  fontSize: 32,
  fontWeight: 'bold',
  color: '#89b4fa',
  textAlign: 'center',
  letterSpacing: 1.2,
}}>
  Dashboard
</Text>

// Truncated — numberOfLines clips with ellipsis
<Box style={{ width: 200 }}>
  <Text style={{ fontSize: 14 }} numberOfLines={2}>
    Long text that gets truncated...
  </Text>
</Box>

// Dynamic content — always use template literals
<Text style={{ fontSize: 14 }}>
  {\`Items: \${count}\`}
</Text>`;

const STARTER_CODE = `<Box style={{
  backgroundColor: '#1e1e2e',
  borderRadius: 12,
  padding: 20,
  gap: 8,
  alignItems: 'center',
}}>
  <Text style={{
    fontSize: 24,
    fontWeight: 'bold',
    color: '#89b4fa',
    letterSpacing: 1,
  }}>
    Typography
  </Text>
  <Text style={{
    fontSize: 14,
    color: '#a6adc8',
    textAlign: 'center',
  }}>
    Edit this code to explore text styling
  </Text>
  <Text style={{
    fontSize: 11,
    color: '#f38ba8',
    textDecorationLine: 'underline',
  }}>
    underlined accent
  </Text>
</Box>`;

// Props — [name, type, icon]
const PROPS: [string, string, string][] = [
  ['style', 'Style', 'layout'],
  ['numberOfLines', 'number', 'wrap-text'],
  ['children', 'ReactNode', 'type'],
];

// Style properties — [name, type, icon]
const STYLE_PROPS: [string, string, string][] = [
  ['fontSize', 'number', 'ruler'],
  ['color', 'Color', 'palette'],
  ['fontFamily', 'string', 'type'],
  ['fontWeight', "'normal' | 'bold' | number", 'bold'],
  ['textAlign', "'left' | 'center' | 'right'", 'align-center'],
  ['textOverflow', "'clip' | 'ellipsis'", 'scissors'],
  ['textDecorationLine', "'underline' | 'line-through'", 'underline'],
  ['lineHeight', 'number', 'space-between'],
  ['letterSpacing', 'number', 'between-horizontal-start'],
  ['textShadowColor', 'Color', 'cloud'],
  ['textShadowOffsetX/Y', 'number', 'move'],
];

// Callbacks — [name, signature, icon]
const CALLBACKS: [string, string, string][] = [
  ['onKeyDown', '(e: LoveEvent) => void', 'keyboard'],
  ['onKeyUp', '(e: LoveEvent) => void', 'keyboard'],
  ['onTextInput', '(e: LoveEvent) => void', 'text-cursor-input'],
];

const BEHAVIOR_NOTES = [
  'Every Text element MUST have an explicit fontSize. The linter enforces this as a build-blocking error.',
  'Text is the only primitive with intrinsic width — it sizes itself from font metrics. Box and Image cannot.',
  'Never mix bare text and expressions: "count: {value}" renders literally. Use template literals: {`count: ${value}`}.',
  'Do not nest Box inside Text. Children should be strings, numbers, or other Text elements only.',
  'Do not use block character (U+2588) inside Text — use colored Box with backgroundColor instead.',
];

// Palette (hoisted)
const P = {
  blue: '#89b4fa',
  mauve: '#cba6f7',
  peach: '#fab387',
  green: '#a6e3a1',
  red: '#f38ba8',
  text: '#cdd6f4',
  subtext: '#a6adc8',
};

// ── Component ────────────────────────────────────────────

export function TextStory() {
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
        <S.PrimaryIcon20 src="type" />

        <S.StoryTitle>
          {'Text'}
        </S.StoryTitle>

        <S.StoryBtnSm style={{ flexDirection: 'row', backgroundColor: c.surface, borderWidth: 1, borderColor: c.border }}>
          <Text style={{ color: SYN.tag, fontSize: 10 }}>{'<'}</Text>
          <Text style={{ color: SYN.component, fontSize: 10 }}>{'Text'}</Text>
          <S.StoryMuted>{' '}</S.StoryMuted>
          <Text style={{ color: SYN.prop, fontSize: 10 }}>{'fontSize'}</Text>
          <S.StoryMuted>{'='}</S.StoryMuted>
          <Text style={{ color: SYN.value, fontSize: 10 }}>{'{16}'}</Text>
          <Text style={{ color: SYN.tag, fontSize: 10 }}>{'>'}</Text>
        </S.StoryBtnSm>

        <Box style={{ flexGrow: 1 }} />

        <S.StoryMuted>
          {'Literally just words'}
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
              <Box style={{ width: '100%', padding: 20, gap: 16 }}>

                {/* Font size scale */}
                <S.StoryTiny style={{ fontWeight: 'bold' }}>{'FONT SIZE'}</S.StoryTiny>
                <Box style={{ gap: 2, alignItems: 'center' }}>
                  <Text style={{ color: P.text, fontSize: 10 }}>{'10px — caption'}</Text>
                  <Text style={{ color: P.text, fontSize: 12 }}>{'12px — small'}</Text>
                  <Text style={{ color: P.text, fontSize: 14 }}>{'14px — body'}</Text>
                  <Text style={{ color: P.text, fontSize: 18 }}>{'18px — heading'}</Text>
                  <Text style={{ color: P.text, fontSize: 24 }}>{'24px — display'}</Text>
                </Box>

                {/* Font weight */}
                <S.StoryTiny style={{ fontWeight: 'bold' }}>{'FONT WEIGHT'}</S.StoryTiny>
                <Box style={{ gap: 2, alignItems: 'center' }}>
                  <Text style={{ color: P.text, fontSize: 13, fontWeight: 'normal' }}>{'normal'}</Text>
                  <Text style={{ color: P.text, fontSize: 13, fontWeight: 'bold' }}>{'bold'}</Text>
                  <Text style={{ color: P.text, fontSize: 13, fontWeight: 900 }}>{'black (900)'}</Text>
                </Box>

                {/* Color palette */}
                <S.StoryTiny style={{ fontWeight: 'bold' }}>{'COLOR'}</S.StoryTiny>
                <Box style={{ gap: 2, alignItems: 'center' }}>
                  <Text style={{ color: P.blue, fontSize: 12 }}>{'blue — #89b4fa'}</Text>
                  <Text style={{ color: P.mauve, fontSize: 12 }}>{'mauve — #cba6f7'}</Text>
                  <Text style={{ color: P.peach, fontSize: 12 }}>{'peach — #fab387'}</Text>
                  <Text style={{ color: P.green, fontSize: 12 }}>{'green — #a6e3a1'}</Text>
                  <Text style={{ color: P.red, fontSize: 12 }}>{'red — #f38ba8'}</Text>
                </Box>

                {/* Decoration */}
                <S.StoryTiny style={{ fontWeight: 'bold' }}>{'DECORATION'}</S.StoryTiny>
                <Box style={{ flexDirection: 'row', gap: 16, justifyContent: 'center' }}>
                  <Text style={{ color: P.text, fontSize: 12, textDecorationLine: 'underline' }}>{'underline'}</Text>
                  <Text style={{ color: P.text, fontSize: 12, textDecorationLine: 'line-through' }}>{'line-through'}</Text>
                </Box>

                {/* Alignment */}
                <S.StoryTiny style={{ fontWeight: 'bold' }}>{'ALIGNMENT'}</S.StoryTiny>
                <Box style={{ gap: 2, width: 200, alignSelf: 'center' }}>
                  <Box style={{ backgroundColor: c.surface, borderRadius: 4, padding: 4 }}>
                    <Text style={{ color: P.subtext, fontSize: 10, textAlign: 'left' }}>{'left'}</Text>
                  </Box>
                  <Box style={{ backgroundColor: c.surface, borderRadius: 4, padding: 4 }}>
                    <Text style={{ color: P.subtext, fontSize: 10, textAlign: 'center' }}>{'center'}</Text>
                  </Box>
                  <Box style={{ backgroundColor: c.surface, borderRadius: 4, padding: 4 }}>
                    <Text style={{ color: P.subtext, fontSize: 10, textAlign: 'right' }}>{'right'}</Text>
                  </Box>
                </Box>

                {/* Letter spacing */}
                <S.StoryTiny style={{ fontWeight: 'bold' }}>{'LETTER SPACING'}</S.StoryTiny>
                <Box style={{ gap: 2, alignItems: 'center' }}>
                  <Text style={{ color: P.blue, fontSize: 12, letterSpacing: 0 }}>{'spacing: 0'}</Text>
                  <Text style={{ color: P.blue, fontSize: 12, letterSpacing: 1 }}>{'spacing: 1'}</Text>
                  <Text style={{ color: P.blue, fontSize: 12, letterSpacing: 3 }}>{'spacing: 3'}</Text>
                </Box>

                {/* Shadow */}
                <S.StoryTiny style={{ fontWeight: 'bold' }}>{'TEXT SHADOW'}</S.StoryTiny>
                <Box style={{ alignItems: 'center', backgroundColor: c.surface, borderRadius: 8, padding: 12 }}>
                  <Text style={{
                    color: P.text,
                    fontSize: 18,
                    fontWeight: 'bold',
                    textShadowColor: 'rgba(0,0,0,0.5)',
                    textShadowOffsetX: 2,
                    textShadowOffsetY: 2,
                  }}>{'Shadow Text'}</Text>
                </Box>

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
                  {'Text is the primitive for rendering text content. It is the only element that carries intrinsic width — the layout engine measures the string against the font and fontSize to determine horizontal space. Text supports font styling (fontSize, fontFamily, fontWeight, color, textAlign, letterSpacing, lineHeight), truncation via numberOfLines, and keyboard event handlers.'}
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

                {/* Style Properties */}
                <S.StoryTiny style={{ fontWeight: 'bold' }}>
                  {'STYLE PROPERTIES'}
                </S.StoryTiny>
                <Box style={{ gap: 3 }}>
                  {STYLE_PROPS.map(([prop, type, icon]) => (
                    <S.RowCenterG5 key={prop}>
                      <S.StorySectionIcon src={icon} tintColor={SYN.value} />
                      <Text style={{ color: SYN.value, fontSize: 9, fontWeight: 'bold' }}>{prop}</Text>
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
        <S.TextIcon12 src="type" />
        <S.StoryBreadcrumbActive>{'Text'}</S.StoryBreadcrumbActive>

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
