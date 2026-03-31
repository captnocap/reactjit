// ── Brace conditional parsing ─────────────────────────────────────

// Try to parse {expr && <JSX>} conditional — returns true if consumed
function tryParseConditional(c, children) {
  // Look ahead: identifier (op identifier/number)* && <
  const saved = c.save();
  let condParts = [];
  // Collect condition expression until && or }
  while (c.kind() !== TK.eof && c.kind() !== TK.rbrace) {
    if (c.kind() === TK.amp_amp) {
      c.advance();
      // Check if next is JSX
      if (c.kind() === TK.lt) {
        const condExpr = condParts.join('');
        const jsxNode = parseJSXElement(c);
        if (c.kind() === TK.rbrace) c.advance();
        // Map-item conditional: inject display style inline instead of _updateConditionals
        if (ctx.currentMap) {
          const ip = ctx.currentMap.itemParam;
          const mm = condExpr.match(new RegExp('^' + ip + '\\.(\\w+)(\\s*==\\s*)(\\d+)$'));
          if (mm) {
            const oa = ctx.currentMap.oa;
            const resolved = `_oa${oa.oaIdx}_${mm[1]}[_i] == ${mm[3]}`;
            // Merge display into existing style if present, otherwise add new style
            let modified;
            if (jsxNode.nodeExpr.includes('.style = .{')) {
              modified = jsxNode.nodeExpr.replace('.style = .{', `.style = .{ .display = if (${resolved}) .flex else .none,`);
            } else {
              modified = jsxNode.nodeExpr.replace(/ \}$/, `, .style = .{ .display = if (${resolved}) .flex else .none } }`);
            }
            children.push({ nodeExpr: modified, dynBufId: jsxNode.dynBufId });
            return true;
          }
        }
        // Register as conditional
        const condIdx = ctx.conditionals.length;
        ctx.conditionals.push({ condExpr, kind: 'show_hide', inMap: !!ctx.currentMap });
        children.push({ nodeExpr: jsxNode.nodeExpr, condIdx, dynBufId: jsxNode.dynBufId });
        return true;
      }
      // Not JSX after && — might be chained condition, put && back
      condParts.push(' and ');
      continue;
    }
    if (c.kind() === TK.pipe_pipe) {
      condParts.push(' or ');
      c.advance();
      continue;
    }
    // Build condition expression with Zig-compatible ops
    if (c.kind() === TK.identifier && c.text() === 'exact') {
      condParts.push(' == ');
      c.advance();
      if (c.kind() === TK.equals) c.advance();
      continue;
    }
    // props.X dot-access in conditional condition
    {
      const pa = peekPropsAccess(c);
      if (pa) {
        skipPropsAccess(c);
        condParts.push(_condPropValue(pa.value));
        continue;
      }
    }
    if (c.kind() === TK.identifier) {
      const name = c.text();
      if (globalThis.__SMITH_DEBUG_INLINE && (name === 'activeTab' || name === 'connectedApp' || name === 'selectedIdx' || name === 'crashCount' || name === 'copied')) {
        globalThis.__dbg = globalThis.__dbg || [];
        globalThis.__dbg.push('[COND] name=' + name + ' isGetter=' + isGetter(name) + ' slot=' + findSlot(name) + ' inline=' + (ctx.inlineComponent || 'App') + ' pos=' + c.pos);
      }
      // Check for OA getter followed by .length BEFORE isGetter (OA names aren't in stateSlots)
      const oa = ctx.objectArrays.find(o => o.getter === name);
      if (oa && c.pos + 2 < c.count && c.kindAt(c.pos + 1) === TK.dot && c.textAt(c.pos + 2) === 'length') {
        condParts.push(`_oa${oa.oaIdx}_len`);
        c.advance();
        c.advance();
        c.advance();
        continue;
      }
      if (isGetter(name)) {
        condParts.push(slotGet(name));
      } else if (ctx.renderLocals && ctx.renderLocals[name] !== undefined) {
        condParts.push(ctx.renderLocals[name]);
      } else if (ctx.propStack && ctx.propStack[name] !== undefined) {
        const pv = ctx.propStack[name];
        condParts.push(_condPropValue(pv));
      } else if (ctx.currentMap && name === ctx.currentMap.indexParam) {
        condParts.push('@as(i64, @intCast(' + (ctx.currentMap.iterVar || '_i') + '))');
      } else if (ctx.currentMap && name === ctx.currentMap.itemParam) {
        c.advance();
        if (c.kind() === TK.dot) {
          c.advance();
          if (c.kind() === TK.identifier) {
            let field = c.text();
            c.advance();
            while (c.kind() === TK.dot && c.pos + 1 < c.count && c.kindAt(c.pos + 1) === TK.identifier) {
              c.advance();
              field += '_' + c.text();
              c.advance();
            }
            const mapOa = ctx.currentMap.oa;
            if (mapOa) {
              condParts.push(`_oa${mapOa.oaIdx}_${field}[${ctx.currentMap.iterVar || '_i'}]`);
            } else {
              condParts.push('0');
            }
            continue;
          }
        } else {
          condParts.push('@as(i64, @intCast(' + (ctx.currentMap.iterVar || '_i') + '))');
        }
      } else if (ctx.inlineComponent) {
        condParts.push('0');
      } else {
        condParts.push(name);
      }
    } else if (c.kind() === TK.number) {
      const lastPart = condParts.length > 0 ? condParts[condParts.length - 1] : '';
      if (lastPart.endsWith(' ')) condParts.push(' ' + c.text());
      else condParts.push(c.text());
    } else if (c.kind() === TK.eq_eq) {
      condParts.push(' == ');
      c.advance();
      if (c.kind() === TK.equals) c.advance();
      continue;
    } else if (c.kind() === TK.not_eq) {
      condParts.push(' != ');
      c.advance();
      if (c.kind() === TK.equals) c.advance();
      continue;
    } else if (c.kind() === TK.gt_eq) {
      condParts.push(' >= ');
    } else if (c.kind() === TK.lt_eq) {
      condParts.push(' <= ');
    } else if (c.kind() === TK.gt) {
      condParts.push(' > ');
    } else if (c.kind() === TK.lt) {
      if (c.pos + 1 < c.count && (c.kindAt(c.pos + 1) === TK.number || (c.kindAt(c.pos + 1) === TK.identifier && (isGetter(c.textAt(c.pos + 1)) || (ctx.propStack && ctx.propStack[c.textAt(c.pos + 1)] !== undefined))))) {
        condParts.push(' < ');
        c.advance();
        continue;
      }
      break;
    } else if (c.kind() === TK.question) {
      break;
    } else if (c.kind() === TK.string) {
      const sv = c.text().slice(1, -1);
      const lastOp = condParts.length > 0 ? condParts[condParts.length - 1] : '';
      if (sv === '' && (lastOp === ' == ' || lastOp === ' != ')) {
        condParts.pop();
        const lhs = condParts.join('');
        condParts.length = 0;
        condParts.push(lastOp === ' == ' ? `${lhs}.len == 0` : `${lhs}.len > 0`);
      } else if (lastOp === ' == ' || lastOp === ' != ') {
        condParts.pop();
        const lhs = condParts.join('');
        condParts.length = 0;
        const eql = `std.mem.eql(u8, ${lhs}, "${sv}")`;
        condParts.push(lastOp === ' == ' ? eql : `!${eql}`);
      } else {
        condParts.push(`"${sv}"`);
      }
    } else {
      condParts.push(c.text());
    }
    c.advance();
  }
  c.restore(saved);
  return false;
}
