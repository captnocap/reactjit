/**
 * ComponentDoc — Reusable component documentation page.
 *
 * Pass a docKey (e.g. "box") and it auto-populates all doc sections
 * from content.json. Supports playground mode with live JSX editing.
 *
 * Structure:
 *   Header — title + import snippet + description
 *   Center — two-column
 *     Docs mode:       Left=preview, Right=API reference (from docs)
 *     Playground mode:  Left=code editor, Right=live preview
 *   Footer — breadcrumbs + playground toggle
 */

import React, { useState, useCallback, useEffect } from 'react';
import { Box, Text, TextEditor, CodeBlock, Pressable, ScrollView } from '../../../../packages/core/src';
import { useThemeColors } from '../../../../packages/theme/src';
import { transformJSX } from '../../playground/lib/jsx-transform';
import { evalComponent } from '../../playground/lib/eval-component';
import { Preview } from '../../playground/Preview';
import { useDocContent } from './useDocContent';

// ── Shared helpers ───────────────────────────────────────

/** Build a table-layout tooltip from custom style props. */
export function styleTooltip(style?: Record<string, any>): { content: string; layout: string; type: string } | undefined {
  if (!style) return undefined;
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

export function Wireframe({ label, style }: { label: string; style?: any }) {
  const c = useThemeColors();
  return (
    // rjit-ignore-next-line
    <Box style={{
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 6,
      borderStyle: 'dashed',
      justifyContent: 'center',
      alignItems: 'center',
      ...style,
    }}>
      <Text style={{ color: c.muted, fontSize: 9, textAlign: 'center' }}>{label}</Text>
    </Box>
  );
}

export function HorizontalDivider() {
  const c = useThemeColors();
  return <Box style={{ height: 1, flexShrink: 0, backgroundColor: c.border }} />;
}

export function VerticalDivider() {
  const c = useThemeColors();
  return <Box style={{ width: 1, flexShrink: 0, alignSelf: 'stretch', backgroundColor: c.border }} />;
}

// ── ComponentDoc ─────────────────────────────────────────

interface ComponentDocProps {
  /** Doc key linking to content.json (e.g. "box", "text", "scrollview"). Omit for template/placeholder mode. */
  docKey?: string;
  /** Playground starter code. Falls back to first example from docs. */
  starterCode?: string;
  /** Left column preview content in docs mode. Falls back to default wireframes. */
  preview?: React.ReactNode;
  /** Breadcrumb section override. Falls back to doc category. */
  section?: string;
}

export function ComponentDoc({ docKey, starterCode, preview, section }: ComponentDocProps) {
  const c = useThemeColors();
  const doc = docKey ? useDocContent(docKey) : null;

  // Resolve starter code: explicit prop > first example > fallback
  const resolvedStarter = starterCode
    || (doc?.examples[0]?.code ?? '')
    || '<Box style={{ padding: 16 }}>\n  <Text style={{ fontSize: 14 }}>Hello</Text>\n</Box>';

  const [playground, setPlayground] = useState(false);
  const [code, setCode] = useState(resolvedStarter);
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

  // ── Template-mode placeholders (match the original Layout1 screenshot) ──
  const PLACEHOLDER_PROPS: [string, string][] = [
    ['style', 'ViewStyle'],
    ['bg', 'string'],
    ['radius', 'number'],
    ['padding', 'number'],
    ['tooltip', 'TooltipConfig'],
    ['children', 'ReactNode'],
    ['testId', 'string'],
    ['pointerEvents', 'enum'],
    ['accessibilityLabel', 'string'],
  ];
  const PLACEHOLDER_CALLBACKS: [string, string][] = [
    ['onPress', '() => void'],
    ['onHoverIn', '() => void'],
    ['onHoverOut', '() => void'],
    ['onLayout', '(e) => void'],
  ];
  const PLACEHOLDER_BEHAVIOR = [
    'First behavioral note about the component.',
    'Second behavioral note about the component.',
    'Third behavioral note about the component.',
  ];

  // Derive display values from doc content (or placeholders)
  const title = doc?.title ?? 'Title';
  const description = doc?.description ?? 'A short description of the component and what it does.';
  const overview = doc?.overview ?? 'A short paragraph describing what this component is and when to use it.';
  const usageCode = doc?.usageSnippet || doc?.examples[0]?.code || '<Component\n  propA="value"\n  propB={123}\n>\n  <Child />\n</Component>';
  const criticalRules = doc?.criticalRules ?? PLACEHOLDER_BEHAVIOR;
  const props = doc?.props ?? PLACEHOLDER_PROPS;
  const callbacks = doc?.callbacks ?? PLACEHOLDER_CALLBACKS;
  const breadcrumb = section || doc?.category || 'Core';

  // Build the import pill display text
  const importPill = doc?.importSnippet
    ? doc.importSnippet.trim().split('\n')[0]
    : '<Component prop={value} />';

  // Split props into two columns
  const mid = Math.ceil(props.length / 2);
  const col1 = props.slice(0, mid);
  const col2 = props.slice(mid);

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
        <Text style={{ color: c.text, fontSize: 20, fontWeight: 'bold' }}>
          {title}
        </Text>

        <Box style={{
          backgroundColor: c.surface,
          borderWidth: 1,
          borderColor: c.border,
          borderRadius: 4,
          paddingLeft: 8,
          paddingRight: 8,
          paddingTop: 3,
          paddingBottom: 3,
        }}>
          <Text style={{ color: c.muted, fontSize: 10 }}>
            {importPill}
          </Text>
        </Box>

        <Box style={{ flexGrow: 1 }} />

        <Text style={{ color: c.muted, fontSize: 10 }}>
          {description}
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
            {/* Left: preview area */}
            <ScrollView style={{ flexGrow: 1, flexBasis: 0, justifyContent: 'center', alignItems: 'center' }}>
              <Box style={{ alignItems: 'center', padding: 20, gap: 12 }}>
                {preview ?? <DefaultPreview />}
              </Box>
            </ScrollView>

            <VerticalDivider />

            {/* Right: doc sections */}
            <ScrollView style={{ flexGrow: 1, flexBasis: 0 }}>
              <Box style={{ padding: 14, gap: 10 }}>

                {/* ── Overview ── */}
                <Text style={{ color: c.muted, fontSize: 8, fontWeight: 'bold' }}>{'OVERVIEW'}</Text>
                <Text style={{ color: c.text, fontSize: 10 }}>{overview}</Text>

                <HorizontalDivider />

                {/* ── Usage ── */}
                <Text style={{ color: c.muted, fontSize: 8, fontWeight: 'bold' }}>{'USAGE'}</Text>
                <CodeBlock language="tsx" fontSize={9} code={usageCode} />

                <HorizontalDivider />

                {/* ── Behavior (critical rules) ── */}
                {criticalRules.length > 0 && (
                  <>
                    <Text style={{ color: c.muted, fontSize: 8, fontWeight: 'bold' }}>{'BEHAVIOR'}</Text>
                    <Box style={{ gap: 4 }}>
                      {criticalRules.map((rule, i) => (
                        <Text key={i} style={{ color: c.text, fontSize: 10 }}>{rule}</Text>
                      ))}
                    </Box>
                    <HorizontalDivider />
                  </>
                )}

                {/* ── Props ── */}
                {props.length > 0 && (
                  <>
                    <Text style={{ color: c.muted, fontSize: 8, fontWeight: 'bold' }}>{'PROPS'}</Text>
                    <Box style={{ flexDirection: 'row', gap: 8 }}>
                      <Box style={{ flexGrow: 1, flexBasis: 0, gap: 2 }}>
                        {col1.map(([prop, type]) => (
                          <Box key={prop} style={{ flexDirection: 'row', gap: 4 }}>
                            <Text style={{ color: c.text, fontSize: 9 }}>{prop}</Text>
                            <Text style={{ color: c.muted, fontSize: 9 }}>{type}</Text>
                          </Box>
                        ))}
                      </Box>
                      <Box style={{ flexGrow: 1, flexBasis: 0, gap: 2 }}>
                        {col2.map(([prop, type]) => (
                          <Box key={prop} style={{ flexDirection: 'row', gap: 4 }}>
                            <Text style={{ color: c.text, fontSize: 9 }}>{prop}</Text>
                            <Text style={{ color: c.muted, fontSize: 9 }}>{type}</Text>
                          </Box>
                        ))}
                      </Box>
                    </Box>
                  </>
                )}

                {/* ── Callbacks ── */}
                {callbacks.length > 0 && (
                  <>
                    <HorizontalDivider />
                    <Text style={{ color: c.muted, fontSize: 8, fontWeight: 'bold' }}>{'CALLBACKS'}</Text>
                    <Box style={{ gap: 2 }}>
                      {callbacks.map(([name, sig]) => (
                        <Box key={name} style={{ flexDirection: 'row', gap: 4 }}>
                          <Text style={{ color: c.text, fontSize: 9 }}>{name}</Text>
                          <Text style={{ color: c.muted, fontSize: 9 }}>{sig}</Text>
                        </Box>
                      ))}
                    </Box>
                  </>
                )}

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
        <Text style={{ color: c.muted, fontSize: 9 }}>{breadcrumb}</Text>
        <Text style={{ color: c.muted, fontSize: 9 }}>{'/'}</Text>
        <Text style={{ color: c.text, fontSize: 9 }}>{doc?.title ?? 'Component'}</Text>

        <Box style={{ flexGrow: 1 }} />

        <Pressable
          onPress={() => setPlayground(p => !p)}
          style={(state) => ({
            backgroundColor: playground ? c.primary : (state.hovered ? c.surface : c.border),
            paddingLeft: 10,
            paddingRight: 10,
            paddingTop: 3,
            paddingBottom: 3,
            borderRadius: 4,
          })}
        >
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

// ── Default preview (when no custom preview is passed) ───

function DefaultPreview() {
  const custom1 = { backgroundColor: '#3b82f6', borderRadius: 8, padding: 16 };
  const custom2 = { backgroundColor: '#10b981', borderRadius: 12, padding: 10, borderWidth: 2, borderColor: '#065f46' };

  return (
    <>
      <Box style={{ ...custom1, justifyContent: 'center', alignItems: 'center' }} tooltip={styleTooltip(custom1)}>
        <Text style={{ color: 'white', fontSize: 10 }}>{'Styled element'}</Text>
      </Box>

      <Box style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
        <Wireframe label="A" style={{ width: 40, height: 40 }} />
        <Wireframe label="B" style={{ width: 40, height: 40 }} />
      </Box>

      <Box style={{ ...custom2, justifyContent: 'center', alignItems: 'center' }} tooltip={styleTooltip(custom2)}>
        <Text style={{ color: 'white', fontSize: 10 }}>{'Another styled'}</Text>
      </Box>
    </>
  );
}
