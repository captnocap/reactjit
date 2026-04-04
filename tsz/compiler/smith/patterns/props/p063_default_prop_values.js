// ── Pattern 063: default prop values ───────────────────────────
// Index: 63
// Group: props
// Status: partial
//
// Soup syntax (copy-paste React):
//   function Greeting({name = "anon"}) {
//     return <Text>{name}</Text>;
//   }
//
// Mixed syntax (hybrid):
//   Same as soup for this pattern.
//
// Zig output target:
//   // Explicit prop still inlines through the normal destructured-param path:
//   <Greeting name="Ada" />
//   // => var _root = Node{ .text = "Ada" };
//   //
//   // Missing prop default is NOT materialized today:
//   <Greeting />
//   // => PREFLIGHT BLOCKED (F12 dropped expression {name})
//
// Notes:
//   collectComponents() still records `name` from `{name = "anon"}` because
//   it scans identifiers inside the destructuring braces. That means explicit
//   call-site props continue to work.
//
//   What is missing is a default-value synthesis step. inlineComponentCall()
//   only forwards props that were actually present on the opening tag, so
//   ctx.propStack has no fallback entry when `name` is omitted.
//
//   The result is genuinely partial:
//     - Works when the caller supplies the prop
//     - Fails when the default value should kick in

function match(c, ctx) {
  // function Name({name = ...}) { ... }
  var saved = c.save();
  if (!c.isIdent('function')) return false;
  c.advance();
  if (c.kind() !== TK.identifier) { c.restore(saved); return false; }
  c.advance();
  if (c.kind() !== TK.lparen) { c.restore(saved); return false; }
  c.advance();
  if (c.kind() !== TK.lbrace) { c.restore(saved); return false; }
  c.advance();

  var sawDefault = false;
  while (c.kind() !== TK.rbrace && c.kind() !== TK.eof) {
    if (c.kind() === TK.equals) sawDefault = true;
    c.advance();
  }

  var ok = sawDefault && c.kind() === TK.rbrace;
  c.restore(saved);
  return ok;
}

function compile(c, ctx) {
  // Handled only incidentally by the destructured-signature path.
  // Missing-prop defaults are not implemented.
  return null;
}
