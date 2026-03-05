#!/usr/bin/env bash
# scaffold_package_story.sh — Generate a Layout2-based package/hook documentation story.
#
# Usage:
#   bash scripts/scaffold_package_story.sh <PackageName> [section]
#
# Examples:
#   bash scripts/scaffold_package_story.sh Privacy Packages
#   bash scripts/scaffold_package_story.sh Storage Packages
#   bash scripts/scaffold_package_story.sh AudioSynth Packages
#
# Default section: Packages

set -euo pipefail

if [ $# -lt 1 ]; then
  echo "Usage: bash scripts/scaffold_package_story.sh <PackageName> [section]"
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
 * __NAME__ — Package documentation page (Layout2 zigzag narrative).
 *
 * Uses Band/Half/HeroBand/CalloutBand/Divider/SectionLabel from StoryScaffold.
 * Those components enforce alignment — both columns always start at (0,0).
 *
 * TEMPLATE: Replace all placeholder content with real package docs.
 * Static hoist ALL code strings and style objects outside the component.
 */

import React from 'react';
import { Box, Text, Image, ScrollView, CodeBlock } from '../../../packages/core/src';
import { useThemeColors } from '../../../packages/theme/src';
import { Band, Half, HeroBand, CalloutBand, Divider, SectionLabel } from './_shared/StoryScaffold';

// ── Palette ──────────────────────────────────────────────

const C = {
  accent: '#8b5cf6',
  accentDim: 'rgba(139, 92, 246, 0.12)',
  callout: 'rgba(59, 130, 246, 0.08)',
  calloutBorder: 'rgba(59, 130, 246, 0.25)',
};

// ── Static code blocks (hoisted — never recreated) ──────

const INSTALL_CODE = `import { use__NAME__ } from '@reactjit/__PKG__'`;

const BASIC_CODE = `const result = use__NAME__()

// TODO: Replace with real usage
return <Text>{result}</Text>`;

const ADVANCED_CODE = `// TODO: Replace with real advanced usage
const [state, actions] = use__NAME__({
  option: true,
})`;

const OPTIONS_CODE = `// TODO: Replace with real options
use__NAME__({
  cache: true,
  ttl: 5000,
})`;

// ── __NAME__Story ─────────────────────────────────────────

export function __NAME__Story() {
  const c = useThemeColors();

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
        <Text style={{ color: c.muted, fontSize: 10 }}>
          {'TODO: Package description'}
        </Text>
      </Box>

      {/* ── Center ── */}
      <ScrollView style={{ flexGrow: 1 }}>

        {/* ── Hero band ── */}
        <HeroBand accentColor={C.accent}>
          <Text style={{ color: c.text, fontSize: 13, fontWeight: 'bold' }}>
            {'TODO: One-liner pitch for the package.'}
          </Text>
          <Text style={{ color: c.muted, fontSize: 10 }}>
            {'TODO: 1-2 sentence overview of what the package provides.'}
          </Text>
        </HeroBand>

        <Divider />

        {/* ── text | code — INSTALL ── */}
        <Band>
          <Half>
            <SectionLabel icon="download" accentColor={C.accent}>{'INSTALL'}</SectionLabel>
            <Text style={{ color: c.text, fontSize: 10 }}>
              {'TODO: Describe import and setup.'}
            </Text>
          </Half>
          <CodeBlock language="tsx" fontSize={9} code={INSTALL_CODE} />
        </Band>

        <Divider />

        {/* ── code | text — BASIC USAGE (zigzag) ── */}
        <Band>
          <CodeBlock language="tsx" fontSize={9} code={BASIC_CODE} />
          <Half>
            <SectionLabel icon="code" accentColor={C.accent}>{'BASIC USAGE'}</SectionLabel>
            <Text style={{ color: c.text, fontSize: 10 }}>
              {'TODO: Explain the basic usage pattern.'}
            </Text>
          </Half>
        </Band>

        <Divider />

        {/* ── Callout ── */}
        <CalloutBand borderColor={C.calloutBorder} bgColor={C.callout}>
          <Image src="info" style={{ width: 12, height: 12 }} tintColor={C.calloutBorder} />
          <Text style={{ color: c.text, fontSize: 10 }}>
            {'TODO: Key insight or gotcha about this package.'}
          </Text>
        </CalloutBand>

        <Divider />

        {/* ── text | code — ADVANCED ── */}
        <Band>
          <Half>
            <SectionLabel icon="zap" accentColor={C.accent}>{'ADVANCED'}</SectionLabel>
            <Text style={{ color: c.text, fontSize: 10 }}>
              {'TODO: Describe advanced features or patterns.'}
            </Text>
          </Half>
          <CodeBlock language="tsx" fontSize={9} code={ADVANCED_CODE} />
        </Band>

        <Divider />

        {/* ── code | text — OPTIONS (zigzag) ── */}
        <Band>
          <CodeBlock language="tsx" fontSize={9} code={OPTIONS_CODE} />
          <Half>
            <SectionLabel icon="settings" accentColor={C.accent}>{'OPTIONS'}</SectionLabel>
            <Text style={{ color: c.text, fontSize: 10 }}>
              {'TODO: Describe configuration options.'}
            </Text>
          </Half>
        </Band>

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
        <Image src="package" style={{ width: 12, height: 12 }} tintColor={c.text} />
        <Text style={{ color: c.text, fontSize: 9 }}>{'__NAME__'}</Text>
        <Box style={{ flexGrow: 1 }} />
        <Text style={{ color: c.muted, fontSize: 9 }}>{'v0.1.0'}</Text>
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
echo "Next: Fill in TODO placeholders with real package content."
