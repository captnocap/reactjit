// ── Emit Atom 006: Static node arrays ───────────────────────────
// Index: 6
// Group: state_tree
// Target: zig
// Status: complete
// Current owner: emit/node_tree.js
//
// Trigger: ctx.arrayDecls has non-promoted arrays.
// Output target: static Node array declarations for the tree.

function _a006_applies(ctx, meta) {
  void meta;
  return ctx.arrayDecls && ctx.arrayDecls.length > 0;
}

function _a006_emit(ctx, meta) {
  var promotedToPerItem = meta.promotedToPerItem || new Set();
  var out = '// \u2500\u2500 Generated node tree \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\n';
  for (var i = 0; i < ctx.arrayDecls.length; i++) {
    var nm = ctx.arrayDecls[i].match(/^var (_arr_\d+)/);
    if (nm && promotedToPerItem.has(nm[1])) continue;
    if (ctx.arrayComments && ctx.arrayComments[i]) out += ctx.arrayComments[i] + '\n';
    out += ctx.arrayDecls[i].replace(/"__mt\d+__"/g, '""') + '\n';
  }
  return out;
}

_emitAtoms[6] = {
  id: 6,
  name: 'static_node_arrays',
  group: 'state_tree',
  target: 'zig',
  status: 'complete',
  currentOwner: 'emit/node_tree.js',
  applies: _a006_applies,
  emit: _a006_emit,
};
