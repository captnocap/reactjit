# Smith Conformance Audit — Visual Bug Diagnosis

Date: 2026-03-27

## Per-Cart Results

| Cart | Build | Issue Summary |
|------|-------|---------------|
| d14 | OK | All component instances share state — Lua setter names collide (last definition wins) |
| d17 | OK+warn | `selected` never updates — map handler uses `js_on_press` with iteration var `app.pid` (undefined in JS scope); `_map_lua_ptrs` generated but never wired |
| d18 | OK+warn | Per-item X buttons broken — same as d17, `item.id` undefined in JS handler |
| d19 | OK+warn | `last` field empty — same as d17, `item.title` undefined in JS handler |
| d22 | OK+warn | `i+1` literal text leak + `Color{}` on ternary bg + `setTapped(i)` handler broken |
| d32 | BLOCKED | Lua `..` operator leaked into JS handler string + map handlers not wired |
| d33 | BLOCKED | Same as d32 — Lua `..` operator in JS handler |
| d54 | OK+warn | Buttons broken — `removeQty(i)` / `addQty(i)` where `i` is undefined |
| d59 | OK+warn | `Color{}` on ternary bg + `setSelected(row.id)` handler broken |
| d62 | BLOCKED | Lint false-positive: single-quoted strings inside `js_on_press` are valid JS but lint flags them |
| d64 | OK+warn | Two maps with broken handlers (`u.name`, `p.action` undefined) |
| d65 | OK+warn | `Color{}` x6 + Lua `..` in handlers + prop values emitted as bare identifiers instead of strings |
| d67 | OK+warn | **Blank screen** — root tree has single empty node; component inlining failed to populate static arrays. Also Zig syntax leaked into JS handler |
| d69 | FAIL | **Compile error** — `.map()` inside template literal dumped raw JSX into Zig bufPrint |

## Root Cause Groupings

### 1. Map handlers use `js_on_press` with iteration variables (HIGHEST IMPACT)
**Carts**: d17, d18, d19, d22, d54, d59, d64
**What**: Handlers inside `.map()` emit `js_on_press = "fn(item.field)"` where `item`/`i`/`row` are map iteration variables that don't exist in JS global scope. The Lua path (`_map_lua_ptrs` + `__mapPress`) is correctly generated but never wired to the nodes.
**Fix**: Wire `_map_lua_ptrs_N_M[_i]` into nodes as `lua_on_press` instead of emitting raw `js_on_press` strings.

### 2. Lua `..` operator leaked into JS/Zig handler strings
**Carts**: d32, d33, d65
**What**: String concatenation in handlers uses Lua `..` instead of JS `+`. Lint catches these as blocked builds.
**Fix**: Handler expression emitter must use JS operators, not Lua.

### 3. Duplicate Lua setter names for multi-instance components
**Carts**: d14
**What**: Each component instance generates `function setCount(v)` — last definition wins in Lua. All instances share one slot.
**Fix**: Generate unique setter names per instance (e.g., `setCount_3`) or wire Zig fn handlers.

### 4. `Color{}` — unresolved ternary/index-dependent colors in maps
**Carts**: d22, d59, d65
**What**: `backgroundColor: condition ? "#a" : "#b"` compiles to `Color{}` (black) when the condition depends on map index or state.
**Fix**: Emit ternary colors in the map rebuild loop using the runtime value.

### 5. Template literal `${i + 1}` in maps emitted as literal text
**Carts**: d22
**What**: `${i + 1}` inside a map becomes `.text = "i + 1"` (static string) instead of dynamic bufPrint with the loop index.
**Fix**: Detect index arithmetic in template literals inside maps and emit as bufPrint.

### 6. Component tree not populated (blank screen)
**Carts**: d67
**What**: Root array has one empty node. The App() component tree failed to inline — likely a component-inside-map-inside-component edge case.
**Fix**: Debug Smith's component inlining for nested component/map patterns.

### 7. Raw JSX dumped into Zig string context
**Carts**: d69
**What**: `.map()` call inside a template literal/text expression was not recognized as JSX — raw JSX tokens ended up in a Zig bufPrint call, causing compile failure.
**Fix**: Smith must recognize `.map()` in expression context and route to map pool generation, not string interpolation.

### 8. Lint false-positive on single quotes in handler strings
**Carts**: d62
**What**: `js_on_press = "fn('Coffee', -5)"` is valid JS, but lint flags single-quoted multi-char strings.
**Fix**: Lint rule should exclude content inside handler string values.

### 9. Prop values emitted as bare identifiers
**Carts**: d65
**What**: Component prop values like `"Alice"` appear as `Alice` (unquoted) in handler expressions.
**Fix**: String prop values must be quoted when interpolated into handler expressions.

## Fix Priority (by impact count)

| Priority | Root Cause | Carts Fixed |
|----------|-----------|:-----------:|
| **P0** | Map handlers not wired (`_map_lua_ptrs`) | 7 |
| **P1** | Lua `..` operator in JS handlers | 3 |
| **P2** | `Color{}` ternary in maps | 3 |
| **P3** | Duplicate Lua setter names (multi-instance) | 1 |
| **P4** | Template literal index math in maps | 1 |
| **P5** | Component tree not populated | 1 |
| **P6** | `.map()` in template literal context | 1 |
| **P7** | Lint false-positive on handler quotes | 1 |
| **P8** | Prop values unquoted in handlers | 1 |
