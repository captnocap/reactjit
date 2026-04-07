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

  // Map loop helper — returns a marker table that __flattenChildren expands
  lua.push('function __mapLoop(arr, fn)');
  lua.push('  if not arr then return nil end');
  lua.push('  local r = {}');
  lua.push('  for i, item in ipairs(arr) do');
  lua.push('    r[#r + 1] = fn(item, i)');
  lua.push('  end');
  lua.push('  r.__isMapResult = true');
  lua.push('  return r');
  lua.push('end');
  lua.push('');

  // Flatten children: expand __mapLoop results inline
  lua.push('function __flattenChildren(children)');
  lua.push('  if not children then return {} end');
  lua.push('  local flat = {}');
  lua.push('  for _, child in ipairs(children) do');
  lua.push('    if type(child) == "table" and child.__isMapResult then');
  lua.push('      for _, mc in ipairs(child) do flat[#flat + 1] = mc end');
  lua.push('    elseif child ~= nil then');
  lua.push('      flat[#flat + 1] = child');
  lua.push('    end');
  lua.push('  end');
  lua.push('  return flat');
  lua.push('end');
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
      // Setter function — Lua is SSoT, sync to QJS so js_on_press sees it
      var _syncToJS = (ctx.scriptBlock || globalThis.__scriptContent) ? ' __syncToJS("' + getter + '", v);' : '';
      lua.push('function ' + setter + '(v) _state["' + getter + '"] = v; ' + getter + ' = v;' + _syncToJS + ' __markDirty() end');
    }
    lua.push('');
  }

  // FFI declarations — LuaJIT ffi.cdef + wrappers for each declare function
  if (ctx._ffiDecls && ctx._ffiDecls.length > 0) {
    lua.push('-- FFI-declared functions (via declare function / @ffi)');
    lua.push('local _ffi = require("ffi")');
    var _cdefs = [];
    for (var fdi = 0; fdi < ctx._ffiDecls.length; fdi++) {
      var _fd = ctx._ffiDecls[fdi];
      var _retC = _tsToCType(_fd.returnType);
      var _paramsC = _fd.params.length > 0
        ? _fd.params.map(function(p) { return _tsToCType(p.type); }).join(', ')
        : 'void';
      _cdefs.push('  ' + _retC + ' ' + _fd.name + '(' + _paramsC + ');');
    }
    lua.push('_ffi.cdef[[');
    for (var ci = 0; ci < _cdefs.length; ci++) lua.push(_cdefs[ci]);
    lua.push(']]');
    for (var fwi = 0; fwi < ctx._ffiDecls.length; fwi++) {
      var _fw = ctx._ffiDecls[fwi];
      var _pnames = _fw.params.map(function(p) { return p.name; }).join(', ');
      var _call = '_ffi.C.' + _fw.name + '(' + _pnames + ')';
      if (_fw.returnType === 'void') {
        lua.push('function ' + _fw.name + '(' + _pnames + ') ' + _call + ' end');
      } else if (_fw.returnType === 'string') {
        lua.push('function ' + _fw.name + '(' + _pnames + ') return _ffi.string(' + _call + ') end');
      } else {
        lua.push('function ' + _fw.name + '(' + _pnames + ') return tonumber(' + _call + ') end');
      }
    }
    lua.push('');
  }

  // Script block routed to Lua (when @ffi / declare function present)
  if (ctx._scriptBlockIsLua) {
    var _luaScript = ctx.scriptBlock || globalThis.__scriptContent || '';
    if (globalThis.__scriptContent && ctx.scriptBlock) {
      _luaScript = ctx.scriptBlock + '\n\n' + globalThis.__scriptContent;
    }
    if (_luaScript) {
      // Strip declare statements — they're now wrappers above
      _luaScript = _luaScript.replace(/^declare\s+.*$/gm, '');
      _luaScript = _luaScript.replace(/^<\/?script>$/gm, '');
      _luaScript = _luaScript.trim();
      if (_luaScript) {
        lua.push('-- Script block (compiled to Lua via FFI routing)');
        var _luaLines = luaTransform(_luaScript).split('\n');
        for (var li = 0; li < _luaLines.length; li++) lua.push(_luaLines[li]);
        lua.push('');
      }
    }
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
  // Sync OA data from __luaMapDataN globals (set by evalLuaMapData)
  if (ctx.objectArrays && ctx.objectArrays.length > 0) {
    var _oaSyncIdx = 0;
    for (var _oasi = 0; _oasi < ctx.objectArrays.length; _oasi++) {
      var _oaSync = ctx.objectArrays[_oasi];
      if (_oaSync.isConst || _oaSync.isNested) continue;
      lua.push('  if __luaMapData' + _oaSyncIdx + ' then ' + _oaSync.getter + ' = __luaMapData' + _oaSyncIdx + ' end');
      _oaSyncIdx++;
    }
  }
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

  // JS_LOGIC — script block content runs in QJS, called via __eval
  zig += '// ── Embedded JS logic ──\n';
  // Build JS state bindings so script functions can read/write state
  var jsStateBindings = '';
  if (ctx.stateSlots && ctx.stateSlots.length > 0) {
    for (var jsi = 0; jsi < ctx.stateSlots.length; jsi++) {
      var js = ctx.stateSlots[jsi];
      if (js.getter.indexOf('__') === 0) continue; // skip internal slots
      var jsInit = js.initial !== undefined ? JSON.stringify(js.initial) : '0';
      jsStateBindings += 'var ' + js.getter + ' = ' + jsInit + ';\n';
      // JS setter updates local var then calls Lua setter (Lua owns state).
      // Guard: at init time Lua setters aren't defined yet (JS_LOGIC loads
      // before LUA_LOGIC). __luaReady is set by engine after LUA_LOGIC loads.
      var _luaSetCall = js.type === 'string'
        ? '__luaEval("' + js.setter + '(\\\'" + v + "\\\')")'
        : '__luaEval("' + js.setter + '(" + v + ")")';
      jsStateBindings += 'function ' + js.setter + '(v) { ' + js.getter + ' = v; if (__luaReady) ' + _luaSetCall + '; else __markDirty(); }\n';
    }
  }
  // OA getters in JS — reconstruct initial data from token range
  if (ctx.objectArrays && ctx.objectArrays.length > 0) {
    var _tc = globalThis.__cursor;
    for (var joi = 0; joi < ctx.objectArrays.length; joi++) {
      var joa = ctx.objectArrays[joi];
      var _jsInit = '[]';
      if (!joa.isNested && _tc && joa.initDataStartPos !== undefined && joa.initDataEndPos !== undefined) {
        var _parts = [];
        for (var _ti = joa.initDataStartPos; _ti < joa.initDataEndPos; _ti++) {
          _parts.push(_tc.textAt(_ti));
        }
        var _raw = _parts.join(' ').trim();
        // Strip wrapping parens from useState(...)
        while (_raw.startsWith('(')) _raw = _raw.slice(1).trim();
        while (_raw.endsWith(')')) _raw = _raw.slice(0, -1).trim();
        // Strip trailing semicolons
        while (_raw.endsWith(';')) _raw = _raw.slice(0, -1).trim();
        if (_raw.length > 2) _jsInit = _raw;
      }
      jsStateBindings += 'var ' + joa.getter + ' = ' + _jsInit + ';\n';
      if (joa.setter) {
        jsStateBindings += 'function ' + joa.setter + '(v) { ' + joa.getter + ' = v; __markDirty(); }\n';
      }
    }
  }

  var jsContent = 'var __luaReady = false;\n' + jsStateBindings;
  // When FFI decls are present the script block is routed to LUA_LOGIC instead
  if (!ctx._scriptBlockIsLua) {
    if (ctx.scriptBlock) {
      // Strip TypeScript syntax: declare statements, type annotations, generics
      var _jsBlock = ctx.scriptBlock;
      _jsBlock = _jsBlock.replace(/^declare\s+.*$/gm, ''); // remove declare statements
      _jsBlock = _jsBlock.replace(/\):\s*\w+[\[\]]*\s*\{/g, ') {'); // strip return type annotations
      _jsBlock = _jsBlock.replace(/(\w)\s*:\s*(string|number|boolean|any|void|never|object)\s*([,\)])/g, '$1$3'); // strip param type annotations
      jsContent += _jsBlock;
    }
    if (globalThis.__scriptContent) {
      var _scriptCleaned = globalThis.__scriptContent;
      _scriptCleaned = _scriptCleaned.replace(/^<\/?script>$/gm, ''); // strip <script> tags
      _scriptCleaned = _scriptCleaned.replace(/^declare\s+.*$/gm, '');
      _scriptCleaned = _scriptCleaned.replace(/\):\s*\w+[\[\]]*\s*\{/g, ') {');
      _scriptCleaned = _scriptCleaned.replace(/(\w)\s*:\s*(string|number|boolean|any|void|never|object)\s*([,\)])/g, '$1$3');
      jsContent += (jsContent ? '\n' : '') + _scriptCleaned;
    }
  }
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

  // Init + tick functions (v4 pattern)
  zig += 'fn _appInit() void {\n';
  zig += '    luajit_runtime.setMapWrapper(0, @ptrCast(&_root));\n';
  zig += '    // OA data synced on first tick (after JS_LOGIC loads)\n';
  zig += '    state.markDirty();\n';
  zig += '}\n\n';

  var _hasOA = ctx.objectArrays && ctx.objectArrays.some(function(o) { return !o.isConst && !o.isNested; });
  zig += 'var _first_render: bool = true;\n';
  zig += 'fn _appTick(now: u32) void {\n';
  zig += '    _ = now;\n';
  zig += '    if (_first_render or state.isDirty()) {\n';
  // Sync OA data from QJS → Lua
  if (_hasOA) {
    var _oaTickIdx = 0;
    for (var oai = 0; oai < ctx.objectArrays.length; oai++) {
      var oa = ctx.objectArrays[oai];
      if (oa.isConst || oa.isNested) continue;
      var oaGetter = oa.getter.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
      zig += '        qjs_runtime.evalLuaMapData(' + _oaTickIdx + ', "' + oaGetter + '");\n';
      _oaTickIdx++;
    }
  }
  // Sync scalar state from QJS → Lua
  // JS_LOGIC initializes state (from <script> block). If the cart uses
  // js_on_press handlers, JS setters update QJS but never reach Lua —
  // sync must run every dirty frame. If the cart is pure lua_on_press,
  // Lua setters own state and we only need the first-render init sync
  // (syncing every frame would stomp Lua-side updates).
  if (ctx.scriptBlock || globalThis.__scriptContent) {
    if (ctx.stateSlots && ctx.stateSlots.length > 0) {
      // First render: push JS init values to Lua (script block ran in QJS first)
      zig += '        if (_first_render) {\n';
      for (var ssi = 0; ssi < ctx.stateSlots.length; ssi++) {
        var ss = ctx.stateSlots[ssi];
        if (ss.getter.indexOf('__') === 0) continue;
        var ssGetter = ss.getter.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
        zig += '            qjs_runtime.syncScalarToLua("' + ssGetter + '");\n';
      }
      zig += '        }\n';
      // Lua→QJS sync handled by __syncToJS in Lua setters (no tick sync needed)
    }
  }
  zig += '        luajit_runtime.callGlobal("__render");\n';
  zig += '        state.clearDirty();\n';
  zig += '        _first_render = false;\n';
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
