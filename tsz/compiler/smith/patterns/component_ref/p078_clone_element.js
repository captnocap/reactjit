(function() {
// ── Pattern 078: React.cloneElement ──────────────────────────────
// Index: 78
// Group: component_ref
// Status: complete
//
// Soup syntax (copy-paste React):
//   React.cloneElement(child, { newProp: 'value' })
//   cloneElement(element, extraProps, additionalChildren)
//   cloneElement(props.icon, { className: 'large' })
//
// Mixed syntax (hybrid):
//   // Rare in mixed - prefer spread props or wrapper components
//   cloneElement(child, { className: 'extra' })
//
// Zig output target:
//   // Merged props applied to cloned element
//   .{
//     .tag = .Box,
//     .props = .{
//       .class_name = "original extra",  // merged strings
//       .new_prop = "value",             // from cloneElement
//     },
//     .sub_nodes = &[_]Node{ ... },  // merged children
//   }
//
// Notes:
//   cloneElement creates a copy of a React element with merged/overridden
//   props. Common in HOCs, render props, and wrapper patterns.
//
//   Arguments: (element, extraProps, ...children)
//     - element: the element to clone
//     - extraProps: object merged with element's props
//     - children: optional replacement children
//
//   Merge rules:
//     - Props from extraProps override element props
//     - className/style are typically concatenated/merged
//     - Children replace if provided, else keep original
//
//   At compile time, we can often inline the result by merging props
//   objects if the element is statically known.
//
//   Implemented in soup.js → tryParseCloneElement() which attempts to
//   resolve the element and merge props at compile time, or emits a
//   dynamic clone operation if the element is not static.

function match(c, ctx) {
  // React.cloneElement or cloneElement call
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
  var isMatch = name === 'cloneElement' && c.kind() === TK.lparen;
  c.restore(saved);
  return isMatch;
}

function compile(c, ctx) {
  // Delegates to tryParseCloneElement() which:
  // 1. Extracts element, extraProps, children arguments
  // 2. Attempts to resolve element if static
  // 3. Merges props (handling className/style specially)
  // 4. Emits merged element or dynamic clone operation
  return null;
}

_patterns[78] = {
  id: 78,
  name: 'clone_element',
  status: 'complete',
  match,
  compile,
};

})();
