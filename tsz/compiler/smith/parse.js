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
            // {expr} prop value — collect tokens as string
            c.advance();
            let val = '';
            let depth = 0;
            while (c.kind() !== TK.eof) {
              if (c.kind() === TK.lbrace) depth++;
              if (c.kind() === TK.rbrace) { if (depth === 0) break; depth--; }
              val += c.text();
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
    const savedPos = c.save();
    const savedProps = ctx.propStack;
    const savedInline = ctx.inlineComponent;
    const savedChildren = ctx.componentChildren;
    ctx.propStack = propValues;
    ctx.inlineComponent = rawTag;
    ctx.componentChildren = compChildren;
    c.pos = comp.bodyPos;
    const result = parseJSXElement(c);
    ctx.propStack = savedProps;
    ctx.inlineComponent = savedInline;
    ctx.componentChildren = savedChildren;
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
        } else if (attr === 'onPress') {
          if (c.kind() === TK.lbrace) {
            c.advance(); // {
            // Named handler reference: onPress={functionName}
            if (c.kind() === TK.identifier && (isScriptFunc(c.text()) || isSetter(c.text()))) {
              const fname = c.text();
              c.advance();
              // Script function — call via qjs_runtime.callGlobal
              const handlerName = `_handler_press_${ctx.handlerCount}`;
              if (isScriptFunc(fname)) {
                ctx.handlers.push({ name: handlerName, body: `    qjs_runtime.callGlobal("${fname}");\n` });
              } else {
                // Direct setter reference without args — shouldn't normally happen
                ctx.handlers.push({ name: handlerName, body: `    // ${fname}\n` });
              }
              handlerRef = handlerName;
              ctx.handlerCount++;
              // Skip optional () after function name
              if (c.kind() === TK.lparen) { c.advance(); if (c.kind() === TK.rparen) c.advance(); }
              if (c.kind() === TK.rbrace) c.advance();
            } else {
              // Inline handler: () => { ... }
              const handlerName = `_handler_press_${ctx.handlerCount}`;
              const body = parseHandler(c);
              ctx.handlers.push({ name: handlerName, body });
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
            // color={expr} — in component context, prop color values don't resolve
            // (reference compiler behavior: brace-expr color defaults to black)
            if (c.kind() === TK.identifier) {
              nodeFields.push(`.text_color = Color.rgb(0, 0, 0)`);
              c.advance();
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
    return buildNode(tag, styleFields, [], handlerRef, nodeFields, rawTag, tagSrcOffset);
  }
  if (c.kind() === TK.gt) c.advance();

  const children = parseChildren(c);

  // </Tag>
  if (c.kind() === TK.lt_slash) {
    c.advance();
    if (c.kind() === TK.identifier) c.advance();
    if (c.kind() === TK.gt) c.advance();
  }

  return buildNode(tag, styleFields, children, handlerRef, nodeFields, rawTag, tagSrcOffset);
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
  const mapIdx = ctx.maps.length;
  const mapInfo = {
    oaIdx: oa.oaIdx, itemParam, indexParam,
    oa, textsInMap: [], innerCount: 0, parentArr: '', childIdx: 0,
  };
  ctx.currentMap = mapInfo;

  // Parse the map template JSX
  const templateNode = parseJSXElement(c);

  ctx.currentMap = savedMapCtx;

  // Skip closing ))}
  if (c.kind() === TK.rparen) c.advance(); // )
  if (c.kind() === TK.rparen) c.advance(); // )

  // Register the map
  mapInfo.templateExpr = templateNode.nodeExpr;
  ctx.maps.push(mapInfo);

  // Return a placeholder node — the parent array slot that gets .children set by _rebuildMap
  return { nodeExpr: `.{ .style = .{ .gap = 8, .width = -1, .height = -1 } }`, mapIdx };
}

// Check if an identifier is a map item member access (item.field)
function isMapItemAccess(name) {
  if (!ctx.currentMap) return null;
  if (name === ctx.currentMap.itemParam) return ctx.currentMap;
  return null;
}

// ── Template literal parser ──

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
      } else {
        // Unknown expression — treat as integer
        fmt += '{d}';
        // Resolve state getters in the expression
        const resolved = expr.replace(/\b(\w+)\b/g, (m) => isGetter(m) ? slotGet(m) : m);
        args.push(resolved);
      }
      i = j;
    } else {
      fmt += raw[i];
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
    // Build condition expression with Zig-compatible ops
    if (c.kind() === TK.identifier) {
      const name = c.text();
      condParts.push(isGetter(name) ? slotGet(name) : name);
    } else if (c.kind() === TK.number) {
      condParts.push(c.text());
    } else if (c.kind() === TK.eq_eq) {
      condParts.push(' == ');
    } else if (c.kind() === TK.not_eq) {
      condParts.push(' != ');
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
    } else {
      condParts.push(c.text());
    }
    c.advance();
  }
  // Didn't find && <JSX> pattern — restore and return false
  c.restore(saved);
  return false;
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
    } else if (c.kind() === TK.eq_eq) { condParts.push(' == '); }
    else if (c.kind() === TK.not_eq) { condParts.push(' != '); }
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
      // Try ternary text: {expr == val ? "a" : "b"}
      const ternResult = tryParseTernaryText(c, children);
      if (ternResult) continue;
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
      }
      // Template literal: {`text ${expr}`}
      if (c.kind() === TK.template_literal) {
        const raw = c.text().slice(1, -1); // strip backticks
        c.advance();
        if (c.kind() === TK.rbrace) c.advance();
        // Parse template: split on ${...} and build fmt string + args
        const { fmt, args } = parseTemplateLiteral(raw);
        if (args.length > 0) {
          const bufId = ctx.dynCount;
          // Buffer size: static text length + 64 per interpolation + padding (match reference)
          const bufSize = fmt.length + 64 * args.length + 14;
          ctx.dynTexts.push({ bufId, fmtString: fmt, fmtArgs: args.join(', '), arrName: '', arrIndex: 0, bufSize });
          ctx.dynCount++;
          children.push({ nodeExpr: `.{ .text = "" }`, dynBufId: bufId });
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
            const bufId = ctx.dynCount;
            const fmt = fieldInfo && fieldInfo.type === 'string' ? '{s}' : '{d}';
            let args;
            if (fieldInfo && fieldInfo.type === 'string') {
              args = `_oa${oaIdx}_${field}[_i][0.._oa${oaIdx}_${field}_lens[_i]]`;
            } else {
              args = `_oa${oaIdx}_${field}[_i]`;
            }
            ctx.dynTexts.push({ bufId, fmtString: fmt, fmtArgs: args, arrName: '', arrIndex: 0, bufSize: 256, inMap: true, mapIdx: ctx.maps.length });
            ctx.dynCount++;
            children.push({ nodeExpr: `.{ .text = "" }`, dynBufId: bufId, inMap: true });
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
    } else if (c.kind() !== TK.rbrace) {
      // Text content — collect anything that isn't JSX or braces, preserve spaces
      let text = '';
      let lastEnd = 0;
      while (c.kind() !== TK.lt && c.kind() !== TK.lt_slash && c.kind() !== TK.lbrace && c.kind() !== TK.eof && c.kind() !== TK.rbrace) {
        // Add space if there was whitespace between tokens in source
        if (text.length > 0 && c.starts[c.pos] > lastEnd) text += ' ';
        text += c.text();
        lastEnd = c.ends[c.pos];
        c.advance();
      }
      if (text.trim()) children.push({ nodeExpr: `.{ .text = "${text.trim()}" }` });
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
      return { nodeExpr: expr, dynBufId: dynChild.dynBufId };
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

  if (handlerRef) parts.push(`.handlers = .{ .on_press = ${handlerRef} }`);

  if (children.length > 0) {
    const arrName = `_arr_${ctx.arrayCounter}`;
    ctx.arrayCounter++;
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
    const compSuffix = ctx.inlineComponent ? ` // ${ctx.inlineComponent}` : '';
    ctx.arrayDecls.push(`var ${arrName} = [_]Node{ ${childExprs} };${compSuffix}`);
    // Bind dynamic texts and conditionals to this array
    for (let i = 0; i < children.length; i++) {
      if (children[i].dynBufId !== undefined) {
        const dt = ctx.dynTexts.find(d => d.bufId === children[i].dynBufId);
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
    }
    parts.push(`.children = &${arrName}`);
  }

  return { nodeExpr: `.{ ${parts.join(', ')} }` };
}

