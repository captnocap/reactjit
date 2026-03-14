#!/usr/bin/env bash
#
# Removes regenerable runtime deps from example projects whose src/
# hasn't been touched in the last 24 hours (configurable via --hours).
#
# What gets removed:  lua/ reactjit/ lib/ bin/ data/ fonts/ dist/ bundle.js
#                     love/bundle.js love/lib/ love/fonts/ love/data/
# What stays:         src/ main.lua conf.lua package.json packaging/ assets/
#                     love/main.lua love/conf.lua tsconfig.json
#
# Usage:
#   ./scripts/clean-dormant-demos.sh              # 24-hour threshold
#   ./scripts/clean-dormant-demos.sh --hours 12   # 12-hour threshold
#   ./scripts/clean-dormant-demos.sh --dry-run    # preview only
#   ./scripts/clean-dormant-demos.sh --all        # clean all, ignore age

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
EXAMPLES_DIR="$REPO_ROOT/examples"
HOURS=24
DRY_RUN=false
CLEAN_ALL=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --hours)  HOURS="$2"; shift 2 ;;
    --dry-run) DRY_RUN=true; shift ;;
    --all)    CLEAN_ALL=true; shift ;;
    *)        echo "Unknown flag: $1"; exit 1 ;;
  esac
done

# Directories and files that are regenerable (removed during cleanup)
CLEAN_TARGETS=(lua reactjit lib bin data fonts dist bundle.js)
LOVE_CLEAN_TARGETS=(bundle.js lib fonts data)

cleaned=0
skipped=0

for project in "$EXAMPLES_DIR"/*/; do
  name="$(basename "$project")"
  src_dir="$project/src"

  # Skip projects without src/
  if [[ ! -d "$src_dir" ]]; then
    continue
  fi

  # Check if src/ has been modified recently
  if [[ "$CLEAN_ALL" == false ]]; then
    newest=$(find "$src_dir" -type f -printf '%T@\n' 2>/dev/null | sort -rn | head -1)
    if [[ -z "$newest" ]]; then
      continue
    fi

    now=$(date +%s)
    age_hours=$(( (now - ${newest%%.*}) / 3600 ))

    if [[ $age_hours -lt $HOURS ]]; then
      skipped=$((skipped + 1))
      echo "  skip  $name (src/ modified ${age_hours}h ago)"
      continue
    fi
  fi

  # Check if there's anything to clean
  has_deps=false
  for target in "${CLEAN_TARGETS[@]}"; do
    if [[ -e "$project/$target" ]]; then
      has_deps=true
      break
    fi
  done
  if [[ -d "$project/love" ]]; then
    for target in "${LOVE_CLEAN_TARGETS[@]}"; do
      if [[ -e "$project/love/$target" ]]; then
        has_deps=true
        break
      fi
    done
  fi

  if [[ "$has_deps" == false ]]; then
    skipped=$((skipped + 1))
    echo "  skip  $name (already clean)"
    continue
  fi

  # Clean it
  if [[ "$DRY_RUN" == true ]]; then
    echo "  would clean  $name"
  else
    for target in "${CLEAN_TARGETS[@]}"; do
      rm -rf "$project/$target"
    done
    if [[ -d "$project/love" ]]; then
      for target in "${LOVE_CLEAN_TARGETS[@]}"; do
        rm -rf "$project/love/$target"
      done
    fi
    echo "  clean  $name"
  fi
  cleaned=$((cleaned + 1))
done

echo ""
if [[ "$DRY_RUN" == true ]]; then
  echo "Dry run: $cleaned would be cleaned, $skipped skipped"
else
  echo "Done: $cleaned cleaned, $skipped skipped"
  if [[ $cleaned -gt 0 ]]; then
    echo "Run 'cd examples/<name> && reactjit update && reactjit build' to restore."
  fi
fi
