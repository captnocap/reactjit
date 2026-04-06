# SPEC: Real Atomic Decomposition of Emit

**Date:** 2026-04-05
**Status:** draft

## Problem
The emit system has the same operations copy-pasted everywhere. `lua_on_press` appears 53 times. Handler pointer wiring is reimplemented 20 times. A "nested map" is treated as a separate concept from a "flat map" when it's just recursion. The "atom" files are copies of the monolith, not actual atoms.

## What "atomic" actually means
An atom is ONE function in ONE file that does ONE thing. It gets called wherever that thing needs to happen. If you need the same operation at depth 0 and depth 1, that's a parameter, not a second file.

## The Real Atoms

### Atom 1: `emit_ops/constants.js` — Every string defined once
Every field name, prefix, and magic string that appears more than once.

```js
var PRESS_FIELD = 'lua_on_press';
var HANDLER_PREFIX = '__mapPress_';
var POOL_PREFIX = '_map_pool_';
var COUNT_PREFIX = '_map_count_';
var TEXT_BUF_PREFIX = '_map_text_bufs_';
var TEXT_PREFIX = '_map_texts_';
var LUA_BUF_PREFIX = '_map_lua_bufs_';
var LUA_PTR_PREFIX = '_map_lua_ptrs_';
var INNER_PREFIX = '_map_inner_';
var MAX_MAP_PREFIX = 'MAX_MAP_';
var MAX_FLAT_PREFIX = 'MAX_FLAT_';
var MAX_NESTED_OUTER_PREFIX = 'MAX_NESTED_OUTER_';
var MAX_INLINE_OUTER_PREFIX = 'MAX_INLINE_OUTER_';
var ARENA_VAR = '_pool_arena';
var DEFAULT_BUF_SIZE = 47;
var EXTENDED_BUF_SIZE = 127;
var DEFAULT_MAP_TEXT_BUF = 256;
var DEFAULT_FLAT_MAX = 4096;
var DEFAULT_NESTED_MAX = 64;
var DEFAULT_INLINE_MAX = 16;
var DEFAULT_INLINE_OUTER = 8;
```

**File:** CREATE `smith/emit_ops/constants.js`

---

### Atom 2: `emit_ops/replace_field_refs.js` — Rewrite OA field references
One function that replaces `_oaX_field[fromVar]` → `_oaX_field[toVar]` in any template string. Currently reimplemented in every map variant with different hardcoded variable names.

```js
function replaceFieldRefs(template, oaFields, oaIdx, fromVar, toVar) { ... }
```

Handles: regular fields, string fields (slice syntax with _lens), bare iteration refs.

**File:** CREATE `smith/emit_ops/replace_field_refs.js`

---

### Atom 3: `emit_ops/wire_handler_ptrs.js` — Wire handler pointers into pool nodes
One function that takes a pool node template and replaces static handler string literals with per-item pointer references. Currently 20 copies of this logic.

```js
function wireHandlerPtrs(poolNode, handlers, mapIdx, iterVar, ctx) { ... }
```

Takes: the pool node expression, the handlers for this map, and the iteration variable. Returns: modified pool node with `._press_field = _map_lua_ptrs_N_H[iterVar]`.

**File:** CREATE `smith/emit_ops/wire_handler_ptrs.js`

---

### Atom 4: `emit_ops/emit_dyn_text.js` — Format dynamic text buffers
One function that emits `std.fmt.bufPrint` lines for dynamic text in any map context. Currently 8 copies with different iteration variables.

```js
function emitMapDynText(dynTexts, mapIdx, iterVar, oaFields, oaIdx, indent) { ... }
```

Takes: which texts, which map, what iteration variable, what indent level. No hardcoded `_i` vs `_flat_j`.

**File:** CREATE `smith/emit_ops/emit_dyn_text.js`

---

### Atom 5: `emit_ops/emit_handler_fmt.js` — Build handler format strings
One function that builds the `std.fmt.bufPrint` call for handler pointer initialization. The pattern: `__mapPress_N_H(args...)` with field refs. Currently reimplemented per-variant.

```js
function emitHandlerFmt(mapIdx, handlerIdx, iterVar, parentFieldRefs, childFieldRefs, parentOaIdx, childOaIdx, indent) { ... }
```

Returns: the Zig block that does bufPrint + null terminator + ptrCast for one handler.

**File:** CREATE `smith/emit_ops/emit_handler_fmt.js`

---

### Atom 6: `emit_ops/emit_inner_array.js` — Build per-item inner arrays
One function that constructs the inner children array for a map node. Replaces text refs, wires children pointers.

```js
function emitInnerArray(mapIdx, innerArr, innerCount, dynTexts, iterVar, indent) { ... }
```

**File:** CREATE `smith/emit_ops/emit_inner_array.js`

---

### Atom 7: `emit_ops/emit_pool_node.js` — Assign a single pool node
One function that emits the pool node assignment line: `_map_pool_N[iterVar] = <template>;`

Handles: flat (`_map_pool_N[_i]`), nested (`_map_pool_N[parentVar][childVar]`), inline (`_map_pool_N[parentVar][childVar]`). The difference is just the index expression, not separate logic.

```js
function emitPoolNodeAssign(mapIdx, iterVars, poolNode, indent) { ... }
```

**File:** CREATE `smith/emit_ops/emit_pool_node.js`

---

### Atom 8: `emit_ops/emit_display_toggle.js` — Conditional display
One function that emits `style.display = if (condition) .flex else .none`. Currently inlined in multiple places.

```js
function emitDisplayToggle(target, condition, trueIdx, falseIdx, indent) { ... }
```

**File:** CREATE `smith/emit_ops/emit_display_toggle.js`

---

### Atom 9: `emit_ops/emit_map_decl.js` — Map pool declarations
One function that emits the constant and variable declarations for a map pool: MAX_MAP, pool array, count storage. Takes map type (flat/nested/inline) as parameter.

```js
function emitMapDecl(mapIdx, mapType, parentPoolSize, indent) { ... }
```

Returns: the `const MAX_MAP_N`, `var _map_pool_N`, `var _map_count_N` block.

**File:** CREATE `smith/emit_ops/emit_map_decl.js`

---

### Atom 10: `emit_ops/emit_text_storage.js` — Map text buffer declarations
One function that emits `_map_text_bufs_N_B` and `_map_texts_N_B` array declarations.

```js
function emitTextStorage(mapIdx, bufId, mapType, indent) { ... }
```

Takes map type to determine dimensions (flat vs nested 2D vs inline 3D arrays).

**File:** CREATE `smith/emit_ops/emit_text_storage.js`

---

### Atom 11: `emit_ops/emit_handler_storage.js` — Handler pointer buffer declarations
One function that emits `_map_lua_bufs_N_H` and `_map_lua_ptrs_N_H` declarations plus the init function.

```js
function emitHandlerStorage(mapIdx, handlerIdx, bufSize, mapType, indent) { ... }
```

**File:** CREATE `smith/emit_ops/emit_handler_storage.js`

---

### Atom 12: `emit_ops/emit_per_item_arr.js` — Per-item array declarations
One function that emits `_map_arr_NAME_N` storage for maps with per-iteration child arrays.

```js
function emitPerItemArrDecl(mapIdx, arrName, elemCount, mapType, indent) { ... }
```

**File:** CREATE `smith/emit_ops/emit_per_item_arr.js`

---

### Atom 13: `emit_ops/emit_arena.js` — Arena allocator declaration
One function that emits the pool arena declaration. Currently hardcoded inline.

```js
function emitArenaDecl() { ... }
// Returns: "var _pool_arena: std.heap.ArenaAllocator = ..."
```

**File:** CREATE `smith/emit_ops/emit_arena.js`

---

### Atom 14: `emit_ops/wrap_condition.js` — Boolean condition wrapping
One function that wraps a condition expression for Zig evaluation. `_wrapMapCondition()` currently defined at top of map_pools.js.

```js
function wrapCondition(expr) { ... }
```

**File:** CREATE `smith/emit_ops/wrap_condition.js`

---

### Atom 15: `emit_ops/compute_map_meta.js` — Map metadata computation
The prep functions: `buildMapEmitOrder`, `ensureMapHandlerFieldRefs`, `computePromotedMapArrays`, `countTopLevelNodeDeclEntries`. These compute metadata before any emission.

```js
function computeMapMeta(ctx) { ... }
// Returns: { emitOrder, promotedArrays, mapMeta }
```

**File:** CREATE `smith/emit_ops/compute_map_meta.js`

---

### Atom 16: `emit_ops/rebuild_map.js` — THE recursive map rebuild
One function. Flat, nested, inline — all the same function at different depths.

```js
function rebuildMap(ctx, map, mapIdx, depth, parentRef, mapMeta) {
  var iterVar = depth === 0 ? '_i' : (map.isInline ? '_j' : '_flat_j');
  var out = '';
  
  // 1. emitMapDynText(...)           — atom 4
  // 2. emitInnerArray(...)           — atom 6
  // 3. wireHandlerPtrs(...)          — atom 3
  // 4. emitHandlerFmt(...)           — atom 5
  // 5. emitDisplayToggle(...)        — atom 8
  // 6. emitPoolNodeAssign(...)       — atom 7
  
  // 7. For each child map:
  //    rebuildMap(ctx, child, childIdx, depth+1, ...)
  
  return out;
}
```

**Uses:** atoms 3, 4, 5, 6, 7, 8 — composes them.

**File:** CREATE `smith/emit_ops/rebuild_map.js`

---

### Atom 17: `emit_ops/emit_lua_element.js` — Lua-side element emission
The Lua map path (`lua_maps.js`) also has its own element builder. One function for emitting a Lua element with style, text, children.

```js
function emitLuaElement(ctx, itemParam, indent, indexParam) { ... }
```

Currently 212+ lines in lua_maps.js with helpers (`emitLuaStyle`, `emitLuaTextContent`, `emitLuaChildren`).

**File:** CREATE `smith/emit_ops/emit_lua_element.js`

---

### Atom 18: `emit_ops/js_expr_to_lua.js` — JS expression to Lua transform
The `_jsExprToLua()` function in lua_maps.js. Converts JS expressions to Lua equivalents. Also `luaTransform()` in transforms.js is related.

```js
function jsExprToLua(expr, itemParam, indexParam) { ... }
```

**File:** CREATE `smith/emit_ops/js_expr_to_lua.js`

---

### Atom 19: `emit_ops/hex_to_color.js` — Color conversion
`hexToLuaColor()` and `_luaColorOrPassthrough()` from lua_maps.js. Color string manipulation used in multiple places.

```js
function hexToLuaColor(hex) { ... }
function luaColorOrPassthrough(val) { ... }
```

**File:** CREATE `smith/emit_ops/hex_to_color.js`

---

### Atom 20: `emit_ops/emit_lua_rebuild.js` — Lua map rebuild emission
The Lua-side equivalent of the Zig rebuild. `emitLuaRebuildList()` in lua_maps.js.

```js
function emitLuaRebuildList(mapIdx, ctx, itemParam, wrapperTag) { ... }
```

**File:** CREATE `smith/emit_ops/emit_lua_rebuild.js`

---

### Atom 21: `emit_ops/zig_node_to_lua.js` — Convert Zig node expression to Lua
`_zigNodeExprToLua()` and `_nodeResultToLuaRebuilder()` in lua_maps.js. Bridge between the Zig emit representation and Lua output.

```js
function zigNodeToLua(nodeExpr) { ... }
function nodeResultToLuaRebuilder(mapIdx, nodeResult, oa) { ... }
```

**File:** CREATE `smith/emit_ops/zig_node_to_lua.js`

---

### Atom 22: `emit_ops/emit_lua_style.js` — Lua style emission
`emitLuaStyle()` from lua_maps.js. Builds Lua table with style properties.

```js
function emitLuaStyle(ctx, itemParam) { ... }
```

**File:** CREATE `smith/emit_ops/emit_lua_style.js`

---

### Atom 23: `emit_ops/emit_lua_text.js` — Lua text content emission
`emitLuaTextContent()` from lua_maps.js. Handles text interpolation in Lua context.

```js
function emitLuaTextContent(ctx, itemParam) { ... }
```

**File:** CREATE `smith/emit_ops/emit_lua_text.js`

---

### Atom 24: `emit_ops/emit_variant_patch.js` — Variant/classifier style patches
The display-toggle and style-patch logic for variant/classifier states. Currently in runtime_updates.js.

```js
function emitVariantPatch(variant, target, indent) { ... }
```

**File:** CREATE `smith/emit_ops/emit_variant_patch.js`

---

### Atom 25: `emit_ops/style_assignments.js` — Style assignment emission
The `styleAssignments()` inner function in runtime_updates.js that parses a style string and emits individual assignments.

```js
function emitStyleAssignments(target, styleStr, indent) { ... }
```

**File:** CREATE `smith/emit_ops/style_assignments.js`

---

### Atom 26: `emit_ops/emit_state_setters.js` — State setter emission (Lua + JS)
The logic in logic_blocks.js and split.js that emits state getters/setters into JS_LOGIC and LUA_LOGIC. Currently gated on `ctx.luaBlock` when it should run whenever handlers exist.

```js
function emitStateSetters(ctx, target) { ... }
// target = 'lua' | 'js'
```

**File:** CREATE `smith/emit_ops/emit_state_setters.js`

---

### Atom 27: `emit_ops/emit_oa_bridge.js` — Object array host function bridge
The QJS/LuaJIT registration for `__setObjArrN` and friends. Currently only registered for QJS. This is one of the gaps from the Gemini audit.

```js
function emitOABridge(ctx, target) { ... }
// target = 'qjs' | 'luajit'
```

**File:** CREATE `smith/emit_ops/emit_oa_bridge.js`

---

### Atom 28: `emit_ops/emit_map_press.js` — Map press handler dispatch
The `__mapPress_N_H(args)` function body emission. Currently built inline in both Zig and Lua paths.

```js
function emitMapPressBody(mapIdx, handlerIdx, handler, target) { ... }
// target = 'lua' | 'js' | 'zig'
```

**File:** CREATE `smith/emit_ops/emit_map_press.js`

---

### Atom 29: `emit_ops/emit_orphan_arrays.js` — Orphaned array cleanup
`appendOrphanedMapArrays()` — catches map arrays that didn't get attached to any parent. Currently inline at end of map_pools.js.

```js
function emitOrphanArrays(out, ctx) { ... }
```

**File:** CREATE `smith/emit_ops/emit_orphan_arrays.js`

---

### Atom 30: `emit_ops/effect_transpile.js` — Effect callback transpilation
Already mostly isolated in `emit/effect_transpile.js` (172 lines). Move to emit_ops, keep the functions.

**File:** MOVE `smith/emit/effect_transpile.js` → `smith/emit_ops/effect_transpile.js`

---

### Atom 31: `emit_ops/effect_wgsl.js` — WGSL shader emission
Already mostly isolated in `emit/effect_wgsl.js` (361 lines). Move to emit_ops.

**File:** MOVE `smith/emit/effect_wgsl.js` → `smith/emit_ops/effect_wgsl.js`

---

### Atom 32: `emit_ops/transforms.js` — JS↔Lua transforms
Already in `emit/transforms.js` (137 lines). `luaTransform()` and `jsTransform()`. Move to emit_ops.

**File:** MOVE `smith/emit/transforms.js` → `smith/emit_ops/transforms.js`

---

## Wiring — after all atoms exist

Once all 32 atoms exist as standalone functions:

1. `emit.js` becomes a ~30 line orchestrator that calls atoms in order
2. `map_pools.js` (1251 lines) → DELETED — replaced by atoms 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 29
3. `lua_maps.js` (734 lines) → DELETED — replaced by atoms 17, 18, 19, 20, 21, 22, 23
4. `logic_blocks.js` (471 lines) → DELETED — replaced by atoms 26, 28
5. `runtime_updates.js` (290 lines) → DELETED — replaced by atoms 24, 25
6. `object_arrays.js` (349 lines) → DELETED — replaced by atom 27 + existing OA atoms
7. The old emit_atoms/maps_zig/ stubs (a026, a027, a028) → DELETED — replaced by atom 16

## Rules
- COPY logic out, do NOT delete originals until wiring phase
- Do NOT change what the output looks like — byte-identical Zig
- Do NOT modify any file in `carts/conformance/`
- If you find bugs, write them to `BUGS_FOUND.md` and continue
- "It compiles" is not done. "Output is byte-identical" is done.
- Each atom is a standalone function in a standalone file. No atom imports another atom. The orchestrator calls them.

## Handoff Notes
The trap: Claude will say "these two atoms are closely related so I'll combine them." NO. If they do different things, they're different atoms. The whole point is that you can look at one file and know exactly what one operation does.

The second trap: Claude will add "convenience wrappers" that bundle multiple atoms. NO. The orchestrator calls them directly. No indirection.

The third trap: Claude will say "32 files is too many." It's not. 32 files with one function each is infinitely better than 6 files with 20 reimplementations of the same 5 operations.
