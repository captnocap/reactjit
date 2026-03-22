#!/usr/bin/env bash
# sync-mod.sh — Sync .tsz (app) sources → module variants
#
# Usage:
#   ./scripts/sync-mod.sh <cart-directory>
#   ./scripts/sync-mod.sh carts/inspector
#
# Source of truth: .c.tsz, _cls.tsz, and entry .tsz files
# Generated:       _cmod.tsz, _clsmod.tsz, and .mod.tsz files
#
# Rules:
#   .c.tsz    → _cmod.tsz    (import paths rewritten)
#   _cls.tsz  → _clsmod.tsz  (verbatim copy)
#   .script.tsz               (shared, untouched)
#   .tsz with @mod-start/end  → .mod.tsz (extract module root, rewrite imports)

set -euo pipefail

CART_DIR="${1:?Usage: sync-mod.sh <cart-directory>}"

# Resolve relative to script location if needed
if [[ ! -d "$CART_DIR" ]]; then
    SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
    CART_DIR="$SCRIPT_DIR/../$CART_DIR"
fi

if [[ ! -d "$CART_DIR" ]]; then
    echo "Error: directory not found: $CART_DIR" >&2
    exit 1
fi

CART_DIR="$(cd "$CART_DIR" && pwd)"
echo "Syncing module variants in: $CART_DIR"

changed=0
skipped=0

# --- 1. Sync .c.tsz → _cmod.tsz (with import rewriting) ---
for src in "$CART_DIR"/*.c.tsz; do
    [[ -f "$src" ]] || continue
    base="$(basename "$src" .c.tsz)"
    dst="$CART_DIR/${base}_cmod.tsz"

    # Rewrite imports:
    #   from './Foo.c'    → from './Foo_cmod'
    #   from './bar_cls'  → from './bar_clsmod'
    result=$(python3 -c "
import re, sys, os
src, dst = sys.argv[1], sys.argv[2]
text = open(src).read()
text = re.sub(r\"from '\./([\w]+)\.c'\", r\"from './\1_cmod'\", text)
text = re.sub(r\"from '\./([\w]+)_cls'\", r\"from './\1_clsmod'\", text)
if os.path.isfile(dst) and open(dst).read() == text:
    print('skip')
else:
    open(dst, 'w').write(text)
    print('wrote')
" "$src" "$dst")

    if [[ "$result" == "skip" ]]; then
        skipped=$((skipped + 1))
    else
        echo "  ✓ ${base}.c.tsz → ${base}_cmod.tsz"
        changed=$((changed + 1))
    fi
done

# --- 2. Sync _cls.tsz → _clsmod.tsz (verbatim) ---
for src in "$CART_DIR"/*_cls.tsz; do
    [[ -f "$src" ]] || continue
    base="$(basename "$src" _cls.tsz)"
    dst="$CART_DIR/${base}_clsmod.tsz"

    if [[ -f "$dst" ]] && diff -q "$src" "$dst" >/dev/null 2>&1; then
        skipped=$((skipped + 1))
    else
        cp "$src" "$dst"
        echo "  ✓ ${base}_cls.tsz → ${base}_clsmod.tsz"
        changed=$((changed + 1))
    fi
done

# --- 3. Sync entry .tsz → .mod.tsz (extract @mod-start/@mod-end block) ---
for src in "$CART_DIR"/*.tsz; do
    [[ -f "$src" ]] || continue
    base="$(basename "$src")"
    # Skip .c.tsz, _cmod.tsz, _cls.tsz, _clsmod.tsz, .script.tsz, .mod.tsz
    [[ "$base" == *.c.tsz ]] && continue
    [[ "$base" == *_cmod.tsz ]] && continue
    [[ "$base" == *_cls.tsz ]] && continue
    [[ "$base" == *_clsmod.tsz ]] && continue
    [[ "$base" == *.script.tsz ]] && continue
    [[ "$base" == *.mod.tsz ]] && continue

    # Only process if file contains @mod-start marker
    grep -q '@mod-start' "$src" || continue

    name="${base%.tsz}"
    dst="$CART_DIR/${name}.mod.tsz"

    result=$(python3 -c "
import re, sys, os

src, dst = sys.argv[1], sys.argv[2]
text = open(src).read()

# Apply import rewrites
text = re.sub(r\"from '\./([\w]+)\.c'\", r\"from './\1_cmod'\", text)
text = re.sub(r\"from '\./([\w]+)_cls'\", r\"from './\1_clsmod'\", text)

lines = text.split('\n')

# Split into preamble (before function App) and body
preamble = []
func_idx = None
for i, line in enumerate(lines):
    if line.startswith('function App()'):
        func_idx = i
        break
    preamble.append(line)

if func_idx is None:
    print('skip')
    sys.exit(0)

# Find @mod-start and @mod-end
mod_start = mod_end = None
for i, line in enumerate(lines):
    if '@mod-start' in line:
        mod_start = i
    elif '@mod-end' in line:
        mod_end = i

if mod_start is None or mod_end is None:
    print('skip')
    sys.exit(0)

# Extract the block between markers
mod_lines = lines[mod_start + 1 : mod_end]

# Find indent of first non-empty line
first_indent = 0
for line in mod_lines:
    if line.strip():
        first_indent = len(line) - len(line.lstrip())
        break

# Target: 4 spaces (inside 'function App() { return ( ... ); }')
indent_diff = first_indent - 4

# De-indent
dedented = []
for line in mod_lines:
    if line.strip():
        if len(line) >= indent_diff and indent_diff > 0:
            dedented.append(line[indent_diff:])
        else:
            dedented.append(line)
    else:
        dedented.append('')

# Build output
out_lines = preamble + ['function App() {', '  return ('] + dedented + ['  );', '}', '']
output = '\n'.join(out_lines)

if os.path.isfile(dst) and open(dst).read() == output:
    print('skip')
else:
    open(dst, 'w').write(output)
    print('wrote')
" "$src" "$dst")

    if [[ "$result" == "skip" ]]; then
        skipped=$((skipped + 1))
    else
        echo "  ✓ ${name}.tsz → ${name}.mod.tsz  (extracted @mod-start block)"
        changed=$((changed + 1))
    fi
done

echo ""
if [[ $changed -eq 0 ]]; then
    echo "All module variants up to date. ($skipped files checked)"
else
    echo "Updated $changed file(s). ($skipped already up to date)"
fi
