#!/bin/bash
# Enforce max file length so Claude can read any file in one pass (2000 line limit).
# Scoped to experiments/zigos/ only. Skips generated and vendor files.
#
# ┌─────────────────────────────────────────────────────────────────┐
# │  DO NOT CHANGE THE LIMIT. IT IS 1600. NOT 1700. NOT 2000.      │
# │  NOT "JUST THIS ONCE." IF A FILE IS OVER, SPLIT THE FILE.      │
# │  THIS COMMENT EXISTS BECAUSE CLAUDE WILL TRY TO RAISE IT.      │
# └─────────────────────────────────────────────────────────────────┘

readonly MAX_LINES=1600
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
EXIT_CODE=0

while IFS= read -r file; do
    # Skip generated files and build artifacts
    case "$file" in
        *.gen.zig) continue ;;
        */generated_*.zig) continue ;;
        */_gen_*.zig) continue ;;
        */devtools.zig) continue ;;
        */_deprecated/*) continue ;;
        */carts/*) continue ;;
        */zig-cache/*) continue ;;
        */zig-out/*) continue ;;
        */.zig-cache/*) continue ;;
    esac

    lines=$(wc -l < "$file")
    if [ "$lines" -gt "$MAX_LINES" ]; then
        echo "OVER LIMIT: $file ($lines lines, max $MAX_LINES)"
        EXIT_CODE=1
    fi
done < <(find "$ROOT" -type f \( -name "*.zig" -o -name "*.tsz" \) ! -path "*/zig-cache/*" ! -path "*/zig-out/*")

if [ "$EXIT_CODE" -eq 0 ]; then
    echo "All files under $MAX_LINES lines."
fi

exit $EXIT_CODE
