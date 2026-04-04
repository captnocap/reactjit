(function() {
// ── Pattern 082: Guard clause (return null) ────────────────────
// Index: 82
// Group: conditional_rendering
// Status: complete
//
// Soup syntax (copy-paste React):
//   function App({ user }) {
//     if (!user) return null;
//     return <Profile user={user} />;
//   }
//
// Mixed syntax (hybrid):
//   <if not user>
//     {/* renders nothing — guard clause */}
//   </if>
//   <else>
//     <Profile user={user} />
//   </else>
//
// Zig output target:
//   // Same as p081 — the "return null" case just means the if-branch
//   // has no children, so nothing renders when the guard triggers.
//   // Conditional 0: !(user != 0) → empty
//   // Conditional 1: (user != 0) → Profile nodes
//
// Notes:
//   Guard clauses are a special case of if/else early return where the
//   guarded branch returns null (renders nothing). In soup mode, the
//   compiler sees `if (!user) return null` but doesn't parse it as a
//   conditional — it just skips to the next `return <JSX>`.
//
//   In mixed/chad mode, this is an <if> block with empty or no children
//   followed by an <else> with the real content. The runtime simply
//   hides all nodes when the guard condition is true.
//
//   The guard pattern is the most common conditional in React. It
//   protects against rendering with undefined/null data.

function match(c, ctx) {
  // Same as p081 — this is a semantic variant, not a syntactic one.
  // In the AST, guard clauses are just if-blocks where one branch is empty.
  // The match is identical: <if ...>
  if (c.kind() !== TK.lt) return false;
  if (c.pos + 1 >= c.count) return false;
  if (c.kindAt(c.pos + 1) !== TK.identifier) return false;
  return c.textAt(c.pos + 1) === 'if';
}

function compile(c, ctx) {
  var children = [];
  parseIfBlock(c, children);
  return { children: children };
}

_patterns[82] = { id: 82, match: match, compile: compile };

})();
