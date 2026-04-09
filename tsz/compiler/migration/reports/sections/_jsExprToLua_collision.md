# _jsExprToLua Collision Resolution

## Two definitions

1. `smith/emit_ops/js_expr_to_lua.js` — 65 lines, basic JS→Lua conversion
   - Handles: item/index param replacement, ===→==, &&→and, ternary, bitwise, color passthrough
   - Signature: `_jsExprToLua(expr, itemParam, indexParam)`

2. `smith/emit_atoms/maps_lua/lua_map_subs.js` — ~100+ lines, full JS→Lua conversion
   - Signature: `_jsExprToLua(expr, itemParam, indexParam, _luaIdxExpr)`
   - Has everything from #1 PLUS: render local expansion, prop stack resolution, OA field refs, OA length refs, state slot getters, Zig builtin stripping (@as, @intCast, @floatFromInt, @divTrunc, @mod), nested map index support (_j→_ni), std.mem.eql→string compare, qjs_runtime.evalToString→__eval

## Winner

`smith/emit_atoms/maps_lua/lua_map_subs.js` is the canonical definition.

## Reason

- It's a strict superset of the emit_ops version
- It loads later in smith_LOAD_ORDER.txt (line 355 vs 277), overwriting the simpler version at runtime
- All atom callers (lua_map_text, lua_map_node, lua_map_style, lua_map_handler) use the 4-arg signature
- The emit_ops callers (emit_lua_style, emit_lua_element) call with 2-3 args, which still works with the 4-arg version

## Action

Delete `smith/emit_ops/js_expr_to_lua.js`. No porting needed — all logic is already in the kept version.
