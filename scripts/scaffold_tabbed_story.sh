#!/usr/bin/env bash
# scaffold_tabbed_story.sh — Generate a Layout3-based tabbed multi-component story.
#
# Usage:
#   bash scripts/scaffold_tabbed_story.sh <PackageName> [section]
#
# Examples:
#   bash scripts/scaffold_tabbed_story.sh Effects Packages
#   bash scripts/scaffold_tabbed_story.sh Masks Packages
#   bash scripts/scaffold_tabbed_story.sh Charts Packages
#
# Default section: Packages

set -euo pipefail

if [ $# -lt 1 ]; then
  echo "Usage: bash scripts/scaffold_tabbed_story.sh <PackageName> [section]"
  echo "  section: Core | Packages | Demos | Stress Test | Dev | Bad Habits | Layouts"
  exit 1
fi

NAME="$1"
SECTION="${2:-Packages}"
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

# Generate lowercase package name
PKG=$(echo "$NAME" | tr '[:upper:]' '[:lower:]')

cat > "$FILE" << 'ENDOFTEMPLATE'
/**
 * __NAME__ — Tabbed multi-component showcase (Layout3).
 *
 * Structure:
 *   Header   — package title + badge + description
 *   Preview  — open canvas area for the active tab (flexGrow: 1)
 *   Info row — horizontal strip: description | code example | props
 *   Tab bar  — clickable tabs (one per component)
 *   Footer   — breadcrumbs with "N of M" counter
 *
 * The TABS array drives everything. Each entry is one tab in the bar.
 * Clicking a tab swaps the preview, description, usage, and props.
 *
 * Fill in every TODO: marker below with real content from the package.
 */

import React, { useState } from 'react';
import { Box, Text, Image, Pressable, ScrollView, CodeBlock } from '../../../packages/core/src';
import { useThemeColors } from '../../../packages/theme/src';

// ── Palette ──────────────────────────────────────────────

const C = {
  accent: '#8b5cf6',
  accentDim: 'rgba(139, 92, 246, 0.12)',
  selected: 'rgba(139, 92, 246, 0.2)',
};

// ── Tabs ─────────────────────────────────────────────────
// Each tab represents one component/feature in the package.
// The tab bar at the bottom switches between them.
//
// TODO: Replace these placeholder tabs with real components
// from packages/__PKG__/src/. Read each component's source
// to get real props, types, callbacks, and usage examples.

interface TabDef {
  id: string;
  label: string;
  icon: string;
  desc: string;
  usage: string;
  props: [string, string, string][]; // [name, type, icon]
  callbacks: [string, string, string][];
  panels: string[]; // preview panel labels — 1 = single, 3 = triple split
}

const TABS: TabDef[] = [
  {
    id: 'todo-component-a',
    label: 'TODO: ComponentA',
    icon: 'box',
    desc: 'TODO: Description of the first component in this package.',
    usage: `TODO: Real usage example
<ComponentA prop={value} />`,
    props: [
      ['TODO: propName', 'type', 'circle'],
    ],
    callbacks: [],
    panels: ['Preview'],
  },
  {
    id: 'todo-component-b',
    label: 'TODO: ComponentB',
    icon: 'box',
    desc: 'TODO: Description of the second component in this package.',
    usage: `TODO: Real usage example
<ComponentB prop={value} />`,
    props: [
      ['TODO: propName', 'type', 'circle'],
    ],
    callbacks: [],
    panels: ['Preview'],
  },
  {
    id: 'todo-component-c',
    label: 'TODO: ComponentC',
    icon: 'box',
    desc: 'TODO: Description of the third component in this package.',
    usage: `TODO: Real usage example
<ComponentC prop={value} />`,
    props: [
      ['TODO: propName', 'type', 'circle'],
    ],
    callbacks: [],
    panels: ['Preview'],
  },
];

// ── Helpers ──────────────────────────────────────────────

function HorizontalDivider() {
  const c = useThemeColors();
  return <Box style={{ height: 1, flexShrink: 0, backgroundColor: c.border }} />;
}

function VerticalDivider() {
  const c = useThemeColors();
  return <Box style={{ width: 1, flexShrink: 0, alignSelf: 'stretch', backgroundColor: c.border }} />;
}

// ── __NAME__Story ─────────────────────────────────────────

export function __NAME__Story() {
  const c = useThemeColors();
  const [activeId, setActiveId] = useState(TABS[0].id);
  const tab = TABS.find(it => it.id === activeId) || TABS[0];

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
        {/* TODO: Change "package" to an icon that represents this package */}
        <Image src="package" style={{ width: 18, height: 18 }} tintColor={C.accent} />
        <Text style={{ color: c.text, fontSize: 20, fontWeight: 'bold' }}>
          {'__NAME__'}
        </Text>
        <Box style={{
          backgroundColor: C.accentDim,
          borderRadius: 4,
          paddingLeft: 8,
          paddingRight: 8,
          paddingTop: 3,
          paddingBottom: 3,
        }}>
          <Text style={{ color: C.accent, fontSize: 10 }}>{'@reactjit/__PKG__'}</Text>
        </Box>
        <Box style={{ flexGrow: 1 }} />
        {/* TODO: Change to a one-liner describing this package */}
        <Text style={{ color: c.muted, fontSize: 10 }}>
          {'TODO: Package description'}
        </Text>
      </Box>

      {/* ── Preview area — splits into N panels based on tab.panels ── */}
      <Box style={{ flexGrow: 1, flexDirection: 'row' }}>
        {tab.panels.map((label, i) => (
          <React.Fragment key={label}>
            {i > 0 && <VerticalDivider />}
            <Box style={{
              flexGrow: 1,
              flexBasis: 0,
              justifyContent: 'center',
              alignItems: 'center',
              gap: 8,
            }}>
              <Box style={{
                width: 64,
                height: 64,
                backgroundColor: c.surface,
                borderRadius: 8,
                borderWidth: 1,
                borderColor: c.border,
                justifyContent: 'center',
                alignItems: 'center',
              }}>
                <Image src={tab.icon} style={{ width: 28, height: 28 }} tintColor={C.accent} />
              </Box>
              <Text style={{ color: c.muted, fontSize: 8 }}>{label}</Text>
            </Box>
          </React.Fragment>
        ))}
      </Box>

      {/* ── Info row — description | code | props ── */}
      <Box style={{
        height: 120,
        flexShrink: 0,
        flexDirection: 'row',
        borderTopWidth: 1,
        borderColor: c.border,
        backgroundColor: c.bgElevated,
        overflow: 'hidden',
      }}>

        {/* ── Description ── */}
        <Box style={{ flexGrow: 1, flexBasis: 0, padding: 12, gap: 6 }}>
          <Text style={{ color: c.text, fontSize: 14, fontWeight: 'bold' }}>
            {tab.label}
          </Text>
          <Text style={{ color: c.muted, fontSize: 10 }}>
            {tab.desc}
          </Text>
        </Box>

        <VerticalDivider />

        {/* ── Usage code ── */}
        <Box style={{ flexGrow: 1, flexBasis: 0, padding: 12, gap: 6 }}>
          <Text style={{ color: c.muted, fontSize: 8, fontWeight: 'bold', letterSpacing: 1 }}>
            {'USAGE'}
          </Text>
          <CodeBlock language="tsx" fontSize={9} code={tab.usage} />
        </Box>

        <VerticalDivider />

        {/* ── Props + callbacks ── */}
        <Box style={{ flexGrow: 1, flexBasis: 0, padding: 12, gap: 6 }}>
          <Text style={{ color: c.muted, fontSize: 8, fontWeight: 'bold', letterSpacing: 1 }}>
            {'PROPS'}
          </Text>
          <Box style={{ gap: 3 }}>
            {tab.props.map(([name, type, icon]) => (
              <Box key={name} style={{ flexDirection: 'row', gap: 5, alignItems: 'center' }}>
                <Image src={icon} style={{ width: 10, height: 10 }} tintColor={c.muted} />
                <Text style={{ color: c.text, fontSize: 9 }}>{name}</Text>
                <Text style={{ color: c.muted, fontSize: 9 }}>{type}</Text>
              </Box>
            ))}
          </Box>
          {tab.callbacks.length > 0 && (
            <>
              <HorizontalDivider />
              <Text style={{ color: c.muted, fontSize: 8, fontWeight: 'bold', letterSpacing: 1 }}>
                {'CALLBACKS'}
              </Text>
              <Box style={{ gap: 3 }}>
                {tab.callbacks.map(([name, sig, icon]) => (
                  <Box key={name} style={{ flexDirection: 'row', gap: 5, alignItems: 'center' }}>
                    <Image src={icon} style={{ width: 10, height: 10 }} tintColor={c.muted} />
                    <Text style={{ color: c.text, fontSize: 9 }}>{name}</Text>
                    <Text style={{ color: c.muted, fontSize: 9 }}>{sig}</Text>
                  </Box>
                ))}
              </Box>
            </>
          )}
        </Box>

      </Box>

      {/* ── Tab bar — switches the active component shown above ── */}
      <ScrollView style={{
        height: 86,
        flexShrink: 0,
        borderTopWidth: 1,
        borderColor: c.border,
        backgroundColor: c.bgElevated,
      }}>
          <Box style={{
            flexDirection: 'row',
            flexWrap: 'wrap',
            justifyContent: 'center',
            paddingLeft: 8,
            paddingRight: 8,
            paddingTop: 8,
            paddingBottom: 8,
            gap: 8,
          }}>
            {TABS.map(comp => {
              const active = comp.id === activeId;
              return (
                <Pressable key={comp.id} onPress={() => setActiveId(comp.id)}>
                  <Box style={{
                    width: 50,
                    height: 50,
                    backgroundColor: active ? C.selected : c.surface,
                    borderRadius: 6,
                    borderWidth: active ? 2 : 1,
                    borderColor: active ? C.accent : c.border,
                    justifyContent: 'center',
                    alignItems: 'center',
                    gap: 6,
                  }}>
                    <Image src={comp.icon} style={{ width: 16, height: 16 }} tintColor={active ? C.accent : c.muted} />
                    <Text style={{ color: active ? c.text : c.muted, fontSize: 7 }}>
                      {comp.label}
                    </Text>
                  </Box>
                </Pressable>
              );
            })}
          </Box>
      </ScrollView>

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
        <Text style={{ color: c.muted, fontSize: 9 }}>{'__SECTION__'}</Text>
        <Text style={{ color: c.muted, fontSize: 9 }}>{'/'}</Text>
        {/* TODO: Change "package" to match the header icon */}
        <Image src="package" style={{ width: 12, height: 12 }} tintColor={c.muted} />
        <Text style={{ color: c.muted, fontSize: 9 }}>{'__NAME__'}</Text>
        <Text style={{ color: c.muted, fontSize: 9 }}>{'/'}</Text>
        <Image src={tab.icon} style={{ width: 12, height: 12 }} tintColor={c.text} />
        <Text style={{ color: c.text, fontSize: 9 }}>{tab.label}</Text>
        <Box style={{ flexGrow: 1 }} />
        <Text style={{ color: c.muted, fontSize: 9 }}>{`${TABS.indexOf(tab) + 1} of ${TABS.length}`}</Text>
      </Box>

    </Box>
  );
}
ENDOFTEMPLATE

# Replace placeholders in generated file
sed -i "s/__NAME__/${NAME}/g" "$FILE"
sed -i "s/__PKG__/${PKG}/g" "$FILE"
sed -i "s/__SECTION__/${SECTION}/g" "$FILE"

# Register in index.ts — add import and story entry
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
echo "Package: @reactjit/${PKG}"
echo ""
echo "Next steps:"
echo "  1. Read packages/${PKG}/src/ to find real components"
echo "  2. Replace all TODO: markers in the TABS array with real data"
echo "  3. Replace the TODO: markers in the header (icon, description)"
echo "  4. Replace the TODO: marker in the footer (icon)"
echo "  5. Run: make build-storybook-love"
