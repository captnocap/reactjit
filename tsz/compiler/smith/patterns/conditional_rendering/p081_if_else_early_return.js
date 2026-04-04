(function() {
// ── Pattern 081: If/else early return ───────────────────────────
// Index: 81
// Group: conditional_rendering
// Status: complete
//
// Soup syntax (copy-paste React):
//   function App() {
//     if (!data) return <Loading />;
//     return <Main data={data} />;
//   }
//
// Mixed syntax (hybrid):
//   <if not data>
//     <Loading />
//   </if>
//   <else>
//     <Main data={data} />
//   </else>
//
// Zig output target:
//   // Conditional 0: !(data != 0)
//   // nodes[0] = .{ ... Loading ... }  (condIdx: 0)
//   // Conditional 1: (data != 0)
//   // nodes[1] = .{ ... Main ... }     (condIdx: 1)
//
// Notes:
//   In soup mode, if/else early return is a component-level pattern where
//   the function has multiple return statements guarded by conditions.
//   The compiler handles this by collecting the component body and finding
//   the first `return <JSX>` — it doesn't parse multiple returns.
//
//   In mixed/chad mode, this compiles to <if>/<else> blocks which the
//   compiler handles natively via parseIfBlock/parseElseBlock in
//   parse/children/conditional_blocks.js. Each branch becomes a
//   show_hide conditional in ctx.conditionals, and nodes get a condIdx
//   that the runtime evaluates on every state change.
//
//   Soup early-return is partially supported — the compiler finds the
//   first return with JSX. Multi-return soup components require
//   refactoring to <if>/<else> blocks.

function match(c, ctx) {
  // Matches <if ...> block syntax (chad/mixed)
  if (c.kind() !== TK.lt) return false;
  if (c.pos + 1 >= c.count) return false;
  if (c.kindAt(c.pos + 1) !== TK.identifier) return false;
  return c.textAt(c.pos + 1) === 'if';
}

function compile(c, ctx) {
  // Delegate to parseIfBlock which handles the full <if cond>...</if> lifecycle
  var children = [];
  parseIfBlock(c, children);
  return { children: children };
}

_patterns[81] = { id: 81, match: match, compile: compile };

})();
