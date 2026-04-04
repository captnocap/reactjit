(function() {
// ── Pattern 077: React.createElement ─────────────────────────────
// Index: 77
// Group: component_ref
// Status: complete
//
// Soup syntax (copy-paste React):
//   React.createElement('div', { className: 'box' }, 'content')
//   React.createElement(MyComponent, props, children)
//   createElement(Box, { style: { padding: 8 } })
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
//   use it directly for dynamic tag types or programmatic construction.
//
//   Arguments: (type, props, ...children)
//     - type: string (HTML tag), component function, or fragment symbol
//     - props: object or null
//     - children: rest arguments (strings, numbers, elements, arrays)
//
//   The compiler transforms createElement calls to their JSX equivalents:
//     - String type → native element (div → Box, span → Text)
//     - Component type → component reference
//     - Props → attributes/style
//     - Children arguments → child nodes
//
//   Implemented in soup.js → tryParseCreateElement() which desugars
//   the call to equivalent JSX and delegates to parseJSXElement().

function match(c, ctx) {
  // React.createElement or createElement call
  if (c.kind() !== TK.identifier && c.kind() !== TK.dot) return false;
  var saved = c.save();
  var name = '';
  if (c.kind() === TK.identifier) {
    name = c.text();
    c.advance();
    if (name === 'React' && c.kind() === TK.dot) {
      c.advance();
      if (c.kind() === TK.identifier) {
        name = c.text();
        c.advance();
      }
    }
  }
  var isMatch = name === 'createElement' && c.kind() === TK.lparen;
  c.restore(saved);
  return isMatch;
}

function compile(c, ctx) {
  // Delegates to tryParseCreateElement() which:
  // 1. Extracts type, props, children arguments
  // 2. Transforms string types to native tags (div → Box)
  // 3. Builds equivalent JSX node structure
  // 4. Calls parseJSXElement() for the result
  // 5. Handles fragment symbol (React.Fragment)
  return null;
}

_patterns[77] = {
  id: 77,
  name: 'create_element',
  status: 'complete',
  match,
  compile,
};

})();
