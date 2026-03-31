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
    // Collect prop values from call site attributes
    const propValues = {};
    while (c.kind() !== TK.gt && c.kind() !== TK.slash_gt && c.kind() !== TK.eof) {
      // JSX prop spread: {...item} — expand all OA fields as individual props
      if (c.kind() === TK.lbrace && c.pos + 3 < c.count && c.kindAt(c.pos + 1) === TK.spread && c.kindAt(c.pos + 2) === TK.identifier) {
        c.advance(); // skip {
        c.advance(); // skip ...
        const spreadName = c.text(); c.advance(); // skip identifier
        if (c.kind() === TK.rbrace) c.advance(); // skip }
        // Resolve spread source: map item → expand all OA fields
        if (ctx.currentMap && spreadName === ctx.currentMap.itemParam) {
          const oa = ctx.currentMap.oa;
          for (const f of oa.fields) {
            if (f.type === 'nested_array') continue;
            if (f.type === 'string') {
              propValues[f.name] = `_oa${oa.oaIdx}_${f.name}[_i][0.._oa${oa.oaIdx}_${f.name}_lens[_i]]`;
            } else {
              propValues[f.name] = `_oa${oa.oaIdx}_${f.name}[_i]`;
            }
          }
        }
        continue;
      }
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
            if (c.kind() === TK.identifier && ctx.propStack && ctx.propStack[c.text()] !== undefined && typeof ctx.propStack[c.text()] === 'string' && ctx.propStack[c.text()].startsWith('_handler_press_')) {
              // Prop-forwarded handler: onTap={onOpen} where onOpen resolves to _handler_press_N
              propValues[attr] = ctx.propStack[c.text()];
              c.advance();
              if (c.kind() === TK.rbrace) c.advance();
              continue;
            } else if (c.kind() === TK.identifier && (isScriptFunc(c.text()) || isSetter(c.text()))) {
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
              // Capture props that contain Zig expressions — emitter needs these
              // to declare JS variables in __mapPress preamble
              const zigProps = {};
              if (ctx.propStack) {
                for (const [pn, pv] of Object.entries(ctx.propStack)) {
                  if (typeof pv !== 'string') continue;
                  if (pv.includes('@as(') || pv.includes('@intCast') || pv.includes('_oa') || pv.includes('state.get') || pv.includes('getSlot')) {
                    zigProps[pn] = pv;
                  }
                }
              }
              const closureParams1 = ctx._lastClosureParams || [];
              ctx.handlers.push({ name: handlerName, body, luaBody, inMap: isMapHandler, mapIdx: isMapHandler ? ctx.maps.indexOf(ctx.currentMap) : -1, zigProps, closureParams: closureParams1 });
            }
            ctx.handlerCount++;
            if (c.kind() === TK.rbrace) c.advance();
            propValues[attr] = handlerName;
          } else if (c.kind() === TK.lbrace) {
            // {expr} prop value — resolve map item access, state getters, etc.
            c.advance();
            // JSX-valued prop (named slot): header={<Component .../>}
            if (c.kind() === TK.lt) {
              const jsxResult = parseJSXElement(c);
              if (c.kind() === TK.rbrace) c.advance();
              propValues[attr] = { __jsxSlot: true, result: jsxResult };
              continue;
            }
            // Detect closure prop: {() => { ... }} or {(args) => { ... }}
            // These are callback props like onOpen={() => { openTicket(i) }}
            if (c.kind() === TK.lparen) {
              // Look ahead: skip parens, check for =>
              let lk = c.pos;
              let pd = 1;
              lk++;
              while (lk < c.count && pd > 0) {
                if (c.kindAt(lk) === TK.lparen) pd++;
                if (c.kindAt(lk) === TK.rparen) pd--;
                lk++;
              }
              if (lk < c.count && c.kindAt(lk) === TK.arrow) {
                // It's a closure — parse as handler
                const handlerName = `_handler_press_${ctx.handlerCount}`;
                const saved = c.save();
                const luaBody = luaParseHandler(c);
                c.restore(saved);
                const body = parseHandler(c);
                const isMapHandler = !!ctx.currentMap;
                const zigProps2 = {};
                if (ctx.propStack) {
                  for (const [pn, pv] of Object.entries(ctx.propStack)) {
                    if (typeof pv !== 'string') continue;
                    if (pv.includes('@as(') || pv.includes('@intCast') || pv.includes('_oa') || pv.includes('state.get') || pv.includes('getSlot')) {
                      zigProps2[pn] = pv;
                    }
                  }
                }
                const closureParams = ctx._lastClosureParams || [];
                ctx.handlers.push({ name: handlerName, body, luaBody, inMap: isMapHandler, mapIdx: isMapHandler ? ctx.maps.indexOf(ctx.currentMap) : -1, zigProps: zigProps2, closureParams });
                ctx.handlerCount++;
                if (c.kind() === TK.rbrace) c.advance();
                propValues[attr] = handlerName;
                continue;
              }
            }
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
                      if (ctx.renderLocals && ctx.renderLocals[expr] !== undefined) { val = ctx.renderLocals[expr]; break; }
                      val += c.text(); // unresolved — keep as-is
                      break;
                    }
                  }
                  ti++;
                }
              } else if (c.kind() === TK.identifier && isGetter(c.text())) val += slotGet(c.text());
              else if (c.kind() === TK.identifier && ctx.renderLocals && ctx.renderLocals[c.text()] !== undefined) val += ctx.renderLocals[c.text()];
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
                if (!resolved) {
                  // Check render locals, then propStack for component prop references
                  if (c.kind() === TK.identifier && ctx.renderLocals && ctx.renderLocals[c.text()] !== undefined) {
                    val += ctx.renderLocals[c.text()];
                  } else if (c.kind() === TK.identifier && ctx.propStack && ctx.propStack[c.text()] !== undefined && typeof ctx.propStack[c.text()] === 'string') {
                    val += ctx.propStack[c.text()];
                  } else {
                    val += c.text();
                  }
                }
              }
              c.advance();
            }
            if (c.kind() === TK.rbrace) c.advance();
            // Convert JS ternary (a == b ? c : d) to Zig if expression
            if (val.indexOf('?') >= 0 && val.indexOf(':') >= 0) {
              const qIdx = val.indexOf('?');
              const cIdx = val.indexOf(':', qIdx);
              if (qIdx > 0 && cIdx > qIdx) {
                const cond = val.substring(0, qIdx).trim();
                const then = val.substring(qIdx + 1, cIdx).trim();
                const els = val.substring(cIdx + 1).trim();
                // Cast integer literals to i64 so they work in runtime if-else (avoids comptime_int error)
                const thenVal = /^-?\d+$/.test(then) ? '@as(i64, ' + then + ')' : then;
                const elsVal = /^-?\d+$/.test(els) ? '@as(i64, ' + els + ')' : els;
                val = 'if (' + cond + ') ' + thenVal + ' else ' + elsVal;
              }
            }
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
  // Canvas.Node / Graph.Node → canvas_node with gx/gy/gw/gh parsed from attributes
  if (rawTag === 'Canvas.Node' || rawTag === 'Graph.Node') {
    nodeFields.push('.canvas_node = true');
  }
  // Canvas.Clamp → viewport-pinned overlay inside Canvas (not transformed by camera)
  if (rawTag === 'Canvas.Clamp') nodeFields.push('.canvas_clamp = true');
  // Canvas.Overlay → viewport-pinned HUD layer (already handled above)
  // Canvas.Overlay → viewport-pinned HUD layer (position: absolute, covers parent)
  if (rawTag === 'Canvas.Overlay') { styleFields.push('.position = .absolute'); styleFields.push('.top = 0'); styleFields.push('.left = 0'); styleFields.push('.right = 0'); styleFields.push('.bottom = 0'); }
  // Terminal → allocate terminal_id
  if (rawTag === 'Terminal') {
    if (!ctx.terminalCount) ctx.terminalCount = 0;
    nodeFields.push(`.terminal_id = ${ctx.terminalCount}`);
    ctx.terminalCount++;
  }
  // TextInput / TextArea → allocate input_id
  if (rawTag === 'TextInput' || rawTag === 'TextArea') {
    if (!ctx.inputCount) ctx.inputCount = 0;
    nodeFields.push(`.input_id = ${ctx.inputCount}`);
    ctx.inputCount++;
  }
  // Scene3D / 3D.View → scene3d container
  if (rawTag === 'Scene3D' || rawTag === '3D.View') nodeFields.push('.scene3d = true');
  // 3D.Mesh
  if (rawTag === '3D.Mesh') nodeFields.push('.scene3d_mesh = true');
  // 3D.Camera
  if (rawTag === '3D.Camera') nodeFields.push('.scene3d_camera = true');
  // 3D.Light
  if (rawTag === '3D.Light') nodeFields.push('.scene3d_light = true');
  // 3D shorthands: Floor/Cube/Sphere/Cylinder → scene3d_mesh + geometry
  if (rawTag === '3D.Floor') { nodeFields.push('.scene3d_mesh = true'); nodeFields.push('.scene3d_geometry = "plane"'); }
  if (rawTag === '3D.Cube') { nodeFields.push('.scene3d_mesh = true'); nodeFields.push('.scene3d_geometry = "box"'); }
  if (rawTag === '3D.Sphere') { nodeFields.push('.scene3d_mesh = true'); nodeFields.push('.scene3d_geometry = "sphere"'); }
  if (rawTag === '3D.Cylinder') { nodeFields.push('.scene3d_mesh = true'); nodeFields.push('.scene3d_geometry = "cylinder"'); }
  // Physics.World → physics_world container
  if (rawTag === 'Physics.World') nodeFields.push('.physics_world = true');
  // Physics.Body → physics_body
  if (rawTag === 'Physics.Body') nodeFields.push('.physics_body = true');
  // Physics.Collider → physics_collider
  if (rawTag === 'Physics.Collider') nodeFields.push('.physics_collider = true');
  // Physics.Wall → static body + collider (shorthand)
  if (rawTag === 'Physics.Wall') { nodeFields.push('.physics_body = true'); nodeFields.push('.physics_body_type = 0'); nodeFields.push('.physics_collider = true'); }
  // Physics.Ball → dynamic circle body + collider (shorthand)
  if (rawTag === 'Physics.Ball') { nodeFields.push('.physics_body = true'); nodeFields.push('.physics_body_type = 2'); nodeFields.push('.physics_collider = true'); nodeFields.push('.physics_shape = 1'); }
  // Physics.Box → dynamic rect body + collider (shorthand)
  if (rawTag === 'Physics.Box') { nodeFields.push('.physics_body = true'); nodeFields.push('.physics_body_type = 2'); nodeFields.push('.physics_collider = true'); nodeFields.push('.physics_shape = 0'); }
  // ascript → Pressable that runs AppleScript on press
  let ascriptScript = null;
  let ascriptOnResult = null;
  const effectiveTag = (rawTag === 'ascript') ? 'Pressable' : tag;

  let handlerRef = null;

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
        } else if (attr === 'onPress' || attr === 'onTap' || attr === 'onToggle' || attr === 'onSelect' || attr === 'onChange') {
          // Bare handler reference: onPress=functionName (no braces) — common in page mode
          if (c.kind() === TK.identifier && c.kindAt(c.pos + 1) !== TK.dot) {
            const fname = c.text();
            c.advance();
            if (isScriptFunc(fname) || isSetter(fname)) {
              const handlerName = `_handler_press_${ctx.handlerCount}`;
              ctx.handlers.push({ name: handlerName, body: `    qjs_runtime.callGlobal("${fname}");\n`, luaBody: `${fname}()` });
              handlerRef = handlerName;
              ctx.handlerCount++;
            }
          } else if (c.kind() === TK.lbrace) {
            c.advance(); // {
            // Prop-passed handler: onPress={onToggle} where onToggle is a component prop
            if (c.kind() === TK.identifier && ctx.propStack && ctx.propStack[c.text()] !== undefined && typeof ctx.propStack[c.text()] === 'string' && ctx.propStack[c.text()].startsWith('_handler_press_')) {
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
              const zigProps3 = {};
              if (ctx.propStack) {
                for (const [pn, pv] of Object.entries(ctx.propStack)) {
                  if (typeof pv !== 'string') continue;
                  if (pv.includes('@as(') || pv.includes('@intCast') || pv.includes('_oa') || pv.includes('state.get') || pv.includes('getSlot')) {
                    zigProps3[pn] = pv;
                  }
                }
              }
              const closureParams3 = ctx._lastClosureParams || [];
              ctx.handlers.push({ name: handlerName, body, luaBody, inMap: isMapHandler, mapIdx: isMapHandler ? ctx.maps.indexOf(ctx.currentMap) : -1, zigProps: zigProps3, closureParams: closureParams3 });
              handlerRef = handlerName;
              ctx.handlerCount++;
              if (c.kind() === TK.rbrace) c.advance(); // }
            }
          }
        } else if (rawTag === 'ascript' && attr === 'run') {
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
        } else if ((attr === 'onSubmit' || attr === 'onChangeText') && (rawTag === 'TextInput' || rawTag === 'TextArea')) {
          // onSubmit/onChangeText={() => expr()} or () => { expr() } → register input callback
          if (c.kind() === TK.lbrace) {
            c.advance(); // skip outer {
            if (c.kind() === TK.lparen) c.advance();
            if (c.kind() === TK.rparen) c.advance();
            if (c.kind() === TK.arrow) c.advance();
            let jsBody = '';
            if (c.kind() === TK.lbrace) {
              // Block body: () => { expr(); }
              c.advance();
              let depth2 = 1;
              while (depth2 > 0 && c.kind() !== TK.eof) {
                if (c.kind() === TK.lbrace) depth2++;
                if (c.kind() === TK.rbrace) { depth2--; if (depth2 === 0) break; }
                jsBody += c.text() + ' ';
                c.advance();
              }
              if (c.kind() === TK.rbrace) c.advance(); // skip inner }
            } else {
              // Expression body: () => expr()
              let depth2 = 1; // track parens for nested calls
              while (c.kind() !== TK.rbrace && c.kind() !== TK.eof) {
                jsBody += c.text() + ' ';
                c.advance();
              }
            }
            jsBody = jsBody.trim().replace(/\s*;\s*$/, '').replace(/\s+/g, ' ');
            if (jsBody.length > 0) {
              const list = attr === 'onSubmit' ? '_inputSubmitHandlers' : '_inputChangeHandlers';
              if (!ctx[list]) ctx[list] = [];
              ctx[list].push({ inputId: ctx.inputCount - 1, jsBody });
            }
            if (c.kind() === TK.rbrace) c.advance(); // skip outer }
          }
        } else if (attr === 'position' && (rawTag.startsWith('3D.') || rawTag === 'Scene3D')) {
          // position={[x, y, z]} → scene3d_pos_x/y/z — supports numbers, negatives, and state variable expressions
          if (c.kind() === TK.lbrace) {
            c.advance(); if (c.kind() === TK.lbracket) { c.advance();
              const vals = [];
              while (c.kind() !== TK.rbracket && c.kind() !== TK.eof) {
                let neg = ''; if (c.kind() === TK.minus) { neg = '-'; c.advance(); }
                if (c.kind() === TK.number) { vals.push(neg + c.text()); c.advance(); }
                else if (c.kind() === TK.identifier) {
                  // State variable or expression — collect tokens until comma or rbracket
                  let expr = neg + c.text(); c.advance();
                  while (c.kind() !== TK.comma && c.kind() !== TK.rbracket && c.kind() !== TK.eof) {
                    expr += ' ' + c.text(); c.advance();
                  }
                  vals.push(expr);
                }
                else { c.advance(); } // skip unrecognized tokens to prevent infinite loop
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
                else if (c.kind() === TK.identifier) {
                  let expr = neg + c.text(); c.advance();
                  while (c.kind() !== TK.comma && c.kind() !== TK.rbracket && c.kind() !== TK.eof) { expr += ' ' + c.text(); c.advance(); }
                  vals.push(expr);
                }
                else { c.advance(); }
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
                else if (c.kind() === TK.identifier) {
                  let expr = neg + c.text(); c.advance();
                  while (c.kind() !== TK.comma && c.kind() !== TK.rbracket && c.kind() !== TK.eof) { expr += ' ' + c.text(); c.advance(); }
                  vals.push(expr);
                }
                else { c.advance(); }
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
        } else if (attr === 'at' && (rawTag.startsWith('3D.') || rawTag.startsWith('Physics.'))) {
          // at={[x, y]} or at={[x, y, z]} → position alias for 3D and Physics
          if (c.kind() === TK.lbrace) {
            c.advance(); if (c.kind() === TK.lbracket) { c.advance();
              const vals = [];
              while (c.kind() !== TK.rbracket && c.kind() !== TK.eof) {
                let neg = ''; if (c.kind() === TK.minus) { neg = '-'; c.advance(); }
                if (c.kind() === TK.number) { vals.push(neg + c.text()); c.advance(); }
                if (c.kind() === TK.comma) c.advance();
              }
              if (c.kind() === TK.rbracket) c.advance();
              if (rawTag.startsWith('Physics.')) {
                if (vals[0]) nodeFields.push(`.physics_x = ${vals[0]}`);
                if (vals[1]) nodeFields.push(`.physics_y = ${vals[1]}`);
              } else {
                if (vals[0]) nodeFields.push(`.scene3d_pos_x = ${vals[0]}`);
                if (vals[1]) nodeFields.push(`.scene3d_pos_y = ${vals[1]}`);
                if (vals[2]) nodeFields.push(`.scene3d_pos_z = ${vals[2]}`);
              }
            } if (c.kind() === TK.rbrace) c.advance();
          }
        } else if (attr === 'size' && rawTag.startsWith('Physics.')) {
          // size={[w, h]} → width/height style for physics bodies
          if (c.kind() === TK.lbrace) {
            c.advance(); if (c.kind() === TK.lbracket) { c.advance();
              const vals = [];
              while (c.kind() !== TK.rbracket && c.kind() !== TK.eof) {
                let neg = ''; if (c.kind() === TK.minus) { neg = '-'; c.advance(); }
                if (c.kind() === TK.number) { vals.push(neg + c.text()); c.advance(); }
                else if (c.kind() === TK.identifier) { let expr = neg + c.text(); c.advance(); while (c.kind() !== TK.comma && c.kind() !== TK.rbracket && c.kind() !== TK.eof) { expr += ' ' + c.text(); c.advance(); } vals.push(expr); }
                else { c.advance(); }
                if (c.kind() === TK.comma) c.advance();
              }
              if (c.kind() === TK.rbracket) c.advance();
              if (vals[0]) styleFields.push(`.width = ${vals[0]}`);
              if (vals[1]) styleFields.push(`.height = ${vals[1]}`);
            } if (c.kind() === TK.rbrace) c.advance();
          }
        } else if (attr === 'size' && rawTag.startsWith('3D.')) {
          // size={[x, y, z]} or size={N} → scene3d_size_x/y/z
          if (c.kind() === TK.lbrace) {
            c.advance();
            if (c.kind() === TK.lbracket) { c.advance();
              const vals = [];
              while (c.kind() !== TK.rbracket && c.kind() !== TK.eof) {
                let neg = ''; if (c.kind() === TK.minus) { neg = '-'; c.advance(); }
                if (c.kind() === TK.number) { vals.push(neg + c.text()); c.advance(); }
                else if (c.kind() === TK.identifier) { let expr = neg + c.text(); c.advance(); while (c.kind() !== TK.comma && c.kind() !== TK.rbracket && c.kind() !== TK.eof) { expr += ' ' + c.text(); c.advance(); } vals.push(expr); }
                else { c.advance(); }
                if (c.kind() === TK.comma) c.advance();
              }
              if (c.kind() === TK.rbracket) c.advance();
              if (vals[0]) nodeFields.push(`.scene3d_size_x = ${vals[0]}`);
              if (vals[1]) nodeFields.push(`.scene3d_size_y = ${vals[1]}`);
              if (vals[2]) nodeFields.push(`.scene3d_size_z = ${vals[2]}`);
            } else if (c.kind() === TK.number) {
              // Scalar size (cube shorthand)
              const s = c.text(); c.advance();
              nodeFields.push(`.scene3d_size_x = ${s}`); nodeFields.push(`.scene3d_size_y = ${s}`); nodeFields.push(`.scene3d_size_z = ${s}`);
            }
            if (c.kind() === TK.rbrace) c.advance();
          } else if (c.kind() === TK.number) {
            const s = c.text(); c.advance();
            nodeFields.push(`.scene3d_size_x = ${s}`); nodeFields.push(`.scene3d_size_y = ${s}`); nodeFields.push(`.scene3d_size_z = ${s}`);
          }
        } else if (attr === 'radius' && rawTag.startsWith('Physics.')) {
          // radius={N} → physics_radius + physics_shape=circle
          if (c.kind() === TK.lbrace) { c.advance(); if (c.kind() === TK.number) { nodeFields.push(`.physics_radius = ${c.text()}`); c.advance(); } if (c.kind() === TK.rbrace) c.advance(); }
          else if (c.kind() === TK.number) { nodeFields.push(`.physics_radius = ${c.text()}`); c.advance(); }
        } else if (attr === 'radius' && rawTag.startsWith('3D.')) {
          // radius={N} → scene3d_radius
          if (c.kind() === TK.lbrace) { c.advance(); if (c.kind() === TK.number) { nodeFields.push(`.scene3d_radius = ${c.text()}`); c.advance(); } if (c.kind() === TK.rbrace) c.advance(); }
          else if (c.kind() === TK.number) { nodeFields.push(`.scene3d_radius = ${c.text()}`); c.advance(); }
        } else if (attr === 'height' && rawTag.startsWith('3D.')) {
          // height={N} → scene3d_size_y
          if (c.kind() === TK.lbrace) { c.advance(); if (c.kind() === TK.number) { nodeFields.push(`.scene3d_size_y = ${c.text()}`); c.advance(); } if (c.kind() === TK.rbrace) c.advance(); }
          else if (c.kind() === TK.number) { nodeFields.push(`.scene3d_size_y = ${c.text()}`); c.advance(); }
        } else if (attr === 'bounce' && rawTag.startsWith('Physics.')) {
          // bounce={N} → physics_restitution
          if (c.kind() === TK.lbrace) { c.advance(); if (c.kind() === TK.number) { nodeFields.push(`.physics_restitution = ${c.text()}`); c.advance(); } if (c.kind() === TK.rbrace) c.advance(); }
          else if (c.kind() === TK.number) { nodeFields.push(`.physics_restitution = ${c.text()}`); c.advance(); }
        } else if (attr === 'mass' && rawTag.startsWith('Physics.')) {
          // mass={N} → physics_density
          if (c.kind() === TK.lbrace) { c.advance(); if (c.kind() === TK.number) { nodeFields.push(`.physics_density = ${c.text()}`); c.advance(); } if (c.kind() === TK.rbrace) c.advance(); }
          else if (c.kind() === TK.number) { nodeFields.push(`.physics_density = ${c.text()}`); c.advance(); }
        } else if (attr === 'gravity' && rawTag === 'Physics.World') {
          // gravity={[x, y]} → physics_gravity_x/y
          if (c.kind() === TK.lbrace) {
            c.advance(); if (c.kind() === TK.lbracket) { c.advance();
              const vals = [];
              while (c.kind() !== TK.rbracket && c.kind() !== TK.eof) {
                let neg = ''; if (c.kind() === TK.minus) { neg = '-'; c.advance(); }
                if (c.kind() === TK.number) { vals.push(neg + c.text()); c.advance(); }
                else if (c.kind() === TK.identifier) { let expr = neg + c.text(); c.advance(); while (c.kind() !== TK.comma && c.kind() !== TK.rbracket && c.kind() !== TK.eof) { expr += ' ' + c.text(); c.advance(); } vals.push(expr); }
                else { c.advance(); }
                if (c.kind() === TK.comma) c.advance();
              }
              if (c.kind() === TK.rbracket) c.advance();
              if (vals[0]) nodeFields.push(`.physics_gravity_x = ${vals[0]}`);
              if (vals[1]) nodeFields.push(`.physics_gravity_y = ${vals[1]}`);
            } if (c.kind() === TK.rbrace) c.advance();
          }
        } else if (attr === 'paused' && rawTag === 'Physics.World') {
          // paused={expr} → skip for now (runtime handles via JS)
          if (c.kind() === TK.lbrace) { skipBraces(c); }
          else if (c.kind() === TK.identifier) c.advance();
        } else if (attr === 'color' && rawTag.startsWith('Physics.')) {
          // color="#hex" → background_color style
          if (c.kind() === TK.string) {
            const val = c.text().slice(1, -1);
            styleFields.push(`.background_color = ${parseColor(val)}`);
            c.advance();
          } else if (c.kind() === TK.lbrace) { skipBraces(c); }
        } else if (attr === 'rotate' && rawTag.startsWith('3D.')) {
          // rotate={[x, y, z]} → scene3d_rot_x/y/z
          if (c.kind() === TK.lbrace) {
            c.advance(); if (c.kind() === TK.lbracket) { c.advance();
              const vals = [];
              while (c.kind() !== TK.rbracket && c.kind() !== TK.eof) {
                let neg = ''; if (c.kind() === TK.minus) { neg = '-'; c.advance(); }
                if (c.kind() === TK.number) { vals.push(neg + c.text()); c.advance(); }
                else if (c.kind() === TK.identifier) { let expr = neg + c.text(); c.advance(); while (c.kind() !== TK.comma && c.kind() !== TK.rbracket && c.kind() !== TK.eof) { expr += ' ' + c.text(); c.advance(); } vals.push(expr); }
                else { c.advance(); }
                if (c.kind() === TK.comma) c.advance();
              }
              if (c.kind() === TK.rbracket) c.advance();
              if (vals[0]) nodeFields.push(`.scene3d_rot_x = ${vals[0]}`);
              if (vals[1]) nodeFields.push(`.scene3d_rot_y = ${vals[1]}`);
              if (vals[2]) nodeFields.push(`.scene3d_rot_z = ${vals[2]}`);
            } if (c.kind() === TK.rbrace) c.advance();
          }
        } else if (attr === 'type' && rawTag === '3D.Light') {
          // type="ambient" / type="directional" → scene3d_light_type
          if (c.kind() === TK.string) {
            nodeFields.push(`.scene3d_light_type = "${c.text().slice(1, -1)}"`);
            c.advance();
          }
        } else if (attr === 'direction' && rawTag === '3D.Light') {
          // direction={[x, y, z]} → scene3d_dir_x/y/z
          if (c.kind() === TK.lbrace) {
            c.advance(); if (c.kind() === TK.lbracket) { c.advance();
              const vals = [];
              while (c.kind() !== TK.rbracket && c.kind() !== TK.eof) {
                let neg = ''; if (c.kind() === TK.minus) { neg = '-'; c.advance(); }
                if (c.kind() === TK.number) { vals.push(neg + c.text()); c.advance(); }
                else if (c.kind() === TK.identifier) { let expr = neg + c.text(); c.advance(); while (c.kind() !== TK.comma && c.kind() !== TK.rbracket && c.kind() !== TK.eof) { expr += ' ' + c.text(); c.advance(); } vals.push(expr); }
                else { c.advance(); }
                if (c.kind() === TK.comma) c.advance();
              }
              if (c.kind() === TK.rbracket) c.advance();
              if (vals[0]) nodeFields.push(`.scene3d_dir_x = ${vals[0]}`);
              if (vals[1]) nodeFields.push(`.scene3d_dir_y = ${vals[1]}`);
              if (vals[2]) nodeFields.push(`.scene3d_dir_z = ${vals[2]}`);
            } if (c.kind() === TK.rbrace) c.advance();
          }
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
