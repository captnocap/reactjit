// ── Pattern 027: .map() with destructured params ───────────────
// Index: 27
// Group: map
// Status: complete
//
// Soup syntax (copy-paste React):
//   {items.map(({name, id, score}) => (
//     <Box key={id}>
//       <Text>{name}</Text>
//       <Text>{score}</Text>
//     </Box>
//   ))}
//
// Mixed syntax (hybrid):
//   Same as soup for this pattern.
//
// Zig output target:
//   // Destructured aliases map directly to OA fields.
//   // {name} → _oa0_name[_i][0.._oa0_name_lens[_i]]  (string)
//   // {score} → _oa0_score[_i]                         (number)
//   for (0.._oa0_len) |_i| {
//     _map_pool_0[_i] = .{ .children = &_arr_0 };
//     // text children use OA field accessors directly
//   }
//
// Notes:
//   Destructured params in the map callback: ({name, id}) => ...
//   The lexer sees this as: ( { identifier, identifier, ... } ) =>
//
//   readMapParamList() in parse/map/header.js handles this. When it
//   sees TK.lbracket (which the lexer uses for { in this context —
//   actually it checks for destructuring syntax), it collects the
//   alias names into destructuredAliases[].
//
//   _buildDestructuredComputedPlan() in brace.js maps each alias
//   to an OA field. The primary alias becomes the itemParam for
//   scope resolution. renderLocalAliases maps {name} → the OA
//   field accessor for "name".
//
//   _attachMapRenderLocalAliases() in plain.js wires the aliases
//   into mapInfo.renderLocalAliases, which enterMapContext() merges
//   into ctx.renderLocals. After that, any reference to `name` in
//   the template body resolves to the OA field accessor.
//
//   See conformance tests that use destructured params in their
//   map callbacks.

function match(c, ctx) {
  var saved = c.save();
  if (c.kind() !== TK.identifier) { c.restore(saved); return false; }
  c.advance();
  while (c.kind() === TK.dot && c.pos + 1 < c.count) {
    c.advance(); // skip .
    if (c.kind() === TK.identifier && c.text() === 'map') {
      c.advance(); // skip 'map'
      if (c.kind() !== TK.lparen) break;
      c.advance(); // skip (
      // Check if callback param starts with ( then {  — destructured
      if (c.kind() === TK.lparen) {
        c.advance(); // skip inner (
        if (c.kind() === TK.lbrace) { c.restore(saved); return true; }
      }
      // Also match ({ directly (arrow fn shorthand)
      if (c.kind() === TK.lbrace) { c.restore(saved); return true; }
      break;
    }
    if (c.kind() !== TK.identifier) break;
    c.advance(); // skip field name
  }
  c.restore(saved);
  return false;
}

function compile(c, ctx) {
  // Compilation:
  //   1. readMapParamList detects destructuring, collects alias names
  //   2. _buildDestructuredComputedPlan maps aliases → OA fields
  //   3. _attachMapRenderLocalAliases wires into renderLocals
  //   4. Template body resolves bare names through renderLocals
  //   5. Each alias becomes a direct OA field accessor in Zig
  //   6. No runtime destructuring — compile-time field mapping
  return null;
}
