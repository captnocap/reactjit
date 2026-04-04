// Emit runtime entrypoints and export scaffold

function emitRuntimeEntrypoints(ctx, meta) {
  let out = `fn _appInit() void {\n    _initState();\n`;
  for (const oa of ctx.objectArrays) {
    if (oa.isNested || oa.isConst) continue;
    out += `    qjs_runtime.registerHostFn("__setObjArr${oa.oaIdx}", @ptrCast(&_oa${oa.oaIdx}_unpack), 1);\n`;
  }
  if (meta.hasVariants) {
    out += `    qjs_runtime.registerHostFn("__setVariant", @ptrCast(&_setVariantHost), 1);\n`;
  }
  const inputMod = `@import("${meta.prefix}input.zig")`;
  if (ctx._inputSubmitHandlers) {
    for (const h of ctx._inputSubmitHandlers) {
      out += `    ${inputMod}.setOnSubmit(${h.inputId}, &_inputSubmit${h.inputId});\n`;
    }
  }
  if (ctx._inputChangeHandlers) {
    for (const h of ctx._inputChangeHandlers) {
      out += `    ${inputMod}.setOnChange(${h.inputId}, &_inputChange${h.inputId});\n`;
    }
  }
  if (meta.hasDynText) out += `    _updateDynamicTexts();\n`;
  if (meta.hasConds) out += `    _updateConditionals();\n`;
  if (meta.hasVariants) out += `    _updateVariants();\n`;
  for (let mi = 0; mi < ctx.maps.length; mi++) {
    if (ctx.maps[mi].isNested || ctx.maps[mi].isInline) continue;
    const mapHandlers = ctx.handlers.filter(function(h) { return h.inMap && h.mapIdx === mi; });
    const fieldRefsMap = ctx.maps[mi]._handlerFieldRefsMap || {};
    for (let hi = 0; hi < mapHandlers.length; hi++) {
      // Skip init call if THIS handler uses field refs (init is inline in rebuild)
      // Only check per-handler refs — map-level flag would wrongly skip handlers without refs
      const hasFieldRefs = fieldRefsMap[hi] && fieldRefsMap[hi].length > 0;
      if (!hasFieldRefs) out += `    _initMapLuaPtrs${mi}_${hi}();\n`;
    }
  }
  if (meta.hasFlatMaps) out += `    _ = _pool_arena.reset(.retain_capacity);\n`;
  for (let mi = 0; mi < ctx.maps.length; mi++) {
    if (ctx.maps[mi].isNested || ctx.maps[mi].isInline) continue;
    if (ctx.maps[mi].mapBackend === 'lua_runtime') continue; // Lua maps rebuild via LuaJIT
    out += `    _rebuildMap${mi}();\n`;
  }
  // Register Lua map wrapper pointers and populate data for LuaJIT maps
  if (ctx._luaMapRebuilders && ctx._luaMapRebuilders.length > 0) {
    for (let lmi = 0; lmi < ctx._luaMapRebuilders.length; lmi++) {
      var lmr = ctx._luaMapRebuilders[lmi];
      // Scan arrayDecls to find the wrapper node by __lmw tag
      for (let ai = 0; ai < ctx.arrayDecls.length; ai++) {
        var decl = ctx.arrayDecls[ai];
        var tag = '__lmw' + lmi;
        var tagIdx = decl.indexOf(tag);
        if (tagIdx >= 0) {
          var arrMatch = decl.match(/^(?:pub )?var (_arr_\d+)/);
          if (arrMatch) {
            var before = decl.substring(0, tagIdx);
            var elemIdx = (before.match(/\.{/g) || []).length - 1;
            // Use bare array ref — works in both monolith (var _arr_N) and split (nodes._arr_N)
            var arrRef = meta.isSplit ? 'nodes.' + arrMatch[1] : arrMatch[1];
            out += `    luajit_runtime.setMapWrapper(${lmi}, @ptrCast(&${arrRef}[${elemIdx}]));\n`;
          }
          break;
        }
      }
      // Produce __luaMapDataN: evaluate the source JS expression and pass to LuaJIT
      var rawSource = lmr.rawSource || lmr.varName;
      var escaped = rawSource.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
      out += `    qjs_runtime.evalLuaMapData(${lmi}, "` + escaped + `");\n`;
    }
    // Call Lua rebuild at init (not just on dirty ticks)
    out += `    luajit_runtime.callGlobal("__rebuildLuaMaps");\n`;
  }
  out += `}\n\n`;

  const hasLuaMaps = ctx._luaMapRebuilders && ctx._luaMapRebuilders.length > 0;
  // Helper: emit evalLuaMapData calls for all Lua maps (re-evaluates source data on state change)
  var _luaDataEvalBlock = '';
  if (hasLuaMaps) {
    for (var _ldi = 0; _ldi < ctx._luaMapRebuilders.length; _ldi++) {
      var _ldr = ctx._luaMapRebuilders[_ldi];
      var _ldSrc = (_ldr.rawSource || _ldr.varName).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
      _luaDataEvalBlock += `        qjs_runtime.evalLuaMapData(${_ldi}, "` + _ldSrc + `");\n`;
    }
  }
  out += `fn _appTick(now: u32) void {\n    _ = now;\n`;
  if (ctx.usesApplescript) out += `    @import("framework/applescript.zig").pollResult();\n`;
  if (meta.hasState || ctx.objectArrays.length > 0 || hasLuaMaps) {
    if (meta.hasDynStyles) {
      out += `    if (state.isDirty()) { _updateDynamicTexts();`;
      if (meta.hasConds) out += ` _updateConditionals();`;
      out += `\n`;
      if (meta.hasFlatMaps) out += `        _ = _pool_arena.reset(.retain_capacity);\n`;
      for (let mi = 0; mi < ctx.maps.length; mi++) {
        if (ctx.maps[mi].isNested || ctx.maps[mi].isInline) continue;
        if (ctx.maps[mi].mapBackend === 'lua_runtime') continue;
        out += `        _rebuildMap${mi}();\n`;
      }
      if (hasLuaMaps) out += _luaDataEvalBlock + `        luajit_runtime.callGlobal("__rebuildLuaMaps");\n`;
      out += ` state.clearDirty(); }\n`;
    } else if (ctx.maps.length > 0 || hasLuaMaps) {
      out += `    if (state.isDirty()) { _updateDynamicTexts();`;
      if (meta.hasConds) out += ` _updateConditionals();`;
      out += `\n`;
      if (meta.hasFlatMaps) out += `        _ = _pool_arena.reset(.retain_capacity);\n`;
      for (let mi = 0; mi < ctx.maps.length; mi++) {
        if (ctx.maps[mi].isNested || ctx.maps[mi].isInline) continue;
        if (ctx.maps[mi].mapBackend === 'lua_runtime') continue;
        out += `        _rebuildMap${mi}();\n`;
      }
      if (hasLuaMaps) out += _luaDataEvalBlock + `        luajit_runtime.callGlobal("__rebuildLuaMaps");\n`;
      out += ` state.clearDirty(); }\n`;
    } else {
      out += `    if (state.isDirty()) {`;
      out += ` _updateDynamicTexts();`;
      if (meta.hasConds) out += ` _updateConditionals();`;
      if (hasLuaMaps) out += `\n` + _luaDataEvalBlock + `        luajit_runtime.callGlobal("__rebuildLuaMaps");`;
      out += ` state.clearDirty(); }\n`;
    }
  }
  if (meta.hasVariants) out += `    _updateVariants();\n`;
  out += `}\n\n`;

  out += `export fn app_get_root() *Node { return &_root; }\n`;
  out += `export fn app_get_init() ?*const fn () void { return _appInit; }\n`;
  out += `export fn app_get_tick() ?*const fn (u32) void { return _appTick; }\n`;
  out += `export fn app_get_js_logic() [*]const u8 { return JS_LOGIC.ptr; }\n`;
  out += `export fn app_get_js_logic_len() usize { return JS_LOGIC.len; }\n`;
  out += `export fn app_get_lua_logic() [*]const u8 { return LUA_LOGIC.ptr; }\n`;
  out += `export fn app_get_lua_logic_len() usize { return LUA_LOGIC.len; }\n`;
  out += `export fn app_get_title() [*:0]const u8 { return "${meta.appName}"; }\n\n`;

  out += `export fn app_state_count() usize { return ${ctx.stateSlots.length}; }\n`;
  if (meta.hasState) {
    const types = ctx.stateSlots.map(function(s) {
      return ({ int: 0, float: 1, boolean: 2, string: 3 }[s.type] || 0);
    });
    out += `const _slot_types = [_]u8{ ${types.join(', ')} };\n`;
    out += `export fn app_state_slot_type(id: usize) u8 { if (id < _slot_types.len) return _slot_types[id]; return 0; }\n`;
    out += `export fn app_state_get_int(id: usize) i64 { return state.getSlot(id); }\n`;
    out += `export fn app_state_set_int(id: usize, val: i64) void { state.setSlot(id, val); }\n`;
    out += `export fn app_state_get_float(id: usize) f64 { return state.getSlotFloat(id); }\n`;
    out += `export fn app_state_set_float(id: usize, val: f64) void { state.setSlotFloat(id, val); }\n`;
    out += `export fn app_state_get_bool(id: usize) u8 { return if (state.getSlotBool(id)) 1 else 0; }\n`;
    out += `export fn app_state_set_bool(id: usize, val: u8) void { state.setSlotBool(id, val != 0); }\n`;
    out += `export fn app_state_get_string_ptr(id: usize) [*]const u8 { return state.getSlotString(id).ptr; }\n`;
    out += `export fn app_state_get_string_len(id: usize) usize { return state.getSlotString(id).len; }\n`;
    out += `export fn app_state_set_string(id: usize, ptr: [*]const u8, len: usize) void { state.setSlotString(id, ptr[0..len]); }\n`;
    out += `export fn app_state_mark_dirty() void { state.markDirty(); }\n`;
  }

  out += `\npub fn main() !void {\n`;
  if (!meta.fastBuild) out += `    if (IS_LIB) return;\n`;
  out += `    try engine.run(.{\n`;
  out += `        .title = "${meta.appName}",\n`;
  out += `        .root = &_root,\n`;
  out += `        .js_logic = JS_LOGIC,\n`;
  out += `        .lua_logic = LUA_LOGIC,\n`;
  out += `        .init = _appInit,\n`;
  out += `        .tick = _appTick,\n`;
  out += `    });\n}\n`;
  return out;
}
