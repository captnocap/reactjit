// ── Lua tree emit ───────────────────────────────────────────
// Emits a Lua-first app: Lua owns the tree and state,
// Zig provides a root node and paints whatever Lua builds.
//
// The generated output is:
//   1. Minimal Zig: root node, LUA_LOGIC const, exports
//   2. LUA_LOGIC: component functions, state atoms, render call

function emitLuaTreeApp(ctx, rootExpr, file) {
  var basename = file.split('/').pop();
  var appName = basename.replace(/\.tsz$/, '');
  var prefix = 'framework/';

  // ── Build the Lua source ──────────────────────────────────
  var lua = [];

  // State atom pool
  lua.push('local _state = {}');
  lua.push('function _getState(k) return _state[k] end');
  lua.push('function _setState(k, v) _state[k] = v; __markDirty() end');
  lua.push('');

  // State slot setters/getters (compatibility with existing useState pattern)
  if (ctx.stateSlots && ctx.stateSlots.length > 0) {
    for (var si = 0; si < ctx.stateSlots.length; si++) {
      var slot = ctx.stateSlots[si];
      var getter = slot.getter;
      var setter = slot.setter;
      var init = slot.initial !== undefined ? slot.initial : 0;
      // Initialize
      lua.push('_state["' + getter + '"] = ' + _luaLiteral(init));
      // Getter as global variable (read from state pool)
      lua.push(getter + ' = _state["' + getter + '"]');
      // Setter function
      lua.push('function ' + setter + '(v) _state["' + setter + '"] = v; ' + getter + ' = v; __markDirty() end');
    }
    lua.push('');
  }

  // OA setters (arrays)
  if (ctx.objectArrays && ctx.objectArrays.length > 0) {
    for (var oi = 0; oi < ctx.objectArrays.length; oi++) {
      var oa = ctx.objectArrays[oi];
      lua.push(oa.getter + ' = {}');
      if (oa.setter) {
        lua.push('function ' + oa.setter + '(v) ' + oa.getter + ' = v; __markDirty() end');
      }
    }
    lua.push('');
  }

  // Component functions — emit from parsed tree
  // For now: emit App() as a Lua function that returns the root node table
  if (ctx._luaRootNode) {
    lua.push('function App()');
    lua.push('  return ' + _nodeToLua(ctx._luaRootNode, null, null, '  '));
    lua.push('end');
  } else {
    // Fallback: emit a placeholder
    lua.push('function App()');
    lua.push('  return { text = "App (no luaNode)" }');
    lua.push('end');
  }
  lua.push('');

  // Render function — called on init and on every state change
  lua.push('function __render()');
  lua.push('  __clearLuaNodes()');
  lua.push('  local tree = App()');
  lua.push('  if __mw0 then __declareChildren(__mw0, { tree }) end');
  lua.push('end');
  lua.push('');

  // Initial render is called from _appInit after wrapper registration

  var luaStr = lua.join('\n');

  // ── Build the Zig source ──────────────────────────────────
  // Match v4 emit patterns exactly so split.js works correctly.
  var zig = '';
  var fastBuild = globalThis.__fastBuild === 1;

  // Preamble
  zig += 'const std = @import("std");\n';
  if (!fastBuild) {
    zig += 'const build_options = @import("build_options");\n';
    zig += 'const IS_LIB = if (@hasDecl(build_options, "is_lib")) build_options.is_lib else false;\n\n';
  }
  zig += 'const layout = @import("' + prefix + 'layout.zig");\n';
  zig += 'const Node = layout.Node;\n';
  zig += 'const Style = layout.Style;\n';
  zig += 'const Color = layout.Color;\n';
  zig += 'const state = @import("' + prefix + 'state.zig");\n';
  zig += 'const luajit_runtime = @import("' + prefix + 'luajit_runtime.zig");\n';
  zig += 'const qjs_runtime = @import("' + prefix + 'qjs_runtime.zig");\n';
  if (!fastBuild) {
    zig += 'const engine = if (IS_LIB) struct {} else @import("' + prefix + 'engine.zig");\n';
    zig += 'comptime { if (!IS_LIB) _ = @import("' + prefix + 'core.zig"); }\n';
  }
  zig += '\n';

  // State manifest (empty for lua-tree — state lives in Lua)
  zig += '// ── State manifest ──\n';
  zig += '\n';

  // Generated node tree — root only, Lua fills children
  zig += '// ── Generated node tree ──\n';
  zig += 'var _root = Node{ .style = .{ .width = -1, .height = -1 } };\n\n';

  // JS_LOGIC
  zig += '// ── Embedded JS logic ──\n';
  zig += 'const JS_LOGIC = "";\n\n';

  // LUA_LOGIC
  zig += '// ── Embedded Lua logic ──\n';
  zig += 'const LUA_LOGIC =\n';
  var luaLines = luaStr.split('\n');
  for (var li = 0; li < luaLines.length; li++) {
    zig += '    \\\\' + luaLines[li] + '\n';
  }
  zig += ';\n\n';

  // Init + tick functions (v4 pattern)
  zig += 'fn _appInit() void {\n';
  zig += '    luajit_runtime.setMapWrapper(0, @ptrCast(&_root));\n';
  zig += '    luajit_runtime.callGlobal("__render");\n';
  zig += '}\n\n';

  zig += 'fn _appTick(now: u32) void {\n';
  zig += '    _ = now;\n';
  zig += '    if (state.isDirty()) {\n';
  zig += '        luajit_runtime.callGlobal("__render");\n';
  zig += '        state.clearDirty();\n';
  zig += '    }\n';
  zig += '}\n\n';

  // Exports (match v4 exactly)
  zig += 'export fn app_get_root() *Node { return &_root; }\n';
  zig += 'export fn app_get_init() ?*const fn () void { return _appInit; }\n';
  zig += 'export fn app_get_tick() ?*const fn (u32) void { return _appTick; }\n';
  zig += 'export fn app_get_js_logic() [*]const u8 { return JS_LOGIC.ptr; }\n';
  zig += 'export fn app_get_js_logic_len() usize { return JS_LOGIC.len; }\n';
  zig += 'export fn app_get_lua_logic() [*]const u8 { return LUA_LOGIC.ptr; }\n';
  zig += 'export fn app_get_lua_logic_len() usize { return LUA_LOGIC.len; }\n';
  zig += 'export fn app_get_title() [*:0]const u8 { return "' + appName + '"; }\n\n';

  zig += 'export fn app_state_count() usize { return ' + (ctx.stateSlots ? ctx.stateSlots.length : 0) + '; }\n';

  // Main function
  zig += '\npub fn main() !void {\n';
  if (!fastBuild) zig += '    if (IS_LIB) return;\n';
  zig += '    try engine.run(.{\n';
  zig += '        .title = "' + appName + '",\n';
  zig += '        .root = &_root,\n';
  zig += '        .init = _appInit,\n';
  zig += '        .tick = _appTick,\n';
  zig += '        .js_logic = JS_LOGIC,\n';
  zig += '        .lua_logic = LUA_LOGIC,\n';
  zig += '    });\n';
  zig += '}\n';

  return zig;
}

function _luaLiteral(val) {
  if (val === null || val === undefined) return 'nil';
  if (typeof val === 'number') return String(val);
  if (typeof val === 'string') return '"' + val.replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"';
  if (typeof val === 'boolean') return val ? 'true' : 'false';
  return 'nil';
}
