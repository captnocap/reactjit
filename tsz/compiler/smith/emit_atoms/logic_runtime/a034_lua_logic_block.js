// ── Emit Atom 034: Lua logic block ──────────────────────────────
// Index: 34
// Group: logic_runtime
// Target: lua_in_zig
// Status: DISABLED — Lua-tree path owns LUA_LOGIC generation
// Current owner: lua_tree_nodes.js::emitLuaTreeLuaSource()
//
// This atom is DISABLED. The Lua-tree emit path (emit/lua_tree_nodes.js)
// is the active path for all modern carts. It generates LUA_LOGIC as a
// complete Lua source string directly, without delegating to atoms.
//
// This file remains as a structural placeholder to preserve atom indices.
// The _a034_applies() function always returns false.
//
// For the actual LUA_LOGIC implementation, see:
//   - emit/lua_tree_nodes.js     (Lua source generation)
//   - emit/lua_tree_emit.js      (Zig string wrapping)
//
// Deleted: All emit logic. This file does not emit anything.
//

// DISABLED — Lua-tree path is the active emit path.
// LUA_LOGIC generation is owned by lua_tree_nodes.js::emitLuaTreeLuaSource().
// This atom is kept as a structural placeholder; it never applies.
function _a034_applies(ctx, meta) {
  void ctx; void meta;
  return false;
}

// EMIT FUNCTION DISABLED — This atom never applies.
// LUA_LOGIC generation is owned by lua_tree_nodes.js::emitLuaTreeLuaSource().
// Kept as a stub to preserve atom registry indices.
function _a034_emit(ctx, meta) {
  void ctx; void meta;
  return '';
}

// Atom registration — status reflects that this atom is disabled.
// The Lua-tree path (emit/lua_tree_nodes.js) is the live owner of LUA_LOGIC.
_emitAtoms[34] = {
  id: 34,
  name: 'lua_logic_block',
  group: 'logic_runtime',
  target: 'lua_in_zig',
  status: 'DISABLED — lua_tree_nodes.js owns LUA_LOGIC',
  currentOwner: 'lua_tree_nodes.js::emitLuaTreeLuaSource()',
  applies: _a034_applies,
  emit: _a034_emit,
};
