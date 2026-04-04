(function() {
// ── Pattern 008: Named/keyed fragment ───────────────────────────
// Index: 8
// Group: primitives
// Status: complete
//
// Soup syntax (copy-paste React):
//   <React.Fragment key={id}><A /><B /></React.Fragment>
//   <Fragment key={id}><A /></Fragment>
//
// Mixed syntax (hybrid):
//   <React.Fragment key={id}><A /><B /></React.Fragment>
//   // Mixed: same as soup for this pattern
//
// Zig output target:
//   .{
//     .sub_nodes = &[_]Node{
//       // children A, B...
//     },
//   }
//
// Notes:
//   Named fragments (React.Fragment or Fragment) behave like regular
//   fragments but can carry a key prop. In our compiler, both Fragment
//   and React.Fragment are recognized tag names. They compile to a Box
//   with no visible style, same as <>. The key is used for reconciliation
//   in React but in our static compiler it's informational only (used
//   for map key tracking in p025/p101).
//
//   The existing compiler handles this through normal tag resolution —
//   'Fragment' and 'React.Fragment' map to Box in htmlTags or are
//   special-cased in tag normalization.

function match(c, ctx) {
  if (c.kind() !== TK.lt) return false;
  if (c.pos + 1 >= c.count) return false;
  if (c.kindAt(c.pos + 1) !== TK.identifier) return false;
  var tag = c.textAt(c.pos + 1);
  if (tag === 'Fragment') return true;
  // React.Fragment — check for React . Fragment
  if (tag === 'React' && c.pos + 3 < c.count &&
      c.kindAt(c.pos + 2) === TK.dot &&
      c.kindAt(c.pos + 3) === TK.identifier &&
      c.textAt(c.pos + 3) === 'Fragment') return true;
  return false;
}

function compile(c, ctx) {
  // Delegate to parseJSXElement which already knows how to handle
  // Fragment tags — it resolves them through normalizeRawTag/resolveTag.
  return parseJSXElement(c);
}

_patterns[8] = { id: 8, match: match, compile: compile };

})();
