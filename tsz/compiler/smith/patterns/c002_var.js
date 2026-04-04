// ── Chad Pattern c002: <var> block ──────────────────────────────
// Group: core
// Status: complete
//
// Chad syntax:
//   <var>
//     set_count is 0          → int state slot + setter
//     set_name is 'default'   → string state slot + setter
//     set_active is true      → boolean state slot + setter
//     set_input is string     → string type declaration + setter
//     items is array          → JS-managed array (needs data block)
//     cards is objects        → JS-managed OA (needs data block)
//     MAX exact 100           → immutable constant
//     filter                  → uninitialized (empty array)
//     name is sys.user        → ambient read from runtime namespace
//   </var>
//
// ── Route chain ──
//
// PARSE:
//   page.js:parsePageVarBlock()
//     → line-by-line: exact match → const, is match → typed init, bare → uninit
//     → classifies: string/int/float/boolean/array/object_array/expression/ambient
//     → multi-line values: tracks bracket depth across lines
//     → ambient detection: sys/time/device/locale/privacy/input namespaces
//
// SPLIT:
//   chad.js:compileChadLane() / page.js:compilePage()
//     → separates ambients from stateVars
//     → primitives (int/float/boolean/string) → ctx.stateSlots
//     → complex types (array/object_array) → JS-managed in scriptBlock
//
// EMIT (primitives):
//   emit/state_manifest.js:emitStateManifest()
//     → Zig: var state = State.init(N);
//   emit/state_manifest.js:emitInitState()
//     → Zig: state.setSlot(0, 0); state.setSlotString(1, "default");
//
// EMIT (complex):
//   emit_split.js → JS_LOGIC block:
//     → "var items = []; function set_items(v) { items = v; }"
//
// EMIT (ambients):
//   emit_split.js → JS_LOGIC block:
//     → "var username = __ambient('sys', 'user');"
//
// ctx fields: ctx.stateSlots, ctx.objectArrays, ctx.scriptBlock

function match(c, ctx) { return false; }
function compile(c, ctx) { return null; }
