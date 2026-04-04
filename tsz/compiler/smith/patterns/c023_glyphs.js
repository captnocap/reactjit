// ── Chad Pattern c023: Glyphs (:name: shortcodes) ───────────────
// Group: visual
// Status: stub
//
// Chad syntax:
//   // Inline shortcodes in text:
//   <Text>Status :check: all good</Text>
//   <Text>Energy :star[plasma]: reactor online</Text>
//
//   // Tier 1 — ambient (no definition needed):
//   :star: :check: :warning: :error: :circle: :play: :pause:
//
//   // Tier 2 — customized ambient:
//   <thick_star is star glyph>
//     thickness exact 15
//     fill is theme-warning
//   </thick_star>
//
//   // Tier 3 — composed from shape primitives:
//   <check glyph>
//     <layers>
//       stroke
//     </layers>
//     <stroke exact path>
//       points is '5,12 10,17 20,7'
//       thickness is 2
//       fill is theme-success
//     </stroke>
//   </check>
//
//   // Tier 4 — SVG hatch:
//   <exotic glyph>
//     <svg>
//       d is 'M12 2C6.48 2 2 ...'
//     </svg>
//   </exotic>
//
// Soup equivalent:
//   // Custom inline SVG components or icon libraries
//
// Zig output target:
//   Glyph registry entries. Inline polygon rendering scaled to fontSize.
//
// Current owner: parse/children/text.js (shortcode resolution)
//
// Notes:
//   :name: resolves from glyph registry. :name[effect]: overrides fill.
//   Scale with surrounding fontSize. Four tiers: ambient, customized, composed, SVG.
//   <layers> declares composition order. <merge> controls compositing.

function match(c, ctx) {
  return false;
}

function compile(c, ctx) {
  return null;
}
