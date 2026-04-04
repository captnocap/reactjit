// ── Chad Pattern c003: `is` binding ─────────────────────────────
// Group: core
// Status: complete
//
// Chad syntax:
//   // Declaration (in <var>):
//   set_count is 0
//   name is 'hello'
//
//   // Mutation (in <functions>):
//   set_count is count + 1
//   set_name is 'updated'
//
//   // Local variable (in <functions>):
//   result is net.get(apiUrl)
//
//   // Classifier property (in .cls.tsz):
//   fontSize is 18
//   color is theme-text
//
// ── Route chain ──
//
// IN <var> (declaration):
//   page.js:parsePageVarBlock()
//     → matches /^(\w+)\s+is\s+(.+)$/
//     → classifies value type (string/int/float/boolean/array/objects/expression/ambient)
//     → set_ prefix vars get reactive setters
//   → ctx.stateSlots (primitives) or ctx.scriptBlock (complex)
//
// IN <functions> (mutation — set_ prefix):
//   page.js:transpilePageLine()
//     → matches /^(set_\w+)\s+is\s+(.+)$/
//     → emits: set_count(transpilePageExpr("count + 1"));
//     → _quoteTypeVariant() quotes bare words matching ctx._typeVariants
//   → ctx.scriptBlock via buildPageJSLogic()
//
// IN <functions> (local variable — no set_ prefix):
//   page.js:transpilePageLine()
//     → matches /^(\w+)\s+is\s+(.+)$/ where name doesn't start with set_
//     → emits: var result = transpilePageExpr("net.get(apiUrl)");
//   → ctx.scriptBlock
//
// EMIT:
//   emit_split.js → JS_LOGIC embedded in Zig string literal
//   emit/state_manifest.js → Zig state slot init for primitives
//
// ctx fields: ctx.stateSlots, ctx.scriptBlock, ctx._typeVariants

function match(c, ctx) { return false; }
function compile(c, ctx) { return null; }
