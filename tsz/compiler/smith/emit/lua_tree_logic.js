// ── Lua tree: JS_LOGIC generation ───────────────────────────
// Builds the JS_LOGIC string: state bindings, script block cleaning,
// init(state) auto-call.

function emitLuaTreeJsLogic(ctx) {
  // Build JS state bindings so script functions can read/write state
  var jsStateBindings = '';
  // Helper: escape a JS string for safe embedding in a Lua eval single-quoted string
  jsStateBindings += 'function __luaEscStr(s) { var r = "", i, c; for (i = 0; i < s.length; i++) { c = s.charCodeAt(i); if (c === 92) r += "\\\\"; else if (c === 39) r += "\\\\\'"; else if (c === 10) r += "\\\\n"; else if (c === 13) r += ""; else r += s.charAt(i); } return r; }\n';
  jsStateBindings += 'var __batching = false;\n';
  jsStateBindings += 'var __pendingState = [];\n';
  jsStateBindings += 'function __beginJsEvent() { __batching = true; __pendingState = []; }\n';
  jsStateBindings += 'function __endJsEvent() { if (!__batching) return; __batching = false; var q = __pendingState; __pendingState = []; for (var i = 0; i < q.length; i++) q[i](); }\n';
  if (ctx.stateSlots && ctx.stateSlots.length > 0) {
    for (var jsi = 0; jsi < ctx.stateSlots.length; jsi++) {
      var js = ctx.stateSlots[jsi];
      // Skip internal slots (prefix `__`) — EXCEPT `__jsExpr_N`, which is the
      // JS-evaluated dynamic text slot created by p010/brace.js for each
      // `{expr}` brace child. It needs a real JS setter so `__evalDynTexts()`
      // can write the evaluated string back into Lua state.
      if (js.getter.indexOf('__') === 0 && js.getter.indexOf('__jsExpr_') !== 0) continue;
      var jsInit = js.initial !== undefined ? JSON.stringify(js.initial) : '0';
      jsStateBindings += 'var ' + js.getter + ' = ' + jsInit + ';\n';
      // JS setter updates local var then calls Lua setter (Lua owns state).
      var _luaSetCall = js.type === 'string'
        ? '__luaEval("' + js.setter + '(\\\'" + __luaEscStr(v) + "\\\')")'
        : '__luaEval("' + js.setter + '(" + v + ")")';
      jsStateBindings += 'function ' + js.setter + '(v) { if (__batching) { __pendingState.push(function(){ ' + js.getter + ' = v; if (__luaReady) { ' + _luaSetCall + '; } else { __markDirty(); } }); return; } ' + js.getter + ' = v; if (__luaReady) { ' + _luaSetCall + '; } else { __markDirty(); } }\n';
    }
  }
  // OA getters in JS — reconstruct initial data from token range
  if (ctx.objectArrays && ctx.objectArrays.length > 0) {
    var _tc = globalThis.__cursor;
    for (var joi = 0; joi < ctx.objectArrays.length; joi++) {
      var joa = ctx.objectArrays[joi];
      var _jsInit = '[]';
      if (!joa.isNested && _tc && joa.initDataStartPos !== undefined && joa.initDataEndPos !== undefined) {
        var _parts = [];
        for (var _ti = joa.initDataStartPos; _ti < joa.initDataEndPos; _ti++) {
          _parts.push(_tc.textAt(_ti));
        }
        var _raw = _parts.join(' ').trim();
        while (_raw.startsWith('(')) _raw = _raw.slice(1).trim();
        while (_raw.endsWith(')')) _raw = _raw.slice(0, -1).trim();
        while (_raw.endsWith(';')) _raw = _raw.slice(0, -1).trim();
        if (_raw.length > 2) _jsInit = _raw;
      } else if (joa.isConst && joa.constData && joa.constData.length > 0) {
        // Const OAs (collected from bare `var/const X = [...]`) have pre-parsed
        // data but no token range. Serialize constData as JSON — QJS eval of
        // map expressions (e.g. `sortedQueue(mockCodeSessions)`) needs the real
        // array to produce non-empty tile content.
        try { _jsInit = JSON.stringify(joa.constData); } catch (_e) { _jsInit = '[]'; }
      }
      jsStateBindings += 'var ' + joa.getter + ' = ' + _jsInit + ';\n';
      if (joa.setter) {
        jsStateBindings += 'function ' + joa.setter + '(v) { ' + joa.getter + ' = v; __markDirty(); }\n';
      }
    }
  }

  // Hoisted module-scope decls from imported .c.tsz/.mod.tsz files.
  // evalLuaMapData expressions like `sortedQueue(...)` or `panelRows(...)` need
  // these functions in QJS global scope. `var props = {}` lets expressions like
  // `props.sessions || mockCodeSessions` degrade gracefully when the component
  // isn't being called with real props from the eval sandbox.
  //
  // Emit order: variables first (`var`/`const`/`let`), functions second. Rationale:
  //  - `const` is subject to the temporal dead zone — a function declared before
  //    a `const X` that reads `X` will crash when called. Declaring values first
  //    and function bodies last keeps the TDZ window closed by the time any hoist
  //    is invoked (all decls run sequentially before anything calls any helper).
  //  - `var` is hoisted-as-undefined either way, but same-bucket ordering keeps
  //    the generated file readable.
  var moduleScopeBindings = 'var props = props || {};\n';
  if (ctx.moduleScopeDecls && ctx.moduleScopeDecls.length > 0) {
    var _seenHoist = {};
    var _varDecls = [];
    var _fnDecls = [];
    // Walk in reverse so last-wins on duplicate names (later files override earlier).
    for (var _md = ctx.moduleScopeDecls.length - 1; _md >= 0; _md--) {
      var _d = ctx.moduleScopeDecls[_md];
      if (_seenHoist[_d.name]) continue;
      if (ctx.stateSlots && ctx.stateSlots.some(function(s) { return s.getter === _d.name; })) continue;
      if (ctx.objectArrays && ctx.objectArrays.some(function(o) { return o.getter === _d.name; })) continue;
      _seenHoist[_d.name] = true;
      if (_d.kind === 'function') _fnDecls.push(_d);
      else _varDecls.push(_d);
    }
    // Normalize `const`/`let` → `var` on hoisted decls. Merged module-scope
    // bindings get invoked from event callbacks (evalLuaMapData, handlers) whose
    // execution order is not the declaration order, so TDZ semantics of
    // `const`/`let` produce "not initialized" errors when a function that
    // transitively reads a const runs before the const statement has executed.
    // `var` is hoisted-as-undefined and — critically — lookup returns the
    // current binding, so cross-decl references resolve regardless of order.
    function _toVar(t) {
      return t.replace(/^\s*(const|let)\s+/, 'var ');
    }
    // Push var/const/let first, then function declarations.
    for (var _vi = 0; _vi < _varDecls.length; _vi++) {
      var _vd = _varDecls[_vi];
      var _vt = _toVar(_vd.text);
      moduleScopeBindings += _vt + (_vt.endsWith(';') || _vt.endsWith('}') ? '' : ';') + '\n';
    }
    for (var _fi = 0; _fi < _fnDecls.length; _fi++) {
      var _fd = _fnDecls[_fi];
      moduleScopeBindings += _fd.text + (_fd.text.endsWith(';') || _fd.text.endsWith('}') ? '' : ';') + '\n';
    }
  }

  // Noop fallbacks for handler-body identifiers that aren't declared anywhere
  // in JS_LOGIC. Cart sources often declare `var onExpand = props.onExpand || function(){}`
  // inside a component body; on inlining, the handler body keeps the bare call
  // but the render-local isn't hoisted to global JS scope. Emit a global noop
  // so QJS eval doesn't throw ReferenceError on click. The guarded pattern
  // preserves the binding when a later decl (state slot, module scope, etc.)
  // actually provides a real function.
  // Noop fallbacks for callables referenced in handlers or the script block
  // that aren't defined in JS_LOGIC. Cart sources commonly declare
  // `var onExpand = props.onExpand || function(){}` inside a component body
  // (doesn't hoist globally) or `declare function setWorkspaceName(...)` in
  // a script (a TS ambient that never gets a JS body). At QJS eval time both
  // throw ReferenceError; guard each with a typeof check so a real binding
  // later still wins via override.
  var _builtins = /^(if|else|for|while|do|return|function|var|let|const|tostring|tonumber|print|pcall|String|Number|Math|Date|JSON|Object|Array|typeof|new|try|catch|eval|undefined|null|true|false|and|or|not|parseInt|parseFloat|isNaN|Boolean)$/;
  var _fallbackAdded = {};
  var _fallbackLines = '';
  var _callRe = /\b([a-zA-Z_][a-zA-Z0-9_]*)\s*\(/g;
  function _harvestNoops(src) {
    if (!src || typeof src !== 'string') return;
    _callRe.lastIndex = 0;
    var _m;
    while ((_m = _callRe.exec(src)) !== null) {
      var _callee = _m[1];
      if (_fallbackAdded[_callee]) continue;
      if (_builtins.test(_callee)) continue;
      if (_callee.indexOf('__') === 0) continue;
      if (_callee === 'qjs_runtime' || _callee === 'state' || _callee === 'props') continue;
      _fallbackAdded[_callee] = 1;
      _fallbackLines += 'if (typeof ' + _callee + " !== 'function') { globalThis." + _callee + ' = function() {}; }\n';
    }
  }
  if (ctx.handlers) {
    for (var _hi = 0; _hi < ctx.handlers.length; _hi++) {
      _harvestNoops(ctx.handlers[_hi].jsBody);
      _harvestNoops(ctx.handlers[_hi].luaBody);
    }
  }
  if (ctx.scriptBlock) _harvestNoops(ctx.scriptBlock);
  if (globalThis.__scriptContent) _harvestNoops(globalThis.__scriptContent);
  moduleScopeBindings += _fallbackLines;

  var jsContent = 'var __luaReady = false;\n' + jsStateBindings + moduleScopeBindings;
  // When FFI decls are present the script block is routed to LUA_LOGIC instead
  if (!ctx._scriptBlockIsLua) {
    if (ctx.scriptBlock) {
      var _jsBlock = ctx.scriptBlock;
      _jsBlock = _jsBlock.replace(/^export\s+/gm, '');
      _jsBlock = _jsBlock.replace(/^declare\s+.*$/gm, '');
      _jsBlock = _jsBlock.replace(/\):\s*\w+[\[\]]*\s*\{/g, ') {');
      _jsBlock = _jsBlock.replace(/(\w)\s*:\s*(string|number|boolean|any|void|never|object)\s*([,\)])/g, '$1$3');
      _jsBlock = _jsBlock.replace(/(\w)\s*:\s*(string|number|boolean|any|void|never|object)\s*(=)/g, '$1 $3');
      _jsBlock = _jsBlock.replace(/(\w)\s*:\s*(string|number|boolean|any|void|never|object)\s*;/g, '$1;');
      jsContent += _jsBlock;
    }
    if (globalThis.__scriptContent) {
      var _scriptCleaned = globalThis.__scriptContent;
      _scriptCleaned = _scriptCleaned.replace(/^<\/?script>$/gm, '');
      _scriptCleaned = _scriptCleaned.replace(/^export\s*\{[^}]*\}\s*;?\s*$/gm, '');
      _scriptCleaned = _scriptCleaned.replace(/^export\s+/gm, '');
      _scriptCleaned = _scriptCleaned.replace(/^declare\s+.*$/gm, '');
      _scriptCleaned = _scriptCleaned.replace(/\):\s*\w+[\[\]]*\s*\{/g, ') {');
      _scriptCleaned = _scriptCleaned.replace(/(\w)\s*:\s*(string|number|boolean|any|void|never|object)\s*([,\)])/g, '$1$3');
      _scriptCleaned = _scriptCleaned.replace(/(\w)\s*:\s*(string|number|boolean|any|void|never|object)\s*(=)/g, '$1 $3');
      _scriptCleaned = _scriptCleaned.replace(/(\w)\s*:\s*(string|number|boolean|any|void|never|object)\s*;/g, '$1;');
      jsContent += (jsContent ? '\n' : '') + _scriptCleaned;
    }
    // Auto-call init(state) if script defines it
    var _scriptSrc = globalThis.__scriptContent || ctx.scriptBlock || '';
    if (/function\s+init\s*\(\s*\w+\s*\)/.test(_scriptSrc)) {
      var _initProps = [];
      if (ctx.objectArrays) {
        for (var _ip = 0; _ip < ctx.objectArrays.length; _ip++) {
          var _oa = ctx.objectArrays[_ip];
          if (_oa.setter) _initProps.push('Object.defineProperty(__is,"' + _oa.getter + '",{set:function(v){' + _oa.setter + '(v)},configurable:true});');
        }
      }
      if (ctx.stateSlots) {
        for (var _is2 = 0; _is2 < ctx.stateSlots.length; _is2++) {
          var _ss = ctx.stateSlots[_is2];
          if (_ss.getter.indexOf('__') === 0) continue;
          _initProps.push('Object.defineProperty(__is,"' + _ss.getter + '",{set:function(v){' + _ss.setter + '(v)},configurable:true});');
        }
      }
      if (_initProps.length > 0) {
        jsContent += '\nvar __is={};' + _initProps.join('') + 'init(__is);\n';
      }
    }
  }

  // JS-evaluated dynamic text expressions — mirrors page.js:756-766.
  // Each brace expression routed to `_jsDynTexts` gets a state slot (__jsExpr_N).
  // This function evaluates every such expr and pushes the string result to the
  // Lua-side state slot, which the Lua render reads via `tostring(__jsExpr_N)`.
  //
  // We go through `eval` (not a direct function body) so that a single bad
  // expression — e.g. one that already had a parse error upstream — doesn't
  // nuke the entire JS_LOGIC at load time. Each try/catch swallows parse +
  // runtime errors per-slot and writes an empty string fallback.
  if (ctx._jsDynTexts && ctx._jsDynTexts.length > 0) {
    var _jsEvalLines = ['function __evalDynTexts() {'];
    for (var _jdi = 0; _jdi < ctx._jsDynTexts.length; _jdi++) {
      var _jdt = ctx._jsDynTexts[_jdi];
      var _escaped = JSON.stringify('String((' + _jdt.jsExpr + '))');
      _jsEvalLines.push('  try { __setJsExpr_' + _jdt.slotIdx + '(eval(' + _escaped + ')); } catch (_e) { __setJsExpr_' + _jdt.slotIdx + '(""); }');
    }
    _jsEvalLines.push('}');
    _jsEvalLines.push('try { __evalDynTexts(); } catch (_e) {}');
    jsContent += '\n' + _jsEvalLines.join('\n') + '\n';
  }

  return jsContent;
}
