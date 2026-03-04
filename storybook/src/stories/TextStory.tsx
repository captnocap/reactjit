/**
 * TextStory — Layout1 documentation for Text.
 *
 * Text is the only primitive with intrinsic width. It measures
 * its string against font metrics and sizes itself accordingly.
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

function HorizontalDivider() {
  const c = useThemeColors();
  return <Box style={{ height: 1, flexShrink: 0, backgroundColor: c.border }} />;
}

function VerticalDivider() {
  const c = useThemeColors();
  return <Box style={{ width: 1, flexShrink: 0, alignSelf: 'stretch', backgroundColor: c.border }} />;
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
        <Image src="type" style={{ width: 20, height: 20 }} tintColor={c.primary} />

        <Text style={{ color: c.text, fontSize: 20, fontWeight: 'bold' }}>
          {'Text'}
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
          <Text style={{ color: SYN.component, fontSize: 10 }}>{'Text'}</Text>
          <Text style={{ color: c.muted, fontSize: 10 }}>{' '}</Text>
          <Text style={{ color: SYN.prop, fontSize: 10 }}>{'fontSize'}</Text>
          <Text style={{ color: c.muted, fontSize: 10 }}>{'='}</Text>
          <Text style={{ color: SYN.value, fontSize: 10 }}>{'{16}'}</Text>
          <Text style={{ color: SYN.tag, fontSize: 10 }}>{'>'}</Text>
        </Box>

        <Box style={{ flexGrow: 1 }} />

        <Text style={{ color: c.muted, fontSize: 10 }}>
          {'Renders text content with font styling and optional truncation'}
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

                {/* Font size scale */}
                <Text style={{ color: c.muted, fontSize: 8, fontWeight: 'bold' }}>{'FONT SIZE'}</Text>
                <Box style={{ gap: 2, alignItems: 'center' }}>
                  <Text style={{ color: P.text, fontSize: 10 }}>{'10px — caption'}</Text>
                  <Text style={{ color: P.text, fontSize: 12 }}>{'12px — small'}</Text>
                  <Text style={{ color: P.text, fontSize: 14 }}>{'14px — body'}</Text>
                  <Text style={{ color: P.text, fontSize: 18 }}>{'18px — heading'}</Text>
                  <Text style={{ color: P.text, fontSize: 24 }}>{'24px — display'}</Text>
                </Box>

                {/* Font weight */}
                <Text style={{ color: c.muted, fontSize: 8, fontWeight: 'bold' }}>{'FONT WEIGHT'}</Text>
                <Box style={{ gap: 2, alignItems: 'center' }}>
                  <Text style={{ color: P.text, fontSize: 13, fontWeight: 'normal' }}>{'normal'}</Text>
                  <Text style={{ color: P.text, fontSize: 13, fontWeight: 'bold' }}>{'bold'}</Text>
                  <Text style={{ color: P.text, fontSize: 13, fontWeight: 900 }}>{'black (900)'}</Text>
                </Box>

                {/* Color palette */}
                <Text style={{ color: c.muted, fontSize: 8, fontWeight: 'bold' }}>{'COLOR'}</Text>
                <Box style={{ gap: 2, alignItems: 'center' }}>
                  <Text style={{ color: P.blue, fontSize: 12 }}>{'blue — #89b4fa'}</Text>
                  <Text style={{ color: P.mauve, fontSize: 12 }}>{'mauve — #cba6f7'}</Text>
                  <Text style={{ color: P.peach, fontSize: 12 }}>{'peach — #fab387'}</Text>
                  <Text style={{ color: P.green, fontSize: 12 }}>{'green — #a6e3a1'}</Text>
                  <Text style={{ color: P.red, fontSize: 12 }}>{'red — #f38ba8'}</Text>
                </Box>

                {/* Decoration */}
                <Text style={{ color: c.muted, fontSize: 8, fontWeight: 'bold' }}>{'DECORATION'}</Text>
                <Box style={{ flexDirection: 'row', gap: 16, justifyContent: 'center' }}>
                  <Text style={{ color: P.text, fontSize: 12, textDecorationLine: 'underline' }}>{'underline'}</Text>
                  <Text style={{ color: P.text, fontSize: 12, textDecorationLine: 'line-through' }}>{'line-through'}</Text>
                </Box>

                {/* Alignment */}
                <Text style={{ color: c.muted, fontSize: 8, fontWeight: 'bold' }}>{'ALIGNMENT'}</Text>
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
                <Text style={{ color: c.muted, fontSize: 8, fontWeight: 'bold' }}>{'LETTER SPACING'}</Text>
                <Box style={{ gap: 2, alignItems: 'center' }}>
                  <Text style={{ color: P.blue, fontSize: 12, letterSpacing: 0 }}>{'spacing: 0'}</Text>
                  <Text style={{ color: P.blue, fontSize: 12, letterSpacing: 1 }}>{'spacing: 1'}</Text>
                  <Text style={{ color: P.blue, fontSize: 12, letterSpacing: 3 }}>{'spacing: 3'}</Text>
                </Box>

                {/* Shadow */}
                <Text style={{ color: c.muted, fontSize: 8, fontWeight: 'bold' }}>{'TEXT SHADOW'}</Text>
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
              <Box style={{ width: '100%', padding: 14, gap: 10 }}>

                {/* Overview */}
                <Text style={{ color: c.muted, fontSize: 8, fontWeight: 'bold' }}>
                  {'OVERVIEW'}
                </Text>
                <Text style={{ color: c.text, fontSize: 10 }}>
                  {'Text is the primitive for rendering text content. It is the only element that carries intrinsic width — the layout engine measures the string against the font and fontSize to determine horizontal space. Text supports font styling (fontSize, fontFamily, fontWeight, color, textAlign, letterSpacing, lineHeight), truncation via numberOfLines, and keyboard event handlers.'}
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

                {/* Style Properties */}
                <Text style={{ color: c.muted, fontSize: 8, fontWeight: 'bold' }}>
                  {'STYLE PROPERTIES'}
                </Text>
                <Box style={{ gap: 3 }}>
                  {STYLE_PROPS.map(([prop, type, icon]) => (
                    <Box key={prop} style={{ flexDirection: 'row', gap: 5, alignItems: 'center' }}>
                      <Image src={icon} style={{ width: 10, height: 10 }} tintColor={SYN.value} />
                      <Text style={{ color: SYN.value, fontSize: 9, fontWeight: 'bold' }}>{prop}</Text>
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
        <Image src="type" style={{ width: 12, height: 12 }} tintColor={c.text} />
        <Text style={{ color: c.text, fontSize: 9 }}>{'Text'}</Text>

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
