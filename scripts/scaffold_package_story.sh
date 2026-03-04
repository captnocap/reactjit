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
 * TEMPLATE: Replace all placeholder content with real package docs.
 * Static hoist ALL code strings and style objects outside the component.
 */

import React from 'react';
import { Box, Text, Image, ScrollView, CodeBlock } from '../../../packages/core/src';
import { useThemeColors } from '../../../packages/theme/src';

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

// ── Helpers ──────────────────────────────────────────────

function Divider() {
  const c = useThemeColors();
  return <Box style={{ height: 1, flexShrink: 0, backgroundColor: c.border }} />;
}

function SectionLabel({ icon, children }: { icon: string; children: string }) {
  const c = useThemeColors();
  return (
    <Box style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      <Image src={icon} style={{ width: 10, height: 10 }} tintColor={C.accent} />
      <Text style={{ color: c.muted, fontSize: 8, fontWeight: 'bold', letterSpacing: 1 }}>
        {children}
      </Text>
    </Box>
  );
}

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

        {/* ── Hero band: accent stripe + overview ── */}
        <Box style={{
          borderLeftWidth: 3,
          borderColor: C.accent,
          paddingLeft: 25,
          paddingRight: 28,
          paddingTop: 24,
          paddingBottom: 24,
          gap: 8,
        }}>
          <Text style={{ color: c.text, fontSize: 13, fontWeight: 'bold' }}>
            {'TODO: One-liner pitch for the package.'}
          </Text>
          <Text style={{ color: c.muted, fontSize: 10 }}>
            {'TODO: 1-2 sentence overview of what the package provides.'}
          </Text>
        </Box>

        <Divider />

        {/* ── Band: text left | code right ── */}
        <Box style={{
          flexDirection: 'row',
          paddingLeft: 28,
          paddingRight: 28,
          paddingTop: 20,
          paddingBottom: 20,
          gap: 24,
          alignItems: 'start',
        }}>
          <Box style={{ flexGrow: 1, flexBasis: 0, gap: 8, paddingTop: 4 }}>
            <SectionLabel icon="download">{'INSTALL'}</SectionLabel>
            <Text style={{ color: c.text, fontSize: 10 }}>
              {'TODO: Describe import and setup.'}
            </Text>
          </Box>
          <CodeBlock language="tsx" fontSize={9} code={INSTALL_CODE} />
        </Box>

        <Divider />

        {/* ── Band: code left | text right (zigzag) ── */}
        <Box style={{
          flexDirection: 'row',
          paddingLeft: 28,
          paddingRight: 28,
          paddingTop: 20,
          paddingBottom: 20,
          gap: 24,
          alignItems: 'start',
        }}>
          <CodeBlock language="tsx" fontSize={9} code={BASIC_CODE} />
          <Box style={{ flexGrow: 1, flexBasis: 0, gap: 8, paddingTop: 4 }}>
            <SectionLabel icon="code">{'BASIC USAGE'}</SectionLabel>
            <Text style={{ color: c.text, fontSize: 10 }}>
              {'TODO: Explain the basic usage pattern.'}
            </Text>
          </Box>
        </Box>

        <Divider />

        {/* ── Callout band ── */}
        <Box style={{
          backgroundColor: C.callout,
          borderLeftWidth: 3,
          borderColor: C.calloutBorder,
          paddingLeft: 25,
          paddingRight: 28,
          paddingTop: 14,
          paddingBottom: 14,
          flexDirection: 'row',
          gap: 8,
          alignItems: 'center',
        }}>
          <Image src="info" style={{ width: 12, height: 12 }} tintColor={C.calloutBorder} />
          <Text style={{ color: c.text, fontSize: 10 }}>
            {'TODO: Key insight or gotcha about this package.'}
          </Text>
        </Box>

        <Divider />

        {/* ── Band: text left | code right ── */}
        <Box style={{
          flexDirection: 'row',
          paddingLeft: 28,
          paddingRight: 28,
          paddingTop: 20,
          paddingBottom: 20,
          gap: 24,
          alignItems: 'start',
        }}>
          <Box style={{ flexGrow: 1, flexBasis: 0, gap: 8, paddingTop: 4 }}>
            <SectionLabel icon="zap">{'ADVANCED'}</SectionLabel>
            <Text style={{ color: c.text, fontSize: 10 }}>
              {'TODO: Describe advanced features or patterns.'}
            </Text>
          </Box>
          <CodeBlock language="tsx" fontSize={9} code={ADVANCED_CODE} />
        </Box>

        <Divider />

        {/* ── Band: code left | text right (zigzag) ── */}
        <Box style={{
          flexDirection: 'row',
          paddingLeft: 28,
          paddingRight: 28,
          paddingTop: 20,
          paddingBottom: 24,
          gap: 24,
          alignItems: 'start',
        }}>
          <CodeBlock language="tsx" fontSize={9} code={OPTIONS_CODE} />
          <Box style={{ flexGrow: 1, flexBasis: 0, gap: 8, paddingTop: 4 }}>
            <SectionLabel icon="settings">{'OPTIONS'}</SectionLabel>
            <Text style={{ color: c.text, fontSize: 10 }}>
              {'TODO: Describe configuration options.'}
            </Text>
          </Box>
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
