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
  var luaLines = [];

  // State setters → Lua
  emitStateSetters(ctx, 'lua').forEach(function(l) { luaLines.push(l); });

  // OA unpack functions → Lua
  if (ctx.objectArrays && ctx.objectArrays.length > 0) {
    for (var oi = 0; oi < ctx.objectArrays.length; oi++) {
      var oa = ctx.objectArrays[oi];
      if (oa.setter) {
        luaLines.push('function ' + oa.setter + '(v) ' + oa.getter + ' = v; __setObjArr' + oa.oaIdx + '(v) end');
      }
      luaLines.push(oa.getter + ' = {}');
    }
  }

  // Map press handlers → Lua
  for (var hi = 0; hi < ctx.handlers.length; hi++) {
    var handler = ctx.handlers[hi];
    if (!handler.inMap) continue;
    if (!handler.luaBody) continue;
    var mapIdx = handler.mapIdx !== undefined ? handler.mapIdx : 0;
    var luaBody = luaTransform(handler.luaBody);
    var pressLines = emitMapPressBody(mapIdx, hi, handler, ctx.maps[mapIdx] || {}, 'lua');
    if (pressLines && pressLines.length > 0) {
      for (var pl = 0; pl < pressLines.length; pl++) luaLines.push(pressLines[pl]);
    }
  }

  // Lua map rebuilders
  if (ctx._luaMapRebuilders && ctx._luaMapRebuilders.length > 0) {
    luaLines.push('-- Lua map rebuilders');

    luaLines.push('function __luaNestedMap(arr, fn)');
    luaLines.push('  if not arr then return nil end');
    luaLines.push('  local result = {}');
    luaLines.push('  for _ni, _nitem in ipairs(arr) do');
    luaLines.push('    result[#result + 1] = fn(_nitem, _ni)');
    luaLines.push('  end');
    luaLines.push('  return { children = result }');
    luaLines.push('end');
    luaLines.push('');

    for (var lmi = 0; lmi < ctx._luaMapRebuilders.length; lmi++) {
      var lmr = ctx._luaMapRebuilders[lmi];
      var bodyNode = lmr.bodyNode || null;
      var itemParam = lmr.itemParam || 'item';
      var indexParam = lmr.indexParam || null;

      if (bodyNode && typeof _nodeToLua === 'function') {
        var bodyLua = _nodeToLua(bodyNode, itemParam, indexParam, '      ');
        luaLines.push('function __rebuildLuaMap' + lmi + '()');
        luaLines.push('  __clearLuaNodes()');
        luaLines.push('  local wrapper = __mw' + lmi);
        luaLines.push('  if not wrapper then return end');
        luaLines.push('  local items = __luaMapData' + lmi);
        luaLines.push('  if not items or #items == 0 then');
        luaLines.push('    __declareChildren(wrapper, {})');
        luaLines.push('    return');
        luaLines.push('  end');
        luaLines.push('  local tmpl = {}');
        luaLines.push('  for _i, _item in ipairs(items) do');
        luaLines.push('    tmpl[#tmpl + 1] = ' + bodyLua);
        luaLines.push('  end');
        luaLines.push('  __declareChildren(wrapper, tmpl)');
        luaLines.push('end');
        luaLines.push('');
      } else if (lmr.luaCode) {
        var codeLines = lmr.luaCode.split('\n');
        for (var ll = 0; ll < codeLines.length; ll++) luaLines.push(codeLines[ll]);
      }
    }

    luaLines.push('function __rebuildLuaMaps()');
    luaLines.push('  __clearLuaNodes()');
    for (var lmi2 = 0; lmi2 < ctx._luaMapRebuilders.length; lmi2++) {
      if (ctx._luaMapRebuilders[lmi2].isNested) continue;
      luaLines.push('  __rebuildLuaMap' + lmi2 + '()');
    }
    luaLines.push('end');
    luaLines.push('');
  }

  // Emit LUA_LOGIC
  var out = '// ── Embedded Lua logic ─────────────────────────────────────────\n';
  if (luaLines.length > 0) {
    out += 'const LUA_LOGIC =\n';
    for (var li = 0; li < luaLines.length; li++) {
      out += '    \\\\' + luaLines[li] + '\n';
    }
    out += ';\n\n';
  } else {
    out += 'const LUA_LOGIC = "";\n\n';
  }

  return out;
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
