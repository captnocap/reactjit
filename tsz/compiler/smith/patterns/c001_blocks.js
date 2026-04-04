// ── Chad Pattern c001: Block headers ────────────────────────────
// Group: core
// Status: complete
//
// Chad syntax:
//   <my app>          → app shell with navigation
//   <home page>       → routable view
//   <counter component> → reusable UI, takes <props>
//   <weather widget>  → standalone binary, inlines everything
//   <backend lib>     → module package, no UI
//   <lava effect>     → procedural fill artifact
//   <check glyph>     → inline shape artifact
//
// ── Route chain ──
//
// DETECTION:
//   lanes/chad.js:detectChadBlock()
//     → regex: /<(\w+)\s+(widget|page|app|component|lib|effect|glyph)\s*>/g
//     → scans for LAST match (forge prepends imports, main source is last)
//     → returns { name, type, tag, closeTag }
//
// PREFLIGHT:
//   lanes/chad.js:chadSourcePreflight()
//     → validates closing tag exists
//     → UI types (app/page/widget/component) require return()
//     → non-UI types (lib/effect/glyph) skip return() check
//     → rejects mixed-lane patterns: function App(), useState(), useEffect()
//
// EXTRACTION:
//   lanes/chad.js:extractChadInner()
//     → strips outer block tags, returns inner content
//     → inner content feeds to <var>, <types>, <functions>, return() parsers
//
// LANE ROUTING:
//   block.type determines compile behavior:
//     app/page/widget/component → UI path (parse JSX, emit node tree)
//     lib/effect/glyph → non-UI path (stub root with label)
//
// ctx fields: block.name, block.type (local to compileChadLane, not on ctx)
//
// Zig output: none directly — block header is consumed by routing,
//   not emitted. The block type determines which emit path runs.

function match(c, ctx) { return false; }
function compile(c, ctx) { return null; }
