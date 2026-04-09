(function() {
// ── Pattern 065: Forwarded ref prop ─────────────────────────────
// Index: 65
// Group: props
// Status: complete
//
// Matches: React.forwardRef((props, ref) => ...) — the forwardRef HOC
//          pattern where a component receives both props and a ref.
// Compile: extracts the props and ref parameter names, marks the
//          component as ref-forwarding so the ref prop is threaded
//          through during inlining.
//
// React:   const Input = React.forwardRef((props, ref) => {
//            return <input ref={ref} {...props} />;
//          });
// Zig:     ref is compiled as a pointer to the framework Node handle.
//
// In tsz, refs map to node handle pointers. forwardRef is recognized
// at component definition time and the ref parameter is tracked.

function match(c, ctx) {
  // Detect: identifier.forwardRef( or forwardRef(
  if (c.kind() !== TK.identifier) return false;
  var text = c.text();
  if (text === 'forwardRef') return true;
  // React.forwardRef
  if (text === 'React' && c.pos + 2 < c.count &&
      c.kindAt(c.pos + 1) === TK.dot &&
      c.kindAt(c.pos + 2) === TK.identifier &&
      c.textAt(c.pos + 2) === 'forwardRef') {
    return true;
  }
  return false;
}

function compile(c, ctx) {
  // Skip React.forwardRef or forwardRef
  if (c.text() === 'React') {
    c.advance(); // React
    c.advance(); // .
  }
  c.advance(); // forwardRef
  if (c.kind() === TK.lparen) c.advance(); // (

  // Now at the inner function: (props, ref) => ...
  var propsParam = null;
  var refParam = null;

  if (c.kind() === TK.lparen) {
    c.advance(); // (
    if (c.kind() === TK.identifier) {
      propsParam = c.text();
      c.advance();
    }
    if (c.kind() === TK.comma) c.advance();
    if (c.kind() === TK.identifier) {
      refParam = c.text();
      c.advance();
    }
    if (c.kind() === TK.rparen) c.advance();
  }

  // Skip => if arrow function
  if (c.kind() === TK.arrow) c.advance();

  return {
    __forwardRef: true,
    propsParam: propsParam,
    refParam: refParam,
  };
}

_patterns[65] = { id: 65, group: 'props', name: 'forwarded_ref', match: match, compile: compile };

})();
