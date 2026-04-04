// ── Chad Pattern c026: Animations ───────────────────────────────
// Group: visual
// Status: stub
//
// Chad syntax:
//   // Ambient (no definition needed):
//   <C.Card fadeIn>
//   <C.Card slideUp + fadeIn>
//
//   // Custom definition:
//   <slideUp animation>
//     property is translateY
//     from is 100
//     to is 0
//     duration is 300
//     easing is ease
//   </slideUp>
//
//   <pulse animation>
//     property is scale
//     from is 1
//     to is 1.1
//     duration is 200
//     easing is elastic
//     repeat is true
//   </pulse>
//
//   // On pressable:
//   <C.Btn bounce + increment>
//
//   // With <during>:
//   <during dragging>
//     spring + followCursor
//   </during>
//
// Soup equivalent:
//   // CSS transitions, framer-motion, react-spring
//
// Zig output target:
//   Animation property interpolation entries.
//
// Current owner: not yet implemented
//
// Notes:
//   Ambient: fadeIn, fadeOut, slideUp, slideDown, scaleIn, scaleOut,
//   bounce, spring, shake. Just use them.
//   Applied as bare words. Composed with +.
//   On Pressable = run on press. With <during> = run while active.

function match(c, ctx) {
  return false;
}

function compile(c, ctx) {
  return null;
}
