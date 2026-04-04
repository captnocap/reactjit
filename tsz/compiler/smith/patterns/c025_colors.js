// ── Chad Pattern c025: <colors> block ───────────────────────────
// Group: visual
// Status: stub
//
// Chad syntax:
//   <colors>
//     // Override ambient:
//     red exact '#cc0000'
//
//     // Variants:
//     <red>
//       dark exact '#4a0000'
//       light exact '#ff6666'
//     </red>
//
//     // Gradients:
//     <ocean gradient>
//       blue is 40
//       '#1e293b' is 50
//       gray is 10
//       angle is vertical
//     </ocean>
//   </colors>
//
//   // Usage:
//   fill is red(dark)
//   bg is ocean
//
// Soup equivalent:
//   const colors = { red: '#cc0000', redDark: '#4a0000' };
//   background: linear-gradient(to bottom, blue 40%, ...);
//
// Zig output target:
//   Color constant resolution. Gradient definitions.
//
// Current owner: not yet implemented
//
// Notes:
//   Ambient colors (red, blue, green, etc.) provided by engine — no definition needed.
//   Override with `name exact '#hex'`. Extend with variant blocks.
//   Variants accessed as color(variant): red(dark), blue(deep).
//   Gradients: stops are colors with percentage weights, angle directive.

function match(c, ctx) {
  return false;
}

function compile(c, ctx) {
  return null;
}
