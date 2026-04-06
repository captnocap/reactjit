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
    out += `    _rebuildMap${mi}();\n`;
  }
  out += `}\n\n`;

  out += `fn _appTick(now: u32) void {\n    _ = now;\n`;
  if (ctx.usesApplescript) out += `    @import("framework/applescript.zig").pollResult();\n`;
  if (meta.hasState || ctx.objectArrays.length > 0) {
    if (meta.hasDynStyles) {
      out += `    if (state.isDirty()) { _updateDynamicTexts();`;
      if (meta.hasConds) out += ` _updateConditionals();`;
      out += `\n`;
      if (meta.hasFlatMaps) out += `        _ = _pool_arena.reset(.retain_capacity);\n`;
      for (let mi = 0; mi < ctx.maps.length; mi++) {
        if (ctx.maps[mi].isNested || ctx.maps[mi].isInline) continue;
        out += `        _rebuildMap${mi}();\n`;
      }
      out += ` state.clearDirty(); }\n`;
    } else if (ctx.maps.length > 0) {
      out += `    if (state.isDirty()) { _updateDynamicTexts();`;
      if (meta.hasConds) out += ` _updateConditionals();`;
      out += `\n`;
      if (meta.hasFlatMaps) out += `        _ = _pool_arena.reset(.retain_capacity);\n`;
      for (let mi = 0; mi < ctx.maps.length; mi++) {
        if (ctx.maps[mi].isNested || ctx.maps[mi].isInline) continue;
        out += `        _rebuildMap${mi}();\n`;
      }
      out += ` state.clearDirty(); }\n`;
    } else {
      out += `    if (state.isDirty()) {`;
      out += ` _updateDynamicTexts();`;
      if (meta.hasConds) out += ` _updateConditionals();`;
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
