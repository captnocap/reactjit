(function() {
// ── Pattern 059: JSX as prop ────────────────────────────────────
// Index: 59
// Group: props
// Status: complete
//
// Soup syntax (copy-paste React):
//   <Card icon={<Icon name="star" />} />
//   <Layout header={<Header title="Home" />} sidebar={<Nav />} />
//   <Modal trigger={<Button>Open</Button>} />
//
// Mixed syntax (hybrid):
//   Same as soup for this pattern.
//
// Zig output target:
//   // JSX prop becomes an inline slot — the child JSX is compiled as a
//   // separate node subtree and inserted at the component's usage site.
//   // The component sees it as { __jsxSlot: true, result: jsxResult }
//   // in propValues, and the compiled subtree is inlined where the
//   // component references {props.icon} or {icon}.
//   //
//   // Example: <Card icon={<Icon name="star" />} />
//   // Compiles the Icon as a separate node:
//   nodes._arr_1[0] = .{
//     .style = .{ ... },
//     .text = "star",
//   };
//   // Then Card's template references it via the slot mechanism.
//
// Notes:
//   Implemented in parse/element/component_brace_values.js → tryParseComponentBraceProp().
//
//   Detection: inside a brace value, if the first token is TK.lt (less-than),
//   it's treated as a JSX element. The entire JSX subtree is parsed by
//   parseJSXElement() recursively.
//
//   The result is stored as:
//     propValues[attr] = { __jsxSlot: true, result: jsxResult }
//
//   The __jsxSlot flag tells the component inliner to emit the compiled
//   node subtree at the point where the component references this prop.
//   This is the "slot pattern" — named slots via props.
//
//   Complete because:
//     - Single JSX element props work
//     - Nested JSX trees work (the parser is recursive)
//     - Multiple JSX props on the same component work
//     - JSX props can reference state, map items, etc. within them
//
//   See also: p093_slot_pattern.js (composition pattern using JSX props)

function match(c, ctx) {
  // attr={ < ... /> }
  if (c.kind() !== TK.lbrace) return false;
  if (c.pos + 1 >= c.count) return false;
  return c.kindAt(c.pos + 1) === TK.lt;
}

function compile(c, ctx) {
  // Delegates to tryParseComponentBraceProp() which calls parseJSXElement()
  // and stores the result as { __jsxSlot: true, result: jsxResult }.
  // See component_brace_values.js lines 7-11.
  return null;
}

_patterns[59] = { id: 59, match: match, compile: compile };

})();
