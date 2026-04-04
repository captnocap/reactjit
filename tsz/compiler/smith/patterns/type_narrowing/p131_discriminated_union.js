// ── Pattern 131: Discriminated union render ────────────────────
// Index: 131
// Group: type_narrowing
// Status: complete
//
// Soup syntax (copy-paste React):
//   {item.type === "text" ? <Text>{item.value}</Text> : <Image src={item.url} />}
//   {node.kind === "leaf" ? <Leaf /> : <Branch />}
//
// Mixed syntax (hybrid):
//   // Mixed: same as soup for this pattern
//
// Zig output target:
//   // Same runtime shape as ternary JSX:
//   // both branches exist, display toggled by a string comparison.
//   // Example condition:
//   //   std.mem.eql(u8, _oa0_type[_i][0.._oa0_type_lens[_i]], "text")
//   // true branch:  .flex when condition is true
//   // false branch: .flex when condition is false
//
// Notes:
//   Smith does not understand TypeScript discriminated unions as a type
//   system feature. What it *does* handle is the concrete runtime pattern:
//   a ternary whose condition is a string comparison on a discriminant field.
//
//   This piggybacks entirely on parse/brace/ternary.js:
//     - _parseTernaryCondParts() resolves item.type / item.kind / props / OAs
//     - _resolveStringComparison() rewrites string equality to std.mem.eql()
//     - tryParseTernaryJSX() emits both JSX branches plus a conditional toggle
//
//   Partial because:
//     - No exhaustiveness checking
//     - No real TS narrowing metadata
//     - Works only when the discriminant expression resolves through the
//       existing ternary condition machinery

function match(c, ctx) {
  // Heuristic: ternary with a string literal in the condition before ?.
  var saved = c.save();
  var depth = 0;
  var sawString = false;
  while (c.kind() !== TK.eof && c.kind() !== TK.rbrace) {
    if (c.kind() === TK.lparen) depth++;
    if (c.kind() === TK.rparen) depth--;
    if (c.kind() === TK.string) sawString = true;
    if (c.kind() === TK.question && depth === 0) {
      c.restore(saved);
      return sawString;
    }
    c.advance();
  }
  c.restore(saved);
  return false;
}

function compile(c, children, ctx) {
  // Delegates to the existing ternary JSX compiler.
  return tryParseTernaryJSX(c, children);
}
