# ReactJIT Vision

> Code should be easy to supervise, not just easy to write.
> If AI writes the code, then legibility becomes the main language feature.

---

## What This Is

ReactJIT is a TypeScript-to-native compiler and UI framework. `.tsz` source compiles to Zig, which links against an SDL3/wgpu/FreeType/QuickJS runtime to produce native binaries. The compiler has two halves: **Forge** (a thin Zig kernel, ~240 lines) hosts **Smith** (a JS-based compiler brain, ~1640 lines across 5 files) via QuickJS. Smith does the thinking. Forge does the plumbing.

The pipeline: `.tsz` source --> Lex (Zig) --> Parse/Emit (JS/Smith) --> Generated `.zig` --> Native binary.

There is also a working reference compiler in the Love2D stack (`love2d/scripts/tslx_compile.mjs`) that targets Lua. The compiler logic is the same -- how to walk JSX, track scope, resolve props -- only the output language differs. When Smith hits a bug, the Love2D compiler already solved it. Read that first.

---

## The Philosophy

### Human Supervision, Not Human Typing

The primary consumer of this codebase is a human who reads, verifies, and steers AI-written implementation. The bottleneck is not keystrokes -- it is comprehension. Every design choice optimizes for the person who must maintain the mental model while agents do the typing.

This means:

- **Explicit over clever.** Repetitive over magical. Named over inferred.
- **Split by concern.** Low hidden control flow. Low syntax tricks.
- **Easy to diff, easy to regenerate, easy to throw away and redo.**
- **Boring in the small, coherent in the large.**

The `.tsz` syntax, the block structure (`<state>`, `<functions>`, `<var>`), the classifier system (`C.Card`, `C.StatusBadge`), and the tier model all exist to make generated code legible to a human supervisor. The AI is constrained to put state in a state box, logic in a logic box, layout in a layout box. If the shape is wrong, the human sees it instantly without reading the syntax.

This is not a programming language for humans to write. It is a communication protocol between AI agents and a human reviewer.

### The tsz Rule

If it's not generating code, it should be generated code. The runtime is written in `.mod.tsz`. The compiler turns `.mod.tsz` into `.zig`. Hand-written `.zig` in the runtime is temporary -- it means the compiler hasn't caught up. Fix the compiler, don't write more `.zig`.

### Postel's Law

The compiler accepts soup (HTML/DOM/CSS). The golden path produces strict zones, theme tokens, named shapes. Three-tier conformance suite is Postel's Law as a design system.

---

## The Preflight System

### Why It Exists

Smith currently relies on a post-hoc bash script that `grep`s generated Zig for symptoms of bugs. This is fundamentally backwards -- it throws away all the rich semantic context gathered during the parse phase. Preflight reverses this: validate `ctx` while we still know *why* something was emitted.

There are two classes of bugs:

**Class A** -- currently grep-detectable after the fact. Handler wiring failures, duplicate names, map dispatch issues. Preflight catches these earlier with better error messages. Good, but not the real motivation.

**Class B** -- currently uncatchable. Silent wrong-output bugs where Zig compiles, runs, and renders garbage. No grep pattern exists because the output is semantically wrong but syntactically valid. Only ctx-level inspection can find these.

Class B examples:
- `Color{}` emitted with no dynStyle entry -- element invisible forever, no error
- Template literal `${expr}` not resolved -- literal text shown to user
- Map handler with empty body AND empty luaBody -- dead button, no error
- OA field accessed that doesn't exist in schema -- empty string or Zig crash
- Script function called but not in `ctx.scriptFuncs` -- QuickJS returns undefined silently

**Class B is why preflight exists.** This is not "bash lint moved earlier." It is the only way to catch wrong-but-compiling output.

### Architecture

Preflight is a pure, read-only function. It runs after `parseJSXElement` completes (ctx fully populated), before `emitOutput` (before wasting Zig build time). It writes nothing to ctx. Parse populates, preflight validates, emit generates.

```
compile() in index.js:
  collectScript(c)
  collectComponents(c)
  collectState(c)
  find App, find return
  parseJSXElement(c)        <-- parse populates ctx
  preflight(ctx)            <-- NEW: validate ctx (read-only)
  emitOutput(root, file)    <-- only reached if preflight passes
```

File: `tsz/compiler/smith/preflight.js` (~200-250 lines). Loaded by Forge alongside the other Smith files. Single exported function:

```js
function preflight(ctx) -> { ok, errors, warnings, lane, intents }
```

### Intent Derivation

Intents are derived from existing ctx fields after parse -- not tracked during parse. No scattered `ctx.intents.add()` calls in parse.js. The whole value is that parse already builds semantic state; don't re-derive it from tokens.

```js
const intents = {
  has_maps:          ctx.maps.length > 0,
  has_map_handlers:  ctx.handlers.some(h => h.inMap),
  has_state:         ctx.stateSlots.length > 0,
  has_script_block:  ctx.scriptBlock !== null,
  has_html_tags:     /* derived from node tree */,
  // ...
};
```

**Exception:** For outcomes that are lost after parse returns (e.g., "did this ternary color resolve to a valid hex or fall back to Color{}?"), add minimal, targeted tracking (~6 lines total) in attrs.js or parse.js.

### The Check Catalog

#### FATAL Checks (block compilation)

| ID | Check | Replaces Bash | Class |
|----|-------|---------------|-------|
| F1 | Handler declared with empty body (`!body && !luaBody`) | Handler declared but never assigned | A |
| F2 | Handler referenced in `.on_press` but missing from `ctx.handlers` | Handler ref but no fn | A |
| F3 | Map handler (`inMap`) lacks Lua dispatch body | Map handler uses string literal | A |
| F4 | `Color{}` emitted without dynStyle/runtime fix | Color{} count (upgraded from WARN) | B |
| F5 | OA field accessed but missing from schema | N/A (new) | B |
| F6 | Template literal expression failed to resolve | N/A (new) | B |
| F7 | Duplicate handler names | Duplicate `__mapPress` functions | A |
| F8 | Map over non-OA identifier | N/A (new, currently produces broken .zig) | B |
| F9 | Script function called but not in `ctx.scriptFuncs` | N/A (new) | B |
| F10 | JS syntax (`const`, `let`, `+`) leaked into luaBody | JS syntax in LUA_LOGIC | A |

#### WARN Checks (compile continues)

| ID | Check | Replaces Bash |
|----|-------|---------------|
| W1 | `Color{}` placeholders that are resolved (count > 0) | Color{} count |
| W2 | `_map_lua_ptrs` allocated but never used in map pool | Map lua_ptrs unused |
| W3 | State slot declared but never read | N/A (new) |
| W4 | Prop passed to component but never consumed | N/A (new) |

### Error Format

On FATAL, emit valid Zig that immediately `@compileError`s with readable diagnostics:

```zig
//! PREFLIGHT BLOCKED: tsz compiler detected errors
//! FATAL: F3: map handler _handler_press_2 (map 0) has no lua dispatch
//! FATAL: F5: map accesses field "status" but OA[0] has no such field
comptime { @compileError("Smith preflight failed. See errors above."); }
```

The Zig build fails gracefully with human-readable errors instead of cryptic type errors 200 lines into generated code.

### Bash Lint Migration

10 of 12 bash checks are replaced by preflight. The single-quoted string leak check stays permanently -- it is a pure output artifact that genuinely requires grepping generated Zig and is not derivable from ctx. Everything else migrates incrementally: run both in parallel for one conformance cycle, confirm identical catches, then remove bash checks one by one.

---

## Compile Lanes

The intent manifest classifies each cart into a compilation tier. This determines what validations run and what optimizations the emitter can apply.

| Lane | Triggered By | What It Skips |
|------|-------------|---------------|
| **Chad** (fast) | No HTML tags, strictly native primitives, strict styles | HTML normalization, CSS string resolution, event name translation |
| **Mixed** (standard) | HTML tags present, style ternaries, template literals | Nothing -- full validation |
| **Soup** (slow) | `<script>` blocks, nested maps, complex imports | Nothing -- maximum validation + script handling |

Detection:

```js
function determineLane(intents) {
  if (intents.has('script_block') || intents.has('script_import')) return 'soup';
  if (intents.has('html_tags') || intents.has('ternary_styles')) return 'mixed';
  return 'chad';
}
```

Lanes are informational first (emit `// lane: chad` as a comment). Gate emit optimizations only after lane detection proves stable across the conformance suite.

---

## Debugging Philosophy

### Evidence First, Theory Never

When something exists and isn't working as intended, do not theorize. The protocol:

1. Add logs around the suspected area
2. Run it
3. Read the output
4. Now you know what's wrong
5. Fix it

No step 0 of "let me understand the architecture first." The logs ARE the understanding. Theory-crafting working-but-broken code is the single biggest time sink. Print the data, read the data, fix based on what is actually there.

**When to theory-craft:** When something doesn't exist at all. When something exists and works but feels wrong. Never when something exists and is broken.

### Debug Logs Are Infrastructure

Debug logging is never removed. It is silenced behind a flag. Every time someone strips logs out to "clean up," the next person rediscovers the same observation points from scratch. The logs are infrastructure, not clutter.

`SMITH_DEBUG=1` shows the dynTexts dump, handler wiring, array targets. Without the flag, silent.

### The Debug Dictionary

Everything that writes to stdout across the entire stack (compiler, CLI, runtime, codegen) is defined in one location. Each entry has an ID, category, and format string. Nothing prints unless it is registered in the dictionary.

```
LOG_001: [forge:lex]     tokenized {count} tokens from {file}
LOG_002: [smith:parse]   collected {count} components, {count} maps
LOG_003: [smith:emit]    generated {bytes} bytes
LOG_004: [handler:fire]  {name} at map{mi} item {i}
LOG_005: [map:rebuild]   map{mi} count={count}
LOG_006: [dynText:update] buf{id} = "{value}"
LOG_007: [state:set]     slot {slot} = {value}
```

One file. One source of truth. Grep for `LOG_042` and find the exact definition and every callsite. No scattered print strings that nobody maintains.

### Ambient Codegen Logging

Smith-generated code always includes debug instrumentation, gated behind a comptime flag:

```zig
const DEBUG = @import("build_options").debug_codegen;

fn _handler_press_0() void {
    if (DEBUG) std.debug.print("[handler:press_0:map0] fired\n", .{});
    // actual handler body
}

fn _rebuildMap0() void {
    if (DEBUG) std.debug.print("[map0:rebuild] count={d}\n", .{_oa0_len});
    // actual rebuild
}
```

Comptime `if (DEBUG)` is zero cost in release builds -- Zig strips dead branches entirely. Flip the flag and every handler fire, map rebuild, state update, dynText resolution prints what happened. No more "add logs, find bug, remove logs." The logs are always there, always free, always one flag away. `tsz-build cart.tsz --debug` turns them all on.

Nobody writes a log line. The system knows what to trace because it knows what it generated. New features get debug logging for free because the emit path adds it.

---

## Generated Code as Tagged Infrastructure

Since no human reads the generated `.zig` directly, tag it aggressively. Every node, handler, map pool, and dynText gets a comment tag with its origin:

```zig
// [d44:line28:C.Card:map0:item]
var _arr_3 = [_]Node{ ... };

// [d44:line32:StatusBadge:map0:cond:status==0]
// [handler:press_0:map0:item.title->setSelected]
fn _handler_press_0() void { ... }
```

`--inspect "StatusBadge"` or `--inspect "map0"` or `--inspect "handler"` just greps the tags. Fuzzy search across the whole generated output. This also feeds into preflight -- if every generated piece has an origin tag, preflight can say `"F4: Color{} at [d44:line32:StatusBadge:map0:cond:status==0]"` instead of just `"Color{} on line 221."`

### Split Generated Output

Generated files should mirror Smith's own modules:

```
generated_d12/
  nodes.zig       -- node tree declarations
  handlers.zig    -- event handler functions
  state.zig       -- state slots, dynamic text buffers, OA arrays
  maps.zig        -- map pools, rebuild functions
  logic.zig       -- JS_LOGIC, LUA_LOGIC strings
  app.zig         -- root, init, update, entry point (imports the rest)
```

Each file is small enough to read in one shot and reason about one concern. "The handler isn't wired" -- open handlers.zig and maps.zig. Not 75KB of everything.

---

## Implementation Phases

### Phase 1: Foundation

1. Create `preflight.js` with F1, F3, F7 (the three most common bash lint hits)
2. Wire into `compile()` between parse and emit. On FATAL, return `@compileError` Zig block.
3. Run against d01-d104 conformance suite. **False positive = preflight bug.** Fix before proceeding.

### Phase 2: Class B Coverage

1. Add F4, F5, F6, F9 -- these are new coverage, not replacements
2. Verify no false positives on conformance suite
3. Add W1-W4 for developer ergonomics

### Phase 3: Bash Migration

1. Parallel-run preflight with bash lint for one conformance cycle
2. Confirm identical catches
3. Remove superseded bash checks one by one
4. Keep single-quoted string leak check permanently

### Phase 4: Lane Detection

1. Implement `determineLane()`, output `// lane: chad` in generated code
2. Log-only first. No emit gating.

### Phase 5: Lane-Optimized Emit

1. Chad lane: skip HTML mapping, CSS normalization, event name translation
2. Soup lane: extra validation + helpful error messages for common DOM patterns
3. Measurable compile time difference between lanes

### Phase 6: Generated Code Split + Tagging

1. Origin tags on every generated declaration
2. `--inspect` flag for fuzzy search across generated output
3. Split generated output into per-concern files
4. Ambient debug instrumentation gated behind comptime flag
5. Debug dictionary as single source of truth for all log lines

### File Budget

- `preflight.js`: ~200-250 lines (pure validation logic)
- `parse.js` / `attrs.js`: +~6 lines (targeted outcome tracking for Class B checks)
- `index.js`: +~15 lines (integration)
- `scripts/build`: -~80 lines (bash lint removal, phased)

---

## Known Bug Families (as of 2026-03-27)

From a consolidated sweep of 21 conformance carts:

| Bug | Impact | Root Cause |
|-----|--------|------------|
| Map handler ptrs unwired | 12 carts | `_map_lua_ptrs` arrays initialized but never assigned to pool nodes. `js_on_press` emitted as string literal instead of through ptr arrays. |
| JS/Lua syntax leak in handler bodies | 7 carts | When cart has `<script>` (JS), handler dispatch should use JS syntax, but `luaParseHandler` runs first and stores Lua-syntax body (single quotes, `..` concat). |
| Unresolvable expressions pass through silently | 3 carts | When Smith can't resolve an expression, it dumps raw source text into Zig output instead of erroring. |
| OA field storage not emitted | 1 cart | Object-array field doesn't get its backing array emitted. |

Fixing bugs 1+2 alone clears 16 of 18 broken carts. These are the exact bugs that preflight F1-F3 and F10 will catch at parse time instead of discovering in generated Zig.

---

## The Love2D Rule

When Smith hits a compiler bug, read the Love2D reference compiler first (`love2d/scripts/tslx_compile.mjs`). It already solves every compiler problem -- maps, nested maps, component inlining, prop resolution, conditionals inside maps, template literals.

The pattern is always the same:
1. Worker hits a bug
2. Starts analyzing the architecture
3. Discovers it is "structural" and "complex"
4. Spirals into node wiring and array scoping
5. Meanwhile Love2D solved it in 5 lines by just making it dynamic

Love2D doesn't overthink anything. Ternary text? Dynamic. Map item prop? Dynamic. Conditional child? Dynamic. It never tries to be clever about what can be resolved at compile time. Everything that might change at runtime gets a dynamic binding and an empty placeholder.

Smith keeps trying to be smart about it -- "can I resolve this statically?" -- and that is where every bug comes from.

---

## Design Principles (Summary)

1. **Preflight validates intent, not output.** Check ctx while you still know why something was emitted. Don't grep symptoms after the fact.
2. **Evidence before theory.** When something is broken, add logs, run it, read the output. Never theorize first.
3. **Debug infrastructure is permanent.** Silence logs behind flags. Never delete them.
4. **Generated code is tagged, split, and instrumented.** Nobody reads it directly. Make it searchable and debuggable by machines.
5. **Accept soup, reward structure.** The compiler handles HTML/CSS/DOM input. The golden path (chad tier) is native primitives, classifiers, script blocks.
6. **Read the reference.** Love2D solved it. Copy the approach. Don't invent from scratch.
7. **The human supervises, the AI types.** Optimize every syntax and structure decision for the reader-director, not the typist.
8. **False positives are bugs.** If preflight blocks a cart that would have compiled successfully, that is a preflight bug. The conformance suite is the oracle.
