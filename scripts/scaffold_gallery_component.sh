#!/usr/bin/env bash
# scaffold_gallery_component.sh — Add a component to the Component Gallery.
#
# Usage:
#   bash scripts/scaffold_gallery_component.sh <ComponentName> [package]
#
# Examples:
#   bash scripts/scaffold_gallery_component.sh Avatar core
#   bash scripts/scaffold_gallery_component.sh Waveform controls
#   bash scripts/scaffold_gallery_component.sh Heatmap data
#
# This script:
#   1. Appends a Thumb<Name> stub component to GalleryComponents.tsx
#   2. Appends a Preview<Name> stub component to GalleryComponents.tsx
#   3. Appends a register() call that wires them together
#
# Default package: core

set -euo pipefail

if [ $# -lt 1 ]; then
  echo "Usage: bash scripts/scaffold_gallery_component.sh <ComponentName> [package]"
  echo "  package: core | controls | chemistry | finance | time | ai | data | apis"
  exit 1
fi

NAME="$1"
PKG="${2:-core}"
FILE="storybook/src/stories/GalleryComponents.tsx"

# Derive lowercase id from PascalCase name
ID=$(echo "$NAME" | sed 's/\([A-Z]\)/_\L\1/g' | sed 's/^_//')

# Check file exists
if [ ! -f "$FILE" ]; then
  echo "Error: $FILE not found. Run from repo root."
  exit 1
fi

# Check if already registered
if grep -q "id: '${ID}'" "$FILE"; then
  echo "Component '${ID}' is already registered in the gallery."
  exit 0
fi

# Find the last register() call and append after it
# We append the Thumb, Preview, and register() call at the end of the file

cat >> "$FILE" << ENDOFBLOCK

// ── ${NAME} ──────────────────────────────────────────

function Thumb${NAME}({ c }: { c: Record<string, string> }) {
  return (
    <Box style={{ width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center', backgroundColor: c.surface }}>
      <Text style={{ fontSize: 8, color: c.muted }}>{'${NAME}'}</Text>
    </Box>
  );
}

function Preview${NAME}({ c }: { c: Record<string, string> }) {
  return (
    <Box style={{ width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center', padding: 20 }}>
      <Text style={{ fontSize: 14, color: c.text }}>{'${NAME} Preview'}</Text>
      <Text style={{ fontSize: 10, color: c.muted }}>{'TODO: Replace with live demo'}</Text>
    </Box>
  );
}

register({ id: '${ID}', label: '${NAME}', pkg: '${PKG}',
  desc: 'TODO: describe ${NAME}',
  usage: \`<${NAME} />\`,
  props: [],
  callbacks: [],
  thumb: (c) => <Thumb${NAME} c={c} />, preview: (c) => <Preview${NAME} c={c} />,
});
ENDOFBLOCK

echo "✓ Added ${NAME} to Component Gallery (id: '${ID}', pkg: '${PKG}')"
echo "  Edit $FILE to fill in the Thumb/Preview components and metadata."
