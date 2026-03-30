#!/bin/bash
# Conformance hash verification and locking script
# Prevents Claude from editing test files to make them pass
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CONFORMANCE_DIR="$REPO_ROOT/carts/conformance"
HASH_FILE="$CONFORMANCE_DIR/ALL_HASHES.sha256"

# Ensure unified hash file exists — merge legacy files on first run
ensure_hash_file() {
    if [ ! -f "$HASH_FILE" ]; then
        touch "$HASH_FILE"
    fi

    # Merge legacy hash files if they exist and aren't already merged
    for legacy in "$CONFORMANCE_DIR/HASHES.sha256" "$CONFORMANCE_DIR/NEW_TEST_HASHES.sha256"; do
        if [ -f "$legacy" ]; then
            while IFS= read -r line; do
                [ -z "$line" ] && continue
                HASH=$(echo "$line" | awk '{print $1}')
                FILE=$(echo "$line" | awk '{print $2}')
                # Only add if not already present
                if ! grep -q "$FILE" "$HASH_FILE" 2>/dev/null; then
                    echo "$line" >> "$HASH_FILE"
                fi
            done < "$legacy"
        fi
    done

    # Sort for consistency
    if [ -s "$HASH_FILE" ]; then
        sort -k2 "$HASH_FILE" -o "$HASH_FILE"
    fi
}

# Compute SHA256 of a file (just the hash, no filename)
file_hash() {
    sha256sum "$1" | awk '{print $1}'
}

# Check hash for a single test
cmd_hash() {
    local test_name="$1"
    ensure_hash_file

    # Find all matching files (main .tsz, .script.tsz, .cls.tsz)
    local found=0
    local passed=0
    local failed=0
    local unhashed=0

    for ext in ".tsz" ".script.tsz" ".cls.tsz"; do
        local file="$CONFORMANCE_DIR/${test_name}${ext}"
        [ ! -f "$file" ] && continue
        found=$((found + 1))

        local basename="${test_name}${ext}"
        local expected
        expected=$(grep "  ${basename}$" "$HASH_FILE" 2>/dev/null | awk '{print $1}' || true)

        if [ -z "$expected" ]; then
            echo "UNHASHED: $basename (no entry in ALL_HASHES.sha256)"
            unhashed=$((unhashed + 1))
            continue
        fi

        local actual
        actual=$(file_hash "$file")

        if [ "$actual" = "$expected" ]; then
            echo "OK: $basename"
            passed=$((passed + 1))
        else
            echo "TAMPER DETECTED: $basename"
            echo "  Expected: $expected"
            echo "  Actual:   $actual"
            failed=$((failed + 1))
        fi
    done

    if [ $found -eq 0 ]; then
        echo "ERROR: No files found for test '$test_name'"
        exit 1
    fi

    if [ $failed -gt 0 ]; then
        echo ""
        echo "RESULT: FAIL — $failed file(s) have been modified"
        exit 1
    elif [ $unhashed -gt 0 ]; then
        echo ""
        echo "RESULT: WARN — $unhashed file(s) not yet hashed, $passed verified"
        exit 0
    else
        echo ""
        echo "RESULT: PASS — all $passed file(s) verified"
        exit 0
    fi
}

# Lock (hash) a test file
cmd_lock() {
    local filepath="$1"
    ensure_hash_file

    if [ ! -f "$filepath" ]; then
        # Try relative to conformance dir
        filepath="$CONFORMANCE_DIR/$filepath"
    fi

    if [ ! -f "$filepath" ]; then
        echo "ERROR: File not found: $1"
        exit 1
    fi

    # Store path relative to REPO_ROOT so we can find files in any directory
    local relpath
    relpath=$(realpath --relative-to="$REPO_ROOT" "$filepath" 2>/dev/null || echo "$(basename "$filepath")")
    local hash
    hash=$(file_hash "$filepath")

    # Remove old entry if exists (match by basename OR relpath for compat)
    local basename
    basename=$(basename "$filepath")
    if grep -q "  ${relpath}$" "$HASH_FILE" 2>/dev/null; then
        grep -v "  ${relpath}$" "$HASH_FILE" > "${HASH_FILE}.tmp"
        mv "${HASH_FILE}.tmp" "$HASH_FILE"
        echo "UPDATED: $relpath -> $hash"
    elif grep -q "  ${basename}$" "$HASH_FILE" 2>/dev/null; then
        # Upgrade old basename-only entry to relpath
        grep -v "  ${basename}$" "$HASH_FILE" > "${HASH_FILE}.tmp"
        mv "${HASH_FILE}.tmp" "$HASH_FILE"
        echo "UPGRADED: $basename -> $relpath -> $hash"
    else
        echo "LOCKED: $relpath -> $hash"
    fi

    echo "$hash  $relpath" >> "$HASH_FILE"
    sort -k2 "$HASH_FILE" -o "$HASH_FILE"
}

# Verify all hashes
cmd_verify_all() {
    ensure_hash_file

    if [ ! -s "$HASH_FILE" ]; then
        echo "No hashes registered. Run 'lock' on test files first."
        exit 0
    fi

    local total=0
    local passed=0
    local failed=0
    local missing=0

    while IFS= read -r line; do
        [ -z "$line" ] && continue
        total=$((total + 1))

        local expected_hash
        expected_hash=$(echo "$line" | awk '{print $1}')
        local filename
        filename=$(echo "$line" | awk '{print $2}')

        # Try as relative path from repo root first, then fall back to conformance dir
        local filepath="$REPO_ROOT/$filename"
        if [ ! -f "$filepath" ]; then
            filepath="$CONFORMANCE_DIR/$filename"
        fi

        if [ ! -f "$filepath" ]; then
            echo "MISSING: $filename"
            missing=$((missing + 1))
            continue
        fi

        local actual_hash
        actual_hash=$(file_hash "$filepath")

        if [ "$actual_hash" = "$expected_hash" ]; then
            passed=$((passed + 1))
        else
            echo "TAMPER: $filename"
            echo "  Expected: $expected_hash"
            echo "  Actual:   $actual_hash"
            failed=$((failed + 1))
        fi
    done < "$HASH_FILE"

    echo ""
    echo "=== HASH VERIFICATION ==="
    echo "Total registered: $total"
    echo "Passed: $passed"
    echo "Failed: $failed"
    echo "Missing files: $missing"

    if [ $failed -gt 0 ]; then
        echo "STATUS: INTEGRITY VIOLATION"
        exit 1
    elif [ $missing -gt 0 ]; then
        echo "STATUS: PARTIAL (missing files)"
        exit 0
    else
        echo "STATUS: ALL CLEAN"
        exit 0
    fi
}

# Show coverage stats
cmd_status() {
    ensure_hash_file

    local total_tests=0
    local hashed_tests=0
    local unhashed_tests=0
    local unhashed_list=""

    for f in "$CONFORMANCE_DIR"/*.tsz; do
        [ ! -f "$f" ] && continue
        local basename
        basename=$(basename "$f")

        # Skip .script.tsz and .cls.tsz — they're companions, not standalone tests
        case "$basename" in
            *.script.tsz|*.cls.tsz) continue ;;
        esac

        total_tests=$((total_tests + 1))

        if grep -q "  ${basename}$" "$HASH_FILE" 2>/dev/null; then
            hashed_tests=$((hashed_tests + 1))
        else
            unhashed_tests=$((unhashed_tests + 1))
            unhashed_list="${unhashed_list}  ${basename}\n"
        fi
    done

    local total_entries=0
    if [ -s "$HASH_FILE" ]; then
        total_entries=$(wc -l < "$HASH_FILE" | tr -d ' ')
    fi

    echo "=== CONFORMANCE HASH STATUS ==="
    echo "Test carts (standalone .tsz): $total_tests"
    echo "Hash-locked: $hashed_tests"
    echo "Unhashed: $unhashed_tests"
    echo "Total hash entries (incl. companions): $total_entries"
    echo "Coverage: $(( hashed_tests * 100 / (total_tests > 0 ? total_tests : 1) ))%"

    if [ $unhashed_tests -gt 0 ]; then
        echo ""
        echo "Unhashed tests:"
        echo -e "$unhashed_list"
    fi
}

# Lock ALL unhashed test files
cmd_lock_all() {
    ensure_hash_file

    local locked=0

    for f in "$CONFORMANCE_DIR"/*.tsz; do
        [ ! -f "$f" ] && continue
        local basename
        basename=$(basename "$f")

        if ! grep -q "  ${basename}$" "$HASH_FILE" 2>/dev/null; then
            local hash
            hash=$(file_hash "$f")
            echo "$hash  $basename" >> "$HASH_FILE"
            echo "LOCKED: $basename"
            locked=$((locked + 1))
        fi
    done

    if [ $locked -gt 0 ]; then
        sort -k2 "$HASH_FILE" -o "$HASH_FILE"
        echo ""
        echo "Locked $locked new file(s)."
    else
        echo "All files already hashed."
    fi
}

# Main dispatch
case "${1:-help}" in
    hash)
        [ -z "${2:-}" ] && echo "Usage: $0 hash <test_name>" && exit 1
        cmd_hash "$2"
        ;;
    lock)
        [ -z "${2:-}" ] && echo "Usage: $0 lock <file_path>" && exit 1
        cmd_lock "$2"
        ;;
    lock-all)
        cmd_lock_all
        ;;
    verify-all)
        cmd_verify_all
        ;;
    status)
        cmd_status
        ;;
    help|*)
        echo "Usage: $0 <command> [args]"
        echo ""
        echo "Commands:"
        echo "  hash <test_name>    Check hash integrity for a test"
        echo "  lock <file_path>    Hash-lock a test file"
        echo "  lock-all            Hash-lock all unhashed test files"
        echo "  verify-all          Verify all registered hashes"
        echo "  status              Show hash coverage stats"
        ;;
esac
