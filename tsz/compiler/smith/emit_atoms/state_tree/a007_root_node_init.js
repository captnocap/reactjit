// ── Emit Atom 007: Root node init ───────────────────────────────
// Index: 7
// Group: state_tree
// Target: zig
// Status: complete
// Current owner: emit/node_tree.js
//
// Trigger: every successful JSX emit path.
// Output target: _root Node initializer from rootExpr.

function _a007_applies(ctx, meta) {
  void ctx;
  return typeof meta.rootExpr === 'string' && meta.rootExpr.length > 0;
}

function _a007_emit(ctx, meta) {
  void ctx;
  var rootExpr = meta.rootExpr;
  var nodeInit = rootExpr.startsWith('.') ? rootExpr.slice(1) : rootExpr;
  return 'var _root = Node' + nodeInit + ';\n';
}

_emitAtoms[7] = {
  id: 7,
  name: 'root_node_init',
  group: 'state_tree',
  target: 'zig',
  status: 'complete',
  currentOwner: 'emit/node_tree.js',
  applies: _a007_applies,
  emit: _a007_emit,
};
