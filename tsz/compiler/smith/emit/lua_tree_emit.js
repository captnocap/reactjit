// ── Lua tree emit (orchestrator) ────────────────────────────
// Emits a Lua-first app: Lua owns the tree and state,
// Zig provides a root node and paints whatever Lua builds.
//
// Delegates to:
//   lua_tree_preamble.js — Zig import block
//   lua_tree_nodes.js    — Lua source (state, helpers, App(), __render)
//   lua_tree_logic.js    — JS_LOGIC generation (state bindings, script blocks)
//   lua_tree_entry.js    — _appInit, _appTick, exports, main()

function emitLuaTreeApp(ctx, rootExpr, file) {
  var basename = file.split('/').pop();
  var appName = basename.replace(/\.tsz$/, '');
  var prefix = 'framework/';

  // ── Lua source ──
  var luaStr = emitLuaTreeLuaSource(ctx);
  if (typeof luaStr === 'string' && luaStr.indexOf('widget') >= 0) {
    var widx = luaStr.indexOf('widget');
    print('[LUASTR_TRACE] luaStr around widget: ' + JSON.stringify(luaStr.slice(Math.max(0,widx-40), widx+40)));
  }

  // FINAL JS-ARRAY-LITERAL CLEANUP: smith's transforms occasionally emit
  // bare JS `[]` into the lua source via prop chains that bypass the per-
  // expression translators (e.g. `props.X || []` defaults). Lua doesn't
  // understand `[]` syntax — convert to `{}` table literal. The downstream
  // operator-precedence issue (`or {}.len` parses as `or ({}.len)` instead
  // of `(or {}).len`) is fixed in step 2.
  if (typeof luaStr === 'string') {
    // FALLBACK GLOBALS: smith inlines JS expressions like `props.X` and
    // module-local helper calls (`sortedQueue(...)`, `defaultActiveSpec()`,
    // `buildGrid(...)`, etc.) into lua source text directly. These names
    // don't exist in lua's global scope, so App() crashes at runtime with
    // "attempt to index global 'X' (a nil value)". Declare safe no-op
    // defaults at the top of LUA_LOGIC so App() can execute through to
    // produce its chrome + empty-state nodes. Tiles whose data sources
    // are these helpers render with empty content but their frames + headers
    // still appear, which is closer to the intended visual baseline than
    // a blank window.
    var _fallbackPrelude = '-- Fallback globals for JS-scope identifiers smith inlined into lua source.\n' +
      '-- These let App() run to completion even when the underlying data\n' +
      '-- bridge (evalLuaMapData / __syncToJS) hasn\'t populated the value.\n' +
      'props = props or {}\n' +
      'function _fallback_table() return {} end\n' +
      'function _fallback_id(v) return v end\n' +
      'defaultActiveSpec = defaultActiveSpec or _fallback_table\n' +
      'defaultMemoryPayload = defaultMemoryPayload or function() return { l1 = {}, l2 = {}, l3 = {}, l4 = {}, l5 = {} } end\n' +
      'mockPayload = mockPayload or _fallback_table\n' +
      'mockCodeSessions = mockCodeSessions or {}\n' +
      'mockTranscriptEntries = mockTranscriptEntries or {}\n' +
      'mockInputPrompts = mockInputPrompts or {}\n' +
      'defaultQueueEntries = defaultQueueEntries or _fallback_table\n' +
      'defaultWorkers = defaultWorkers or _fallback_table\n' +
      'defaultMemoryRiverRows = defaultMemoryRiverRows or _fallback_table\n' +
      'defaultEchoRows = defaultEchoRows or _fallback_table\n' +
      'defaultWoundEvents = defaultWoundEvents or _fallback_table\n' +
      'defaultCooccurrenceEdges = defaultCooccurrenceEdges or _fallback_table\n' +
      'sortedQueue = sortedQueue or _fallback_id\n' +
      'workerListFromBoard = workerListFromBoard or _fallback_table\n' +
      'sectionRowsFromBoard = sectionRowsFromBoard or _fallback_table\n' +
      'liveStateBoard = liveStateBoard or function() return nil end\n' +
      'sampleStateBoard = sampleStateBoard or function() return { workers = {}, sections = {}, plan = "", loop_status = "idle" } end\n' +
      'buildGrid = buildGrid or _fallback_table\n' +
      'safePayloadItems = safePayloadItems or _fallback_id\n' +
      'clampMaxTokens = clampMaxTokens or _fallback_id\n' +
      'clampPositiveInt = clampPositiveInt or function(v, d) return v or d or 0 end\n' +
      'scanlineRows = scanlineRows or _fallback_table\n' +
      'paletteMeta = paletteMeta or _fallback_table\n' +
      'marqueeRows = marqueeRows or _fallback_table\n' +
      'panelRows = panelRows or _fallback_table\n' +
      'sortBySalience = sortBySalience or _fallback_id\n' +
      'sortedEdges = sortedEdges or _fallback_id\n' +
      'clampRows = clampRows or _fallback_id\n' +
      'Math = Math or { floor = function(x) return math.floor(x or 0) end }\n' +
      '\n';
    // Emit Lua shims for every JS-side function hoisted into JS_LOGIC. Lua
    // handlers (lua_on_press) eval expressions like `openLandingPage()` —
    // without a Lua-scope binding, the call hits nil and crashes. The shim
    // delegates the call back into QJS via `__eval`, so state writes/reads
    // still live on the JS side.
    var _bridgeNames = {};
    var _scanScriptSrc = (ctx.scriptBlock || '') + '\n' + (globalThis.__scriptContent || '');
    var _fnMatch;
    var _fnRe = /\bfunction\s+([A-Za-z_]\w*)\s*\(/g;
    while ((_fnMatch = _fnRe.exec(_scanScriptSrc)) !== null) {
      _bridgeNames[_fnMatch[1]] = true;
    }
    if (ctx.moduleScopeDecls) {
      for (var _msi = 0; _msi < ctx.moduleScopeDecls.length; _msi++) {
        var _msd = ctx.moduleScopeDecls[_msi];
        if (_msd.kind === 'function') _bridgeNames[_msd.name] = true;
      }
    }
    // Skip names that Lua already has first-class (state setters, OA setters,
    // and anything the fallback prelude defined with a real implementation).
    var _skipShim = { props: 1, mockCodeSessions: 1, mockTranscriptEntries: 1,
      mockInputPrompts: 1, defaultActiveSpec: 1, defaultMemoryPayload: 1,
      mockPayload: 1, defaultQueueEntries: 1, defaultWorkers: 1,
      defaultMemoryRiverRows: 1, defaultEchoRows: 1, defaultWoundEvents: 1,
      defaultCooccurrenceEdges: 1, sortedQueue: 1, workerListFromBoard: 1,
      sectionRowsFromBoard: 1, liveStateBoard: 1, sampleStateBoard: 1,
      buildGrid: 1, safePayloadItems: 1, clampMaxTokens: 1, clampPositiveInt: 1,
      scanlineRows: 1, paletteMeta: 1, marqueeRows: 1, panelRows: 1,
      sortBySalience: 1, sortedEdges: 1, clampRows: 1, Math: 1,
      _fallback_table: 1, _fallback_id: 1,
      __luaEscStr: 1, __beginJsEvent: 1, __endJsEvent: 1 };
    if (ctx.stateSlots) {
      for (var _ssi = 0; _ssi < ctx.stateSlots.length; _ssi++) {
        _skipShim[ctx.stateSlots[_ssi].getter] = 1;
        _skipShim[ctx.stateSlots[_ssi].setter] = 1;
      }
    }
    if (ctx.objectArrays) {
      for (var _oai = 0; _oai < ctx.objectArrays.length; _oai++) {
        _skipShim[ctx.objectArrays[_oai].getter] = 1;
        if (ctx.objectArrays[_oai].setter) _skipShim[ctx.objectArrays[_oai].setter] = 1;
      }
    }
    // Helper that marshals Lua args to a JS call string. Without it the
    // per-function shims below lose their arguments and the JS side sees
    // `fn()` — fine for argless `openLandingPage()` but broken for real
    // calls like `latestPromptForSession(mockInputPrompts, _item.id)`.
    // Primitives (number / string / bool) are inlined as JS literals;
    // complex args fall back to a named JS global of the same identifier
    // (e.g. Lua passes `mockInputPrompts` as a table, JS call uses the
    // JS global `mockInputPrompts` which holds the real data).
    // Helper that marshals Lua args to a JS call string. Without it the
    // per-function shims below lose their arguments and the JS side sees
    // `fn()` — fine for argless `openLandingPage()` but broken for real
    // calls like `latestPromptForSession(mockInputPrompts, _item.id)`.
    // Primitives (number/string/bool) inline as JS literals. Tables probe
    // `_G` for a matching global name — `mockInputPrompts` in Lua resolves
    // to the Lua table, which via rawequal matches the same-name Lua
    // global, so the JS call substitutes the bare name `mockInputPrompts`
    // (evaluated against the JS-side global of the same name, which holds
    // the real data).
    var _shimHelper =
      'function __shimJsCall(fname, ...)\n' +
      '  local args = {...}\n' +
      '  local parts = {}\n' +
      '  local n = select("#", ...)\n' +
      '  for i = 1, n do\n' +
      '    local v = args[i]\n' +
      '    local t = type(v)\n' +
      '    if v == nil then parts[i] = "null"\n' +
      '    elseif t == "number" then parts[i] = tostring(v)\n' +
      '    elseif t == "boolean" then parts[i] = tostring(v)\n' +
      '    elseif t == "string" then\n' +
      '      parts[i] = "\\"" .. v:gsub("\\\\", "\\\\\\\\"):gsub("\\"", "\\\\\\"") .. "\\""\n' +
      '    elseif t == "table" then\n' +
      '      local matchedName = nil\n' +
      '      for k, gv in pairs(_G) do\n' +
      '        if type(k) == "string" and rawequal(gv, v) and k:sub(1,1) ~= "_" then\n' +
      '          matchedName = k; break\n' +
      '        end\n' +
      '      end\n' +
      '      parts[i] = matchedName or "null"\n' +
      '    else parts[i] = "null"\n' +
      '    end\n' +
      '  end\n' +
      '  return __eval(fname .. "(" .. table.concat(parts, ",") .. ")")\n' +
      'end\n';
    var _shimLines = '';
    for (var _bn in _bridgeNames) {
      if (_skipShim[_bn]) continue;
      _shimLines += _bn + ' = ' + _bn + ' or function(...) return __shimJsCall("' + _bn + '", ...) end\n';
    }
    luaStr = _fallbackPrelude + _shimHelper + _shimLines + '\n' + luaStr;

    luaStr = luaStr.replace(/\[\s*\]/g, '{}');
    // Step 2: precedence fix. Wrap `EXPR or {}.len` as `(EXPR or {}).len`.
    // Match a chain of `or` joins ending with a bare `{}.len`, optionally
    // followed by a comparison. Conservative — only fires when the pattern
    // is unambiguous (the OR chain doesn't already start with `(`).
    luaStr = luaStr.replace(/((?:\b(?:[A-Za-z_][\w.()]*|"[^"]*")\s+or\s+)+)\{\}\s*\.\s*len\b/g, '($1{}).len');
    // Step 2b: bare `{}.len` (no preceding OR chain) is invalid lua syntax —
    // you can't access `.len` on a table literal directly. Since `#{}` is
    // always 0, replace `{}.len` with `0`. Pure semantic preservation: this
    // only triggers when the source value resolved to a literal empty table.
    luaStr = luaStr.replace(/\{\}\s*\.\s*len\b/g, '0');
    // Step 3: Zig `if (cond) X else Y` survived translation in some path
    // (typically when smith inlines a render-local that was previously
    // translated to Zig if-expr form, then later embedded in a context that
    // doesn't re-translate). Convert to lua `(cond) and X or Y`. Iterate to
    // handle nested cases.
    for (var _ifPass = 0; _ifPass < 16; _ifPass++) {
      var _ifPos = luaStr.indexOf('if (');
      if (_ifPos < 0) break;
      // Make sure this is a Zig if-EXPR (not a lua `if X then` statement).
      // In lua, `if` is a statement keyword and would be at the start of a line.
      // Zig if-exprs appear inline: `... (if (cond) ... else ...) ...`
      var _depth = 0, _ci = _ifPos + 3, _len = luaStr.length;
      for (; _ci < _len; _ci++) {
        if (luaStr[_ci] === '(') _depth++;
        if (luaStr[_ci] === ')') { _depth--; if (_depth === 0) break; }
      }
      if (_depth !== 0) break;
      var _condText = luaStr.substring(_ifPos + 4, _ci);
      var _afterClose = _ci + 1;
      // Skip whitespace, find true value (one expression up to ` else `).
      var _elseIdx = luaStr.indexOf(' else ', _afterClose);
      if (_elseIdx < 0) break;
      var _trueVal = luaStr.substring(_afterClose, _elseIdx).trim();
      var _falseStart = _elseIdx + 6;
      // False value: scan to the matching close-paren or expression terminator
      // at the SAME depth as the original `if`. The `if` was inside `(...)`,
      // so the false value ends when we hit the matching `)` of the outer paren
      // (which would be at depth -1 from where we are).
      var _fdepth = 0, _fi = _falseStart;
      for (; _fi < _len; _fi++) {
        var _ch = luaStr[_fi];
        if (_ch === '(') _fdepth++;
        else if (_ch === ')') { if (_fdepth === 0) break; _fdepth--; }
      }
      var _falseVal = luaStr.substring(_falseStart, _fi).trim();
      var _prefix = luaStr.substring(0, _ifPos);
      var _suffix = luaStr.substring(_fi);
      luaStr = _prefix + '((' + _condText + ') and ' + _trueVal + ' or ' + _falseVal + ')' + _suffix;
    }
  }

  // ── Zig output ──
  var zig = '';

  // Preamble (imports)
  zig += emitLuaTreePreamble(prefix);

  // State manifest (empty for lua-tree — state lives in Lua)
  zig += '// ── State manifest ──\n';
  zig += '\n';

  // Generated node tree — root only, Lua fills children
  zig += '// ── Generated node tree ──\n';
  zig += 'var _root = Node{ .style = .{ .width = -1, .height = -1 } };\n\n';

  // Effect render functions + WGSL shaders (lua-tree path)
  if (ctx.effectRenders && ctx.effectRenders.length > 0 &&
      typeof _a010_emit === 'function' && typeof _a011_emit === 'function') {
    var _effOut = _a010_emit(ctx, { prefix: prefix });
    var _shdOut = _a011_emit(ctx, { prefix: prefix });
    if (_effOut) zig += _effOut;
    if (_shdOut) zig += _shdOut;
  }

  // Native zscript helpers and runtime wrappers
  var nativeSection = emitNativeZscriptSection(ctx);
  if (nativeSection) {
    zig += nativeSection;
    if (nativeSection.charAt(nativeSection.length - 1) !== '\n') zig += '\n';
    zig += '\n';
  }

  // JS_LOGIC
  zig += '// ── Embedded JS logic ──\n';
  var jsContent = emitLuaTreeJsLogic(ctx);
  if (jsContent) {
    zig += 'const JS_LOGIC =\n';
    var jsLines = jsContent.split('\n');
    for (var ji = 0; ji < jsLines.length; ji++) {
      zig += '    \\\\' + jsLines[ji] + '\n';
    }
    zig += ';\n\n';
  } else {
    zig += 'const JS_LOGIC = "";\n\n';
  }

  // LUA_LOGIC
  zig += '// ── Embedded Lua logic ──\n';
  zig += 'const LUA_LOGIC =\n';
  var luaLines = luaStr.split('\n');
  for (var li = 0; li < luaLines.length; li++) {
    zig += '    \\\\' + luaLines[li] + '\n';
  }
  zig += ';\n\n';

  // Entry: init, tick, exports, main
  zig += emitLuaTreeEntry(ctx, appName, prefix);

  return zig;
}

function _luaLiteral(val) {
  if (val === null || val === undefined) return 'nil';
  if (typeof val === 'number') return String(val);
  if (typeof val === 'string') return luaStringLiteral(val);
  if (typeof val === 'boolean') return val ? 'true' : 'false';
  return 'nil';
}
