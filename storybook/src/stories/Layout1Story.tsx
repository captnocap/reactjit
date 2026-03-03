/**
 * Layout 1 — Component documentation page template.
 *
 * Structure:
 *   Page (100% x 100%)
 *     Header — title + snippet + description (fixed, always visible)
 *     Center — two-column area (flexGrow:1)
 *       Docs mode:       Left=preview wireframe, Right=API reference
 *       Playground mode:  Left=code editor, Right=live preview
 *     Footer — breadcrumbs + playground toggle (fixed ~5-10%, always visible)
 */

import React, { useState, useCallback, useEffect } from 'react';
import { Box, Text, TextEditor, CodeBlock, Pressable, ScrollView } from '../../../packages/core/src';
import { useThemeColors } from '../../../packages/theme/src';
import { transformJSX } from '../playground/lib/jsx-transform';
import { evalComponent } from '../playground/lib/eval-component';
import { Preview } from '../playground/Preview';

function Wireframe({ label, style }: { label: string; style?: any }) {
  const c = useThemeColors();
  return (
    <Box style={{
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 6,
      // rjit-ignore-next-line
      borderStyle: 'dashed',
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
  return (
    <Box style={{ height: 1, flexShrink: 0, backgroundColor: c.border }} />
  );
}

function VerticalDivider() {
  const c = useThemeColors();
  return (
    <Box style={{ width: 1, flexShrink: 0, alignSelf: 'stretch', backgroundColor: c.border }} />
  );
}

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

// Short props — fit in 2 columns
const PROPS: [string, string][] = [
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

// Callbacks — full width, single column
const CALLBACKS: [string, string][] = [
  ['onPress', '() => void'],
  ['onHoverIn', '() => void'],
  ['onHoverOut', '() => void'],
  ['onLayout', '(e) => void'],
];

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

  // Process starter code when entering playground mode
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
    <Box style={{
      width: '100%',
      height: '100%',
      backgroundColor: c.bg,
    }}>

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
          {'Title'}
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
            {'<Component prop={value} />'}
          </Text>
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
            {/* Playground: editor left, preview right */}
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
            {/* Docs: preview left, API reference right */}
            <ScrollView style={{ flexGrow: 1, flexBasis: 0 }}>
              <Box style={{
                flexGrow: 1,
                justifyContent: 'center',
                alignItems: 'center',
                padding: 20,
              }}>
                <Wireframe label="Preview" style={{ width: 120, height: 120 }} />
              </Box>
            </ScrollView>

            <VerticalDivider />

            <ScrollView style={{ flexGrow: 1, flexBasis: 0 }}>
              <Box style={{ padding: 14, gap: 10 }}>

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
                <CodeBlock
                  language="tsx"
                  fontSize={9}
                  code={'<Component\n  propA="value"\n  propB={123}\n>\n  <Child />\n</Component>'}
                />

                <HorizontalDivider />

                {/* ── Behavior ── */}
                <Text style={{ color: c.muted, fontSize: 8, fontWeight: 'bold' }}>
                  {'BEHAVIOR'}
                </Text>
                <Box style={{ gap: 4 }}>
                  <Text style={{ color: c.text, fontSize: 10 }}>
                    {'First behavioral note about the component.'}
                  </Text>
                  <Text style={{ color: c.text, fontSize: 10 }}>
                    {'Second behavioral note about the component.'}
                  </Text>
                  <Text style={{ color: c.text, fontSize: 10 }}>
                    {'Third behavioral note about the component.'}
                  </Text>
                </Box>

                <HorizontalDivider />

                {/* ── Props ── */}
                <Text style={{ color: c.muted, fontSize: 8, fontWeight: 'bold' }}>
                  {'PROPS'}
                </Text>
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

                <HorizontalDivider />

                <Text style={{ color: c.muted, fontSize: 8, fontWeight: 'bold' }}>
                  {'CALLBACKS'}
                </Text>
                <Box style={{ gap: 2 }}>
                  {CALLBACKS.map(([name, sig]) => (
                    <Box key={name} style={{ flexDirection: 'row', gap: 4 }}>
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
        <Text style={{ color: c.muted, fontSize: 9 }}>{'Core'}</Text>
        <Text style={{ color: c.muted, fontSize: 9 }}>{'/'}</Text>
        <Text style={{ color: c.text, fontSize: 9 }}>{'Component'}</Text>

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
