// ── Chad Pattern c024: Theme tokens ─────────────────────────────
// Group: visual
// Status: stub
//
// Chad syntax:
//   // In .tcls.tsz:
//   <tokens>
//     bg
//     surface
//     text
//     primary
//     spaceSm
//     radiusMd
//   </tokens>
//
//   <main>
//     bg is blue(dark)
//     surface is gray(mid)
//     text is white
//     primary is blue
//     spaceSm is 4
//     radiusMd is 8
//   </main>
//
//   <light>
//     bg is white
//     text is blue(dark)
//   </light>
//
//   // Usage in classifiers:
//   backgroundColor is theme-primary
//   fontSize is theme-fontMd
//
// Soup equivalent:
//   const theme = { bg: '#0f172a', text: '#fff', ... };
//   style={{ backgroundColor: theme.primary }}
//
// Zig output target:
//   Theme token resolution at compile time.
//   Active theme determines runtime values.
//
// Current owner: not yet implemented (classifier resolution uses theme- prefix)
//
// Notes:
//   <tokens> declares names only — no values. Contract.
//   <main> is default theme. Required. Every token assigned.
//   Other themes inherit from <main>, override selectively.
//   Referenced as theme-name in classifiers and effects.

function match(c, ctx) {
  return false;
}

function compile(c, ctx) {
  return null;
}
