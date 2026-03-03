/**
 * Layout 1 — Component documentation page template.
 *
 * Structure:
 *   Page (100% x 100%)
 *     Header — title + snippet + description (fixed, always visible)
 *     Center — two-column area (flexGrow:1)
 *       Docs mode:       Left=preview (centered), Right=API reference (centered)
 *       Playground mode:  Left=code editor, Right=live preview
 *     Footer — breadcrumbs + playground toggle (fixed, always visible)
 *
 * This is a TEMPLATE — all text is placeholder. No ComponentDoc wrapper.
 * CodeBlock uses the `code` string prop — Lua reads it directly.
 * Static string constants = no identity churn = no memory leaks.
 *
 * ─── DOC SECTION MAPPING ───────────────────────────────────────────────
 *
 * Each section in this template maps to a field in the content .txt files
 * at content/sections/05-components/<name>.txt (or 06-hooks/, etc.).
 *
 *   Header title          → METADATA.title
 *   Header snippet pill   → API/SYNTAX import line (first ```tsx block)
 *   Header description    → METADATA.description
 *   OVERVIEW section      → === OVERVIEW === paragraph
 *   USAGE CodeBlock       → API/SYNTAX usage code (second ```tsx block)
 *   BEHAVIOR notes        → === CRITICAL RULES === or key notes from OVERVIEW
 *   PROPS two-column      → API/SYNTAX Props table (filter out on* handlers)
 *   CALLBACKS list        → API/SYNTAX Props table (only on* handlers)
 *   Footer breadcrumb     → METADATA.category
 *   Playground starter    → === EXAMPLES === first code block
 *
 * ─── NON-NEGOTIABLE: NO WRAPPER COMPONENT ──────────────────────────────
 *
 * When scaffolding a new component story from this template, Claude MUST
 * read the .txt doc file and manually inline every value into static
 * hoisted constants (PROPS, CALLBACKS, USAGE_CODE, BEHAVIOR_NOTES, etc).
 *
 * NEVER extract these sections into a shared "ComponentDoc" component.
 * NEVER build a loader/hook that reads .txt files at runtime.
 * NEVER create any abstraction that wraps CodeBlock or renders doc sections
 * dynamically. This exact pattern — static constants, inline JSX — is the
 * only pattern that doesn't leak memory. A wrapper component re-renders
 * every frame, feeds CodeBlock new string identities at 60fps, and causes
 * the tokenizer to re-run continuously. This cost us 18 hours.
 *
 * The extra 5 minutes of copy-paste is the price of not leaking.
 * ────────────────────────────────────────────────────────────────────────
 */

import React, { useState, useCallback, useEffect } from 'react';
import { Box, Text, Image, TextEditor, CodeBlock, Pressable, ScrollView } from '../../../packages/core/src';
import { useThemeColors } from '../../../packages/theme/src';
import { transformJSX } from '../playground/lib/jsx-transform';
import { evalComponent } from '../playground/lib/eval-component';
import { Preview } from '../playground/Preview';

// ── Syntax colors for the header snippet pill ───────────

const SYN = {
  tag: '#f38ba8',       // punctuation: < / >
  component: '#89b4fa', // component name
  prop: '#cba6f7',      // attribute name
  value: '#f9e2af',     // expression / string literal
};

// ── Helpers ──────────────────────────────────────────────

/** Build a table-layout tooltip from visual style props (filters out structural ones). */
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

function Wireframe({ label, style }: { label: string; style?: any }) {
  const c = useThemeColors();
  return (
    <Box style={{
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 6,
      justifyContent: 'center',
      alignItems: 'center',
      ...style,
    }}>
      <Text style={{ color: c.muted, fontSize: 9, textAlign: 'center' }}>{label}</Text>
    </Box>
  );
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

const USAGE_CODE = '<Component propA="value" propB={123}>\n  <Child />\n</Component>';

const STARTER_CODE = `<Box style={{
  backgroundColor: '#3b82f6',
  borderRadius: 8,
  padding: 16,
  gap: 8,
}}>
  <Text style={{ color: 'white', fontSize: 16, fontWeight: 'bold' }}>
    Hello
  </Text>
  <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12 }}>
    Edit this code to see live changes
  </Text>
</Box>`;

// Props — [name, type, icon]
const PROPS: [string, string, string][] = [
  ['style', 'ViewStyle', 'layout'],
  ['bg', 'string', 'palette'],
  ['radius', 'number', 'circle'],
  ['padding', 'number', 'move'],
  ['tooltip', 'TooltipConfig', 'message-circle'],
  ['children', 'ReactNode', 'layers'],
  ['testId', 'string', 'tag'],
  ['pointerEvents', 'enum', 'mouse-pointer'],
  ['accessibilityLabel', 'string', 'accessibility'],
];

// Callbacks — [name, signature, icon]
const CALLBACKS: [string, string, string][] = [
  ['onPress', '() => void', 'pointer'],
  ['onHoverIn', '() => void', 'log-in'],
  ['onHoverOut', '() => void', 'log-out'],
  ['onLayout', '(e) => void', 'ruler'],
];

const BEHAVIOR_NOTES = [
  'First behavioral note about the component.',
  'Second behavioral note about the component.',
  'Third behavioral note about the component.',
];

// Preview styled boxes
const STYLED_1 = { backgroundColor: '#3b82f6', borderRadius: 8, padding: 16 };
const STYLED_2 = { backgroundColor: '#10b981', borderRadius: 12, padding: 10, borderWidth: 2, borderColor: '#065f46' };

// ── Component ────────────────────────────────────────────

export function Layout1Story() {
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

  const mid = Math.ceil(PROPS.length / 2);
  const col1 = PROPS.slice(0, mid);
  const col2 = PROPS.slice(mid);

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
        <Image src="component" style={{ width: 20, height: 20 }} tintColor={c.primary} />

        <Text style={{ color: c.text, fontSize: 20, fontWeight: 'bold' }}>
          {'Title'}
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
          <Text style={{ color: SYN.component, fontSize: 10 }}>{'Component'}</Text>
          <Text style={{ color: c.muted, fontSize: 10 }}>{' '}</Text>
          <Text style={{ color: SYN.prop, fontSize: 10 }}>{'prop'}</Text>
          <Text style={{ color: c.muted, fontSize: 10 }}>{'='}</Text>
          <Text style={{ color: SYN.value, fontSize: 10 }}>{'{value}'}</Text>
          <Text style={{ color: c.muted, fontSize: 10 }}>{' '}</Text>
          <Text style={{ color: SYN.tag, fontSize: 10 }}>{'/>'}</Text>
        </Box>

        <Box style={{ flexGrow: 1 }} />

        <Text style={{ color: c.muted, fontSize: 10 }}>
          {'A short description of the component and what it does.'}
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
            {/* ── Left: Preview (centered) ── */}
            <ScrollView style={{ flexGrow: 1, flexBasis: 0, justifyContent: 'center', alignItems: 'center' }}>
              <Box style={{ alignItems: 'center', padding: 20, gap: 12 }}>

                <Box
                  style={{ ...STYLED_1, justifyContent: 'center', alignItems: 'center' }}
                  tooltip={styleTooltip(STYLED_1)}
                >
                  <Text style={{ color: 'white', fontSize: 10 }}>{'Styled element'}</Text>
                </Box>

                <Box style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                  <Wireframe label="A" style={{ width: 40, height: 40 }} />
                  <Wireframe label="B" style={{ width: 40, height: 40 }} />
                </Box>

                <Box
                  style={{ ...STYLED_2, justifyContent: 'center', alignItems: 'center' }}
                  tooltip={styleTooltip(STYLED_2)}
                >
                  <Text style={{ color: 'white', fontSize: 10 }}>{'Another styled'}</Text>
                </Box>

              </Box>
            </ScrollView>

            <VerticalDivider />

            {/* ── Right: API Reference (centered) ── */}
            <ScrollView style={{ flexGrow: 1, flexBasis: 0, justifyContent: 'center', alignItems: 'center' }}>
              <Box style={{ width: '100%', padding: 14, gap: 10 }}>

                {/* ── Overview ── */}
                <Text style={{ color: c.muted, fontSize: 8, fontWeight: 'bold' }}>
                  {'OVERVIEW'}
                </Text>
                <Text style={{ color: c.text, fontSize: 10 }}>
                  {'A short paragraph describing what this component is and when to use it.'}
                </Text>

                <HorizontalDivider />

                {/* ── Usage ── */}
                <Text style={{ color: c.muted, fontSize: 8, fontWeight: 'bold' }}>
                  {'USAGE'}
                </Text>
                <CodeBlock language="tsx" fontSize={9} code={USAGE_CODE} />

                <HorizontalDivider />

                {/* ── Behavior ── */}
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

                {/* ── Props ── */}
                <Text style={{ color: c.muted, fontSize: 8, fontWeight: 'bold' }}>
                  {'PROPS'}
                </Text>
                <Box style={{ flexDirection: 'row', gap: 8 }}>
                  <Box style={{ flexGrow: 1, flexBasis: 0, gap: 3 }}>
                    {col1.map(([prop, type, icon]) => (
                      <Box key={prop} style={{ flexDirection: 'row', gap: 5, alignItems: 'center' }}>
                        <Image src={icon} style={{ width: 10, height: 10 }} tintColor={c.muted} />
                        <Text style={{ color: c.text, fontSize: 9 }}>{prop}</Text>
                        <Text style={{ color: c.muted, fontSize: 9 }}>{type}</Text>
                      </Box>
                    ))}
                  </Box>
                  <Box style={{ flexGrow: 1, flexBasis: 0, gap: 3 }}>
                    {col2.map(([prop, type, icon]) => (
                      <Box key={prop} style={{ flexDirection: 'row', gap: 5, alignItems: 'center' }}>
                        <Image src={icon} style={{ width: 10, height: 10 }} tintColor={c.muted} />
                        <Text style={{ color: c.text, fontSize: 9 }}>{prop}</Text>
                        <Text style={{ color: c.muted, fontSize: 9 }}>{type}</Text>
                      </Box>
                    ))}
                  </Box>
                </Box>

                <HorizontalDivider />

                {/* ── Callbacks ── */}
                <Text style={{ color: c.muted, fontSize: 8, fontWeight: 'bold' }}>
                  {'CALLBACKS'}
                </Text>
                <Box style={{ gap: 3 }}>
                  {CALLBACKS.map(([name, sig, icon]) => (
                    <Box key={name} style={{ flexDirection: 'row', gap: 5, alignItems: 'center' }}>
                      <Image src={icon} style={{ width: 10, height: 10 }} tintColor={c.muted} />
                      <Text style={{ color: c.text, fontSize: 9 }}>{name}</Text>
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
        <Image src="component" style={{ width: 12, height: 12 }} tintColor={c.text} />
        <Text style={{ color: c.text, fontSize: 9 }}>{'Component'}</Text>

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
