// Resolve \x02OA_ITEM:oaIdx:iterVar:itemParam markers in Lua condition strings.
// These markers are inserted by component_brace_values.js when a whole map item
// is passed as a prop. In Lua conditionals, they need to become _item.field.
// E.g. "\x02OA_ITEM:3:_i:_item . model" → "_item.model"
function _resolveOaItemMarkers(expr) {
  if (!expr || expr.indexOf('\x02') === -1) return expr;
  // Pattern: \x02OA_ITEM:N:iterVar:itemParam followed by optional " . field"
  return expr.replace(/\x02OA_ITEM:\d+:[^:]+:(\w+)\s*\.\s*(\w+)/g, function(_, itemParam, field) {
    return itemParam + '.' + field;
  }).replace(/\x02OA_ITEM:\d+:[^:]+:(\w+)/g, function(_, itemParam) {
    return itemParam;
  });
}

function _cloneInlineGlyphData(glyphData) {
  if (!glyphData) return null;
  var out = {
    d: glyphData.d || '',
    fill: glyphData.fill || 'transparent',
    stroke: glyphData.stroke || 'transparent',
    stroke_width: glyphData.stroke_width || glyphData.strokeWidth || '0',
    scale: glyphData.scale || '1.0',
  };
  if (glyphData.fill_effect || glyphData.fillEffect) out.fill_effect = glyphData.fill_effect || glyphData.fillEffect;
  return out;
}

function buildNode(tag, styleFields, children, handlerRef, nodeFields, srcTag, srcOffset) {
  // Auto-overflow: DISABLED — was causing scissor clipping that hid text in nested containers.
  // Only explicit overflow in the .tsz source or ScrollView primitives should clip.
  // Full-window containers (width:100% + height:100%) still get overflow:hidden.
  const _isFullWindow = styleFields.some(f => f === '.height = -1') && styleFields.some(f => f === '.width = -1');
  if (tag === 'Box' && children.length > 0 && !styleFields.some(f => f.startsWith('.overflow')) && _isFullWindow) {
    styleFields.push('.overflow = .hidden');
  }
  const parts = [];
  var _inlineGlyphData = null;
  var _inlineGlyphText = null;
  if (styleFields.length > 0) parts.push(`.style = .{ ${styleFields.join(', ')} }`);

  // For Text nodes: if ANY child has a dynamic text, hoist it to the Text node
  // and drop all static text siblings (matches reference compiler behavior)
  if (tag === 'Text') {
    const dynChild = children.find(ch => ch.dynBufId !== undefined);
    const hasGlyphsWithDyn = dynChild && children.some(ch => ch.isGlyph);

    if (hasGlyphsWithDyn) {
      // Split: glyph children become a static text node, dynamic gets its own node.
      // Both sit side-by-side in a row container that inherits the Text styling.
      let glyphText = '';
      const glyphExprs = [];
      for (const ch of children) {
        if (ch.isGlyph) {
          glyphText += '\\x01';
          glyphExprs.push(ch.glyphExpr);
        } else if (!ch.dynBufId && ch.nodeExpr) {
          const m = ch.nodeExpr.match(/\.text = "(.*)"/);
          if (m) glyphText += m[1];
        }
      }
      // Build glyph text node
      var glyphNodeParts = [`.text = "${glyphText}"`];
      glyphNodeParts.push(`.inline_glyphs = &[_]layout.InlineGlyph{ ${glyphExprs.join(', ')} }`);
      if (nodeFields) for (const nf of nodeFields) glyphNodeParts.push(nf);
      var glyphNode = `.{ ${glyphNodeParts.join(', ')} }`;

      // Build dynamic text node
      var dynNodeParts = [dynChild.inMap ? `.text = "__mt${dynChild.dynBufId}__"` : `.text = ""`];
      if (nodeFields) for (const nf of nodeFields) dynNodeParts.push(nf);
      var dynNode = `.{ ${dynNodeParts.join(', ')} }`;

      // Row container with both siblings
      parts.push('.style = .{ .flex_direction = .row, .gap = 0 }');
      const rowExpr = `.{ ${parts.join(', ')}, .children = &[_]Node{ ${glyphNode}, ${dynNode} } }`;
      const result = { nodeExpr: rowExpr, dynBufId: dynChild.dynBufId };
      if (dynChild.inMap) result.inMap = true;
      if (nodeFields && nodeFields._dynColorId !== undefined) result.dynColorId = nodeFields._dynColorId;
      if (nodeFields && nodeFields._dynStyleIds) result.dynStyleIds = nodeFields._dynStyleIds;
      if (nodeFields && nodeFields._dynStyleId !== undefined) result.dynStyleId = nodeFields._dynStyleId;
      if (styleFields._dynStyleIds) result.dynStyleIds = [...(result.dynStyleIds || []), ...styleFields._dynStyleIds];
      if (styleFields._dynStyleId !== undefined) result.dynStyleId = result.dynStyleId || styleFields._dynStyleId;
      return result;
    }

    if (dynChild) {
      parts.push(dynChild.inMap ? `.text = "__mt${dynChild.dynBufId}__"` : `.text = ""`);
      if (nodeFields) for (const nf of nodeFields) parts.push(nf);
      children = [];
      const expr = `.{ ${parts.join(', ')} }`;
      const result = { nodeExpr: expr, dynBufId: dynChild.dynBufId };
      if (dynChild.inMap) result.inMap = true;
      if (nodeFields && nodeFields._dynColorId !== undefined) result.dynColorId = nodeFields._dynColorId;
      if (nodeFields && nodeFields._dynStyleIds) result.dynStyleIds = nodeFields._dynStyleIds;
      if (nodeFields && nodeFields._dynStyleId !== undefined) result.dynStyleId = nodeFields._dynStyleId;
      if (styleFields._dynStyleIds) result.dynStyleIds = [...(result.dynStyleIds || []), ...styleFields._dynStyleIds];
      if (styleFields._dynStyleId !== undefined) result.dynStyleId = result.dynStyleId || styleFields._dynStyleId;
      // Attach luaNode for lua tree emit
      {
        var _dln = {};
        if (styleFields.length > 0) {
          _dln.style = {};
          for (var _dsi = 0; _dsi < styleFields.length; _dsi++) {
            var _dsf = styleFields[_dsi];
            var _deq = _dsf.indexOf(' = ');
            if (_deq < 0) continue;
            _dln.style[_dsf.slice(1, _deq)] = _dsf.slice(_deq + 3).replace(/^\./, '');
          }
        }
        if (nodeFields) {
          for (var _dni = 0; _dni < nodeFields.length; _dni++) {
            var _dnf = nodeFields[_dni];
            if (typeof _dnf === 'string') {
              if (_dnf.startsWith('.font_size = ')) _dln.fontSize = _dnf.slice(13);
              if (_dnf.startsWith('.text_color = ')) {
                var _tcv = _dnf.slice(14);
                // Convert Zig expressions to Lua (state slots, OA refs, if/else, Color.rgb)
                _tcv = _tcv.replace(/state\.getSlot(?:Int|Float|Bool)?\((\d+)\)/g, function(_, idx) {
                  var _s2 = ctx.stateSlots[+idx]; return _s2 ? _s2.getter : '_slot' + idx;
                });
                _tcv = _tcv.replace(/state\.getSlotString\((\d+)\)/g, function(_, idx) {
                  var _s2 = ctx.stateSlots[+idx]; return _s2 ? _s2.getter : '_slot' + idx;
                });
                _tcv = _tcv.replace(/_oa\d+_(\w+)\[_i\]\[0\.\._oa\d+_\w+_lens\[_i\]\]/g, '_item.$1');
                _tcv = _tcv.replace(/_oa\d+_(\w+)\[_i\]/g, '_item.$1');
                _tcv = _tcv.replace(/_oa\d+_(\w+)\[_j\]\[0\.\._oa\d+_\w+_lens\[_j\]\]/g, '_nitem.$1');
                _tcv = _tcv.replace(/_oa\d+_(\w+)\[_j\]/g, '_nitem.$1');
                _tcv = _tcv.replace(/\b_j\b/g, '_ni');
                _tcv = _tcv.replace(/Color\.rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*\d+)?\)/g, function(_, r, g, b) {
                  return '0x' + ((+r << 16) | (+g << 8) | +b).toString(16).padStart(6, '0');
                });
                for (var _tci = 0; _tci < 3; _tci++) {
                  _tcv = _tcv.replace(/@as\([^,]+,\s*([^)]+)\)/g, '$1');
                  _tcv = _tcv.replace(/@intCast\(([^)]+)\)/g, '$1');
                }
                // Iterative if/else → and/or
                for (var _tcif = 0; _tcif < 10; _tcif++) {
                  var _tcifPos = _tcv.indexOf('if (');
                  if (_tcifPos < 0) break;
                  var _tcd = 0, _tcci = _tcifPos + 3;
                  for (; _tcci < _tcv.length; _tcci++) {
                    if (_tcv[_tcci] === '(') _tcd++;
                    if (_tcv[_tcci] === ')') { _tcd--; if (_tcd === 0) break; }
                  }
                  if (_tcd !== 0) break;
                  var _tcCond = _tcv.substring(_tcifPos + 4, _tcci);
                  var _tcAfter = _tcv.substring(_tcci + 1).trim();
                  var _tcElse = _tcAfter.indexOf(' else ');
                  if (_tcElse < 0) break;
                  var _tcTrue = _tcAfter.substring(0, _tcElse).trim();
                  var _tcPfx = _tcv.substring(0, _tcifPos);
                  var _tcSfx = _tcAfter.substring(_tcElse + 6).trim();
                  _tcv = _tcPfx + '(' + _tcCond + ') and ' + _tcTrue + ' or ' + _tcSfx;
                }
                // std.mem.eql → Lua string compare
                _tcv = _tcv.replace(/std\.mem\.eql\(u8,\s*([^,]+),\s*([^)]+)\)/g, '($1 == $2)');
                _dln.color = _tcv;
              }
            }
          }
        }
        // Text: use raw field, template, state getter, or ternary from brace parser
        if (dynChild._luaTextField) {
          _dln.text = { field: dynChild._luaTextField };
        } else if (dynChild._luaTemplateRaw) {
          _dln.text = dynChild._luaTemplateRaw;
        } else if (dynChild._luaStateGetter) {
          _dln.text = { stateVar: dynChild._luaStateGetter };
        } else if (dynChild._luaTernaryText) {
          _dln.text = { luaExpr: dynChild._luaTernaryText };
        } else if (dynChild.dynBufId !== undefined) {
          // Fallback: find the dynText entry and use __eval with the Zig fmtArgs
          var _dt = ctx.dynTexts.find(function(d) { return d.bufId === dynChild.dynBufId && !!d.inMap === !!dynChild.inMap; });
          if (_dt && _dt.fmtArgs) {
            // Try to convert Zig fmtArgs to a Lua/JS expression
            var _fmtExpr = _dt.fmtArgs;
            // state.getSlotInt(N) → find getter name
            _fmtExpr = _fmtExpr.replace(/state\.getSlot(?:Int|Float)?\((\d+)\)/g, function(_, idx) {
              var _s = ctx.stateSlots[+idx];
              return _s ? _s.getter : '__slot' + idx;
            });
            _fmtExpr = _fmtExpr.replace(/state\.getSlotString\((\d+)\)/g, function(_, idx) {
              var _s = ctx.stateSlots[+idx];
              return _s ? _s.getter : '__slot' + idx;
            });
            // OA string field refs: _oa0_name[_i][0.._oa0_name_lens[_i]] → _item.name
            _fmtExpr = _fmtExpr.replace(/_oa\d+_(\w+)\[_i\]\[0\.\._oa\d+_\w+_lens\[_i\]\]/g, '_item.$1');
            // OA int/float field refs: _oa0_field[_i] → _item.field
            _fmtExpr = _fmtExpr.replace(/_oa\d+_(\w+)\[_i\]/g, '_item.$1');
            // OA length refs: _oa0_len → #getter_name
            _fmtExpr = _fmtExpr.replace(/_oa(\d+)_len\b/g, function(_, oaIdx) {
              var _oa = ctx.objectArrays[+oaIdx];
              return _oa ? '#' + _oa.getter : '#_oa' + oaIdx;
            });
            // @intCast(_oa0_len) → #getter_name (Zig cast wrapping length)
            _fmtExpr = _fmtExpr.replace(/@intCast\(#(\w+)\)/g, '#$1');
            // NOTE: @as stripping moved to per-arg cleanup below (commas in @as break split)
            // If it has a format string with interpolation, build template
            if (_dt.fmtString && _dt.fmtString !== '{s}' && _dt.fmtString !== '{d}') {
              // Multi-part format: "total:{d} phase:{d}" + args
              var _parts = _dt.fmtString.split(/\{[ds](?::\.?\d+)?\}/);
              // Strip Zig runtime calls BEFORE splitting (they contain commas)
              var _cleanedArgs = _fmtExpr;
              // qjs_runtime.evalToString("String(expr)", &buf) → expr
              _cleanedArgs = _cleanedArgs.replace(/qjs_runtime\.evalToString\("String\(([^"]+)\)"[^)]*\)/g, '$1');
              _cleanedArgs = _cleanedArgs.replace(/&_eval_buf_\d+/g, '');
              for (var _cai = 0; _cai < 5; _cai++) {
                _cleanedArgs = _cleanedArgs.replace(/@as\(\[?\]?(?:const )?\w+,\s*([^)]*)\)/g, '$1');
              }
              // @divTrunc/@mod → Lua equivalents BEFORE splitting (they contain commas)
              _cleanedArgs = _cleanedArgs.replace(/@divTrunc\(([^,]+),\s*([^)]+)\)/g, 'math.floor($1 / $2)');
              _cleanedArgs = _cleanedArgs.replace(/@mod\(([^,]+),\s*([^)]+)\)/g, '($1 % $2)');
              // Zig if/else → Lua ternary BEFORE splitting (iterative for nested)
              for (var _ifJ = 0; _ifJ < 10; _ifJ++) {
                var _ifQ = _cleanedArgs.indexOf('if (');
                if (_ifQ < 0) break;
                var _d3 = 0, _c3 = _ifQ + 3;
                for (; _c3 < _cleanedArgs.length; _c3++) {
                  if (_cleanedArgs[_c3] === '(') _d3++;
                  if (_cleanedArgs[_c3] === ')') { _d3--; if (_d3 === 0) break; }
                }
                if (_d3 !== 0) break;
                var _cd3 = _cleanedArgs.substring(_ifQ + 4, _c3);
                var _af3 = _cleanedArgs.substring(_c3 + 1).trim();
                var _el3 = _af3.indexOf(' else ');
                if (_el3 < 0) break;
                var _tv3 = _af3.substring(0, _el3).trim();
                var _pf3 = _cleanedArgs.substring(0, _ifQ);
                var _sf3 = _af3.substring(_el3 + 6).trim();
                _cleanedArgs = _pf3 + '(' + _cd3 + ') and ' + _tv3 + ' or ' + _sf3;
              }
              var _args = _cleanedArgs.split(/,\s*/);
              var _luaParts = [];
              for (var _pi = 0; _pi < _parts.length; _pi++) {
                if (_parts[_pi]) _luaParts.push('"' + _parts[_pi] + '"');
                if (_pi < _args.length) {
                  var _argClean = _args[_pi].trim();
                  // Strip qjs_runtime.evalToString → bare expression
                  _argClean = _argClean.replace(/qjs_runtime\.evalToString\("String\(([^"]+)\)"[^)]*\)/g, '$1');
                  _argClean = _argClean.replace(/,\s*&_eval_buf_\d+/g, '');
                  _argClean = _argClean.replace(/&_eval_buf_\d+/g, '');
                  // Strip @as wrappers first (iterate for nesting)
                  for (var _ai = 0; _ai < 3; _ai++) {
                    _argClean = _argClean.replace(/@as\(\[?\]?(?:const )?\w+,\s*([^)]+)\)/g, '$1');
                    _argClean = _argClean.replace(/@intCast\(([^)]+)\)/g, '$1');
                    _argClean = _argClean.replace(/@floatFromInt\(([^)]+)\)/g, '$1');
                  }
                  // Now if/else → Lua (cond) and val or val (iterative for nested ternaries)
                  for (var _ifI = 0; _ifI < 10; _ifI++) {
                    var _ifP = _argClean.indexOf('if (');
                    if (_ifP < 0) break;
                    var _d2 = 0, _c2 = _ifP + 3;
                    for (; _c2 < _argClean.length; _c2++) {
                      if (_argClean[_c2] === '(') _d2++;
                      if (_argClean[_c2] === ')') { _d2--; if (_d2 === 0) break; }
                    }
                    if (_d2 !== 0) break;
                    var _cd2 = _argClean.substring(_ifP + 4, _c2);
                    var _af2 = _argClean.substring(_c2 + 1).trim();
                    var _el2 = _af2.indexOf(' else ');
                    if (_el2 < 0) break;
                    var _tv2 = _af2.substring(0, _el2).trim();
                    var _pf2 = _argClean.substring(0, _ifP);
                    var _sf2 = _af2.substring(_el2 + 6).trim();
                    _argClean = _pf2 + '(' + _cd2 + ') and ' + _tv2 + ' or ' + _sf2;
                  }
                  // Clean orphan parens
                  var _ao = (_argClean.match(/\(/g) || []).length;
                  var _ac = (_argClean.match(/\)/g) || []).length;
                  while (_ac > _ao && _argClean.endsWith(')')) { _argClean = _argClean.slice(0, -1); _ac--; }
                  _luaParts.push('tostring(' + _argClean + ')');
                }
              }
              _dln.text = { luaExpr: _luaParts.join(' .. ') };
            } else {
              // Single-arg: strip Zig runtime calls and casts
              var _singleClean = _fmtExpr;
              // Preserve JS-backed values as __eval(...) so Lua doesn't try to
              // call render-local helpers directly.
              _singleClean = _singleClean.replace(/qjs_runtime\.evalToString\("String\(([^"]+)\)"[^)]*\)/g, '__eval("$1")');
              _singleClean = _singleClean.replace(/qjs_runtime\.evalToString\("([^"]+)"[^)]*\)/g, '__eval("$1")');
              // &_eval_buf_N leftover
              _singleClean = _singleClean.replace(/,\s*&_eval_buf_\d+/g, '');
              _singleClean = _singleClean.replace(/&_eval_buf_\d+/g, '');
              for (var _sci = 0; _sci < 3; _sci++) {
                // @as(TYPE, VALUE) → VALUE — balanced paren strip
                var _asPos = _singleClean.indexOf('@as(');
                while (_asPos >= 0) {
                  var _ad = 1, _ai = _asPos + 4, _commaPos = -1;
                  while (_ai < _singleClean.length && _ad > 0) {
                    if (_singleClean[_ai] === '(') _ad++;
                    if (_singleClean[_ai] === ')') { _ad--; if (_ad === 0) break; }
                    if (_ad === 1 && _commaPos < 0 && _singleClean[_ai] === ',') _commaPos = _ai;
                    _ai++;
                  }
                  if (_ad === 0 && _commaPos >= 0) {
                    var _asVal = _singleClean.substring(_commaPos + 1, _ai).trim();
                    _singleClean = _singleClean.substring(0, _asPos) + _asVal + _singleClean.substring(_ai + 1);
                    _asPos = _singleClean.indexOf('@as(');
                  } else break;
                }
                _singleClean = _singleClean.replace(/@intCast\(([^)]+)\)/g, '$1');
                _singleClean = _singleClean.replace(/@floatFromInt\(([^)]+)\)/g, '$1');
              }
              var _sco = (_singleClean.match(/\(/g) || []).length;
              var _scc = (_singleClean.match(/\)/g) || []).length;
              while (_scc > _sco && _singleClean.endsWith(')')) { _singleClean = _singleClean.slice(0, -1); _scc--; }
              _dln.text = { stateVar: _singleClean };
            }
          }
        }
        // DynColor overlay for early-return Text path
        if (result.dynColorId !== undefined && ctx.dynColors) {
          var _edc = ctx.dynColors[result.dynColorId];
          var _edcExpr = _edc && (_edc.expression || _edc.colorExpr);
          if (_edcExpr) _dln.color = _edcExpr;
        }
        result.luaNode = _dln;
      }
      return result;
    }
    // Single static text child — hoist to .text field
    var _hoistedStaticText = null;
    if (children.length === 1 && !children[0].isGlyph && children[0].nodeExpr && children[0].nodeExpr.includes('.text =')) {
      const m = children[0].nodeExpr.match(/\.text = "(.*)"/);
      if (m) {
        parts.push(`.text = "${m[1]}"`);
        _hoistedStaticText = m[1];
        children = [];
      }
    }
    // Inline glyphs: Text with mixed text + <Glyph> children
    const hasGlyphs = children.some(ch => ch.isGlyph);
    if (hasGlyphs && children.length > 0) {
      // Build combined text with \x01 sentinels at glyph positions
      let combinedText = '';
      const glyphExprs = [];
      const glyphData = [];
      for (const ch of children) {
        if (ch.isGlyph) {
          combinedText += '\\x01';
          glyphExprs.push(ch.glyphExpr);
          if (ch.glyphData) glyphData.push(_cloneInlineGlyphData(ch.glyphData));
        } else if (ch.nodeExpr) {
          const m = ch.nodeExpr.match(/\.text = "(.*)"/);
          if (m) combinedText += m[1];
        }
      }
      parts.push(`.text = "${combinedText}"`);
      parts.push(`.inline_glyphs = &[_]layout.InlineGlyph{ ${glyphExprs.join(', ')} }`);
      _inlineGlyphText = combinedText;
      if (glyphData.length > 0) _inlineGlyphData = glyphData;
      children = [];
    }
  }

  // Node-level fields (font_size, text_color, canvas_node, scene3d, etc.)
  if (nodeFields && nodeFields.length > 0) {
    for (const nf of nodeFields) parts.push(nf);
  }

  if (handlerRef) {
    const handler = ctx.handlers.find(h => h.name === handlerRef);
    if (handler && handler.luaBody) {
      // Route decision: js_on_press vs lua_on_press
      // If the app has JS script functions (scriptBlock or scriptContent),
      // ALL handlers use js_on_press to keep JS variables in sync.
      // Otherwise, detect if handler calls non-setter functions → js_on_press.
      // Default: lua_on_press (state setters exist in both runtimes).
      var _useJs = !!(ctx.scriptBlock || globalThis.__scriptContent);
      if (!_useJs) {
        var _luaBodyCalls = handler.luaBody.match(/\b([a-zA-Z_]\w*)\s*\(/g) || [];
        for (var _ci = 0; _ci < _luaBodyCalls.length; _ci++) {
          var _fname = _luaBodyCalls[_ci].replace(/\s*\($/, '');
          var _isLuaAvail = false;
          if (ctx.stateSlots) {
            for (var _si = 0; _si < ctx.stateSlots.length; _si++) {
              if (ctx.stateSlots[_si].setter === _fname) { _isLuaAvail = true; break; }
            }
          }
          if (!_isLuaAvail && ctx.objectArrays) {
            for (var _oi = 0; _oi < ctx.objectArrays.length; _oi++) {
              if (ctx.objectArrays[_oi].setter === _fname) { _isLuaAvail = true; break; }
            }
          }
          if (!_isLuaAvail && /^(print|tostring|tonumber|pcall|setVariant)$/.test(_fname)) _isLuaAvail = true;
          if (!_isLuaAvail) { _useJs = true; break; }
        }
      }
      if (_useJs && handler.jsBody) {
        const jsEscaped = handler.jsBody.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
        parts.push(`.handlers = .{ .js_on_press = "${jsEscaped}" }`);
      } else {
        const escaped = luaTransform(handler.luaBody).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
        parts.push(`.handlers = .{ .lua_on_press = "${escaped}" }`);
      }
    } else {
      parts.push(`.handlers = .{ .on_press = handlers.${handlerRef} }`);
    }
  }

  if (children.length > 0) {
    const arrName = `_arr_${ctx.arrayCounter}`;
    ctx.arrayCounter++;
    // Transfer parent layout style fields to map placeholder children
    const layoutFields = styleFields.filter(f =>
      f.startsWith('.gap') || f.startsWith('.flex_direction') || f.startsWith('.flex_wrap') ||
      f.startsWith('.align_items') || f.startsWith('.justify_content'));
    for (let ci = 0; ci < children.length; ci++) {
      if (children[ci].mapIdx !== undefined && layoutFields.length > 0 && children[ci].nodeExpr === '.{}') {
        children[ci].nodeExpr = `.{ .style = .{ ${layoutFields.join(', ')} } }`;
      }
    }
    // Expand subChildren: conditional wrappers that contain spliced children
    for (let sci = 0; sci < children.length; sci++) {
      if (children[sci].subChildren && children[sci].subChildren.length > 0) {
        const subArrName = `_arr_${ctx.arrayCounter}`;
        ctx.arrayCounter++;
        const subExprs = children[sci].subChildren.map(sch => sch.nodeExpr || sch).join(', ');
        ctx.arrayComments.push('');
        ctx.arrayDecls.push(`var ${subArrName} = [_]Node{ ${subExprs} };`);
        // Bind sub-children dynTexts, maps, conditionals to the sub-array
        for (let sj = 0; sj < children[sci].subChildren.length; sj++) {
          const sch = children[sci].subChildren[sj];
          if (sch.dynBufId !== undefined) {
            const dt = ctx.dynTexts.find(d => d.bufId === sch.dynBufId && !!d.inMap === !!sch.inMap);
            if (dt && !dt.arrName) { dt.arrName = subArrName; dt.arrIndex = sj; }
          }
          if (sch.mapIdx !== undefined) {
            const m = ctx.maps[sch.mapIdx];
            if (m) { m.parentArr = subArrName; m.childIdx = sj; }
          }
          if (sch.condIdx !== undefined) {
            const cond = ctx.conditionals[sch.condIdx];
            if (cond) { cond.arrName = subArrName; cond.trueIdx = sj; }
          }
        }
        // Update the wrapper node to include .children
        const wrapperParts = children[sci].nodeExpr.replace(/ \}$/, `, .children = &${subArrName} }`);
        children[sci] = { nodeExpr: wrapperParts, condIdx: children[sci].condIdx, dynBufId: children[sci].dynBufId };
      }
    }
    const childExprs = children.map(ch => ch.nodeExpr || ch).join(', ');
    // Source breadcrumb comment
    if (srcTag && srcOffset !== undefined) {
      const line = offsetToLine(globalThis.__source, srcOffset);
      const fname = (globalThis.__file || '').split('/').pop();
      const tagDisplay = srcTag === '>' ? '<>' : `<${srcTag}>`;
      ctx.arrayComments.push(`// tsz:${fname}:${line} — ${tagDisplay}`);
    } else {
      ctx.arrayComments.push('');
    }
    // Component name comment — on ALL arrays created during inlining
    let compSuffix = '';
    if (ctx.inlineComponent) {
      compSuffix = ` // ${ctx.inlineComponent}`;
    }
    ctx.arrayDecls.push(`var ${arrName} = [_]Node{ ${childExprs} };${compSuffix}`);
    // Bind dynamic texts and conditionals to this array
    for (let i = 0; i < children.length; i++) {
      if (children[i].dynBufId !== undefined) {
        const dt = ctx.dynTexts.find(d => d.bufId === children[i].dynBufId && !!d.inMap === !!children[i].inMap);
        if (dt && !dt.arrName) {
          dt.arrName = arrName;
          dt.arrIndex = i;
        }
      }
      if (children[i].mapIdx !== undefined) {
        const m = ctx.maps[children[i].mapIdx];
        if (m) {
          m.parentArr = arrName;
          m.childIdx = i;
        }
      }
      if (children[i].condIdx !== undefined) {
        const cond = ctx.conditionals[children[i].condIdx];
        if (cond) {
          cond.arrName = arrName;
          cond.trueIdx = i;
        }
      }
      if (children[i].dynColorId !== undefined) {
        const dc = ctx.dynColors[children[i].dynColorId];
        if (dc && !dc.arrName) {
          dc.arrName = arrName;
          dc.arrIndex = i;
        }
      }
      if (children[i].dynStyleId !== undefined) {
        const ds = ctx.dynStyles[children[i].dynStyleId];
        if (ds && !ds.arrName) {
          ds.arrName = arrName;
          ds.arrIndex = i;
        }
      }
      if (children[i].dynStyleIds) {
        for (const dsId of children[i].dynStyleIds) {
          const ds = ctx.dynStyles[dsId];
          if (ds && !ds.arrName) {
            ds.arrName = arrName;
            ds.arrIndex = i;
          }
        }
      }
      if (children[i].ternaryCondIdx !== undefined) {
        const tc = ctx.conditionals[children[i].ternaryCondIdx];
        if (tc) {
          tc.arrName = arrName;
          if (children[i].ternaryBranch === 'true') tc.trueIdx = i;
          else tc.falseIdx = i;
        }
      }
      if (children[i].variantBindingId !== undefined) {
        const vb = ctx.variantBindings[children[i].variantBindingId];
        if (vb && !vb.arrName) {
          vb.arrName = arrName;
          vb.arrIndex = i;
        }
      }
    }
    parts.push(`.children = &${arrName}`);
  }

  const nodeResult = { nodeExpr: `.{ ${parts.join(', ')} }` };
  if (nodeFields && nodeFields._dynColorId !== undefined) nodeResult.dynColorId = nodeFields._dynColorId;
  if (styleFields._dynStyleId !== undefined) nodeResult.dynStyleId = styleFields._dynStyleId;
  // Merge dynStyleIds from both style block and node field ternaries
  const allDynIds = [...(styleFields._dynStyleIds || []), ...((nodeFields && nodeFields._dynStyleIds) || [])];
  if (allDynIds.length > 0) nodeResult.dynStyleIds = allDynIds;
  if (styleFields._variantBindingId !== undefined) nodeResult.variantBindingId = styleFields._variantBindingId;

  // ── Lua node: structured data for lua tree emit ────────────────────
  // Attach luaNode to every node so the lua-tree emitter can walk the
  // parsed tree and produce Lua tables. Used by both map emit and
  // full lua-tree mode.
  {
    var _ln = {};
    // Helper: clean Zig expressions to Lua-friendly form
    var _cleanZigExpr = function(expr) {
      // JS logical operators → Lua
      expr = expr.replace(/&&/g, ' and ').replace(/\|\|/g, ' or ');
      expr = expr.replace(/===/g, '==').replace(/!==/g, '~=');
      expr = expr.replace(/state\.getSlot(?:Int|Float|Bool)?\((\d+)\)/g, function(_, idx) {
        var _s = ctx.stateSlots[+idx]; return _s ? _s.getter : '_slot' + idx;
      });
      expr = expr.replace(/state\.getSlotString\((\d+)\)/g, function(_, idx) {
        var _s = ctx.stateSlots[+idx]; return _s ? _s.getter : '_slot' + idx;
      });
      for (var _zi = 0; _zi < 3; _zi++) {
        expr = expr.replace(/@floatFromInt\(([^)]+)\)/g, '$1');
        expr = expr.replace(/@intFromFloat\(([^)]+)\)/g, '$1');
        expr = expr.replace(/@intCast\(([^)]+)\)/g, '$1');
        expr = expr.replace(/@as\(\w+,\s*([^)]+)\)/g, '$1');
      }
      // Color.rgb → 0xRRGGBB
      expr = expr.replace(/Color\.rgb\((\d+),\s*(\d+),\s*(\d+)\)/g, function(_, r, g, b) {
        return '0x' + ((+r << 16) | (+g << 8) | +b).toString(16).padStart(6, '0');
      });
      // OA refs → _item.field
      expr = expr.replace(/_oa\d+_(\w+)\[_i\]\[0\.\._oa\d+_\w+_lens\[_i\]\]/g, '_item.$1');
      expr = expr.replace(/_oa\d+_(\w+)\[_i\]/g, '_item.$1');
      // std.mem.eql → Lua string compare
      expr = expr.replace(/!std\.mem\.eql\(u8,\s*([^,]+),\s*([^)]+)\)/g, '($1 ~= $2)');
      expr = expr.replace(/std\.mem\.eql\(u8,\s*([^,]+),\s*([^)]+)\)/g, '($1 == $2)');
      // Clean orphan parens
      var _openCount = (expr.match(/\(/g) || []).length;
      var _closeCount = (expr.match(/\)/g) || []).length;
      while (_closeCount > _openCount && expr.endsWith(')')) { expr = expr.slice(0, -1); _closeCount--; }
      // Iterative if/else → and/or (handles chained ternaries)
      for (var _ifIter = 0; _ifIter < 10; _ifIter++) {
        var _ifPos = expr.indexOf('if (');
        if (_ifPos < 0) break;
        var _depth = 0, _ci = _ifPos + 3;
        for (; _ci < expr.length; _ci++) {
          if (expr[_ci] === '(') _depth++;
          if (expr[_ci] === ')') { _depth--; if (_depth === 0) break; }
        }
        if (_depth !== 0) break;
        var _cond = expr.substring(_ifPos + 4, _ci);
        var _after = expr.substring(_ci + 1).trim();
        var _elseIdx = _after.indexOf(' else ');
        if (_elseIdx < 0) break;
        var _trueVal = _after.substring(0, _elseIdx).trim();
        var _prefix = expr.substring(0, _ifPos);
        var _suffix = _after.substring(_elseIdx + 6).trim();
        expr = _prefix + '(' + _cond + ') and ' + _trueVal + ' or ' + _suffix;
      }
      // qjs_runtime.evalToString → bare expression
      expr = expr.replace(/qjs_runtime\.evalToString\("String\(([^"]+)\)"[^)]*\)/g, '$1');
      expr = expr.replace(/&_eval_buf_\d+/g, '');
      return expr;
    };
    // Style: parse Zig style fields back to key/value pairs
    if (styleFields.length > 0) {
      _ln.style = {};
      for (var _si = 0; _si < styleFields.length; _si++) {
        var _sf = styleFields[_si];
        // ".key = value" → key, value
        var _eqIdx = _sf.indexOf(' = ');
        if (_eqIdx < 0) continue;
        var _sk = _sf.slice(1, _eqIdx); // strip leading .
        var _sv = _sf.slice(_eqIdx + 3);
        // Color.rgb(r,g,b) → keep as-is for lua_map_style to handle
        // std.math.inf(f32) → "auto" for Lua margin auto support
        if (_sv === 'std.math.inf(f32)') _sv = 'auto';
        // .enum_value → strip leading dot
        if (_sv.charAt(0) === '.') _sv = _sv.slice(1);
        // Resolve state.getSlot references to getter names
        if (_sv.indexOf('state.getSlot') >= 0) {
          _sv = _sv.replace(/state\.getSlot(?:Int|Float|Bool)?\((\d+)\)/g, function(_, idx) {
            var _s = ctx.stateSlots[+idx];
            return _s ? _s.getter : '_slot' + idx;
          });
          _sv = _sv.replace(/state\.getSlotString\((\d+)\)/g, function(_, idx) {
            var _s = ctx.stateSlots[+idx];
            return _s ? _s.getter : '_slot' + idx;
          });
        }
        _ln.style[_sk] = _sv;
      }
    }
    // Variant styles: attach alternative style sets for variant switching in Lua
    if (styleFields._variantBindingId !== undefined && ctx.variantBindings) {
      var _vb = ctx.variantBindings[styleFields._variantBindingId];
      if (_vb && _vb.styles && _vb.styles.length > 1) {
        _ln._variantStyles = [];
        for (var _vi = 0; _vi < _vb.styles.length; _vi++) {
          var _vs = {};
          var _vParts = _vb.styles[_vi].split(', .');
          for (var _vpi = 0; _vpi < _vParts.length; _vpi++) {
            var _vf = _vParts[_vpi];
            if (_vf.charAt(0) === '.') _vf = _vf.slice(1);
            var _veq = _vf.indexOf(' = ');
            if (_veq < 0) continue;
            var _vk = _vf.slice(0, _veq);
            var _vv = _vf.slice(_veq + 3);
            if (_vv.charAt(0) === '.') _vv = _vv.slice(1);
            _vs[_vk] = _vv;
          }
          _ln._variantStyles.push(_vs);
        }
      }
    }
    // Overlay dynStyle expressions — these replace placeholder values (0, Color{})
    // Must run OUTSIDE the styleFields block — text_color ternaries have no style fields
    if (!_ln.style) _ln.style = {};
    if (nodeResult.dynStyleId !== undefined && ctx.dynStyles) {
      var _ds = ctx.dynStyles[nodeResult.dynStyleId];
      if (_ds && _ds.expression) {
        _ln.style[_ds.field] = _cleanZigExpr(_ds.expression);
      }
    }
    if (nodeResult.dynStyleIds) {
      for (var _dsi = 0; _dsi < nodeResult.dynStyleIds.length; _dsi++) {
        var _ds2 = ctx.dynStyles[nodeResult.dynStyleIds[_dsi]];
        if (_ds2 && _ds2.expression) {
          _ln.style[_ds2.field] = _cleanZigExpr(_ds2.expression);
        }
      }
    }
    // Direct dynStyle color fallback: if dynStyleIds exist but style.text_color wasn't set
    // (can happen when nodeResult.dynStyleIds propagation missed), apply directly
    if (nodeFields && nodeFields._dynStyleIds && ctx.dynStyles) {
      for (var _fbi = 0; _fbi < nodeFields._dynStyleIds.length; _fbi++) {
        var _fds = ctx.dynStyles[nodeFields._dynStyleIds[_fbi]];
        if (_fds && _fds.field === 'text_color' && _fds.expression && !(_ln.style && _ln.style.text_color)) {
          _ln.color = _cleanZigExpr(_fds.expression);
        }
      }
    }
    // Text + nodeFields
    if (nodeFields) {
      for (var _ni = 0; _ni < nodeFields.length; _ni++) {
        var _nf = nodeFields[_ni];
        if (typeof _nf === 'string') {
          if (_nf.startsWith('.font_size = ')) _ln.fontSize = _nf.slice(13);
          if (_nf.startsWith('.text_color = ') && !(_ln.style && _ln.style.text_color)) _ln.color = _cleanZigExpr(_nf.slice(14));
          if (_nf.startsWith('.text = ')) {
            var _textVal = _nf.slice(8);
            var _isQuotedStr = _textVal.charAt(0) === '"' && _textVal.charAt(_textVal.length - 1) === '"';
            if (_isQuotedStr) {
              _ln.text = _textVal.slice(1, -1);
            } else {
              // Dynamic text binding (e.g., state getter) — resolve to getter name and mark as variable
              _textVal = _textVal.replace(/state\.getSlot(?:Int|Float|Bool)?\((\d+)\)/g, function(_, idx) {
                return (ctx.stateSlots && ctx.stateSlots[+idx]) ? ctx.stateSlots[+idx].getter : '_slot' + idx;
              });
              _textVal = _textVal.replace(/state\.getSlotString\((\d+)\)/g, function(_, idx) {
                return (ctx.stateSlots && ctx.stateSlots[+idx]) ? ctx.stateSlots[+idx].getter : '_slot' + idx;
              });
              _ln.text = { stateVar: _textVal };
            }
          }
          // TextInput: input_id → mark as text_input in luaNode
          if (_nf.startsWith('.input_id = ')) {
            _ln.text_input = true;
            _ln.input_id = parseInt(_nf.slice(12));
          }
          // TextInput: multiline flag
          if (_nf === '.multiline = true') {
            _ln.multiline = true;
          }
          // Terminal: terminal_id → mark as terminal in luaNode
          if (_nf.startsWith('.terminal_id = ')) {
            _ln.terminal = true;
            _ln.terminal_id = parseInt(_nf.slice(15));
          }
          // Canvas/Graph/3D/Physics node fields → forward to luaNode
          var _nfEq = _nf.indexOf(' = ');
          if (_nfEq > 1) {
            var _nfKey = _nf.slice(1, _nfEq);
            if (_nfKey.indexOf('canvas_') === 0 || _nfKey.indexOf('scene3d_') === 0 || _nfKey.indexOf('physics_') === 0 || _nfKey === 'graph_container' || _nfKey === 'bold' || _nfKey === 'window_drag' || _nfKey === 'window_resize') {
              if (!_ln._nodeFields) _ln._nodeFields = {};
              _ln._nodeFields[_nfKey] = _nf.slice(_nfEq + 3);
            }
          }
        }
      }
    }
    // DynColor overlay — resolve Color{} placeholders to actual expressions
    if (nodeResult.dynColorId !== undefined && ctx.dynColors) {
      var _dc = ctx.dynColors[nodeResult.dynColorId];
      var _dcExpr = _dc && (_dc.expression || _dc.colorExpr);
      if (_dcExpr) {
        _ln.color = _cleanZigExpr(_dcExpr);
      }
    }
    // Promote dynStyle text_color to node.color (text_color is a node field, not style)
    if (_ln.style && _ln.style.text_color && (!_ln.color || _ln.color === 'Color{}' || _ln.color === '0x000000' || _ln.color === 0 || _ln.color === 'Color.rgb(0, 0, 0)' || (typeof _ln.color === 'string' && _ln.color.indexOf('Color') >= 0 && _ln.color.indexOf('and') < 0))) {
      _ln.color = _ln.style.text_color;
      delete _ln.style.text_color;
    }
    // Static text hoisted from single child
    if (_hoistedStaticText !== null && _hoistedStaticText !== undefined) {
      _ln.text = _hoistedStaticText;
    }
    if (_inlineGlyphData && _inlineGlyphData.length > 0) {
      if (_inlineGlyphText !== null && _inlineGlyphText !== undefined) {
        _ln.text = _inlineGlyphText;
      }
      _ln.inline_glyphs = _inlineGlyphData;
    }
    // Handler — route to Lua or JS
    // Prefer lua_on_press (works with Lua loop vars like _item, _i).
    // Only use js_on_press when the handler calls script functions that
    // don't exist in Lua.
    if (handlerRef) {
      var _handler = ctx.handlers.find(function(h) { return h.name === handlerRef; });
      if (_handler) {
        var _hasScriptBlock = !!(ctx.scriptBlock || globalThis.__scriptContent);
        var _hasScriptFuncs = ctx.scriptFuncs && ctx.scriptFuncs.length > 0;
        var _needsJs = false;
        // PROBE: route to JS for handlers calling script functions in JS-mode scripts
        if (!_hasScriptBlock && !_hasScriptFuncs && _handler.luaBody) {
          // Neither scriptBlock nor scriptFuncs detected — check handler body for known JS-only patterns
          var _hCalls2 = _handler.luaBody.match(/\b([a-zA-Z_]\w*)\s*\(/g) || [];
          for (var _hc2 = 0; _hc2 < _hCalls2.length; _hc2++) {
            var _hfn2 = _hCalls2[_hc2].replace(/\s*\($/, '');
            var _isSetterOrOa = false;
            if (ctx.stateSlots) { for (var _s2 = 0; _s2 < ctx.stateSlots.length; _s2++) { if (ctx.stateSlots[_s2].setter === _hfn2) { _isSetterOrOa = true; break; } } }
            if (!_isSetterOrOa && ctx.objectArrays) { for (var _o2 = 0; _o2 < ctx.objectArrays.length; _o2++) { if (ctx.objectArrays[_o2].setter === _hfn2) { _isSetterOrOa = true; break; } } }
            // Handler refs (_handler_press_N) are JS-dispatched handlers
            if (!_isSetterOrOa && /^_handler_press_\d+$/.test(_hfn2)) { _needsJs = true; break; }
            if (!_isSetterOrOa) { _needsJs = true; break; }
          }
        }
        if ((_hasScriptBlock || _hasScriptFuncs) && _handler.luaBody) {
          // Check if handler calls any non-setter functions
          var _hCalls = _handler.luaBody.match(/\b([a-zA-Z_]\w*)\s*\(/g) || [];
          for (var _hci = 0; _hci < _hCalls.length; _hci++) {
            var _hfn = _hCalls[_hci].replace(/\s*\($/, '');
            var _isLua = false;
            if (ctx.stateSlots) { for (var _hsi = 0; _hsi < ctx.stateSlots.length; _hsi++) { if (ctx.stateSlots[_hsi].setter === _hfn) { _isLua = true; break; } } }
            if (!_isLua && ctx.objectArrays) { for (var _hoi = 0; _hoi < ctx.objectArrays.length; _hoi++) { if (ctx.objectArrays[_hoi].setter === _hfn) { _isLua = true; break; } } }
            // Script block routed to Lua (FFI decls present) — all script funcs are Lua-safe
            if (!_isLua && ctx._scriptBlockIsLua && isScriptFunc(_hfn)) { _isLua = true; }
            // FFI-declared functions live in Lua (LuaJIT FFI wrappers)
            if (!_isLua && ctx._ffiDecls) { for (var _fdi = 0; _fdi < ctx._ffiDecls.length; _fdi++) { if (ctx._ffiDecls[_fdi].name === _hfn) { _isLua = true; break; } } }
            // Handler refs (_handler_press_N) are JS-dispatched — never Lua
            if (!_isLua && /^_handler_press_\d+$/.test(_hfn)) { _needsJs = true; break; }
            // Script function NOT routed to Lua → must go through JS
            if (!_isLua && !ctx._scriptBlockIsLua && isScriptFunc(_hfn)) { _needsJs = true; break; }
            if (!_isLua) { _needsJs = true; break; }
          }
        }
        if (_needsJs && _handler.jsBody) {
          var _jsBody = _handler.jsBody;
          // Resolve prop references while propStack is still populated (parse time).
          // Index props (e.g. idx={i} from a map) need to be embedded as
          // @as(i64, @intCast(_i)) so _nodeToLua can splice them into the string.
          if (ctx.propStack) {
            for (var _pbk in ctx.propStack) {
              var _pbv = ctx.propStack[_pbk];
              if (typeof _pbv === 'string' && new RegExp('\\b' + _pbk + '\\b').test(_jsBody)) {
                // OA item ref marker → resolve to item param name for handler body
                if (_pbv.charCodeAt(0) === 2) {
                  var _pbParts = _pbv.substring(9).split(':');
                  _pbv = _pbParts[2] || '_item'; // item param name
                }
                _jsBody = _jsBody.replace(new RegExp('\\b' + _pbk + '\\b', 'g'), _pbv);
              }
            }
          }
          // Strip orphaned 'props .' prefix before resolved handler refs
          _jsBody = _jsBody.replace(/\bprops\s*\.\s*(_handler_press_\d+)/g, '$1');
          // Inline _handler_press_N(args) calls with the referenced handler's body
          _jsBody = _jsBody.replace(/_handler_press_(\d+)\s*\(\s*([^)]*?)\s*\)/g, function(_m, _hIdx, _hArgs) {
            var _rh = ctx.handlers.find(function(h) { return h.name === '_handler_press_' + _hIdx; });
            if (_rh && _rh.jsBody) {
              var _ib = _rh.jsBody;
              if (_rh.closureParams && _rh.closureParams.length > 0) {
                var _ca = _hArgs.split(/\s*,\s*/);
                for (var _ci = 0; _ci < _rh.closureParams.length && _ci < _ca.length; _ci++) {
                  _ib = _ib.replace(new RegExp('\\b' + _rh.closureParams[_ci] + '\\b', 'g'), _ca[_ci].trim());
                }
              }
              return _ib;
            }
            return _m;
          });
          // TextInput onChange: bind closure params to getInputText
          if (_ln.text_input && _handler.closureParams && _handler.closureParams.length > 0) {
            _jsBody = 'var ' + _handler.closureParams[0] + ' = getInputText(' + (_ln.input_id || 0) + '); ' + _jsBody;
          }
          _ln.handler = _jsBody;
          _ln.handlerIsJs = true;
        } else if (_handler.luaBody) {
          var _luaH = (typeof luaTransform === 'function') ? luaTransform(_handler.luaBody) : _handler.luaBody;
          // Resolve props in Lua handler body
          if (ctx.propStack) {
            for (var _lpk in ctx.propStack) {
              var _lpv = ctx.propStack[_lpk];
              if (typeof _lpv === 'string' && new RegExp('\\b' + _lpk + '\\b').test(_luaH)) {
                if (_lpv.charCodeAt(0) === 2) { var _lpp = _lpv.substring(9).split(':'); _lpv = _lpp[2] || '_item'; }
                _luaH = _luaH.replace(new RegExp('\\b' + _lpk + '\\b', 'g'), _lpv);
              }
            }
          }
          // If resolved handler calls a JS handler ref, switch to js_on_press
          if (/_handler_press_\d+/.test(_luaH) && _handler.jsBody) {
            var _jsH2 = _handler.jsBody;
            if (ctx.propStack) {
              for (var _jpk in ctx.propStack) {
                var _jpv = ctx.propStack[_jpk];
                if (typeof _jpv === 'string' && new RegExp('\\b' + _jpk + '\\b').test(_jsH2)) {
                  if (_jpv.charCodeAt(0) === 2) { var _jpp = _jpv.substring(9).split(':'); _jpv = _jpp[2] || '_item'; }
                  _jsH2 = _jsH2.replace(new RegExp('\\b' + _jpk + '\\b', 'g'), _jpv);
                }
              }
            }
            // Strip orphaned 'props .' prefix before resolved handler refs
            _jsH2 = _jsH2.replace(/\bprops\s*\.\s*(_handler_press_\d+)/g, '$1');
            // Inline _handler_press_N(args) calls with the referenced handler's body
            _jsH2 = _jsH2.replace(/_handler_press_(\d+)\s*\(\s*([^)]*?)\s*\)/g, function(_m, _hIdx, _hArgs) {
              var _rh = ctx.handlers.find(function(h) { return h.name === '_handler_press_' + _hIdx; });
              if (_rh && _rh.jsBody) {
                var _ib = _rh.jsBody;
                if (_rh.closureParams && _rh.closureParams.length > 0) {
                  var _ca = _hArgs.split(/\s*,\s*/);
                  for (var _ci = 0; _ci < _rh.closureParams.length && _ci < _ca.length; _ci++) {
                    _ib = _ib.replace(new RegExp('\\b' + _rh.closureParams[_ci] + '\\b', 'g'), _ca[_ci].trim());
                  }
                }
                return _ib;
              }
              return _m;
            });
            // TextInput onChange: bind closure params to getInputText
            if (_ln.text_input && _handler.closureParams && _handler.closureParams.length > 0) {
              _jsH2 = 'var ' + _handler.closureParams[0] + ' = getInputText(' + (_ln.input_id || 0) + '); ' + _jsH2;
            }
            _ln.handler = _jsH2;
            _ln.handlerIsJs = true;
          } else {
            _ln.handler = _luaH;
          }
        }
      }
    }
    // Children: collect luaNodes from child results
    if (children.length > 0) {
      _ln.children = [];
      for (var _ci = 0; _ci < children.length; _ci++) {
        var _ch = children[_ci];
        if (!_ch.luaNode) { globalThis.__dbg = globalThis.__dbg || []; globalThis.__dbg.push('[LUA_NODE_MISS] tag=' + tag + ' child=' + _ci + ' keys=' + Object.keys(_ch).join(',') + ' nodeExpr=' + (_ch.nodeExpr || '').substring(0, 60)); }
        if (_ch.luaNode) {
          // Conditionals
          if (_ch.condIdx !== undefined && ctx.conditionals[_ch.condIdx]) {
            var _cond = ctx.conditionals[_ch.condIdx];
            _ln.children.push({ condition: _resolveOaItemMarkers(_cond.luaCondExpr || _cond.condExpr), node: _ch.luaNode });
          } else if (_ch.ternaryCondIdx !== undefined && ctx.conditionals[_ch.ternaryCondIdx]) {
            var _tc = ctx.conditionals[_ch.ternaryCondIdx];
            var _tcLua = _resolveOaItemMarkers(_tc.luaCondExpr || _tc.condExpr);
            if (_ch.ternaryBranch === 'true') {
              _ln.children.push({ ternaryCondition: _tcLua, trueNode: _ch.luaNode, falseNode: null });
            } else if (_ch.ternaryBranch === 'false') {
              // Find the matching true entry and attach false branch
              for (var _tci = _ln.children.length - 1; _tci >= 0; _tci--) {
                if (_ln.children[_tci].ternaryCondition === _tcLua && !_ln.children[_tci].falseNode) {
                  _ln.children[_tci].falseNode = _ch.luaNode;
                  break;
                }
              }
            }
          } else {
            _ln.children.push(_ch.luaNode);
          }
        } else if (_ch.mapIdx !== undefined) {
          // Nested map (from Zig parse path)
          var _m = ctx.maps[_ch.mapIdx];
          if (_m) {
            _ln.children.push({ nestedMap: { field: _m.oa ? _m.oa.getter : '', itemParam: _m.itemParam, indexParam: _m.indexParam, bodyNode: _m._luaBodyNode || null } });
          }
        } else if (_ch._luaMapWrapper !== undefined) {
          // Lua map wrapper — inline the map as a loop in the tree
          var _lmr = ctx._luaMapRebuilders && ctx._luaMapRebuilders[_ch._luaMapWrapper];
          if (_lmr) {
            _ln.children.push({
              luaMapLoop: {
                dataVar: _lmr.dataVar || _lmr.rawSource || _lmr.varName,
                itemParam: _lmr.itemParam || '_item',
                indexParam: _lmr.indexParam || null,
                filterConditions: _lmr.filterConditions || null,
                bodyNode: _lmr.bodyNode || null,
                bodyLua: _lmr.bodyLua || null
              }
            });
          }
        }
      }
    }
    nodeResult.luaNode = _ln;
  }

  return nodeResult;
}
