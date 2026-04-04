// ── Pattern 111: classnames/clsx utility ────────────────────────
// Index: 111
// Group: style
// Status: stub
//
// Soup syntax (copy-paste React):
//   className={clsx('btn', {active})}
//   className={classNames('header', variant && 'dark', {open: isOpen})}
//
// Mixed syntax (hybrid):
//   // Not applicable — classnames/clsx is a web CSS pattern.
//   // Mixed: the compiler uses inline style objects, not className.
//
// Zig output target:
//   // N/A — className has no Zig equivalent. The framework uses
//   // style structs (.style = .{ .padding = 8 }) not CSS classes.
//   // If this were supported, it would need a compile-time class→style
//   // resolution step, mapping class names to style struct fields.
//
// Notes:
//   classnames/clsx is a React web pattern for composing CSS class names.
//   ReactJIT has no CSS class system — all styling is inline style objects
//   that map directly to Zig layout struct fields.
//   The soup lane (soup.js line ~511) drops className with a warning:
//     "[W] dynamic className dropped" or "[W] className="X" dropped"
//   To support this pattern, the compiler would need:
//     1. A classname→style mapping (like a CSS-in-JS compile step)
//     2. Resolution of the clsx() call at compile time
//     3. Merging resolved styles into the node's .style struct
//   This is fundamentally incompatible with the native style model.
//   Users should convert className patterns to inline style objects.
//   See p105_inline_object.js and p106_computed_inline.js for the
//   supported style patterns.

function match(c, ctx) {
  return false;
}

function compile(c, children, ctx) {
  return null;
}
