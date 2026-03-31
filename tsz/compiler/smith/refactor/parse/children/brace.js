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
    if (c.pos + 3 < c.count && c.kindAt(c.pos + 1) === TK.dot) {
      const savedPeek = c.save();
      c.advance();
      c.advance();
      const isMapCall = c.isIdent('map') && c.pos + 1 < c.count && c.kindAt(c.pos + 1) === TK.lparen;
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
    const rlVal = ctx.renderLocals[c.text()];
    c.advance();
    if (c.kind() === TK.rbrace) c.advance();
    const isZigExpr = rlVal.includes('state.get') || rlVal.includes('getSlot') || rlVal.includes('_oa') || rlVal.includes('@as');
    if (isZigExpr) {
      const bufId = ctx.dynCount;
      ctx.dynTexts.push({ bufId, fmtString: '{d}', fmtArgs: leftFoldExpr(rlVal), arrName: '', arrIndex: 0, bufSize: 64 });
      ctx.dynCount++;
      children.push({ nodeExpr: `.{ .text = "" }`, dynBufId: bufId });
    } else {
      children.push({ nodeExpr: `.{ .text = "${rlVal}" }` });
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
        const isStr = propVal.includes('getSlotString') || propVal.includes('..');
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
      if (tailTokens.length > 0 && ctx.scriptBlock) {
        ctx.dynTexts.pop();
        ctx.dynCount--;
        const fullExpr = (getter + ' ' + tailTokens.join(' ')).replace(/\bexact\b/g, '===');
        const jsSlotIdx = ctx.stateSlots.length;
        ctx.stateSlots.push({ getter: '__jsExpr_' + jsSlotIdx, setter: '__setJsExpr_' + jsSlotIdx, initial: '', type: 'string' });
        const jsBufId = ctx.dynCount;
        ctx.dynTexts.push({ bufId: jsBufId, fmtString: '{s}', fmtArgs: 'state.getSlotString(' + jsSlotIdx + ')', arrName: '', arrIndex: 0, bufSize: 256 });
        ctx.dynCount++;
        ctx._jsDynTexts.push({ slotIdx: jsSlotIdx, jsExpr: fullExpr });
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
    let jsExpr = exprText.replace(/\bexact\b/g, '===');
    if (/^\w+$/.test(jsExpr) && ctx.scriptFuncs && ctx.scriptFuncs.indexOf(jsExpr) >= 0) {
      jsExpr = jsExpr + '()';
    }

    const slotIdx = ctx.stateSlots.length;
    ctx.stateSlots.push({ getter: '__jsExpr_' + slotIdx, setter: '__setJsExpr_' + slotIdx, initial: '', type: 'string' });

    const bufId = ctx.dynCount;
    ctx.dynTexts.push({ bufId, fmtString: '{s}', fmtArgs: 'state.getSlotString(' + slotIdx + ')', arrName: '', arrIndex: 0, bufSize: 256 });
    ctx.dynCount++;

    ctx._jsDynTexts.push({ slotIdx: slotIdx, jsExpr: jsExpr });

    children.push({ nodeExpr: '.{ .text = "" }', dynBufId: bufId });
  } else if (exprText.length > 0) {
    ctx._droppedExpressions.push({ expr: exprText, line: c.starts[dropStart] || 0 });
  }

  return true;
}
