#!/usr/bin/env bash
# scaffold_story.sh — Generate a ComponentDoc-based story file and register it.
#
# Usage:
#   bash scripts/scaffold_story.sh <ComponentName> [section]
#
# Examples:
#   bash scripts/scaffold_story.sh Button Core
#   bash scripts/scaffold_story.sh AudioPlayer Packages
#   bash scripts/scaffold_story.sh ChessBoard Demos
#
# If a matching doc file exists in content/sections/, the story auto-connects
# via docKey. Otherwise it renders with placeholder content.
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

# Generate lowercase docKey from PascalCase
DOC_KEY=$(echo "$NAME" | tr '[:upper:]' '[:lower:]')

# Check if a doc file exists
DOC_EXISTS=""
if ls content/sections/*/"${DOC_KEY}.txt" 1>/dev/null 2>&1; then
  DOC_EXISTS="yes"
fi

# Write the story file
if [ -n "$DOC_EXISTS" ]; then
  cat > "$FILE" << EOF
/**
 * ${NAME} — Component documentation page.
 *
 * Auto-populates docs from content/sections/ via docKey="${DOC_KEY}".
 *
 * TODO: Add a custom preview with icons relevant to ${NAME}.
 *       Use <Image src="icon-name" w={16} h={16} /> for vector icons.
 *       Browse available icons at packages/icons/src/iconNames.ts.
 */

import React from 'react';
import { Box, Text, Image } from '../../../../packages/core/src';
import { useThemeColors } from '../../../../packages/theme/src';
import { ComponentDoc, styleTooltip } from './_shared/ComponentDoc';

export function ${NAME}Story() {
  return <ComponentDoc docKey="${DOC_KEY}" preview={<${NAME}Preview />} />;
}

function ${NAME}Preview() {
  const c = useThemeColors();
  return (
    <>
      <Box style={{
        flexDirection: 'row', alignItems: 'center', gap: 8,
        backgroundColor: c.surface, borderRadius: 8, padding: 12,
        borderWidth: 1, borderColor: c.border,
      }}>
        <Image src="component" w={16} h={16} style={{ color: c.primary }} />
        <Text style={{ color: c.text, fontSize: 11 }}>{'${NAME}'}</Text>
      </Box>
    </>
  );
}
EOF
else
  cat > "$FILE" << EOF
/**
 * ${NAME} — Component documentation page.
 *
 * No doc file found for "${DOC_KEY}". Using placeholder content.
 * To connect docs, create content/sections/05-components/${DOC_KEY}.txt
 * and add docKey="${DOC_KEY}" to the ComponentDoc below.
 *
 * TODO: Add a custom preview with icons relevant to ${NAME}.
 *       Use <Image src="icon-name" w={16} h={16} /> for vector icons.
 *       Browse available icons at packages/icons/src/iconNames.ts.
 */

import React from 'react';
import { Box, Text, Image } from '../../../../packages/core/src';
import { useThemeColors } from '../../../../packages/theme/src';
import { ComponentDoc, styleTooltip } from './_shared/ComponentDoc';

export function ${NAME}Story() {
  return <ComponentDoc preview={<${NAME}Preview />} />;
}

function ${NAME}Preview() {
  const c = useThemeColors();
  return (
    <>
      <Box style={{
        flexDirection: 'row', alignItems: 'center', gap: 8,
        backgroundColor: c.surface, borderRadius: 8, padding: 12,
        borderWidth: 1, borderColor: c.border,
      }}>
        <Image src="component" w={16} h={16} style={{ color: c.primary }} />
        <Text style={{ color: c.text, fontSize: 11 }}>{'${NAME}'}</Text>
      </Box>
    </>
  );
}
EOF
fi

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
if [ -n "$DOC_EXISTS" ]; then
  echo "Docs: connected via docKey=\"${DOC_KEY}\""
else
  echo "Docs: no doc file found — using placeholders"
  echo "  Create content/sections/05-components/${DOC_KEY}.txt to connect docs"
fi
