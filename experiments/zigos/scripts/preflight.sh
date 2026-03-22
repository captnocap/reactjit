#!/usr/bin/env bash
# preflight.sh — Dependency-aware preflight check for .tsz entry points.
#
# Triggered on .tsz file saves (via Claude Code hook or manually).
# Determines which entry points are affected, runs `zigos-compiler check`
# on each, and writes per-entry-point cache files to .tsz-preflight/.
#
# Usage:
#   ./scripts/preflight.sh <file.tsz>         # check entry points affected by this file
#   ./scripts/preflight.sh --all              # check all entry points in all carts
#   ./scripts/preflight.sh --entry <file.tsz>  # check a specific entry point directly
#
# Cache format (.tsz-preflight/<cart>.json):
#   { "entry_point", "status", "checked_at", "dependencies": {path: mtime},
#     "root_cause", "errors": [...], "warnings": [...] }
#
# Exit codes:
#   0 = all checked entry points pass
#   1 = at least one entry point has errors

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
COMPILER="$ROOT/zig-out/bin/zigos-compiler"
CACHE_DIR="$ROOT/.tsz-preflight"

mkdir -p "$CACHE_DIR"

# ── Helpers ──────────────────────────────────────────────────────

die() { echo "preflight: $*" >&2; exit 2; }

# Classify a .tsz file — mirrors cli.zig's classifyFile
classify() {
    local f="$1"
    case "$f" in
        *_clsmod.tsz) echo "mod_cls" ;;
        *_cmod.tsz)   echo "mod_comp" ;;
        *_cls.tsz)    echo "app_cls" ;;
        *_script.tsz) echo "script" ;;
        *_c.tsz)      echo "app_comp" ;;
        *.c.tsz)      echo "app_comp" ;;
        *.mod.tsz)    echo "module" ;;
        *.script.tsz) echo "script" ;;
        *.cls.tsz)    echo "app_cls" ;;
        *.tsz)        echo "app" ;;
        *)            echo "unknown" ;;
    esac
}

# Is this file an entry point? (app or module)
is_entry_point() {
    local kind
    kind=$(classify "$1")
    [[ "$kind" == "app" || "$kind" == "module" ]]
}

# Find all entry point .tsz files in a cart directory
find_entry_points() {
    local dir="$1"
    for f in "$dir"/*.tsz; do
        [[ -f "$f" ]] || continue
        if is_entry_point "$f"; then
            echo "$f"
        fi
    done
}

# Find entry points affected by a given file.
# Strategy: if the file IS an entry point, check it.
# Otherwise, find all entry points in the same directory (cart)
# and check which ones have the file in their cached dependency set.
# If no cache exists, check all entry points in the directory.
find_affected_entry_points() {
    local file="$1"
    local dir
    dir=$(dirname "$file")

    if is_entry_point "$file"; then
        echo "$file"
        return
    fi

    # Component file — check all entry points in the same cart directory.
    # This is always correct and fast (1-3 entry points per cart).
    find_entry_points "$dir"
}

# Check if cached preflight is still valid (all dep mtimes match)
is_cache_valid() {
    local cache_file="$1"
    [[ -f "$cache_file" ]] || return 1

    python3 -c "
import json, os, sys
data = json.load(open(sys.argv[1]))
deps = data.get('dependencies', {})
if not deps:
    sys.exit(1)
for path, cached_mtime in deps.items():
    try:
        current_mtime = int(os.path.getmtime(path))
    except OSError:
        sys.exit(1)  # file deleted
    if current_mtime != cached_mtime:
        sys.exit(1)  # file modified since check
sys.exit(0)
" "$cache_file"
}

# Run compiler check and write cache
run_check() {
    local entry_point="$1"
    local basename
    basename=$(basename "$entry_point" .tsz)
    local cart_dir
    cart_dir=$(basename "$(dirname "$entry_point")")
    local cache_file="$CACHE_DIR/${cart_dir}_${basename}.json"

    # Check cache validity
    if is_cache_valid "$cache_file"; then
        local status
        status=$(python3 -c "import json; print(json.load(open('$cache_file'))['status'])")
        if [[ "$status" == "ok" ]]; then
            echo "  [cached] $entry_point: OK"
            return 0
        else
            # Cached error — still report it
            local diag
            diag=$(python3 -c "
import json
data = json.load(open('$cache_file'))
for e in data.get('errors', []):
    print(f\"  {e}\")
" 2>/dev/null)
            echo "  [cached] $entry_point: ERROR"
            [[ -n "$diag" ]] && echo "$diag"
            return 1
        fi
    fi

    # Run the compiler check
    if [[ ! -x "$COMPILER" ]]; then
        echo "  [skip] Compiler not built ($COMPILER)" >&2
        return 2
    fi

    local output
    local exit_code=0
    output=$("$COMPILER" check "$entry_point" 2>&1) || exit_code=$?

    # Parse structured output
    local deps=()
    local errors=()
    local warnings=()
    local status="ok"

    while IFS= read -r line; do
        case "$line" in
            PREFLIGHT:DEP:*)     deps+=("${line#PREFLIGHT:DEP:}") ;;
            PREFLIGHT:ERROR:*)   errors+=("${line#PREFLIGHT:ERROR:}"); status="error" ;;
            PREFLIGHT:WARN:*)    warnings+=("${line#PREFLIGHT:WARN:}") ;;
            PREFLIGHT:STATUS:ERROR) status="error" ;;
            PREFLIGHT:STATUS:OK)    ;; # already default
        esac
    done <<< "$output"

    # Handle import boundary violations (hard exit from compiler, no STATUS line)
    if [[ "$exit_code" -ne 0 && "$status" == "ok" ]]; then
        status="error"
        errors+=("compiler exited with code $exit_code (possible import boundary violation)")
    fi

    # Write cache — use Python for clean JSON
    python3 -c "
import json, os, sys, datetime

entry_point = sys.argv[1]
status = sys.argv[2]
cache_file = sys.argv[3]

# Parse deps, errors, warnings from remaining args
sep1 = sys.argv.index('--ERRORS--')
sep2 = sys.argv.index('--WARNINGS--')
dep_paths = sys.argv[4:sep1]
error_strs = sys.argv[sep1+1:sep2]
warning_strs = sys.argv[sep2+1:]

# Build dependency mtime map
dep_mtimes = {}
for p in dep_paths:
    try:
        dep_mtimes[p] = int(os.path.getmtime(p))
    except OSError:
        dep_mtimes[p] = 0

# Find root cause (first error's file)
root_cause = None
if error_strs:
    parts = error_strs[0].split(':')
    if len(parts) >= 1:
        root_cause = parts[0]

data = {
    'entry_point': entry_point,
    'status': status,
    'checked_at': datetime.datetime.now().isoformat(),
    'root_cause': root_cause,
    'dependencies': dep_mtimes,
    'errors': error_strs,
    'warnings': warning_strs,
}
with open(cache_file, 'w') as f:
    json.dump(data, f, indent=2)
    f.write('\n')
" "$entry_point" "$status" "$cache_file" \
    "${deps[@]+"${deps[@]}"}" \
    "--ERRORS--" "${errors[@]+"${errors[@]}"}" \
    "--WARNINGS--" "${warnings[@]+"${warnings[@]}"}"

    # Report
    if [[ "$status" == "ok" ]]; then
        local warn_count=${#warnings[@]}
        if [[ "$warn_count" -gt 0 ]]; then
            echo "  $entry_point: OK ($warn_count warning(s))"
        else
            echo "  $entry_point: OK"
        fi
        return 0
    else
        echo "  $entry_point: ERROR"
        for e in "${errors[@]}"; do
            echo "    $e"
        done
        return 1
    fi
}

# ── Main ─────────────────────────────────────────────────────────

if [[ $# -lt 1 ]]; then
    echo "Usage: preflight.sh <file.tsz> | --all | --entry <file.tsz>"
    exit 2
fi

cd "$ROOT"

mode="$1"
overall_exit=0

case "$mode" in
    --all)
        echo "Preflight: checking all carts..."
        for cart_dir in carts/*/; do
            [[ -d "$cart_dir" ]] || continue
            cart_dir="${cart_dir%/}"  # strip trailing slash
            for ep in $(find_entry_points "$cart_dir"); do
                run_check "$ep" || overall_exit=1
            done
        done
        ;;

    --entry)
        [[ $# -ge 2 ]] || die "--entry requires a file path"
        run_check "$2" || overall_exit=1
        ;;

    *)
        # File path — find affected entry points
        file="$1"
        [[ -f "$file" ]] || die "file not found: $file"
        echo "Preflight: checking entry points affected by $(basename "$file")..."
        affected=$(find_affected_entry_points "$file")
        if [[ -z "$affected" ]]; then
            echo "  No entry points found for $(basename "$file")"
            exit 0
        fi
        while IFS= read -r ep; do
            run_check "$ep" || overall_exit=1
        done <<< "$affected"
        ;;
esac

exit $overall_exit
