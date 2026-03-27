// ── JSX parser ──

function resolveTag(name) { return htmlTags[name] || name; }

function parseJSXElement(c) {
  if (c.kind() !== TK.lt) return { nodeExpr: '.{}' };
  c.advance(); // <

  // Fragment: <>
  if (c.kind() === TK.gt) {
    const fragOffset = c.starts[c.pos > 0 ? c.pos - 1 : 0];
    c.advance();
    const children = parseChildren(c);
    if (c.kind() === TK.lt_slash) { c.advance(); if (c.kind() === TK.gt) c.advance(); }
    return buildNode('Box', [], children, null, null, '>', fragOffset);
  }

  const rawTag = c.text();
  c.advance();

  // Check if this is a component call
  const comp = findComponent(rawTag);
  if (comp) {
    // Collect prop values from call site attributes
    const propValues = {};
    while (c.kind() !== TK.gt && c.kind() !== TK.slash_gt && c.kind() !== TK.eof) {
      if (c.kind() === TK.identifier) {
        const attr = c.text(); c.advance();
        if (c.kind() === TK.equals) {
          c.advance();
          if (c.kind() === TK.string) {
            propValues[attr] = c.text().slice(1, -1); // strip quotes
            c.advance();
          } else if (c.kind() === TK.lbrace) {
            // {expr} prop value — resolve map item access, state getters, etc.
            c.advance();
            // Check for map item member access: item.field
            if (ctx.currentMap && c.kind() === TK.identifier && c.text() === ctx.currentMap.itemParam) {
              c.advance(); // skip item name
              if (c.kind() === TK.dot) {
                c.advance(); // skip .
                if (c.kind() === TK.identifier) {
                  const field = c.text();
                  const oa = ctx.currentMap.oa;
                  const fi = oa.fields.find(ff => ff.name === field);
                  if (fi && fi.type === 'string') {
                    propValues[attr] = `_oa${oa.oaIdx}_${field}[_i][0.._oa${oa.oaIdx}_${field}_lens[_i]]`;
                  } else {
                    propValues[attr] = `_oa${oa.oaIdx}_${field}[_i]`;
                  }
                  c.advance();
                  if (c.kind() === TK.rbrace) c.advance();
                  continue;
                }
              }
            }
            // Fallback: collect tokens as string
            let val = '';
            let depth = 0;
            while (c.kind() !== TK.eof) {
              if (c.kind() === TK.lbrace) depth++;
              if (c.kind() === TK.rbrace) { if (depth === 0) break; depth--; }
              if (c.kind() === TK.identifier && isGetter(c.text())) val += slotGet(c.text());
              else if (c.kind() === TK.identifier && ctx.currentMap && c.text() === ctx.currentMap.indexParam) val += '@as(i64, @intCast(_i))';
              else val += c.text();
              c.advance();
            }
            if (c.kind() === TK.rbrace) c.advance();
            propValues[attr] = val;
          }
        }
      } else { c.advance(); }
    }
    // Collect component children: <Comp>...children...</Comp>
    let compChildren = null;
    if (c.kind() === TK.slash_gt) c.advance();
    else if (c.kind() === TK.gt) {
      c.advance();
      // Parse children at the CALL SITE (not inside the component body)
      compChildren = parseChildren(c);
      if (c.kind() === TK.lt_slash) { c.advance(); if (c.kind() === TK.identifier) c.advance(); if (c.kind() === TK.gt) c.advance(); }
    }

    // Inline: save state, jump to component body, parse with prop substitution
    // Component arrays always go to top-level (even inside map templates)
    const savedPos = c.save();
    const savedProps = ctx.propStack;
    const savedInline = ctx.inlineComponent;
    const savedChildren = ctx.componentChildren;
    const savedMapCtx = ctx.currentMap;
    const savedArrayDecls = ctx.arrayDecls;
    const savedArrayComments = ctx.arrayComments;
    // Track initial lengths to detect new arrays created during inlining
    const savedArrayDeclsLen = savedArrayDecls.length;
    const savedArrayCommentsLen = savedArrayComments.length;
    if (ctx.currentMap) {
      // Restore to top-level arrays during component inlining
      // Keep currentMap active so item member access (n.title) resolves
      ctx.arrayDecls = ctx.currentMap._topArrayDecls || ctx.arrayDecls;
      ctx.arrayComments = ctx.currentMap._topArrayComments || ctx.arrayComments;
    }
    ctx.propStack = propValues;
    ctx.inlineComponent = rawTag;
    ctx.componentChildren = compChildren;
    // Allocate fresh state slots for this component instance
    const savedSlotRemap = ctx.slotRemap || {};
    const instanceSlotRemap = {};
    for (const cs of (comp.stateSlots || [])) {
      const newIdx = ctx.stateSlots.length;
      ctx.stateSlots.push({ getter: cs.getter, setter: cs.setter, initial: cs.initial, type: cs.type });
      instanceSlotRemap[cs.getter] = newIdx;
      instanceSlotRemap[cs.setter] = newIdx;
    }
    ctx.slotRemap = Object.assign({}, savedSlotRemap, instanceSlotRemap);
    c.pos = comp.bodyPos;
    let result;
    // Check if component returns a map expression (not JSX)
    if (c.kind() === TK.identifier) {
      const maybeArr = c.text();
      const oa = ctx.objectArrays.find(o => o.getter === maybeArr);
      if (oa) {
        result = tryParseMap(c, oa);
        // Skip trailing ) ) ; if present
        while (c.kind() === TK.rparen || c.kind() === TK.semicolon) c.advance();
      }
      if (!result) result = { nodeExpr: '.{}' };
    } else {
      result = parseJSXElement(c);
    }
    // Preserve arrays created during component inlining inside maps
    // Component arrays created inside a map go to the parent (topArrayDecls)
    // We need to append them to the map's own mapArrayDecls to keep them
    if (ctx.currentMap && ctx.arrayDecls.length > savedArrayDeclsLen) {
      const newArrayDecls = ctx.arrayDecls.slice(savedArrayDeclsLen);
      const newArrayComments = ctx.arrayComments.slice(savedArrayCommentsLen);
      // Append new arrays to the map's mapArrayDecls
      ctx.currentMap.mapArrayDecls.push(...newArrayDecls);
      ctx.currentMap.mapArrayComments.push(...newArrayComments);
    }
    ctx.propStack = savedProps;
    ctx.inlineComponent = savedInline;
    ctx.componentChildren = savedChildren;
    ctx.currentMap = savedMapCtx;
    ctx.arrayDecls = savedArrayDecls;
    ctx.arrayComments = savedArrayComments;
    ctx.slotRemap = savedSlotRemap;
    c.restore(savedPos);
    return result;
  }

  const tag = resolveTag(rawTag);
  // Track source position for breadcrumb comments
  const tagSrcOffset = c.starts[c.pos > 0 ? c.pos - 1 : 0];

  // Parse attributes
  let styleFields = [];
  let nodeFields = []; // direct node fields (font_size, text_color, etc.)
  let handlerRef = null;

  while (c.kind() !== TK.gt && c.kind() !== TK.slash_gt && c.kind() !== TK.eof) {
    if (c.kind() === TK.identifier) {
      const attr = c.text();
      c.advance();
      if (c.kind() === TK.equals) {
        c.advance();
        if (attr === 'style') {
          styleFields = parseStyleBlock(c);
        } else if (attr === 'onPress' || attr === 'onTap' || attr === 'onToggle' || attr === 'onSelect' || attr === 'onChange') {
          if (c.kind() === TK.lbrace) {
            c.advance(); // {
            // Named handler reference: onPress={functionName}
            if (c.kind() === TK.identifier && (isScriptFunc(c.text()) || isSetter(c.text()))) {
              const fname = c.text();
              c.advance();
              // Script function — call via QuickJS (not Lua, since <script> is JS)
              const handlerName = `_handler_press_${ctx.handlerCount}`;
              if (isScriptFunc(fname)) {
                ctx.handlers.push({ name: handlerName, body: `    qjs_runtime.callGlobal("${fname}");\n` });
              } else {
                const luaBody = fname;
                ctx.handlers.push({ name: handlerName, body: `    // ${fname}\n`, luaBody });
              }
              handlerRef = handlerName;
              ctx.handlerCount++;
              // Skip optional () after function name
              if (c.kind() === TK.lparen) { c.advance(); if (c.kind() === TK.rparen) c.advance(); }
              if (c.kind() === TK.rbrace) c.advance();
            } else {
              // Inline handler: () => { ... }
              // Parse Lua body first (save/restore), then Zig body
              const handlerName = `_handler_press_${ctx.handlerCount}`;
              const saved = c.save();
              const luaBody = luaParseHandler(c);
              c.restore(saved);
              const body = parseHandler(c);
              const isMapHandler = !!ctx.currentMap;
              ctx.handlers.push({ name: handlerName, body, luaBody, inMap: isMapHandler, mapIdx: isMapHandler ? ctx.maps.indexOf(ctx.currentMap) : -1 });
              handlerRef = handlerName;
              ctx.handlerCount++;
              if (c.kind() === TK.rbrace) c.advance(); // }
            }
          }
        } else if (attr === 'fontSize') {
          // fontSize={N} or fontSize="N" → .font_size = N
          if (c.kind() === TK.lbrace) {
            c.advance();
            if (c.kind() === TK.number) { nodeFields.push(`.font_size = ${c.text()}`); c.advance(); }
            if (c.kind() === TK.rbrace) c.advance();
          } else if (c.kind() === TK.number) { nodeFields.push(`.font_size = ${c.text()}`); c.advance(); }
          else if (c.kind() === TK.string) { nodeFields.push(`.font_size = ${c.text().slice(1,-1)}`); c.advance(); }
        } else if (attr === 'color') {
          // color="#hex" or color={propName} → .text_color = Color.rgb(...)
          if (c.kind() === TK.string) {
            const val = c.text().slice(1, -1);
            nodeFields.push(`.text_color = ${parseColor(val)}`);
            c.advance();
          } else if (c.kind() === TK.lbrace) {
            c.advance();
            if (c.kind() === TK.identifier) {
              const propName = c.text(); c.advance();
              // Check for ternary: getter == N ? "#color1" : "#color2"
              if (isGetter(propName) && (c.kind() === TK.eq_eq || c.kind() === TK.not_eq || c.kind() === TK.gt || c.kind() === TK.lt || c.kind() === TK.gt_eq || c.kind() === TK.lt_eq)) {
                const op = c.kind() === TK.eq_eq ? '==' : c.kind() === TK.not_eq ? '!=' : c.text();
                c.advance();
                if (op === '==' && c.kind() === TK.equals) c.advance();
                let rhs = '';
                if (c.kind() === TK.number) { rhs = c.text(); c.advance(); }
                else if (c.kind() === TK.identifier) { const n = c.text(); c.advance(); rhs = isGetter(n) ? slotGet(n) : (ctx.propStack && ctx.propStack[n] !== undefined ? ctx.propStack[n] : n); }
                if (c.kind() === TK.question) {
                  c.advance();
                  const tv = parseTernaryBranch(c, 'color');
                  if (c.kind() === TK.colon) c.advance();
                  const fv = parseTernaryBranch(c, 'color');
                  const cond = `(${slotGet(propName)} ${op} ${rhs})`;
                  const resolveC = (v) => v.type === 'zig_expr' ? v.zigExpr : v.type === 'string' ? parseColor(v.value) : 'Color{}';
                  const colorExpr = `if ${cond} ${resolveC(tv)} else ${resolveC(fv)}`;
                  nodeFields.push(`.text_color = Color.rgb(0, 0, 0)`);
                  if (!ctx.dynStyles) ctx.dynStyles = [];
                  const dsId = ctx.dynStyles.length;
                  ctx.dynStyles.push({ field: 'text_color', expression: colorExpr, arrName: '', arrIndex: -1, isColor: true });
                  if (!nodeFields._dynStyleIds) nodeFields._dynStyleIds = [];
                  nodeFields._dynStyleIds.push(dsId);
                } else {
                  nodeFields.push(`.text_color = Color.rgb(0, 0, 0)`);
                }
              } else {
                nodeFields.push(`.text_color = Color.rgb(0, 0, 0)`);
                const propVal = ctx.propStack && ctx.propStack[propName];
                if (propVal && typeof propVal === 'string' && propVal.startsWith('#')) {
                  const dcId = ctx.dynColors.length;
                  ctx.dynColors.push({ dcId, arrName: '', arrIndex: -1, colorExpr: parseColor(propVal) });
                  nodeFields._dynColorId = dcId;
                }
              }
            }
            if (c.kind() === TK.rbrace) c.advance();
          }
        } else {
          // Skip unknown attributes
          if (c.kind() === TK.string) c.advance();
          else if (c.kind() === TK.lbrace) { skipBraces(c); }
        }
      }
    } else { c.advance(); }
  }

  // Self-closing: />
  if (c.kind() === TK.slash_gt) {
    c.advance();
    return buildNode(tag, styleFields, [], handlerRef, nodeFields, tag, tagSrcOffset);
  }
  if (c.kind() === TK.gt) c.advance();

  const children = parseChildren(c);

  // </Tag>
  if (c.kind() === TK.lt_slash) {
    c.advance();
    if (c.kind() === TK.identifier) c.advance();
    if (c.kind() === TK.gt) c.advance();
  }

  return buildNode(tag, styleFields, children, handlerRef, nodeFields, tag, tagSrcOffset);
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
  const mapInfo = {
    oaIdx: oa.oaIdx, itemParam, indexParam,
    oa, textsInMap: [], innerCount: 0, parentArr: '', childIdx: 0,
    mapArrayDecls: [], mapArrayComments: [],
    parentMap: savedMapCtx,  // track parent map for nested context
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

// Check if an identifier is a map item member access (item.field)
function isMapItemAccess(name) {
  if (!ctx.currentMap) return null;
  if (name === ctx.currentMap.itemParam) return ctx.currentMap;
  return null;
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
        ctx.conditionals.push({ condExpr, kind: 'show_hide' });
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
    if (c.kind() === TK.identifier) {
      const name = c.text();
      if (isGetter(name)) {
        condParts.push(slotGet(name));
      } else if (ctx.propStack && ctx.propStack[name] !== undefined) {
        // Prop from component — if we're in a map and prop name matches an OA field, use OA access
        if (ctx.currentMap && ctx.currentMap.oa) {
          const fi = ctx.currentMap.oa.fields.find(f => f.name === name);
          if (fi) {
            condParts.push(`_oa${ctx.currentMap.oa.oaIdx}_${name}[_i]`);
          } else {
            condParts.push(ctx.propStack[name]);
          }
        } else {
          condParts.push(ctx.propStack[name]);
        }
      } else if (ctx.currentMap && name === ctx.currentMap.indexParam) {
        condParts.push('@as(i64, @intCast(_i))');
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
      // Could be < operator or start of JSX — if no && seen yet, it's not a conditional
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

// Try to parse {expr ? (<JSX>) : (<JSX>)} ternary JSX branches
function tryParseTernaryJSX(c, children) {
  const saved = c.save();
  let condParts = [];
  let foundQuestion = false;
  while (c.kind() !== TK.eof && c.kind() !== TK.rbrace) {
    if (c.kind() === TK.question) { foundQuestion = true; c.advance(); break; }
    if (c.kind() === TK.identifier) {
      const name = c.text();
      if (isGetter(name)) {
        condParts.push(slotGet(name));
      } else if (ctx.propStack && ctx.propStack[name] !== undefined) {
        if (ctx.currentMap && ctx.currentMap.oa) {
          const fi = ctx.currentMap.oa.fields.find(f => f.name === name);
          if (fi) {
            condParts.push(`_oa${ctx.currentMap.oa.oaIdx}_${name}[_i]`);
          } else {
            condParts.push(ctx.propStack[name]);
          }
        } else {
          condParts.push(ctx.propStack[name]);
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
    else if (c.kind() === TK.lt) { break; }
    else { condParts.push(c.text()); }
    c.advance();
  }
  if (!foundQuestion) { c.restore(saved); return false; }
  // Check for JSX branches: ? ( <JSX> ) : ( <JSX> )
  if (c.kind() !== TK.lparen) { c.restore(saved); return false; }
  c.advance();
  if (c.kind() !== TK.lt) { c.restore(saved); return false; }
  const trueBranch = parseJSXElement(c);
  if (c.kind() === TK.rparen) c.advance();
  if (c.kind() !== TK.colon) { c.restore(saved); return false; }
  c.advance();
  if (c.kind() !== TK.lparen) { c.restore(saved); return false; }
  c.advance();
  if (c.kind() !== TK.lt) { c.restore(saved); return false; }
  const falseBranch = parseJSXElement(c);
  if (c.kind() === TK.rparen) c.advance();
  if (c.kind() === TK.rbrace) c.advance();
  const condExpr = condParts.join('');
  const condIdx = ctx.conditionals.length;
  ctx.conditionals.push({ condExpr, kind: 'ternary_jsx', trueIdx: -1, falseIdx: -1 });
  children.push({ nodeExpr: trueBranch.nodeExpr, ternaryCondIdx: condIdx, ternaryBranch: 'true', dynBufId: trueBranch.dynBufId });
  children.push({ nodeExpr: falseBranch.nodeExpr, ternaryCondIdx: condIdx, ternaryBranch: 'false', dynBufId: falseBranch.dynBufId });
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
    if (c.kind() === TK.identifier) {
      const name = c.text();
      condParts.push(isGetter(name) ? slotGet(name) : name);
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
  const condExpr = condParts.join('');
  const isComparison = condExpr.includes('==') || condExpr.includes('!=') ||
    condExpr.includes('>=') || condExpr.includes('<=') ||
    condExpr.includes(' > ') || condExpr.includes(' < ');
  const zigCond = isComparison ? `(${condExpr})` : `((${condExpr}) != 0)`;
  const bufId = ctx.dynCount;
  // Use Zig if/else to select the string at runtime
  const fmtArgs = `if ${zigCond} @as([]const u8, "${trueVal}") else @as([]const u8, "${falseVal}")`;
  ctx.dynTexts.push({ bufId, fmtString: '{s}', fmtArgs, arrName: '', arrIndex: 0, bufSize: 64 });
  ctx.dynCount++;
  children.push({ nodeExpr: `.{ .text = "" }`, dynBufId: bufId });
  return true;
}

function parseChildren(c) {
  const children = [];
  while (c.kind() !== TK.lt_slash && c.kind() !== TK.eof) {
    if (c.kind() === TK.lt) {
      children.push(parseJSXElement(c));
    } else if (c.kind() === TK.lbrace) {
      c.advance();
      // Try conditional: {expr && <JSX>} or {expr != val && <JSX>}
      const condResult = tryParseConditional(c, children);
      if (condResult) continue;
      // Try ternary JSX: {expr ? (<JSX>) : (<JSX>)}
      const ternJSXResult = tryParseTernaryJSX(c, children);
      if (ternJSXResult) continue;
      // Map: {items.map((item, i) => (...))}
      if (c.kind() === TK.identifier) {
        const maybeArr = c.text();
        const oa = ctx.objectArrays.find(o => o.getter === maybeArr);
        if (oa && c.pos + 1 < c.count && c.kindAt(c.pos + 1) === TK.dot) {
          const mapResult = tryParseMap(c, oa);
          if (mapResult) {
            children.push(mapResult);
            if (c.kind() === TK.rbrace) c.advance();
            continue;
          }
        }
        // Nested map: {group.items.map(...)} inside an outer .map()
        if (ctx.currentMap && maybeArr === ctx.currentMap.itemParam &&
            c.pos + 3 < c.count && c.kindAt(c.pos + 1) === TK.dot) {
          const saved2 = c.save();
          c.advance(); // skip item param
          c.advance(); // skip .
          if (c.kind() === TK.identifier) {
            const nestedField = c.text();
            // Find nested OA for this field
            const parentOa = ctx.currentMap.oa;
            const nestedFieldInfo = parentOa.fields.find(f => f.type === 'nested_array' && f.name === nestedField);
            if (nestedFieldInfo && c.pos + 1 < c.count && c.kindAt(c.pos + 1) === TK.dot) {
              const nestedOa = ctx.objectArrays.find(o => o.oaIdx === nestedFieldInfo.nestedOaIdx);
              if (nestedOa) {
                const mapResult = tryParseNestedMap(c, nestedOa, nestedField);
                if (mapResult) {
                  children.push(mapResult);
                  if (c.kind() === TK.rbrace) c.advance();
                  continue;
                }
              }
            }
          }
          c.restore(saved2);
        }
      }
      // Template literal: {`text ${expr}`}
      if (c.kind() === TK.template_literal) {
        const raw = c.text().slice(1, -1); // strip backticks
        c.advance();
        if (c.kind() === TK.rbrace) c.advance();
        // Parse template: split on ${...} and build fmt string + args
        const { fmt, args } = parseTemplateLiteral(raw);
        if (args.length > 0) {
          // Check if this template references map data (inside a .map() template)
          const isMapTemplate = ctx.currentMap && args.some(a => a.includes('_oa') || a.includes('_i'));
          if (isMapTemplate) {
            const mapBufId = ctx.mapDynCount || 0;
            ctx.mapDynCount = mapBufId + 1;
            ctx.dynTexts.push({ bufId: mapBufId, fmtString: fmt, fmtArgs: args.join(', '), arrName: '', arrIndex: 0, bufSize: 256, inMap: true, mapIdx: ctx.maps.indexOf(ctx.currentMap) });
            children.push({ nodeExpr: `.{ .text = "" }`, dynBufId: mapBufId, inMap: true });
          } else {
            const bufId = ctx.dynCount;
            // Buffer size: for bare `${expr}` use 64, otherwise formula
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
        continue;
      }
      // Map item access: {item.field} inside a .map()
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
            // Create dynamic text for this map item field
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
            children.push({ nodeExpr: `.{ .text = "" }`, dynBufId: mapBufId, inMap: true });
            continue;
          }
        }
      }
      // {children} splice — insert component children
      if (c.kind() === TK.identifier && c.text() === 'children' && ctx.componentChildren) {
        c.advance();
        if (c.kind() === TK.rbrace) c.advance();
        for (const ch of ctx.componentChildren) children.push(ch);
        continue;
      }
      // {expr} — check props first, then state getters
      if (c.kind() === TK.identifier && ctx.propStack[c.text()] !== undefined) {
        // Prop substitution — replace {propName} with the prop value as static text
        const propVal = ctx.propStack[c.text()];
        c.advance();
        if (c.kind() === TK.rbrace) c.advance();
        children.push({ nodeExpr: `.{ .text = "${propVal}" }` });
      } else if (c.kind() === TK.identifier && isGetter(c.text())) {
        const getter = c.text();
        const slotIdx = findSlot(getter);
        const bufId = ctx.dynCount;
        const slot = ctx.stateSlots[slotIdx];
        const fmt = slot.type === 'string' ? '{s}' : slot.type === 'float' ? '{d:.2}' : '{d}';
        const bufSize = slot.type === 'string' ? 128 : 64;
        const args = slotGet(getter);
        ctx.dynTexts.push({ bufId, fmtString: fmt, fmtArgs: args, arrName: '', arrIndex: 0, bufSize });
        ctx.dynCount++;
        c.advance();
        // Consume remaining expression tokens until closing brace
        let _bd = 0;
        while (c.kind() !== TK.eof) {
          if (c.kind() === TK.lbrace) _bd++;
          if (c.kind() === TK.rbrace) { if (_bd === 0) break; _bd--; }
          c.advance();
        }
        if (c.kind() === TK.rbrace) c.advance();
        // Placeholder node — text will be set by _updateDynamicTexts
        children.push({ nodeExpr: '.{ .text = "" }', dynBufId: bufId });
      } else {
        // Skip unknown expression
        let depth = 1;
        while (depth > 0 && c.kind() !== TK.eof) {
          if (c.kind() === TK.lbrace) depth++;
          if (c.kind() === TK.rbrace) depth--;
          if (depth > 0) c.advance();
        }
        if (c.kind() === TK.rbrace) c.advance();
      }
    } else if (c.kind() === TK.comment) {
      // Skip block comments in JSX children
      c.advance();
    } else if (c.kind() !== TK.rbrace) {
      // Text content — use raw source between first and last token to preserve apostrophes etc
      const textStart = c.starts[c.pos];
      let textEnd = textStart;
      while (c.kind() !== TK.lt && c.kind() !== TK.lt_slash && c.kind() !== TK.lbrace && c.kind() !== TK.eof && c.kind() !== TK.rbrace) {
        textEnd = c.ends[c.pos];
        c.advance();
      }
      const text = c._byteSlice(textStart, textEnd).trim();
      if (text.trim()) children.push({ nodeExpr: `.{ .text = "${text.trim().replace(/"/g, '\\"')}" }` });
    } else { c.advance(); }
  }
  return children;
}

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

function buildNode(tag, styleFields, children, handlerRef, nodeFields, srcTag, srcOffset) {
  const parts = [];
  if (styleFields.length > 0) parts.push(`.style = .{ ${styleFields.join(', ')} }`);

  // For Text nodes: if ANY child has a dynamic text, hoist it to the Text node
  // and drop all static text siblings (matches reference compiler behavior)
  if (tag === 'Text') {
    const dynChild = children.find(ch => ch.dynBufId !== undefined);
    if (dynChild) {
      parts.push(`.text = ""`);
      if (nodeFields) for (const nf of nodeFields) parts.push(nf);
      children = [];
      const expr = `.{ ${parts.join(', ')} }`;
      const result = { nodeExpr: expr, dynBufId: dynChild.dynBufId };
      if (dynChild.inMap) result.inMap = true;
      if (nodeFields && nodeFields._dynColorId !== undefined) result.dynColorId = nodeFields._dynColorId;
      return result;
    }
    // Single static text child — hoist to .text field
    if (children.length === 1 && children[0].nodeExpr && children[0].nodeExpr.includes('.text =')) {
      const m = children[0].nodeExpr.match(/\.text = "(.*)"/);
      if (m) { parts.push(`.text = "${m[1]}"`); children = []; }
    }
  }

  // Node-level fields (font_size, text_color) — after text for correct field order
  if (nodeFields && nodeFields.length > 0) {
    for (const nf of nodeFields) parts.push(nf);
  }

  if (handlerRef) {
    // Look up the handler's Lua body for lua_on_press
    const handler = ctx.handlers.find(h => h.name === handlerRef);
    if (handler && handler.luaBody && !handler.body.includes('qjs_runtime.') && !ctx.scriptBlock) {
      const escaped = handler.luaBody.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
      parts.push(`.handlers = .{ .lua_on_press = "${escaped}" }`);
    } else {
      parts.push(`.handlers = .{ .on_press = ${handlerRef} }`);
    }
  }

  if (children.length > 0) {
    const arrName = `_arr_${ctx.arrayCounter}`;
    ctx.arrayCounter++;
    // Transfer parent gap style to map placeholder children
    const gapField = styleFields.find(f => f.startsWith('.gap'));
    for (let ci = 0; ci < children.length; ci++) {
      if (children[ci].mapIdx !== undefined && gapField && children[ci].nodeExpr === '.{}') {
        children[ci].nodeExpr = `.{ .style = .{ ${gapField} } }`;
      }
    }
    const childExprs = children.map(ch => ch.nodeExpr || ch).join(', ');
    // Source breadcrumb comment
    if (srcTag && srcOffset !== undefined) {
      const line = offsetToLine(globalThis.__source, srcOffset);
      const fname = (globalThis.__file || '').split('/').pop();
      const tagDisplay = srcTag === '>' ? '<>' : `<${srcTag}>`;
      ctx.arrayComments.push(`// tsz:${fname}:${line} \u2014 ${tagDisplay}`);
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
        if (dt) { dt.arrName = arrName; dt.arrIndex = i; }
      }
      if (children[i].mapIdx !== undefined) {
        const m = ctx.maps[children[i].mapIdx];
        if (m) { m.parentArr = arrName; m.childIdx = i; }
      }
      if (children[i].condIdx !== undefined) {
        const cond = ctx.conditionals[children[i].condIdx];
        if (cond) { cond.arrName = arrName; cond.trueIdx = i; }
      }
      if (children[i].dynColorId !== undefined) {
        const dc = ctx.dynColors[children[i].dynColorId];
        if (dc) { dc.arrName = arrName; dc.arrIndex = i; }
      }
      if (children[i].dynStyleId !== undefined) {
        const ds = ctx.dynStyles[children[i].dynStyleId];
        if (ds) { ds.arrName = arrName; ds.arrIndex = i; }
      }
      if (children[i].dynStyleIds) {
        for (const dsId of children[i].dynStyleIds) {
          const ds = ctx.dynStyles[dsId];
          if (ds) { ds.arrName = arrName; ds.arrIndex = i; }
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
    }
    parts.push(`.children = &${arrName}`);
  }

  const nodeResult = { nodeExpr: `.{ ${parts.join(', ')} }` };
  if (nodeFields && nodeFields._dynColorId !== undefined) nodeResult.dynColorId = nodeFields._dynColorId;
  if (styleFields._dynStyleId !== undefined) nodeResult.dynStyleId = styleFields._dynStyleId;
  // Merge dynStyleIds from both style block and node field ternaries
  const allDynIds = [...(styleFields._dynStyleIds || []), ...((nodeFields && nodeFields._dynStyleIds) || [])];
  if (allDynIds.length > 0) nodeResult.dynStyleIds = allDynIds;
  return nodeResult;
}

