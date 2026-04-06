// ── App entrypoints: init, tick, exports ──

function emitRuntimeEntrypoints(ctx, opts) {
  var out = '';
  var appName = opts.appName || 'app';
  var prefix = opts.prefix || 'framework/';
  var fastBuild = opts.fastBuild || false;
  var hasState = opts.hasState || false;
  var hasDynText = opts.hasDynText || false;
  var hasConds = opts.hasConds || false;
  var hasVariants = opts.hasVariants || false;
  var hasDynStyles = opts.hasDynStyles || false;
  var hasFlatMaps = opts.hasFlatMaps || false;
  var hasLuaMaps = ctx._luaMapRebuilders && ctx._luaMapRebuilders.length > 0;
  var hasScriptRuntime = ctx.objectArrays.some(function(o) { return !o.isConst && !o.isNested; }) || ctx.scriptBlock || ctx.luaBlock || globalThis.__scriptContent;

  // app_init
  out += 'export fn app_get_init() *const fn () void {\n';
  out += '    const _init = struct {\n';
  out += '        fn init() void {\n';

  // Register OA host functions
  for (var oi = 0; oi < ctx.objectArrays.length; oi++) {
    var oa = ctx.objectArrays[oi];
    if (oa.isConst || oa.isNested) continue;
    out += '            luajit_runtime.registerHostFn("__setObjArr' + oa.oaIdx + '", @ptrCast(&_oa' + oa.oaIdx + '_unpack), 1);\n';
  }

  // Register Lua map wrappers
  if (hasLuaMaps) {
    for (var lmi = 0; lmi < ctx._luaMapRebuilders.length; lmi++) {
      if (ctx._luaMapRebuilders[lmi].isNested) continue;
      var lmr = ctx._luaMapRebuilders[lmi];
      // Find the wrapper node in the tree
      var wrapperRef = '__lmw' + lmi;
      out += '            // Lua map ' + lmi + ' wrapper registration\n';
      // Walk arrays to find the wrapper node with matching test_id
      for (var ai = 0; ai < ctx.arrayDecls.length; ai++) {
        var decl = ctx.arrayDecls[ai];
        var wrapperPattern = '"' + wrapperRef + '"';
        if (decl.indexOf(wrapperPattern) >= 0) {
          var arrName = decl.match(/var (\w+)/);
          if (arrName) {
            // Find the index of this element in the array
            var elemIdx = 0;
            var beforeWrapper = decl.substring(0, decl.indexOf(wrapperPattern));
            var commaCount = (beforeWrapper.match(/\.{/g) || []).length - 1;
            if (commaCount >= 0) elemIdx = commaCount;
            out += '            luajit_runtime.setMapWrapper(' + lmi + ', @ptrCast(&' + arrName[1] + '[' + elemIdx + ']));\n';
          }
        }
      }
    }

    // Initial data evaluation + rebuild
    for (var ldi = 0; ldi < ctx._luaMapRebuilders.length; ldi++) {
      if (ctx._luaMapRebuilders[ldi].isNested) continue;
      var ldSrc = (ctx._luaMapRebuilders[ldi].rawSource || '').replace(/\\/g, '\\\\').replace(/"/g, '\\"');
      out += '            qjs_runtime.evalLuaMapData(' + ldi + ', "' + ldSrc + '");\n';
    }
    out += '            luajit_runtime.callGlobal("__rebuildLuaMaps");\n';
  }

  // Initial dynamic text + conditional update
  if (hasDynText) out += '            _updateDynamicText();\n';
  if (hasConds) out += '            _updateConditionals();\n';
  if (hasDynStyles) out += '            _updateDynamicStyles();\n';

  out += '        }\n';
  out += '    };\n';
  out += '    return &_init.init;\n';
  out += '}\n\n';

  // app_tick
  out += 'export fn app_get_tick() *const fn () void {\n';
  out += '    const _tick = struct {\n';
  out += '        fn tick() void {\n';
  if (hasState) {
    out += '            if (state.isDirty()) {\n';
    out += '                _dirtyTick();\n';
    out += '                state.clearDirty();\n';
    out += '            }\n';
  }
  if (hasScriptRuntime) {
    out += '            qjs_runtime.tick();\n';
    out += '            luajit_runtime.tick();\n';
  }
  out += '        }\n';
  out += '    };\n';
  out += '    return &_tick.tick;\n';
  out += '}\n\n';

  // Exports
  out += 'export fn app_get_root() *Node { return &_root; }\n';

  out += 'export fn app_get_lua_logic() [*]const u8 { return LUA_LOGIC.ptr; }\n';
  out += 'export fn app_get_lua_logic_len() usize { return LUA_LOGIC.len; }\n';
  out += 'export fn app_get_js_logic() [*]const u8 { return JS_LOGIC.ptr; }\n';
  out += 'export fn app_get_js_logic_len() usize { return JS_LOGIC.len; }\n';
  out += 'export fn app_get_title() [*]const u8 { return "' + appName + '"; }\n';
  out += 'export fn app_get_title_len() usize { return ' + appName.length + '; }\n';

  out += '\n';

  // State count + accessors
  out += 'export fn app_state_count() usize { return ' + ctx.stateSlots.length + '; }\n';

  return out;
}
