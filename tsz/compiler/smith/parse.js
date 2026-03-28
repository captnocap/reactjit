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

  let rawTag = c.text();
  c.advance();

  // Skip <script>...</script> blocks — already collected by collectScript
  if (rawTag === 'script') {
    // Skip to matching </script>
    if (c.kind() === TK.gt) c.advance();
    while (c.pos < c.count) {
      if (c.kind() === TK.lt_slash && c.pos + 1 < c.count && c.kindAt(c.pos + 1) === TK.identifier && c.textAt(c.pos + 1) === 'script') {
        c.advance(); c.advance(); // skip </ script
        if (c.kind() === TK.gt) c.advance(); // skip >
        break;
      }
      c.advance();
    }
    return { nodeExpr: '.{}' }; // empty placeholder node
  }

  // C.Name classifier resolution
  let clsDef = null;
  if (rawTag === 'C' && c.kind() === TK.dot) {
    c.advance(); // skip .
    const clsName = c.text(); c.advance();
    clsDef = ctx.classifiers && ctx.classifiers[clsName];
    rawTag = clsDef ? clsDef.type : 'Box';
  }
  // Graph.Path / Graph.Node dot-name tags
  if (rawTag === 'Graph' && c.kind() === TK.dot) {
    c.advance(); // skip .
    const subTag = c.text(); c.advance();
    rawTag = 'Graph.' + subTag; // e.g. Graph.Path
  }
  // Canvas.Node / Canvas.Path / Canvas.Clamp dot-name tags
  if (rawTag === 'Canvas' && c.kind() === TK.dot) {
    c.advance(); // skip .
    const subTag = c.text(); c.advance();
    rawTag = 'Canvas.' + subTag; // e.g. Canvas.Node
  }
  // 3D.Camera / 3D.Light / 3D.Mesh / 3D.Group dot-name tags
  if (rawTag === '3D' && c.kind() === TK.dot) {
    c.advance();
    const subTag = c.text(); c.advance();
    rawTag = '3D.' + subTag;
  }
  // Scene3D as a tag
  if (rawTag === 'Scene3D' && c.kind() === TK.dot) {
    c.advance();
    rawTag = '3D.' + c.text(); c.advance();
  }

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
          } else if ((attr === 'onPress' || attr === 'onTap' || attr === 'onToggle' || attr === 'onSelect' || attr === 'onChange') && c.kind() === TK.lbrace) {
            // Handler prop — parse as a real handler and store handler name
            c.advance();
            const handlerName = `_handler_press_${ctx.handlerCount}`;
            if (c.kind() === TK.identifier && (isScriptFunc(c.text()) || isSetter(c.text()))) {
              const fname = c.text(); c.advance();
              if (isScriptFunc(fname)) {
                ctx.handlers.push({ name: handlerName, body: `    qjs_runtime.callGlobal("${fname}");\n`, luaBody: `${fname}()` });
              } else {
                ctx.handlers.push({ name: handlerName, body: `    // ${fname}\n`, luaBody: fname });
              }
              if (c.kind() === TK.lparen) { c.advance(); if (c.kind() === TK.rparen) c.advance(); }
            } else {
              const saved = c.save();
              const luaBody = luaParseHandler(c);
              c.restore(saved);
              const body = parseHandler(c);
              const isMapHandler = !!ctx.currentMap;
              ctx.handlers.push({ name: handlerName, body, luaBody, inMap: isMapHandler, mapIdx: isMapHandler ? ctx.maps.indexOf(ctx.currentMap) : -1 });
            }
            ctx.handlerCount++;
            if (c.kind() === TK.rbrace) c.advance();
            propValues[attr] = handlerName;
          } else if (c.kind() === TK.lbrace) {
            // {expr} prop value — resolve map item access, state getters, etc.
            c.advance();
            // Check for map item member access: item.field (walk parent chain)
            if (ctx.currentMap && c.kind() === TK.identifier) {
              let matchMap = null;
              let pm = ctx.currentMap;
              while (pm) { if (c.text() === pm.itemParam) { matchMap = pm; break; } pm = pm.parentMap; }
              if (matchMap) {
                c.advance(); // skip item name
                if (c.kind() === TK.dot) {
                  c.advance(); // skip .
                  if (c.kind() === TK.identifier) {
                    const field = c.text();
                    const oa = matchMap.oa;
                    const fi = oa.fields.find(ff => ff.name === field);
                    if (fi) {
                      let idx = '_i';
                      // Parent map: bridge through current OA's foreign key (e.g. colIdx)
                      if (matchMap !== ctx.currentMap) {
                        const bf = ctx.currentMap.oa.fields.find(ff => ff.name === matchMap.itemParam + 'Idx');
                        if (bf) idx = `@intCast(_oa${ctx.currentMap.oa.oaIdx}_${bf.name}[_i])`;
                      }
                      if (fi.type === 'string') {
                        propValues[attr] = `_oa${oa.oaIdx}_${field}[${idx}][0.._oa${oa.oaIdx}_${field}_lens[${idx}]]`;
                      } else {
                        propValues[attr] = `_oa${oa.oaIdx}_${field}[${idx}]`;
                      }
                      c.advance();
                      if (c.kind() === TK.rbrace) c.advance();
                      continue;
                    }
                  }
                }
              }
            }
            // Fallback: collect tokens as string
            let val = '';
            let depth = 0;
            while (c.kind() !== TK.eof) {
              if (c.kind() === TK.lbrace) depth++;
              if (c.kind() === TK.rbrace) { if (depth === 0) break; depth--; }
              if (c.kind() === TK.template_literal) {
                // Expand template literal: resolve ${var} refs through current scope
                const raw = c.text().slice(1, -1); // strip backticks
                let expanded = '';
                let ti = 0;
                while (ti < raw.length) {
                  if (raw[ti] === '$' && raw[ti + 1] === '{') {
                    const end = raw.indexOf('}', ti + 2);
                    if (end >= 0) {
                      const expr = raw.slice(ti + 2, end).trim();
                      // Resolve through map item fields
                      if (ctx.currentMap && ctx.currentMap.oa) {
                        const oa = ctx.currentMap.oa;
                        const fi = oa.fields.find(ff => ff.name === expr);
                        if (fi) {
                          // Mark as template with OA ref — will be handled as dynText
                          val = fi.type === 'string'
                            ? `_oa${oa.oaIdx}_${expr}[_i][0.._oa${oa.oaIdx}_${expr}_lens[_i]]`
                            : `_oa${oa.oaIdx}_${expr}[_i]`;
                          break;
                        }
                      }
                      if (isGetter(expr)) { val = slotGet(expr); break; }
                      val += c.text(); // unresolved — keep as-is
                      break;
                    }
                  }
                  ti++;
                }
              } else if (c.kind() === TK.identifier && isGetter(c.text())) val += slotGet(c.text());
              else if (c.kind() === TK.identifier && ctx.currentMap && c.text() === ctx.currentMap.indexParam) val += '@as(i64, @intCast(_i))';
              else {
                // Check parent map index params with bridge resolution
                let resolved = false;
                if (c.kind() === TK.identifier && ctx.currentMap) {
                  let pm = ctx.currentMap.parentMap;
                  while (pm) {
                    if (c.text() === pm.indexParam) {
                      const bf = ctx.currentMap.oa.fields.find(ff => ff.name === pm.itemParam + 'Idx');
                      if (bf) { val += `_oa${ctx.currentMap.oa.oaIdx}_${bf.name}[_i]`; resolved = true; break; }
                    }
                    pm = pm.parentMap;
                  }
                }
                if (!resolved) val += c.text();
              }
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
    // Arrays stay in current map context so per-item dynText wiring works
    const savedPos = c.save();
    const savedProps = ctx.propStack;
    const savedInline = ctx.inlineComponent;
    const savedChildren = ctx.componentChildren;
    const savedMapCtx = ctx.currentMap;
    const savedArrayDecls = ctx.arrayDecls;
    const savedArrayComments = ctx.arrayComments;
    ctx.propStack = propValues;
    ctx.inlineComponent = rawTag;
    ctx.componentChildren = compChildren;
    // Allocate fresh state slots for this component instance
    // Each instance gets unique getter/setter names (suffixed with slot index)
    // so that Lua/JS setter functions don't collide across instances.
    const savedSlotRemap = ctx.slotRemap || {};
    const savedNameRemap = ctx.nameRemap || {};
    const instanceSlotRemap = {};
    const instanceNameRemap = {};
    for (const cs of (comp.stateSlots || [])) {
      const newIdx = ctx.stateSlots.length;
      const uniqueGetter = cs.getter + '_' + newIdx;
      const uniqueSetter = cs.setter + '_' + newIdx;
      ctx.stateSlots.push({ getter: uniqueGetter, setter: uniqueSetter, initial: cs.initial, type: cs.type });
      instanceSlotRemap[cs.getter] = newIdx;
      instanceSlotRemap[cs.setter] = newIdx;
      // Map original names → unique names for Lua/JS handler string emission
      instanceNameRemap[cs.getter] = uniqueGetter;
      instanceNameRemap[cs.setter] = uniqueSetter;
    }
    ctx.slotRemap = Object.assign({}, savedSlotRemap, instanceSlotRemap);
    ctx.nameRemap = Object.assign({}, savedNameRemap, instanceNameRemap);
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
    // Arrays are already in the current map's mapArrayDecls (no redirect needed)
    ctx.propStack = savedProps;
    ctx.inlineComponent = savedInline;
    ctx.componentChildren = savedChildren;
    ctx.currentMap = savedMapCtx;
    ctx.arrayDecls = savedArrayDecls;
    ctx.arrayComments = savedArrayComments;
    ctx.slotRemap = savedSlotRemap;
    ctx.nameRemap = savedNameRemap;
    c.restore(savedPos);
    return result;
  }

  const tag = resolveTag(rawTag);
  // Track source position for breadcrumb comments
  const tagSrcOffset = c.starts[c.pos > 0 ? c.pos - 1 : 0];

  // Parse attributes
  let styleFields = [];
  let nodeFields = []; // direct node fields (font_size, text_color, etc.)
  // Graph container flag (node-level, not style-level)
  if (rawTag === 'Graph') nodeFields.push('.graph_container = true');
  if (rawTag === 'Graph.Path' || rawTag === 'Canvas.Path') nodeFields.push('.canvas_path = true');
  // ScrollView → overflow: scroll
  if (tag === 'ScrollView' || rawTag === 'ScrollView') styleFields.push('.overflow = .scroll');
  // Canvas → graph_container + canvas_type (enables canvas layout mode)
  if (rawTag === 'Canvas') { nodeFields.push('.graph_container = true'); nodeFields.push('.canvas_type = "canvas"'); }
  // Canvas.Node → canvas_node with gx/gy/gw/gh parsed from attributes
  if (rawTag === 'Canvas.Node') nodeFields.push('.canvas_node = true');
  // Terminal → allocate terminal_id
  if (rawTag === 'Terminal') {
    if (!ctx.terminalCount) ctx.terminalCount = 0;
    nodeFields.push(`.terminal_id = ${ctx.terminalCount}`);
    ctx.terminalCount++;
  }
  // TextInput → allocate input_id
  if (rawTag === 'TextInput') {
    if (!ctx.inputCount) ctx.inputCount = 0;
    nodeFields.push(`.input_id = ${ctx.inputCount}`);
    ctx.inputCount++;
  }
  // Scene3D → scene3d container
  if (rawTag === 'Scene3D') nodeFields.push('.scene3d = true');
  // 3D.Mesh
  if (rawTag === '3D.Mesh') nodeFields.push('.scene3d_mesh = true');
  // 3D.Camera
  if (rawTag === '3D.Camera') nodeFields.push('.scene3d_camera = true');
  // 3D.Light
  if (rawTag === '3D.Light') nodeFields.push('.scene3d_light = true');
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
            // Prop-passed handler: onPress={onToggle} where onToggle is a component prop
            if (c.kind() === TK.identifier && ctx.propStack && ctx.propStack[c.text()] !== undefined && ctx.propStack[c.text()].startsWith('_handler_press_')) {
              handlerRef = ctx.propStack[c.text()];
              c.advance();
              if (c.kind() === TK.rbrace) c.advance();
            // Named handler reference: onPress={functionName}
            } else if (c.kind() === TK.identifier && (isScriptFunc(c.text()) || isSetter(c.text()))) {
              const fname = c.text();
              c.advance();
              // Script function — call via QuickJS (not Lua, since <script> is JS)
              const handlerName = `_handler_press_${ctx.handlerCount}`;
              if (isScriptFunc(fname)) {
                ctx.handlers.push({ name: handlerName, body: `    qjs_runtime.callGlobal("${fname}");\n`, luaBody: `${fname}()` });
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
                else if (c.kind() === TK.identifier) { const n = c.text(); c.advance(); rhs = isGetter(n) ? slotGet(n) : (ctx.currentMap && n === ctx.currentMap.indexParam) ? '@as(i64, @intCast(_i))' : (ctx.propStack && ctx.propStack[n] !== undefined ? ctx.propStack[n] : n); }
                if (c.kind() === TK.question) {
                  c.advance();
                  const tv = parseTernaryBranch(c, 'color');
                  if (c.kind() === TK.colon) c.advance();
                  const fv = parseTernaryBranch(c, 'color');
                  let cond;
                  if (rhsIsString || colorLhsIsString) {
                    const eql = `std.mem.eql(u8, ${colorLhs}, "${rhs}")`;
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
        } else if (attr === 'onRender') {
          // <Effect onRender={(e) => { body }}> → capture and transpile to Zig render fn
          if (c.kind() === TK.lbrace) {
            c.advance(); // skip outer {
            // Parse arrow: (e) => { body }
            let effectParam = 'e';
            if (c.kind() === TK.lparen) {
              c.advance();
              if (c.kind() === TK.identifier) { effectParam = c.text(); c.advance(); }
              if (c.kind() === TK.rparen) c.advance();
            }
            if (c.kind() === TK.arrow) c.advance();
            // Capture the body source from { to matching }
            if (c.kind() === TK.lbrace) {
              const bodyStart = c.starts[c.pos];
              let depth = 1; c.advance();
              while (depth > 0 && c.kind() !== TK.eof) {
                if (c.kind() === TK.lbrace) depth++;
                if (c.kind() === TK.rbrace) depth--;
                if (depth > 0) c.advance();
              }
              const bodyEnd = c.starts[c.pos];
              const bodySource = c._byteSlice(bodyStart + 1, bodyEnd).trim();
              if (c.kind() === TK.rbrace) c.advance(); // skip body }
              if (c.kind() === TK.rbrace) c.advance(); // skip outer }
              // Register effect render
              if (!ctx.effectRenders) ctx.effectRenders = [];
              const effectId = ctx.effectRenders.length;
              ctx.effectRenders.push({ id: effectId, param: effectParam, body: bodySource });
              nodeFields.push(`.effect_render = _effect_render_${effectId}`);
            } else {
              skipBraces(c);
            }
          }
        } else if (attr === 'd' && (rawTag === 'Graph.Path' || rawTag === 'Canvas.Path')) {
          // Graph.Path/Canvas.Path d="M..." → .canvas_path_d = "M..."
          if (c.kind() === TK.string) { nodeFields.push(`.canvas_path_d = "${c.text().slice(1, -1)}"`); c.advance(); }
          else if (c.kind() === TK.lbrace) { skipBraces(c); }
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
        } else if (attr === 'gx' && rawTag === 'Canvas.Node') {
          if (c.kind() === TK.lbrace) { c.advance(); let neg = ''; if (c.kind() === TK.minus) { neg = '-'; c.advance(); } if (c.kind() === TK.number) { nodeFields.push(`.canvas_gx = ${neg}${c.text()}`); c.advance(); } if (c.kind() === TK.rbrace) c.advance(); }
          else if (c.kind() === TK.number) { nodeFields.push(`.canvas_gx = ${c.text()}`); c.advance(); }
        } else if (attr === 'gy' && rawTag === 'Canvas.Node') {
          if (c.kind() === TK.lbrace) { c.advance(); let neg = ''; if (c.kind() === TK.minus) { neg = '-'; c.advance(); } if (c.kind() === TK.number) { nodeFields.push(`.canvas_gy = ${neg}${c.text()}`); c.advance(); } if (c.kind() === TK.rbrace) c.advance(); }
          else if (c.kind() === TK.number) { nodeFields.push(`.canvas_gy = ${c.text()}`); c.advance(); }
        } else if (attr === 'gw' && rawTag === 'Canvas.Node') {
          if (c.kind() === TK.lbrace) { c.advance(); if (c.kind() === TK.number) { nodeFields.push(`.canvas_gw = ${c.text()}`); c.advance(); } if (c.kind() === TK.rbrace) c.advance(); }
          else if (c.kind() === TK.number) { nodeFields.push(`.canvas_gw = ${c.text()}`); c.advance(); }
        } else if (attr === 'gh' && rawTag === 'Canvas.Node') {
          if (c.kind() === TK.lbrace) { c.advance(); if (c.kind() === TK.number) { nodeFields.push(`.canvas_gh = ${c.text()}`); c.advance(); } if (c.kind() === TK.rbrace) c.advance(); }
          else if (c.kind() === TK.number) { nodeFields.push(`.canvas_gh = ${c.text()}`); c.advance(); }
        } else if (attr === 'placeholder' && rawTag === 'TextInput') {
          if (c.kind() === TK.string) { nodeFields.push(`.placeholder = "${c.text().slice(1, -1)}"`); c.advance(); }
          else if (c.kind() === TK.lbrace) { skipBraces(c); }
        } else if (attr === 'position' && (rawTag.startsWith('3D.') || rawTag === 'Scene3D')) {
          // position={[x, y, z]} → scene3d_pos_x/y/z
          if (c.kind() === TK.lbrace) {
            c.advance(); if (c.kind() === TK.lbracket) { c.advance();
              const vals = [];
              while (c.kind() !== TK.rbracket && c.kind() !== TK.eof) {
                let neg = ''; if (c.kind() === TK.minus) { neg = '-'; c.advance(); }
                if (c.kind() === TK.number) { vals.push(neg + c.text()); c.advance(); }
                if (c.kind() === TK.comma) c.advance();
              }
              if (c.kind() === TK.rbracket) c.advance();
              if (vals[0]) nodeFields.push(`.scene3d_pos_x = ${vals[0]}`);
              if (vals[1]) nodeFields.push(`.scene3d_pos_y = ${vals[1]}`);
              if (vals[2]) nodeFields.push(`.scene3d_pos_z = ${vals[2]}`);
            } if (c.kind() === TK.rbrace) c.advance();
          }
        } else if (attr === 'scale' && rawTag.startsWith('3D.')) {
          if (c.kind() === TK.lbrace) {
            c.advance(); if (c.kind() === TK.lbracket) { c.advance();
              const vals = [];
              while (c.kind() !== TK.rbracket && c.kind() !== TK.eof) {
                let neg = ''; if (c.kind() === TK.minus) { neg = '-'; c.advance(); }
                if (c.kind() === TK.number) { vals.push(neg + c.text()); c.advance(); }
                if (c.kind() === TK.comma) c.advance();
              }
              if (c.kind() === TK.rbracket) c.advance();
              if (vals[0]) nodeFields.push(`.scene3d_scale_x = ${vals[0]}`);
              if (vals[1]) nodeFields.push(`.scene3d_scale_y = ${vals[1]}`);
              if (vals[2]) nodeFields.push(`.scene3d_scale_z = ${vals[2]}`);
            } if (c.kind() === TK.rbrace) c.advance();
          }
        } else if (attr === 'lookAt' && rawTag === '3D.Camera') {
          if (c.kind() === TK.lbrace) {
            c.advance(); if (c.kind() === TK.lbracket) { c.advance();
              const vals = [];
              while (c.kind() !== TK.rbracket && c.kind() !== TK.eof) {
                let neg = ''; if (c.kind() === TK.minus) { neg = '-'; c.advance(); }
                if (c.kind() === TK.number) { vals.push(neg + c.text()); c.advance(); }
                if (c.kind() === TK.comma) c.advance();
              }
              if (c.kind() === TK.rbracket) c.advance();
              if (vals[0]) nodeFields.push(`.scene3d_look_x = ${vals[0]}`);
              if (vals[1]) nodeFields.push(`.scene3d_look_y = ${vals[1]}`);
              if (vals[2]) nodeFields.push(`.scene3d_look_z = ${vals[2]}`);
            } if (c.kind() === TK.rbrace) c.advance();
          }
        } else if (attr === 'fov' && rawTag === '3D.Camera') {
          if (c.kind() === TK.lbrace) { c.advance(); if (c.kind() === TK.number) { nodeFields.push(`.scene3d_fov = ${c.text()}`); c.advance(); } if (c.kind() === TK.rbrace) c.advance(); }
          else if (c.kind() === TK.number) { nodeFields.push(`.scene3d_fov = ${c.text()}`); c.advance(); }
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
        } else if (attr === 'intensity' && rawTag === '3D.Light') {
          if (c.kind() === TK.lbrace) { c.advance(); if (c.kind() === TK.number) { nodeFields.push(`.scene3d_intensity = ${c.text()}`); c.advance(); } if (c.kind() === TK.rbrace) c.advance(); }
          else if (c.kind() === TK.number) { nodeFields.push(`.scene3d_intensity = ${c.text()}`); c.advance(); }
        } else if (attr === 'shape' && rawTag === '3D.Mesh') {
          if (c.kind() === TK.string) { nodeFields.push(`.scene3d_geometry = "${c.text().slice(1, -1)}"`); c.advance(); }
          else if (c.kind() === TK.lbrace) { skipBraces(c); }
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

  // Merge classifier defaults (inline attrs win)
  if (clsDef) {
    styleFields = mergeFields(clsStyleFields(clsDef), styleFields);
    nodeFields = mergeFields(clsNodeFields(clsDef), nodeFields);
  }

  // Self-closing: />
  if (c.kind() === TK.slash_gt) {
    c.advance();
    return buildNode(tag, styleFields, [], handlerRef, nodeFields, tag, tagSrcOffset);
  }
  if (c.kind() === TK.gt) c.advance();

  const children = parseChildren(c);

  // </Tag> or </C.Name>
  if (c.kind() === TK.lt_slash) {
    c.advance();
    if (c.kind() === TK.identifier) c.advance(); // skip tag name (or "C")
    if (c.kind() === TK.dot) { c.advance(); if (c.kind() === TK.identifier) c.advance(); } // skip .Name
    if (c.kind() === TK.gt) c.advance();
  }

  return buildNode(tag, styleFields, children, handlerRef, nodeFields, tag, tagSrcOffset);
}

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
      } else if (/^(\w+)\s*([+\-*\/])\s*(.+)$/.test(expr)) {
        // Arithmetic expression: getter + N, getter - 1, etc.
        const m = expr.match(/^(\w+)\s*([+\-*\/])\s*(.+)$/);
        const lhsSlot = findSlot(m[1]);
        if (lhsSlot >= 0) {
          const rhsSlot = findSlot(m[3].trim());
          const rhsVal = rhsSlot >= 0 ? slotGet(m[3].trim()) : m[3].trim();
          fmt += '{d}';
          args.push(`${slotGet(m[1])} ${m[2]} ${rhsVal}`);
        } else if (ctx.currentMap && m[1] === ctx.currentMap.indexParam) {
          // Map index param in arithmetic: ${i + 1}, ${i - 1}, etc.
          fmt += '{d}';
          args.push(`@as(i64, @intCast(_i)) ${m[2]} ${m[3].trim()}`);
        } else {
          fmt += expr;
        }
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
    else if (c.kind() === TK.lt) {
      // Disambiguate: < followed by number/getter is less-than comparison, not JSX tag open
      if (c.pos + 1 < c.count && (c.kindAt(c.pos + 1) === TK.number || (c.kindAt(c.pos + 1) === TK.identifier && (isGetter(c.textAt(c.pos + 1)) || (ctx.propStack && ctx.propStack[c.textAt(c.pos + 1)] !== undefined))))) {
        condParts.push(' < ');
        c.advance();
        continue;
      }
      break;
    }
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
  ctx.conditionals.push({ condExpr, kind: 'ternary_jsx', trueIdx: -1, falseIdx: -1, inMap: !!ctx.currentMap });
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
    // Bail out if we hit parens, JSX, or arrows — this is not a simple ternary text
    if (c.kind() === TK.lparen || c.kind() === TK.lt || c.kind() === TK.arrow ||
        c.kind() === TK.lbrace) { c.restore(saved); return false; }
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
      // Detect <Glyph .../> inside <Text> — emit as inline glyph marker
      if (c.kind() === TK.lt && c.pos + 1 < c.count && c.textAt(c.pos + 1) === 'Glyph') {
        const glyph = parseInlineGlyph(c);
        if (glyph) { children.push(glyph); continue; }
      }
      children.push(parseJSXElement(c));
    } else if (c.kind() === TK.lbrace) {
      c.advance();
      if (globalThis.__SMITH_DEBUG_MAP_DETECT) {
        if (!globalThis.__dbg) globalThis.__dbg = [];
        globalThis.__dbg.push(`BRACE kind=${c.kind()} text=${c.text()} pos=${c.pos}`);
      }
      // Try conditional: {expr && <JSX>} or {expr != val && <JSX>}
      const condResult = tryParseConditional(c, children);
      if (condResult) { if (globalThis.__SMITH_DEBUG_MAP_DETECT) globalThis.__dbg.push(`-> consumed by tryParseConditional`); continue; }
      // Try ternary JSX: {expr ? (<JSX>) : (<JSX>)}
      const ternJSXResult = tryParseTernaryJSX(c, children);
      if (ternJSXResult) { if (globalThis.__SMITH_DEBUG_MAP_DETECT) globalThis.__dbg.push(`-> consumed by tryParseTernaryJSX`); continue; }
      // Try ternary text: {expr == val ? "str" : "str"}
      const ternTextResult = tryParseTernaryText(c, children);
      if (ternTextResult) { if (globalThis.__SMITH_DEBUG_MAP_DETECT) globalThis.__dbg.push(`-> consumed by tryParseTernaryText`); continue; }
      // Map: {items.map((item, i) => (...))} — syntactic detection (Love2D style)
      if (c.kind() === TK.identifier) {
        const maybeArr = c.text();
        // Detect .map( syntactically FIRST, then find/create OA
        if (c.pos + 3 < c.count && c.kindAt(c.pos + 1) === TK.dot) {
          const savedPeek = c.save();
          c.advance(); c.advance(); // skip identifier, skip .
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
                continue;
              }
            }
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
        const propVal = ctx.propStack[c.text()];
        c.advance();
        if (c.kind() === TK.rbrace) c.advance();
        // OA field refs or Zig expressions inside maps → per-item dynamic text
        const isMapExpr = propVal.includes('_oa') || propVal.includes('[_i]') || propVal.includes('state.get');
        if (ctx.currentMap && isMapExpr) {
          const mapBufId = ctx.dynCount;
          const isStr = propVal.includes('..');
          const fmt = isStr ? '{s}' : '{d}';
          const args = isStr ? propVal : leftFoldExpr(propVal);
          ctx.dynTexts.push({ bufId: mapBufId, fmtString: fmt, fmtArgs: args, arrName: '', arrIndex: 0, bufSize: 256, inMap: true, mapIdx: ctx.maps.indexOf(ctx.currentMap) });
          ctx.dynCount++;
          children.push({ nodeExpr: `.{ .text = "" }` });
        } else {
          children.push({ nodeExpr: `.{ .text = "${propVal}" }` });
        }
      } else if (c.kind() === TK.identifier && isGetter(c.text())) {
        const getter = c.text();
        const slotIdx = findSlot(getter);
        const slot = ctx.stateSlots[slotIdx];
        c.advance();
        // Check for ternary text: getter == N ? "A" : "B"
        if (c.kind() === TK.eq_eq || c.kind() === TK.not_eq || c.kind() === TK.gt || c.kind() === TK.lt || c.kind() === TK.gt_eq || c.kind() === TK.lt_eq) {
          const op = c.kind() === TK.eq_eq ? '==' : c.kind() === TK.not_eq ? '!=' : c.text();
          c.advance();
          if ((op === '==' || op === '!=') && c.kind() === TK.equals) c.advance(); // === / !==
          let rhs = '';
          let rhsIsString = false;
          if (c.kind() === TK.number) { rhs = c.text(); c.advance(); }
          else if (c.kind() === TK.string) { rhs = c.text().slice(1, -1); c.advance(); rhsIsString = true; }
          if (c.kind() === TK.question) {
            c.advance(); // skip ?
            // Parse true branch string
            let trueText = '';
            if (c.kind() === TK.string) { trueText = c.text().slice(1, -1); c.advance(); }
            if (c.kind() === TK.colon) c.advance();
            // Parse false branch — could be another ternary or a string
            let falseExpr = '';
            if (c.kind() === TK.string) {
              falseExpr = `"${c.text().slice(1, -1)}"`;
              c.advance();
            } else if (c.kind() === TK.identifier && isGetter(c.text())) {
              // Nested ternary: getter == M ? "C" : "D"
              const g2 = c.text(); c.advance();
              if (c.kind() === TK.eq_eq || c.kind() === TK.not_eq) {
                const op2 = c.kind() === TK.eq_eq ? '==' : '!='; c.advance();
                if (c.kind() === TK.equals) c.advance();
                let rhs2 = '';
                if (c.kind() === TK.number) { rhs2 = c.text(); c.advance(); }
                else if (c.kind() === TK.string) { rhs2 = c.text().slice(1, -1); c.advance(); }
                if (c.kind() === TK.question) {
                  c.advance();
                  let t2 = ''; if (c.kind() === TK.string) { t2 = c.text().slice(1, -1); c.advance(); }
                  if (c.kind() === TK.colon) c.advance();
                  let f2 = ''; if (c.kind() === TK.string) { f2 = c.text().slice(1, -1); c.advance(); }
                  const cond2 = `(${slotGet(g2)} ${op2} ${rhs2})`;
                  falseExpr = `if ${cond2} @as([]const u8, "${t2}") else @as([]const u8, "${f2}")`;
                }
              }
            }
            if (!falseExpr) falseExpr = '@as([]const u8, "")';
            // Build condition
            let cond;
            if (rhsIsString || slot.type === 'string') {
              const eql = `std.mem.eql(u8, ${slotGet(getter)}, "${rhs}")`;
              cond = op === '!=' ? `(!${eql})` : `(${eql})`;
            } else {
              cond = `(${slotGet(getter)} ${op} ${rhs})`;
            }
            const ternaryExpr = `if ${cond} @as([]const u8, "${trueText}") else @as([]const u8, ${falseExpr})`;
            // Use dynTexts — same as state getters, just with if/else as the format arg
            const bufId = ctx.dynCount;
            const bufSize = Math.max(64, trueText.length + 32);
            ctx.dynTexts.push({ bufId, fmtString: '{s}', fmtArgs: ternaryExpr, arrName: '', arrIndex: 0, bufSize });
            ctx.dynCount++;
            // Consume remaining tokens until }
            let _bd2 = 0;
            while (c.kind() !== TK.eof) {
              if (c.kind() === TK.lbrace) _bd2++;
              if (c.kind() === TK.rbrace) { if (_bd2 === 0) break; _bd2--; }
              c.advance();
            }
            if (c.kind() === TK.rbrace) c.advance();
            children.push({ nodeExpr: '.{ .text = "" }', dynBufId: bufId });
          } else {
            // Not a ternary — consume rest and skip
            while (c.kind() !== TK.rbrace && c.kind() !== TK.eof) c.advance();
            if (c.kind() === TK.rbrace) c.advance();
            children.push({ nodeExpr: '.{ .text = "" }' });
          }
        } else {
          // Simple getter display
          const bufId = ctx.dynCount;
          const fmt = slot.type === 'string' ? '{s}' : slot.type === 'float' ? '{d:.2}' : '{d}';
          const bufSize = slot.type === 'string' ? 128 : 64;
          const args = slotGet(getter);
          ctx.dynTexts.push({ bufId, fmtString: fmt, fmtArgs: args, arrName: '', arrIndex: 0, bufSize });
          ctx.dynCount++;
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
        }
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
    // Inline glyphs: Text with mixed text + <Glyph> children
    const hasGlyphs = children.some(ch => ch.isGlyph);
    if (hasGlyphs && children.length > 0) {
      // Build combined text with \x01 sentinels at glyph positions
      let combinedText = '';
      const glyphExprs = [];
      for (const ch of children) {
        if (ch.isGlyph) {
          combinedText += '\\x01';
          glyphExprs.push(ch.glyphExpr);
        } else if (ch.nodeExpr) {
          const m = ch.nodeExpr.match(/\.text = "(.*)"/);
          if (m) combinedText += m[1];
        }
      }
      parts.push(`.text = "${combinedText}"`);
      parts.push(`.inline_glyphs = &[_]layout.InlineGlyph{ ${glyphExprs.join(', ')} }`);
      children = [];
    }
  }

  // Node-level fields (font_size, text_color) — after text for correct field order
  if (nodeFields && nodeFields.length > 0) {
    for (const nf of nodeFields) parts.push(nf);
  }

  if (handlerRef) {
    // Look up the handler's Lua body for lua_on_press
    const handler = ctx.handlers.find(h => h.name === handlerRef);
    if (handler && handler.luaBody && !handler.body.includes('qjs_runtime.') && !ctx.scriptBlock && !globalThis.__scriptContent) {
      const escaped = handler.luaBody.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
      parts.push(`.handlers = .{ .lua_on_press = "${escaped}" }`);
    } else if ((ctx.scriptBlock || globalThis.__scriptContent) && handler && handler.luaBody) {
      // Script block apps: use js_on_press for QuickJS dispatch
      // Convert Lua operators to JS: and→&&, or→||, ~=→!=, not→!
      let jsBody = handler.luaBody;
      jsBody = jsBody.replace(/\band\b/g, '&&').replace(/\bor\b/g, '||').replace(/~=/g, '!=').replace(/\bnot\b/g, '!');
      const escaped = jsBody.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
      parts.push(`.handlers = .{ .js_on_press = "${escaped}" }`);
    } else {
      parts.push(`.handlers = .{ .on_press = ${handlerRef} }`);
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
        if (dt && !dt.arrName) {
          dt.arrName = arrName; dt.arrIndex = i;
        }
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
        if (dc && !dc.arrName) { dc.arrName = arrName; dc.arrIndex = i; }
      }
      if (children[i].dynStyleId !== undefined) {
        const ds = ctx.dynStyles[children[i].dynStyleId];
        if (ds && !ds.arrName) { ds.arrName = arrName; ds.arrIndex = i; }
      }
      if (children[i].dynStyleIds) {
        for (const dsId of children[i].dynStyleIds) {
          const ds = ctx.dynStyles[dsId];
          if (ds && !ds.arrName) { ds.arrName = arrName; ds.arrIndex = i; }
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

