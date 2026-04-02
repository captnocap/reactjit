#!/bin/bash
# Block raw zig build commands that bypass ./scripts/build
# Allowed: zig build forge, zig build smith-sync, zig build smith-bundle, ./scripts/build
CMD=$(jq -r '.tool_input.command // empty' 2>/dev/null)
[ -z "$CMD" ] && exit 0

# Check for forbidden patterns
case "$CMD" in
  *"zig build-obj"*|*"zig build-exe"*|*"zig build-lib"*)
    echo '{"decision":"block","reason":"Use ./scripts/build <cart.tsz> or zig build forge. Do not use raw zig build-obj/build-exe/build-lib commands."}'
    exit 0
    ;;
  *"zig build app"*|*"zig build tsz"*|*"zig build tsz-full"*|*"zig build app-lib"*|*"zig build dev-shell"*|*"zig build cart"*)
    echo '{"decision":"block","reason":"Use ./scripts/build <cart.tsz> or zig build forge. Do not use raw zig build app/tsz/cart commands."}'
    exit 0
    ;;
  *"cp generated_"*|*"cp /tmp/tsz-gen/generated_"*)
    echo '{"decision":"block","reason":"Use ./scripts/build <cart.tsz> — it handles generated file copying. Do not manually cp generated_ files."}'
    exit 0
    ;;
esac

# Block builds on non-entry .tsz files (.script.tsz, .cls.tsz, .c.tsz, .mod.tsz)
case "$CMD" in
  *"scripts/build"*.script.tsz*|*"forge build"*.script.tsz*)
    echo '{"decision":"block","reason":"Cannot build .script.tsz files — they are script imports, not entry files. Build the parent .tsz file instead."}'
    exit 0
    ;;
  *"scripts/build"*.cls.tsz*|*"forge build"*.cls.tsz*)
    echo '{"decision":"block","reason":"Cannot build .cls.tsz files — they are classifier imports, not entry files. Build the parent .tsz file instead."}'
    exit 0
    ;;
  *"scripts/build"*.c.tsz*|*"forge build"*.c.tsz*)
    echo '{"decision":"block","reason":"Cannot build .c.tsz files — they are component imports, not entry files. Build the parent .tsz file instead."}'
    exit 0
    ;;
  *"scripts/build"*.mod.tsz*|*"forge build"*.mod.tsz*)
    echo '{"decision":"block","reason":"Cannot build .mod.tsz files — use forge build --mod for module files."}'
    exit 0
    ;;
esac

# Allow everything else (including zig build forge, smith-sync, smith-bundle, scripts/build)
exit 0
