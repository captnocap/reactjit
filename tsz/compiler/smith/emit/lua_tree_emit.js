// ── Lua tree emit (orchestrator) ────────────────────────────
// Emits a Lua-first app: Lua owns the tree and state,
// Zig provides a root node and paints whatever Lua builds.
//
// Delegates to:
//   lua_tree_preamble.js — Zig import block
//   lua_tree_nodes.js    — Lua source (state, helpers, App(), __render)
//   lua_tree_logic.js    — JS_LOGIC generation (state bindings, script blocks)
//   lua_tree_entry.js    — _appInit, _appTick, exports, main()

function emitLuaTreeApp(ctx, rootExpr, file) {
  var basename = file.split('/').pop();
  var appName = basename.replace(/\.tsz$/, '');
  var prefix = 'framework/';

  // ── Lua source ──
  var luaStr = emitLuaTreeLuaSource(ctx);

  // ── Zig output ──
  var zig = '';

  // Preamble (imports)
  zig += emitLuaTreePreamble(prefix);

  // State manifest (empty for lua-tree — state lives in Lua)
  zig += '// ── State manifest ──\n';
  zig += '\n';

  // Generated node tree — root only, Lua fills children
  zig += '// ── Generated node tree ──\n';
  zig += 'var _root = Node{ .style = .{ .width = -1, .height = -1 } };\n\n';

  // JS_LOGIC
  zig += '// ── Embedded JS logic ──\n';
  var jsContent = emitLuaTreeJsLogic(ctx);
  if (jsContent) {
    zig += 'const JS_LOGIC =\n';
    var jsLines = jsContent.split('\n');
    for (var ji = 0; ji < jsLines.length; ji++) {
      zig += '    \\\\' + jsLines[ji] + '\n';
    }
    zig += ';\n\n';
  } else {
    zig += 'const JS_LOGIC = "";\n\n';
  }

  // LUA_LOGIC
  zig += '// ── Embedded Lua logic ──\n';
  zig += 'const LUA_LOGIC =\n';
  var luaLines = luaStr.split('\n');
  for (var li = 0; li < luaLines.length; li++) {
    zig += '    \\\\' + luaLines[li] + '\n';
  }
  zig += ';\n\n';

  // Entry: init, tick, exports, main
  zig += emitLuaTreeEntry(ctx, appName, prefix);

  return zig;
}

function _luaLiteral(val) {
  if (val === null || val === undefined) return 'nil';
  if (typeof val === 'number') return String(val);
  if (typeof val === 'string') return luaStringLiteral(val);
  if (typeof val === 'boolean') return val ? 'true' : 'false';
  return 'nil';
}
