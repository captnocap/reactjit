// ── Lua map node emit ───────────────────────────────────────────
// Turns a parsed JSX node into a Lua table literal. Recursive.
// Uses _styleToLua from lua_map_style.js.
// Uses _textToLua from lua_map_text.js.
// Uses _handlerToLua from lua_map_handler.js.
// Uses _hexToLua, _jsExprToLua from lua_map_subs.js.

// If a condition contains function calls that aren't Lua builtins, wrap in __eval
var _luaBuiltins = { tostring:1, tonumber:1, type:1, pairs:1, ipairs:1, print:1, pcall:1, math:1, string:1, table:1, unpack:1, not:1 };
function _cleanCondForEval(expr) {
  // State slot refs → getter names
  expr = expr.replace(/state\.getSlot(?:Int|Float|Bool)?\((\d+)\)/g, function(_, idx) {
    return (typeof ctx !== 'undefined' && ctx.stateSlots && ctx.stateSlots[+idx]) ? ctx.stateSlots[+idx].getter : '_slot' + idx;
  });
  // Zig casts
  for (var _ci = 0; _ci < 3; _ci++) {
    expr = expr.replace(/@as\(\w+,\s*([^)]+)\)/g, '$1');
    expr = expr.replace(/@intCast\(([^)]+)\)/g, '$1');
    expr = expr.replace(/@floatFromInt\(([^)]+)\)/g, '$1');
  }
  // OA refs
  expr = expr.replace(/_oa\d+_(\w+)\[_i\]\[0\.\._oa\d+_\w+_lens\[_i\]\]/g, '_item.$1');
  expr = expr.replace(/_oa\d+_(\w+)\[_i\]/g, '_item.$1');
  // Clean orphan parens
  var _o = (expr.match(/\(/g) || []).length;
  var _c = (expr.match(/\)/g) || []).length;
  while (_c > _o && expr.endsWith(')')) { expr = expr.slice(0, -1); _c--; }
  return expr;
}

function _wrapCondEval(cond) {
  // Check for function calls: word( where word isn't a Lua builtin
  var m = cond.match(/\b([a-zA-Z_]\w*)\s*\(/g);
  if (m) {
    for (var i = 0; i < m.length; i++) {
      var fname = m[i].replace(/\s*\($/, '');
      if (!_luaBuiltins[fname]) {
        // Has a non-Lua function call — clean and check if result is valid Lua
        var cleaned = _cleanCondForEval(cond);
        // If cleaning removed all non-Lua syntax, return as bare Lua
        var _stillNeedsEval = false;
        var _cm = cleaned.match(/\b([a-zA-Z_]\w*)\s*\(/g);
        if (_cm) { for (var _ci = 0; _ci < _cm.length; _ci++) { var _cfn = _cm[_ci].replace(/\s*\($/, ''); if (!_luaBuiltins[_cfn]) { _stillNeedsEval = true; break; } } }
        if (_stillNeedsEval) return '__eval("' + cleaned.replace(/"/g, '\\"') + '")';
        return cleaned;
      }
    }
  }
  // Also check for Zig syntax that needs cleaning even without function calls
  if (/@|state\.getSlot/.test(cond)) {
    var cleaned = _cleanCondForEval(cond);
    // If cleaning removed all Zig, it's now valid Lua
    if (!/@/.test(cleaned) && !/state\.getSlot/.test(cleaned)) return cleaned;
    return '__eval("' + cleaned.replace(/"/g, '\\"') + '")';
  }
  return cond;
}

function _nodeToLua(node, itemParam, indexParam, indent, _luaIdxExpr) {
  if (!node) return '{}';
  if (!indent) indent = '      ';
  var fields = [];

  if (node.style && Object.keys(node.style).length > 0) {
    fields.push('style = ' + _styleToLua(node.style, itemParam, indexParam, _luaIdxExpr));
  }

  if (node.text !== undefined && node.text !== null) {
    fields.push('text = ' + _textToLua(node.text, itemParam, indexParam, _luaIdxExpr));
  }

  if (node.fontSize) {
    fields.push('font_size = ' + node.fontSize);
  }

  if (node.color) {
    var _cv = node.color;
    if (typeof _cv === 'string' && (_cv.indexOf('if ') === 0 || _cv.indexOf('@') >= 0 || _cv.indexOf('state.get') >= 0)) {
      // OA ref in color → _item.field
      var _oaColor = _cv.match(/_oa\d+_(\w+)\[_i\]/);
      if (_oaColor) {
        fields.push('text_color = _item.' + _oaColor[1]);
      } else {
        var _jsColor = _cv;
        // Color.rgb/rgba → hex FIRST
        _jsColor = _jsColor.replace(/Color\.rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*\d+)?\)/g, function(_, r, g, b) {
          return '0x' + ((+r << 16) | (+g << 8) | +b).toString(16).padStart(6, '0');
        });
        // @as strip
        for (var _cai = 0; _cai < 5; _cai++) {
          _jsColor = _jsColor.replace(/@as\([^,]+,\s*([^)]*)\)/g, '$1');
        }
        _jsColor = _jsColor.replace(/@intCast\(/g, '(');
        // State slots → getter names
        _jsColor = _jsColor.replace(/state\.getSlot(?:Int|Float|Bool|String)?\((\d+)\)/g, function(_, idx) {
          return (ctx && ctx.stateSlots && ctx.stateSlots[+idx]) ? ctx.stateSlots[+idx].getter : '_slot' + idx;
        });
        // OA refs
        _jsColor = _jsColor.replace(/_oa\d+_(\w+)\[_i\]/g, '_item.$1');
        // Zig if/else → Lua and/or (balanced paren match)
        var _ifColorMatch = _jsColor.match(/^if\s*\(/);
        if (_ifColorMatch) {
          var _cd = 0, _cci = 3;
          for (; _cci < _jsColor.length; _cci++) {
            if (_jsColor[_cci] === '(') _cd++;
            if (_jsColor[_cci] === ')') { _cd--; if (_cd === 0) break; }
          }
          if (_cd === 0) {
            var _ccond = _jsColor.substring(4, _cci);
            var _crest = _jsColor.substring(_cci + 1).trim();
            var _celse = _crest.split(/\s+else\s+/);
            if (_celse.length === 2) {
              _jsColor = '(' + _ccond + ') and ' + _celse[0].trim() + ' or ' + _celse[1].trim();
            }
          }
        }
        // Clean orphan parens
        var _co = (_jsColor.match(/\(/g) || []).length;
        var _cc2 = (_jsColor.match(/\)/g) || []).length;
        while (_cc2 > _co && _jsColor.endsWith(')')) { _jsColor = _jsColor.slice(0, -1); _cc2--; }
        // Emit as bare Lua if clean, otherwise __eval
        if (/\band\b/.test(_jsColor) && !/[?:]/.test(_jsColor) && !/\bif\b/.test(_jsColor)) {
          fields.push('text_color = ' + _jsColor);
        } else if (/^0x[0-9a-f]+$/i.test(_jsColor) || /^_item\.\w+$/.test(_jsColor)) {
          fields.push('text_color = ' + _jsColor);
        } else {
          fields.push('text_color = __eval("' + _jsColor.replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '")');
        }
      }
    } else {
      var _colorLua = _zigColorToLuaHex(_cv) || _hexToLua(_cv);
      fields.push('text_color = ' + _colorLua);
    }
  }

  if (node.handler) {
    if (node.handlerIsJs) {
      // Apply same prop/index substitution as lua_on_press so map index props
      // (e.g. idx={i}) get resolved to the correct 0-based value in the string.
      var _jh = _jsExprToLua(node.handler, itemParam, indexParam, _luaIdxExpr);
      // Resolve Zig index casts embedded at parse time into 0-based Lua expressions
      var _ixStr = _luaIdxExpr || '(_i - 1)';
      _jh = _jh.replace(/@as\(i64,\s*@intCast\((_\w+)\)\)/g, function(_, v) {
        return v === '_i' ? _ixStr : '(' + v + ' - 1)';
      });
      var _jhDyn = _jh.indexOf('_item') >= 0 || _jh.indexOf(_ixStr) >= 0 || _jh.indexOf('(_i - 1)') >= 0;
      if (_jhDyn) {
        fields.push('js_on_press = "' + _spliceDynamicHandler(_jh, _ixStr) + '"');
      } else {
        fields.push('js_on_press = "' + _jh.replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"');
      }
    } else {
      fields.push('lua_on_press = ' + _handlerToLua(node.handler, itemParam, indexParam, _luaIdxExpr));
    }
  }

  // Canvas/Graph/3D/Physics node fields
  if (node._nodeFields) {
    for (var _nk in node._nodeFields) {
      var _nv = node._nodeFields[_nk];
      if (typeof _nv === 'string') {
        // Zig Color.rgb/rgba → Lua 0xRRGGBB hex
        _nv = _nv.replace(/Color\.rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*\d+)?\)/g, function(_, r, g, b) {
          return '0x' + ((+r << 16) | (+g << 8) | +b).toString(16).padStart(6, '0');
        });
        // OA refs: _oaN_field[_i] → _item.field
        _nv = _nv.replace(/_oa\d+_(\w+)\[_i\]\[0\.\._oa\d+_\w+_lens\[_i\]\]/g, '_item.$1');
        _nv = _nv.replace(/_oa\d+_(\w+)\[_i\]/g, '_item.$1');
      }
      fields.push(_nk + ' = ' + _nv);
    }
  }

  if (node.children && node.children.length > 0) {
    var childLua = [];
    for (var ci = 0; ci < node.children.length; ci++) {
      var child = node.children[ci];
      if (child.condition) {
        var cond = _jsExprToLua(child.condition, itemParam, indexParam, _luaIdxExpr);
        cond = _wrapCondEval(cond);
        var body = _nodeToLua(child.node, itemParam, indexParam, indent + '  ', _luaIdxExpr);
        // If body is already a conditional ending with 'or nil' (from unwrap), don't double-wrap
        if (body.lastIndexOf(' or nil') === body.length - 7) {
          childLua.push('(' + cond + ') and ' + body);
        } else {
          childLua.push('(' + cond + ') and ' + body + ' or nil');
        }
      } else if (child.ternaryCondition) {
        var tcond = _jsExprToLua(child.ternaryCondition, itemParam, indexParam, _luaIdxExpr);
        tcond = _wrapCondEval(tcond);
        var trueBranch = _nodeToLua(child.trueNode, itemParam, indexParam, indent + '  ', _luaIdxExpr);
        var falseBranch = _nodeToLua(child.falseNode, itemParam, indexParam, indent + '  ', _luaIdxExpr);
        childLua.push('(' + tcond + ') and ' + trueBranch + ' or nil');
        childLua.push('(not (' + tcond + ')) and ' + falseBranch + ' or nil');
      } else if (child.nestedMap) {
        var nm = child.nestedMap;
        var innerBody = _nodeToLua(nm.bodyNode, nm.itemParam || '_nitem', nm.indexParam, indent + '  ');
        childLua.push('__luaNestedMap(_item.' + nm.field + ', function(_nitem, _ni)\n' +
          indent + '    return ' + innerBody + '\n' +
          indent + '  end)');
      } else if (child.luaMapLoop) {
        // Inline map loop — emits as a Lua function call that returns children
        var ml = child.luaMapLoop;
        // Nested maps use _nitem/_ni to avoid shadowing outer _item/_i
        var _isNested = !!itemParam;
        var _innerFnItem = _isNested ? '_nitem' : '_item';
        var _innerFnIdx = _isNested ? '_ni' : '_i';
        var _innerIdxP = ml.indexParam || null;
        // For nested maps, pass the Lua index expression so all sub-calls
        // emit (_ni - 1) instead of (_i - 1) for the inner map's index
        var _innerLuaIdx = _isNested ? '(_ni - 1)' : null;
        var loopBody;
        if (ml.bodyLua) {
          // Pre-built Lua from token walker (nested maps)
          loopBody = ml.bodyLua;
        } else if (ml.bodyNode) {
          loopBody = _nodeToLua(ml.bodyNode, ml.itemParam, _innerIdxP, indent + '    ', _innerLuaIdx);
          // For nested maps: _nodeToLua always emits _item — replace with _nitem
          if (_isNested) {
            loopBody = loopBody.replace(/\b_item\b/g, _innerFnItem);
          }
        } else {
          loopBody = '{}';
        }
        childLua.push('__mapLoop(' + ml.dataVar + ', function(' + _innerFnItem + ', ' + _innerFnIdx + ')\n' +
          indent + '    return ' + loopBody + '\n' +
          indent + '  end)');
      } else {
        childLua.push(_nodeToLua(child, itemParam, indexParam, indent + '  ', _luaIdxExpr));
      }
    }
    // Unwrap: if node has no style/text/handler and all children are conditionals,
    // return the conditional directly instead of wrapping in { children = { cond or nil } }.
    // This prevents empty wrapper nodes from taking layout space when conditions are false.
    if (fields.length === 0 && childLua.length === 1 && childLua[0].indexOf(' or nil') >= 0) {
      return childLua[0];
    }
    // Track children block metadata for manifest
    var _cbValues = 0, _cbConds = 0;
    for (var _mi = 0; _mi < childLua.length; _mi++) {
      if (childLua[_mi].indexOf('or nil') >= 0) _cbConds++;
      else _cbValues++;
    }
    if (typeof ctx !== 'undefined') {
      if (!ctx._childrenManifest) ctx._childrenManifest = [];
      ctx._childrenManifest.push({ total: childLua.length, values: _cbValues, conditionals: _cbConds });
    }
    fields.push('children = {\n' + childLua.map(function(ch) { return indent + '  ' + ch; }).join(',\n') + '\n' + indent + '}');
  }

  // Root-level scroll containers (e.g. <ScrollView>): persist offset in global _scrollY across __render.
  // Skip inside .map() bodies (itemParam set) — each row would need a composite key (not emitted yet).
  var _ovf = node.style && node.style.overflow;
  if (typeof _ovf === 'string' && _ovf.charAt(0) === '.') _ovf = _ovf.slice(1);
  var _isScrollContainer = _ovf === 'scroll';
  if (_isScrollContainer && !itemParam && typeof ctx !== 'undefined' && ctx.nextScrollPersistSlot !== undefined) {
    ctx.nextScrollPersistSlot += 1;
    var _sid = ctx.nextScrollPersistSlot;
    fields.push('scroll_y = ((_scrollY and _scrollY[' + _sid + ']) or 0)');
    fields.push('scroll_persist_slot = ' + _sid);
  }

  return '{ ' + fields.join(', ') + ' }';
}
