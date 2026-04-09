// ── Lua map node emit ───────────────────────────────────────────
// Pure structural emit helpers for converting parsed node contracts to Lua.
// NO prop resolution. NO identity rewriting. NO string re-parsing.
// Reads only from the normalized node contract produced by earlier phases.
//
// Dependencies (from emit_atoms/maps_lua/):
//   - _styleToLua from lua_map_style.js
//   - _textToLua from lua_map_text.js
//   - _handlerToLua from lua_map_handler.js
//   - _hexToLua, _jsExprToLua from lua_map_subs.js

// ── Section 1: Node Fields ──────────────────────────────────────
// Emit individual node fields from contract data

function _emitNodeStyle(node, itemParam, indexParam, _luaIdxExpr, _currentOaIdx) {
  if (!node) return null;
  // Variant styles: conditional style selection
  if (node._variantStyles && node._variantStyles.length > 1) {
    var parts = [];
    for (var i = 1; i < node._variantStyles.length; i++) {
      parts.push('(__variant == ' + i + ') and ' +
        _styleToLua(node._variantStyles[i], itemParam, indexParam, _luaIdxExpr, _currentOaIdx));
    }
    parts.push(_styleToLua(node._variantStyles[0], itemParam, indexParam, _luaIdxExpr, _currentOaIdx));
    return 'style = (' + parts.join(' or ') + ')';
  }
  // Single style object
  if (node.style && Object.keys(node.style).length > 0) {
    return 'style = ' + _styleToLua(node.style, itemParam, indexParam, _luaIdxExpr, _currentOaIdx);
  }
  return null;
}

function _emitNodeText(node, itemParam, indexParam, _luaIdxExpr, _currentOaIdx) {
  if (!node || node.text === undefined || node.text === null) return null;
  return 'text = ' + _textToLua(node.text, itemParam, indexParam, _luaIdxExpr, _currentOaIdx);
}

function _emitNodeInlineGlyphs(node) {
  if (!node || !node.inline_glyphs || node.inline_glyphs.length === 0) return null;

  var glyphParts = [];
  for (var i = 0; i < node.inline_glyphs.length; i++) {
    glyphParts.push(_inlineGlyphToLua(node.inline_glyphs[i]));
  }

  var parts = [];
  // If no text, emit sentinel
  if (node.text === undefined || node.text === null || node.text === '') {
    parts.push('text = ' + _inlineGlyphSentinelText(node.inline_glyphs));
  }
  parts.push('inline_glyphs = { ' + glyphParts.join(', ') + ' }');
  return parts.join(', ');
}

function _emitNodeFontSize(node) {
  if (!node || !node.fontSize) return null;
  return 'font_size = ' + node.fontSize;
}

function _emitNodeTextColor(node) {
  if (!node || !node.color) return null;

  var cv = node.color;
  if (typeof cv === 'string' && (cv.indexOf('if ') === 0 || cv.indexOf('@') >= 0 ||
      cv.indexOf('state.get') >= 0 || cv.indexOf(' and ') >= 0 ||
      /\b[A-Za-z_]\w*\s*\(/.test(cv))) {
    // Complex expression - delegate to style layer's color handling
    return _emitComplexTextColor(node);
  }

  // Simple color value
  var colorLua = _zigColorToLuaHex(cv) || _hexToLua(cv);
  if (colorLua) return 'text_color = ' + colorLua;
  return null;
}

// Complex color expressions that need __eval wrapping
function _emitComplexTextColor(node) {
  var cv = node.color;
  var oaMatch = cv.match(/_oa\d+_(\w+)\[_i\]/);
  if (oaMatch) {
    return 'text_color = _item.' + oaMatch[1];
  }

  // Transform complex Zig/JS expression to Lua
  var js = cv
    .replace(/Color\.rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*\d+)?\)/g, function(_, r, g, b) {
      return '0x' + ((+r << 16) | (+g << 8) | +b).toString(16).padStart(6, '0');
    });

  // Strip Zig wrappers
  for (var i = 0; i < 5; i++) {
    js = js.replace(/@as\([^,]+,\s*([^)]*)\)/g, '$1');
  }
  js = js.replace(/@intCast\(/g, '(');
  js = js.replace(/qjs_runtime\.evalToString\("String\(([^"]+)\)"[^)]*\)/g, '$1');
  js = js.replace(/qjs_runtime\.evalToString\("([^"]+)"[^)]*\)/g, '$1');
  js = js.replace(/,\s*&_eval_buf_\d+/g, '');
  js = js.replace(/&_eval_buf_\d+/g, '');

  // State slots and OA refs
  js = js.replace(/state\.getSlot(?:Int|Float|Bool|String)?\((\d+)\)/g, function(_, idx) {
    return (ctx && ctx.stateSlots && ctx.stateSlots[+idx]) ? ctx.stateSlots[+idx].getter : '_slot' + idx;
  });
  js = js.replace(/_oa\d+_(\w+)\[_i\]/g, '_item.$1');
  js = js.replace(/([A-Za-z_]\w*(?:\.[A-Za-z_]\w+)*)\.len\b/g, '#$1');

  // Convert Zig if/else to Lua and/or
  for (var iter = 0; iter < 10; iter++) {
    var ifPos = js.indexOf('if (');
    if (ifPos < 0) break;
    var depth = 0, ci = ifPos + 3;
    for (; ci < js.length; ci++) {
      if (js[ci] === '(') depth++;
      if (js[ci] === ')') { depth--; if (depth === 0) break; }
    }
    if (depth !== 0) break;
    var cond = js.substring(ifPos + 4, ci);
    var rest = js.substring(ci + 1).trim();
    var elseIdx = rest.indexOf(' else ');
    if (elseIdx < 0) break;
    var trueVal = rest.substring(0, elseIdx).trim();
    var prefix = js.substring(0, ifPos);
    var suffix = rest.substring(elseIdx + 6).trim();
    js = prefix + '(' + cond + ') and ' + trueVal + ' or ' + suffix;
  }

  // Clean orphan parens
  var open = (js.match(/\(/g) || []).length;
  var close = (js.match(/\)/g) || []).length;
  while (close > open && js.endsWith(')')) { js = js.slice(0, -1); close--; }

  // Emit as bare Lua or __eval wrapped
  if (/\band\b/.test(js) && !/[?:]/.test(js) && !/\bif\b/.test(js)) {
    return 'text_color = ' + js;
  } else if (/^0x[0-9a-f]+$/i.test(js) || /^_item\.\w+$/.test(js)) {
    return 'text_color = ' + js;
  } else {
    return 'text_color = __eval(' + zigStringLiteral(js) + ')';
  }
}

function _emitNodeTerminalFlags(node) {
  if (!node) return null;
  var parts = [];
  if (node.terminal) {
    parts.push('terminal = true');
    parts.push('terminal_id = ' + (node.terminal_id || 0));
  }
  return parts.length > 0 ? parts.join(', ') : null;
}

function _emitNodeInputFlags(node) {
  if (!node || !node.text_input) return null;
  var parts = [];
  parts.push('text_input = true');
  parts.push('input_id = ' + (node.input_id || 0));
  if (node.multiline) parts.push('multiline = true');
  return parts.join(', ');
}

function _emitNodeHandler(node, itemParam, indexParam, _luaIdxExpr, _currentOaIdx) {
  if (!node || !node.handler) return null;

  if (node.handlerIsJs) {
    // JS handler - apply index substitution
    var jh = _jsExprToLua(node.handler, itemParam, indexParam, _luaIdxExpr, _currentOaIdx);
    var ixStr = _luaIdxExpr || '(_i - 1)';

    // Resolve Zig index casts
    jh = jh.replace(/@as\(i64,\s*@intCast\((_\w+)\)\)/g, function(_, v) {
      if (v === '_i') return ixStr;
      if (v === '_ni') return '(_ni - 1)';
      return '(' + v + ' - 1)';
    });

    if (typeof _normalizeHandlerIndexExprs === 'function') {
      jh = _normalizeHandlerIndexExprs(jh, ixStr);
    }

    var isDynamic = jh.indexOf('_item') >= 0 || jh.indexOf('_nitem') >= 0 ||
                    jh.indexOf(ixStr) >= 0 || jh.indexOf('(_i - 1)') >= 0 ||
                    jh.indexOf('(_ni - 1)') >= 0;

    if (isDynamic) {
      return 'js_on_press = "' + _spliceDynamicHandler(jh, ixStr) + '"';
    } else {
      return 'js_on_press = ' + luaStringLiteral(jh);
    }
  } else {
    // Lua handler
    return 'lua_on_press = ' + _handlerToLua(node.handler, itemParam, indexParam, _luaIdxExpr, _currentOaIdx);
  }
}

function _emitNodeCanvasFields(node) {
  if (!node || !node._nodeFields) return null;
  var parts = [];
  for (var key in node._nodeFields) {
    var val = node._nodeFields[key];
    if (typeof val === 'string') {
      // Color transforms
      val = val.replace(/Color\.rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*\d+)?\)/g, function(_, r, g, b) {
        return '0x' + ((+r << 16) | (+g << 8) | +b).toString(16).padStart(6, '0');
      });
      val = val.replace(/qjs_runtime\.evalToString\("String\(([^)]+)\)"[^)]*\)/g, '__eval("$1")');
      val = val.replace(/qjs_runtime\.evalToString\("([^"]+)"[^)]*\)/g, '__eval("$1")');
      val = val.replace(/&_eval_buf_\d+/g, '');
      // OA refs
      val = val.replace(/_oa\d+_(\w+)\[_i\]\[0\.\._oa\d+_\w+_lens\[_i\]\]/g, '_item.$1');
      val = val.replace(/_oa\d+_(\w+)\[_i\]/g, '_item.$1');
    }
    parts.push(key + ' = ' + val);
  }
  return parts.length > 0 ? parts.join(', ') : null;
}

function _emitNodeScrollFields(node, itemParam) {
  if (!node || itemParam) return null; // Only at root level

  var overflow = node.style && node.style.overflow;
  if (typeof overflow === 'string' && overflow.charAt(0) === '.') overflow = overflow.slice(1);

  if (overflow !== 'scroll') return null;
  if (typeof ctx === 'undefined' || ctx.nextScrollPersistSlot === undefined) return null;

  ctx.nextScrollPersistSlot += 1;
  var sid = ctx.nextScrollPersistSlot;
  return 'scroll_y = ((_scrollY and _scrollY[' + sid + ']) or 0), scroll_persist_slot = ' + sid;
}

// ── Section 2: Glyph Helpers ────────────────────────────────────

function _inlineGlyphColorToLua(val) {
  if (val === undefined || val === null || val === '') return '"transparent"';
  if (typeof val === 'number') return String(val);
  var asString = String(val);
  if (asString === 'transparent') return '"transparent"';
  var zigHex = _zigColorToLuaHex(asString);
  if (zigHex) return zigHex;
  var hexVal = _hexToLua(asString);
  if (typeof hexVal === 'string' && /^0x[0-9a-f]+$/i.test(hexVal)) return hexVal;
  return luaStringLiteral(asString);
}

function _inlineGlyphToLua(glyph) {
  if (!glyph) return '{ d = "" }';
  var parts = [];
  parts.push('d = ' + luaStringLiteral(String(glyph.d || '')));
  parts.push('fill = ' + _inlineGlyphColorToLua(glyph.fill));
  parts.push('stroke = ' + _inlineGlyphColorToLua(glyph.stroke));
  parts.push('stroke_width = ' + (glyph.stroke_width !== undefined ? glyph.stroke_width : 0));
  parts.push('scale = ' + (glyph.scale !== undefined ? glyph.scale : 1.0));
  if (glyph.fill_effect) {
    parts.push('fill_effect = ' + luaStringLiteral(String(glyph.fill_effect)));
  }
  return '{ ' + parts.join(', ') + ' }';
}

function _inlineGlyphSentinelText(glyphs) {
  if (!glyphs || glyphs.length <= 0) return '"\\x01"';
  var sentinels = '';
  for (var i = 0; i < glyphs.length; i++) sentinels += '\\x01';
  return '"' + sentinels + '"';
}

// ── Section 3: Conditionals ─────────────────────────────────────
// Emit conditional children (cond && <Element/>)

function _emitConditionalChild(cond, nodeLua, itemParam, indexParam, _luaIdxExpr, _currentOaIdx) {
  // Convert condition expression
  var luaCond = (typeof cond === 'string' && cond.indexOf('__eval("') >= 0)
    ? cond
    : _jsExprToLua(cond, itemParam, indexParam, _luaIdxExpr, _currentOaIdx);
  luaCond = _wrapCondEval(luaCond);

  // Bitwise results need explicit ~= 0 check in Lua
  if (/\bbit\./.test(luaCond)) luaCond = luaCond + ' ~= 0';

  // If body already ends with 'or nil', don't double-wrap
  if (nodeLua.lastIndexOf(' or nil') === nodeLua.length - 7) {
    return '(' + luaCond + ') and ' + nodeLua;
  }
  return '(' + luaCond + ') and ' + nodeLua + ' or nil';
}

// ── Section 4: Ternaries ────────────────────────────────────────
// Emit ternary branches (cond ? <True/> : <False/>)

function _emitTernaryChildren(tcond, trueNodeLua, falseNodeLua, itemParam, indexParam, _luaIdxExpr, _currentOaIdx) {
  var luaCond = (typeof tcond === 'string' && tcond.indexOf('__eval("') >= 0)
    ? tcond
    : _jsExprToLua(tcond, itemParam, indexParam, _luaIdxExpr, _currentOaIdx);
  luaCond = _wrapCondEval(luaCond);

  var results = [];
  results.push('(' + luaCond + ') and ' + trueNodeLua + ' or nil');
  results.push('(not (' + luaCond + ')) and ' + falseNodeLua + ' or nil');
  return results;
}

// ── Section 5: Nested Maps ──────────────────────────────────────
// Emit nested map constructs

function _emitNestedMapChild(nm, itemParam, indexParam, indent, _luaIdxExpr, _currentOaIdx) {
  // nm = { field, itemParam, indexParam, bodyNode }
  // Use canonical map identity for nested context (always _nitem/_ni for inner map)
  var innerId = (typeof _getMapIdentity === 'function') ? _getMapIdentity('(_ni - 1)') : { itemVar: '_nitem', idxVar: '_ni', idxExpr: '(_ni - 1)' };
  var outerId = (typeof _getMapIdentity === 'function') ? _getMapIdentity(_luaIdxExpr) : { itemVar: '_item', idxVar: '_i', idxExpr: _luaIdxExpr || '(_i - 1)' };
  var innerBody = _nodeToLua(nm.bodyNode, nm.itemParam || innerId.itemVar, nm.indexParam, indent + '  ', null, null);
  // nm.field is accessed from outer item variable
  return '__luaNestedMap(' + outerId.itemVar + '.' + nm.field + ', function(' + innerId.itemVar + ', ' + innerId.idxVar + ')\n' +
    indent + '    return ' + innerBody + '\n' +
    indent + '  end)';
}

function _emitLuaMapLoopChild(ml, itemParam, indexParam, indent, _luaIdxExpr, _currentOaIdx) {
  // ml = { dataVar, indexParam, bodyNode/bodyLua, filterConditions, parentIndexParam, parentItemParam, oaIdx }
  // Get canonical map identities for outer and inner contexts
  var outerId = (typeof _getMapIdentity === 'function') ? _getMapIdentity(_luaIdxExpr) : { itemVar: '_item', idxVar: '_i', idxExpr: _luaIdxExpr || '(_i - 1)' };
  var isNested = !!itemParam;
  var innerLuaIdx = isNested ? '(_ni - 1)' : null;
  var innerId = (typeof _getMapIdentity === 'function') ? _getMapIdentity(innerLuaIdx) : { itemVar: isNested ? '_nitem' : '_item', idxVar: isNested ? '_ni' : '_i', idxExpr: innerLuaIdx || '(_i - 1)' };
  var innerIdxP = ml.indexParam || null;

  var loopDataVar = _jsExprToLua(ml.dataVar || '[]', itemParam, indexParam, _luaIdxExpr, _currentOaIdx);

  var loopBody;
  if (ml.bodyNode) {
    loopBody = _nodeToLua(ml.bodyNode, ml.itemParam, innerIdxP, indent + '    ', innerLuaIdx, ml.oaIdx);
    // Ensure inner item refs use correct variable
    if (isNested && innerId.itemVar === '_nitem') {
      loopBody = loopBody.replace(/\b_item\b/g, '_nitem');
    }
  } else if (ml.bodyLua) {
    loopBody = ml.bodyLua;
  } else {
    loopBody = '{}';
  }

  // Apply parent param substitutions for nested maps using canonical identity
  if (isNested) {
    if (ml.parentIndexParam) {
      loopBody = loopBody.replace(new RegExp('\\b' + ml.parentIndexParam + '\\b', 'g'), outerId.idxExpr);
    }
    if (indexParam) {
      loopBody = loopBody.replace(new RegExp('\\b' + indexParam + '\\b', 'g'), outerId.idxExpr);
    }
    if (ml.parentItemParam) {
      loopBody = loopBody.replace(new RegExp('\\b' + ml.parentItemParam + '\\b', 'g'), outerId.itemVar);
    }
    if (itemParam) {
      loopBody = loopBody.replace(new RegExp('\\b' + itemParam + '\\b', 'g'), outerId.itemVar);
    }
  }

  // Apply filters with proper context
  if (ml.filterConditions && ml.filterConditions.length > 0) {
    var filterParts = [];
    for (var i = 0; i < ml.filterConditions.length; i++) {
      var fc = ml.filterConditions[i];
      var filterCond = _jsExprToLua(fc.raw, ml.itemParam, fc.indexParam || innerIdxP, innerLuaIdx, ml.oaIdx);
      filterCond = _wrapCondEval(filterCond);
      // Ensure inner item refs use _nitem
      if (isNested) filterCond = filterCond.replace(/\b_item\b/g, '_nitem');
      if (isNested && ml.parentIndexParam) {
        filterCond = filterCond.replace(new RegExp('\\b' + ml.parentIndexParam + '\\b', 'g'), outerId.idxExpr);
      }
      if (isNested && indexParam) {
        filterCond = filterCond.replace(new RegExp('\\b' + indexParam + '\\b', 'g'), outerId.idxExpr);
      }
      filterParts.push('(' + filterCond + ')');
    }
    loopBody = filterParts.join(' and ') + ' and ' + loopBody + ' or nil';
  }

  return '__mapLoop(' + loopDataVar + ', function(' + innerId.itemVar + ', ' + innerId.idxVar + ')\n' +
    indent + '    return ' + loopBody + '\n' +
    indent + '  end)';
}

// ── Section 6: Children ─────────────────────────────────────────
// Emit child nodes array

function _emitNodeChildren(node, itemParam, indexParam, indent, _luaIdxExpr, _currentOaIdx) {
  if (!node || !node.children || node.children.length === 0) return null;

  var childLua = [];
  for (var i = 0; i < node.children.length; i++) {
    var child = node.children[i];

    if (child.condition) {
      // Conditional child
      var childBody = _nodeToLua(child.node, itemParam, indexParam, indent + '  ', _luaIdxExpr, _currentOaIdx);
      childLua.push(_emitConditionalChild(child.condition, childBody, itemParam, indexParam, _luaIdxExpr, _currentOaIdx));

    } else if (child.ternaryCondition) {
      // Ternary child
      var trueBody = _nodeToLua(child.trueNode, itemParam, indexParam, indent + '  ', _luaIdxExpr, _currentOaIdx);
      var falseBody = _nodeToLua(child.falseNode, itemParam, indexParam, indent + '  ', _luaIdxExpr, _currentOaIdx);
      var ternResults = _emitTernaryChildren(child.ternaryCondition, trueBody, falseBody, itemParam, indexParam, _luaIdxExpr, _currentOaIdx);
      childLua.push.apply(childLua, ternResults);

    } else if (child.nestedMap) {
      // Nested map
      childLua.push(_emitNestedMapChild(child.nestedMap, itemParam, indexParam, indent, _luaIdxExpr, _currentOaIdx));

    } else if (child.luaMapLoop) {
      // Lua map loop
      childLua.push(_emitLuaMapLoopChild(child.luaMapLoop, itemParam, indexParam, indent, _luaIdxExpr, _currentOaIdx));

    } else {
      // Regular child node
      childLua.push(_nodeToLua(child, itemParam, indexParam, indent + '  ', _luaIdxExpr, _currentOaIdx));
    }
  }

  // Track children block metadata
  var cbValues = 0, cbConds = 0;
  for (var j = 0; j < childLua.length; j++) {
    if (childLua[j].indexOf('or nil') >= 0) cbConds++;
    else cbValues++;
  }
  if (typeof ctx !== 'undefined') {
    if (!ctx._childrenManifest) ctx._childrenManifest = [];
    ctx._childrenManifest.push({ total: childLua.length, values: cbValues, conditionals: cbConds });
  }

  return 'children = {\n' + childLua.map(function(ch) { return indent + '  ' + ch; }).join(',\n') + '\n' + indent + '}';
}

// ── Section 7: Condition Wrapper ────────────────────────────────
// Wrap condition expressions for Lua eval

var _luaBuiltins = {
  tostring:1, tonumber:1, type:1, pairs:1, ipairs:1, print:1, pcall:1,
  math:1, string:1, table:1, unpack:1, not:1, band:1, bor:1, bxor:1,
  bnot:1, lshift:1, rshift:1, bit:1, __eval:1
};

function _cleanCondForEval(expr) {
  // State slot refs → getter names
  expr = expr.replace(/state\.getSlot(?:Int|Float|Bool)?\((\d+)\)/g, function(_, idx) {
    return (typeof ctx !== 'undefined' && ctx.stateSlots && ctx.stateSlots[+idx])
      ? ctx.stateSlots[+idx].getter : '_slot' + idx;
  });
  // Zig casts
  for (var i = 0; i < 3; i++) {
    expr = expr.replace(/@as\(\w+,\s*([^)]+)\)/g, '$1');
    expr = expr.replace(/@intCast\(([^)]+)\)/g, '$1');
    expr = expr.replace(/@floatFromInt\(([^)]+)\)/g, '$1');
  }
  // OA refs
  expr = expr.replace(/_oa\d+_(\w+)\[_i\]\[0\.\._oa\d+_\w+_lens\[_i\]\]/g, '_item.$1');
  expr = expr.replace(/_oa\d+_(\w+)\[_i\]/g, '_item.$1');
  // std.mem.eql → Lua string compare
  expr = expr.replace(/!std\.mem\.eql\(u8,\s*([^,]+),\s*([^)]+)\)/g, '($1 ~= $2)');
  expr = expr.replace(/std\.mem\.eql\(u8,\s*([^,]+),\s*([^)]+)\)/g, '($1 == $2)');
  // Clean orphan parens
  var open = (expr.match(/\(/g) || []).length;
  var close = (expr.match(/\)/g) || []).length;
  while (close > open && expr.endsWith(')')) { expr = expr.slice(0, -1); close--; }
  return expr;
}

function _wrapCondEval(cond) {
  if (typeof cond === 'string') cond = cond.trim();

  // Already wrapped
  if (typeof cond === 'string' && cond.indexOf('__eval("') === 0) {
    // Handle nested __eval patterns
    var outerInner = cond.slice(8).replace(/"\)$/, '').replace(/\\"/g, '"').replace(/\\\\/g, '\\');
    var nonEmpty = outerInner.match(/^\(__eval\("([^"]+)"\)\s*~=\s*""\)$/);
    if (nonEmpty) return '(__eval("' + nonEmpty[1] + '") ~= "")';
    var empty = outerInner.match(/^\(__eval\("([^"]+)"\)\s*==\s*""\)$/);
    if (empty) return '(__eval("' + empty[1] + '") == "")';
  }

  // Clean nested eval patterns
  cond = cond.replace(/__eval\("\(__eval\\\("([^"]+)"\\\)\s*~=\s*\\"\\"\)"\)/g, '(__eval("$1") ~= "")');
  cond = cond.replace(/__eval\("\(__eval\\\("([^"]+)"\\\)\s*==\s*\\"\\"\)"\)/g, '(__eval("$1") == "")');

  // Check for function calls that need __eval
  var m = cond.match(/\b([a-zA-Z_]\w*)\s*\(/g);
  if (m) {
    for (var i = 0; i < m.length; i++) {
      var fname = m[i].replace(/\s*\($/, '');
      if (!_luaBuiltins[fname]) {
        var cleaned = _cleanCondForEval(cond);
        var stillNeedsEval = false;
        var cm = cleaned.match(/\b([a-zA-Z_]\w*)\s*\(/g);
        if (cm) {
          for (var ci = 0; ci < cm.length; ci++) {
            var cfn = cm[ci].replace(/\s*\($/, '');
            if (!_luaBuiltins[cfn]) { stillNeedsEval = true; break; }
          }
        }
        if (stillNeedsEval) return '__eval("' + cleaned.replace(/"/g, '\\"') + '")';
        return cleaned;
      }
    }
  }

  // Zig syntax that needs cleaning
  if (/@|state\.getSlot/.test(cond)) {
    var cleaned2 = _cleanCondForEval(cond);
    if (!/@/.test(cleaned2) && !/state\.getSlot/.test(cleaned2)) return cleaned2;
    return '__eval("' + cleaned2.replace(/"/g, '\\"') + '")';
  }

  return cond;
}

// ── Section 8: Main Entry ───────────────────────────────────────
// Main node-to-Lua conversion - orchestrates the helpers above

function _nodeToLua(node, itemParam, indexParam, indent, _luaIdxExpr, _currentOaIdx) {
  if (!node) return '{}';
  if (!indent) indent = '      ';

  var fields = [];

  // Style
  var styleField = _emitNodeStyle(node, itemParam, indexParam, _luaIdxExpr, _currentOaIdx);
  if (styleField) fields.push(styleField);

  // Text
  var textField = _emitNodeText(node, itemParam, indexParam, _luaIdxExpr, _currentOaIdx);
  if (textField) fields.push(textField);

  // Inline glyphs
  var glyphFields = _emitNodeInlineGlyphs(node);
  if (glyphFields) {
    // glyphFields can be multiple fields joined by ', '
    fields.push(glyphFields);
  }

  // Font size
  var fontField = _emitNodeFontSize(node);
  if (fontField) fields.push(fontField);

  // Text color (complex, may rewrite node.style)
  if (node.style && node.style.text_color && typeof node.style.text_color === 'string' &&
      /\band\b/.test(node.style.text_color) &&
      (!node.color || node.color === 'Color.rgb(0, 0, 0)' || node.color === '0x000000' ||
       (typeof node.color === 'string' && node.color.indexOf('Color') >= 0 && node.color.indexOf('and') < 0))) {
    node.color = node.style.text_color;
    delete node.style.text_color;
  }
  var colorField = _emitNodeTextColor(node);
  if (colorField) fields.push(colorField);

  // Terminal flags
  var termFields = _emitNodeTerminalFlags(node);
  if (termFields) fields.push(termFields);

  // Input flags
  var inputFields = _emitNodeInputFlags(node);
  if (inputFields) fields.push(inputFields);

  // Handler
  var handlerField = _emitNodeHandler(node, itemParam, indexParam, _luaIdxExpr, _currentOaIdx);
  if (handlerField) fields.push(handlerField);

  // Canvas/Graph/3D fields
  var canvasFields = _emitNodeCanvasFields(node);
  if (canvasFields) fields.push(canvasFields);

  // Children (includes conditionals, ternaries, nested maps, loops)
  var childrenField = _emitNodeChildren(node, itemParam, indexParam, indent, _luaIdxExpr, _currentOaIdx);
  if (childrenField) fields.push(childrenField);

  // Scroll persistence (root only)
  var scrollField = _emitNodeScrollFields(node, itemParam);
  if (scrollField) fields.push(scrollField);

  // Unwrap optimization: no fields and single conditional child
  if (fields.length === 0 && node.children && node.children.length === 1) {
    // The child is already emitted as conditional Lua in childrenField,
    // but we checked fields.length === 0 so childrenField wasn't pushed.
    // Re-emit just the conditional directly.
    var child = node.children[0];
    if (child.condition) {
      var condBody = _nodeToLua(child.node, itemParam, indexParam, indent + '  ', _luaIdxExpr, _currentOaIdx);
      return _emitConditionalChild(child.condition, condBody, itemParam, indexParam, _luaIdxExpr, _currentOaIdx);
    }
  }

  return '{ ' + fields.join(', ') + ' }';
}
