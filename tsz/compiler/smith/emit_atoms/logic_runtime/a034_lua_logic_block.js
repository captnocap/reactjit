// ── Emit Atom 034: Lua logic block ──────────────────────────────
// Index: 34
// Group: logic_runtime
// Target: lua_in_zig
// Status: complete
// Current owner: emit_split.js
//
// Trigger: every emitOutput() call (LUA_LOGIC is always emitted).
// Output target: const LUA_LOGIC = multiline Zig string containing
//   Lua state vars, setter functions, OA loaders, map handlers,
//   <lscript> block, dynamic text evaluators, Lua map rebuilders.
//
// Notes:
//   Lua state setters/OA loaders only emit when ctx.luaBlock exists.
//   Map handlers emit when handler has luaBody and wasn't emitted in JS.
//   luaTransform() converts JS syntax to Lua equivalents.
//
//   Emit order within LUA_LOGIC:
//     1. State variable declarations (mirroring Zig state slots)
//     2. State setter functions (__setState / __setStateString bridge)
//     3. OA local vars + setter functions (when <lscript> exists)
//     4. Map handler functions (__mapPress_N_M) — Lua-only handlers
//        - Nested: receives (parent_idx, item_idx)
//        - Top-level: receives (idx, ...field_refs), stores _handlerFieldRefsMap
//     5. <lscript> block content (raw Lua)
//     6. __evalDynTexts (Lua-side dynamic text, 16ms interval)
//     7. Lua map rebuilders + __rebuildLuaMaps master dispatch
//
//   Lines emitted as Zig multiline string: \\line\n
//   Terminated with \\\n;\n

function _a034_applies(ctx, meta) {
  void meta;
  return !!ctx;
}

function _a034_emit(ctx, meta) {
  void meta;
  // Reference scaffolding — live emit is in emit_split.js emitLogicBlocks()
  // (~140 lines covering Lua state/OA/handler/script/rebuilder logic).
  return '';
}

_emitAtoms[34] = {
  id: 34,
  name: 'lua_logic_block',
  group: 'logic_runtime',
  target: 'lua_in_zig',
  status: 'complete',
  currentOwner: 'emit_split.js',
  applies: _a034_applies,
  emit: _a034_emit,
};
