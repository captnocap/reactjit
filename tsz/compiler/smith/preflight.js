// ── Preflight validation ──
// Pure read-only function. Runs after parseJSXElement (ctx fully populated),
// before emitOutput. Validates ctx for Class A (detectable) and Class B
// (silent wrong-output) bugs.

function preflight(ctx) {
  const errors = [];   // FATAL — block compilation
  const warnings = []; // WARN — compile continues

  // ── Intent derivation (from existing ctx fields, not tracked during parse) ──
  const intents = {
    has_maps:          ctx.maps.length > 0,
    has_map_handlers:  ctx.handlers.some(function(h) { return h.inMap; }),
    has_state:         ctx.stateSlots.length > 0,
    has_script_block:  ctx.scriptBlock !== null || !!globalThis.__scriptContent,
    has_dynTexts:      ctx.dynTexts.length > 0,
    has_dynColors:     ctx.dynColors.length > 0,
    has_dynStyles:     !!(ctx.dynStyles && ctx.dynStyles.length > 0),
    has_classifiers:   Object.keys(ctx.classifiers).length > 0,
    has_components:    ctx.components.length > 0,
    has_object_arrays: ctx.objectArrays.length > 0,
  };

  // ── Lane detection ──
  var lane = 'chad';
  if (intents.has_script_block) lane = 'soup';
  else if (intents.has_dynTexts || intents.has_dynColors || intents.has_dynStyles) lane = 'mixed';

  // ── FATAL checks ──

  // F1: Handler declared with empty body (!body && !luaBody)
  for (var hi = 0; hi < ctx.handlers.length; hi++) {
    var h = ctx.handlers[hi];
    var bodyEmpty = !h.body || h.body.trim() === '' || h.body.trim() === '// undefined';
    var luaEmpty = !h.luaBody || h.luaBody.trim() === '';
    if (bodyEmpty && luaEmpty) {
      warnings.push('F1: handler ' + h.name + ' has empty body and empty luaBody');
    }
  }

  // F3: Map handler (inMap) lacks Lua/JS dispatch body
  // Map handlers need luaBody for ptr array dispatch. Without it, the button is dead.
  for (var hi = 0; hi < ctx.handlers.length; hi++) {
    var h = ctx.handlers[hi];
    if (!h.inMap) continue;
    var luaEmpty = !h.luaBody || h.luaBody.trim() === '';
    if (luaEmpty) {
      errors.push('F3: map handler ' + h.name + ' (map ' + h.mapIdx + ') has no lua dispatch body');
    }
  }

  // F7: Duplicate handler names
  var handlerNames = {};
  for (var hi = 0; hi < ctx.handlers.length; hi++) {
    var name = ctx.handlers[hi].name;
    if (handlerNames[name]) {
      errors.push('F7: duplicate handler name ' + name);
    }
    handlerNames[name] = true;
  }

  // F4: Color{} emitted without dynStyle/dynColor runtime fix
  // Use ctx._orphanColors (tracked at emission point in attrs.js) for precise detection.
  // These are Color{} emissions with NO dynStyle/dynColor backing — guaranteed orphans.
  // Also collect allDecls for F2/F5 checks below.
  var allDecls = ctx.arrayDecls.slice();
  var allComments = (ctx.arrayComments || []).slice();
  for (var mi = 0; mi < ctx.maps.length; mi++) {
    if (ctx.maps[mi].mapArrayDecls) {
      allDecls = allDecls.concat(ctx.maps[mi].mapArrayDecls);
      allComments = allComments.concat(ctx.maps[mi].mapArrayComments || []);
    }
  }
  var orphanColors = ctx._orphanColors ? ctx._orphanColors.length : 0;
  if (orphanColors > 0) {
    var details = ctx._orphanColors.slice(0, 3).map(function(o) { return o.field + '=' + o.value; }).join(', ');
    errors.push('F4: ' + orphanColors + ' Color{} placeholder(s) with no dynStyle/dynColor runtime fix (' + details + ')');
  }
  // W1: Color{} that ARE backed by dynStyle (informational)
  var backedColorCount = 0;
  for (var di = 0; di < allDecls.length; di++) {
    var idx = 0;
    while (true) { var pos = allDecls[di].indexOf('Color{}', idx); if (pos < 0) break; backedColorCount++; idx = pos + 7; }
  }
  backedColorCount = backedColorCount - orphanColors;
  if (backedColorCount > 0) {
    warnings.push('W1: ' + backedColorCount + ' Color{} placeholder(s) (all resolved via dynStyle/dynColor)');
  }

  // F8: Map over non-OA identifier
  // Each map must reference a valid objectArray
  for (var mi = 0; mi < ctx.maps.length; mi++) {
    var m = ctx.maps[mi];
    var oaFound = false;
    for (var oi = 0; oi < ctx.objectArrays.length; oi++) {
      if (ctx.objectArrays[oi].oaIdx === m.oaIdx) { oaFound = true; break; }
    }
    if (!oaFound) {
      errors.push('F8: map ' + mi + ' references oaIdx ' + m.oaIdx + ' but no such objectArray exists');
    }
  }

  // F9: Script function called but not in ctx.scriptFuncs
  // Check handler bodies for qjs_runtime.callGlobal("funcName") patterns
  if (intents.has_script_block) {
    for (var hi = 0; hi < ctx.handlers.length; hi++) {
      var h = ctx.handlers[hi];
      if (!h.body) continue;
      var callMatch = h.body.match(/callGlobal\("(\w+)"\)/g);
      if (callMatch) {
        for (var ci = 0; ci < callMatch.length; ci++) {
          var funcMatch = callMatch[ci].match(/callGlobal\("(\w+)"\)/);
          if (funcMatch) {
            var fname = funcMatch[1];
            if (ctx.scriptFuncs.indexOf(fname) < 0) {
              errors.push('F9: handler ' + h.name + ' calls script function "' + fname + '" but it is not defined in <script> or imports');
            }
          }
        }
      }
    }
  }

  // F10: JS syntax leaked into luaBody
  // When cart has no <script>, handlers get luaBody for Lua dispatch.
  // JS syntax in luaBody = broken Lua at runtime.
  if (!intents.has_script_block) {
    for (var hi = 0; hi < ctx.handlers.length; hi++) {
      var h = ctx.handlers[hi];
      if (!h.luaBody) continue;
      var lb = h.luaBody;
      // Check for JS-only syntax that should never appear in Lua
      if (lb.indexOf('const ') >= 0 || lb.indexOf('let ') >= 0 ||
          lb.indexOf('var ') >= 0 || lb.indexOf('===') >= 0 ||
          lb.indexOf('!==') >= 0 || lb.indexOf('&&') >= 0 ||
          lb.indexOf('||') >= 0) {
        errors.push('F10: handler ' + h.name + ' has JS syntax in luaBody: "' + lb.substring(0, 80) + '"');
      }
    }
  }

  // F2: Handler referenced in .on_press but missing from ctx.handlers
  // Scan arrayDecls for .on_press = NAME and verify the handler exists
  var handlerNameSet = {};
  for (var hi = 0; hi < ctx.handlers.length; hi++) {
    handlerNameSet[ctx.handlers[hi].name] = true;
  }
  for (var di = 0; di < allDecls.length; di++) {
    var onPressMatch = allDecls[di].match(/\.on_press = (\w+)/g);
    if (onPressMatch) {
      for (var pi = 0; pi < onPressMatch.length; pi++) {
        var ref = onPressMatch[pi].replace('.on_press = ', '');
        if (ref !== 'null' && !handlerNameSet[ref]) {
          errors.push('F2: .on_press references handler "' + ref + '" but no such handler exists');
        }
      }
    }
  }

  // F5: OA field accessed but missing from schema
  // Scan arrayDecls + dynTexts for _oaN_FIELD patterns and verify field exists in that OA
  for (var di = 0; di < allDecls.length; di++) {
    var oaRefs = allDecls[di].match(/_oa(\d+)_(\w+)/g);
    if (oaRefs) {
      for (var ri = 0; ri < oaRefs.length; ri++) {
        var refMatch = oaRefs[ri].match(/_oa(\d+)_(\w+)/);
        if (refMatch) {
          var oaIdx = parseInt(refMatch[1]);
          var fieldName = refMatch[2];
          // Skip _lens suffix (string length arrays) and known non-field patterns
          if (fieldName === 'len' || fieldName.endsWith('_lens')) continue;
          var oa = null;
          for (var oi = 0; oi < ctx.objectArrays.length; oi++) {
            if (ctx.objectArrays[oi].oaIdx === oaIdx) { oa = ctx.objectArrays[oi]; break; }
          }
          if (oa && !oa.fields.some(function(f) { return f.name === fieldName; })) {
            errors.push('F5: _oa' + oaIdx + '_' + fieldName + ' accesses field "' + fieldName + '" but OA[' + oaIdx + '] has no such field (schema: [' + oa.fields.map(function(f) { return f.name; }).join(', ') + '])');
          }
        }
      }
    }
  }

  // F6: Template literal expression failed to resolve
  // dynTexts with raw ${expr} in fmtString means resolution failed.
  // BUT: "$" + "{d}" / "{s}" / "{e}" is valid (literal $ + Zig format spec).
  // Only flag ${WORD} where WORD is a JS identifier (2+ chars), not a format char.
  for (var di = 0; di < ctx.dynTexts.length; di++) {
    var dt = ctx.dynTexts[di];
    if (!dt.fmtString) continue;
    // Match ${...} but exclude ${ followed by a single Zig format char + }
    var unresolvedMatch = dt.fmtString.match(/\$\{[a-zA-Z_]\w+\}/);
    if (unresolvedMatch) {
      errors.push('F6: dynText buf ' + dt.bufId + ' has unresolved template literal: "' + dt.fmtString.substring(0, 60) + '"');
    }
  }

  // ── WARN checks ──

  // W2: Map has handlers but they have empty luaBody — lua_ptrs will be allocated but useless
  for (var mi = 0; mi < ctx.maps.length; mi++) {
    var emptyMapHandlers = 0;
    var totalMapHandlers = 0;
    for (var hi = 0; hi < ctx.handlers.length; hi++) {
      if (ctx.handlers[hi].inMap && ctx.handlers[hi].mapIdx === mi) {
        totalMapHandlers++;
        if (!ctx.handlers[hi].luaBody || ctx.handlers[hi].luaBody.trim() === '') emptyMapHandlers++;
      }
    }
    if (totalMapHandlers > 0 && emptyMapHandlers === totalMapHandlers) {
      warnings.push('W2: map ' + mi + ' has ' + totalMapHandlers + ' handler(s) but all have empty luaBody — lua_ptrs will be unused');
    }
  }

  // W4: Prop passed to component but never consumed in its body
  // Check each component call site's prop values against what the component body uses
  // This is approximated by checking if component propNames appear in arrayDecls
  // (a more precise check would require tracking prop usage during parse)

  // W3: State slot declared but never read
  // A state slot that has a setter but whose getter never appears in handlers,
  // dynTexts, dynStyles, or dynColors is likely dead state.
  for (var si = 0; si < ctx.stateSlots.length; si++) {
    var s = ctx.stateSlots[si];
    var getterUsed = false;
    // Check handlers
    for (var hi = 0; hi < ctx.handlers.length && !getterUsed; hi++) {
      var hb = ctx.handlers[hi].body || '';
      if (hb.indexOf('getSlot(' + si + ')') >= 0 || hb.indexOf('getSlotString(' + si + ')') >= 0 ||
          hb.indexOf('getSlotFloat(' + si + ')') >= 0 || hb.indexOf('getSlotBool(' + si + ')') >= 0) {
        getterUsed = true;
      }
    }
    // Check dynTexts
    for (var di = 0; di < ctx.dynTexts.length && !getterUsed; di++) {
      var dt = ctx.dynTexts[di];
      if (dt.fmtArgs && dt.fmtArgs.indexOf('getSlot') >= 0 && dt.fmtArgs.indexOf(String(si)) >= 0) {
        getterUsed = true;
      }
    }
    // Check dynStyles
    if (ctx.dynStyles) {
      for (var di = 0; di < ctx.dynStyles.length && !getterUsed; di++) {
        if (ctx.dynStyles[di].expression && ctx.dynStyles[di].expression.indexOf('getSlot') >= 0) {
          getterUsed = true;
        }
      }
    }
    // Check arrayDecls for state references (conditional nodes, etc.)
    for (var ai = 0; ai < allDecls.length && !getterUsed; ai++) {
      if (allDecls[ai].indexOf('getSlot(' + si + ')') >= 0 || allDecls[ai].indexOf('getSlotString(' + si + ')') >= 0 ||
          allDecls[ai].indexOf('getSlotFloat(' + si + ')') >= 0 || allDecls[ai].indexOf('getSlotBool(' + si + ')') >= 0) {
        getterUsed = true;
      }
    }
    if (!getterUsed) {
      warnings.push('W3: state slot ' + si + ' (' + s.getter + '/' + s.setter + ') declared but getter never read');
    }
  }

  // ── F19: Leaked classifier/tag names as text content ──
  // If a node's .text contains "C.Something>" or ">", it's a tag name that wasn't parsed
  for (var di4 = 0; di4 < allDecls.length; di4++) {
    var textMatch = allDecls[di4].match(/\.text = "([^"]*[A-Z]\w*>)"/);
    if (textMatch && /C\.\w+>/.test(textMatch[1])) {
      errors.push('F19: tag name leaked as text: "' + textMatch[1] + '" — ternary or conditional JSX parse failed');
    }
  }
  // Check for bare ":" as text nodes (ternary colon leaked)
  for (var di5 = 0; di5 < allDecls.length; di5++) {
    if (/\{ \.text = ":" \}/.test(allDecls[di5])) {
      errors.push('F19: bare ":" leaked as text node — ternary colon not consumed by parser');
    }
  }

  // ── F18: JS syntax leaked into Zig node declarations ──
  // Single-quoted multi-char strings, 'exact', ternary operators in text nodes = broken parse
  for (var di3 = 0; di3 < allDecls.length; di3++) {
    var decl = allDecls[di3];
    // Check for single-quoted multi-char strings (JS strings leaked into Zig)
    if (/'\w{2,}'/.test(decl) && decl.indexOf('.text =') >= 0) {
      var leaked = decl.match(/\.text = "([^"]*'[^"]*)"/) || decl.match(/\.text = "([^"]*exact[^"]*)"/);
      if (leaked) {
        errors.push('F18: JS syntax leaked into Zig text node: "' + leaked[1].substring(0, 60) + '"');
      }
    }
    // Check for 'exact' keyword in Zig declarations (should have been resolved)
    if (/\bexact\b/.test(decl) && decl.indexOf('Node{') >= 0) {
      errors.push('F18: unresolved "exact" keyword in Zig declaration (JS ternary not fully parsed)');
    }
  }

  // ── F17: item.* references in non-map dynTexts ──
  // item.field references only make sense inside map pools. If they appear in
  // global _updateDynamicTexts, they reference an undeclared Zig variable.
  for (var dti = 0; dti < ctx.dynTexts.length; dti++) {
    var dt = ctx.dynTexts[dti];
    if (dt.inMap) continue; // map-internal texts are fine
    var args = dt.fmtArgs || '';
    if (args.indexOf('item.') >= 0 || args.indexOf('item)') >= 0) {
      errors.push('F17: dynText buf ' + dt.bufId + ' references "item" outside of a map — will fail with undeclared identifier');
    }
  }
  // Also check conditionals for item references (both in and out of maps — item.X must be resolved to OA field)
  for (var ci2 = 0; ci2 < ctx.conditionals.length; ci2++) {
    var cond = ctx.conditionals[ci2];
    if (cond.condExpr && cond.condExpr.indexOf('item.') >= 0) {
      errors.push('F17: conditional references unresolved "item.' + (cond.condExpr.match(/item\.(\w+)/) || ['','?'])[1] + '" — should be OA field accessor');
    }
  }
  // Check all arrayDecls for raw 'item.' references
  // Exclude JS handler bodies (item.field in JS is valid — it's a JS variable)
  for (var adi = 0; adi < allDecls.length; adi++) {
    if (/\bitem\.\w+/.test(allDecls[adi]) && !/\\\\/.test(allDecls[adi])) {
      var itemField = allDecls[adi].match(/\bitem\.(\w+)/);
      errors.push('F17: array decl references unresolved "item.' + (itemField ? itemField[1] : '?') + '" — Zig has no "item" variable');
    }
  }

  // ── F11: Unresolved classifier components ──
  // C.Name used in JSX but no classifier definition exists — all styling is lost
  if (ctx._unresolvedClassifiers && ctx._unresolvedClassifiers.length > 0) {
    var clsNames = {};
    for (var ci = 0; ci < ctx._unresolvedClassifiers.length; ci++) {
      clsNames[ctx._unresolvedClassifiers[ci].name] = true;
    }
    var uniqueNames = Object.keys(clsNames);
    errors.push('F11: ' + ctx._unresolvedClassifiers.length + ' unresolved classifier component(s): C.' + uniqueNames.join(', C.') + ' — all styling dropped (check .cls.tsz import)');
  }

  // ── F12: Dropped expressions ──
  // {expr} in JSX that didn't match any known pattern — silently produces nothing
  if (ctx._droppedExpressions && ctx._droppedExpressions.length > 0) {
    for (var dei = 0; dei < ctx._droppedExpressions.length; dei++) {
      var de = ctx._droppedExpressions[dei];
      var snippet = de.expr.length > 60 ? de.expr.substring(0, 60) + '...' : de.expr;
      errors.push('F12: dropped expression {' + snippet + '} — not a getter, prop, template, map, or conditional');
    }
  }

  // ── F13: Unknown subsystem tags ──
  // Physics.*, 3D.*, Scene3D, Effect parsed but have no runtime support — produce empty boxes
  if (ctx._unknownSubsystemTags && ctx._unknownSubsystemTags.length > 0) {
    var tagNames = {};
    for (var sti = 0; sti < ctx._unknownSubsystemTags.length; sti++) {
      tagNames[ctx._unknownSubsystemTags[sti].tag] = true;
    }
    var uniqueTags = Object.keys(tagNames);
    errors.push('F13: ' + ctx._unknownSubsystemTags.length + ' unsupported subsystem tag(s): <' + uniqueTags.join('>, <') + '> — no runtime support, rendered as empty boxes');
  }

  // ── F14: Ignored <module> blocks ──
  // <module name> declared in source but not compiled — all FFI/function bindings are dead
  if (ctx._ignoredModuleBlocks && ctx._ignoredModuleBlocks.length > 0) {
    var modNames = ctx._ignoredModuleBlocks.map(function(m) { return m.name; });
    errors.push('F14: ' + modNames.length + ' <module> block(s) ignored: ' + modNames.join(', ') + ' — FFI bindings and namespace functions are dead code');
  }

  // ── F15: Undefined JS function calls ──
  // Functions called in JS_LOGIC but never defined
  if (ctx._undefinedJSCalls && ctx._undefinedJSCalls.length > 0) {
    var seen = {};
    for (var uci = 0; uci < ctx._undefinedJSCalls.length; uci++) {
      var uc = ctx._undefinedJSCalls[uci];
      if (!seen[uc.callee]) {
        errors.push('F15: JS_LOGIC calls undefined function "' + uc.callee + '"');
        seen[uc.callee] = true;
      }
    }
  }

  // ── F16: Duplicate JS variable declarations ──
  if (ctx._duplicateJSVars && ctx._duplicateJSVars.length > 0) {
    var dups = {};
    for (var dvi = 0; dvi < ctx._duplicateJSVars.length; dvi++) {
      dups[ctx._duplicateJSVars[dvi].name] = true;
    }
    errors.push('F16: duplicate var declaration(s) in JS_LOGIC: ' + Object.keys(dups).join(', '));
  }

  // --strict: promote all warnings to errors
  if (globalThis.__strict === 1 && warnings.length > 0) {
    for (var wi = 0; wi < warnings.length; wi++) {
      errors.push('STRICT: ' + warnings[wi]);
    }
  }

  return {
    ok: errors.length === 0,
    errors: errors,
    warnings: warnings,
    lane: lane,
    intents: intents,
  };
}

// Generate @compileError Zig output for preflight failures
function preflightErrorZig(result, file) {
  var out = '//! PREFLIGHT BLOCKED: tsz compiler detected errors in ' + file + '\n';
  for (var i = 0; i < result.errors.length; i++) {
    out += '//! FATAL: ' + result.errors[i] + '\n';
  }
  for (var i = 0; i < result.warnings.length; i++) {
    out += '//! WARN: ' + result.warnings[i] + '\n';
  }
  out += 'comptime { @compileError("Smith preflight failed — ' + result.errors.length + ' error(s). See diagnostics above."); }\n';
  return out;
}
