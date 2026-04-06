// ── JS_LOGIC + LUA_LOGIC generation ──
// All map content goes to Lua. No Zig dynamic maps.

function emitLogicBlocks(ctx) {
  var out = '';
  var jsLines = [];
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
      // Declare global for getter
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
    // Map handlers that reference item fields need the dispatch pattern
    var pressLines = emitMapPressBody(mapIdx, hi, handler, ctx.maps[mapIdx] || {}, 'lua');
    if (pressLines && pressLines.length > 0) {
      for (var pl = 0; pl < pressLines.length; pl++) luaLines.push(pressLines[pl]);
    }
  }

  // Lua map rebuilders — emit from parsed tree via _nodeToLua
  if (ctx._luaMapRebuilders && ctx._luaMapRebuilders.length > 0) {
    luaLines.push('-- Lua map rebuilders');

    // Nested map helper (once)
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
        // New path: emit from parsed tree
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
        // Fallback: pre-generated code
        var codeLines = lmr.luaCode.split('\n');
        for (var ll = 0; ll < codeLines.length; ll++) luaLines.push(codeLines[ll]);
      }
    }

    // Master rebuild
    luaLines.push('function __rebuildLuaMaps()');
    luaLines.push('  __clearLuaNodes()');
    for (var lmi2 = 0; lmi2 < ctx._luaMapRebuilders.length; lmi2++) {
      if (ctx._luaMapRebuilders[lmi2].isNested) continue;
      luaLines.push('  __rebuildLuaMap' + lmi2 + '()');
    }
    luaLines.push('end');
    luaLines.push('');
  }

  // Script content → JS_LOGIC (not Lua)
  if (ctx.scriptBlock) {
    var jsBlock = jsTransform(ctx.scriptBlock);
    jsLines.push(jsBlock);
  }
  if (globalThis.__scriptContent) {
    jsLines.push(jsTransform(globalThis.__scriptContent));
  }

  // Emit JS_LOGIC
  if (jsLines.length > 0) {
    out += 'const JS_LOGIC =\n';
    for (var ji = 0; ji < jsLines.length; ji++) {
      out += '    \\\\' + jsLines[ji] + '\n';
    }
    out += ';\n\n';
  } else {
    out += 'const JS_LOGIC = "";\n\n';
  }

  // Emit LUA_LOGIC
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
