// ── Emit Atom 030: Lua map rebuilder functions ─────────────────
// Index: 30
// Group: maps_lua
// Target: lua_in_zig
// Status: complete
// Current owner: emit/lua_maps.js, emit_split.js
//
// Trigger: non-OA or render-local map sources routed to LuaJIT.
// Output target: __rebuildLuaMapN() functions emitted into LUA_LOGIC.
//
// Each Lua map rebuilder is a self-contained function that:
//   1. Clears existing Lua nodes (__clearLuaNodes)
//   2. Reads the wrapper node (__mwN) and data array (__luaMapDataN)
//   3. Iterates items, building a Lua table of child descriptors
//   4. Calls __declareChildren(wrapper, tmpl) to stamp Zig Nodes
//
// The heavy lifting (JSX → Lua table literal conversion) is done
// at compile time by emitLuaRebuildList in emit/lua_maps.js.
// This atom catalogs that output shape.
//
// Helpers used during compile-time JSX→Lua conversion:
//   hexToLuaColor — "#58a6ff" → 0x58a6ff
//   emitLuaStyle — style={{ ... }} → Lua table with snake_case keys
//   emitLuaTextContent — {`template ${item.x}`} → Lua concatenation
//   emitLuaElement — recursive JSX element → Lua table
//   emitLuaChildren — child list including conditionals and nested maps

function _a030_applies(ctx) {
  return ctx._luaMapRebuilders && ctx._luaMapRebuilders.length > 0;
}

function _a030_emit(ctx) {
  // The actual Lua code is already compiled and stored in
  // ctx._luaMapRebuilders[i].luaCode by emit/lua_maps.js.
  // This atom emits the individual rebuilder functions into LUA_LOGIC.
  var lines = [];
  lines.push('-- Lua map rebuilders (detour from Zig OA path)');
  for (var lmi = 0; lmi < ctx._luaMapRebuilders.length; lmi++) {
    var lmr = ctx._luaMapRebuilders[lmi];
    var codeLines = lmr.luaCode.split('\n');
    for (var i = 0; i < codeLines.length; i++) {
      lines.push(codeLines[i]);
    }
  }
  return lines;
}

_emitAtoms[30] = {
  id: 30,
  name: 'lua_map_rebuilder_functions',
  group: 'maps_lua',
  target: 'lua_in_zig',
  status: 'complete',
  currentOwner: 'emit/lua_maps.js, emit_split.js',
  applies: _a030_applies,
  emit: _a030_emit,
};
