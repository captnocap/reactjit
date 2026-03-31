// ── JSX parser ──

function resolveTag(name) { return htmlTags[name] || name; }

function parseJSXElement(c) {
  if (c.kind() !== TK.lt) return { nodeExpr: '.{}' };
  c.advance(); // <

  const fragmentNode = tryParseFragmentElement(c);
  if (fragmentNode) return fragmentNode;

  let rawTag = c.text();
  c.advance();
  // Handle <3D...> — lexer tokenizes "3" (number) + "D" (identifier)
  if (rawTag === '3' && c.kind() === TK.identifier && c.text() === 'D') {
    rawTag = '3D';
    c.advance();
  }

  if (rawTag === 'script') return skipScriptElement(c);

  const normalizedTag = normalizeRawTag(c, rawTag);
  rawTag = normalizedTag.rawTag;
  let clsDef = normalizedTag.clsDef;
  let clsName = normalizedTag.clsName;

  // Check if this is a component call
  const comp = findComponent(rawTag);
  if (globalThis.__SMITH_DEBUG_INLINE && comp) {
    globalThis.__dbg = globalThis.__dbg || [];
    globalThis.__dbg.push('[INLINE] component=' + rawTag + ' bodyPos=' + comp.bodyPos + ' cursorPos=' + c.pos);
    if (rawTag === 'SourcePage' && !globalThis.__sourcePageDumped) {
      globalThis.__sourcePageDumped = true;
      for (let di = comp.bodyPos; di < Math.min(comp.bodyPos + 15, c.count); di++) {
        globalThis.__dbg.push('[SP_TOK@' + di + '] kind=' + c.kindAt(di) + ' text="' + c.textAt(di).substring(0, 40) + '"');
      }
    }
  }
  if (comp) {
    const propValues = collectComponentPropValues(c);
    const compChildren = parseComponentCallChildren(c);
    return inlineComponentCall(c, comp, rawTag, propValues, compChildren);
  }

  const tag = resolveTag(rawTag);
  // Track source position for breadcrumb comments
  const tagSrcOffset = c.starts[c.pos > 0 ? c.pos - 1 : 0];

  let elementState = initElementParseState(rawTag, tag);
  let styleFields = elementState.styleFields;
  let nodeFields = elementState.nodeFields;
  let ascriptScript = elementState.ascriptScript;
  let ascriptOnResult = elementState.ascriptOnResult;
  const effectiveTag = elementState.effectiveTag;
  let handlerRef = elementState.handlerRef;

  while (c.kind() !== TK.gt && c.kind() !== TK.slash_gt && c.kind() !== TK.eof) {
    if (c.kind() === TK.identifier) {
      const attr = c.text();
      c.advance();
      if (c.kind() === TK.equals) {
        c.advance();
        if (attr === 'style') {
          const inlineStyles = parseStyleBlock(c);
          // Merge: inline styles win over pre-injected (e.g. ScrollView overflow)
          const preInjected = styleFields.filter(f => !inlineStyles.some(s => s.split(' = ')[0] === f.split(' = ')[0]));
          styleFields = preInjected.concat(inlineStyles);
          // Transfer custom properties lost by Array.concat (dynStyle bindings)
          if (inlineStyles._dynStyleIds) styleFields._dynStyleIds = inlineStyles._dynStyleIds;
          if (inlineStyles._dynStyleId !== undefined) styleFields._dynStyleId = inlineStyles._dynStyleId;
          continue;
        }

        const handlerAttrResult = tryParseElementHandlerAttr(c, attr, rawTag, nodeFields, handlerRef);
        if (handlerAttrResult) {
          handlerRef = handlerAttrResult.handlerRef;
          continue;
        }

        if (rawTag === 'ascript' && attr === 'run') {
          // <ascript run="tell app ..." /> — capture the script string
          if (c.kind() === TK.string) {
            ascriptScript = c.text().slice(1, -1);
            c.advance();
          } else if (c.kind() === TK.lbrace) {
            c.advance();
            if (c.kind() === TK.string) { ascriptScript = c.text().slice(1, -1); c.advance(); }
            if (c.kind() === TK.rbrace) c.advance();
          }
        } else if (rawTag === 'ascript' && attr === 'onResult') {
          // <ascript onResult={setMyState} /> — capture the setter
          if (c.kind() === TK.lbrace) {
            c.advance();
            if (c.kind() === TK.identifier) { ascriptOnResult = c.text(); c.advance(); }
            if (c.kind() === TK.rbrace) c.advance();
          } else if (c.kind() === TK.identifier) {
            ascriptOnResult = c.text(); c.advance();
          }
        } else if (attr === 'fontSize') {
          // fontSize={N}, fontSize={prop / N}, fontSize="N" → .font_size = N
          if (c.kind() === TK.lbrace) {
            c.advance();
            // Resolve first operand: number literal or prop reference
            let fsVal = null;
            if (c.kind() === TK.number) { fsVal = parseFloat(c.text()); c.advance(); }
            else if (c.kind() === TK.identifier && ctx.propStack && ctx.propStack[c.text()] !== undefined && /^\d+(\.\d+)?$/.test(ctx.propStack[c.text()])) {
              fsVal = parseFloat(ctx.propStack[c.text()]); c.advance();
            }
            if (fsVal !== null) {
              // Check for arithmetic: val * N, val / N
              if (c.kind() === TK.star && c.pos + 1 < c.count) { c.advance(); if (c.kind() === TK.number) { fsVal = Math.floor(fsVal * parseFloat(c.text())); c.advance(); } }
              else if (c.kind() === TK.slash && c.pos + 1 < c.count) { c.advance(); if (c.kind() === TK.number) { fsVal = Math.floor(fsVal / parseFloat(c.text())); c.advance(); } }
              nodeFields.push(`.font_size = ${fsVal}`);
            }
            // Consume remaining tokens until }
            while (c.kind() !== TK.rbrace && c.kind() !== TK.eof) c.advance();
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
              // Resolve LHS: state getter or map item.field
              let colorLhs = null;
              let colorLhsIsString = false;
              if (isGetter(propName)) {
                const si = findSlot(propName);
                colorLhs = slotGet(propName);
                colorLhsIsString = si >= 0 && ctx.stateSlots[si].type === 'string';
              } else if (ctx.currentMap && propName === ctx.currentMap.itemParam && c.kind() === TK.dot) {
                c.advance(); // skip .
                if (c.kind() === TK.identifier) {
                  const field = c.text(); c.advance();
                  const oa = ctx.currentMap.oa;
                  const fi = oa ? oa.fields.find(f => f.name === field) : null;
                  if (fi) {
                    colorLhs = `_oa${oa.oaIdx}_${field}[_i]`;
                    colorLhsIsString = fi.type === 'string';
                    if (colorLhsIsString) colorLhs = `${colorLhs}[0.._oa${oa.oaIdx}_${field}_lens[_i]]`;
                  }
                }
              }
              // Check for ternary: lhs == N ? "#color1" : "#color2"
              if (colorLhs && (c.kind() === TK.eq_eq || c.kind() === TK.not_eq || c.kind() === TK.gt || c.kind() === TK.lt || c.kind() === TK.gt_eq || c.kind() === TK.lt_eq)) {
                const op = c.kind() === TK.eq_eq ? '==' : c.kind() === TK.not_eq ? '!=' : c.text();
                c.advance();
                if ((op === '==' || op === '!=') && c.kind() === TK.equals) c.advance();
                let rhs = '';
                let rhsIsString = false;
                if (c.kind() === TK.number) { rhs = c.text(); c.advance(); }
                else if (c.kind() === TK.string) { rhs = c.text().slice(1, -1); c.advance(); rhsIsString = true; }
                else if (c.kind() === TK.identifier) {
                  const n = c.text(); c.advance();
                  if (isGetter(n)) {
                    rhs = slotGet(n);
                  } else if (ctx.currentMap && n === ctx.currentMap.itemParam && c.kind() === TK.dot) {
                    // Map item field access: notice.title → OA field
                    c.advance(); // skip .
                    if (c.kind() === TK.identifier) {
                      const field = c.text(); c.advance();
                      const oa = ctx.currentMap.oa;
                      const fi = oa ? oa.fields.find(f => f.name === field) : null;
                      if (fi && fi.type === 'string') {
                        rhs = `_oa${oa.oaIdx}_${field}[_i][0.._oa${oa.oaIdx}_${field}_lens[_i]]`;
                        rhsIsString = true;
                      } else if (fi) {
                        rhs = `_oa${oa.oaIdx}_${field}[_i]`;
                      } else {
                        rhs = n + '.' + field;
                      }
                    }
                  } else if (ctx.currentMap && n === ctx.currentMap.indexParam) {
                    rhs = '@as(i64, @intCast(_i))';
                  } else if (ctx.propStack && ctx.propStack[n] !== undefined && typeof ctx.propStack[n] === 'string') {
                    rhs = ctx.propStack[n];
                  } else {
                    rhs = n;
                  }
                }
                if (c.kind() === TK.question) {
                  c.advance();
                  const tv = parseTernaryBranch(c, 'color');
                  if (c.kind() === TK.colon) c.advance();
                  const fv = parseTernaryBranch(c, 'color');
                  let cond;
                  if (rhsIsString || colorLhsIsString) {
                    // If rhs is a Zig expression (OA field, state getter), don't quote it
                    const rhsExpr = (rhs.includes('[_i]') || rhs.includes('_oa') || rhs.includes('state.get') || rhs.includes('getSlot')) ? rhs : `"${rhs}"`;
                    const eql = `std.mem.eql(u8, ${colorLhs}, ${rhsExpr})`;
                    cond = op === '!=' ? `(!${eql})` : `(${eql})`;
                  } else {
                    cond = `(${colorLhs} ${op} ${rhs})`;
                  }
                  const resolveC = (v) => v.type === 'zig_expr' ? v.zigExpr : v.type === 'string' ? parseColor(v.value) : 'Color{}';
                  const colorExpr = `if ${cond} ${resolveC(tv)} else ${resolveC(fv)}`;
                  if (ctx.currentMap) {
                    // Inside map — emit inline (evaluated at rebuild time per item)
                    nodeFields.push(`.text_color = ${colorExpr}`);
                  } else if (colorLhs && colorLhs.includes('_oa')) {
                    // Map field ternary — emit inline
                    nodeFields.push(`.text_color = ${colorExpr}`);
                  } else {
                    nodeFields.push(`.text_color = Color.rgb(0, 0, 0)`);
                    if (!ctx.dynStyles) ctx.dynStyles = [];
                    const dsId = ctx.dynStyles.length;
                    ctx.dynStyles.push({ field: 'text_color', expression: colorExpr, arrName: '', arrIndex: -1, isColor: true });
                    if (!nodeFields._dynStyleIds) nodeFields._dynStyleIds = [];
                    nodeFields._dynStyleIds.push(dsId);
                  }
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
        } else if (attr === 'textEffect') {
          // textEffect="name" → .text_effect = "name"
          if (c.kind() === TK.string) {
            nodeFields.push(`.text_effect = "${c.text().slice(1, -1)}"`);
            c.advance();
          }
        } else if (attr === 'name' && rawTag === 'Effect') {
          // <Effect name="foo"> → .effect_name = "foo"
          if (c.kind() === TK.string) {
            nodeFields.push(`.effect_name = "${c.text().slice(1, -1)}"`);
            c.advance();
          }
        } else if (attr === 'd' && (rawTag === 'Graph.Path' || rawTag === 'Canvas.Path')) {
          // Graph.Path/Canvas.Path d="M..." → .canvas_path_d = "M..."
          if (c.kind() === TK.string) { nodeFields.push(`.canvas_path_d = "${c.text().slice(1, -1)}"`); c.advance(); }
          else if (c.kind() === TK.lbrace) {
            c.advance(); // skip {
            if (c.kind() === TK.identifier && ctx.currentMap && c.text() === ctx.currentMap.itemParam) {
              c.advance(); // skip item name
              if (c.kind() === TK.dot) { c.advance(); const fn2 = c.text(); c.advance(); if (!ctx.currentMap._deferredCanvasAttrs) ctx.currentMap._deferredCanvasAttrs = []; ctx.currentMap._deferredCanvasAttrs.push({ zigField: 'canvas_path_d', oaField: fn2, type: 'string' }); }
            } else {
              // Dynamic d attribute — template literal or expression → jsExpr slot
              var dTokens = [];
              var dDepth = 0;
              while (c.kind() !== TK.eof) {
                if (c.kind() === TK.lbrace) dDepth++;
                if (c.kind() === TK.rbrace) { if (dDepth === 0) break; dDepth--; }
                dTokens.push(c.text());
                c.advance();
              }
              if (dTokens.length > 0) {
                var jsExpr = dTokens.join(' ').replace(/\bexact\b/g, '===');
                // Convert template literal backtick syntax to JS string concat
                // The lexer may have tokenized `M ${x}` as backtick + tokens
                var jSlotIdx = ctx.stateSlots.length;
                ctx.stateSlots.push({ getter: '__jsExpr_' + jSlotIdx, setter: '__setJsExpr_' + jSlotIdx, initial: '', type: 'string' });
                var jBufId = ctx.dynCount;
                ctx.dynTexts.push({ bufId: jBufId, fmtString: '{s}', fmtArgs: 'state.getSlotString(' + jSlotIdx + ')', arrName: '', arrIndex: 0, bufSize: 256, targetField: 'canvas_path_d' });
                ctx.dynCount++;
                ctx._jsDynTexts.push({ slotIdx: jSlotIdx, jsExpr: jsExpr });
              }
            }
            if (c.kind() === TK.rbrace) c.advance();
          }
        } else if (attr === 'fill' && (rawTag === 'Graph.Path' || rawTag === 'Canvas.Path')) {
          // Graph.Path/Canvas.Path fill="#hex" → .canvas_fill_color (node field)
          if (c.kind() === TK.string) {
            nodeFields.push(`.canvas_fill_color = ${parseColor(c.text().slice(1, -1))}`);
            c.advance();
          } else if (c.kind() === TK.lbrace) { skipBraces(c); }
        } else if (attr === 'stroke' && (rawTag === 'Graph.Path' || rawTag === 'Canvas.Path')) {
          // Graph.Path/Canvas.Path stroke="#hex" → .text_color (used by paintCanvasPath for stroke)
          if (c.kind() === TK.string) {
            nodeFields.push(`.text_color = ${parseColor(c.text().slice(1, -1))}`);
            c.advance();
          } else if (c.kind() === TK.lbrace) { skipBraces(c); }
        } else if (attr === 'strokeWidth' && (rawTag === 'Graph.Path' || rawTag === 'Canvas.Path')) {
          // Graph.Path/Canvas.Path strokeWidth={N} → .canvas_stroke_width (node field, f32)
          if (c.kind() === TK.lbrace) { c.advance(); if (c.kind() === TK.number) { nodeFields.push(`.canvas_stroke_width = ${c.text()}`); c.advance(); } if (c.kind() === TK.rbrace) c.advance(); }
          else if (c.kind() === TK.number) { nodeFields.push(`.canvas_stroke_width = ${c.text()}`); c.advance(); }
        } else if (attr === 'flowSpeed' && (rawTag === 'Graph.Path' || rawTag === 'Canvas.Path')) {
          // Canvas.Path flowSpeed={N} → .canvas_flow_speed (node field, f32)
          if (c.kind() === TK.lbrace) { c.advance(); let neg = ''; if (c.kind() === TK.minus) { neg = '-'; c.advance(); } if (c.kind() === TK.number) { nodeFields.push(`.canvas_flow_speed = ${neg}${c.text()}`); c.advance(); } if (c.kind() === TK.rbrace) c.advance(); }
          else if (c.kind() === TK.number) { nodeFields.push(`.canvas_flow_speed = ${c.text()}`); c.advance(); }
        } else if (attr === 'fillEffect' && (rawTag === 'Graph.Path' || rawTag === 'Canvas.Path')) {
          if (c.kind() === TK.string) { nodeFields.push(`.canvas_fill_effect = "${c.text().slice(1, -1)}"`); c.advance(); }
          else if (c.kind() === TK.lbrace) { skipBraces(c); }
        } else if (attr === 'viewZoom') {
          // Canvas/Graph viewZoom={N} → .canvas_view_zoom = N
          if (c.kind() === TK.lbrace) { c.advance(); if (c.kind() === TK.number) { nodeFields.push(`.canvas_view_zoom = ${c.text()}`); nodeFields.push('.canvas_view_set = true'); c.advance(); } if (c.kind() === TK.rbrace) c.advance(); }
          else if (c.kind() === TK.number) { nodeFields.push(`.canvas_view_zoom = ${c.text()}`); nodeFields.push('.canvas_view_set = true'); c.advance(); }
        } else if (attr === 'viewX') {
          // Canvas/Graph viewX={N} → .canvas_view_x = N
          if (c.kind() === TK.lbrace) { c.advance(); let neg = ''; if (c.kind() === TK.minus) { neg = '-'; c.advance(); } if (c.kind() === TK.number) { nodeFields.push(`.canvas_view_x = ${neg}${c.text()}`); c.advance(); } if (c.kind() === TK.rbrace) c.advance(); }
          else if (c.kind() === TK.number) { nodeFields.push(`.canvas_view_x = ${c.text()}`); c.advance(); }
        } else if (attr === 'viewY') {
          // Canvas/Graph viewY={N} → .canvas_view_y = N
          if (c.kind() === TK.lbrace) { c.advance(); let neg = ''; if (c.kind() === TK.minus) { neg = '-'; c.advance(); } if (c.kind() === TK.number) { nodeFields.push(`.canvas_view_y = ${neg}${c.text()}`); c.advance(); } if (c.kind() === TK.rbrace) c.advance(); }
          else if (c.kind() === TK.number) { nodeFields.push(`.canvas_view_y = ${c.text()}`); c.advance(); }
        } else if (attr === 'driftX' && rawTag === 'Canvas') {
          if (c.kind() === TK.lbrace) { c.advance(); let neg = ''; if (c.kind() === TK.minus) { neg = '-'; c.advance(); } if (c.kind() === TK.number) { nodeFields.push(`.canvas_drift_x = ${neg}${c.text()}`); c.advance(); } if (c.kind() === TK.rbrace) c.advance(); }
          else if (c.kind() === TK.number) { nodeFields.push(`.canvas_drift_x = ${c.text()}`); c.advance(); }
        } else if (attr === 'driftY' && rawTag === 'Canvas') {
          if (c.kind() === TK.lbrace) { c.advance(); let neg = ''; if (c.kind() === TK.minus) { neg = '-'; c.advance(); } if (c.kind() === TK.number) { nodeFields.push(`.canvas_drift_y = ${neg}${c.text()}`); c.advance(); } if (c.kind() === TK.rbrace) c.advance(); }
          else if (c.kind() === TK.number) { nodeFields.push(`.canvas_drift_y = ${c.text()}`); c.advance(); }
        } else if ((attr === 'x' || attr === 'gx') && (rawTag === 'Canvas.Node' || rawTag === 'Graph.Node')) {
          // Graph.Node x={stateVar} → dynamic canvas_gx (via state slot lookup)
          if (c.kind() === TK.lbrace) { c.advance(); let neg = ''; if (c.kind() === TK.minus) { neg = '-'; c.advance(); } if (c.kind() === TK.number) { nodeFields.push(`.canvas_gx = ${neg}${c.text()}`); c.advance(); } else if (c.kind() === TK.identifier) { const vn = c.text(); c.advance(); const si = ctx.stateSlots.findIndex(function(s) { return s.getter === vn; }); if (si >= 0) { ctx._dynStyles.push({ arrIdx: -1, childIdx: -1, field: 'canvas_gx', slotIdx: si, isTernary: false }); } } if (c.kind() === TK.rbrace) c.advance(); }
          else if (c.kind() === TK.number) { nodeFields.push(`.canvas_gx = ${c.text()}`); c.advance(); }
        } else if ((attr === 'y' || attr === 'gy') && (rawTag === 'Canvas.Node' || rawTag === 'Graph.Node')) {
          if (c.kind() === TK.lbrace) { c.advance(); let neg = ''; if (c.kind() === TK.minus) { neg = '-'; c.advance(); } if (c.kind() === TK.number) { nodeFields.push(`.canvas_gy = ${neg}${c.text()}`); c.advance(); } else if (c.kind() === TK.identifier) { const vn = c.text(); c.advance(); const si = ctx.stateSlots.findIndex(function(s) { return s.getter === vn; }); if (si >= 0) { ctx._dynStyles.push({ arrIdx: -1, childIdx: -1, field: 'canvas_gy', slotIdx: si, isTernary: false }); } } if (c.kind() === TK.rbrace) c.advance(); }
          else if (c.kind() === TK.number) { nodeFields.push(`.canvas_gy = ${c.text()}`); c.advance(); }
        } else if ((attr === 'w' || attr === 'gw') && (rawTag === 'Canvas.Node' || rawTag === 'Graph.Node')) {
          if (c.kind() === TK.lbrace) { c.advance(); if (c.kind() === TK.number) { nodeFields.push(`.canvas_gw = ${c.text()}`); c.advance(); } if (c.kind() === TK.rbrace) c.advance(); }
          else if (c.kind() === TK.number) { nodeFields.push(`.canvas_gw = ${c.text()}`); c.advance(); }
        } else if ((attr === 'h' || attr === 'gh') && (rawTag === 'Canvas.Node' || rawTag === 'Graph.Node')) {
          if (c.kind() === TK.lbrace) { c.advance(); if (c.kind() === TK.number) { nodeFields.push(`.canvas_gh = ${c.text()}`); c.advance(); } if (c.kind() === TK.rbrace) c.advance(); }
          else if (c.kind() === TK.number) { nodeFields.push(`.canvas_gh = ${c.text()}`); c.advance(); }
        } else if (attr === 'gx' && rawTag === 'Canvas.Node') {
          // Legacy: Canvas.Node gx/gy/gw/gh (keep for backwards compat)
          if (c.kind() === TK.lbrace) { c.advance(); let neg = ''; if (c.kind() === TK.minus) { neg = '-'; c.advance(); } if (c.kind() === TK.number) { nodeFields.push(`.canvas_gx = ${neg}${c.text()}`); c.advance(); } else if (c.kind() === TK.identifier && ctx.currentMap && c.text() === ctx.currentMap.itemParam) { c.advance(); if (c.kind() === TK.dot) { c.advance(); const fn2 = c.text(); c.advance(); if (!ctx.currentMap._deferredCanvasAttrs) ctx.currentMap._deferredCanvasAttrs = []; ctx.currentMap._deferredCanvasAttrs.push({ zigField: 'canvas_gx', oaField: fn2 }); } } if (c.kind() === TK.rbrace) c.advance(); }
          else if (c.kind() === TK.number) { nodeFields.push(`.canvas_gx = ${c.text()}`); c.advance(); }
        } else if (attr === 'gy' && rawTag === 'Canvas.Node') {
          if (c.kind() === TK.lbrace) { c.advance(); let neg = ''; if (c.kind() === TK.minus) { neg = '-'; c.advance(); } if (c.kind() === TK.number) { nodeFields.push(`.canvas_gy = ${neg}${c.text()}`); c.advance(); } else if (c.kind() === TK.identifier && ctx.currentMap && c.text() === ctx.currentMap.itemParam) { c.advance(); if (c.kind() === TK.dot) { c.advance(); const fn2 = c.text(); c.advance(); if (!ctx.currentMap._deferredCanvasAttrs) ctx.currentMap._deferredCanvasAttrs = []; ctx.currentMap._deferredCanvasAttrs.push({ zigField: 'canvas_gy', oaField: fn2 }); } } if (c.kind() === TK.rbrace) c.advance(); }
          else if (c.kind() === TK.number) { nodeFields.push(`.canvas_gy = ${c.text()}`); c.advance(); }
        } else if (attr === 'gw' && rawTag === 'Canvas.Node') {
          if (c.kind() === TK.lbrace) { c.advance(); if (c.kind() === TK.number) { nodeFields.push(`.canvas_gw = ${c.text()}`); c.advance(); } if (c.kind() === TK.rbrace) c.advance(); }
          else if (c.kind() === TK.number) { nodeFields.push(`.canvas_gw = ${c.text()}`); c.advance(); }
        } else if (attr === 'gh' && rawTag === 'Canvas.Node') {
          if (c.kind() === TK.lbrace) { c.advance(); if (c.kind() === TK.number) { nodeFields.push(`.canvas_gh = ${c.text()}`); c.advance(); } if (c.kind() === TK.rbrace) c.advance(); }
          else if (c.kind() === TK.number) { nodeFields.push(`.canvas_gh = ${c.text()}`); c.advance(); }
        } else if (attr === 'placeholder' && (rawTag === 'TextInput' || rawTag === 'TextArea')) {
          if (c.kind() === TK.string) { nodeFields.push(`.placeholder = "${c.text().slice(1, -1)}"`); c.advance(); }
          else if (c.kind() === TK.lbrace) { skipBraces(c); }
        } else if (tryParseSpatialAttr(c, attr, rawTag, styleFields, nodeFields)) {
          continue;
        } else if (attr === 'color' && rawTag.startsWith('3D.')) {
          if (c.kind() === TK.string) {
            const hex = c.text().slice(1, -1).replace('#', '');
            const r = parseInt(hex.slice(0, 2), 16) / 255;
            const g = parseInt(hex.slice(2, 4), 16) / 255;
            const b = parseInt(hex.slice(4, 6), 16) / 255;
            nodeFields.push(`.scene3d_color_r = ${r.toFixed(3)}`);
            nodeFields.push(`.scene3d_color_g = ${g.toFixed(3)}`);
            nodeFields.push(`.scene3d_color_b = ${b.toFixed(3)}`);
            c.advance();
          } else if (c.kind() === TK.lbrace) { skipBraces(c); }
        } else if (attr === 'color' && rawTag.startsWith('Physics.')) {
          // color="#hex" → background_color style
          if (c.kind() === TK.string) {
            const val = c.text().slice(1, -1);
            styleFields.push(`.background_color = ${parseColor(val)}`);
            c.advance();
          } else if (c.kind() === TK.lbrace) { skipBraces(c); }
        } else if (attr === 'bold') {
          // bold attribute (no value) → .bold = true
          nodeFields.push('.bold = true');
          // Don't consume — no value after bare attribute
          continue;
        } else if (attr === 'd' || attr === 'fill' || attr === 'fillEffect' || attr === 'stroke' || attr === 'strokeWidth' || attr === 'scale') {
          // Glyph attributes in inline context — handled by parseInlineGlyph, skip here
          if (c.kind() === TK.string) c.advance();
          else if (c.kind() === TK.lbrace) { skipBraces(c); }
          else if (c.kind() === TK.number) c.advance();
        } else {
          // Skip unknown attributes
          if (c.kind() === TK.string) c.advance();
          else if (c.kind() === TK.lbrace) { skipBraces(c); }
        }
      }
    } else { c.advance(); }
  }

  // Canvas: set drift_active when drift attrs present (enables auto-stacker + drift animation)
  if (rawTag === 'Canvas') {
    const hasDrift = nodeFields.some(f => f.includes('canvas_drift_x') || f.includes('canvas_drift_y'));
    if (hasDrift) nodeFields.push('.canvas_drift_active = true');
    // view_set is already emitted by viewZoom handler — only add if missing
    const hasView = nodeFields.some(f => f.includes('canvas_view_x') || f.includes('canvas_view_y') || f.includes('canvas_view_zoom'));
    if (hasView && !nodeFields.some(f => f.includes('canvas_view_set'))) nodeFields.push('.canvas_view_set = true');
  }

  // Merge classifier defaults (inline attrs win)
  if (clsDef) {
    styleFields = mergeFields(clsStyleFields(clsDef), styleFields);
    nodeFields = mergeFields(clsNodeFields(clsDef), nodeFields);
  }

  // Variant/bp binding — track nodes that need runtime style switching
  if (clsDef && (clsDef.variants || clsDef.bp)) {
    // Build style arrays for each variant: [base, variant1, variant2, ...]
    // Base style is what's already merged into styleFields (cls defaults + inline overrides)
    var vStyles = [styleFields.filter(function(f) { return !f.startsWith('._'); }).join(', ')];
    var vNodeFields = [nodeFields.filter(function(f) { return !f.startsWith('._'); }).join(', ')];
    for (var vi = 0; vi < ctx.variantNames.length; vi++) {
      var vname = ctx.variantNames[vi];
      var vdef = clsDef.variants && clsDef.variants[vname];
      if (vdef) {
        // Merge: variant style base + inline overrides (inline still wins)
        var vFields = mergeFields(clsStyleFields(vdef), styleFields.filter(function(f) {
          // only keep truly inline fields (not from base classifier)
          return !clsStyleFields(clsDef).some(function(cf) { return cf.split('=')[0].trim() === f.split('=')[0].trim(); });
        }));
        vStyles.push(vFields.filter(function(f) { return !f.startsWith('._'); }).join(', '));
        var vnf = mergeFields(clsNodeFields(vdef), nodeFields.filter(function(f) {
          return !clsNodeFields(clsDef).some(function(cf) { return cf.split('=')[0].trim() === f.split('=')[0].trim(); });
        }));
        vNodeFields.push(vnf.filter(function(f) { return !f.startsWith('._'); }).join(', '));
      } else {
        // This classifier entry doesn't define this variant — use base
        vStyles.push(vStyles[0]);
        vNodeFields.push(vNodeFields[0]);
      }
    }
    // Breakpoint overrides: {sm: styleStr, md: styleStr}
    var bpStyles = null;
    if (clsDef.bp) {
      bpStyles = {};
      var bpTiers = ['sm', 'md'];
      for (var bi = 0; bi < bpTiers.length; bi++) {
        var bpDef = clsDef.bp[bpTiers[bi]];
        if (bpDef) {
          var bpFields = mergeFields(clsStyleFields(bpDef), []);
          bpStyles[bpTiers[bi]] = bpFields.filter(function(f) { return !f.startsWith('._'); }).join(', ');
        }
      }
    }
    var vbId = ctx.variantBindings.length;
    ctx.variantBindings.push({
      id: vbId, clsName: clsName || '',
      styles: vStyles,         // [baseStr, v1Str, v2Str, ...]
      nodeFieldStrs: vNodeFields,
      bpStyles: bpStyles,      // {sm: str, md: str} or null
      arrName: '', arrIndex: -1,
      inMap: !!ctx.currentMap,
      inComponent: !!ctx.inlineComponent,
    });
    // Attach binding ID to styleFields so it propagates to node result
    styleFields._variantBindingId = vbId;
  }

  // <ascript> auto-handler: generates a press handler that runs AppleScript
  if (rawTag === 'ascript' && ascriptScript && !handlerRef) {
    const handlerName = `_handler_press_${ctx.handlerCount}`;
    const escaped = ascriptScript.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    let targetSlot = 0;
    if (ascriptOnResult) {
      const si = findSlot(ascriptOnResult);
      if (si >= 0) targetSlot = si;
    }
    // Async: spawns background thread, result delivered via pollResult() in tick
    const body = `    @import("framework/applescript.zig").run("${escaped}", ${targetSlot});\n`;
    ctx.handlers.push({ name: handlerName, body, luaBody: `__applescript("${escaped}")` });
    handlerRef = handlerName;
    ctx.handlerCount++;
    // Mark that this app uses applescript (for tick polling)
    if (!ctx.usesApplescript) ctx.usesApplescript = true;
  }

  return finishParsedElement(c, rawTag, effectiveTag, styleFields, null, handlerRef, nodeFields, clsDef, tagSrcOffset);
}

function parseChildren(c) {
  const children = [];
  while (c.kind() !== TK.lt_slash && c.kind() !== TK.eof) {
    if (tryParseElementChild(c, children)) continue;
    if (tryParseBraceChild(c, children)) continue;
    if (tryParseTextChild(c, children)) continue;
  }
  return children;
}



// Parse <Glyph d="..." fill="#color" fillEffect="name" /> inside <Text>
// Returns a glyph marker child node or null
function parseInlineGlyph(c) {
  if (c.kind() !== TK.lt) return null;
  c.advance(); // skip <
  if (c.text() !== 'Glyph') return null;
  c.advance(); // skip Glyph
  let d = '', fill = '#ffffff', fillEffect = '', stroke = '', strokeWidth = '0', scale = '1.0';
  while (c.kind() === TK.identifier && c.kind() !== TK.eof) {
    const aname = c.text(); c.advance();
    if (c.kind() !== TK.equals) continue;
    c.advance(); // skip =
    let aval = '';
    if (c.kind() === TK.string) { aval = c.text().slice(1, -1); c.advance(); }
    else if (c.kind() === TK.lbrace) { c.advance(); if (c.kind() === TK.identifier || c.kind() === TK.number) { aval = c.text(); c.advance(); } if (c.kind() === TK.rbrace) c.advance(); }
    else { aval = c.text(); c.advance(); }
    if (aname === 'd') d = aval;
    else if (aname === 'fill') fill = aval;
    else if (aname === 'fillEffect') fillEffect = aval;
    else if (aname === 'stroke') stroke = aval;
    else if (aname === 'strokeWidth') strokeWidth = aval;
    else if (aname === 'scale') scale = aval;
  }
  // Skip /> or >
  if (c.kind() === TK.slash_gt) c.advance();
  else if (c.kind() === TK.gt) c.advance();
  const fillColor = fill.startsWith('#') ? parseColor(fill) : 'Color.rgb(255, 255, 255)';
  const strokeColor = stroke ? (stroke.startsWith('#') ? parseColor(stroke) : 'Color.rgba(0, 0, 0, 0)') : 'Color.rgba(0, 0, 0, 0)';
  const fillEffectStr = fillEffect ? `, .fill_effect = "${fillEffect}"` : '';
  const glyphExpr = `.{ .d = "${d}", .fill = ${fillColor}, .stroke = ${strokeColor}, .stroke_width = ${strokeWidth}, .scale = ${scale}${fillEffectStr} }`;
  return { nodeExpr: '.{ .text = "\\x01" }', isGlyph: true, glyphExpr };
}
