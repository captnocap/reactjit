(function() {
// ── Pattern 083: Switch statement return ────────────────────────
// Index: 83
// Group: conditional_rendering
// Status: complete
//
// Soup syntax (copy-paste React):
//   function StatusBadge({ status }) {
//     switch (status) {
//       case 'active': return <Badge color="green">Active</Badge>;
//       case 'pending': return <Badge color="yellow">Pending</Badge>;
//       default: return <Badge color="gray">Unknown</Badge>;
//     }
//   }
//
// Mixed syntax (hybrid):
//   <if status exact "active">
//     <Badge color="green">Active</Badge>
//   </if>
//   <else if status exact "pending">
//     <Badge color="yellow">Pending</Badge>
//   </else>
//   <else>
//     <Badge color="gray">Unknown</Badge>
//   </else>
//
// Zig output target:
//   // Conditional 0: std.mem.eql(u8, state.getSlotString(N), "active")
//   // nodes[0] = Badge green    (condIdx: 0)
//   // Conditional 1: !(prev) and std.mem.eql(u8, ..., "pending")
//   // nodes[1] = Badge yellow   (condIdx: 1)
//   // Conditional 2: !(prev)
//   // nodes[2] = Badge gray     (condIdx: 2)
//
// Notes:
//   Switch statements in React are a multi-branch conditional pattern.
//   In our compiler, they compile as chained <if>/<else if>/<else> blocks.
//   Each case becomes a separate conditional with string equality checks
//   (std.mem.eql for strings, == for ints). The `default` case becomes
//   a bare <else> with the negation of all previous conditions.
//
//   Soup-mode switch statements in component bodies are handled by
//   writing them as chained <if>/<else if>/<else> in the .tsz source.
//   The compiler's parseIfBlock/parseElseBlock (conditional_blocks.js)
//   handles all the condition chaining, including `exact` for string
//   equality which becomes std.mem.eql(u8, ...).
//
//   This pattern is syntactically identical to p081 (if/else) — the
//   difference is semantic (multiple equality branches vs. boolean guards).
//   The match/compile delegates to the same <if> block infrastructure.

function match(c, ctx) {
  // Switch patterns compile as chained <if>/<else if>/<else>.
  // Match: <if ...> which starts any conditional chain.
  if (c.kind() !== TK.lt) return false;
  if (c.pos + 1 >= c.count) return false;
  if (c.kindAt(c.pos + 1) !== TK.identifier) return false;
  return c.textAt(c.pos + 1) === 'if';
}

function compile(c, ctx) {
  // Compile as <if> block — chained <else if> blocks follow naturally
  // as subsequent siblings parsed by parseChildren.
  var children = [];
  parseIfBlock(c, children);
  return { children: children };
}

_patterns[83] = { id: 83, match: match, compile: compile };

})();
