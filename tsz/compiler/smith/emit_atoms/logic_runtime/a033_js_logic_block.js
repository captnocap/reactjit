// ── Emit Atom 033: JS logic block ───────────────────────────────
// Index: 33
// Group: logic_runtime
// Target: js_in_zig
// Status: complete
// Current owner: emit_split.js
//
// Trigger: every emitOutput() call (JS_LOGIC is always emitted).
// Output target: const JS_LOGIC = multiline Zig string containing
//   ambient namespaces, OA var declarations/setters, script blocks,
//   map handlers, delegated handlers, __computeRenderBody, __evalDynTexts.
//
// Notes:
//   Emit order within JS_LOGIC:
//     1. Ambient namespace objects (time, sys, device, input)
//     2. OA var declarations + setter functions (non-page mode)
//     3. OA initial data pushes
//     4. Script file imports (__scriptContent) with state vars
//     5. Inline <script> block with state vars
//     6. OA setters AFTER scriptBlock (override page.js setters)
//     7. init(stateProxy) auto-call for script file exports
//     8. Computed OA materialization
//     9. OA auto-push to Zig side
//    10. useEffect mount bodies
//    11. setVariant JS wrapper
//    12. Prop-forwarded handler closures
//    13. JS map press handlers (__mapPress_N_M)
//    14. Delegated Zig→JS handler wrappers
//    15. __computeRenderBody (imperative render patterns)
//    16. __evalDynTexts (JS-evaluated dynamic text expressions)
//
//   Lines emitted as Zig multiline string: \\line\n
//   Terminated with \\\n;\n

function _a033_applies(ctx, meta) {
  void meta;
  return !!ctx;
}

function _a033_stripTsForLuaTree(jsSource) {
  var cleaned = jsSource || '';
  cleaned = cleaned.replace(/^<\/?script>$/gm, '');
  cleaned = cleaned.replace(/^export\s*\{[^}]*\}\s*;?\s*$/gm, '');
  cleaned = cleaned.replace(/^export\s+/gm, '');
  cleaned = cleaned.replace(/^declare\s+.*$/gm, '');
  cleaned = cleaned.replace(/\):\s*\w+[\[\]]*\s*\{/g, ') {');
  cleaned = cleaned.replace(/(\w)\s*:\s*(string|number|boolean|any|void|never|object)\s*([,\)])/g, '$1$3');
  cleaned = cleaned.replace(/(\w)\s*:\s*(string|number|boolean|any|void|never|object)\s*(=)/g, '$1 $3');
  cleaned = cleaned.replace(/(\w)\s*:\s*(string|number|boolean|any|void|never|object)\s*;/g, '$1;');
  return cleaned;
}

function _a033_emitLuaTreeJsLogic(ctx) {
  var jsStateBindings = '';
  jsStateBindings += 'function __luaEscStr(s) { var r = "", i, c; for (i = 0; i < s.length; i++) { c = s.charCodeAt(i); if (c === 92) r += "\\\\\\\\"; else if (c === 39) r += "\\\\\\\'"; else if (c === 10) r += "\\\\n"; else if (c === 13) r += ""; else r += s.charAt(i); } return r; }\n';

  if (ctx.stateSlots && ctx.stateSlots.length > 0) {
    for (var jsi = 0; jsi < ctx.stateSlots.length; jsi++) {
      var js = ctx.stateSlots[jsi];
      if (js.getter.indexOf('__') === 0) continue;
      var jsInit = js.initial !== undefined ? JSON.stringify(js.initial) : '0';
      jsStateBindings += 'var ' + js.getter + ' = ' + jsInit + ';\n';
      var luaSetCall = js.type === 'string'
        ? '__luaEval("' + js.setter + '(\\\'" + __luaEscStr(v) + "\\\')")'
        : '__luaEval("' + js.setter + '(" + v + ")")';
      jsStateBindings += 'function ' + js.setter + '(v) { ' + js.getter + ' = v; if (__luaReady) ' + luaSetCall + '; else __markDirty(); }\n';
    }
  }

  if (ctx.objectArrays && ctx.objectArrays.length > 0) {
    var tc = globalThis.__cursor;
    for (var joi = 0; joi < ctx.objectArrays.length; joi++) {
      var joa = ctx.objectArrays[joi];
      var jsInit2 = '[]';
      if (!joa.isNested && tc && joa.initDataStartPos !== undefined && joa.initDataEndPos !== undefined) {
        var parts = [];
        for (var ti = joa.initDataStartPos; ti < joa.initDataEndPos; ti++) {
          parts.push(tc.textAt(ti));
        }
        var raw = parts.join(' ').trim();
        while (raw.startsWith('(')) raw = raw.slice(1).trim();
        while (raw.endsWith(')')) raw = raw.slice(0, -1).trim();
        while (raw.endsWith(';')) raw = raw.slice(0, -1).trim();
        if (raw.length > 2) jsInit2 = raw;
      }
      jsStateBindings += 'var ' + joa.getter + ' = ' + jsInit2 + ';\n';
      if (joa.setter) {
        jsStateBindings += 'function ' + joa.setter + '(v) { ' + joa.getter + ' = v; __markDirty(); }\n';
      }
    }
  }

  var jsContent = 'var __luaReady = false;\n' + jsStateBindings;
  if (!ctx._scriptBlockIsLua) {
    if (ctx.scriptBlock) jsContent += _a033_stripTsForLuaTree(ctx.scriptBlock);
    if (globalThis.__scriptContent) {
      var scriptCleaned = _a033_stripTsForLuaTree(globalThis.__scriptContent);
      jsContent += (jsContent ? '\n' : '') + scriptCleaned;
    }

    var scriptSrc = globalThis.__scriptContent || ctx.scriptBlock || '';
    if (/function\s+init\s*\(\s*\w+\s*\)/.test(scriptSrc)) {
      var initProps = [];
      if (ctx.objectArrays) {
        for (var ip = 0; ip < ctx.objectArrays.length; ip++) {
          var oa = ctx.objectArrays[ip];
          if (oa.setter) initProps.push('Object.defineProperty(__is,"' + oa.getter + '",{set:function(v){' + oa.setter + '(v)},configurable:true});');
        }
      }
      if (ctx.stateSlots) {
        for (var is2 = 0; is2 < ctx.stateSlots.length; is2++) {
          var ss = ctx.stateSlots[is2];
          if (ss.getter.indexOf('__') === 0) continue;
          initProps.push('Object.defineProperty(__is,"' + ss.getter + '",{set:function(v){' + ss.setter + '(v)},configurable:true});');
        }
      }
      if (initProps.length > 0) {
        jsContent += '\nvar __is={};' + initProps.join('') + 'init(__is);\n';
      }
    }
  }

  return jsContent;
}

function _a033_emit(ctx, meta) {
  void meta;
  var jsLines = [];

  if (ctx._luaRootNode) {
    var luaTreeJs = _a033_emitLuaTreeJsLogic(ctx);
    if (luaTreeJs) {
      var ltLines = luaTreeJs.split('\n');
      for (var lti = 0; lti < ltLines.length; lti++) {
        if (ltLines[lti].length > 0) jsLines.push(ltLines[lti]);
      }
    }
  } else {
    if (ctx.scriptBlock) {
      var jsBlock = jsTransform(ctx.scriptBlock);
      jsBlock.split('\n').forEach(function(l) { if (l.length > 0) jsLines.push(l); });
    }
    if (globalThis.__scriptContent) {
      jsTransform(globalThis.__scriptContent).split('\n').forEach(function(l) { if (l.length > 0) jsLines.push(l); });
    }
  }

  // Emit JS_LOGIC
  var out = '// ── Embedded JS logic ──────────────────────────────────────────\n';
  if (jsLines.length > 0) {
    out += 'const JS_LOGIC =\n';
    for (var ji = 0; ji < jsLines.length; ji++) {
      out += '    \\\\' + jsLines[ji] + '\n';
    }
    out += ';\n\n';
  } else {
    out += 'const JS_LOGIC = "";\n\n';
  }

  return out;
}

_emitAtoms[33] = {
  id: 33,
  name: 'js_logic_block',
  group: 'logic_runtime',
  target: 'js_in_zig',
  status: 'complete',
  currentOwner: 'emit_split.js',
  applies: _a033_applies,
  emit: _a033_emit,
};
