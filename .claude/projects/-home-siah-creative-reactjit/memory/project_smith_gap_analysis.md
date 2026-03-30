---
name: Smith compiler gap analysis (updated 2026-03-29)
description: Gap analysis comparing Smith against tslx_compile.mjs, tsl.mjs, and archive/tsz-gen. Most gaps now closed.
type: project
---

Comprehensive gap analysis done 2026-03-29 comparing Smith (tsz/compiler/smith/) against:
- love2d/scripts/tslx_compile.mjs (JSX→Lua, 1565 lines)
- love2d/cli/lib/tsl.mjs (TS→Lua imperative, 1500+ lines)
- archive/tsz-gen/compiler/ (old Zig compiler, 18k lines)

**Closed this session:**
- Render-local variables (32036a7f) — `const doubled = count * 2` resolves in templates/styles/conditionals
- Dead code cleanup (3b333492) — deleted parse_ext.js, emit_ext.js, 7 dead functions, -1600 lines
- File splits (b9f7a901) — all files under 1600-line limit
- JS stdlib method mapping (15ea578a) — luaTransform/jsTransform with 40+ method mappings
- Handler body capture (5200be06) — full if/else/for/while in handler bodies produce valid Lua
- Control flow transpilation — if→then, else, elseif, while→do, for-of→ipairs, for-in→pairs

**Already existed (initially thought missing):**
- Ternary JSX: tryParseTernaryJSX in parse.js
- {children} passthrough: parse.js parseChildren
- Ternary text: tryParseTernaryText in parse.js

**Remaining gaps:**
1. Expression precedence parser — flat token walk (works by accident for most cases since target languages handle their own precedence)
2. `--mod` mode is line-by-line regex (compileMod in index.js) — fragile for complex TS
3. No compute() block — workaround via render locals
4. No Window/Overlay/Route elements from old Zig compiler

**How to apply:** The major blocking gaps are closed. Remaining items are edge cases or features not yet needed by active carts.
