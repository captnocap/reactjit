(function() {
// ── Pattern 102: Key on fragment ─────────────────────────────────
// Index: 102
// Group: keys
// Status: complete
//
// Soup syntax (copy-paste React):
//   <React.Fragment key={id}><A /><B /></React.Fragment>
//   <Fragment key={item.id}><Text>{item.name}</Text></Fragment>
//
// Mixed syntax (hybrid):
//   Same as soup for this pattern.
//
// Zig output target:
//   // Keys are SILENTLY DROPPED. Fragment compiles to its children
//   // flattened into the parent, same as a keyless fragment:
//   //   <A /> and <B /> become sibling nodes in the parent array.
//   // No wrapper node is emitted for the Fragment.
//
// Notes:
//   Keyed fragments exist in React to maintain identity of a group of
//   elements during reconciliation (e.g., in a map where each iteration
//   returns multiple elements wrapped in a Fragment).
//
//   In Smith, fragments (both <></> and <React.Fragment>) are transparent
//   — their children are flattened into the parent's child array. The key
//   attribute is dropped by the same mechanism as p101 (key on element).
//
//   For maps returning multiple elements per iteration, Smith uses the
//   OA (object array) system to track per-iteration data. The fragment
//   wrapper and its key are not needed.
//
//   Status is "complete" because dropping the key is the correct behavior.

function match(c, ctx) {
  // <Fragment key= or <React.Fragment key=
  if (c.kind() !== TK.lt) return false;
  var saved = c.save();
  c.advance(); // skip <
  if (c.kind() !== TK.identifier) { c.restore(saved); return false; }
  var name = c.text();
  if (name === 'React') {
    c.advance(); // skip React
    if (c.kind() !== TK.dot) { c.restore(saved); return false; }
    c.advance(); // skip .
    if (c.kind() !== TK.identifier || c.text() !== 'Fragment') { c.restore(saved); return false; }
    c.advance(); // skip Fragment
  } else if (name === 'Fragment') {
    c.advance(); // skip Fragment
  } else {
    c.restore(saved); return false;
  }
  // scan attrs for key=
  while (c.pos < c.count) {
    var k = c.kind();
    if (k === TK.gt || k === TK.slash_gt || k === TK.eof) break;
    if (k === TK.identifier && c.text() === 'key') {
      if (c.pos + 1 < c.count && c.kindAt(c.pos + 1) === TK.equals) {
        c.restore(saved); return true;
      }
    }
    c.advance();
  }
  c.restore(saved);
  return false;
}

function compile(c, ctx) {
  return null;
}

_patterns[102] = { id: 102, match: match, compile: compile };

})();
