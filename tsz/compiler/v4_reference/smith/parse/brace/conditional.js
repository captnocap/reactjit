// ── Brace conditional parsing ─────────────────────────────────────

// Try to parse {expr && <JSX>} conditional — returns true if consumed
function tryParseConditional(c, children) {
  // Look ahead: identifier (op identifier/number)* && <
  const saved = c.save();
  let condParts = [];
  // Collect condition expression until && or }
  while (c.kind() !== TK.eof && c.kind() !== TK.rbrace) {
    // Handle ! prefix (boolean negation)
    if (c.kind() === TK.bang) {
      c.advance();
      if (c.kind() === TK.identifier) {
        const name = c.text();
        if (isGetter(name)) {
          condParts.push('(' + slotGet(name) + ' == 0)');
        } else if (ctx.renderLocals && ctx.renderLocals[name] !== undefined) {
          const rlVal = ctx.renderLocals[name];
          // If the value is already a boolean expression (contains comparison), negate with !
          const isBoolExpr = / > | < | >= | <= | == | != /.test(rlVal) || rlVal.includes('.len');
          if (isBoolExpr) {
            condParts.push('(!(' + rlVal + '))');
          } else {
            condParts.push('((' + rlVal + ') == 0)');
          }
        } else if (ctx.propStack && ctx.propStack[name] !== undefined) {
          condParts.push('((' + _condPropValue(ctx.propStack[name]) + ') == 0)');
        } else {
          condParts.push('(0)');
        }
        c.advance();
        continue;
      }
      condParts.push('!');
      continue;
    }
    if (c.kind() === TK.amp_amp) {
      c.advance();
      // Skip optional ( wrapper around JSX
      let parenWrapped = false;
      let savedBeforeParen = null;
      if (c.kind() === TK.lparen) {
        savedBeforeParen = c.save();
        c.advance();
        parenWrapped = true;
      }
      // Check if next is JSX
      if (c.kind() === TK.lt) {
        const condExpr = condParts.join('');
        const jsxNode = parseJSXElement(c);
        if (parenWrapped && c.kind() === TK.rparen) c.advance();
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
      // Check for conditional children splice: && children or && props.children
      if (c.kind() === TK.identifier) {
        // {cond && children}
        if (c.text() === 'children' && ctx.componentChildren) {
          c.advance();
          if (parenWrapped && c.kind() === TK.rparen) c.advance();
          if (c.kind() === TK.rbrace) c.advance();
          const condExpr = condParts.join('');
          // Wrap all children in a conditional Box
          const condIdx = ctx.conditionals.length;
          ctx.conditionals.push({ condExpr, kind: 'show_hide', inMap: !!ctx.currentMap });
          const wrapperStyle = '.{ .flex_direction = .column }';
          // Build children nodes list for the wrapper
          const childExprs = [];
          for (const ch of ctx.componentChildren) {
            childExprs.push(ch.nodeExpr || '.{}');
          }
          const wrapperExpr = `.{ .style = ${wrapperStyle} }`;
          children.push({ nodeExpr: wrapperExpr, condIdx, subChildren: ctx.componentChildren.slice() });
          return true;
        }
        // {cond && props.children} — direct check since children isn't in propStack
        if (ctx.propsObjectName && c.text() === ctx.propsObjectName &&
            c.pos + 2 < c.count && c.kindAt(c.pos + 1) === TK.dot &&
            c.textAt(c.pos + 2) === 'children' && ctx.componentChildren) {
          c.advance(); // props
          c.advance(); // .
          c.advance(); // children
          if (parenWrapped && c.kind() === TK.rparen) c.advance();
          if (c.kind() === TK.rbrace) c.advance();
          const condExpr = condParts.join('');
          const condIdx = ctx.conditionals.length;
          ctx.conditionals.push({ condExpr, kind: 'show_hide', inMap: !!ctx.currentMap });
          const wrapperExpr = `.{ .style = .{ .flex_direction = .column } }`;
          children.push({ nodeExpr: wrapperExpr, condIdx, subChildren: ctx.componentChildren.slice() });
          return true;
        }
      }
      // Restore paren if we consumed it but didn't find JSX or children
      if (parenWrapped && savedBeforeParen) {
        c.restore(savedBeforeParen);
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
        const pav = _condPropValue(pa.value);
        // Handle .length after props access: props.X.length → resolved.len
        if (c.kind() === TK.dot && c.pos + 1 < c.count && c.textAt(c.pos + 1) === 'length') {
          condParts.push(pav + '.len');
          c.advance(); // skip .
          c.advance(); // skip length
        } else {
          condParts.push(pav);
        }
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
      // OA getter followed by [expr] or [expr].field → resolve to OA field access
      if (oa && c.pos + 2 < c.count && c.kindAt(c.pos + 1) === TK.lbracket) {
        // Resolve bracket expression to Zig index
        const bracketIdent = c.textAt(c.pos + 2);
        let resolvedIdx = null;
        if (ctx.currentMap && bracketIdent === ctx.currentMap.indexParam) {
          resolvedIdx = ctx.currentMap.iterVar || '_i';
        } else if (ctx.propStack && ctx.propStack[bracketIdent] !== undefined) {
          const bpv = ctx.propStack[bracketIdent];
          if (typeof bpv === 'string' && bpv.includes('_oa')) {
            resolvedIdx = `@as(usize, @intCast(${bpv}))`;
          } else if (typeof bpv === 'string' && bpv.includes('@intCast(')) {
            resolvedIdx = bpv.replace('@as(i64, ', '@as(usize, ');
          } else if (/^\d+$/.test(bpv)) {
            resolvedIdx = bpv;
          }
        } else if (ctx.currentMap && ctx.currentMap.oa) {
          const bracketField = ctx.currentMap.oa.fields.find(f => f.name === bracketIdent);
          if (bracketField) {
            resolvedIdx = `@as(usize, @intCast(_oa${ctx.currentMap.oa.oaIdx}_${bracketIdent}[${ctx.currentMap.iterVar || '_i'}]))`;
          }
        }
        if (resolvedIdx !== null && c.kindAt(c.pos + 3) === TK.rbracket) {
          // Check for .field after ] (object array bracket access)
          if (c.pos + 5 < c.count && c.kindAt(c.pos + 4) === TK.dot && c.kindAt(c.pos + 5) === TK.identifier) {
            const field = c.textAt(c.pos + 5);
            const fieldInfo = oa.fields.find(f => f.name === field);
            if (fieldInfo && fieldInfo.type === 'string') {
              condParts.push(`_oa${oa.oaIdx}_${field}[${resolvedIdx}][0.._oa${oa.oaIdx}_${field}_lens[${resolvedIdx}]]`);
            } else {
              condParts.push(`_oa${oa.oaIdx}_${field}[${resolvedIdx}]`);
            }
            c.advance(); c.advance(); c.advance(); c.advance(); c.advance(); c.advance(); // skip name [ idx ] . field
            continue;
          }
          // Primitive array: no .field — just oaName[idx] → _oaN_value[idx]
          if (oa.isPrimitiveArray) {
            condParts.push(`_oa${oa.oaIdx}_value[${resolvedIdx}]`);
            c.advance(); c.advance(); c.advance(); c.advance(); // skip name [ idx ]
            continue;
          }
        }
      }
      if (isGetter(name)) {
        condParts.push(slotGet(name));
      } else if (ctx.renderLocals && ctx.renderLocals[name] !== undefined) {
        condParts.push(ctx.renderLocals[name]);
      } else if (ctx.propStack && ctx.propStack[name] !== undefined) {
        const pv = ctx.propStack[name];
        // If prop is a map-item ref and next is .field, resolve as OA field access
        if (ctx.currentMap && ctx.currentMap.oa &&
            typeof pv === 'string' && pv.includes('@intCast(') &&
            c.pos + 2 < c.count && c.kindAt(c.pos + 1) === TK.dot && c.kindAt(c.pos + 2) === TK.identifier) {
          c.advance(); // skip prop name
          c.advance(); // skip dot
          const field = c.text();
          const mapOa = ctx.currentMap.oa;
          const iterVar = ctx.currentMap.iterVar || '_i';
          condParts.push(`_oa${mapOa.oaIdx}_${field}[${iterVar}]`);
          c.advance(); // skip field
          continue;
        }
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
