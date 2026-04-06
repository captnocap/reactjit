function wrapCondition(expr) {
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
