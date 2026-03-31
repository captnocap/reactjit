// ── OA inference fallback (Love2D-style robustness) ──
// If collectState missed an array, re-scan source to find and register it.
function inferOaFromSource(c, name) {
  const saved = c.save();
  c.pos = 0;
  const setter = 'set' + name[0].toUpperCase() + name.slice(1);
  while (c.pos < c.count) {
    if (c.kind() === TK.identifier && c.text() === name) {
      c.advance();
      // Scan forward (max 20 tokens) looking for [{
      let limit = 20;
      while (limit-- > 0 && c.pos < c.count) {
        if (c.kind() === TK.lbracket) {
          c.advance();
          if (c.kind() === TK.lbrace) {
            c.advance(); // skip {
            const fields = [];
            while (c.kind() !== TK.rbrace && c.kind() !== TK.eof) {
              if (c.kind() === TK.identifier) {
                const fname = c.text(); c.advance();
                if (c.kind() === TK.colon) c.advance();
                let ftype = 'int';
                if (c.kind() === TK.string) { ftype = 'string'; c.advance(); }
                else if (c.kind() === TK.number) {
                  const nv = c.text();
                  ftype = nv.startsWith('0x') ? 'int' : (nv.includes('.') ? 'float' : 'int');
                  c.advance();
                }
                else if (c.isIdent('true') || c.isIdent('false')) { ftype = 'boolean'; c.advance(); }
                fields.push({ name: fname, type: ftype });
              }
              if (c.kind() === TK.comma) c.advance();
              else if (c.kind() !== TK.rbrace) c.advance();
            }
            if (fields.length > 0) {
              const oaIdx = ctx.objectArrays.length;
              const oa = { fields, getter: name, setter, oaIdx };
              ctx.objectArrays.push(oa);
              c.restore(saved);
              return oa;
            }
          }
          break;
        }
        c.advance();
      }
    }
    c.advance();
  }
  c.restore(saved);
  return null;
}

// ── Map parser ──

function tryParseMap(c, oa) {
  const saved = c.save();
  c.advance(); // skip array name
  if (c.kind() !== TK.dot) { c.restore(saved); return null; }
  c.advance(); // skip .
  if (!c.isIdent('map')) { c.restore(saved); return null; }
  c.advance(); // skip 'map'
  if (c.kind() !== TK.lparen) { c.restore(saved); return null; }
  c.advance(); // skip (

  // Parse params: (item, i) => or (item) =>
  if (c.kind() !== TK.lparen) { c.restore(saved); return null; }
  c.advance(); // skip (
  let itemParam = '_item';
  let indexParam = '_i';
  if (c.kind() === TK.identifier) { itemParam = c.text(); c.advance(); }
  if (c.kind() === TK.comma) { c.advance(); if (c.kind() === TK.identifier) { indexParam = c.text(); c.advance(); } }
  if (c.kind() === TK.rparen) c.advance(); // skip )
  if (c.kind() === TK.arrow) c.advance(); // skip =>
  if (c.kind() === TK.lparen) c.advance(); // skip ( before JSX

  // Push map item context — so {item.label} resolves to _oa0_label[_i]
  const savedMapCtx = ctx.currentMap;
  // Reserve slot BEFORE parsing template so nested maps pushed during template
  // get higher indices, keeping this map's index stable.
  const mapIdx = ctx.maps.length;
  const isInline = !!(savedMapCtx && savedMapCtx.oaIdx !== oa.oaIdx);
  const mapInfo = {
    oaIdx: oa.oaIdx, itemParam, indexParam,
    oa, textsInMap: [], innerCount: 0, parentArr: '', childIdx: 0,
    mapArrayDecls: [], mapArrayComments: [],
    parentMap: savedMapCtx,  // track parent map for nested context
    isInline,  // separate-OA map inside another map's template (love2d: inline loop)
  };
  ctx.maps.push(mapInfo); // reserve slot early
  ctx.currentMap = mapInfo;

  // Save array state — arrays created during map template go to mapArrayDecls
  // But save top-level refs so component inlining can restore to them
  const savedArrayDecls = ctx.arrayDecls;
  const savedArrayComments = ctx.arrayComments;
  mapInfo._topArrayDecls = savedArrayDecls;
  mapInfo._topArrayComments = savedArrayComments;
  ctx.arrayDecls = mapInfo.mapArrayDecls;
  ctx.arrayComments = mapInfo.mapArrayComments;
  // DO NOT save/restore arrayCounter — each map gets unique array IDs

  // Parse the map template JSX
  const templateNode = parseJSXElement(c);

  // Restore array target — but counter keeps advancing (no overlaps)
  ctx.arrayDecls = savedArrayDecls;
  ctx.arrayComments = savedArrayComments;

  ctx.currentMap = savedMapCtx;

  // Skip closing ))}
  if (c.kind() === TK.rparen) c.advance(); // )
  if (c.kind() === TK.rparen) c.advance(); // )

  // Finalize map info (slot was reserved early)
  mapInfo.templateExpr = templateNode.nodeExpr;

  // Return a placeholder node — the parent array slot that gets .children set by _rebuildMap
  // Map placeholder — gets .children set by _rebuildMap at runtime
  return { nodeExpr: `.{}`, mapIdx };
}

// Nested map: cursor is on field name (e.g. "items" in group.items.map(...))
function tryParseNestedMap(c, nestedOa, fieldName) {
  const saved = c.save();
  c.advance(); // skip field name
  if (c.kind() !== TK.dot) { c.restore(saved); return null; }
  c.advance(); // skip .
  if (!c.isIdent('map')) { c.restore(saved); return null; }
  c.advance(); // skip 'map'
  if (c.kind() !== TK.lparen) { c.restore(saved); return null; }
  c.advance(); // skip (

  // Parse params: (item, i) => or (item) =>
  if (c.kind() !== TK.lparen) { c.restore(saved); return null; }
  c.advance(); // skip (
  let itemParam = '_item';
  let indexParam = '_j'; // nested uses _j
  if (c.kind() === TK.identifier) { itemParam = c.text(); c.advance(); }
  if (c.kind() === TK.comma) { c.advance(); if (c.kind() === TK.identifier) { indexParam = c.text(); c.advance(); } }
  if (c.kind() === TK.rparen) c.advance(); // skip )
  if (c.kind() === TK.arrow) c.advance(); // skip =>
  if (c.kind() === TK.lparen) c.advance(); // skip ( before JSX

  // Push nested map context
  const savedMapCtx = ctx.currentMap;
  const mapIdx = ctx.maps.length;
  const mapInfo = {
    oaIdx: nestedOa.oaIdx, itemParam, indexParam,
    oa: nestedOa, textsInMap: [], innerCount: 0, parentArr: '', childIdx: 0,
    mapArrayDecls: [], mapArrayComments: [],
    isNested: true, parentMapIdx: savedMapCtx ? ctx.maps.indexOf(savedMapCtx) : -1,
    parentOaIdx: savedMapCtx ? savedMapCtx.oaIdx : -1,
    nestedField: fieldName,
    iterVar: '_j',
    parentMap: savedMapCtx,
  };
  ctx.maps.push(mapInfo); // reserve slot early
  ctx.currentMap = mapInfo;

  // Save array state
  const savedArrayDecls = ctx.arrayDecls;
  const savedArrayComments = ctx.arrayComments;
  mapInfo._topArrayDecls = savedArrayDecls;
  mapInfo._topArrayComments = savedArrayComments;
  ctx.arrayDecls = mapInfo.mapArrayDecls;
  ctx.arrayComments = mapInfo.mapArrayComments;

  // Parse the map template JSX
  const templateNode = parseJSXElement(c);

  // Restore
  ctx.arrayDecls = savedArrayDecls;
  ctx.arrayComments = savedArrayComments;
  ctx.currentMap = savedMapCtx;

  // Skip closing ))}
  if (c.kind() === TK.rparen) c.advance();
  if (c.kind() === TK.rparen) c.advance();

  // Finalize (slot was reserved early)
  mapInfo.templateExpr = templateNode.nodeExpr;

  return { nodeExpr: `.{}`, mapIdx };
}

// ── Template literal parser ──

// Left-fold arithmetic: "A+B+C+D" → "(((A + B) + C) + D)"
function leftFoldExpr(expr) {
  const parts = [];
  let depth = 0, cur = '';
  for (let i = 0; i < expr.length; i++) {
    if (expr[i] === '(') depth++;
    else if (expr[i] === ')') depth--;
    else if (expr[i] === '+' && depth === 0) { parts.push(cur.trim()); cur = ''; continue; }
    cur += expr[i];
  }
  parts.push(cur.trim());
  if (parts.length <= 1) return expr;
  let result = parts[0];
  for (let i = 1; i < parts.length; i++) result = `(${result} + ${parts[i]})`;
  return result;
}

// UTF-8 byte length of a JS string
function utf8ByteLen(str) {
  let n = 0;
  for (let i = 0; i < str.length; i++) {
    const c = str.charCodeAt(i);
    if (c < 0x80) n++;
    else if (c < 0x800) n += 2;
    else if (c >= 0xD800 && c <= 0xDBFF) { n += 4; i++; }
    else n += 3;
  }
  return n;
}

function parseTemplateLiteral(raw) {
  // Split "text ${expr} more ${expr2}" into fmt string + args
  let fmt = '';
  const args = [];
  let i = 0;
  while (i < raw.length) {
    if (raw[i] === '$' && i + 1 < raw.length && raw[i + 1] === '{') {
      // Find matching }
      let j = i + 2;
      let depth = 1;
      while (j < raw.length && depth > 0) {
        if (raw[j] === '{') depth++;
        if (raw[j] === '}') depth--;
        j++;
      }
      const expr = raw.slice(i + 2, j - 1).trim();
      // Determine format specifier based on expression type
      const slotIdx = findSlot(expr);
      if (slotIdx >= 0) {
        const slot = ctx.stateSlots[slotIdx];
        fmt += slot.type === 'string' ? '{s}' : '{d}';
        args.push(slotGet(expr));
      } else if (/^(\w+)\s*([+\-*\/])\s*(.+)$/.test(expr)) {
        // Arithmetic expression: getter + N, getter - 1, etc.
        const m = expr.match(/^(\w+)\s*([+\-*\/])\s*(.+)$/);
        const lhsSlot = findSlot(m[1]);
        if (lhsSlot >= 0) {
          const rhsSlot = findSlot(m[3].trim());
          const rhsVal = rhsSlot >= 0 ? slotGet(m[3].trim()) : m[3].trim();
          fmt += '{d}';
          if (m[2] === '/') args.push(`@divTrunc(${slotGet(m[1])}, ${rhsVal})`);
          else if (m[2] === '%') args.push(`@mod(${slotGet(m[1])}, ${rhsVal})`);
          else args.push(`${slotGet(m[1])} ${m[2]} ${rhsVal}`);
        } else if (ctx.currentMap && m[1] === ctx.currentMap.indexParam) {
          // Map index param in arithmetic: ${i + 1}, ${i - 1}, etc.
          fmt += '{d}';
          if (m[2] === '/') args.push(`@divTrunc(@as(i64, @intCast(_i)), ${m[3].trim()})`);
          else if (m[2] === '%') args.push(`@mod(@as(i64, @intCast(_i)), ${m[3].trim()})`);
          else args.push(`@as(i64, @intCast(_i)) ${m[2]} ${m[3].trim()}`);
        } else {
          fmt += expr;
        }
      } else if (ctx.renderLocals && ctx.renderLocals[expr] !== undefined) {
        // Render-local variable substitution in template literal
        const rlVal = ctx.renderLocals[expr];
        const isNum = /^-?\d+(\.\d+)?$/.test(rlVal);
        const isZigExpr = rlVal.includes('state.get') || rlVal.includes('getSlot') || rlVal.includes('_oa') || rlVal.includes('@as');
        if (isNum) { fmt += '{d}'; args.push(rlVal); }
        else if (isZigExpr) { fmt += '{d}'; args.push(leftFoldExpr(rlVal)); }
        else { fmt += rlVal; }
      } else if (ctx.propStack[expr] !== undefined) {
        // Prop substitution — use the concrete prop value
        const propVal = ctx.propStack[expr];
        const isNum = /^-?\d+(\.\d+)?$/.test(propVal);
        const isZigExpr = propVal.includes('state.get') || propVal.includes('getSlot') || propVal.includes('_oa') || propVal.includes('@as');
        const isStringArray = isZigExpr && propVal.includes('[') && propVal.includes('..');
        if (isNum) {
          fmt += '{d}'; args.push(propVal);
        } else if (isStringArray) {
          // String array slice: _oaN_field[_i][0.._oaN_field_lens[_i]]
          fmt += '{s}'; args.push(propVal);
        } else if (isZigExpr) {
          // Other Zig expressions (OA integer fields, state getters)
          fmt += '{d}'; args.push(leftFoldExpr(propVal));
        } else {
          // Plain string literal
          fmt += '{s}'; args.push(`"${propVal}"`);
        }
      } else if (ctx.currentMap && expr === ctx.currentMap.indexParam) {
        // Map index parameter: ${idx} → {d} with @as(i64, @intCast(_i))
        fmt += '{d}';
        args.push('@as(i64, @intCast(_i))');
      } else if (ctx.currentMap && ctx.currentMap.parentMap && expr === ctx.currentMap.parentMap.indexParam) {
        // Parent map index parameter: ${parent_idx} → {d} with outer loop index
        // For nested maps, outer loop uses _i, inner loop uses iterator from parent
        fmt += '{d}';
        args.push('@as(i64, @intCast(_i))');  // parent map iteration still uses _i at its level
      } else if (ctx.currentMap && expr.startsWith(ctx.currentMap.itemParam + '.')) {
        // Map item member access: ${item.field} → {s}/{d} with OA field ref
        const field = expr.slice(ctx.currentMap.itemParam.length + 1);
        const oa = ctx.currentMap.oa;
        const fi = oa.fields.find(f => f.name === field);
        if (fi) {
          const oaIdx = oa.oaIdx;
          if (fi.type === 'string') {
            fmt += '{s}';
            args.push(`_oa${oaIdx}_${field}[_i][0.._oa${oaIdx}_${field}_lens[_i]]`);
          } else {
            fmt += '{d}';
            args.push(`_oa${oaIdx}_${field}[_i]`);
          }
        } else {
          fmt += expr;
        }
      } else if (expr.includes('?') && expr.includes(':')) {
        // Ternary expression in template literal: condition ? trueVal : falseVal
        // Parse recursively to handle chained ternaries: a == 0 ? "x" : a == 1 ? "y" : "z"
        const parseTernaryExpr = (e) => {
          const qIdx = e.indexOf('?');
          if (qIdx < 0) return { isLiteral: true, value: e.trim() };
          const condStr = e.slice(0, qIdx).trim();
          const rest = e.slice(qIdx + 1);
          // Find matching : considering nested ternaries (count ? depth)
          let depth = 0, colonIdx = -1;
          for (let ci = 0; ci < rest.length; ci++) {
            if (rest[ci] === '?') depth++;
            else if (rest[ci] === ':') { if (depth === 0) { colonIdx = ci; break; } depth--; }
          }
          if (colonIdx < 0) return { isLiteral: true, value: e.trim() };
          let trueStr = rest.slice(0, colonIdx).trim();
          let falseStr = rest.slice(colonIdx + 1).trim();
          // Strip quotes from branches
          const stripQ = (s) => (s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'")) ? s.slice(1, -1) : null;
          // Resolve condition LHS
          let condZig = condStr;
          // Replace state getters in condition
          for (const s of ctx.stateSlots) {
            if (condStr.includes(s.getter)) {
              condZig = condZig.replace(new RegExp('\\b' + s.getter + '\\b', 'g'), slotGet(s.getter));
            }
          }
          // Fix === to ==, !== to !=
          condZig = condZig.replace(/===/g, '==').replace(/!==/g, '!=');
          const tv = stripQ(trueStr);
          const fv = stripQ(falseStr);
          if (tv !== null && fv !== null) {
            return { isLiteral: false, zigExpr: `if (${condZig}) "${tv}" else "${fv}"`, spec: '{s}' };
          }
          // Recursive: false branch might be another ternary
          const fvParsed = parseTernaryExpr(falseStr);
          if (tv !== null && !fvParsed.isLiteral) {
            return { isLiteral: false, zigExpr: `if (${condZig}) "${tv}" else ${fvParsed.zigExpr}`, spec: '{s}' };
          }
          // Numeric branches
          if (/^-?\d+$/.test(trueStr) && /^-?\d+$/.test(falseStr)) {
            return { isLiteral: false, zigExpr: `if (${condZig}) @as(i64, ${trueStr}) else @as(i64, ${falseStr})`, spec: '{d}' };
          }
          return { isLiteral: true, value: e.trim() };
        };
        const result = parseTernaryExpr(expr);
        if (!result.isLiteral) {
          fmt += result.spec;
          args.push(result.zigExpr);
        } else {
          fmt += result.value;
        }
      } else {
        // Non-resolvable arithmetic/complex expression — embed as literal text
        fmt += expr;
      }
      i = j;
    } else {
      fmt += raw[i] === '"' ? '\\"' : raw[i];
      i++;
    }
  }
  return { fmt, args };
}

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
      condParts.push(' == '); c.advance(); if (c.kind() === TK.equals) c.advance(); continue;
    }
    if (c.kind() === TK.identifier) {
      const name = c.text();
      if (globalThis.__SMITH_DEBUG_INLINE && (name === 'activeTab' || name === 'connectedApp' || name === 'selectedIdx' || name === 'crashCount' || name === 'copied')) {
        globalThis.__dbg = globalThis.__dbg || [];
        globalThis.__dbg.push('[COND] name=' + name + ' isGetter=' + isGetter(name) + ' slot=' + findSlot(name) + ' inline=' + (ctx.inlineComponent || 'App') + ' pos=' + c.pos);
      }
      // Check for OA getter followed by .length BEFORE isGetter (OA names aren't in stateSlots)
      const _oa = ctx.objectArrays.find(o => o.getter === name);
      if (_oa && c.pos + 2 < c.count && c.kindAt(c.pos + 1) === TK.dot && c.textAt(c.pos + 2) === 'length') {
        condParts.push(`_oa${_oa.oaIdx}_len`);
        c.advance(); // skip name
        c.advance(); // skip .
        c.advance(); // skip length
        continue;
      }
      if (isGetter(name)) {
        condParts.push(slotGet(name));
      } else if (ctx.propStack && ctx.propStack[name] !== undefined) {
        // Prop from component — always use the prop value from the call site.
        // The prop value already contains the correct Zig expression for the
        // scope where the component was invoked (outer map index, OA field, etc).
        const pv = ctx.propStack[name];
        condParts.push(_condPropValue(pv));
      } else if (ctx.currentMap && name === ctx.currentMap.indexParam) {
        condParts.push('@as(i64, @intCast(_i))');
      } else if (ctx.currentMap && name === ctx.currentMap.itemParam) {
        // Map item parameter: check for .field access (supports multi-level: item.config.theme.bg)
        c.advance();
        if (c.kind() === TK.dot) {
          c.advance();
          if (c.kind() === TK.identifier) {
            let field = c.text(); c.advance();
            // Consume additional dot chains: .config.theme.bg → config_theme_bg
            while (c.kind() === TK.dot && c.pos + 1 < c.count && c.kindAt(c.pos + 1) === TK.identifier) {
              c.advance(); // skip .
              field += '_' + c.text(); c.advance();
            }
            const oa = ctx.currentMap.oa;
            if (oa) {
              condParts.push(`_oa${oa.oaIdx}_${field}[_i]`);
            } else {
              condParts.push('0');
            }
            continue; // already advanced past field
          }
        } else {
          condParts.push('@as(i64, @intCast(_i))');
        }
        // c.advance() handled below
      } else if (ctx.inlineComponent) {
        // Inside inlined component: unresolved identifier is an unprovided prop → falsy (0)
        condParts.push('0');
      } else {
        condParts.push(name);
      }
    } else if (c.kind() === TK.number) {
      // Leading space before numbers after operators (matches reference double-space pattern)
      const lastPart = condParts.length > 0 ? condParts[condParts.length - 1] : '';
      if (lastPart.endsWith(' ')) condParts.push(' ' + c.text());
      else condParts.push(c.text());
    } else if (c.kind() === TK.eq_eq) {
      condParts.push(' == ');
      c.advance();
      if (c.kind() === TK.equals) c.advance(); // === → ==
      continue;
    } else if (c.kind() === TK.not_eq) {
      condParts.push(' != ');
      c.advance();
      if (c.kind() === TK.equals) c.advance(); // !== → !=
      continue;
    } else if (c.kind() === TK.gt_eq) {
      condParts.push(' >= ');
    } else if (c.kind() === TK.lt_eq) {
      condParts.push(' <= ');
    } else if (c.kind() === TK.gt) {
      condParts.push(' > ');
    } else if (c.kind() === TK.lt) {
      // Disambiguate: < followed by number/getter is less-than comparison, not JSX tag open
      if (c.pos + 1 < c.count && (c.kindAt(c.pos + 1) === TK.number || (c.kindAt(c.pos + 1) === TK.identifier && (isGetter(c.textAt(c.pos + 1)) || (ctx.propStack && ctx.propStack[c.textAt(c.pos + 1)] !== undefined))))) {
        condParts.push(' < ');
        c.advance();
        continue;
      }
      break;
    } else if (c.kind() === TK.question) {
      // Ternary — not a conditional, bail
      break;
    } else if (c.kind() === TK.string) {
      // JS string in condition: convert to Zig string comparison
      const sv = c.text().slice(1, -1); // strip quotes
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
  // Didn't find && <JSX> pattern — restore and return false
  c.restore(saved);
  return false;
}

// Resolve string comparisons: lhs == 'str' → std.mem.eql(u8, lhs, "str")
// Also handles runtime string comparisons: slice == getSlotString(N) → std.mem.eql
function _resolveStringComparison(condExpr) {
  // Literal string comparison: lhs == 'str'
  var m = condExpr.match(/^(.+?)\s*==\s*['"]([^'"]+)['"]$/);
  if (m) {
    var lhs = m[1].trim();
    var rhs = m[2];
    if (!lhs.includes('[0..') && /_oa\d+_\w+\[_i\]$/.test(lhs)) {
      var lenField = lhs.replace(/\[_i\]$/, '_lens[_i]');
      lhs = lhs + '[0..' + lenField + ']';
    }
    return 'std.mem.eql(u8, ' + lhs + ', "' + rhs + '")';
  }
  var m2 = condExpr.match(/^(.+?)\s*!=\s*['"]([^'"]+)['"]$/);
  if (m2) {
    var lhs2 = m2[1].trim();
    var rhs2 = m2[2];
    if (!lhs2.includes('[0..') && /_oa\d+_\w+\[_i\]$/.test(lhs2)) {
      var lenField2 = lhs2.replace(/\[_i\]$/, '_lens[_i]');
      lhs2 = lhs2 + '[0..' + lenField2 + ']';
    }
    return '!std.mem.eql(u8, ' + lhs2 + ', "' + rhs2 + '")';
  }
  // Runtime string comparison: stringExpr == stringExpr (both are []const u8)
  var m3 = condExpr.match(/^(.+?)\s*==\s*(.+)$/);
  if (m3) {
    var lhs3 = m3[1].trim();
    var rhs3 = m3[2].trim();
    var lhsIsStr = lhs3.includes('[0..') || lhs3.includes('getSlotString') || lhs3.includes('getString');
    var rhsIsStr = rhs3.includes('[0..') || rhs3.includes('getSlotString') || rhs3.includes('getString');
    if (lhsIsStr || rhsIsStr) {
      return 'std.mem.eql(u8, ' + lhs3 + ', ' + rhs3 + ')';
    }
  }
  return condExpr;
}

// Parse ternary condition tokens until ? is found. Returns condParts array or null.
function _parseTernaryCondParts(c) {
  var condParts = [];
  while (c.kind() !== TK.eof && c.kind() !== TK.rbrace) {
    if (c.kind() === TK.question) { c.advance(); return condParts; }
    if (c.kind() === TK.identifier && c.text() === 'exact') {
      c.advance(); if (c.kind() === TK.equals) c.advance(); // skip 'exact' and optional =
      // Check what follows: string token, getter, or bare string value (quotes stripped by lexer)
      if (c.kind() === TK.string) {
        condParts.push(' == ');
        condParts.push(c.text()); // includes quotes
      } else if (c.kind() === TK.identifier) {
        var rhsName = c.text();
        // Map item/index params are always runtime values
        if (ctx.currentMap && (rhsName === ctx.currentMap.itemParam || rhsName === ctx.currentMap.indexParam)) {
          condParts.push(' == ');
          continue; // don't advance — next iteration handles this identifier
        }
        // Only treat as runtime value if it's a STRING getter or a prop
        // Non-string getters (bool/int) after exact are string literals (quotes stripped by lexer)
        var isRuntimeStr = false;
        if (isGetter(rhsName)) {
          var _si = findSlot(rhsName);
          isRuntimeStr = _si >= 0 && ctx.stateSlots[_si].type === 'string';
        }
        if (isRuntimeStr || (ctx.propStack && ctx.propStack[rhsName] !== undefined)) {
          condParts.push(' == ');
          continue; // don't advance — next iteration handles this identifier
        } else {
          // Bare string value (quotes stripped by lexer) — wrap for _resolveStringComparison
          condParts.push(' == ');
          condParts.push("'" + rhsName + "'");
        }
      } else {
        condParts.push(' == ');
        continue;
      }
      c.advance();
      continue;
    }
    if (c.kind() === TK.identifier) {
      var name = c.text();
      if (isGetter(name)) {
        condParts.push(slotGet(name));
      } else if (ctx.propStack && ctx.propStack[name] !== undefined) {
        var pv = ctx.propStack[name];
        condParts.push(_condPropValue(pv));
      } else if (ctx.currentMap && name === ctx.currentMap.indexParam) {
        condParts.push('@as(i64, @intCast(_i))');
      } else if (ctx.currentMap && name === ctx.currentMap.itemParam) {
        c.advance();
        if (c.kind() === TK.dot) {
          c.advance();
          if (c.kind() === TK.identifier) {
            var field = c.text(); c.advance();
            while (c.kind() === TK.dot && c.pos + 1 < c.count && c.kindAt(c.pos + 1) === TK.identifier) {
              c.advance(); field += '_' + c.text(); c.advance();
            }
            var oa = ctx.currentMap.oa;
            if (oa) {
              var fi2 = oa.fields.find(function(f) { return f.name === field; });
              if (fi2 && fi2.type === 'string') {
                condParts.push('_oa' + oa.oaIdx + '_' + field + '[_i][0.._oa' + oa.oaIdx + '_' + field + '_lens[_i]]');
              } else {
                condParts.push('_oa' + oa.oaIdx + '_' + field + '[_i]');
              }
            } else {
              condParts.push('0');
            }
            continue;
          }
        } else if (ctx.currentMap.isSimpleArray) {
          // Simple array: bare item → string value from _v field
          var oa3 = ctx.currentMap.oa;
          condParts.push('_oa' + oa3.oaIdx + '__v[_i][0.._oa' + oa3.oaIdx + '__v_lens[_i]]');
        } else {
          condParts.push('@as(i64, @intCast(_i))');
        }
        continue;
      } else if (ctx.inlineComponent) {
        condParts.push('0');
      } else {
        condParts.push(name);
      }
    } else if (c.kind() === TK.eq_eq) { condParts.push(' == '); c.advance(); if (c.kind() === TK.equals) c.advance(); continue; }
    else if (c.kind() === TK.not_eq) { condParts.push(' != '); c.advance(); if (c.kind() === TK.equals) c.advance(); continue; }
    else if (c.kind() === TK.number) { condParts.push(c.text()); }
    else if (c.kind() === TK.gt) { condParts.push(' > '); }
    else if (c.kind() === TK.gt_eq) { condParts.push(' >= '); }
    else if (c.kind() === TK.lt_eq) { condParts.push(' <= '); }
    else if (c.kind() === TK.lt) {
      if (c.pos + 1 < c.count && (c.kindAt(c.pos + 1) === TK.number || (c.kindAt(c.pos + 1) === TK.identifier && (isGetter(c.textAt(c.pos + 1)) || (ctx.propStack && ctx.propStack[c.textAt(c.pos + 1)] !== undefined))))) {
        condParts.push(' < ');
        c.advance();
        continue;
      }
      return null; // < is JSX tag, bail
    }
    else { condParts.push(c.text()); }
    c.advance();
  }
  return null; // no ? found
}

// Try to parse {expr ? (<JSX>) : (<JSX>)} ternary JSX branches
// Supports chained ternaries: {a ? <X> : b ? <Y> : <Z>}
function tryParseTernaryJSX(c, children) {
  var saved = c.save();

  // Parse first condition
  var condParts = _parseTernaryCondParts(c);
  if (!condParts) { c.restore(saved); return false; }

  // Parse first true branch
  if (c.kind() === TK.lparen) c.advance();
  if (c.kind() !== TK.lt) { c.restore(saved); return false; }
  var firstBranch = parseJSXElement(c);
  if (c.kind() === TK.rparen) c.advance();
  if (c.kind() !== TK.colon) { c.restore(saved); return false; }
  c.advance();

  // Collect all branches: [{condExpr, branch}, ...]
  var allBranches = [{ condExpr: _resolveStringComparison(condParts.join('')), branch: firstBranch }];

  // Parse remaining branches (chained or final)
  while (true) {
    if (c.kind() === TK.lparen) c.advance();

    // null branch → done (no default)
    if (c.kind() === TK.identifier && c.text() === 'null') {
      c.advance();
      if (c.kind() === TK.rparen) c.advance();
      break;
    }

    // <JSX> → default branch, done
    if (c.kind() === TK.lt) {
      var defaultBranch = parseJSXElement(c);
      if (c.kind() === TK.rparen) c.advance();
      allBranches.push({ condExpr: null, branch: defaultBranch });
      break;
    }

    // Chained ternary: expr ? <JSX> : ...
    var nextCondParts = _parseTernaryCondParts(c);
    if (!nextCondParts) { c.restore(saved); return false; }

    if (c.kind() === TK.lparen) c.advance();
    if (c.kind() !== TK.lt) { c.restore(saved); return false; }
    var nextBranch = parseJSXElement(c);
    if (c.kind() === TK.rparen) c.advance();
    allBranches.push({ condExpr: _resolveStringComparison(nextCondParts.join('')), branch: nextBranch });

    if (c.kind() !== TK.colon) break; // no more chains
    c.advance();
  }

  if (c.kind() === TK.rbrace) c.advance();

  // Generate conditionals based on branch count
  var hasDefault = allBranches.length > 1 && allBranches[allBranches.length - 1].condExpr === null;

  if (allBranches.length === 1) {
    // Single branch with null false → show_hide
    var condIdx = ctx.conditionals.length;
    ctx.conditionals.push({ condExpr: allBranches[0].condExpr, kind: 'show_hide', inMap: !!ctx.currentMap });
    children.push({ nodeExpr: allBranches[0].branch.nodeExpr, condIdx: condIdx, dynBufId: allBranches[0].branch.dynBufId });
  } else if (allBranches.length === 2 && hasDefault) {
    // Simple binary ternary — use existing ternary_jsx for backward compat
    var condExpr = allBranches[0].condExpr;
    var condIdx2 = ctx.conditionals.length;
    ctx.conditionals.push({ condExpr: condExpr, kind: 'ternary_jsx', trueIdx: -1, falseIdx: -1, inMap: !!ctx.currentMap });
    children.push({ nodeExpr: allBranches[0].branch.nodeExpr, ternaryCondIdx: condIdx2, ternaryBranch: 'true', dynBufId: allBranches[0].branch.dynBufId });
    children.push({ nodeExpr: allBranches[1].branch.nodeExpr, ternaryCondIdx: condIdx2, ternaryBranch: 'false', dynBufId: allBranches[1].branch.dynBufId });
  } else {
    // Multi-branch: show_hide with compound conditions
    var resolvedConds = [];
    for (var bi = 0; bi < allBranches.length; bi++) {
      if (allBranches[bi].condExpr !== null) resolvedConds.push(allBranches[bi].condExpr);
    }

    for (var bi2 = 0; bi2 < allBranches.length; bi2++) {
      var compoundExpr;
      if (bi2 === 0) {
        compoundExpr = resolvedConds[0];
      } else if (allBranches[bi2].condExpr === null) {
        // Default branch: show when all prior conditions are false
        var negParts = [];
        for (var ni = 0; ni < resolvedConds.length; ni++) negParts.push('!(' + resolvedConds[ni] + ')');
        compoundExpr = negParts.join(' and ');
      } else {
        // Middle branch: !cond0 and ... and condN
        var parts = [];
        for (var ni2 = 0; ni2 < bi2; ni2++) parts.push('!(' + resolvedConds[ni2] + ')');
        parts.push('(' + resolvedConds[bi2] + ')');
        compoundExpr = parts.join(' and ');
      }
      var branchCondIdx = ctx.conditionals.length;
      ctx.conditionals.push({ condExpr: compoundExpr, kind: 'show_hide', inMap: !!ctx.currentMap });
      children.push({ nodeExpr: allBranches[bi2].branch.nodeExpr, condIdx: branchCondIdx, dynBufId: allBranches[bi2].branch.dynBufId });
    }
  }

  return true;
}

// Try to parse {expr == val ? "a" : "b"} ternary text
function tryParseTernaryText(c, children) {
  // Look ahead for ? ... : pattern
  const saved = c.save();
  // Skip to ? while collecting condition
  let condParts = [];
  let foundQuestion = false;
  while (c.kind() !== TK.eof && c.kind() !== TK.rbrace) {
    if (c.kind() === TK.question) { foundQuestion = true; c.advance(); break; }
    // Bail out if we hit parens, JSX, or arrows — this is not a simple ternary text
    if (c.kind() === TK.lparen || c.kind() === TK.lt || c.kind() === TK.arrow ||
        c.kind() === TK.lbrace) { c.restore(saved); return false; }
    if (c.kind() === TK.identifier) {
      const name = c.text();
      // Check for OA getter followed by .length BEFORE isGetter (OA names aren't in stateSlots)
      const _oa2 = ctx.objectArrays.find(o => o.getter === name);
      if (_oa2 && c.pos + 2 < c.count && c.kindAt(c.pos + 1) === TK.dot && c.textAt(c.pos + 2) === 'length') {
        condParts.push(`_oa${_oa2.oaIdx}_len`);
        c.advance(); // skip name
        c.advance(); // skip .
        c.advance(); // skip length
        continue;
      }
      // exact keyword → == comparison
      if (name === 'exact') {
        condParts.push(' == ');
        c.advance();
        // Skip trailing = for exact== (triple equals style)
        if (c.kind() === TK.equals) c.advance();
        continue;
      }
      if (isGetter(name)) {
        condParts.push(slotGet(name));
      } else if (ctx.currentMap && name === ctx.currentMap.itemParam) {
        // Map item parameter: resolve .field to OA field access
        c.advance();
        if (c.kind() === TK.dot) {
          c.advance();
          if (c.kind() === TK.identifier) {
            let field = c.text(); c.advance();
            // Multi-level dot access: item.config.theme.bg → config_theme_bg
            while (c.kind() === TK.dot && c.pos + 1 < c.count && c.kindAt(c.pos + 1) === TK.identifier) {
              c.advance(); field += '_' + c.text(); c.advance();
            }
            const oa = ctx.currentMap.oa;
            if (oa) {
              condParts.push(`_oa${oa.oaIdx}_${field}[_i]`);
            } else {
              condParts.push('0');
            }
            continue;
          }
        } else {
          condParts.push('@as(i64, @intCast(_i))');
        }
      } else if (ctx.currentMap && name === ctx.currentMap.indexParam) {
        condParts.push('@as(i64, @intCast(_i))');
      } else {
        condParts.push(name);
      }
    } else if (c.kind() === TK.eq_eq) { condParts.push(' == '); c.advance(); if (c.kind() === TK.equals) c.advance(); continue; }
    else if (c.kind() === TK.not_eq) { condParts.push(' != '); c.advance(); if (c.kind() === TK.equals) c.advance(); continue; }
    else if (c.kind() === TK.number) { condParts.push(c.text()); }
    else if (c.kind() === TK.gt) { condParts.push(' > '); }
    else { condParts.push(c.text()); }
    c.advance();
  }
  if (!foundQuestion) { c.restore(saved); return false; }
  // Get true branch value
  let trueVal = '';
  if (c.kind() === TK.string) { trueVal = c.text().slice(1, -1); c.advance(); }
  else { c.restore(saved); return false; }
  // Expect :
  if (c.kind() !== TK.colon) { c.restore(saved); return false; }
  c.advance();
  // Get false branch value
  let falseVal = '';
  if (c.kind() === TK.string) { falseVal = c.text().slice(1, -1); c.advance(); }
  else { c.restore(saved); return false; }
  if (c.kind() === TK.rbrace) c.advance();
  // Ternary text: create dynamic text with conditional format
  var condExpr = condParts.join('');
  // String comparison: lhs == 'str' or lhs == "str" → std.mem.eql(u8, lhs, "str")
  var strEqlMatch = condExpr.match(/^(.+?)\s*==\s*['"]([^'"]+)['"]$/);
  if (strEqlMatch) {
    var lhs = strEqlMatch[1].trim();
    var rhs = strEqlMatch[2];
    // OA string fields need length slicing: field[_i][0..field_lens[_i]]
    if (lhs.includes('[_i]') && lhs.includes('_oa')) {
      var lenField = lhs.replace(/\[_i\]$/, '_lens[_i]');
      condExpr = `std.mem.eql(u8, ${lhs}[0..${lenField}], "${rhs}")`;
    } else if (lhs.includes('getSlotString')) {
      condExpr = `std.mem.eql(u8, ${lhs}, "${rhs}")`;
    } else {
      condExpr = `std.mem.eql(u8, ${lhs}, "${rhs}")`;
    }
  }
  const isComparison = condExpr.includes('==') || condExpr.includes('!=') ||
    condExpr.includes('>=') || condExpr.includes('<=') ||
    condExpr.includes(' > ') || condExpr.includes(' < ') ||
    condExpr.includes('std.mem.eql');
  const isBool = condExpr.includes('getSlotBool');
  const zigCond = (isComparison || isBool) ? `(${condExpr})` : `((${condExpr}) != 0)`;
  const bufId = ctx.dynCount;
  // Use Zig if/else to select the string at runtime
  const fmtArgs = `if ${zigCond} @as([]const u8, "${trueVal}") else @as([]const u8, "${falseVal}")`;
  ctx.dynTexts.push({ bufId, fmtString: '{s}', fmtArgs, arrName: '', arrIndex: 0, bufSize: 64 });
  ctx.dynCount++;
  children.push({ nodeExpr: `.{ .text = "" }`, dynBufId: bufId });
  return true;
}

// ── <For each=X> declarative loop ──
// Syntactic sugar for .map() — parses children as map template.
// <For each=arrayName> ... </For>
// Equivalent to {arrayName.map((item, index) => (...))}

function parseForLoop(c) {
  // Cursor is on 'For' (after '<' was consumed by parseJSXElement caller)
  // Actually, we're called from parseChildren — cursor is on '<' with next = 'For'
  c.advance(); // skip <
  c.advance(); // skip 'For'

  // Parse each=arrayName attribute
  var arrayName = '';
  while (c.kind() !== TK.gt && c.kind() !== TK.slash_gt && c.kind() !== TK.eof) {
    if (c.kind() === TK.identifier && c.text() === 'each') {
      c.advance(); // skip 'each'
      if (c.kind() === TK.equals) c.advance(); // skip '='
      if (c.kind() === TK.identifier) { arrayName = c.text(); c.advance(); }
      else if (c.kind() === TK.string) { arrayName = c.text().slice(1, -1); c.advance(); }
      else if (c.kind() === TK.lbrace) {
        c.advance(); // skip {
        if (c.kind() === TK.identifier) { arrayName = c.text(); c.advance(); }
        // Skip remaining expression tokens until matching }
        var _bd = 1;
        while (_bd > 0 && c.kind() !== TK.eof) {
          if (c.kind() === TK.lbrace) _bd++;
          if (c.kind() === TK.rbrace) { _bd--; if (_bd === 0) break; }
          c.advance();
        }
        if (c.kind() === TK.rbrace) c.advance(); // skip }
      }
    } else {
      c.advance();
    }
  }
  if (c.kind() === TK.gt) c.advance(); // skip >

  if (!arrayName) return null;

  // Find or infer OA for this array
  var oa = ctx.objectArrays.find(function(o) { return o.getter === arrayName; });
  if (!oa) oa = inferOaFromSource(c, arrayName);
  if (!oa) {
    // Try to find OA via computed function body — e.g., visible() returns items.filter(...)
    // Search scriptBlock for the function and see if it references a known OA getter
    if (ctx.scriptBlock) {
      for (var _oi = 0; _oi < ctx.objectArrays.length; _oi++) {
        var _coa = ctx.objectArrays[_oi];
        if (_coa.isNested || _coa.isConst) continue;
        // Check if arrayName's function body references this OA's getter
        var _fnRe = new RegExp('function\\s+' + arrayName + '\\b[^}]*\\b' + _coa.getter + '\\b');
        if (_fnRe.test(ctx.scriptBlock)) {
          oa = _coa; // use the same OA (same fields, same unpack)
          break;
        }
      }
    }
  }
  if (!oa) {
    // Simple (non-object) array — e.g., ['a', 'b', 'c'] or bare name (initially empty)
    // Create synthetic OA with single _v field so the map infrastructure works
    var oaIdx = ctx.objectArrays.length;
    oa = {
      fields: [{ name: '_v', type: 'string' }],
      getter: arrayName,
      setter: 'set_' + arrayName,
      oaIdx: oaIdx,
      isSimpleArray: true,
    };
    ctx.objectArrays.push(oa);
  }

  // Set up map context (same as tryParseMap)
  var savedMapCtx = ctx.currentMap;
  var mapIdx = ctx.maps.length;
  var isInline = !!(savedMapCtx && savedMapCtx.oaIdx !== oa.oaIdx);
  var mapInfo = {
    oaIdx: oa.oaIdx, itemParam: 'item', indexParam: 'index',
    oa: oa, textsInMap: [], innerCount: 0, parentArr: '', childIdx: 0,
    mapArrayDecls: [], mapArrayComments: [],
    parentMap: savedMapCtx,
    isInline: isInline,
    isSimpleArray: !!oa.isSimpleArray,
  };
  ctx.maps.push(mapInfo);
  ctx.currentMap = mapInfo;

  var savedArrayDecls = ctx.arrayDecls;
  var savedArrayComments = ctx.arrayComments;
  mapInfo._topArrayDecls = savedArrayDecls;
  mapInfo._topArrayComments = savedArrayComments;
  ctx.arrayDecls = mapInfo.mapArrayDecls;
  ctx.arrayComments = mapInfo.mapArrayComments;

  // Parse template — JSX element, or {expr} (wrap in synthetic Box if bare expression)
  var templateNode;
  if (c.kind() === TK.lbrace) {
    // Bare {expr} template — parse children within map context, wrap in Box
    var templateChildren = parseChildren(c);
    var parts = [];
    if (templateChildren.length > 0) {
      var arrName = '_arr_' + ctx.arrayCounter++;
      var childDecls = [];
      for (var ti = 0; ti < templateChildren.length; ti++) {
        childDecls.push(templateChildren[ti].nodeExpr);
        if (templateChildren[ti].condIdx !== undefined) {
          var tc = ctx.conditionals[templateChildren[ti].condIdx];
          if (tc) { tc.arrName = arrName; tc.trueIdx = ti; }
        }
        if (templateChildren[ti].ternaryCondIdx !== undefined) {
          var tc2 = ctx.conditionals[templateChildren[ti].ternaryCondIdx];
          if (tc2) {
            tc2.arrName = arrName;
            if (templateChildren[ti].ternaryBranch === 'true') tc2.trueIdx = ti;
            else tc2.falseIdx = ti;
          }
        }
        if (templateChildren[ti].dynBufId !== undefined) {
          var dt = ctx.dynTexts.find(function(d) { return d.bufId === templateChildren[ti].dynBufId; });
          if (dt && !dt.arrName) { dt.arrName = arrName; dt.arrIndex = ti; }
        }
      }
      ctx.arrayDecls.push('var ' + arrName + ' = [_]Node{ ' + childDecls.join(', ') + ' };');
      parts.push('.children = &' + arrName);
    }
    templateNode = { nodeExpr: '.{ ' + parts.join(', ') + ' }' };
  } else {
    templateNode = parseJSXElement(c);
  }

  // Restore array context
  ctx.arrayDecls = savedArrayDecls;
  ctx.arrayComments = savedArrayComments;
  ctx.currentMap = savedMapCtx;

  // Consume </For>
  if (c.kind() === TK.lt_slash) {
    c.advance(); // </
    if (c.kind() === TK.identifier && c.text() === 'For') c.advance();
    if (c.kind() === TK.gt) c.advance();
  }

  // Finalize map info
  mapInfo.templateExpr = templateNode.nodeExpr;

  return { nodeExpr: '.{}', mapIdx: mapIdx };
}

// ── Utility functions ──

function skipBraces(c) {
  let depth = 1; c.advance();
  while (depth > 0 && c.kind() !== TK.eof) {
    if (c.kind() === TK.lbrace) depth++;
    if (c.kind() === TK.rbrace) depth--;
    if (depth > 0) c.advance();
  }
  if (c.kind() === TK.rbrace) c.advance();
}

function offsetToLine(source, offset) {
  let line = 1;
  for (let i = 0; i < offset && i < source.length; i++) {
    if (source[i] === '\n') line++;
  }
  return line;
}

