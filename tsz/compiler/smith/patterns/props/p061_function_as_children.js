// ── Pattern 061: function-as-children ──────────────────────────
// Index: 61
// Group: props
// Status: stub
//
// Soup syntax (copy-paste React):
//   <DataProvider>
//     {(value) => <Text>{value}</Text>}
//   </DataProvider>
//
// Mixed syntax (hybrid):
//   Same as soup for this pattern.
//
// Zig output target:
//   // Not currently emitted.
//   //
//   // The child arrow function is rejected during child parsing:
//   //   F12: dropped expression {(value) => <Text>{value}</Text>}
//   //
//   // No callable child template reaches component inlining.
//
// Notes:
//   parseComponentCallChildren() can capture ordinary JSX children and
//   stash them in ctx.componentChildren, and parse/children/brace.js can
//   splice bare {children} back into the inlined component body.
//
//   The missing piece is the function child itself. A brace child whose
//   contents are an arrow function is not recognized by tryParseBraceChild():
//   it is neither a getter, prop, map, ternary, nor logical expression, so
//   preflight reports F12 "dropped expression".
//
//   That means both forms are unsupported today:
//     1. Passing a function as the only child
//     2. Calling children(...) inside the component body
//
//   This is intentionally marked stub, not partial, because the defining
//   callable child payload never survives parsing.

function match(c, ctx) {
  // Brace child whose contents are an arrow function:
  //   {(x) => ...}
  //   {x => ...}
  var saved = c.save();

  if (c.kind() === TK.lparen) {
    var depth = 1;
    c.advance();
    while (c.pos < c.count && depth > 0) {
      if (c.kind() === TK.lparen) depth++;
      if (c.kind() === TK.rparen) depth--;
      c.advance();
    }
    var parenArrow = c.kind() === TK.arrow;
    c.restore(saved);
    return parenArrow;
  }

  if (c.kind() === TK.identifier && c.pos + 1 < c.count && c.kindAt(c.pos + 1) === TK.arrow) {
    c.restore(saved);
    return true;
  }

  c.restore(saved);
  return false;
}

function compile(c, ctx) {
  // Not implemented in the live compiler.
  return null;
}
