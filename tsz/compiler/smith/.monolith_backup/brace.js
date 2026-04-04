// ── Child parsing: brace expressions ──────────────────────────────

function _syntheticFieldType(name) {
  if (!name) return 'string';
  if (name.indexOf('is') === 0 || name.indexOf('has') === 0 || name.indexOf('can') === 0 || name.indexOf('should') === 0) return 'boolean';
  if (name.indexOf('count') >= 0 || name.indexOf('index') >= 0 || name.indexOf('idx') >= 0 || name.indexOf('token') >= 0 || name.indexOf('pct') >= 0 || name === 'value') return 'int';
  if (name === 'id' || name === 'name' || name === 'label' || name === 'description' || name === 'content' || name === 'type' || name === 'title' || name === 'reason' || name === 'date') return 'string';
  return 'string';
}

function _sanitizeComputedGetter(baseName, suffix) {
  const raw = (baseName || '__expr') + (suffix || '');
  const clean = raw.replace(/[^\w]+/g, '_').replace(/^_+|_+$/g, '');
  return (clean.length > 0 ? clean : '__expr') + '_' + (ctx._computedMapCounter++);
}

function _findAliasPropertyPaths(snippet, alias) {
  const out = [];
  const seen = {};
  const re = new RegExp('\\b' + alias + '\\.([A-Za-z_]\\w*(?:\\.[A-Za-z_]\\w*)*)', 'g');
  let m;
  while ((m = re.exec(snippet)) !== null) {
    const path = m[1];
    if (seen[path]) continue;
    seen[path] = true;
    out.push(path);
  }
  return out;
}

function _aliasUsedBare(snippet, alias) {
  const re = new RegExp('\\b' + alias + '\\b', 'g');
  let m;
  while ((m = re.exec(snippet)) !== null) {
    let next = m.index + alias.length;
    while (next < snippet.length && /\s/.test(snippet[next])) next++;
    if (next >= snippet.length || snippet[next] !== '.') return true;
  }
  return false;
}

function _buildDestructuredComputedPlan(mapExpr, snippet, aliases) {
  const aliasProps = {};
  const bareAliases = {};
  let primaryAlias = aliases[0] || '_item';
  let bestPropCount = -1;

  for (const alias of aliases) {
    const props = _findAliasPropertyPaths(snippet, alias);
    aliasProps[alias] = props;
    bareAliases[alias] = _aliasUsedBare(snippet, alias);
    if (props.length > bestPropCount) {
      bestPropCount = props.length;
      primaryAlias = alias;
    }
  }

  const fields = [];
  const seenFields = {};
  const transformEntries = [];
  const aliasFieldMap = {};

  for (let ai = 0; ai < aliases.length; ai++) {
    const alias = aliases[ai];
    const props = aliasProps[alias];

    if ((bareAliases[alias] || props.length === 0) && !seenFields[alias]) {
      seenFields[alias] = true;
      fields.push({ name: alias, type: _syntheticFieldType(alias) });
      transformEntries.push(`${alias}: _entry[${ai}]`);
      aliasFieldMap[alias] = alias;
    }

    for (const path of props) {
      const flat = path.replace(/\./g, '_');
      const fieldName = alias === primaryAlias ? flat : alias + '_' + flat;
      if (!seenFields[fieldName]) {
        seenFields[fieldName] = true;
        fields.push({ name: fieldName, type: _syntheticFieldType(fieldName) });
      }
      transformEntries.push(`${fieldName}: _entry[${ai}].${path}`);
    }
  }

  if (fields.length === 0) return null;

  return {
    fields,
    primaryAlias,
    aliasFieldMap,
    computedExpr: `(${_normalizeJoinedJsExpr(_expandRenderLocalJsFully(mapExpr))}).map((_entry, _idx) => ({ ${transformEntries.join(', ')} }))`,
  };
}

function _ensureSyntheticComputedOa(getterName, mapExpr, snippet, header) {
  if (!ctx._computedMapByGetter) ctx._computedMapByGetter = {};
  if (ctx._computedMapByGetter[getterName]) return ctx._computedMapByGetter[getterName];

  const itemParam = header && header.itemParam ? header.itemParam : '_item';
  const destructuredAliases = header && header.destructuredAliases ? header.destructuredAliases : null;
  const destructuredPlan = destructuredAliases && destructuredAliases.length > 0
    ? _buildDestructuredComputedPlan(mapExpr, snippet, destructuredAliases)
    : null;
  const nestedHints = {};
  const fields = destructuredPlan ? destructuredPlan.fields.slice() : [];
  const seen = {};
  for (const field of fields) seen[field.name] = true;
  if (!destructuredPlan) {
    const fieldRe = new RegExp('\\b' + itemParam + '\\.([A-Za-z_]\\w*(?:\\.[A-Za-z_]\\w*)*)', 'g');
    let m;
    while ((m = fieldRe.exec(snippet)) !== null) {
      const path = m[1];
      const first = path.split('.')[0];
      if (snippet.indexOf(itemParam + '.' + first + '.map(') >= 0) {
        nestedHints[first] = true;
        continue;
      }
      const flat = path.replace(/\./g, '_');
      if (seen[flat]) continue;
      seen[flat] = true;
      fields.push({ name: flat, type: _syntheticFieldType(flat) });
    }
  }

  for (const nf of Object.keys(nestedHints)) {
    fields.push({ name: nf, type: 'nested_array', nestedFields: [{ name: '_v', type: 'string' }] });
  }

  let oa;
  const colorMatches = snippet.match(/#[0-9a-fA-F]{3,8}/g) || [];
  const uniqueColors = [];
  for (let ci = 0; ci < colorMatches.length; ci++) {
    if (uniqueColors.indexOf(colorMatches[ci]) < 0) uniqueColors.push(colorMatches[ci]);
  }
  if (fields.length === 0) {
    oa = {
      fields: [{ name: '_v', type: 'string' }],
      getter: getterName,
      setter: 'set' + getterName[0].toUpperCase() + getterName.slice(1),
      oaIdx: ctx.objectArrays.length,
      isSimpleArray: true,
      _computedExpr: _normalizeJoinedJsExpr(_expandRenderLocalJsFully(mapExpr)),
      _computedColors: uniqueColors,
      _computedHasTernary: snippet.indexOf('?(') >= 0 || snippet.indexOf('? (') >= 0,
    };
    ctx.objectArrays.push(oa);
  } else {
    oa = {
      fields: fields,
      getter: getterName,
      setter: 'set' + getterName[0].toUpperCase() + getterName.slice(1),
      oaIdx: ctx.objectArrays.length,
      _computedExpr: destructuredPlan ? destructuredPlan.computedExpr : _normalizeJoinedJsExpr(_expandRenderLocalJsFully(mapExpr)),
      _computedColors: uniqueColors,
      _computedHasTernary: snippet.indexOf('?(') >= 0 || snippet.indexOf('? (') >= 0,
    };
    if (destructuredPlan) {
      oa._computedHeader = {
        itemParam: destructuredPlan.primaryAlias,
        indexParam: header.indexParam,
        destructuredAliases: header.destructuredAliases,
        filterConditions: [],
        renderLocalAliases: destructuredPlan.aliasFieldMap,
      };
    }
    ctx.objectArrays.push(oa);
    for (const field of fields) {
      if (field.type === 'nested_array') {
        const childOaIdx = ctx.objectArrays.length;
        field.nestedOaIdx = childOaIdx;
        ctx.objectArrays.push({
          fields: field.nestedFields,
          getter: getterName + '_' + field.name,
          setter: 'set' + getterName[0].toUpperCase() + getterName.slice(1) + '_' + field.name,
          oaIdx: childOaIdx,
          parentOaIdx: oa.oaIdx,
          parentField: field.name,
          isNested: true,
        });
      }
    }
  }

  ctx._computedMapByGetter[getterName] = oa;
  return oa;
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
  const mapExpr = (baseExpr ? '(' + baseExpr + ')' : baseName) + suffixText;

  // ── Lua detour: if the source is render-local/computed, route to LuaJIT ──
  // Let the normal parser handle the JSX (it handles block bodies, destructuring,
  // nested maps, ternaries — everything). Then convert the parsed result to Lua.
  // Do NOT walk raw tokens — that's what caused the infinite loop.
  var _isRenderLocal = ctx._renderLocalRaw && ctx._renderLocalRaw[baseName] !== undefined;
  var _isStateOa = false;
  for (var _oai = 0; _oai < ctx.objectArrays.length; _oai++) {
    if (ctx.objectArrays[_oai].getter === baseName && !ctx.objectArrays[_oai]._computedExpr) {
      _isStateOa = true; break;
    }
  }
  if (_isRenderLocal && !_isStateOa) {
    // Let the normal Zig path parse the JSX and create the OA.
    // But tag the resulting map as lua_runtime so emit skips Zig pool/rebuild.
    var oa = _ensureSyntheticComputedOa(getterName, mapExpr, mapSnippet, header);
    c.restore(mapPos);
    var mapResult = tryParsePlainMapFromMethod(c, oa, oa._computedHeader || header);
    if (!mapResult) { c.restore(saved); return false; }

    // Tag the map for Lua routing — emit will skip Zig rebuild, use evalLuaMapData instead
    var mapIdx = -1;
    for (var _mi = 0; _mi < ctx.maps.length; _mi++) {
      if (ctx.maps[_mi].oa === oa) { mapIdx = _mi; break; }
    }
    if (mapIdx >= 0) ctx.maps[mapIdx].mapBackend = 'lua_runtime';

    // Register as a Lua map rebuilder with a parsed-node Lua template
    if (!ctx._luaMapRebuilders) ctx._luaMapRebuilders = [];
    var _luaIdx = ctx._luaMapRebuilders.length;
    var _luaRaw = expandRenderLocalRawExpr(ctx._renderLocalRaw[baseName] || baseName, baseName);
    // Convert the parsed nodeExpr tree to a Lua template
    var _luaBody = _nodeResultToLuaRebuilder(_luaIdx, mapResult, oa);
    ctx._luaMapRebuilders.push({
      index: _luaIdx,
      luaCode: _luaBody,
      rawSource: _luaRaw,
      varName: baseName
    });
    // Replace the Zig node with a Lua wrapper placeholder
    children.push({ nodeExpr: '.{ .test_id = "__lmw' + _luaIdx + '" }', _luaMapWrapper: _luaIdx });
    if (consumeClosingBrace && c.kind() === TK.rbrace) c.advance();
    return true;
  }

  var oa = _ensureSyntheticComputedOa(getterName, mapExpr, mapSnippet, header);

  c.restore(mapPos);
  var mapResult = tryParsePlainMapFromMethod(c, oa, oa._computedHeader || header);
  if (!mapResult) { c.restore(saved); return false; }
  children.push(mapResult);
  if (consumeClosingBrace && c.kind() === TK.rbrace) c.advance();
  return true;
}

function _identifierStartsMapCall(c) {
  if (c.kind() !== TK.identifier || c.pos + 3 >= c.count || c.kindAt(c.pos + 1) !== TK.dot) return false;
  const savedPeek = c.save();
  c.advance();
  c.advance();
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

  let oa = ctx.objectArrays.find(o => o.getter === maybeArr);
  if (!oa) oa = inferOaFromSource(c, maybeArr);
  if (!oa) return false;

  const mapResult = tryParseMap(c, oa);
  if (!mapResult) return false;
  children.push(mapResult);
  if (consumeClosingBrace && c.kind() === TK.rbrace) c.advance();
  return true;
}

function _joinTokenText(c, start, end) {
  const parts = [];
  for (let ti = start; ti < end; ti++) parts.push(c.textAt(ti));
  return parts.join(' ');
}

function _expandRenderLocalJs(expr) {
  let out = expr;
  if (!ctx._renderLocalRaw) return out;
  const names = Object.keys(ctx._renderLocalRaw).sort((a, b) => b.length - a.length);
  for (const name of names) {
    const raw = ctx._renderLocalRaw[name];
    if (!raw || raw === expr) continue;
    out = out.replace(new RegExp(`\\b${name}\\b`, 'g'), function(match, offset, full) {
      let prev = offset - 1;
      while (prev >= 0 && /\s/.test(full[prev])) prev--;
      if (prev >= 0 && full[prev] === '.') return match;
      return `(${_normalizeJoinedJsExpr(raw)})`;
    });
  }
  return out;
}

function _expandRenderLocalJsFully(expr) {
  let out = expr;
  for (let i = 0; i < 6; i++) {
    const next = _expandRenderLocalJs(out);
    if (next === out) break;
    out = next;
  }
  return out;
}

function _makeEvalTruthyExpr(jsExpr) {
  return zigBool(buildEval(_expandRenderLocalJs(jsExpr), ctx), ctx);
}

function _normalizeJoinedJsExpr(expr) {
  return String(expr)
    .replace(/!\s*=\s*=/g, '!==')
    .replace(/=\s*=\s*=/g, '===')
    .replace(/!\s*=(?!=)/g, '!=')
    .replace(/=\s*=(?!=)/g, '==')
    .replace(/>\s*=/g, '>=')
    .replace(/<\s*=/g, '<=')
    .replace(/&\s*&/g, '&&')
    .replace(/\|\s*\|/g, '||')
    .replace(/\bexact\b/g, '===');
}

function _findLastTopLevelAmpAmp(c, start, end) {
  let depthParen = 0;
  let depthBracket = 0;
  let depthBrace = 0;
  let last = -1;
  for (let ti = start; ti < end; ti++) {
    const kind = c.kindAt(ti);
    if (kind === TK.lparen) depthParen++;
    else if (kind === TK.rparen) { if (depthParen > 0) depthParen--; }
    else if (kind === TK.lbracket) depthBracket++;
    else if (kind === TK.rbracket) { if (depthBracket > 0) depthBracket--; }
    else if (kind === TK.lbrace) depthBrace++;
    else if (kind === TK.rbrace) { if (depthBrace > 0) depthBrace--; }
    else if (kind === TK.amp_amp && depthParen === 0 && depthBracket === 0 && depthBrace === 0) last = ti;
  }
  return last;
}

function _tryParseStoredRenderLocal(c, children, varName) {
  const rawExpr = ctx._renderLocalRaw && ctx._renderLocalRaw[varName];
  const span = ctx._renderLocalSpan && ctx._renderLocalSpan[varName];
  if (!rawExpr || !span) return false;
  if (rawExpr.indexOf('.map(') < 0 && rawExpr.indexOf('<') < 0) return false;

  const originalPos = c.save();
  let condExpr = null;
  let payloadStart = span.start;
  const lastAnd = _findLastTopLevelAmpAmp(c, span.start, span.end);
  if (lastAnd >= 0) {
    const condJs = _joinTokenText(c, span.start, lastAnd).trim();
    if (condJs.length > 0) condExpr = _makeEvalTruthyExpr(condJs);
    payloadStart = lastAnd + 1;
  }

  c.pos = payloadStart;
  let wrapped = false;
  if (c.kind() === TK.lparen) {
    wrapped = true;
    c.advance();
  }

  let parsed = null;
  if (c.kind() === TK.identifier) {
    const tmpChildren = [];
    if (_tryParseIdentifierMapExpression(c, tmpChildren, false) && tmpChildren.length > 0) parsed = tmpChildren[0];
  }
  if (!parsed && c.kind() === TK.lt) {
    parsed = parseJSXElement(c);
  }
  if (!parsed) {
    c.restore(originalPos);
    return false;
  }
  if (wrapped && c.kind() === TK.rparen) c.advance();

  c.restore(originalPos);
  c.advance();
  if (c.kind() === TK.rbrace) c.advance();

  if (condExpr) {
    const condIdx = ctx.conditionals.length;
    ctx.conditionals.push({ condExpr, kind: 'show_hide', inMap: !!ctx.currentMap });
    const wrappedNode = Object.assign({}, parsed);
    wrappedNode.condIdx = condIdx;
    children.push(wrappedNode);
  } else {
    children.push(parsed);
  }
  return true;
}

function tryParseBraceChild(c, children) {
  if (c.kind() !== TK.lbrace) return false;

  c.advance();
  if (c.kind() === TK.comment) {
    c.advance();
    if (c.kind() === TK.rbrace) c.advance();
    return true;
  }

  if (globalThis.__SMITH_DEBUG_MAP_DETECT) {
    if (!globalThis.__dbg) globalThis.__dbg = [];
    globalThis.__dbg.push(`BRACE kind=${c.kind()} text=${c.text()} pos=${c.pos}`);
  }

  const condResult = tryParseConditional(c, children);
  if (condResult) {
    tracePattern(16, 'and_short_circuit', '');
    return true;
  }

  const ternJSXResult = tryParseTernaryJSX(c, children);
  if (ternJSXResult) {
    tracePattern(11, 'ternary_element', '');
    return true;
  }

  const ternTextResult = tryParseTernaryText(c, children);
  if (ternTextResult) {
    tracePattern(13, 'ternary_string', '');
    return true;
  }

  if (c.kind() === TK.identifier) {
    const maybeArr = c.text();
    if (_tryParseIdentifierMapExpression(c, children, true)) {
      tracePattern(19, 'map_element', maybeArr);
      return true;
    }
    // Handle props.X.map() — resolve through propStack to find the OA name
    if (ctx.propsObjectName && maybeArr === ctx.propsObjectName &&
        c.pos + 4 < c.count && c.kindAt(c.pos + 1) === TK.dot &&
        c.kindAt(c.pos + 2) === TK.identifier && c.kindAt(c.pos + 3) === TK.dot) {
      const propField = c.textAt(c.pos + 2);
      const propVal = ctx.propStack && ctx.propStack[propField];
      const resolvedName = (propVal && typeof propVal === 'string') ? propVal : propField;
      // Peek ahead past props.field. to check for .map()
      const savedPropsPeek = c.save();
      c.advance(); c.advance(); c.advance(); c.advance(); // skip props . field .
      let isPropsMapCall = c.isIdent('map') && c.pos + 1 < c.count && c.kindAt(c.pos + 1) === TK.lparen;
      while (!isPropsMapCall && (c.isIdent('slice') || c.isIdent('filter') || c.isIdent('sort')) && c.pos + 1 < c.count && c.kindAt(c.pos + 1) === TK.lparen) {
        c.advance(); c.advance();
        let pd2 = 1;
        while (c.pos < c.count && pd2 > 0) {
          if (c.kind() === TK.lparen) pd2++;
          if (c.kind() === TK.rparen) pd2--;
          if (pd2 > 0) c.advance();
        }
        if (c.kind() === TK.rparen) c.advance();
        if (c.kind() === TK.dot) { c.advance(); isPropsMapCall = c.isIdent('map') && c.pos + 1 < c.count && c.kindAt(c.pos + 1) === TK.lparen; }
        else break;
      }
      c.restore(savedPropsPeek);
      if (isPropsMapCall) {
        let oa = ctx.objectArrays.find(o => o.getter === resolvedName);
        if (!oa) oa = inferOaFromSource(c, resolvedName);
        if (oa) {
          // Skip props. to position cursor at field name for tryParseMap
          c.advance(); // props
          c.advance(); // .
          // Now cursor is at field name — tryParseMap handles field.map(...)
          const mapResult = tryParseMap(c, oa);
          if (mapResult) {
            children.push(mapResult);
            if (c.kind() === TK.rbrace) c.advance();
            return true;
          }
        }
      }
    }
    if (ctx.currentMap && maybeArr === ctx.currentMap.itemParam &&
        c.pos + 3 < c.count && c.kindAt(c.pos + 1) === TK.dot) {
      const saved2 = c.save();
      c.advance();
      c.advance();
      if (c.kind() === TK.identifier) {
        const nestedField = c.text();
        const parentOa = ctx.currentMap.oa;
        const nestedFieldInfo = parentOa.fields.find(f => f.type === 'nested_array' && f.name === nestedField);
        if (nestedFieldInfo && c.pos + 1 < c.count && c.kindAt(c.pos + 1) === TK.dot) {
          const nestedOa = ctx.objectArrays.find(o => o.oaIdx === nestedFieldInfo.nestedOaIdx);
          if (nestedOa) {
            const mapResult = tryParseNestedMap(c, nestedOa, nestedField);
            if (mapResult) {
              children.push(mapResult);
              if (c.kind() === TK.rbrace) c.advance();
              return true;
            }
          }
        }
      }
      c.restore(saved2);
    }
  }

  if (c.kind() === TK.template_literal) {
    const raw = c.text().slice(1, -1);
    c.advance();
    if (c.kind() === TK.rbrace) c.advance();
    const parsed = parseTemplateLiteral(raw);
    const fmt = parsed.fmt;
    const args = parsed.args;
    if (args.length > 0) {
      const isMapTemplate = ctx.currentMap && args.some(a => a.includes('_oa') || a.includes('_i'));
      if (isMapTemplate) {
        const mapBufId = ctx.mapDynCount || 0;
        ctx.mapDynCount = mapBufId + 1;
        ctx.dynTexts.push({ bufId: mapBufId, fmtString: fmt, fmtArgs: args.join(', '), arrName: '', arrIndex: 0, bufSize: 256, inMap: true, mapIdx: ctx.maps.indexOf(ctx.currentMap) });
        children.push({ nodeExpr: `.{ .text = "__mt${mapBufId}__" }`, dynBufId: mapBufId, inMap: true });
      } else {
        const bufId = ctx.dynCount;
        const staticText = fmt.replace(/\{[ds](?::\.?\d+)?\}/g, '');
        const strArgCount = args.filter(a => a.includes('getSlotString')).length;
        const intArgCount = args.length - strArgCount;
        const staticLen = utf8ByteLen(staticText);
        const bufSize = staticText.length === 0 ? 64 : Math.max(64, staticLen + 20 * intArgCount + 128 * strArgCount);
        ctx.dynTexts.push({ bufId, fmtString: fmt, fmtArgs: args.join(', '), arrName: '', arrIndex: 0, bufSize });
        ctx.dynCount++;
        children.push({ nodeExpr: `.{ .text = "" }`, dynBufId: bufId });
      }
    } else {
      children.push({ nodeExpr: `.{ .text = ${zigStringLiteral(fmt)} }` });
    }
    return true;
  }

  if (c.kind() === TK.identifier && ctx.currentMap && c.text() === ctx.currentMap.itemParam) {
    c.advance();
    if (c.kind() === TK.dot) {
      c.advance();
      if (c.kind() === TK.identifier) {
        const field = c.text();
        const oa = ctx.currentMap.oa;
        const oaIdx = oa.oaIdx;
        const fieldInfo = oa.fields.find(f => f.name === field);
        c.advance();
        if (c.kind() === TK.rbrace) c.advance();
        const mapBufId = ctx.mapDynCount || 0;
        ctx.mapDynCount = mapBufId + 1;
        const _inferredType = fieldInfo ? fieldInfo.type : _syntheticFieldType(field);
        const fmt = _inferredType === 'string' ? '{s}' : '{d}';
        let args;
        if (_inferredType === 'string') {
          args = `_oa${oaIdx}_${field}[_i][0.._oa${oaIdx}_${field}_lens[_i]]`;
        } else {
          args = `_oa${oaIdx}_${field}[_i]`;
        }
        ctx.dynTexts.push({ bufId: mapBufId, fmtString: fmt, fmtArgs: args, arrName: '', arrIndex: 0, bufSize: 256, inMap: true, mapIdx: ctx.maps.indexOf(ctx.currentMap) });
        children.push({ nodeExpr: `.{ .text = "__mt${mapBufId}__" }`, dynBufId: mapBufId, inMap: true });
        return true;
      }
    } else if (ctx.currentMap.isSimpleArray && c.kind() === TK.rbrace) {
      c.advance();
      const oa = ctx.currentMap.oa;
      const oaIdx = oa.oaIdx;
      const mapBufId = ctx.mapDynCount || 0;
      ctx.mapDynCount = mapBufId + 1;
      const args = `_oa${oaIdx}__v[_i][0.._oa${oaIdx}__v_lens[_i]]`;
      ctx.dynTexts.push({ bufId: mapBufId, fmtString: '{s}', fmtArgs: args, arrName: '', arrIndex: 0, bufSize: 256, inMap: true, mapIdx: ctx.maps.indexOf(ctx.currentMap) });
      children.push({ nodeExpr: `.{ .text = "__mt${mapBufId}__" }`, dynBufId: mapBufId, inMap: true });
      return true;
    }
  }

  if (c.kind() === TK.identifier && c.text() === 'children' && ctx.componentChildren) {
    c.advance();
    if (c.kind() === TK.rbrace) c.advance();
    for (const ch of ctx.componentChildren) children.push(ch);
    return true;
  }

  if (c.kind() === TK.identifier && ctx.renderLocals && ctx.renderLocals[c.text()] !== undefined) {
    if (_tryParseStoredRenderLocal(c, children, c.text())) return true;
    const _brExprStart = c.save();
    const _brRlName = c.text();
    const _brRlRaw = ctx._renderLocalRaw && ctx._renderLocalRaw[_brRlName];
    var _brRlVal = ctx.renderLocals[_brRlName];
    if (_brRlVal && typeof _brRlVal === 'object' && _brRlVal.__jsxSlot) {
      c.advance();
      if (c.kind() === TK.rbrace) c.advance();
      children.push(_brRlVal.result);
      return true;
    }
    c.advance();
    // Render-local .map() is handled by _tryParseIdentifierMapExpression →
    // _tryParseComputedChainMap which uses the parser (not raw token walking).
    // Const OA row ref: resolve .field access before closing brace
    if (typeof _brRlVal === 'string' && _brRlVal.charCodeAt(0) === 1 &&
        c.kind() === TK.dot && c.pos + 1 < c.count && c.kindAt(c.pos + 1) === TK.identifier) {
      var _brField = c.textAt(c.pos + 1);
      var _brResolved = resolveConstOaFieldFromRef(_brRlVal, _brField);
      if (_brResolved !== null) {
        // Strip outer quotes from string-type values (they'll be re-quoted in .text = "...")
        if (_brResolved.charAt(0) === '"' && _brResolved.charAt(_brResolved.length - 1) === '"') {
          _brRlVal = _brResolved.slice(1, -1);
        } else {
          _brRlVal = _brResolved;
        }
        c.advance(); // skip .
        c.advance(); // skip field
      }
    }
    if (c.kind() !== TK.rbrace) {
      const exprLine = c.starts[_brExprStart] || 0;
      let braceDepth = 0;
      while (c.kind() !== TK.eof) {
        if (c.kind() === TK.lbrace) braceDepth++;
        if (c.kind() === TK.rbrace) {
          if (braceDepth === 0) break;
          braceDepth--;
        }
        c.advance();
      }
      const _brExprEnd = c.save();
      if (c.kind() === TK.rbrace) c.advance();
      let fullExpr = _normalizeJoinedJsExpr(_joinTokenText(c, _brExprStart, _brExprEnd));
      fullExpr = _normalizeJoinedJsExpr(_expandRenderLocalJs(fullExpr));
      if (ctx.scriptBlock && fullExpr.length > 0) {
        const slotIdx = ctx.stateSlots.length;
        ctx.stateSlots.push({ getter: '__jsExpr_' + slotIdx, setter: '__setJsExpr_' + slotIdx, initial: '', type: 'string' });
        const isInMap = !!ctx.currentMap;
        let bufId;
        if (isInMap) {
          bufId = ctx.mapDynCount || 0;
          ctx.mapDynCount = bufId + 1;
        } else {
          bufId = ctx.dynCount;
          ctx.dynCount++;
        }
        ctx.dynTexts.push({ bufId, fmtString: '{s}', fmtArgs: 'state.getSlotString(' + slotIdx + ')', arrName: '', arrIndex: 0, bufSize: 256, inMap: isInMap, mapIdx: isInMap ? ctx.maps.indexOf(ctx.currentMap) : -1 });
        ctx._jsDynTexts.push({ slotIdx: slotIdx, jsExpr: fullExpr });
        children.push({ nodeExpr: isInMap ? '.{ .text = "__mt' + bufId + '__" }' : '.{ .text = "" }', dynBufId: bufId, inMap: isInMap });
      } else if (fullExpr.length > 0) {
        ctx._droppedExpressions.push({ expr: fullExpr, line: exprLine });
      }
      return true;
    }
    c.advance();
    const isEvalExpr = isEval(_brRlVal);
    const isPureEvalExpr = isEvalExpr && _brRlVal.trimStart().startsWith('qjs_runtime.evalToString(');
    if (isEvalExpr && !isPureEvalExpr && _brRlRaw && ctx.scriptBlock) {
      const slotIdx = ctx.stateSlots.length;
      ctx.stateSlots.push({ getter: '__jsExpr_' + slotIdx, setter: '__setJsExpr_' + slotIdx, initial: '', type: 'string' });
      const isInMap = !!ctx.currentMap;
      let bufId;
      if (isInMap) {
        bufId = ctx.mapDynCount || 0;
        ctx.mapDynCount = bufId + 1;
      } else {
        bufId = ctx.dynCount;
        ctx.dynCount++;
      }
      ctx.dynTexts.push({ bufId, fmtString: '{s}', fmtArgs: 'state.getSlotString(' + slotIdx + ')', arrName: '', arrIndex: 0, bufSize: 256, inMap: isInMap, mapIdx: isInMap ? ctx.maps.indexOf(ctx.currentMap) : -1 });
      ctx._jsDynTexts.push({ slotIdx: slotIdx, jsExpr: _expandRenderLocalJs(_normalizeJoinedJsExpr(_brRlRaw)) });
      children.push({ nodeExpr: isInMap ? '.{ .text = "__mt' + bufId + '__" }' : '.{ .text = "" }', dynBufId: bufId, inMap: isInMap });
      return true;
    }
    const isZigExpr = isEvalExpr || (typeof _brRlVal === 'string' && (_brRlVal.includes('state.get') || _brRlVal.includes('getSlot') || _brRlVal.includes('_oa') || _brRlVal.includes('@as')));
    if (isZigExpr) {
      const isStr = isEval(_brRlVal) || _brRlVal.includes('getSlotString') || _brRlVal.includes('@as([]const u8') || _brRlVal.includes('[0..');
      const fmt = isStr ? '{s}' : '{d}';
      const fmtArgs = isStr ? _brRlVal : leftFoldExpr(_brRlVal);
      const bufSize = isStr ? 128 : 64;
      if (ctx.currentMap && _brRlVal.includes('_oa')) {
        const mapBufId = ctx.mapDynCount || 0;
        ctx.mapDynCount = mapBufId + 1;
        ctx.dynTexts.push({ bufId: mapBufId, fmtString: fmt, fmtArgs, arrName: '', arrIndex: 0, bufSize: 256, inMap: true, mapIdx: ctx.maps.indexOf(ctx.currentMap) });
        children.push({ nodeExpr: `.{ .text = "__mt${mapBufId}__" }`, dynBufId: mapBufId, inMap: true });
      } else {
        const bufId = ctx.dynCount;
        ctx.dynTexts.push({ bufId, fmtString: fmt, fmtArgs, arrName: '', arrIndex: 0, bufSize });
        ctx.dynCount++;
        children.push({ nodeExpr: `.{ .text = "" }`, dynBufId: bufId });
      }
    } else {
      children.push({ nodeExpr: `.{ .text = ${zigStringLiteral(_brRlVal)} }` });
    }
    return true;
  }

  if (c.kind() === TK.identifier && ctx.propStack[c.text()] !== undefined) {
    const propVal = ctx.propStack[c.text()];
    if (propVal && typeof propVal === 'object' && propVal.__jsxSlot) {
      c.advance();
      if (c.kind() === TK.rbrace) c.advance();
      children.push(propVal.result);
      return true;
    }
    if (c.kindAt(c.pos + 1) === TK.rbrace) {
      c.advance();
      if (c.kind() === TK.rbrace) c.advance();
      const isZigExpr = typeof propVal === 'string' && (propVal.includes('state.get') || propVal.includes('getSlot') || propVal.includes('_oa') || propVal.includes('@as'));
      if (isZigExpr) {
        const isStr = propVal.includes('getSlotString') || propVal.includes('..') || propVal.includes('@as([]const u8');
        const fmt = isStr ? '{s}' : '{d}';
        const args = isStr ? propVal : leftFoldExpr(propVal);
        if (ctx.currentMap) {
          const mapBufId = ctx.mapDynCount || 0;
          ctx.mapDynCount = mapBufId + 1;
          ctx.dynTexts.push({ bufId: mapBufId, fmtString: fmt, fmtArgs: args, arrName: '', arrIndex: 0, bufSize: 256, inMap: true, mapIdx: ctx.maps.indexOf(ctx.currentMap) });
          children.push({ nodeExpr: `.{ .text = "__mt${mapBufId}__" }`, dynBufId: mapBufId, inMap: true });
        } else {
          const bufId = ctx.dynCount;
          const bufSize = isStr ? 128 : 64;
          ctx.dynTexts.push({ bufId, fmtString: fmt, fmtArgs: args, arrName: '', arrIndex: 0, bufSize });
          ctx.dynCount++;
          children.push({ nodeExpr: `.{ .text = "" }`, dynBufId: bufId });
        }
      } else {
        children.push({ nodeExpr: `.{ .text = ${zigStringLiteral(propVal)} }` });
      }
      return true;
    }
  }

  // props.X dot-access: {props.label} when component uses bare params
  {
    const pa = peekPropsAccess(c);
    if (pa) {
      skipPropsAccess(c);
      const propVal = pa.value;
      if (c.kind() === TK.rbrace) {
        c.advance();
        if (propVal && typeof propVal === 'object' && propVal.__jsxSlot) {
          children.push(propVal.result);
          return true;
        }
        const isZigExpr = typeof propVal === 'string' && (propVal.includes('state.get') || propVal.includes('getSlot') || propVal.includes('_oa') || propVal.includes('@as'));
        if (isZigExpr) {
          const isStr = typeof propVal === 'string' && (propVal.includes('getSlotString') || propVal.includes('..') || propVal.includes('@as([]const u8'));
          const fmt = isStr ? '{s}' : '{d}';
          const args = isStr ? propVal : leftFoldExpr(propVal);
          if (ctx.currentMap) {
            const mapBufId = ctx.mapDynCount || 0;
            ctx.mapDynCount = mapBufId + 1;
            ctx.dynTexts.push({ bufId: mapBufId, fmtString: fmt, fmtArgs: args, arrName: '', arrIndex: 0, bufSize: 256, inMap: true, mapIdx: ctx.maps.indexOf(ctx.currentMap) });
            children.push({ nodeExpr: `.{ .text = "__mt${mapBufId}__" }`, dynBufId: mapBufId, inMap: true });
          } else {
            const bufId = ctx.dynCount;
            ctx.dynTexts.push({ bufId, fmtString: fmt, fmtArgs: args, arrName: '', arrIndex: 0, bufSize: isStr ? 128 : 64 });
            ctx.dynCount++;
            children.push({ nodeExpr: `.{ .text = "" }`, dynBufId: bufId });
          }
        } else {
          children.push({ nodeExpr: `.{ .text = ${zigStringLiteral(propVal)} }` });
        }
        return true;
      }
      // props.item.field inside map — resolve to OA field access
      if (ctx.currentMap && typeof propVal === 'string' && propVal === ctx.currentMap.itemParam &&
          c.kind() === TK.dot && c.pos + 1 < c.count && c.kindAt(c.pos + 1) === TK.identifier) {
        c.advance(); // skip .
        const field = c.text();
        c.advance(); // skip field name
        const oa = ctx.currentMap.oa;
        const oaIdx = oa.oaIdx;
        const fieldInfo = oa.fields.find(function(f) { return f.name === field; });
        if (c.kind() === TK.rbrace) c.advance();
        const mapBufId = ctx.mapDynCount || 0;
        ctx.mapDynCount = mapBufId + 1;
        const _inferredType = fieldInfo ? fieldInfo.type : _syntheticFieldType(field);
        const fmt = _inferredType === 'string' ? '{s}' : '{d}';
        let args;
        if (_inferredType === 'string') {
          args = `_oa${oaIdx}_${field}[_i][0.._oa${oaIdx}_${field}_lens[_i]]`;
        } else {
          args = `_oa${oaIdx}_${field}[_i]`;
        }
        ctx.dynTexts.push({ bufId: mapBufId, fmtString: fmt, fmtArgs: args, arrName: '', arrIndex: 0, bufSize: 256, inMap: true, mapIdx: ctx.maps.indexOf(ctx.currentMap) });
        children.push({ nodeExpr: `.{ .text = "__mt${mapBufId}__" }`, dynBufId: mapBufId, inMap: true });
        return true;
      }

      // props.X followed by more tokens (e.g., props.active === 1) — handle via scriptBlock or drop
      const dropTokens2 = [String(propVal)];
      let depth2 = 1;
      while (depth2 > 0 && c.kind() !== TK.eof) {
        if (c.kind() === TK.lbrace) depth2++;
        if (c.kind() === TK.rbrace) depth2--;
        if (depth2 > 0) { dropTokens2.push(c.text()); c.advance(); }
      }
      if (c.kind() === TK.rbrace) c.advance();
      const exprText2 = dropTokens2.join(' ');
      if (ctx.scriptBlock && exprText2.length > 0) {
        const jsExpr2 = _normalizeJoinedJsExpr(exprText2);
        const slotIdx2 = ctx.stateSlots.length;
        ctx.stateSlots.push({ getter: '__jsExpr_' + slotIdx2, setter: '__setJsExpr_' + slotIdx2, initial: '', type: 'string' });
        const bufId2 = ctx.dynCount;
        ctx.dynTexts.push({ bufId: bufId2, fmtString: '{s}', fmtArgs: 'state.getSlotString(' + slotIdx2 + ')', arrName: '', arrIndex: 0, bufSize: 256 });
        ctx.dynCount++;
        ctx._jsDynTexts.push({ slotIdx: slotIdx2, jsExpr: jsExpr2 });
        children.push({ nodeExpr: '.{ .text = "" }', dynBufId: bufId2 });
      } else if (exprText2.length > 0) {
        ctx._droppedExpressions.push({ expr: exprText2, line: 0 });
      }
      return true;
    }
  }

  if (c.kind() === TK.identifier && isGetter(c.text())) {
    const getter = c.text();
    const slotIdx = findSlot(getter);
    const slot = ctx.stateSlots[slotIdx];
    c.advance();
    if (c.kind() === TK.question && slot && slot.type === 'boolean') {
      c.advance();
      let trueText = '';
      if (c.kind() === TK.string) {
        trueText = c.text().slice(1, -1);
        c.advance();
      }
      if (c.kind() === TK.colon) c.advance();
      let falseText = '';
      if (c.kind() === TK.string) {
        falseText = c.text().slice(1, -1);
        c.advance();
      }
      const ternaryExpr = `if (${slotGet(getter)}) @as([]const u8, "${trueText}") else @as([]const u8, "${falseText}")`;
      const bufId = ctx.dynCount;
      const bufSize = Math.max(64, trueText.length + falseText.length + 16);
      ctx.dynTexts.push({ bufId, fmtString: '{s}', fmtArgs: ternaryExpr, arrName: '', arrIndex: 0, bufSize });
      ctx.dynCount++;
      let braceDepth = 0;
      while (c.kind() !== TK.eof) {
        if (c.kind() === TK.lbrace) braceDepth++;
        if (c.kind() === TK.rbrace) {
          if (braceDepth === 0) break;
          braceDepth--;
        }
        c.advance();
      }
      if (c.kind() === TK.rbrace) c.advance();
      children.push({ nodeExpr: '.{ .text = "" }', dynBufId: bufId });
      return true;
    } else if (c.kind() === TK.eq_eq || c.kind() === TK.not_eq || c.kind() === TK.gt || c.kind() === TK.lt || c.kind() === TK.gt_eq || c.kind() === TK.lt_eq) {
      const op = c.kind() === TK.eq_eq ? '==' : c.kind() === TK.not_eq ? '!=' : c.text();
      c.advance();
      if ((op === '==' || op === '!=') && c.kind() === TK.equals) c.advance();
      let rhs = '';
      let rhsIsString = false;
      if (c.kind() === TK.number) {
        rhs = c.text();
        c.advance();
      } else if (c.kind() === TK.string) {
        rhs = c.text().slice(1, -1);
        c.advance();
        rhsIsString = true;
      }
      if (c.kind() === TK.question) {
        c.advance();
        let trueText = '';
        if (c.kind() === TK.string) {
          trueText = c.text().slice(1, -1);
          c.advance();
        }
        if (c.kind() === TK.colon) c.advance();
        function parseTernaryFalse() {
          if (c.kind() === TK.string) {
            const s = c.text().slice(1, -1);
            c.advance();
            return `"${s}"`;
          }
          if (c.kind() === TK.identifier && isGetter(c.text())) {
            const getterName = c.text();
            c.advance();
            if (c.kind() === TK.eq_eq || c.kind() === TK.not_eq) {
              const opName = c.kind() === TK.eq_eq ? '==' : '!=';
              c.advance();
              if (c.kind() === TK.equals) c.advance();
              let rhsName = '';
              if (c.kind() === TK.number) {
                rhsName = c.text();
                c.advance();
              } else if (c.kind() === TK.string) {
                rhsName = c.text().slice(1, -1);
                c.advance();
              }
              if (c.kind() === TK.question) {
                c.advance();
                let trueName = '';
                if (c.kind() === TK.string) {
                  trueName = c.text().slice(1, -1);
                  c.advance();
                }
                if (c.kind() === TK.colon) c.advance();
                const falseName = parseTernaryFalse();
                const condName = `(${slotGet(getterName)} ${opName} ${rhsName})`;
                return `if ${condName} @as([]const u8, "${trueName}") else @as([]const u8, ${falseName})`;
              }
            }
          }
          return '""';
        }
        let falseExpr = parseTernaryFalse();
        if (!falseExpr) falseExpr = '""';
        let cond;
        if (rhsIsString || slot.type === 'string') {
          const eql = `std.mem.eql(u8, ${slotGet(getter)}, "${rhs}")`;
          cond = op === '!=' ? `(!${eql})` : `(${eql})`;
        } else {
          cond = `(${slotGet(getter)} ${op} ${rhs})`;
        }
        const ternaryExpr = `if ${cond} @as([]const u8, "${trueText}") else @as([]const u8, ${falseExpr})`;
        const bufId = ctx.dynCount;
        const bufSize = Math.max(64, trueText.length + 32);
        ctx.dynTexts.push({ bufId, fmtString: '{s}', fmtArgs: ternaryExpr, arrName: '', arrIndex: 0, bufSize });
        ctx.dynCount++;
        let ternaryBraceDepth = 0;
        while (c.kind() !== TK.eof) {
          if (c.kind() === TK.lbrace) ternaryBraceDepth++;
          if (c.kind() === TK.rbrace) {
            if (ternaryBraceDepth === 0) break;
            ternaryBraceDepth--;
          }
          c.advance();
        }
        if (c.kind() === TK.rbrace) c.advance();
        children.push({ nodeExpr: '.{ .text = "" }', dynBufId: bufId });
      } else {
        while (c.kind() !== TK.rbrace && c.kind() !== TK.eof) c.advance();
        if (c.kind() === TK.rbrace) c.advance();
        children.push({ nodeExpr: '.{ .text = "" }' });
      }
      return true;
    } else {
      const bufId = ctx.dynCount;
      const fmt = slot.type === 'string' ? '{s}' : slot.type === 'float' ? '{d:.2}' : '{d}';
      const bufSize = slot.type === 'string' ? 128 : 64;
      const args = slotGet(getter);
      ctx.dynTexts.push({ bufId, fmtString: fmt, fmtArgs: args, arrName: '', arrIndex: 0, bufSize });
      ctx.dynCount++;
      const tailTokens = [];
      let tailBraceDepth = 0;
      while (c.kind() !== TK.eof) {
        if (c.kind() === TK.lbrace) tailBraceDepth++;
        if (c.kind() === TK.rbrace) {
          if (tailBraceDepth === 0) break;
          tailBraceDepth--;
        }
        tailTokens.push(c.text());
        c.advance();
      }
      if (c.kind() === TK.rbrace) c.advance();
      if (tailTokens.length > 0 && (ctx.scriptBlock || ctx.luaBlock)) {
        ctx.dynTexts.pop();
        ctx.dynCount--;
        const fullExpr = _normalizeJoinedJsExpr(getter + ' ' + tailTokens.join(' '));
        const jsSlotIdx = ctx.stateSlots.length;
        ctx.stateSlots.push({ getter: '__jsExpr_' + jsSlotIdx, setter: '__setJsExpr_' + jsSlotIdx, initial: '', type: 'string' });
        const jsBufId = ctx.dynCount;
        ctx.dynTexts.push({ bufId: jsBufId, fmtString: '{s}', fmtArgs: 'state.getSlotString(' + jsSlotIdx + ')', arrName: '', arrIndex: 0, bufSize: 256 });
        ctx.dynCount++;
        // Route to JS or Lua based on what's available
        if (ctx.scriptBlock) {
          ctx._jsDynTexts.push({ slotIdx: jsSlotIdx, jsExpr: fullExpr });
        } else if (ctx.luaBlock) {
          // Convert JS operators to Lua operators, and single-quoted strings to double-quoted
          let luaExpr = fullExpr.replace(/\|\|/g, 'or').replace(/&&/g, 'and').replace(/===/g, '==').replace(/!==/g, '~=');
          // Convert 'string' to "string" for Lua compatibility
          luaExpr = luaExpr.replace(/'([^']*)'/g, '"$1"');
          ctx._luaDynTexts.push({ slotIdx: jsSlotIdx, luaExpr: luaExpr });
        }
        children.push({ nodeExpr: '.{ .text = "" }', dynBufId: jsBufId });
      } else if (tailTokens.length > 0) {
        ctx._droppedExpressions.push({ expr: getter + ' ' + tailTokens.join(' '), line: 0 });
        children.push({ nodeExpr: '.{ .text = "" }', dynBufId: bufId });
      } else {
        children.push({ nodeExpr: '.{ .text = "" }', dynBufId: bufId });
      }
      return true;
    }
  }

  // String concatenation: {'str' + expr + 'str'} → dynText format string
  if (c.kind() === TK.string && c.pos + 1 < c.count && c.kindAt(c.pos + 1) === TK.plus) {
    const fmtParts = [];
    const fmtArgs = [];
    let allStatic = true;
    let braceDepth2 = 0;
    while (c.kind() !== TK.eof) {
      if (c.kind() === TK.rbrace && braceDepth2 === 0) break;
      if (c.kind() === TK.lbrace) braceDepth2++;
      if (c.kind() === TK.rbrace) { braceDepth2--; continue; }
      if (c.kind() === TK.string) {
        fmtParts.push(c.text().slice(1, -1));
        c.advance();
      } else if (c.kind() === TK.plus) {
        c.advance();
      } else if (c.kind() === TK.identifier) {
        const name = c.text();
        if (isGetter(name)) {
          const slotIdx = findSlot(name);
          const slot = ctx.stateSlots[slotIdx];
          if (slot && slot.type === 'string') {
            fmtParts.push('{s}');
            fmtArgs.push(slotGet(name));
          } else {
            fmtParts.push('{d}');
            fmtArgs.push(slotGet(name));
          }
          allStatic = false;
          c.advance();
        } else {
          // Check props access: props.X
          const pa = peekPropsAccess(c);
          if (pa) {
            skipPropsAccess(c);
            const pv = pa.value;
            const isZig = typeof pv === 'string' && (pv.includes('state.get') || pv.includes('getSlot'));
            if (isZig) {
              const isStr = pv.includes('getSlotString') || pv.includes('..');
              fmtParts.push(isStr ? '{s}' : '{d}');
              fmtArgs.push(isStr ? pv : leftFoldExpr(pv));
              allStatic = false;
            } else {
              fmtParts.push(String(pv));
            }
          } else if (ctx.propStack && ctx.propStack[name] !== undefined) {
            const pv = ctx.propStack[name];
            const isZig = typeof pv === 'string' && (pv.includes('state.get') || pv.includes('getSlot') || pv.includes('_oa'));
            if (isZig) {
              const isStr = pv.includes('getSlotString') || pv.includes('..');
              fmtParts.push(isStr ? '{s}' : '{d}');
              fmtArgs.push(isStr ? pv : leftFoldExpr(pv));
              allStatic = false;
            } else if (ctx.currentMap && typeof pv === 'string' && pv === ctx.currentMap.itemParam) {
              // prop resolves to map item — check for .field after
              c.advance(); // skip name
              if (c.kind() === TK.dot && c.pos + 1 < c.count && c.kindAt(c.pos + 1) === TK.identifier) {
                c.advance(); // skip .
                const fld = c.text();
                c.advance(); // skip field
                const mapOa = ctx.currentMap.oa;
                const fldInfo = mapOa ? mapOa.fields.find(function(f) { return f.name === fld; }) : null;
                if (mapOa && fldInfo && fldInfo.type === 'string') {
                  fmtParts.push('{s}');
                  fmtArgs.push(`_oa${mapOa.oaIdx}_${fld}[_i][0.._oa${mapOa.oaIdx}_${fld}_lens[_i]]`);
                } else if (mapOa) {
                  fmtParts.push('{d}');
                  fmtArgs.push(`_oa${mapOa.oaIdx}_${fld}[_i]`);
                } else {
                  fmtParts.push('0');
                }
                allStatic = false;
              } else {
                fmtParts.push(String(pv));
              }
              continue; // already advanced
            } else {
              fmtParts.push(String(pv));
            }
            c.advance();
          } else if (ctx.renderLocals && ctx.renderLocals[name] !== undefined) {
            const rlVal = ctx.renderLocals[name];
            const isZig = rlVal.includes('state.get') || rlVal.includes('getSlot');
            if (isZig) {
              fmtParts.push('{d}');
              fmtArgs.push(leftFoldExpr(rlVal));
              allStatic = false;
            } else {
              fmtParts.push(String(rlVal));
            }
            c.advance();
          } else {
            // Unknown identifier — stringify as literal (will be 0 or empty if unresolved)
            fmtParts.push(name);
            c.advance();
          }
        }
      } else if (c.kind() === TK.number) {
        fmtParts.push(c.text());
        c.advance();
      } else {
        c.advance();
      }
    }
    if (c.kind() === TK.rbrace) c.advance();
    const fmtString = fmtParts.join('');
    if (allStatic || fmtArgs.length === 0) {
      children.push({ nodeExpr: `.{ .text = ${zigStringLiteral(fmtString)} }` });
    } else {
      const isMapConcat = ctx.currentMap && fmtArgs.join(', ').includes('_oa');
      if (isMapConcat) {
        const mapBufId = ctx.mapDynCount || 0;
        ctx.mapDynCount = mapBufId + 1;
        ctx.dynTexts.push({ bufId: mapBufId, fmtString: fmtString, fmtArgs: fmtArgs.join(', '), arrName: '', arrIndex: 0, bufSize: 256, inMap: true, mapIdx: ctx.maps.indexOf(ctx.currentMap) });
        children.push({ nodeExpr: `.{ .text = "__mt${mapBufId}__" }`, dynBufId: mapBufId, inMap: true });
      } else {
        const bufId = ctx.dynCount;
        const bufSize = Math.max(64, fmtString.length + 20 * fmtArgs.length + 64);
        ctx.dynTexts.push({ bufId, fmtString: fmtString, fmtArgs: fmtArgs.join(', '), arrName: '', arrIndex: 0, bufSize });
        ctx.dynCount++;
        children.push({ nodeExpr: `.{ .text = "" }`, dynBufId: bufId });
      }
    }
    return true;
  }

  const dropStart = c.pos;
  const dropTokens = [];
  let depth = 1;
  while (depth > 0 && c.kind() !== TK.eof) {
    if (c.kind() === TK.lbrace) depth++;
    if (c.kind() === TK.rbrace) depth--;
    if (depth > 0) {
      dropTokens.push(c.text());
      c.advance();
    }
  }
  if (c.kind() === TK.rbrace) c.advance();
  const exprText = dropTokens.join(' ');

  if (ctx.scriptBlock && exprText.length > 0) {
    let jsExpr = _normalizeJoinedJsExpr(exprText);
    if (/^\w+$/.test(jsExpr) && ctx.scriptFuncs && ctx.scriptFuncs.indexOf(jsExpr) >= 0) {
      jsExpr = jsExpr + '()';
    }

    const slotIdx = ctx.stateSlots.length;
    ctx.stateSlots.push({ getter: '__jsExpr_' + slotIdx, setter: '__setJsExpr_' + slotIdx, initial: '', type: 'string' });

    const isInMap = !!ctx.currentMap;
    var bufId;
    if (isInMap) {
      bufId = ctx.mapDynCount || 0;
      ctx.mapDynCount = bufId + 1;
    } else {
      bufId = ctx.dynCount;
      ctx.dynCount++;
    }
    ctx.dynTexts.push({ bufId, fmtString: '{s}', fmtArgs: 'state.getSlotString(' + slotIdx + ')', arrName: '', arrIndex: 0, bufSize: 256, inMap: isInMap, mapIdx: isInMap ? ctx.maps.indexOf(ctx.currentMap) : -1 });

    ctx._jsDynTexts.push({ slotIdx: slotIdx, jsExpr: jsExpr });

    children.push({ nodeExpr: isInMap ? '.{ .text = "__mt' + bufId + '__" }' : '.{ .text = "" }', dynBufId: bufId, inMap: isInMap });
  } else if (exprText.length > 0) {
    ctx._droppedExpressions.push({ expr: exprText, line: c.starts[dropStart] || 0 });
  }

  return true;
}
