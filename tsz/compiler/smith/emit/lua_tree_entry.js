// ── Lua tree: Zig entry/exports ─────────────────────────────
// Emits _appInit, _appTick, exports, and main() for lua-tree apps.

function emitLuaTreeEntry(ctx, appName, prefix) {
  var zig = '';
  var nativePlan = ctx.nativePlan;

  // Init + tick functions (v4 pattern)
  zig += 'fn _appInit() void {\n';
  zig += '    luajit_runtime.setMapWrapper(0, @ptrCast(&_root));\n';
  if (nativePlan && nativePlan.registrations && nativePlan.registrations.length > 0) {
    for (var nri = 0; nri < nativePlan.registrations.length; nri++) {
      var reg = nativePlan.registrations[nri];
      zig += '    qjs_runtime.registerHostFn(' + zigStringLiteral(reg.name) + ', @ptrCast(&' + reg.qjsWrapper + '), ' + reg.argCount + ');\n';
      zig += '    luajit_runtime.registerHostFn(' + zigStringLiteral(reg.name) + ', @ptrCast(&' + reg.luaWrapper + '), ' + reg.argCount + ');\n';
    }
  }
  if (nativePlan && nativePlan.initJsExprs && nativePlan.initJsExprs.length > 0) {
    for (var nei = 0; nei < nativePlan.initJsExprs.length; nei++) {
      zig += '    qjs_runtime.evalExpr(' + zigStringLiteral(nativePlan.initJsExprs[nei]) + ');\n';
    }
  }
  // Register effect render fns + shaders so luajit_runtime can resolve by id
  if (ctx.effectRenders && ctx.effectRenders.length > 0) {
    for (var efi = 0; efi < ctx.effectRenders.length; efi++) {
      var eid = ctx.effectRenders[efi].id;
      zig += '    luajit_runtime.setEffectRender(' + eid + ', &_effect_render_' + eid + ');\n';
      zig += '    luajit_runtime.setEffectShader(' + eid + ', &_effect_shader_' + eid + ');\n';
    }
  }
  zig += '    // OA data synced on first tick (after JS_LOGIC loads)\n';
  zig += '    state.markDirty();\n';
  zig += '}\n\n';

  var _hasOA = ctx.objectArrays && ctx.objectArrays.some(function(o) { return !o.isConst && !o.isNested; });
  var fastBuild = globalThis.__fastBuild === 1;

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
      var oaSourceExpr = oa.getter;
      if (ctx._luaMapRebuilders &&
          ctx._luaMapRebuilders[_oaTickIdx] &&
          ctx._luaMapRebuilders[_oaTickIdx].dataVar === oa.getter &&
          ctx._luaMapRebuilders[_oaTickIdx].rawSource) {
        oaSourceExpr = ctx._luaMapRebuilders[_oaTickIdx].rawSource;
      } else if (oa._computedExpr) {
        oaSourceExpr = oa._computedExpr;
      }
      // evalLuaMapData runs its expression argument directly in QJS. Any
      // `qjs_runtime.evalToString("String(X)", &_eval_buf_N)` wrapper that
      // upstream stages added is Zig FFI syntax — it can't survive a QJS
      // eval. Strip those wrappers back to the raw JS expression so QJS
      // sees `X` instead of `qjs_runtime.evalToString(...)`.
      oaSourceExpr = _a040_unwrapZigEvalWrappers(oaSourceExpr);
      zig += '        qjs_runtime.evalLuaMapData(' + _oaTickIdx + ', ' + zigStringLiteral(oaSourceExpr) + ');\n';
      _oaTickIdx++;
    }
  }
  // Sync scalar state from QJS → Lua
  if (ctx.scriptBlock || globalThis.__scriptContent) {
    if (ctx.stateSlots && ctx.stateSlots.length > 0) {
      zig += '        if (_first_render) {\n';
      for (var ssi = 0; ssi < ctx.stateSlots.length; ssi++) {
        var ss = ctx.stateSlots[ssi];
        if (ss.getter.indexOf('__') === 0) continue;
        zig += '            qjs_runtime.syncScalarToLua(' + zigStringLiteral(ss.getter) + ');\n';
      }
      zig += '        }\n';
    }
  }
  // Sync variant index to Lua before render
  if (ctx.variantNames && ctx.variantNames.length > 0) {
    zig += '        luajit_runtime.setGlobalInt("__variant", @import("' + prefix + 'api.zig").theme.activeVariant());\n';
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
  zig += 'export fn app_get_title() [*:0]const u8 { return ' + zigStringLiteral(appName) + '; }\n\n';

  zig += 'export fn app_state_count() usize { return ' + (ctx.stateSlots ? ctx.stateSlots.length : 0) + '; }\n';

  // Main function
  zig += '\npub fn main() !void {\n';
  if (!fastBuild) zig += '    if (IS_LIB) return;\n';
  zig += '    try engine.run(.{\n';
  zig += '        .title = ' + zigStringLiteral(appName) + ',\n';
  zig += '        .root = &_root,\n';
  zig += '        .init = _appInit,\n';
  zig += '        .tick = _appTick,\n';
  zig += '        .js_logic = JS_LOGIC,\n';
  zig += '        .lua_logic = LUA_LOGIC,\n';
  if (ctx.borderless) zig += '        .borderless = true,\n';
  zig += '    });\n';
  zig += '}\n';

  return zig;
}

// Strip any `qjs_runtime.evalToString("String(X)", &_eval_buf_N)` wrappers out
// of an OA source expression so the resulting string is pure JS. Handles nested
// occurrences (the wrapper can appear as the left operand of `||`). Returns the
// input unchanged if no wrapper is detected.
function _a040_unwrapZigEvalWrappers(expr) {
  if (!expr || typeof expr !== 'string') return expr;
  if (expr.indexOf('qjs_runtime.evalToString') < 0 && expr.indexOf('&_eval_buf_') < 0 &&
      expr.indexOf('&st._eval_buf_') < 0) return expr;
  var out = expr;
  for (var pass = 0; pass < 6; pass++) {
    var prev = out;
    // evalToString("String(X)", &..._eval_buf_N) → X
    out = out.replace(/qjs_runtime\.evalToString\(\s*"String\(([\s\S]+?)\)"\s*,\s*&[\w.]+\)/g, '$1');
    // Fallback: `qjs_runtime.evalToString(..., &..._eval_buf_N)` (any first arg)
    out = out.replace(/qjs_runtime\.evalToString\(\s*("(?:[^"\\]|\\.)*")\s*,\s*&[\w.]+\)/g, function(_, s) {
      // Decode the first-arg zig string literal back to the raw expression.
      var inner = s.slice(1, -1).replace(/\\"/g, '"').replace(/\\\\/g, '\\');
      var m = inner.match(/^String\(([\s\S]+)\)$/);
      return m ? m[1] : inner;
    });
    // Strip lone `&st._eval_buf_N` / `&_eval_buf_N` artifacts if any stragglers
    // survived upstream rewrites.
    out = out.replace(/,\s*&(?:st\.)?_eval_buf_\d+/g, '');
    if (out === prev) break;
  }
  return out;
}
