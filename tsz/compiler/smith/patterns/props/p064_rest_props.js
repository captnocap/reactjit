// ── Pattern 064: rest props ────────────────────────────────────
// Index: 64
// Group: props
// Status: partial
//
// Soup syntax (copy-paste React):
//   function Card({name, ...rest}) {
//     return <Text>{rest.note}</Text>;
//   }
//
// Mixed syntax (hybrid):
//   Same as soup for this pattern.
//
// Zig output target:
//   // Leading named props still inline:
//   <Card name="Ada" note="kept" />
//   // => {name} compiles to "Ada"
//   //
//   // But the rest object is never assembled:
//   //   {rest.note}
//   // => PREFLIGHT BLOCKED (F12 dropped expression {rest.note})
//
// Notes:
//   The signature parser records both `name` and `rest` as identifiers, so
//   the non-rest portion of the destructure survives and behaves like p062.
//
//   The missing behavior is construction of a rest object containing the
//   unmatched props. ctx.propStack is just a flat map of explicitly passed
//   props; there is no second pass that groups "everything else" under `rest`.
//
//   That makes this partial rather than stub:
//     - The signature parses
//     - Explicit named props before ...rest still work
//     - Any access through the rest object fails

function match(c, ctx) {
  // function Name({a, ...rest}) { ... }
  var saved = c.save();
  if (!c.isIdent('function')) return false;
  c.advance();
  if (c.kind() !== TK.identifier) { c.restore(saved); return false; }
  c.advance();
  if (c.kind() !== TK.lparen) { c.restore(saved); return false; }
  c.advance();
  if (c.kind() !== TK.lbrace) { c.restore(saved); return false; }
  c.advance();

  var sawSpread = false;
  while (c.kind() !== TK.rbrace && c.kind() !== TK.eof) {
    if (c.kind() === TK.spread) sawSpread = true;
    c.advance();
  }

  var ok = sawSpread && c.kind() === TK.rbrace;
  c.restore(saved);
  return ok;
}

function compile(c, ctx) {
  // No rest-object synthesis in the live compiler.
  return null;
}
