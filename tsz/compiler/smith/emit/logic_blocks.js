// ── JS_LOGIC + LUA_LOGIC generation ──
function emitLogicBlocks(ctx) {
  var out = '';
    // JS/Lua logic — with section dividers matching reference
    out += `\n// \u2500\u2500 Embedded JS logic \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\n`;
    out += `const JS_LOGIC =\n`;
    // Generate JS logic: ambient namespaces + object array setters + script block
    const jsLines = [];

    // ── Ambient namespace objects ──
    // Provides time.*, sys.*, device.*, input.* as JS globals with live getters.
    // Uses existing host functions where available, JS Date for time values.
    jsLines.push('// Ambient namespaces');
    jsLines.push('var time = {');
    jsLines.push('  get hour() { return new Date().getHours(); },');
    jsLines.push('  get minute() { return String(new Date().getMinutes()).padStart(2, "0"); },');
    jsLines.push('  get second() { return String(new Date().getSeconds()).padStart(2, "0"); },');
    jsLines.push('  get year() { return new Date().getFullYear(); },');
    jsLines.push('  get month() { return new Date().getMonth() + 1; },');
    jsLines.push('  get day() { return new Date().getDate(); },');
    jsLines.push('  get fps() { return typeof getFps === "function" ? getFps() : 0; },');
    jsLines.push('  get delta() { return 16; },');
    jsLines.push('  get elapsed() { return Date.now(); },');
    jsLines.push('  get timestamp() { return Date.now(); },');
    jsLines.push('};');
    jsLines.push('var sys = {');
    jsLines.push('  get user() { return typeof __os_user !== "undefined" ? __os_user : "user"; },');
    jsLines.push('  get uptime() { return Math.floor(Date.now() / 1000); },');
    jsLines.push('  get os() { return "linux"; },');
    jsLines.push('  get host() { return "localhost"; },');
    jsLines.push('  get kernel() { return "unknown"; },');
    jsLines.push('};');
    jsLines.push('var device = {');
    jsLines.push('  get width() { return 1280; },');
    jsLines.push('  get height() { return 800; },');
    jsLines.push('  get battery() { return 100; },');
    jsLines.push('  get online() { return true; },');
    jsLines.push('  get dpi() { return 96; },');
    jsLines.push('};');
    jsLines.push('var input = {');
    jsLines.push('  mouse: {');
    jsLines.push('    get x() { return typeof getMouseX === "function" ? getMouseX() : 0; },');
    jsLines.push('    get y() { return typeof getMouseY === "function" ? getMouseY() : 0; },');
    jsLines.push('  },');
    jsLines.push('  keys: { shift: false, ctrl: false, alt: false },');
    jsLines.push('  touch: { count: 0 },');
    jsLines.push('};');
    jsLines.push('');

    // State variable declarations + setter functions in JS
    // Always emit so js_on_press handlers can call setters from QJS.
    // (Previously only emitted for scriptBlock/scriptContent mode.)
    if (!ctx.scriptBlock && !globalThis.__scriptContent) {
      for (const s of ctx.stateSlots) {
        const idx = ctx.stateSlots.indexOf(s);
        jsLines.push(`var ${s.getter} = ${s.type === 'string' ? `'${s.initial}'` : s.initial};`);
        const jsSetter = s.type === 'string' ? '__setStateString' : '__setState';
        jsLines.push(`function ${s.setter}(v) { ${s.getter} = v; ${jsSetter}(${idx}, v); }`);
      }
    }

    // Object array JS var declarations + setters
    // For page mode (scriptBlock): var declarations here, setter functions AFTER scriptBlock
    //   so they override page.js setters that lack __setObjArr calls.
    // For non-page mode: both var + setter here (no conflict).
    var oaInitCalls = [];
    for (const oa of ctx.objectArrays) {
      if (oa.isNested || oa.isConst) continue; // nested OAs unpacked by parent, const OAs are static
      jsLines.push(`var ${oa.getter} = [];`);
      if (!ctx.scriptBlock && !globalThis.__scriptContent) {
        jsLines.push(`function ${oa.setter}(v) { ${oa.getter} = v; __setObjArr${oa.oaIdx}(v); }`);
      }
      // Reconstruct initial data from tokens and schedule setter call
      if (oa.initDataStartPos !== undefined && oa.initDataEndPos !== undefined && oa.setter) {
        var initParts = [];
        for (var ti = oa.initDataStartPos; ti < oa.initDataEndPos; ti++) {
          var tk = globalThis.__cursor.textAt(ti);
          // Convert single-quoted strings to double-quoted for consistent JS
          if (tk.length >= 2 && tk[0] === "'" && tk[tk.length - 1] === "'") {
            var inner = tk.slice(1, -1).replace(/"/g, '\\"');
            tk = '"' + inner + '"';
          }
          initParts.push(tk);
        }
        var initText = initParts.join(' ');
        // Strip outer () from useState( [...] )
        initText = initText.replace(/^\(\s*/, '').replace(/\s*\)\s*$/, '');
        if (initText.length > 2 && initText[0] === '[') {
          oaInitCalls.push(`${oa.setter}(${initText});`);
        }
      }
    }
    // Emit OA init calls after setter definitions are available
    if (oaInitCalls.length > 0) {
      jsLines.push('// OA initial data');
      for (var ii = 0; ii < oaInitCalls.length; ii++) jsLines.push(oaInitCalls[ii]);
    }
    // Script file imports — content passed via __scriptContent
    if (globalThis.__scriptContent) {
      // Emit state variable declarations (same as inline <script> path)
      for (const s of ctx.stateSlots) {
        const idx = ctx.stateSlots.indexOf(s);
        jsLines.push(`var ${s.getter} = ${s.type === 'string' ? `'${s.initial}'` : s.initial};`);
        const jsSetter = s.type === 'string' ? '__setStateString' : '__setState';
        jsLines.push(`function ${s.setter}(v) { ${s.getter} = v; ${jsSetter}(${idx}, v); }`);
        if (s._opaqueFor && s._opaqueSetter) {
          jsLines.push(`var ${s._opaqueFor} = ${s.type === 'string' ? `'${s.initial}'` : s.initial};`);
          jsLines.push(`function ${s._opaqueSetter}(v) { ${s._opaqueFor} = v; ${s.setter}(v); }`);
        }
      }
      // No setter rewriting needed — declared setter functions handle state updates
      // Strip <script>/<\/script> tags and 'export' keywords — file imports include them raw
      // QuickJS eval doesn't support ES module syntax, so 'export' must be removed
      // Strip tags, TS declarations, export keywords, and export { ... } blocks
      var _scriptRaw = globalThis.__scriptContent
        .replace(/export\s*\{[^}]*\}\s*;?/g, '')  // remove export { ... }; blocks entirely
        .split('\n')
        .filter(l => !/^\s*<\/?script>\s*$/.test(l))
        .filter(l => !/^\s*declare\s+/.test(l))
        .map(l => l.replace(/^export\s+/, ''))
        .map(l => l.replace(/:\s*(any|void|string|number|boolean)\b/g, ''));
      const scriptLines = _scriptRaw;
      for (const line of scriptLines) jsLines.push(line);
      jsLines.push('');  // trailing blank line
    }
    // Script block (inline <script>) or script file import — also emit state var declarations
    if (ctx.scriptBlock || globalThis.__scriptContent) {
      if (ctx.scriptBlock) {
        // Only emit state declarations if __scriptContent didn't already emit them
        if (!globalThis.__scriptContent) {
          for (const s of ctx.stateSlots) {
            const idx = ctx.stateSlots.indexOf(s);
            jsLines.push(`var ${s.getter} = ${s.type === 'string' ? `'${s.initial}'` : s.initial};`);
            const jsSetter = s.type === 'string' ? '__setStateString' : '__setState';
            jsLines.push(`function ${s.setter}(v) { ${s.getter} = v; ${jsSetter}(${idx}, v); }`);
            if (s._opaqueFor && s._opaqueSetter) {
              jsLines.push(`var ${s._opaqueFor} = ${s.type === 'string' ? `'${s.initial}'` : s.initial};`);
              jsLines.push(`function ${s._opaqueSetter}(v) { ${s._opaqueFor} = v; ${s.setter}(v); }`);
            }
          }
        }
        for (const line of ctx.scriptBlock.split('\n')) jsLines.push(line);
      }
      // OA setter functions — AFTER scriptBlock so they override any page.js setters
      for (const oa of ctx.objectArrays) {
        if (oa.isNested || oa.isConst) continue;
        jsLines.push(`function ${oa.setter}(v) { ${oa.getter} = v; __setObjArr${oa.oaIdx}(v); }`);
      }
      // Auto-call init(stateProxy) if script exports an init function
      // Convention: export function init(state) { state.arrayName = [...]; state.slotName = val; }
      // The proxy routes state.X = val to setX(val) for both OA setters and state setters.
      if (globalThis.__scriptContent && globalThis.__scriptContent.indexOf('function init(') >= 0) {
        var proxyProps = [];
        for (const oa of ctx.objectArrays) {
          if (oa.isNested || oa.isConst) continue;
          proxyProps.push(`set ${oa.getter}(v) { ${oa.setter}(v); }`);
        }
        for (const s of ctx.stateSlots) {
          proxyProps.push(`set ${s.getter}(v) { ${s.setter}(v); }`);
          if (s._opaqueFor && s._opaqueSetter) proxyProps.push(`set ${s._opaqueFor}(v) { ${s._opaqueSetter}(v); }`);
        }
        if (proxyProps.length > 0) {
          jsLines.push(`if (typeof init === 'function') init({ ${proxyProps.join(', ')} });`);
        }
      }
      // Computed OAs derived from render-local expressions need to be materialized
      // after script/state declarations exist, before the initial Zig-side OA push.
      for (const oa of ctx.objectArrays) {
        if (oa.isNested || oa.isConst) continue;
        if (!oa._computedExpr) continue;
        jsLines.push(`${oa.getter} = ${oa._computedExpr};`);
      }
      // Auto-push initial OA data to Zig side — script block may have set initial values
      // that need to flow through __setObjArr to be visible in the node tree.
      // Without this, data defined in <script> stays in JS-land and maps render empty.
      for (const oa of ctx.objectArrays) {
        if (oa.isNested || oa.isConst) continue;
        jsLines.push(`if (${oa.getter} && ${oa.getter}.length > 0) ${oa.setter}(${oa.getter});`);
      }
      // useEffect bodies — mount-time init code from App body
      if (ctx._useEffectBodies && ctx._useEffectBodies.length > 0) {
        for (const body of ctx._useEffectBodies) {
          jsLines.push(body);
        }
      }
      // setVariant JS wrapper — bridges JS handler calls to Zig theme.setVariant
      if (ctx.variantBindings && ctx.variantBindings.length > 0) {
        jsLines.push(`function setVariant(v) { __setVariant(v); }`);
      }
      // Emit JS wrapper functions for prop-forwarded handler closures
      // These are handlers created from closure props (e.g., onSelect={(next) => { selectTab(next) }})
      // that get called with arguments from inside inlined components (e.g., onSelect(0))
      for (const h of ctx.handlers) {
        if (h.inMap) continue; // map handlers have their own __mapPress wrappers
        if (!h.luaBody) continue;
        if (!h.closureParams || h.closureParams.length === 0) continue;
        // Check if this handler name is referenced in any other handler's luaBody or in node js_on_press strings
        const hName = h.name;
        const isReferenced = ctx.handlers.some(function(h2) { return h2 !== h && h2.luaBody && h2.luaBody.indexOf(hName + '(') >= 0; });
        if (!isReferenced) continue;
        const params = h.closureParams.join(', ');
        let jsBody = h.luaBody || '';
        if (jsBody) jsBody = jsTransform(jsBody);
        jsLines.push(`function ${hName}(${params}) { ${jsBody}; }`);
      }
      // Map press handlers go through LUA_LOGIC — not JS.
      // (JS path removed — all __mapPress_N_M functions are emitted in LUA_LOGIC below)
    }
    // Emit JS wrappers for handlers delegated from Zig (string concat, etc.)
    // This runs outside the scriptBlock conditional since delegated handlers
    // can occur in non-script tests (e.g., component prop string concat).
    var _hasDelegated = ctx.handlers.some(function(h) { return !h.inMap && h._delegateToJs; });
    if (_hasDelegated) {
      // Ensure state var declarations exist in JS_LOGIC for delegated handlers
      if (!ctx.scriptBlock && !globalThis.__scriptContent) {
        for (var _di = 0; _di < ctx.stateSlots.length; _di++) {
          var _ds = ctx.stateSlots[_di];
          var _djsSetter = _ds.type === 'string' ? '__setStateString' : '__setState';
          jsLines.push('var ' + _ds.getter + ' = ' + (_ds.type === 'string' ? "'" + _ds.initial + "'" : _ds.initial) + ';');
          jsLines.push('function ' + _ds.setter + '(v) { ' + _ds.getter + ' = v; ' + _djsSetter + '(' + _di + ', v); }');
        }
      }
      for (var _dhi = 0; _dhi < ctx.handlers.length; _dhi++) {
        var _dh = ctx.handlers[_dhi];
        if (_dh.inMap) continue;
        if (!_dh._delegateToJs) continue;
        var _djsBody = _dh.luaBody || '';
        if (_djsBody) _djsBody = jsTransform(_djsBody);
        if (_djsBody) jsLines.push('function ' + _dh.name + '() { ' + _djsBody + '; }');
      }
    }
    // Append __evalDynTexts for JS-evaluated dynamic text expressions (e.g., {fmtTime()})
    // __computeRenderBody: emit the full render body as a JS function when there are
    // imperative render locals (for loops, Map.set, etc.) that can't be captured as expressions.
    // This replaces the broken individual OA init expressions with one function that runs the
    // full computation and pushes results via OA setters.
    // __computeRenderBody: emit the full render body as a JS function when there are
    // imperative patterns (for loops, new Map, etc.) that individual OA inits can't capture.
    var _rbCompact = ctx._renderBodyRaw ? ctx._renderBodyRaw.replace(/\s+/g, '') : '';
    var _hasImperativeBody = _rbCompact.indexOf('newMap') >= 0 || _rbCompact.indexOf('newSet') >= 0 ||
      _rbCompact.indexOf('.set(') >= 0 || _rbCompact.indexOf('.add(') >= 0 ||
      _rbCompact.indexOf('for(') >= 0 || _rbCompact.indexOf('Array.from') >= 0;
    if (ctx._renderBodyRaw && _hasImperativeBody && ctx.objectArrays.length > 0) {
      jsLines.push('function __computeRenderBody() {');
      jsLines.push('  try {');
      for (var _rbLine of ctx._renderBodyRaw.split(';')) {
        // Replace const/let with var so variables persist in QJS global scope
        // (evalToString calls need to see treeNodes, sortedTags, etc.)
        var _rbl = _rbLine.trim().replace(/^const\s+/, 'var ').replace(/^let\s+/, 'var ');
        if (_rbl.length > 0) jsLines.push('    ' + _rbl + ';');
      }
      // Push all non-const, non-nested OAs — use base name (render body var) not suffixed getter
      for (var _oai = 0; _oai < ctx.objectArrays.length; _oai++) {
        var _oa = ctx.objectArrays[_oai];
        if (_oa.isConst || _oa.isNested) continue;
        var _oaName = _oa._computedGetter || _oa.getter;
        var _oaBaseName = _oaName ? _oaName.replace(/_\d+$/, '') : _oaName;
        jsLines.push('    if (typeof ' + _oaBaseName + ' !== "undefined" && ' + _oaBaseName + ' && ' + _oaBaseName + '.length > 0) ' + _oa.setter + '(' + _oaBaseName + ');');
      }
      jsLines.push('  } catch(e) {}');
      jsLines.push('}');
      jsLines.push('__computeRenderBody();');
      jsLines.push('setInterval(__computeRenderBody, 16);');
    }
    if (ctx._jsDynTexts && ctx._jsDynTexts.length > 0) {
      jsLines.push('function __evalDynTexts() {');
      for (var jdi = 0; jdi < ctx._jsDynTexts.length; jdi++) {
        var jdt = ctx._jsDynTexts[jdi];
        jsLines.push('  try { __setStateString(' + jdt.slotIdx + ', String(' + jdt.jsExpr + ')); } catch(e) {}');
      }
      jsLines.push('}');
      jsLines.push('__evalDynTexts();');
      jsLines.push('setInterval(__evalDynTexts, 16);');
    }
    for (const line of jsLines) {
      out += `    \\\\${line}\n`;
    }
    out += `    \\\\\n;\n`;
    out += `\n// \u2500\u2500 Embedded Lua logic \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\n`;
    out += `const LUA_LOGIC =\n`;
    // Generate Lua state variable declarations + setter functions
    const luaLines = [];
    const hasLuaHandlers = ctx.handlers.some(h => h.luaBody);
    // Emit Lua state setters whenever handlers exist (they dispatch through LuaJIT)
    if (hasLuaHandlers || ctx.stateSlots.length > 0) {
      luaLines.push('-- State variables (mirroring Zig state slots)');
      for (let si = 0; si < ctx.stateSlots.length; si++) {
        const s = ctx.stateSlots[si];
        const luaInit = s.type === 'string' ? `'${s.initial}'` : (s.type === 'boolean' ? (s.initial ? 'true' : 'false') : s.initial);
        luaLines.push(`${s.getter} = ${luaInit}`);
      }
      luaLines.push('');
      // Setter functions: update local + push to Zig state slot
      for (let si = 0; si < ctx.stateSlots.length; si++) {
        const s = ctx.stateSlots[si];
        if (s.type === 'string') {
          luaLines.push(`function ${s.setter}(v) ${s.getter} = v; __setStateString(${si}, v) end`);
        } else {
          luaLines.push(`function ${s.setter}(v) ${s.getter} = v; __setState(${si}, v) end`);
        }
      }
      luaLines.push('');
    }
    // Object array data loading via Lua — needed for any cart with OA-backed maps
    if (ctx.objectArrays.length > 0) {
      for (const oa of ctx.objectArrays) {
        if (oa.isNested || oa.isConst) continue;
        luaLines.push(`${oa.getter} = {}`);
        luaLines.push(`function ${oa.setter}(v) ${oa.getter} = v; __setObjArr${oa.oaIdx}(v) end`);
      }
    }
    // Map handler functions in Lua — MUST come before script content
    // (script may call OA setters that fail in Lua, aborting the rest of the script)
    // (script may call OA setters that fail in Lua, aborting the rest of the script)
    for (let mi = 0; mi < ctx.maps.length; mi++) {
      if (ctx.maps[mi].mapBackend === 'lua_runtime') continue; // handlers wired via lua_on_press in Lua template
      const mapHandlers = ctx.handlers.filter(h => h.inMap && h.mapIdx === mi);
      for (let hi = 0; hi < mapHandlers.length; hi++) {
        const mh = mapHandlers[hi];
        if (mh.luaBody) {
          const m = ctx.maps[mi];
          if (m.isNested && m.parentMap) {
            // Nested map handler — scan for field refs and pass as args from Zig
            // (Lua tables are empty; data lives in Zig OA columns)
            const outerIdxParam = m.parentMap.indexParam || 'gi';
            const innerIdxParam = m.indexParam || 'ii';
            const parentFieldRefs = [];
            const childFieldRefs = [];
            if (m.parentMap.oa) {
              for (const f of m.parentMap.oa.fields) {
                if (f.type === 'nested_array') continue;
                const pat = new RegExp(`\\b${m.parentMap.itemParam}\\.${f.name}\\b`);
                if (pat.test(mh.luaBody)) parentFieldRefs.push(f);
              }
            }
            if (m.oa) {
              for (const f of m.oa.fields) {
                if (f.type === 'nested_array') continue;
                const pat = new RegExp(`\\b${m.itemParam}\\.${f.name}\\b`);
                if (pat.test(mh.luaBody)) childFieldRefs.push(f);
              }
            }
            const params = [outerIdxParam, innerIdxParam,
              ...parentFieldRefs.map(f => `_fp_${f.name}`),
              ...childFieldRefs.map(f => `_fc_${f.name}`)];
            luaLines.push(`function __mapPress_${mi}_${hi}(${params.join(', ')})`);
            let body = luaTransform(mh.luaBody);
            for (const f of parentFieldRefs) {
              body = body.replace(new RegExp(`\\b${m.parentMap.itemParam}\\.${f.name}\\b`, 'g'), `_fp_${f.name}`);
            }
            for (const f of childFieldRefs) {
              body = body.replace(new RegExp(`\\b${m.itemParam}\\.${f.name}\\b`, 'g'), `_fc_${f.name}`);
            }
            luaLines.push(`  ${body}`);
            luaLines.push(`end`);
            // Store field refs for Zig-side ptr building
            if (!m._handlerFieldRefsMap) m._handlerFieldRefsMap = {};
            m._handlerFieldRefsMap[hi] = [...parentFieldRefs, ...childFieldRefs];
            m._nestedParentFieldRefs = m._nestedParentFieldRefs || {};
            m._nestedParentFieldRefs[hi] = parentFieldRefs;
            m._nestedChildFieldRefs = m._nestedChildFieldRefs || {};
            m._nestedChildFieldRefs[hi] = childFieldRefs;
          } else {
            // Top-level map handler — scan for item.field refs and pass as args
            const oa = m.oa;
            const ip = m.itemParam;
            const fieldRefs = [];
            if (typeof globalThis.__SMITH_DEBUG_MAP_TEXT !== 'undefined') {
              ctx._debugLines.push('[MAP_HANDLER_SCAN] mi=' + mi + ' hi=' + hi + ' ip=' + ip + ' luaBody=' + (mh.luaBody || '').substring(0, 120) + ' oa=' + (oa ? 'yes fields=' + oa.fields.map(f => f.name).join(',') : 'null'));
            }
            if (oa) {
              for (const f of oa.fields) {
                if (f.type === 'nested_array') continue;
                const pat = new RegExp(`\\b${ip}\\.${f.name}\\b`);
                const matched = pat.test(mh.luaBody);
                if (typeof globalThis.__SMITH_DEBUG_MAP_TEXT !== 'undefined') {
                  ctx._debugLines.push('[MAP_HANDLER_SCAN]   field=' + f.name + ' pat=' + pat + ' match=' + matched);
                }
                if (matched) fieldRefs.push(f);
              }
            }
            const params = ['idx', ...fieldRefs.map(f => `_f_${f.name}`)];
            luaLines.push(`function __mapPress_${mi}_${hi}(${params.join(', ')})`);
            if (typeof globalThis.__SMITH_DEBUG_MAP_TEXT !== 'undefined') {
              const printArgs = params.map(p => `tostring(${p})`).join(' .. "," .. ');
              luaLines.push(`  print("[MAP_PRESS_DEBUG] __mapPress_${mi}_${hi} args=" .. ${printArgs})`);
            }
            luaLines.push(`  local ${m.indexParam} = idx`);
            let body = luaTransform(mh.luaBody);
            for (const f of fieldRefs) {
              body = body.replace(new RegExp(`\\b${ip}\\.${f.name}\\b`, 'g'), `_f_${f.name}`);
            }
            luaLines.push(`  ${body}`);
            luaLines.push(`end`);
            // Store field refs for Zig ptr building (per-handler)
            if (!m._handlerFieldRefsMap) m._handlerFieldRefsMap = {};
            m._handlerFieldRefsMap[hi] = fieldRefs;
            m._handlerFieldRefs = fieldRefs; // keep for backward compat
          }
          luaLines.push('');
        }
      }
    }
    // Non-map handler closures in Lua (mirrors JS closure wrappers above)
    for (const h of ctx.handlers) {
      if (h.inMap) continue;
      if (!h.luaBody) continue;
      if (!h.closureParams || h.closureParams.length === 0) continue;
      const hName = h.name;
      const isReferenced = ctx.handlers.some(function(h2) { return h2 !== h && h2.luaBody && h2.luaBody.indexOf(hName + '(') >= 0; });
      if (!isReferenced) continue;
      const params = h.closureParams.join(', ');
      const luaBody = luaTransform(h.luaBody);
      luaLines.push(`function ${hName}(${params}) ${luaBody} end`);
    }
    // setVariant Lua wrapper
    if (ctx.variantBindings && ctx.variantBindings.length > 0) {
      luaLines.push(`function setVariant(v) __setVariant(v) end`);
    }
    // Inline <lscript> block content — emitted raw as Lua
    if (ctx.luaBlock) {
      luaLines.push('-- <lscript> block');
      for (const line of ctx.luaBlock.split('\n')) {
        luaLines.push(line);
      }
      luaLines.push('');
    }
    // Lua-side dynamic text evaluation (mirrors JS __evalDynTexts)
    if (ctx._luaDynTexts && ctx._luaDynTexts.length > 0) {
      luaLines.push('-- Dynamic text expressions');
      luaLines.push('local __evalInterval = nil');
      luaLines.push('function __evalDynTexts()');
      for (const ldt of ctx._luaDynTexts) {
        luaLines.push(`  pcall(function() ${ctx.stateSlots[ldt.slotIdx].setter}(tostring(${ldt.luaExpr})) end)`);
      }
      luaLines.push('end');
      luaLines.push('__evalDynTexts()');
      luaLines.push('');
    }
    // Script file imports — NOT included in LUA_LOGIC.
    // QuickJS runs the script content via JS_LOGIC. Including it in Lua
    // causes syntax errors (JS for loops, .push(), etc.) that abort the
    // entire Lua chunk, killing setter/handler definitions above it.
    // Inline script block — NOT included in LUA_LOGIC.
    // Script content goes into JS_LOGIC only. Including it in Lua causes syntax errors
    // (JS arrays, for loops, ===, etc.) that abort the entire Lua chunk.
    // Lua map rebuilders — emitted when .map() sources aren't registered OAs
    if (ctx._luaMapRebuilders && ctx._luaMapRebuilders.length > 0) {
      luaLines.push('-- Lua map rebuilders (detour from Zig OA path)');
      for (var lmi = 0; lmi < ctx._luaMapRebuilders.length; lmi++) {
        var lmr = ctx._luaMapRebuilders[lmi];
        for (var ll of lmr.luaCode.split('\n')) luaLines.push(ll);
      }
      // Master rebuild function called on state change
      luaLines.push('function __rebuildLuaMaps()');
      luaLines.push('  __clearLuaNodes()');
      for (var lmi2 = 0; lmi2 < ctx._luaMapRebuilders.length; lmi2++) {
        luaLines.push('  __rebuildLuaMap' + lmi2 + '()');
      }
      luaLines.push('end');
      luaLines.push('');
    }
    // Emit Lua lines as Zig multiline string
    if (luaLines.length > 0) {
      for (const line of luaLines) {
        out += `    \\\\${line}\n`;
      }
    }
    out += `    \\\\\n;\n\n`;
  return out;
}
