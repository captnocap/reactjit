#!/usr/bin/env bash
# scaffold_story.sh — Generate a Layout1-style story file and register it.
#
# Usage:
#   bash scripts/scaffold_story.sh <ComponentName> [section]
#
# Examples:
#   bash scripts/scaffold_story.sh Button Core
#   bash scripts/scaffold_story.sh AudioPlayer Packages
#   bash scripts/scaffold_story.sh ChessBoard Demos
#
# Default section: Core

set -euo pipefail

if [ $# -lt 1 ]; then
  echo "Usage: bash scripts/scaffold_story.sh <ComponentName> [section]"
  echo "  section: Core | Packages | Demos | Stress Test | Dev | Bad Habits | Layouts"
  exit 1
fi

NAME="$1"
SECTION="${2:-Core}"
STORY_DIR="storybook/src/stories"
FILE="${STORY_DIR}/${NAME}Story.tsx"
INDEX="${STORY_DIR}/index.ts"

# Validate section
case "$SECTION" in
  Core|Packages|Demos|"Stress Test"|Dev|"Bad Habits"|Layouts) ;;
  *) echo "Error: Invalid section '$SECTION'. Use: Core | Packages | Demos | Stress Test | Dev | Bad Habits | Layouts"; exit 1 ;;
esac

# Don't overwrite existing
if [ -f "$FILE" ]; then
  echo "Error: $FILE already exists. Edit it directly."
  exit 1
fi

# Generate kebab-case id from PascalCase
ID=$(echo "$NAME" | sed -E 's/([a-z])([A-Z])/\1-\2/g' | tr '[:upper:]' '[:lower:]')

# Write the story file
cat > "$FILE" << 'ENDOFSTORY'
/**
 * STORY_TITLE — Component documentation page.
 *
 * Structure:
 *   Page (100% x 100%)
 *     Header — title + snippet + description (fixed, always visible)
 *     Center — two-column area (flexGrow:1)
 *       Docs mode:       Left=preview wireframe, Right=API reference
 *       Playground mode:  Left=code editor, Right=live preview
 *     Footer — breadcrumbs + playground toggle (fixed, always visible)
 */

import React, { useState, useCallback, useEffect } from 'react';
import { Box, Text, TextEditor, Pressable, ScrollView } from '../../../packages/core/src';
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

// TODO: Replace with actual props for STORY_NAME
const PROPS: [string, string][] = [
  ['style', 'ViewStyle'],
  ['children', 'ReactNode'],
];

// TODO: Replace with actual callbacks for STORY_NAME
const CALLBACKS: [string, string][] = [
  ['onPress', '() => void'],
];

export function STORY_EXPORT() {
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
          {'STORY_NAME'}
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
            {'STORY_SNIPPET'}
          </Text>
        </Box>

        <Box style={{ flexGrow: 1 }} />

        <Text style={{ color: c.muted, fontSize: 10 }}>
          {'STORY_DESCRIPTION'}
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
        <Text style={{ color: c.muted, fontSize: 9 }}>{'STORY_SECTION'}</Text>
        <Text style={{ color: c.muted, fontSize: 9 }}>{'/'}</Text>
        <Text style={{ color: c.text, fontSize: 9 }}>{'STORY_NAME'}</Text>

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
ENDOFSTORY

# Replace placeholders with actual values
sed -i "s/STORY_EXPORT/${NAME}Story/g" "$FILE"
sed -i "s/STORY_TITLE/${NAME}/g" "$FILE"
sed -i "s/STORY_NAME/${NAME}/g" "$FILE"
sed -i "s/STORY_SNIPPET/<${NAME} prop={value} \/>/g" "$FILE"
sed -i "s/STORY_DESCRIPTION/A short description of ${NAME} and what it does./g" "$FILE"
sed -i "s/STORY_SECTION/${SECTION}/g" "$FILE"

# Register in index.ts — add import and story entry
# Add import before the last empty line before exports
IMPORT_LINE="import { ${NAME}Story } from './${NAME}Story';"
if ! grep -q "${NAME}Story" "$INDEX"; then
  # Add import after the last import line
  LAST_IMPORT=$(grep -n "^import " "$INDEX" | tail -1 | cut -d: -f1)
  sed -i "${LAST_IMPORT}a\\${IMPORT_LINE}" "$INDEX"

  # Add story entry before the closing ];
  ENTRY="  { id: '${ID}', title: '${NAME}', section: '${SECTION}', component: ${NAME}Story },"
  sed -i "/^];$/i\\${ENTRY}" "$INDEX"
fi

echo "Created: $FILE"
echo "Registered: id='${ID}', section='${SECTION}'"
echo ""
echo "Next steps:"
echo "  1. Edit PROPS and CALLBACKS arrays with real prop definitions"
echo "  2. Replace the Wireframe preview with a real component demo"
echo "  3. Update STARTER_CODE with a relevant playground example"
echo "  4. Update the header description text"
