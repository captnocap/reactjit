// ── Chad Pattern c022: Effects ──────────────────────────────────
// Group: visual
// Status: stub
//
// Chad syntax:
//   // Application (bare word on tag):
//   <Text lava>MOLTEN LETTERS</Text>
//   <C.Card ember> ... </C.Card>
//
//   // Definition in .effects.tsz:
//   <lava effect>
//     <var>
//       speed is 0.5
//       intensity is 0.8
//       deep is theme-lavaDeep
//     </var>
//     <functions>
//       fill(x, y, t):
//         heat is math.turbulence(x, y, t * speed)
//         math.ramp(heat * intensity, deep, mid, hot, peak)
//     </functions>
//   </lava>
//
// Soup equivalent:
//   // No direct equivalent — custom shader/canvas per element
//
// Zig output target:
//   CPU effect renderer or WGSL shader.
//   Effect name resolves to fill function.
//
// Current owner: emit_atoms/handlers_effects/
//
// Notes:
//   Contract: must have fill(x, y, t) returning a color.
//   x, y normalized 0-1. t = elapsed seconds.
//   Bare word on tag that matches effect registry = apply as fill.
//   Vars support theme tokens for themeable effects.

function match(c, ctx) {
  return false;
}

function compile(c, ctx) {
  return null;
}
