(function() {
// ── Pattern 065: forwarded ref prop ────────────────────────────
// Index: 65
// Group: props
// Status: complete
//
// Soup syntax (copy-paste React):
//   const Input = forwardRef((props, ref) => (
//     <TextInput ref={ref} value={props.value} />
//   ));
//
// Mixed syntax (hybrid):
//   Same as soup for this pattern.
//
// Zig output target:
//   // Not currently emitted as a forwarded component.
//   //
//   // Observed current behavior for:
//   //   <Input value="hello" />
//   // is an empty root node:
//   //   var _root = Node{ };
//
// Notes:
//   collectComponents() only registers function declarations of the form:
//     function Name(...) { ... }
//
//   It does not collect:
//     const Name = forwardRef((props, ref) => ...)
//
//   Because findComponent() never sees that binding, <Input /> falls through
//   the normal tag path instead of the component-inline path. In the isolated
//   probe for this pattern, that produced an empty root rather than a usable
//   forwarded component.
//
//   This is marked not_applicable for the current Smith architecture rather
//   than stub because forwarded refs depend on runtime ref identity and a
//   component collection shape that Smith does not currently model.
//
//   Supporting this pattern would require:
//     1. Collecting const-assigned component bindings
//     2. Recognizing forwardRef wrappers specifically
//     3. Preserving/ref-routing semantics for the forwarded `ref` argument

function match(c, ctx) {
  // const Name = forwardRef(...)
  var saved = c.save();
  if (!c.isIdent('const')) return false;
  c.advance();
  if (c.kind() !== TK.identifier) { c.restore(saved); return false; }
  c.advance();
  if (c.kind() !== TK.equals) { c.restore(saved); return false; }
  c.advance();
  var ok = c.kind() === TK.identifier && c.text() === 'forwardRef';
  c.restore(saved);
  return ok;
}

function compile(c, ctx) {
  // No live lowering in the current compile-time component model.
  return null;
}

_patterns[65] = { id: 65, match: match, compile: compile };

})();
