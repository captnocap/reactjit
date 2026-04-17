function _normalizeLuaMapSourceExpr(expr) {
  if (expr === undefined || expr === null) return expr;
  var out = String(expr).trim();
  if (typeof _expandRenderLocalJsFully === 'function') out = _expandRenderLocalJsFully(out);
  out = out.replace(/qjs_runtime\.evalToString\("String\(((?:[^"\\]|\\.)+)\)"[^)]*\)/g, '$1');
  out = out.replace(/qjs_runtime\.evalToString\("((?:[^"\\]|\\.)+)"[^)]*\)/g, '$1');
  out = out.replace(/,\s*&_eval_buf_\d+/g, '');
  out = out.replace(/&_eval_buf_\d+/g, '');
  if (typeof _normalizeJoinedJsExpr === 'function') out = _normalizeJoinedJsExpr(out);
  return out;
}

function _tryParseComputedChainMap(c, children, baseName, baseExpr, consumeClosingBrace) {
  if (consumeClosingBrace === undefined) consumeClosingBrace = true;
  const saved = c.save();
  c.advance(); // skip base identifier
  const suffixStart = c.save();
  let dotPos = -1;
  let mapPos = -1;
  let depthParen = 0;
  let depthBracket = 0;
  let depthBrace = 0;
  while (c.pos < c.count) {
    if (depthParen === 0 && depthBracket === 0 && depthBrace === 0 &&
        c.kind() === TK.dot &&
        c.pos + 2 < c.count &&
        c.kindAt(c.pos + 1) === TK.identifier &&
        c.textAt(c.pos + 1) === 'map' &&
        c.kindAt(c.pos + 2) === TK.lparen) {
      dotPos = c.pos;
      mapPos = c.pos + 1;
      break;
    }
    if (c.kind() === TK.lparen) depthParen++;
    else if (c.kind() === TK.rparen) {
      if (depthParen > 0) depthParen--;
    } else if (c.kind() === TK.lbracket) depthBracket++;
    else if (c.kind() === TK.rbracket) {
      if (depthBracket > 0) depthBracket--;
    } else if (c.kind() === TK.lbrace) depthBrace++;
    else if (c.kind() === TK.rbrace) {
      if (depthBrace === 0) break;
      depthBrace--;
    }
    c.advance();
  }
  if (mapPos < 0) { c.restore(saved); return false; }

  const suffixParts = [];
  for (let ti = suffixStart; ti < dotPos; ti++) suffixParts.push(c.textAt(ti));
  const suffixText = suffixParts.join('');

  c.restore(mapPos);
  const header = tryParseMapHeaderFromMethod(c, '_item', '_i');
  if (!header) { c.restore(saved); return false; }

  let closePos = c.save();
  let parenDepth = 1;
  while (closePos < c.count && parenDepth > 0) {
    if (c.kindAt(closePos) === TK.lparen) parenDepth++;
    else if (c.kindAt(closePos) === TK.rparen) parenDepth--;
    closePos++;
  }
  const snippetParts = [];
  for (let ti2 = mapPos; ti2 < closePos; ti2++) snippetParts.push(c.textAt(ti2));
  const mapSnippet = snippetParts.join('');

  const getterName = _sanitizeComputedGetter(baseName, suffixText);
  const mapExpr = _normalizeLuaMapSourceExpr((baseExpr ? '(' + baseExpr + ')' : baseName) + suffixText);

  // ── Lua detour: if the source is render-local/computed, route to LuaJIT ──
  // .map() content ALWAYS goes to Lua. Use the normal parser for Zig side
  // effects (OA registration, map context), then emit_atoms/maps_lua
  // for the Lua template generation (handles nested JSX trees).
  var _isRenderLocal = ctx._renderLocalRaw && ctx._renderLocalRaw[baseName] !== undefined;
  var _isStateOa = false;
  for (var _oai = 0; _oai < ctx.objectArrays.length; _oai++) {
    if (ctx.objectArrays[_oai].getter === baseName && !ctx.objectArrays[_oai]._computedExpr) {
      _isStateOa = true; break;
    }
  }
  if (_isRenderLocal && !_isStateOa) {
    // Save cursor at JSX body start for the Lua emitter
    var _luaJsxPos = c.save();

    // Let the normal Zig path parse the JSX and create the OA.
    var oa = _ensureSyntheticComputedOa(getterName, mapExpr, mapSnippet, header);
    if (ctx.currentMap) oa.isNested = true;
    c.restore(mapPos);
    var mapResult = tryParsePlainMapFromMethod(c, oa, oa._computedHeader || header);
    if (!mapResult) { c.restore(saved); return false; }

    // Save where the cursor ended up after parse (past the map body)
    var _afterParsePos = c.save();

    // Tag the map for Lua routing — emit will skip Zig rebuild, use evalLuaMapData instead
    var mapIdx = -1;
    for (var _mi = 0; _mi < ctx.maps.length; _mi++) {
      if (ctx.maps[_mi].oa === oa) { mapIdx = _mi; break; }
    }
    if (mapIdx >= 0) ctx.maps[mapIdx].mapBackend = 'lua_runtime';

    // Use the PARSED node result — convert Zig template → Lua table
    if (!ctx._luaMapRebuilders) ctx._luaMapRebuilders = [];
    var _luaIdx = ctx._luaMapRebuilders.length;
    var _luaRaw = _normalizeLuaMapSourceExpr(mapExpr);
    var _luaTemplateExpr = (mapIdx >= 0 && ctx.maps[mapIdx].templateExpr) || mapResult.templateNodeExpr || '.{}';
    var _luaBody = _nodeResultToLuaRebuilder(_luaIdx, { templateNodeExpr: _luaTemplateExpr }, oa);
    ctx._luaMapRebuilders.push({
      index: _luaIdx,
      luaCode: _luaBody,
      oaIdx: oa.oaIdx,
      bodyNode: mapResult.luaNode || null,
      itemParam: header.itemParam || '_item',
      indexParam: header.indexParam || null,
      parentItemParam: ctx.currentMap ? ctx.currentMap.itemParam : null,
      parentIndexParam: ctx.currentMap ? ctx.currentMap.indexParam : null,
      filterConditions: mapIdx >= 0 ? ctx.maps[mapIdx].filterConditions : null,
      dataVar: ctx.currentMap ? null : oa.getter,
      rawSource: _luaRaw,
      varName: baseName,
      isNested: !!ctx.currentMap
    });
    children.push({ nodeExpr: '.{ .test_id = "__lmw' + _luaIdx + '" }', _luaMapWrapper: _luaIdx });
    if (consumeClosingBrace && c.kind() === TK.rbrace) c.advance();
    return true;
  }

  // All computed chain maps go to Lua — same pattern as render-local path above.
  var _ccLuaJsxPos = c.save();
  var oa = _ensureSyntheticComputedOa(getterName, mapExpr, mapSnippet, header);
  if (ctx.currentMap) oa.isNested = true;

  c.restore(mapPos);
  var mapResult = tryParsePlainMapFromMethod(c, oa, oa._computedHeader || header);
  if (!mapResult) { c.restore(saved); return false; }
  var _ccAfterPos = c.save();

  var _ccMapIdx = -1;
  for (var _ccmi = 0; _ccmi < ctx.maps.length; _ccmi++) {
    if (ctx.maps[_ccmi].oa === oa) { _ccMapIdx = _ccmi; break; }
  }
  if (_ccMapIdx >= 0) ctx.maps[_ccMapIdx].mapBackend = 'lua_runtime';

  if (!ctx._luaMapRebuilders) ctx._luaMapRebuilders = [];
  var _ccLuaIdx = ctx._luaMapRebuilders.length;
    var _ccRawSource = _normalizeLuaMapSourceExpr(mapExpr);
  // Use the PARSED node result — the parser already walked the JSX and built the
  // template node expression. Just convert Zig syntax → Lua table syntax.
  var _ccTemplateExpr = (_ccMapIdx >= 0 && ctx.maps[_ccMapIdx].templateExpr) || mapResult.templateNodeExpr || '.{}';
  var _ccLuaBody = _nodeResultToLuaRebuilder(_ccLuaIdx, { templateNodeExpr: _ccTemplateExpr }, oa);
  c.restore(_ccAfterPos);
  ctx._luaMapRebuilders.push({
    index: _ccLuaIdx,
    luaCode: _ccLuaBody,
    oaIdx: oa.oaIdx,
    bodyNode: mapResult.luaNode || null,
    itemParam: header.itemParam || '_item',
    indexParam: header.indexParam || null,
    parentItemParam: ctx.currentMap ? ctx.currentMap.itemParam : null,
    parentIndexParam: ctx.currentMap ? ctx.currentMap.indexParam : null,
    filterConditions: _ccMapIdx >= 0 ? ctx.maps[_ccMapIdx].filterConditions : null,
    dataVar: ctx.currentMap ? null : oa.getter,
    rawSource: _ccRawSource,
    varName: baseName,
    isNested: !!ctx.currentMap
  });
  children.push({ nodeExpr: '.{ .test_id = "__lmw' + _ccLuaIdx + '" }', _luaMapWrapper: _ccLuaIdx });
  if (consumeClosingBrace && c.kind() === TK.rbrace) c.advance();
  return true;
}

function _identifierStartsMapCall(c) {
  if (c.kind() !== TK.identifier || c.pos + 3 >= c.count || c.kindAt(c.pos + 1) !== TK.dot) return false;
  const savedPeek = c.save();
  c.advance();
  c.advance();
  // Skip through field access chains: item.field1.field2.map(...)
  while (c.kind() === TK.identifier && !c.isIdent('map') && !c.isIdent('slice') && !c.isIdent('filter') && !c.isIdent('sort') &&
         c.pos + 1 < c.count && c.kindAt(c.pos + 1) === TK.dot) {
    c.advance(); // field
    c.advance(); // .
  }
  let isMapCall = c.isIdent('map') && c.pos + 1 < c.count && c.kindAt(c.pos + 1) === TK.lparen;
  while (!isMapCall && (c.isIdent('slice') || c.isIdent('filter') || c.isIdent('sort')) && c.pos + 1 < c.count && c.kindAt(c.pos + 1) === TK.lparen) {
    c.advance();
    c.advance();
    let pd = 1;
    while (c.pos < c.count && pd > 0) {
      if (c.kind() === TK.lparen) pd++;
      if (c.kind() === TK.rparen) pd--;
      if (pd > 0) c.advance();
    }
    if (c.kind() === TK.rparen) c.advance();
    if (c.kind() === TK.dot) {
      c.advance();
      isMapCall = c.isIdent('map') && c.pos + 1 < c.count && c.kindAt(c.pos + 1) === TK.lparen;
    } else {
      break;
    }
  }
  c.restore(savedPeek);
  return isMapCall;
}

function _identifierMapHasBlockBody(c) {
  const saved = c.save();
  c.advance();
  let depthParen = 0;
  let depthBracket = 0;
  let depthBrace = 0;
  let mapPos = -1;
  while (c.pos < c.count) {
    if (depthParen === 0 && depthBracket === 0 && depthBrace === 0 &&
        c.kind() === TK.dot &&
        c.pos + 2 < c.count &&
        c.kindAt(c.pos + 1) === TK.identifier &&
        c.textAt(c.pos + 1) === 'map' &&
        c.kindAt(c.pos + 2) === TK.lparen) {
      mapPos = c.pos + 1;
      break;
    }
    if (c.kind() === TK.lparen) depthParen++;
    else if (c.kind() === TK.rparen) { if (depthParen > 0) depthParen--; }
    else if (c.kind() === TK.lbracket) depthBracket++;
    else if (c.kind() === TK.rbracket) { if (depthBracket > 0) depthBracket--; }
    else if (c.kind() === TK.lbrace) depthBrace++;
    else if (c.kind() === TK.rbrace) { if (depthBrace > 0) depthBrace--; }
    c.advance();
  }
  if (mapPos < 0) { c.restore(saved); return false; }
  c.restore(mapPos);
  c.advance(); // map
  if (c.kind() !== TK.lparen) { c.restore(saved); return false; }
  c.advance(); // (
  let callDepth = 1;
  while (c.pos < c.count) {
    if (c.kind() === TK.arrow && callDepth === 1) {
      c.advance();
      const isBlock = c.kind() === TK.lbrace;
      c.restore(saved);
      return isBlock;
    }
    if (c.kind() === TK.lparen || c.kind() === TK.lbracket || c.kind() === TK.lbrace) callDepth++;
    else if (c.kind() === TK.rparen || c.kind() === TK.rbracket || c.kind() === TK.rbrace) callDepth--;
    c.advance();
  }
  c.restore(saved);
  return false;
}

// ── Peek at map body to detect dynamic content that Zig can't resolve ──
// Returns true if the map body contains ternaries (?:), handlers (onPress=),
// or nested .map() calls. These patterns MUST go to Lua.
function _peekMapBodyHasDynamicContent(c) {
  var saved = c.save();
  // Walk from identifier to .map(
  var foundMap = false;
  while (c.pos < c.count) {
    if (c.kind() === TK.dot && c.pos + 2 < c.count &&
        c.kindAt(c.pos + 1) === TK.identifier && c.textAt(c.pos + 1) === 'map' &&
        c.kindAt(c.pos + 2) === TK.lparen) {
      c.advance(); c.advance(); c.advance(); // . map (
      foundMap = true;
      break;
    }
    c.advance();
  }
  if (!foundMap) { c.restore(saved); return false; }
  // Skip callback header to =>
  while (c.pos < c.count && c.kind() !== TK.arrow) c.advance();
  if (c.kind() !== TK.arrow) { c.restore(saved); return false; }
  c.advance(); // skip =>
  // Scan body — depth 1 because we're inside .map(
  var depth = 1;
  var hasDynamic = false;
  while (c.pos < c.count && depth > 0) {
    if (c.kind() === TK.lparen || c.kind() === TK.lbrace || c.kind() === TK.lbracket) depth++;
    else if (c.kind() === TK.rparen || c.kind() === TK.rbrace || c.kind() === TK.rbracket) {
      depth--;
      if (depth === 0) break;
    }
    // Ternary
    if (c.kind() === TK.question) { hasDynamic = true; break; }
    // Handler attributes: onPress=, onClick=, onChange=, onSubmit=, etc.
    if (c.kind() === TK.identifier && /^on[A-Z]/.test(c.text()) &&
        c.pos + 1 < c.count && c.kindAt(c.pos + 1) === TK.equals) {
      hasDynamic = true; break;
    }
    // Nested .map(
    if (c.kind() === TK.dot && c.pos + 2 < c.count &&
        c.kindAt(c.pos + 1) === TK.identifier && c.textAt(c.pos + 1) === 'map' &&
        c.kindAt(c.pos + 2) === TK.lparen) {
      hasDynamic = true; break;
    }
    c.advance();
  }
  c.restore(saved);
  return hasDynamic;
}

function _tryParseIdentifierMapExpression(c, children, consumeClosingBrace) {
  if (consumeClosingBrace === undefined) consumeClosingBrace = true;
  if (c.kind() !== TK.identifier) return false;

  const maybeArr = c.text();
  if (ctx._renderLocalRaw && ctx._renderLocalRaw[maybeArr]) {
    var rawExpr = ctx._renderLocalRaw[maybeArr];
    // Render-local map → route through _tryParseComputedChainMap which
    // handles the Lua detour using the parser (not raw token walking).
    if (_tryParseComputedChainMap(c, children, maybeArr, rawExpr, consumeClosingBrace)) return true;
  }

  if (!_identifierStartsMapCall(c)) {
    // Function-call / computed sources like pulseRows().map(...) don't
    // start as identifier.map(...), but they still need the Lua runtime
    // map path rather than being silently dropped.
    if (_tryParseComputedChainMap(c, children, maybeArr, null, consumeClosingBrace)) return true;
    return false;
  }

  // Nested map on item field: itemParam.field.map((x) => <JSX>)
  // The item param isn't an OA — the field is a nested array on the parent item.
  // Route directly to Lua: build a Lua rebuilder using the token walker.
  if (ctx.currentMap && maybeArr === ctx.currentMap.itemParam) {
    var _savedNested = c.save();
    // Walk past item.field chain to find .map(
    c.advance(); // skip item param
    while (c.kind() === TK.dot && c.pos + 1 < c.count && c.kindAt(c.pos + 1) === TK.identifier) {
      c.advance(); // .
      if (c.text() === 'map' && c.pos + 1 < c.count && c.kindAt(c.pos + 1) === TK.lparen) break;
      c.advance(); // field
    }
    if (c.text() === 'map' && c.pos + 1 < c.count && c.kindAt(c.pos + 1) === TK.lparen) {
      c.advance(); // skip 'map'
      c.advance(); // skip (
      // Parse the callback header: (param) => or (param, idx) =>
      if (c.kind() === TK.lparen) c.advance(); // skip inner ( for destructured params
      var _nmParam = c.kind() === TK.identifier ? c.text() : '_item';
      c.advance(); // skip param
      var _nmIdxParam = null;
      if (c.kind() === TK.comma) { c.advance(); if (c.kind() === TK.identifier) { _nmIdxParam = c.text(); c.advance(); } } // capture optional index param
      if (c.kind() === TK.rparen) c.advance(); // )
      if (c.kind() === TK.arrow) c.advance(); // =>
      // Now at the JSX body — use the token walker for Lua template
      if (!ctx._luaMapRebuilders) ctx._luaMapRebuilders = [];
      var _nmIdx = ctx._luaMapRebuilders.length;
      // Build raw JS expression for the nested array data source
      var _nmParts = [];
      for (var _ri = _savedNested; _ri < c.pos; _ri++) _nmParts.push(c.textAt(_ri));
      // Reconstruct: itemParam.field (the array source, without .map(...))
      var _rawTokens = [];
      var _rSaved = c.save();
      c.restore(_savedNested);
      while (c.pos < c.count && !(c.text() === 'map' && c.pos + 1 < c.count && c.kindAt(c.pos + 1) === TK.lparen)) {
        _rawTokens.push(c.text());
        c.advance();
      }
      c.restore(_rSaved);
      var _nmRawSource = _rawTokens.join(' ').replace(/\s*\.\s*$/, '');
      // Replace outer map item param with _item (e.g. "group . items" → "_item.items")
      if (ctx.currentMap && ctx.currentMap.itemParam) {
        _nmRawSource = _nmRawSource.replace(new RegExp('\\b' + ctx.currentMap.itemParam + '\\b', 'g'), '_item');
      }
      // Clean spaces around dots: "_item . items" → "_item.items"
      _nmRawSource = _normalizeLuaMapSourceExpr(_nmRawSource.replace(/\s*\.\s*/g, '.'));
      // Parse JSX body into a node structure for emit_atoms/maps_lua to convert
      // Substitution of param names (_item→_nitem, etc) happens in _nodeToLua
      var _nmBodyNode = null;
      if (c.kind() === TK.lt || c.kind() === TK.lparen) {
        if (c.kind() === TK.lparen) c.advance(); // skip ( wrapping JSX
        // Temporarily set nested map context for parsing
        var _savedCtxMap = ctx.currentMap;
        ctx.currentMap = { itemParam: _nmParam, indexParam: _nmIdxParam, isNested: true };
        // Parse the JSX element using the standard element parser
        _nmBodyNode = _parseJsxForLuaMapBody(c);
        ctx.currentMap = _savedCtxMap;
        if (c.kind() === TK.rparen) c.advance(); // close ( wrapper
      }
      // Consume closing parens/braces from the .map() call
      while (c.kind() === TK.rparen) c.advance();
      if (consumeClosingBrace && c.kind() === TK.rbrace) c.advance();
      ctx._luaMapRebuilders.push({
        index: _nmIdx,
        luaCode: '',
        bodyNode: _nmBodyNode,
        itemParam: _nmParam || '_item',
        indexParam: _nmIdxParam || null,
        filterConditions: null,
        rawSource: _nmRawSource,
        varName: maybeArr,
        isNested: !!ctx.currentMap
      });
      children.push({ nodeExpr: '.{ .test_id = "__lmw' + _nmIdx + '" }', _luaMapWrapper: _nmIdx });
      return true;
    }
    c.restore(_savedNested);
  }

  let oa = ctx.objectArrays.find(o => o.getter === maybeArr);
  if (!oa) oa = inferOaFromSource(c, maybeArr);
  if (!oa) {
    // Plain identifier maps like topics.map(...) or related.map(...) do not
    // necessarily have an OA backing. Route them through the generic Lua
    // runtime map path so the callback body is consumed as a map instead of
    // leaking the closing "))" into text children.
    var rawExpr = null;
    if (ctx._renderLocalRaw && typeof ctx._renderLocalRaw[maybeArr] === 'string') {
      rawExpr = ctx._renderLocalRaw[maybeArr];
    } else if (ctx.propStack && typeof ctx.propStack[maybeArr] === 'string') {
      rawExpr = ctx.propStack[maybeArr];
    } else if (ctx.renderLocals && typeof ctx.renderLocals[maybeArr] === 'string') {
      rawExpr = ctx.renderLocals[maybeArr];
    } else {
      rawExpr = maybeArr;
    }
    if (_tryParseComputedChainMap(c, children, maybeArr, rawExpr, consumeClosingBrace)) return true;
    globalThis.__dbg = globalThis.__dbg || [];
    globalThis.__dbg.push('[OA_MISS] maybeArr=' + maybeArr + ' oaCount=' + ctx.objectArrays.length + ' getters=' + ctx.objectArrays.map(function(o) { return o.getter; }).join(','));
    return false;
  }

  // ── ALL OA maps route to Lua. No exceptions. ──
  // Zig cannot handle mapped content. LuaJIT handles all map templates.
  // Token-walk the JSX body to build a Lua template (handles ternaries,
  // colors, conditionals natively). Also run the Zig parser for OA
  // bookkeeping (field registration, map count tracking).
  {
    // Step 1: Walk to map callback body to get itemParam and JSX start pos
    var _dynSaved = c.save();
    c.advance(); // skip identifier
    while (c.pos < c.count) {
      if (c.kind() === TK.dot && c.pos + 2 < c.count &&
          c.kindAt(c.pos + 1) === TK.identifier && c.textAt(c.pos + 1) === 'map' &&
          c.kindAt(c.pos + 2) === TK.lparen) {
        c.advance(); c.advance(); c.advance(); // . map (
        break;
      }
      c.advance();
    }
    if (c.kind() === TK.lparen) c.advance();
    // `.map(function(w, i) => ...)` — skip the `function` keyword + its `(`.
    // Without this, `_dynItemParam` binds to the literal string "function",
    // and every `w.X` inside the callback body emits as `(w).X` with no
    // map-rename (see d162_inlined_component_prop_fields).
    if (c.isIdent('function')) {
      c.advance();
      if (c.kind() === TK.lparen) c.advance();
    }
    var _dynItemParam = c.kind() === TK.identifier ? c.text() : '_item';
    c.advance();
    var _dynIdxParam = null;
    if (c.kind() === TK.comma) { c.advance(); if (c.kind() === TK.identifier) { _dynIdxParam = c.text(); c.advance(); } }
    if (c.kind() === TK.rparen) c.advance();
    if (c.kind() === TK.arrow) c.advance();
    // Skip block body to find 'return' before JSX
    if (c.kind() === TK.lbrace) {
      c.advance();
      var _blockDepth = 0;
      while (c.pos < c.count) {
        if (c.kind() === TK.lbrace) _blockDepth++;
        else if (c.kind() === TK.rbrace) {
          if (_blockDepth === 0) break;
          _blockDepth--;
        }
        if (_blockDepth === 0 &&
            ((c.kind() === TK.identifier && c.text() === 'return') ||
             (c.kind() === TK.keyword && c.text() === 'return'))) {
          c.advance();
          break;
        }
        c.advance();
      }
    }
    var _luaJsxPos = c.save();

    // Step 2: Run Zig parser for OA bookkeeping (map registration, field tracking)
    c.restore(_dynSaved);
    var _zigMapResult = tryParseMap(c, oa);
    if (!_zigMapResult) return false;
    var _afterParsePos = c.save();

    // Step 3: Tag map as lua_runtime
    var _dynMapIdx = -1;
    for (var _dmi = 0; _dmi < ctx.maps.length; _dmi++) {
      if (ctx.maps[_dmi].oa === oa) _dynMapIdx = _dmi;
    }
    if (_dynMapIdx >= 0) ctx.maps[_dynMapIdx].mapBackend = 'lua_runtime';

    for (var _dhi = 0; _dhi < ctx.handlers.length; _dhi++) {
      if (ctx.handlers[_dhi].inMap && ctx.handlers[_dhi].mapIdx === _dynMapIdx) {
        ctx.handlers[_dhi].luaMapRouted = true;
      }
    }

    // Step 4: Use parsed result — convert Zig template → Lua table
    if (!ctx._luaMapRebuilders) ctx._luaMapRebuilders = [];
    var _dynLuaIdx = ctx._luaMapRebuilders.length;
    var _dynTemplateExpr = (_dynMapIdx >= 0 && ctx.maps[_dynMapIdx].templateExpr) || _zigMapResult.templateNodeExpr || '.{}';
    if (_dynTemplateExpr === '.{}') throw new Error('[luaMap] EMPTY TEMPLATE: _dynMapIdx=' + _dynMapIdx + ' maps.len=' + ctx.maps.length + ' zigResult=' + JSON.stringify(Object.keys(_zigMapResult || {})));
    var _dynLuaBody = _nodeResultToLuaRebuilder(_dynLuaIdx, { templateNodeExpr: _dynTemplateExpr }, oa);

    // Step 5: Register Lua rebuilder and push wrapper placeholder
    ctx._luaMapRebuilders.push({
      index: _dynLuaIdx,
      luaCode: _dynLuaBody,
      oaIdx: oa.oaIdx,
      bodyNode: _zigMapResult.luaNode || null,
      itemParam: _dynItemParam || '_item',
      indexParam: _dynIdxParam || null,
      parentItemParam: ctx.currentMap ? ctx.currentMap.itemParam : null,
      parentIndexParam: ctx.currentMap ? ctx.currentMap.indexParam : null,
      filterConditions: _dynMapIdx >= 0 ? ctx.maps[_dynMapIdx].filterConditions : null,
      rawSource: _normalizeLuaMapSourceExpr(rawExpr),
      varName: maybeArr,
      isNested: !!ctx.currentMap
    });
    children.push({ nodeExpr: '.{ .test_id = "__lmw' + _dynLuaIdx + '" }', _luaMapWrapper: _dynLuaIdx });
    if (consumeClosingBrace && c.kind() === TK.rbrace) c.advance();
    return true;
  }
}


// ── Helper: Parse JSX element for Lua map body ─────────────────────────
// Returns a node structure compatible with _nodeToLua in emit_atoms/maps_lua.
// This replaces the old emitLuaElement token-walker approach.
function _parseJsxForLuaMapBody(c) {
  if (c.kind() !== TK.lt) return null;
  
  // Parse opening tag
  c.advance(); // skip <
  var tagName = c.text();
  c.advance(); // skip tag name
  
  var style = {};
  var nodeFields = {};
  var handler = null;
  var handlerIsJs = false;
  var text = null;
  var color = null;
  var fontSize = null;
  var inlineGlyphs = null;
  var children = [];
  
  // Parse attributes until > or />
  while (c.pos < c.count && c.kind() !== TK.gt && c.kind() !== TK.slash_gt) {
    if (c.kind() === TK.identifier) {
      var attrName = c.text();
      c.advance();
      if (c.kind() === TK.equals) {
        c.advance();
        if (attrName === 'style' && c.kind() === TK.lbrace) {
          // Parse style object
          c.advance(); // skip {
          if (c.kind() === TK.lbrace) {
            c.advance(); // skip inner {
            while (c.kind() !== TK.rbrace && c.pos < c.count) {
              if (c.kind() === TK.identifier) {
                var key = c.text();
                c.advance();
                if (c.kind() === TK.colon) c.advance();
                var val = null;
                if (c.kind() === TK.number) { val = c.text(); c.advance(); }
                else if (c.kind() === TK.string) { val = c.text(); c.advance(); }
                else if (c.kind() === TK.lbrace) {
                  c.advance();
                  var parts = [];
                  while (c.kind() !== TK.rbrace && c.pos < c.count) {
                    parts.push(c.text());
                    c.advance();
                  }
                  if (c.kind() === TK.rbrace) c.advance();
                  val = parts.join(' ');
                } else if (c.kind() === TK.identifier) {
                  var parts = [];
                  while (c.kind() !== TK.comma && c.kind() !== TK.rbrace && c.pos < c.count) {
                    parts.push(c.text());
                    c.advance();
                  }
                  val = parts.join(' ');
                }
                style[key] = val;
              }
              if (c.kind() === TK.comma) c.advance();
            }
            if (c.kind() === TK.rbrace) c.advance(); // inner }
            if (c.kind() === TK.rbrace) c.advance(); // outer }
          }
        } else if (attrName === 'onPress' || attrName === 'onClick') {
          // Handler
          if (c.kind() === TK.lbrace) {
            c.advance();
            // Skip arrow function syntax: () =>
            while (c.kind() !== TK.arrow && c.kind() !== TK.rbrace && c.pos < c.count) c.advance();
            if (c.kind() === TK.arrow) c.advance();
            if (c.kind() === TK.lbrace) c.advance(); // block {
            var hParts = [];
            var depth = 0;
            while (c.pos < c.count) {
              if (c.kind() === TK.lbrace) depth++;
              if (c.kind() === TK.rbrace) {
                if (depth === 0) break;
                depth--;
              }
              hParts.push(c.text());
              c.advance();
            }
            if (c.kind() === TK.rbrace) c.advance(); // block }
            if (c.kind() === TK.rbrace) c.advance(); // outer }
            handler = hParts.join(' ').trim();
            // Detect if handler is JS (contains JS-only syntax)
            handlerIsJs = /\bconsole\.|\bwindow\.|\bdocument\./.test(handler);
          }
        } else if (attrName === 'color') {
          if (c.kind() === TK.string) { color = c.text().slice(1, -1); c.advance(); }
          else if (c.kind() === TK.lbrace) {
            c.advance();
            var parts = [];
            while (c.kind() !== TK.rbrace && c.pos < c.count) { parts.push(c.text()); c.advance(); }
            if (c.kind() === TK.rbrace) c.advance();
            color = parts.join(' ');
          }
        } else if (attrName === 'fontSize') {
          if (c.kind() === TK.number) { fontSize = c.text(); c.advance(); }
          else if (c.kind() === TK.lbrace) { c.advance(); fontSize = c.text(); c.advance(); if (c.kind() === TK.rbrace) c.advance(); }
        } else if (attrName === 'key') {
          // Skip key attribute
          if (c.kind() === TK.lbrace) { c.advance(); while (c.kind() !== TK.rbrace && c.pos < c.count) c.advance(); if (c.kind() === TK.rbrace) c.advance(); }
          else if (c.kind() === TK.string) c.advance();
        } else {
          // Generic attribute - skip value
          if (c.kind() === TK.string) c.advance();
          else if (c.kind() === TK.lbrace) { c.advance(); while (c.kind() !== TK.rbrace && c.pos < c.count) c.advance(); if (c.kind() === TK.rbrace) c.advance(); }
          else if (c.kind() === TK.number) c.advance();
        }
      }
    } else {
      c.advance();
    }
  }
  
  // Self-closing or container
  var selfClosing = (c.kind() === TK.slash_gt);
  if (c.kind() === TK.slash_gt) c.advance();
  else if (c.kind() === TK.gt) c.advance();
  
  if (!selfClosing) {
    // Parse children
    if (tagName === 'Text') {
      // Text content: normalize source syntax into a template-style contract
      // so emit never sees raw JSX braces or backticks.
      var textParts = [];
      while (c.pos < c.count && c.kind() !== TK.lt_slash) {
        if (c.kind() === TK.lbrace) {
          c.advance();
          if (c.kind() === TK.template_literal) {
            textParts.push(c.text().slice(1, -1));
            c.advance();
          } else {
            var parts = [];
            while (c.kind() !== TK.rbrace && c.pos < c.count) { parts.push(c.text()); c.advance(); }
            var expr = parts.join(' ')
              .replace(/\s*\.\s*/g, '.')
              .replace(/\[\s*/g, '[')
              .replace(/\s*\]/g, ']')
              .trim();
            if (expr.length > 0) textParts.push('${' + expr + '}');
          }
          if (c.kind() === TK.rbrace) c.advance();
        } else if (c.kind() === TK.string) {
          textParts.push(c.text().slice(1, -1));
          c.advance();
        } else if (c.kind() === TK.lt && c.pos + 1 < c.count && c.textAt(c.pos + 1) === 'Glyph') {
          // Inline glyph
          c.advance(); c.advance(); // < Glyph
          var glyph = { d: '', fill: '#ffffff', stroke: null, stroke_width: 0, scale: 1.0 };
          while (c.kind() !== TK.gt && c.kind() !== TK.slash_gt && c.pos < c.count) {
            if (c.kind() === TK.identifier) {
              var gn = c.text(); c.advance();
              if (c.kind() === TK.equals) {
                c.advance();
                if (c.kind() === TK.string) { glyph[gn] = c.text().slice(1, -1); c.advance(); }
                else if (c.kind() === TK.number) { glyph[gn] = c.text(); c.advance(); }
              }
            } else c.advance();
          }
          if (c.kind() === TK.slash_gt) c.advance();
          else if (c.kind() === TK.gt) {
            c.advance();
            while (c.pos < c.count && c.kind() !== TK.lt_slash) c.advance();
            if (c.kind() === TK.lt_slash) { c.advance(); if (c.kind() === TK.identifier) c.advance(); if (c.kind() === TK.gt) c.advance(); }
          }
          if (!inlineGlyphs) inlineGlyphs = [];
          inlineGlyphs.push(glyph);
          textParts.push('\\x01');
        } else {
          c.advance();
        }
      }
      if (textParts.length > 0) text = textParts.join('');
    } else {
      // Container children
      while (c.pos < c.count && c.kind() !== TK.lt_slash) {
        if (c.kind() === TK.lt) {
          var child = _parseJsxForLuaMapBody(c);
          if (child) children.push(child);
        } else if (c.kind() === TK.lbrace) {
          // Conditional or map expression
          c.advance();
          var parts = [];
          while (c.kind() !== TK.rbrace && c.pos < c.count) { parts.push(c.text()); c.advance(); }
          if (c.kind() === TK.rbrace) c.advance();
          // Mark as conditional child
          children.push({ condition: parts.join(' '), node: { tag: 'Box', style: {}, children: [] } });
        } else {
          c.advance();
        }
      }
    }
    // Skip closing tag
    if (c.kind() === TK.lt_slash) {
      c.advance();
      if (c.kind() === TK.identifier) c.advance();
      if (c.kind() === TK.gt) c.advance();
    }
  }
  
  return {
    tag: tagName,
    style: style,
    text: text,
    color: color,
    fontSize: fontSize,
    handler: handler,
    handlerIsJs: handlerIsJs,
    children: children,
    inline_glyphs: inlineGlyphs,
    _nodeFields: nodeFields
  };
}
