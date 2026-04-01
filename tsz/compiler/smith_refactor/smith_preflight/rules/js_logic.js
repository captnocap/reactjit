// ── Preflight JS logic rules ─────────────────────────────────────

function checkIgnoredModuleBlocks(ctx, errors) {
  if (!(ctx._ignoredModuleBlocks && ctx._ignoredModuleBlocks.length > 0)) return;
  var modNames = ctx._ignoredModuleBlocks.map(function(m) { return m.name; });
  errors.push('F14: ' + modNames.length + ' <module> block(s) ignored: ' + modNames.join(', ') + ' — FFI bindings and namespace functions are dead code');
}

function checkUndefinedJSCalls(ctx, errors) {
  if (!(ctx._undefinedJSCalls && ctx._undefinedJSCalls.length > 0)) return;
  var seen = {};
  for (var uci = 0; uci < ctx._undefinedJSCalls.length; uci++) {
    var uc = ctx._undefinedJSCalls[uci];
    if (!seen[uc.callee]) {
      errors.push('F15: JS_LOGIC calls undefined function "' + uc.callee + '"');
      seen[uc.callee] = true;
    }
  }
}

function checkDuplicateJSVars(ctx, errors) {
  if (!(ctx._duplicateJSVars && ctx._duplicateJSVars.length > 0)) return;
  var dups = {};
  for (var dvi = 0; dvi < ctx._duplicateJSVars.length; dvi++) {
    dups[ctx._duplicateJSVars[dvi].name] = true;
  }
  errors.push('F16: duplicate var declaration(s) in JS_LOGIC: ' + Object.keys(dups).join(', '));
}
