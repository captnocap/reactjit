// ── Emit Atom 036: Conditional updates ──────────────────────────
// Index: 36
// Group: logic_runtime
// Target: zig
// Status: complete
// Current owner: emit/runtime_updates.js
//
// Trigger: ctx.conditionals.length > 0 with non-map entries.
// Output target: fn _updateConditionals() void { ... }
//
// Notes:
//   Emits a Zig function that toggles display .flex/.none on
//   conditional nodes based on state comparisons.
//
//   Two conditional kinds:
//     - show_hide: single branch, toggles trueIdx display
//     - ternary_jsx: two branches, trueIdx shows / falseIdx hides (and vice versa)
//
//   Skips: inMap entries, map pool arrays, entries with per-item
//   index refs (_i), and task/tag scoped expressions.
//   Comparison expressions get double-wrapped: ((expr)).
//   Non-comparison expressions get != 0 test: ((expr) != 0).

function _a036_applies(ctx, meta) {
  void meta;
  return ctx.conditionals && ctx.conditionals.length > 0;
}

function _a036_emit(ctx, meta) {
  void meta;
  var mapPoolArrayNames = new Set();
  for (var mi = 0; mi < ctx.maps.length; mi++) {
    var map = ctx.maps[mi];
    if (map._mapPerItemDecls) {
      for (var pi = 0; pi < map._mapPerItemDecls.length; pi++) mapPoolArrayNames.add(map._mapPerItemDecls[pi].name);
    }
    if (map.mapArrayDecls) {
      for (var mdi = 0; mdi < map.mapArrayDecls.length; mdi++) {
        var mdMatch = map.mapArrayDecls[mdi].match(/^var (_arr_\d+)/);
        if (mdMatch) mapPoolArrayNames.add(mdMatch[1]);
      }
    }
  }

  var out = 'fn _updateConditionals() void {\n';
  for (var ci = 0; ci < ctx.conditionals.length; ci++) {
    var cond = ctx.conditionals[ci];
    if (!cond.arrName) continue;
    if (cond.inMap) continue;
    if (mapPoolArrayNames.has(cond.arrName)) continue;
    if (cond.condExpr.includes('[_i]') || cond.condExpr.includes('(_i)') || cond.condExpr.includes('task.') || cond.condExpr.includes('tag.') || cond.condExpr.includes(' ci') || cond.condExpr.includes(' ti')) continue;
    // evalToString as outermost call returns []const u8 — needs .len > 0
    // But evalToString INSIDE std.mem.eql() already produces bool — don't double-wrap.
    // Also: JS inside eval strings contains > < == which false-positive isComparison.
    var isOuterEval = cond.condExpr.includes('evalToString') && !cond.condExpr.includes('std.mem.eql') && !cond.condExpr.includes('.len > 0');
    var isComparison = !isOuterEval && (cond.condExpr.includes('==') || cond.condExpr.includes('!=') ||
      cond.condExpr.includes('>=') || cond.condExpr.includes('<=') ||
      cond.condExpr.includes(' > ') || cond.condExpr.includes(' < ') ||
      cond.condExpr.includes('getBool') || cond.condExpr.includes('getSlotBool') || cond.condExpr.includes('std.mem.eql'));
    var wrapped = isOuterEval ? '((' + cond.condExpr + ').len > 0)' :
      isComparison ? '((' + cond.condExpr + '))' :
      '((' + cond.condExpr + ') != 0)';
    if (cond.kind === 'show_hide') {
      out += '    ' + cond.arrName + '[' + cond.trueIdx + '].style.display = if ' + wrapped + ' .flex else .none;\n';
    } else if (cond.kind === 'ternary_jsx') {
      out += '    ' + cond.arrName + '[' + cond.trueIdx + '].style.display = if ' + wrapped + ' .flex else .none;\n';
      out += '    ' + cond.arrName + '[' + cond.falseIdx + '].style.display = if ' + wrapped + ' .none else .flex;\n';
    }
  }
  out += '}\n\n';
  return out;
}

_emitAtoms[36] = {
  id: 36,
  name: 'conditional_updates',
  group: 'logic_runtime',
  target: 'zig',
  status: 'complete',
  currentOwner: 'emit/runtime_updates.js',
  applies: _a036_applies,
  emit: _a036_emit,
};
