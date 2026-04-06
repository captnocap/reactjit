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
  const mapExpr = (baseExpr ? '(' + baseExpr + ')' : baseName) + suffixText;

  // ── Lua detour: if the source is render-local/computed, route to LuaJIT ──
  // .map() content ALWAYS goes to Lua. Use the normal parser for Zig side
  // effects (OA registration, map context), then use the token-walking
  // emitLuaRebuildList for the Lua template (it handles nested JSX trees).
  var _isRenderLocal = ctx._renderLocalRaw && ctx._renderLocalRaw[baseName] !== undefined;
  var _isStateOa = false;
  for (var _oai = 0; _oai < ctx.objectArrays.length; _oai++) {
    if (ctx.objectArrays[_oai].getter === baseName && !ctx.objectArrays[_oai]._computedExpr) {
      _isStateOa = true; break;
    }
  }
  if (_isRenderLocal && !_isStateOa) {
    // Save cursor at JSX body start for the token-walking Lua emitter
    var _luaJsxPos = c.save();

    // Let the normal Zig path parse the JSX and create the OA.
    var oa = _ensureSyntheticComputedOa(getterName, mapExpr, mapSnippet, header);
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

    // Build the Lua template by token-walking the JSX body
    // (emitLuaRebuildList handles nested elements, children, colors, text)
    if (!ctx._luaMapRebuilders) ctx._luaMapRebuilders = [];
    var _luaIdx = ctx._luaMapRebuilders.length;
    var _luaRaw = expandRenderLocalRawExpr(ctx._renderLocalRaw[baseName] || baseName, baseName);
    // Restore cursor to JSX body start for token walking
    c.restore(_luaJsxPos);
    var _luaBody = emitLuaRebuildList(_luaIdx, c, header.itemParam || '_item', null, header.indexParam);
    // Restore cursor to after the parse so the rest of compilation continues
    c.restore(_afterParsePos);
    ctx._luaMapRebuilders.push({
      index: _luaIdx,
      luaCode: _luaBody,
      rawSource: _luaRaw,
      varName: baseName,
      isNested: !!ctx.currentMap
    });
    // Replace the Zig node with a Lua wrapper placeholder (only for top-level maps)
    if (!ctx.currentMap) {
      children.push({ nodeExpr: '.{ .test_id = "__lmw' + _luaIdx + '" }', _luaMapWrapper: _luaIdx });
    }
    if (consumeClosingBrace && c.kind() === TK.rbrace) c.advance();
    return true;
  }

  // All computed chain maps go to Lua — same pattern as render-local path above.
  var _ccLuaJsxPos = c.save();
  var oa = _ensureSyntheticComputedOa(getterName, mapExpr, mapSnippet, header);

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
  var _ccRawSource = expandRenderLocalRawExpr(ctx._renderLocalRaw[baseName] || baseName, baseName);
  c.restore(_ccLuaJsxPos);
  var _ccLuaBody = emitLuaRebuildList(_ccLuaIdx, c, header.itemParam || '_item', null, header.indexParam);
  c.restore(_ccAfterPos);
  ctx._luaMapRebuilders.push({
    index: _ccLuaIdx,
    luaCode: _ccLuaBody,
    rawSource: _ccRawSource,
    varName: baseName,
    isNested: !!ctx.currentMap
  });
  if (!ctx.currentMap) {
    children.push({ nodeExpr: '.{ .test_id = "__lmw' + _ccLuaIdx + '" }', _luaMapWrapper: _ccLuaIdx });
  }
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

  if (!_identifierStartsMapCall(c)) return false;

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
      var _nmLuaBody = emitLuaRebuildList(_nmIdx, c, _nmParam, null, _nmIdxParam);
      // Consume closing parens/braces from the .map() call
      while (c.kind() === TK.rparen) c.advance();
      if (consumeClosingBrace && c.kind() === TK.rbrace) c.advance();
      ctx._luaMapRebuilders.push({
        index: _nmIdx,
        luaCode: _nmLuaBody,
        rawSource: _nmRawSource,
        varName: maybeArr,
        isNested: !!ctx.currentMap
      });
      if (!ctx.currentMap) {
        children.push({ nodeExpr: '.{ .test_id = "__lmw' + _nmIdx + '" }', _luaMapWrapper: _nmIdx });
      }
      return true;
    }
    c.restore(_savedNested);
  }

  let oa = ctx.objectArrays.find(o => o.getter === maybeArr);
  if (!oa) oa = inferOaFromSource(c, maybeArr);
  if (!oa) return false;

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

    // Step 4: Token-walk JSX body for Lua template
    if (!ctx._luaMapRebuilders) ctx._luaMapRebuilders = [];
    var _dynLuaIdx = ctx._luaMapRebuilders.length;
    c.restore(_luaJsxPos);
    var _dynLuaBody = emitLuaRebuildList(_dynLuaIdx, c, _dynItemParam, null, _dynIdxParam);
    c.restore(_afterParsePos);

    // Step 5: Register Lua rebuilder and push wrapper placeholder
    ctx._luaMapRebuilders.push({
      index: _dynLuaIdx,
      luaCode: _dynLuaBody,
      rawSource: maybeArr,
      varName: maybeArr,
      isNested: !!ctx.currentMap
    });
    if (!ctx.currentMap) {
      children.push({ nodeExpr: '.{ .test_id = "__lmw' + _dynLuaIdx + '" }', _luaMapWrapper: _dynLuaIdx });
    }
    if (consumeClosingBrace && c.kind() === TK.rbrace) c.advance();
    return true;
  }
}
