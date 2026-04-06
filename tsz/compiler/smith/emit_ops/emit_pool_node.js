// ── Atom 7: emit_pool_node.js — Assign a single pool node ───────
// One function that emits the pool node assignment line:
//   _map_pool_N[iterVar] = <template>;
//
// Handles flat (_map_pool_N[_i]), nested (_map_pool_N[_i][_jj]),
// and inline (_map_pool_N[_i][_j]). The difference is just the
// index expression, not separate logic.
//
// Source: map_pools.js lines 1014-1079 (flat), 664 (nested), 884 (inline)

// emitPoolNodeAssign(mapIdx, iterExpr, poolNode, innerCount, innerRef, indent)
//
// mapIdx:      map index
// iterExpr:    index expression, e.g. '[_i]' or '[_i][_jj]' or '[_i][_j]'
// poolNode:    the template expression string
// innerCount:  number of inner array elements (0 if no inner array)
// innerRef:    inner array variable name (e.g. '_inner_0') or null
// indent:      indentation string
//
// Returns: Zig lines for pool node assignment, including display hoisting
//   when inner node has display conditional but pool node doesn't.

function emitPoolNodeAssign(mapIdx, iterExpr, poolNode, innerCount, innerRef, indent) {
  var out = '';

  // Swap field order: .children before .handlers in map pool nodes (matches reference)
  var hm = poolNode.match(/\.handlers = \.{[^}]+\}/);
  var cm = poolNode.match(/\.children = &[\w\[\]_]+/);
  if (hm && cm) {
    poolNode = poolNode.replace(hm[0] + ', ' + cm[0], cm[0] + ', ' + hm[0]);
  }

  // If inner node has display conditional and pool node doesn't, hoist display to pool
  // so hidden items don't occupy gap space in the parent container
  if (innerCount === 1 && !poolNode.includes('.display') && !poolNode.includes('.style')) {
    poolNode = poolNode.replace('.{', '.{ .style = .{},');
    out += indent + '_map_pool_' + mapIdx + iterExpr + ' = ' + poolNode + ';\n';
    out += indent + '_map_pool_' + mapIdx + iterExpr + '.style.display = ' + innerRef + '[0].style.display;\n';
  } else {
    out += indent + '_map_pool_' + mapIdx + iterExpr + ' = ' + poolNode + ';\n';
  }

  return out;
}
