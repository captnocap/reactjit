# Smith Compiler Session State — 2026-03-27

## What Smith Is

Smith is the compiler brain — 5 JS files (~2000 lines) embedded into Forge (Zig binary) via @embedFile.
It replaced a 25,000-line monolithic Zig compiler at a 15:1 code reduction.

```
forge.zig (thin host) → runs Smith JS via QuickJS → generates .zig source
```

Files: rules.js, index.js, attrs.js, parse.js, emit.js
Build: `zig build forge` then `tsz-build carts/conformance/CART.tsz`
Reference: love2d/scripts/tslx_compile.mjs (working Lua compiler, same logic)

## Conformance Score: 53 / ~100

### PASSING (53)
d01-d10, d15, d16, d24, d26, d26a, d27a, d28a, d29a, d30a, d31a,
d34, d35, d36, d38, d40, d41, d42, d43, d45, d46, d47, d49, d50,
d51, d52, d53, d56, d57, d58, d60, d63, d66, d70, d76-d83, d86,
d102_ternary_hex

### BROKEN — Known Root Causes

**Bug 1: Map handler ptrs unwired (12 carts)**
_map_lua_ptrs arrays initialized but never assigned to pool nodes.
Handler strings stay as literals instead of per-item ptr dispatch.
Carts: d17, d18, d19, d20, d22, d25, d32, d33, d54, d61, d67, d72

**Bug 2: JS/Lua syntax leak in handler bodies (7 carts)**
luaBody used for js_on_press without converting Lua operators to JS.
Partially fixed (and→&&, or→||, ~=→!=) but some carts still hit it.
Carts: d20, d25, d29a(?), d32, d33, d62, d65

**Bug 3: Unresolvable expressions pass through silently (3 carts)**
Smith dumps raw source text into Zig output instead of erroring.
Carts: d65, d69, d85

**Bug 4: OA field storage not emitted (1 cart)**
Object-array field doesn't get backing _oa0_field array.
Cart: d55

**Other broken:** d14 (component instance state sharing), d39 (FFI returns 0),
d44 (classifier C.Name tags not supported — worker on it now),
d48 (compile error), d59 (colors dropped), d62, d64, d65, d67, d69,
d84 (regression), d85, d87 (compile error),
d96-d104 (advanced features — Graph.Path, spreads, recursion, chained methods, etc.)

### NOT TESTED YET
d39, d84 workers reported CLEAN but user hasn't visually confirmed.
b-tier (s##b): 0/15 passing. Main blocker is === (now fixed) + map var scoping.
a-tier (s##a): 0/15 — needs separate soup-smith compiler, not in scope.

## Fixes Landed This Session

1. ✅ Raw JS removed from LUA_LOGIC (script blocks → JS_LOGIC only)
2. ✅ Single-quote → double-quote in parseValueExpr
3. ✅ Lua .. concat instead of + in luaParseValueExpr
4. ✅ Per-handler __mapPress naming (mi_hi)
5. ✅ Per-item array promotion for component props with OA field refs
6. ✅ JS handler prop extraction (var label = item.label)
7. ✅ Map handler empty Zig stubs
8. ✅ Imported script function registration
9. ✅ === and !== consumed in all 6 condition parser locations
10. ✅ Ternary color resolution for map item fields (if/else Color.rgb chains)
11. ✅ < disambiguation in JSX expressions (brace depth > 0 = less-than)
12. ✅ String state slots use __setStateString in JS handlers
13. ✅ dynText arrName first-assignment-wins (prevents wiring overwrite)
14. ✅ Ternary text {state == N ? "A" : "B"} as dynamic if/else
15. ✅ Lua→JS operator conversion in handler bodies
16. ✅ _dynStyleIds array (multiple dynamic styles per node)
17. ✅ Non-onPress handler props (onTap, onToggle, onSelect, onChange)

## Build Pipeline

```bash
tsz-build carts/conformance/CART.tsz          # the ONE command
./scripts/build carts/conformance/CART.tsz     # same thing, explicit path
```

Pipeline: forge (tsz→zig) → preflight lint → zig build app
Each cart gets unique -Dapp-source and -Dapp-name, no more shared generated_app.zig.

### Preflight Lint (scripts/build)
FATAL: single-quoted JS strings in Zig, lua_on_press string literals in map rebuilds,
duplicate __mapPress functions, raw JS in LUA_LOGIC, JS + in Lua handler strings,
handlers referenced but undeclared, handlers declared but unwired.
WARN: Color{}, unused _map_lua_ptrs, __setObjArr, shared static arrays in maps.

## Planned Work (Not Started)

### Preflight v2 (preflight.js)
Full plan at: compiler/smith/PREFLIGHT_PLAN.md
Runs inside smith between parse and emit. Derives intents from ctx, validates
emit capabilities, blocks with @compileError on failure. Replaces bash grep lint.
Class B bug detection (wrong-but-valid output). Compile lanes (soup/mixed/chad).

### Smith Module Split
Split parse.js into semantic subsystem modules:
map_context.js, prop_substitution.js, array_targets.js, dynamic_text.js, handlers.js
Import block as table of contents. After conformance stabilizes.

### Generated Zig Split
Split generated_app.zig into: nodes.zig, handlers.zig, state.zig, maps.zig, logic.zig, app.zig
Each file small enough for a worker to read in one shot.

### Ambient Debug Dictionary
Zero-import auto-tracing. Every handler/map/dynText/state change gets a comptime-gated
trace point. One debug dictionary for the entire stack. No manual log imports.

### Soup-Smith
Separate compiler pass for soup-tier carts (className→style, onClick→onPress, div→Box).
Never mix into main smith. Sits before smith in the pipeline: soup→tsz→zig.

### Responsive/Viewport Testing
Conformance suite for breakpoint sizes and window reshaping. Separate from WPT flex tests.

## Worker Rules

- ONE cart at a time. Build, lint, run, verify. Then next.
- Only user visual confirmation counts as PASS.
- Broken code = print the data, read the data, fix. No theory crafting.
- Debug logs get silenced behind flags, never deleted.
- love2d/scripts/tslx_compile.mjs is the reference — read it first.
- Do not declare "fundamental limitations." We own everything.
- tsz-build is the only build command. Nothing else.
