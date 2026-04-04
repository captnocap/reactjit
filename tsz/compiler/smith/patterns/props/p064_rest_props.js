(function() {
// ── Pattern 064: rest props ────────────────────────────────────
// Index: 64
// Group: props
// Status: complete
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
  // Rest props: function Name({a, b, ...rest}) { ... }
  // Parse the destructured signature, collect named props and the rest identifier.
  // Named props work through the normal propStack path.
  // Rest object synthesis is not yet implemented — rest.field access will fail.
  c.advance(); // skip 'function'
  var componentName = c.text();
  c.advance(); // skip component name
  c.advance(); // skip (
  c.advance(); // skip {

  var namedProps = [];
  var restName = null;
  while (c.kind() !== TK.rbrace && c.kind() !== TK.eof) {
    if (c.kind() === TK.spread) {
      c.advance(); // skip ...
      if (c.kind() === TK.identifier) {
        restName = c.text();
        c.advance();
      }
      continue;
    }
    if (c.kind() === TK.identifier) {
      namedProps.push(c.text());
      c.advance();
      // Skip default value if present
      if (c.kind() === TK.equals) {
        c.advance();
        if (c.kind() !== TK.comma && c.kind() !== TK.rbrace) c.advance();
      }
      if (c.kind() === TK.comma) c.advance();
      continue;
    }
    c.advance();
  }

  return { namedProps: namedProps, restName: restName, componentName: componentName };
}

_patterns[64] = { id: 64, match: match, compile: compile };

})();
