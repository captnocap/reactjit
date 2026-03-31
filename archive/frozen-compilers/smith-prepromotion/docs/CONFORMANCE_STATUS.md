# Smith Compiler — Conformance Status (2026-03-29)

## Context

The s#c conformance suite tests the `<page>` syntax against the full surface vocabulary.
Session 60b9 added preflight diagnostics (F11-F19) and fixed classifier imports, theme
resolution, JS-evaluated expressions, and bare handler wiring. Starting from 0/25 passing,
we reached 6/19 app carts passing with honest checks (no silent drops).

## What Works

These 6 carts compile to native binaries and run correctly:

| Cart | Features exercised |
|------|-------------------|
| **s01c_counter** | State, classifiers, themed styles, bare onPress handlers, JS-evaluated computed text (`{hint}`) |
| **s03c_chat** | `<For each=objectArray>`, item.field in map, inline handlers with `item.id`, TextInput, classifiers |
| **s08c_chart** | `<For>` over object array, Graph.Path, Canvas, JS-eval expressions |
| **s11c_text_icons** | Inline text, classifiers, glyphs import, effects import |
| **s13a_music_player** | Soup-tier (function App), script block, handlers, ternary text |
| **s13c_music_player** | Page-mode, classifiers, glyphs, JS-eval expressions, themed styles |

## What's Broken — By Error Code

### F17: `item.field` not resolved to OA accessor (5 carts)

**Carts:** s02c_todo, s06c_kanban, s07c_node_editor, s14c_file_browser, s15c_spreadsheet

**Symptom:** `item.field` appears in generated Zig as literal `item.field` instead of `_oaN_field[_i]`.
Zig build fails with "undeclared identifier 'item'".

**Root cause:** `tryParseTernaryJSX` in `parse_map.js` was missing item.field resolution.
Session 60b9 added it for the condition expression, but `item.field` also appears in:
- Style blocks: `style={{ borderColor: selected exact item.id ? '#3b82f6' : '#1e293b' }}`
- Attribute values: `id={item.id}`, `at={[item.x, item.y]}`
- Handler bodies: `onPress={() => { selectNode(item.id) }}`
- Conditional display toggles: `if (state.getSlotString(0) == item.id) .flex else .none`

**Where to fix:** Every code path that processes attributes/styles/handlers inside a `<For>`
loop needs to check `ctx.currentMap` and resolve `item.FIELD` → `_oaN_FIELD[_i]`. Key files:
- `parse.js` — `parseStyleBlock()` for style ternaries
- `parse.js` — attribute parsing section (~line 440-500) for value expressions
- `parse_map.js` — `tryParseConditional()` already does it (line 462). Copy that pattern.
- `emit.js` — conditional display in `_rebuildMapN()` (line ~350)

**Reference:** `tryParseConditional` at `parse_map.js:462-480` is the WORKING pattern for
item.field resolution. It checks `ctx.currentMap && name === ctx.currentMap.itemParam`, then
reads `.field` and resolves to `_oaN_field[_i]`. The same logic needs to be replicated in
`tryParseTernaryJSX` (partially done), style parsing, and attribute value parsing.

### F19: Leaked tag names / ternary colons (4 carts)

**Carts:** s00c_base_page, s04c_dashboard, s05c_settings, (s00c_manifest)

**Symptom:** `C.NavLabelActive>` or `":"` appear as text content in generated nodes.
App renders with visible tag names and colons instead of UI.

**Two sub-issues:**

#### F19a: `<For>` over simple arrays (string/number)

**Carts:** s00c_base_page (`<For each=notes>`), s05c_settings (`<For each=sections>`)

The `<For>` syntax only works with object arrays (`[{id: 1, text: 'foo'}, ...]`).
Simple arrays (`['a', 'b', 'c']`) have no field schema, so the parser can't create
OA field accessors. `{item}` as bare text and `{item exact value}` as comparison both fail.

**Approach options:**
1. **Wrap simple arrays as single-field OA:** When `<For each=X>` and X is type 'array'
   (not 'object_array'), auto-wrap as `[{_v: 'a'}, {_v: 'b'}]` with a synthetic `_v` field.
   Then `{item}` resolves to `{item._v}` → `_oaN__v[_i]`.
2. **Add a simple-array map pool:** Generate a different kind of pool that iterates
   `_oa_strings[_i]` directly without field decomposition.

Option 1 is simpler — the OA infrastructure already works. You'd modify `parsePageVarBlock`
in `page.js` to detect `type: 'array'` vars used in `<For>`, and synthesize them as
`type: 'object_array'` with `initial: X.map(v => ({_v: v}))`.

#### F19b: Chained ternaries (multi-branch)

**Carts:** s04c_dashboard, s05c_settings

Pattern: `{section exact 'profile' ? <A> : section exact 'appearance' ? <B> : <C>}`
The parser handles `? <JSX> : <JSX>` but not `? <JSX> : expr ? <JSX> : <JSX>`.
The second `?` is not recognized, so `:` falls through as text.

**Approach:** In `tryParseTernaryJSX`, after parsing the false branch, check if what follows
is another ternary (identifier + `exact`/`==` + value + `?`). If so, recursively parse it as
the false branch. This is how the love2d reference compiler handles nested ternaries.

### F13: Unsupported subsystem tags (3 carts)

**Carts:** s09c_physics_sim, s10c_pixel_effect, s12c_3d_scene

These tags (`<Physics.World>`, `<Effect>`, `<Scene3D>`, `<3D.Cube>`, etc.) are parsed
and produce empty boxes. The RUNTIME doesn't support them yet.

**Not a Smith issue.** These need framework-level implementations:
- Physics: Box2D integration via `tsz/ffi/physics_shim.cpp` (already exists, needs wiring)
- Effects: Pixel buffer + shader pipeline (concept exists in `.effects.tsz`)
- 3D: wgpu 3D rendering pipeline (not started)

### F14: `<module>` blocks ignored (1 cart)

**Cart:** s00c_manifest

`<module db>`, `<module net>`, etc. are parsed by `page.js` to detect them but the
compiler doesn't generate any FFI bindings or namespace functions. The `mod.js` compiler
handles `<module>` in `.mod.tsz` files but not inside `<page>` blocks.

### F4: Soup-mode computed color (1 cart)

**Cart:** s13b_music_player

`backgroundColor: albumColors[trackIdx]` — JS array indexed by state variable used as
a color. The attrs parser can't resolve it statically. Needs a dynColor that evaluates
the expression via JS at runtime (same pattern as the JS-eval dynTexts added in session 60b9).

## Preflight Checks Reference

| Code | What | Severity | Added by |
|------|------|----------|----------|
| F1 | Empty handler body | WARN | original |
| F2 | Handler referenced but missing | FATAL | original |
| F3 | Map handler lacks dispatch body | FATAL | original |
| F4 | Orphan Color{} placeholder | FATAL | original |
| F5 | OA field accessed but missing | FATAL | original |
| F6 | Unresolved template literal | FATAL | original |
| F7 | Duplicate handler names | FATAL | original |
| F8 | Map over non-OA identifier | FATAL | original |
| F9 | Script function called but undefined | FATAL | original |
| F10 | JS syntax in luaBody | FATAL | original |
| **F11** | **Unresolved C.* classifiers** | **FATAL** | **60b9** |
| **F12** | **Dropped {expr} expressions** | **FATAL** | **60b9** |
| **F13** | **Unsupported subsystem tags** | **FATAL** | **60b9** |
| **F14** | **Ignored `<module>` blocks** | **FATAL** | **60b9** |
| **F15** | **Undefined JS function calls** | **FATAL** | **60b9** |
| **F16** | **Duplicate JS vars** | **FATAL** | **60b9** |
| **F17** | **Unresolved item.field refs** | **FATAL** | **60b9** |
| **F18** | **JS syntax leaked into Zig** | **FATAL** | **60b9** |
| **F19** | **Leaked tag names / ternary colons** | **FATAL** | **60b9** |

## Key Infrastructure Added (Session 60b9)

1. **Classifier import resolution** — `forge.zig` cross-convention (`_cls` → `.cls.tsz`),
   recursive imports for classifier files, effects/glyphs/tcls/vcls file classification

2. **Theme token resolution** — `collectClassifiers()` collects `theme('default', {...})`,
   `resolveThemeToken()` maps `theme-spaceMd` → 8, etc.

3. **JS-evaluated dynamic text** — Unknown expressions in page mode allocate string state
   slots, `__evalDynTexts()` JS function evaluates them via QuickJS bridge every 16ms.
   Pattern: `ctx._jsDynTexts` tracks `{slotIdx, jsExpr}`, appended to `ctx.scriptBlock`.

4. **Bare handler wiring** — `onPress=functionName` (no braces) creates `js_on_press` handler.

5. **Drop tracking** — `ctx._unresolvedClassifiers`, `ctx._droppedExpressions`,
   `ctx._unknownSubsystemTags`, `ctx._ignoredModuleBlocks`, `ctx._undefinedJSCalls`,
   `ctx._duplicateJSVars`, `ctx._jsDynTexts` — all fed into preflight.

## Files Modified

- `compiler/forge.zig` — import resolution, file classification, classifier recursion
- `compiler/smith/index.js` — ctx fields, collectClassifiers, theme resolution
- `compiler/smith/page.js` — module detection, JS validation, __evalDynTexts generation
- `compiler/smith/parse.js` — classifier tracking, expression routing, handler wiring, comment filtering
- `compiler/smith/parse_map.js` — item.field in tryParseTernaryJSX
- `compiler/smith/preflight.js` — F11-F19 checks
- `carts/conformance/s00c_base_page.tsz` — added cls import, fixed BtnPrimary → Btn
- `carts/conformance/s00c_manifest.cls.tsz` — added tcls import
