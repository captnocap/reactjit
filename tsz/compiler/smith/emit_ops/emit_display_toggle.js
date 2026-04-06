// ── Atom 8: emit_display_toggle.js — Conditional display ────────
// One function that emits style.display = if (condition) .flex else .none
// for show/hide and ternary_jsx conditionals in map contexts.
//
// Source: map_pools.js lines 530-537 (flat per-item), 856-862 (inline per-item),
//         870-875 (inline inner), 968-991 (flat inner)

// _wrapMapCondition is duplicated here from map_pools.js line 4-18 for standalone use.
// OA fields are i64, so bare values need != 0. But !(i64) is invalid Zig --
// negated expressions need (expr == 0) instead of !(expr) != 0.

function wrapMapCondition(expr) {
  var isComp = expr.includes('==') || expr.includes('!=') ||
    expr.includes('>=') || expr.includes('<=') ||
    expr.includes(' > ') || expr.includes(' < ') ||
    expr.includes('std.mem.eql') || expr.includes('getSlotBool');
  if (isComp) return '(' + expr + ')';
  if (expr.match(/^!\s*\(/)) {
    var inner = expr.replace(/^!\s*\(/, '').replace(/\)\s*$/, '');
    return '((' + inner + ') == 0)';
  }
  if (expr.startsWith('!')) {
    return '((' + expr.slice(1).trim() + ') == 0)';
  }
  return '((' + expr + ') != 0)';
}

// emitDisplayToggle(target, condition, kind, trueIdx, falseIdx, indent)
//
// target:     the array access expression, e.g. '_pi_arr_0_0' or '_inner_0' or '_map_inner_1[_i][_j]'
// condition:  the resolved condition expression (already has OA refs etc)
// kind:       'show_hide' or 'ternary_jsx'
// trueIdx:    index of the true branch node
// falseIdx:   index of the false branch node (only used for ternary_jsx)
// indent:     indentation string
//
// Returns: Zig lines for display toggling.

function emitDisplayToggle(target, condition, kind, trueIdx, falseIdx, indent) {
  var out = '';
  var wrapped = wrapMapCondition(condition);

  if (kind === 'show_hide') {
    out += indent + target + '[' + trueIdx + '].style.display = if ' + wrapped + ' .flex else .none;\n';
  } else if (kind === 'ternary_jsx') {
    out += indent + target + '[' + trueIdx + '].style.display = if ' + wrapped + ' .flex else .none;\n';
    out += indent + target + '[' + falseIdx + '].style.display = if ' + wrapped + ' .none else .flex;\n';
  }

  return out;
}
