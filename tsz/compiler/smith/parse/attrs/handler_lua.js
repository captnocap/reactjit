// ── Lua handler parser (from attrs.js) ──

function luaParseHandler(c) {
  // Skip (params) => — capture parameter names for JS wrapper emission
  var _closureParams = [];
  if (c.kind() === TK.lparen) {
    c.advance();
    while (c.kind() !== TK.rparen && c.kind() !== TK.eof) {
      if (c.kind() === TK.identifier) _closureParams.push(c.text());
      c.advance();
    }
    if (c.kind() === TK.rparen) c.advance();
  }
  if (c.kind() === TK.arrow) c.advance();
  // Store params on context for the handler creator to pick up
  ctx._lastClosureParams = _closureParams;

  if (c.kind() === TK.lbrace) {
    // Block body: capture all tokens with spacing, resolve names, let luaTransform fix syntax
    c.advance();
    let parts = [];
    let depth = 0;
    while (c.kind() !== TK.eof) {
      if (c.kind() === TK.rbrace && depth === 0) { c.advance(); break; }
      if (c.kind() === TK.lbrace) depth++;
      if (c.kind() === TK.rbrace) depth--;
      // Resolve props.X dot-access in handler body
      {
        const pa = peekPropsAccess(c);
        if (pa) {
          skipPropsAccess(c, pa);
          const pv = pa.value;
          if (typeof pv === 'string') {
            const isZigExpr = pv.includes('@as(') || pv.includes('@intCast') || pv.includes('_oa') || pv.includes('state.get') || pv.includes('getSlot');
            if (isZigExpr) {
              parts.push(pa.field);
            } else if (/^-?\d+(\.\d+)?$/.test(pv) || /^0x[0-9a-fA-F]+$/.test(pv) || pv.startsWith("'") || pv.startsWith('"')) {
              parts.push(pv);
            } else {
              parts.push("'" + pv.replace(/'/g, "\\'") + "'");
            }
          } else {
            parts.push(String(pv));
          }
          continue;
        }
      }
      // Resolve state getter/setter names through instance remap
      if (c.kind() === TK.identifier) {
        const name = c.text();
        const remapped = (ctx.nameRemap && ctx.nameRemap[name]) || name;
        if (isGetter(name)) {
          parts.push(remapped);
        } else if (isSetter(name)) {
          parts.push(remapped);
        } else if (isScriptFunc(name)) {
          parts.push(name);
        } else if (ctx.currentMap && name === ctx.currentMap.itemParam) {
          parts.push(name);
        } else if (ctx.currentMap && name === ctx.currentMap.indexParam) {
          parts.push(name);
        } else if (ctx.propStack && ctx.propStack[name] !== undefined && typeof ctx.propStack[name] === 'string') {
          // In Lua/JS handler context, emit the prop NAME (not the Zig value).
          const pv = ctx.propStack[name];
          // Const OA row ref with .field access
          if (typeof pv === 'string' && pv.charCodeAt(0) === 1 &&
              c.pos + 2 < c.count && c.kindAt(c.pos + 1) === TK.dot && c.kindAt(c.pos + 2) === TK.identifier) {
            var _hpfld = resolveConstOaFieldFromRef(pv, c.textAt(c.pos + 2));
            if (_hpfld !== null) {
              if (_hpfld.charAt(0) === '"' && _hpfld.charAt(_hpfld.length - 1) === '"') _hpfld = _hpfld.slice(1, -1);
              parts.push(_hpfld);
              c.advance(); c.advance(); c.advance();
              continue;
            }
          }
          const isZigExpr = pv.includes('@as(') || pv.includes('@intCast') || pv.includes('_oa') || pv.includes('state.get') || pv.includes('getSlot');
          if (isZigExpr) {
            // Convert Zig expression to Lua for handler context
            var _luaPv = pv;
            // OA refs → _item.field or _nitem.field
            _luaPv = _luaPv.replace(/_oa\d+_(\w+)\[_j\]\[0\.\._oa\d+_\w+_lens\[_j\]\]/g, '_nitem.$1');
            _luaPv = _luaPv.replace(/_oa\d+_(\w+)\[_j\]/g, '_nitem.$1');
            _luaPv = _luaPv.replace(/_oa\d+_(\w+)\[_i\]\[0\.\._oa\d+_\w+_lens\[_i\]\]/g, '_item.$1');
            _luaPv = _luaPv.replace(/_oa\d+_(\w+)\[_i\]/g, '_item.$1');
            // Index casts → Lua index expression
            // Zig uses _i (outer), _j (inner), _k (triple-nested).
            // Lua uses _i (outer), _ni (inner).
            _luaPv = _luaPv.replace(/@as\(i64,\s*@intCast\(([^)]+)\)\)/g, function(_, v) {
              if (v === '_i') return '(_i - 1)';
              if (v === '_j') return '(_ni - 1)';
              if (v === '_k') return '(_nni - 1)';
              return '(' + v + ' - 1)';
            });
            // Strip remaining Zig casts
            for (var _zci = 0; _zci < 3; _zci++) {
              _luaPv = _luaPv.replace(/@as\([^,]+,\s*([^)]+)\)/g, '$1');
              _luaPv = _luaPv.replace(/@intCast\(([^)]+)\)/g, '$1');
            }
            // State slots → getter names
            _luaPv = _luaPv.replace(/state\.getSlot(?:Int|Float|Bool|String)?\((\d+)\)/g, function(_, idx) {
              return (ctx.stateSlots && ctx.stateSlots[+idx]) ? ctx.stateSlots[+idx].getter : '_slot' + idx;
            });
            parts.push(_luaPv);
          } else if (/^-?\d+(\.\d+)?$/.test(pv) || /^0x[0-9a-fA-F]+$/.test(pv)) {
            parts.push(pv);
          } else if (pv.startsWith("'") || pv.startsWith('"')) {
            parts.push(pv);
          } else {
            // String prop value — quote it for valid JS/Lua
            parts.push("'" + pv.replace(/'/g, "\\'") + "'");
          }
        } else if (ctx.renderLocals && ctx.renderLocals[name] !== undefined) {
          var _hrlv = ctx.renderLocals[name];
          // Resolve const OA row ref + .field in handler bodies
          if (typeof _hrlv === 'string' && _hrlv.charCodeAt(0) === 1 &&
              c.pos + 2 < c.count && c.kindAt(c.pos + 1) === TK.dot && c.kindAt(c.pos + 2) === TK.identifier) {
            var _hfld = resolveConstOaFieldFromRef(_hrlv, c.textAt(c.pos + 2));
            if (_hfld !== null) {
              // Strip quotes for JS/Lua handler context
              if (_hfld.charAt(0) === '"' && _hfld.charAt(_hfld.length - 1) === '"') _hfld = _hfld.slice(1, -1);
              parts.push(_hfld);
              c.advance(); c.advance(); // skip name and dot; field advanced by loop
              c.advance(); // advance past field
              continue;
            }
          }
          parts.push(_hrlv);
        } else {
          parts.push(remapped);
        }
      } else if (c.kind() === TK.semicolon) {
        parts.push('; ');
      } else if (c.kind() === TK.eq_eq) {
        parts.push(' == ');
        c.advance();
        if (c.kind() === TK.equals) c.advance(); // === → ==
        continue;
      } else if (c.kind() === TK.not_eq) {
        parts.push(' ~= ');
        c.advance();
        if (c.kind() === TK.equals) c.advance(); // !== → ~=
        continue;
      } else if (c.kind() === TK.amp_amp) {
        parts.push(' and ');
      } else if (c.kind() === TK.pipe_pipe) {
        parts.push(' or ');
      } else if (c.kind() === TK.bang) {
        parts.push('not ');
      } else if (c.kind() === TK.plus || c.kind() === TK.minus || c.kind() === TK.star || c.kind() === TK.slash || c.kind() === TK.percent) {
        parts.push(' ' + c.text() + ' ');
      } else if (c.kind() === TK.gt || c.kind() === TK.lt || c.kind() === TK.gt_eq || c.kind() === TK.lt_eq) {
        parts.push(' ' + c.text() + ' ');
      } else {
        parts.push(c.text());
      }
      c.advance();
    }
    const joined = parts.join('');
    // Empty handler body () => {} — return a no-op so map handlers have a valid luaBody
    if (joined.trim() === '') return '-- noop';
    return luaTransform(joined);
  }

  // Single expression: setter(expr) or scriptFunc()
  let stmts = [];
  if (c.kind() === TK.identifier && (isSetter(c.text()) || isScriptFunc(c.text()))) {
    const fname = (ctx.nameRemap && ctx.nameRemap[c.text()]) || c.text();
    c.advance();
    if (c.kind() === TK.lparen) {
      c.advance();
      if (c.kind() === TK.rparen) {
        stmts.push(`${fname}()`);
      } else {
        const valExpr = luaParseValueExpr(c);
        stmts.push(`${fname}(${valExpr})`);
      }
      if (c.kind() === TK.rparen) c.advance();
    }
  }
  return stmts.join('; ');
}
