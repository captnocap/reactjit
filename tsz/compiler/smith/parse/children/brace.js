// ── Child parsing: brace expressions ──────────────────────────────

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
    if (globalThis.__SMITH_DEBUG_MAP_DETECT) globalThis.__dbg.push('-> consumed by tryParseConditional');
    return true;
  }

  const ternJSXResult = tryParseTernaryJSX(c, children);
  if (ternJSXResult) {
    if (globalThis.__SMITH_DEBUG_MAP_DETECT) globalThis.__dbg.push('-> consumed by tryParseTernaryJSX');
    return true;
  }

  const ternTextResult = tryParseTernaryText(c, children);
  if (ternTextResult) {
    if (globalThis.__SMITH_DEBUG_MAP_DETECT) globalThis.__dbg.push('-> consumed by tryParseTernaryText');
    return true;
  }

  if (c.kind() === TK.identifier) {
    const maybeArr = c.text();
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
    if (c.pos + 3 < c.count && c.kindAt(c.pos + 1) === TK.dot) {
      const savedPeek = c.save();
      c.advance();
      c.advance();
      let isMapCall = c.isIdent('map') && c.pos + 1 < c.count && c.kindAt(c.pos + 1) === TK.lparen;
      // Handle .slice(...).filter(...).sort(...).map() chaining (multiple)
      while (!isMapCall && (c.isIdent('slice') || c.isIdent('filter') || c.isIdent('sort')) && c.pos + 1 < c.count && c.kindAt(c.pos + 1) === TK.lparen) {
        c.advance(); c.advance(); // skip 'filter/slice/sort' '('
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
        } else break;
      }
      c.restore(savedPeek);
      if (isMapCall) {
        let oa = ctx.objectArrays.find(o => o.getter === maybeArr);
        if (!oa) oa = inferOaFromSource(c, maybeArr);
        if (oa) {
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
      children.push({ nodeExpr: `.{ .text = "${fmt}" }` });
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
        const fmt = fieldInfo && fieldInfo.type === 'string' ? '{s}' : '{d}';
        let args;
        if (fieldInfo && fieldInfo.type === 'string') {
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
    var _brRlVal = ctx.renderLocals[c.text()];
    c.advance();
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
    if (c.kind() === TK.rbrace) c.advance();
    const isZigExpr = typeof _brRlVal === 'string' && (_brRlVal.includes('state.get') || _brRlVal.includes('getSlot') || _brRlVal.includes('_oa') || _brRlVal.includes('@as'));
    if (isZigExpr) {
      const isStr = _brRlVal.includes('getSlotString') || _brRlVal.includes('@as([]const u8');
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
      children.push({ nodeExpr: `.{ .text = "${_brRlVal}" }` });
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
        children.push({ nodeExpr: `.{ .text = "${propVal}" }` });
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
          children.push({ nodeExpr: `.{ .text = "${propVal}" }` });
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
        const fmt = fieldInfo && fieldInfo.type === 'string' ? '{s}' : '{d}';
        let args;
        if (fieldInfo && fieldInfo.type === 'string') {
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
        const jsExpr2 = exprText2.replace(/\bexact\b/g, '===');
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
        const fullExpr = (getter + ' ' + tailTokens.join(' ')).replace(/\bexact\b/g, '===');
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
      children.push({ nodeExpr: `.{ .text = "${fmtString}" }` });
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
    let jsExpr = exprText.replace(/== =/g, '===').replace(/!= =/g, '!==').replace(/\bexact\b/g, '===');
    if (/^\w+$/.test(jsExpr) && ctx.scriptFuncs && ctx.scriptFuncs.indexOf(jsExpr) >= 0) {
      jsExpr = jsExpr + '()';
    }

    const slotIdx = ctx.stateSlots.length;
    ctx.stateSlots.push({ getter: '__jsExpr_' + slotIdx, setter: '__setJsExpr_' + slotIdx, initial: '', type: 'string' });

    const bufId = ctx.dynCount;
    const isInMap = !!ctx.currentMap;
    ctx.dynTexts.push({ bufId, fmtString: '{s}', fmtArgs: 'state.getSlotString(' + slotIdx + ')', arrName: '', arrIndex: 0, bufSize: 256, inMap: isInMap, mapIdx: isInMap ? ctx.maps.indexOf(ctx.currentMap) : -1 });
    ctx.dynCount++;

    ctx._jsDynTexts.push({ slotIdx: slotIdx, jsExpr: jsExpr });

    children.push({ nodeExpr: '.{ .text = "" }', dynBufId: bufId, inMap: isInMap });
  } else if (exprText.length > 0) {
    ctx._droppedExpressions.push({ expr: exprText, line: c.starts[dropStart] || 0 });
  }

  return true;
}
