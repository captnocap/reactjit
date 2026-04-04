// ── Pattern 077: React.createElement ─────────────────────────────
// Index: 77
// Group: component_ref
// Status: stub
//
// Soup syntax (copy-paste React):
//   React.createElement('div', { className: 'box' }, 'content')
//   React.createElement(MyComponent, props, children)
//
// Mixed syntax (hybrid):
//   // Rare in mixed - prefer JSX syntax
//   createElement('div', { className: 'box' })
//
// Zig output target:
//   // Transformed to equivalent JSX compilation
//   .{
//     .tag = .Box,
//     .props = .{ .class_name = "box" },
//     .sub_nodes = &[_]Node{
//       .{ .text = "content" },
//     },
//   }
//
// Notes:
//   React.createElement is the underlying JSX primitive. Some codebases
//   use it directly for dynamic tag types. We transform this call to
//   the equivalent JSX element output.
//   Arguments: (type, props, ...children)
//   Type can be: string (HTML tag), function (component), or symbol.

function match(c, ctx) {
  // Look for React.createElement or createElement call
  if (c.kind() !== TK.identifier && c.kind() !== TK.dot) return false;
  var saved = c.save();
  var text = '';
  // Check for React.createElement or createElement
  if (c.kind() === TK.identifier) {
    text = c.token().text;
    c.advance();
  } else {
    // Could be React.createElement
    c.restore(saved);
    return false; // Simplified - needs full parsing
  }
  if (text !== 'createElement' && text !== 'React') {
    c.restore(saved);
    return false;
  }
  // TODO: More robust detection
  c.restore(saved);
  return false;
}

function compile(c, ctx) {
  // TODO: Parse createElement arguments
  // 1. Extract type, props, children arguments
  // 2. Transform to equivalent JSX element output
  // 3. Handle spread children
  return null;
}

module.exports = {
  id: 77,
  name: 'create_element',
  status: 'stub',
  match,
  compile,
};
