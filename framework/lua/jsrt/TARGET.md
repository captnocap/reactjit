# JSRT target milestones

The single source of truth for what "JSRT works" means. Each milestone is a specific JS source program and a specific expected runtime behavior. JSRT is "done" at a given level when every target up to that level passes.

## Verification

Run all targets:

```bash
./framework/lua/jsrt/test/run_targets.sh
```

Exits 0 if all pass. Exits with the failure count if any fail. Prints status per target.

## The rule for adding a target

Each target specifies:
- **Input:** a JS source program (or, until the AST pre-parser lands, a hand-written ESTree AST for that same JS)
- **Expected:** runtime behavior — a returned value, or a specific sequence of host-FFI calls

Each target does NOT specify "what Lua code should be emitted." If your target's pass-condition requires a `.lua` file generated from JS source, STOP. That is the trap. The evaluator runs JS as data; it never translates JS to Lua.

The evaluator's scope is ECMAScript. Adding a target that specifies "React-aware behavior in the evaluator" (e.g. `useState must have a dedicated fast path`) is out of bounds. React-shaped behavior in JSRT must arise from ordinary JS execution, not from evaluator awareness.

## Targets (ascending complexity)

### 01 — literals and binding  [PASS]

JS:
- `1 + 2`
- `var x = 1 + 2; x`
- `"hello " + "world"`

Proves: Literal, Identifier, VariableDeclaration, BinaryExpression (arithmetic + string concat), basic scope lookup.

Expected: `3`, `3`, `"hello world"`.

### 02 — function declaration and call  [PASS]

JS: `function add(a, b) { return a + b } add(3, 4)`

Proves: FunctionDeclaration, CallExpression, ReturnStatement, parameter binding, function scope.

Expected: `7`.

### 03 — closures and mutation  [PASS]

JS:
```js
function counter() {
  let n = 0;
  return function() { n = n + 1; return n };
}
let c = counter();
c(); c(); c();
```

Proves: closure capture of upvalues, repeated invocation with shared state, function returning function.

Expected: `3`.

### 04 — objects and dot access  [PASS]

JS: `let o = { a: 1, b: 2 }; o.a + o.b`

Proves: ObjectExpression, MemberExpression (dot), property read.

Expected: `3`.

### 05 — arrays and iteration  [PASS]

JS: `[1, 2, 3].reduce((a, b) => a + b, 0)`

Proves: ArrayExpression, ArrowFunctionExpression, Array.prototype.reduce, method call on array.

Expected: `6`.

### 06 — classes and `new`  [PASS]

JS:
```js
class Point {
  constructor(x, y) { this.x = x; this.y = y; }
  sum() { return this.x + this.y; }
}
new Point(3, 4).sum()
```

Proves: ClassDeclaration, `new`, method binding, `this`, prototype installation.

Expected: `7`.

### 07 — try/catch  [PASS]

JS: `try { throw new Error("oops") } catch (e) { e.message }`

Proves: TryStatement, ThrowStatement, Error built-in, exception propagation through function calls.

Expected: `"oops"`.

### 08 — Map / Set  [PASS]

JS:
```js
let m = new Map();
m.set("a", 1); m.set("b", 2);
m.size
```

Proves: Map built-in with internal storage, size property (getter), method calls.

Expected: `2`.

### 09 — host FFI call  [PASS]

Programmatically registers a host-fn into the root scope that records calls; JS calls it; check the recorded call stream.

JS (logical — real form uses `__hostCreateText` registered as a native function):
```js
let id = __hostCreateText("hello");
__hostAppendToRoot(id);
```

Proves: native-function values are callable from evaluated JS; arguments marshal correctly; returns marshal back.

Expected ops: `[{op: "CREATE_TEXT", text: "hello"}, {op: "APPEND_TO_ROOT", id: 1}]`.

### 10 — AST pre-parser bridge  [PASS]

Adds `scripts/build-jsast.mjs` (acorn in Node) and an on-disk AST cache. JSRT loads the JSON blob, decodes it once at boot, and then walks the resulting table instead of a hand-written AST. Re-runs targets 01-09 from real JS sources.

Proves: the full JS → AST → JSRT chain works. After this target, all prior targets can be expressed as `.js` files instead of hand-written AST tables.

### 11 — real React createElement  [PASS (minimal)]

Current: plain JS defines a `createElement` function matching React's shape, mounts a `<Text>hello</Text>`-equivalent via host FFI. Proves the full pipeline handles a React-shaped program: JS helper builds an element tree, the program walks it and calls host FFI. The evaluator does NOT know `createElement` is React — it's a regular function call.

Deferred to a later follow-up: using the actual npm `react` library (which requires for-loops, unary operators, destructuring, and `Symbol` — none of which are in the evaluator yet; add them in subsequent targets when a real React bundle surfaces them). Full TSX → esbuild → JSRT chain with the real React library is aspirational for post-target-13 cleanup.

Expected ops (verified): CREATE_TEXT("hello") → CREATE("Text", {}) → APPEND → APPEND_TO_ROOT.

### 12 — useState counter  [PASS]

Input: `cart/jsrt-counter/index.tsx` — `<Pressable onPress={...}><Text>{count}</Text></Pressable>` with a click handler incrementing state.

Proves: hooks work via React's actual implementation; event dispatch triggers re-render; commit phase produces UPDATE ops.

Expected: each click → exactly one UPDATE_TEXT op with the new value.

### 13 — sweatshop file click  [pending — the finish line]

Input: `cart/sweatshop/index.tsx` — the real IDE cart, unmodified.

Measured: click a file in the sidebar, time until Zig host completes the flush apply.

Expected: **sub-100ms click latency**, down from 2300ms on QJS.

Definition of done: the cart runs unmodified through JSRT at interactive speeds. This is the target that retires QJS.

## Rules of engagement

1. Targets are ordered — work them in sequence. Don't chase target 13 before 02–12 land.
2. A target failure means fix the evaluator (or add a built-in), not weaken the target.
3. Targets only specify JS input and expected runtime behavior. They never specify "what Lua code gets produced."
4. If two targets require evaluator React-awareness to pass, the targets are mis-specified. Rewrite at the JS language level.
5. Never add a target that involves producing `.lua` source from `.js` source. If you want faster startup, optimize the AST format or the evaluator loop — not by translating JS into Lua.
6. When a target passes, update its header in this file from `[PASS]` to `[PASS]` and commit.
