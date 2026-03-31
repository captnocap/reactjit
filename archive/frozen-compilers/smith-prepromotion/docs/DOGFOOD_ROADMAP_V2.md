# Dogfood Roadmap V2: Framework Self-Compilation via Smith/Forge

## What tsz-gen Did (and Why It Died)

The `archive/tsz-gen/` directory contains the previous attempt at framework self-compilation. The architecture:

- **Source**: `runtime/tsz/*.mod.tsz` — 80+ modules written in TypeScript-like syntax
- **Compiler**: Pure Zig (`compiler/modulegen.zig` + `stmtgen.zig` + `exprgen.zig` + `typegen.zig`)
- **Output**: `runtime/compiled/*.zig` — generated Zig modules
- **Command**: `tsz compile-runtime <file.mod.tsz>`

The `.mod.tsz` syntax was straightforward TypeScript:

```tsx
// layout.mod.tsz — 967 lines
enum FlexDirection { Row, Column }
interface Style { width?: number; flexGrow: number; ... }
interface Node { style: Style; children: Node[]; computed: LayoutRect; ... }

function layoutNode(node: Node, px: number, py: number, pw: number, ph: number) {
  const s = node.style;
  if (s.display === Display.None) { ... }
  // ... 600+ lines of flexbox math
}
```

This compiled 1:1 into Zig: `layout.mod.tsz` (967 lines) → `layout.zig` (1020 lines). Every `function` became a Zig `fn`. Every `interface` became a Zig `struct`. Every algorithm remained in Zig.

**Why it died**: The old compiler was 25,000+ lines of hand-written Zig across 6 files (`codegen.zig`, `modulegen.zig`, `stmtgen.zig`, `exprgen.zig`, `typegen.zig`, `main.zig`). It was fragile, hard to extend, and compiled *everything* to Zig — including algorithms that have no business being in a systems language. The layout algorithm alone is 800+ lines of constraint-solving math in Zig, fighting the type system at every step (`asF32()` casts everywhere, optional unwrapping, `@intCast` noise). The same algorithm in `love2d/lua/layout.lua` is 2544 lines of clean, readable Lua with features the Zig version still lacks (viewport scaling, fit-content, profiling, surface fallbacks).

The tsz-gen approach answered the wrong question. It asked "how do we compile .tsz to Zig?" when it should have asked "what belongs in Zig vs Lua?"

## What Smith Can Do Today

Smith (3757 lines of JS, 5 files) is hosted by Forge (Zig binary, QuickJS runtime). The pipeline:

```
.app.tsz → Forge lexer (Zig, fast) → token stream → Smith (JS) → generated_*.zig
```

Smith already generates **both Zig and Lua output** in every compiled file. The generated `.zig` contains:

1. **Zig code** — node tree, static styles, state slot initialization, comptime arrays, handler function stubs
2. **`JS_LOGIC`** — embedded JS string constant (state variables, setters, `<script>` block content, map handler dispatch)
3. **`LUA_LOGIC`** — embedded Lua string constant (state variables, setters, map handler dispatch)

At runtime, the engine loads both:
```zig
if (config.js_logic.len > 0) qjs_runtime.evalScript(config.js_logic);
if (config.lua_logic.len > 0) luajit_runtime.evalScript(config.lua_logic);
```

Smith already makes split decisions for app code:

| Goes to Zig | Goes to JS_LOGIC | Goes to LUA_LOGIC |
|---|---|---|
| Node struct tree | `<script>` block content | State variable declarations |
| Static style values | Object array setters | Setter functions (`__setState`) |
| State slot creation | State var declarations | Map handler functions |
| Comptime children arrays | Map handler dispatch | Object array loading |
| Handler fn stubs (empty) | (when `<script>` present) | (when no `<script>`) |
| Dynamic text buffers | | |
| Object array unpack (QJS FFI) | | |

The key insight: Smith decides handler dispatch based on whether a `<script>` block is present. With `<script>`, handlers go to `JS_LOGIC` (dispatched via QuickJS). Without, they go to `LUA_LOGIC` (dispatched via LuaJIT). The event system supports both paths: `EventHandler` has `on_press` (Zig fn ptr), `js_on_press` (JS string), and `lua_on_press` (Lua string).

**What Smith does NOT do today**: It only handles `.app.tsz` (JSX component files). It has no `.mod.tsz` mode. There is no concept of generating framework modules — only app cartridges.

## The Zig vs Lua Split: What Belongs Where

### Must Be Zig

These are structural, memory-layout-critical, or FFI-boundary code:

- **Type definitions** — `pub const Style = struct { ... }`, `pub const Node = struct { ... }`, enums. Zig needs these at compile time for struct layout, field access, and GPU pipeline compatibility.
- **FFI/C bindings** — SDL3 calls, wgpu calls, FreeType calls, QuickJS C API. These are `@cImport` and direct pointer manipulation.
- **Memory management** — Allocator usage, pool management, buffer lifecycle. Zig's comptime guarantees matter here.
- **GPU render pipeline** — `render_surfaces.zig`, `engine_paint.zig`, `blend2d.zig`. These build GPU command buffers and texture atlases. Latency-critical, pointer-heavy.
- **Text rendering** — Glyph cache, texture atlas management, FreeType integration. Pointer arithmetic and GPU texture uploads.
- **Bridge infrastructure** — `qjs_runtime.zig` (1800 lines) and `luajit_runtime.zig` (474 lines). These ARE the Lua/JS integration layer — they must be Zig.
- **`pub fn` signatures called by other Zig code** — The function exists in Zig so other Zig modules can call it. The body can delegate to Lua.

### Should Be Lua

These are algorithmic, dynamic, or high-churn code where Lua's flexibility wins:

- **Layout algorithm** — `layoutNode()` is 700+ lines of flexbox math: flex distribution, wrapping, intrinsic sizing, gap calculation, alignment. The Love2D version (`layout.lua`, 2544 lines) proves this works beautifully in Lua and is far richer. The Zig version is riddled with `asF32()` casts and optional unwrapping that add nothing.
- **Easing functions** — `easing.zig` (252 lines) is pure `f32 → f32` math. `t * (2.0 - t)`, spring oscillation, cubic bezier. Textbook Lua territory.
- **Hit testing** — `events.zig` has `hitTest()` and `hitTestHoverable()` — tree walks checking rectangles. Simple recursive logic.
- **State management logic** — Creating slots, tracking dirty flags, slot type dispatch. The types (`StateSlot`, `ArraySlot`) stay in Zig. The creation/access logic can be Lua.
- **Telemetry** — Frame timing, FPS calculation, history ring buffer. Pure arithmetic.
- **Classifier resolution** — Style merging, cascade logic, name lookup. String-heavy, dynamic.
- **Transition management** — Animation state machines, easing application, property interpolation.
- **Semantic analysis** — Tree analysis, accessibility, structure validation.

### The Bridge Is Not the Bottleneck

The QuickJS bridge benchmarks at 52M calls/sec. Layout is the bottleneck, not the bridge. The concern "but won't calling Lua from Zig be slow?" is empirically wrong. The Love2D stack runs the *entire* layout engine in Lua via LuaJIT and achieves 60fps on complex trees.

The Zig version of `layoutNode` has a `LAYOUT_BUDGET = 100000` — it caps at 100K node visits per frame. At 52M calls/sec bridge throughput, even if every node visit required a Lua↔Zig round-trip (it wouldn't), that's 0.002 seconds — well within frame budget.

## What .mod.tsz Should Look Like for Smith

The old `.mod.tsz` syntax (from tsz-gen) is a solid starting point. The key addition is **explicit Zig vs Lua markers**. Two approaches:

### Approach A: Lua-by-default with `@zig` escapes

```tsx
// layout.mod.tsz — module mode
// Everything is Lua unless marked @zig

import { EventHandler } from './events';

// @zig — type definitions always emit as Zig structs
enum FlexDirection { row, column }
interface Style { width?: f32; flexGrow: f32; /* ... */ }
interface Node { style: Style; children: Node[]; computed: LayoutRect; /* ... */ }

// @zig — pub fn signature in Zig, but body calls Lua
export function layout(root: Node, x: f32, y: f32, w: f32, h: f32) {
  // This body becomes LUA_LOGIC
  layoutCount = 0;
  layoutNode(root, x, y, w, h);
}

// Lua function — not exported, lives entirely in LUA_LOGIC
function layoutNode(node: Node, px: f32, py: f32, pw: f32, ph: f32) {
  const s = node.style;
  if (s.display === Display.None) {
    node.computed = { x: px, y: py, w: 0, h: 0 };
    return;
  }
  // ... flexbox math, all in Lua
}

function padLeft(s: Style): f32 { return s.paddingLeft ?? s.padding; }
function clampVal(val: f32, min: f32?, max: f32?): f32 { /* ... */ }
```

Smith would generate:
- **Zig output**: type definitions, `pub fn layout(...)` that calls `luajit_runtime.callModuleFn("layout", "layout", args)`
- **LUA_LOGIC**: the algorithm functions as Lua source embedded in the module

### Approach B: `<script>` blocks in modules (mirrors app pattern)

```tsx
// layout.mod.tsz
// Types are always Zig. <script> block is always Lua.

enum FlexDirection { row, column }
interface Style { /* ... */ }
interface Node { /* ... */ }

<script lang="lua">
function layoutNode(node, px, py, pw, ph)
  local s = node.style
  if s.display == "none" then
    node.computed = { x = px, y = py, w = 0, h = 0 }
    return
  end
  -- flexbox math
end

function padLeft(s) return s.paddingLeft or s.padding end
</script>

export function layout(root: Node, x: f32, y: f32, w: f32, h: f32);
// ^ declaration-only: Smith generates Zig stub that delegates to Lua
```

**Approach A is better** because it keeps a single language (TypeScript-like) and lets Smith do the Lua transpilation, exactly as it does for app code today. The `.mod.tsz` author writes TS; Smith decides what becomes Zig vs Lua based on the `@zig` markers and export signatures.

## How This Differs from "Compile Everything to Zig"

The tsz-gen approach and the naive instinct both say: "we have a TS→Zig compiler, so compile everything to Zig." This is wrong for framework modules, and here's the concrete evidence:

| Aspect | Everything-to-Zig (tsz-gen) | Zig+Lua split (proposed) |
|---|---|---|
| `layoutNode` | 800 lines of Zig with `asF32()` casts everywhere | 400 lines of Lua, clean math |
| Easing | Zig fn ptrs, `std.math.pow(f32, ...)` | `math.pow(2, -10*t)` in Lua |
| Type changes | Recompile entire binary (~30s) | Update Lua string, hot-reload |
| State logic | Fixed-size arrays, `@intCast` noise | Dynamic tables, natural |
| Hit testing | `while (i > 0) : (i -= 1)` with `@intCast` | `for i = #children, 1, -1` |
| Algorithm iteration | Compile→test→crash→fix loop | REPL iteration, print debugging |
| Bridge cost | Zero (it's all Zig) | Negligible (52M calls/sec) |
| Hot-reload | Full recompile | Lua string swap, 186ms |

The tsz-gen `layout.zig` (1020 lines) is a *worse* version of `layout.lua` (2544 lines) — fewer features, harder to read, impossible to iterate on. The Zig version exists because the old compiler could only target Zig.

Smith can target both. Use that.

## Phased Plan

### Phase 0: Module mode detection in Smith

Smith currently only handles `.app.tsz`. Add `.mod.tsz` detection:

- Forge reads the file extension and passes `__mode = "module"` to Smith
- Smith's `compile()` entry point checks `__mode` and routes to a new `compileModule()` path
- `compileModule()` shares the lexer/cursor/token infrastructure with the app path
- No new Zig code needed — Forge already reads arbitrary `.tsz` files

Key deliverable: `forge build layout.mod.tsz` produces output (even if initially just type definitions).

### Phase 1: Type declarations

The easiest part — tsz-gen already proved this works. Smith's module mode parses:

- `enum Name { A, B, C }` → `pub const Name = enum { a, b, c };`
- `interface Name { field: Type; }` → `pub const Name = struct { field: Type = default };`
- `type Alias = ...` → `pub const Alias = ...;`
- `import { X } from './Y'` → `const y = @import("y.zig"); const X = y.X;`

These always go to Zig. No Lua involved. The type mapping (TS types → Zig types) already exists in the reference compiler's `typegen.zig`.

**Start with**: `events.mod.tsz` (176 lines in current Zig, mostly type definitions). Smallest framework module. Produces `events.zig` with `EventHandler` struct and hit-test functions.

### Phase 2: Pure-Lua functions

Functions without `@zig` or `export` compile to `LUA_LOGIC`:

- Parse function signature and body using existing Smith parser
- Emit body as Lua source into the module's `LUA_LOGIC` string
- TS→Lua translation: `===` → `==`, `!==` → `~=`, `&&` → `and`, `||` → `or`, `null` → `nil`, `for...of` → `for _, v in ipairs()`
- Smith already does most of this for handler bodies — it has `luaParseHandler()` in `parse.js`

**Start with**: Easing functions. Pure math, zero dependencies, trivial to verify. `easeIn(t) { return t * t; }` → `function easeIn(t) return t * t end`.

### Phase 3: Exported Zig↔Lua bridge functions

Functions marked `export` need a Zig `pub fn` signature (so other Zig modules can call them) with a body that delegates to Lua:

```zig
// Generated Zig
pub fn layout(root: *Node, x: f32, y: f32, w: f32, h: f32) void {
    luajit_runtime.callModuleFn("layout", root, x, y, w, h);
}
```

This requires:
- A module registration system in `luajit_runtime.zig` — `registerModule("layout", lua_logic_string)`
- Argument marshalling (Zig → Lua stack push for primitives and pointers)
- Return value marshalling (Lua stack → Zig return)
- The Lua side receives the arguments and calls the Lua `layout()` function

The bridge already does this for simpler cases (`evalExpr`, `callGlobal`). Module functions need typed argument passing.

**Start with**: `telemetry.mod.tsz` — it has simple types (f32, u32, u64), straightforward function signatures, and the algorithms (FPS calculation, ring buffer management) are trivial in Lua.

### Phase 4: Node tree access from Lua

The big unlock. Layout needs to read/write `Node` struct fields from Lua. Two approaches:

**A. Accessor bridge** (safer, slower): Register Zig functions that Lua calls to read/write node fields:
```lua
-- Lua side
local w = node_get_style_width(node_ptr)
node_set_computed(node_ptr, x, y, w, h)
```

**B. LuaJIT FFI** (faster, direct): LuaJIT's FFI can access C structs directly if given the layout:
```lua
ffi.cdef[[
  typedef struct { float x, y, w, h; } LayoutRect;
  typedef struct Node { /* ... */ } Node;
]]
-- Then: node.computed.x = px
```

Approach B is how the Love2D stack works — Lua reads node properties directly. The `layout.lua` file accesses `node.style.width`, `node.children`, etc. naturally. LuaJIT FFI can do the same with Zig structs if the struct layout is `extern`.

This phase is the hardest and most impactful. Once Node access works from Lua, the layout algorithm can move wholesale.

### Phase 5: Layout migration

With Phase 4 done:

1. Split current `layout.zig` (1602 lines) into:
   - **Types** (~400 lines Zig): enums, Color, Style, Node, LayoutRect — stay as Zig structs
   - **Algorithm** (~800 lines Lua): `layoutNode()`, flex distribution, wrapping, intrinsic sizing
   - **Bridge** (~50 lines Zig): `pub fn layout()` → calls Lua, `pub fn telemetryBudget()` → reads Lua var

2. Port the Love2D `layout.lua` features that the Zig version lacks:
   - Viewport-proportional scaling
   - Profiling infrastructure
   - fit-content
   - Surface type proportional fallback (richer version)

3. Since both stacks now run layout in Lua, they can eventually share the same `layout.lua`.

### Phase 6: Cascade to other modules

Once the pattern is proven with layout, apply it to other modules in order of algorithmic density:

| Module | Lines | Zig portion | Lua portion |
|---|---|---|---|
| easing.zig | 252 | EasingType enum, fn ptr type | All easing functions |
| events.zig | 176 | EventHandler struct | hitTest(), hitTestHoverable() |
| state.zig | 634 | Slot structs, memory mgmt | Slot creation logic, dirty tracking |
| telemetry.zig | ~200 | FrameSample struct | FPS calc, history ring buffer |
| classifier.zig | 452 | ClassifierDef struct | Resolution logic, cascade |
| transition.zig | 702 | TransitionState struct | Animation tick, easing application |
| semantic.zig | 880 | SemanticNode struct | Analysis, validation |
| svg_path.zig | 938 | Path command structs | SVG path parser, tessellation |

Modules that stay **pure Zig** (FFI-heavy, GPU-facing):
- `engine.zig` (2192) — main loop, SDL event pump
- `qjs_runtime.zig` (1800) — IS the JS bridge
- `luajit_runtime.zig` (474) — IS the Lua bridge
- `render_surfaces.zig` (1458) — GPU command buffers
- `engine_paint.zig` (695) — wgpu draw calls
- `text.zig` (1219) — FreeType FFI, glyph atlas
- `audio.zig` (1154) — SDL audio API
- `blend2d.zig` (533) — blend2d C API

## What .mod.tsz Syntax Needs Beyond .app.tsz

Smith's existing parser handles JSX, components, state hooks, handlers, maps. Module mode needs:

1. **No JSX** — modules don't return render trees
2. **`enum` declarations** — already handled by tsz-gen's typegen, straightforward to port
3. **`interface` declarations** — struct definitions with typed fields and defaults
4. **`union` declarations** — tagged unions (Zig `union(enum)`)
5. **Module-level `let`/`const`** — become Zig `var`/`const` at file scope
6. **Function type annotations** — parameter types and return types (TS syntax)
7. **`@zig` marker** — forces a function to emit as pure Zig (for perf-critical paths)
8. **No `<script>` needed** — the entire function body IS the script; Smith decides placement
9. **`export`** — generates `pub fn` in Zig with Lua delegation bridge

Most of these are simpler than what Smith already handles (JSX parsing, component inlining, map pools). The old `typegen.zig` (reference compiler) is a working reference for all type declaration patterns.

## The End State

A `.mod.tsz` file compiles to a `.zig` file that contains:
- Type definitions (Zig structs/enums)
- `pub fn` bridge stubs (Zig signatures that call Lua)
- `MODULE_LUA_LOGIC` string constant (Lua source for algorithms)
- A module init function that registers the Lua logic

The framework becomes self-compiling: edit `.mod.tsz`, run `forge build`, get `.zig` with the right Zig/Lua split. The Zig stays minimal (types + bridge). The Lua stays clean (algorithms + logic). Hot-reload works because Lua strings can be swapped at runtime.

Eventually, the Love2D `layout.lua` and the tsz `layout.mod.tsz → LUA_LOGIC` converge on the same algorithm. One layout engine, two runtimes.
