---
title: Architecture
description: How tsz transforms .tsz source into a native binary with zero framework runtime cost.
category: Architecture
keywords: pipeline, codegen, compiler, runtime, state slots, import merging, component inlining, phases
related: useState, FFI, Box, CLI
difficulty: intermediate
---

## Overview

tsz is a **code generator**, not a compiler in the traditional sense. It transforms `.tsz` syntax — which looks like React/TSX — into Zig source code. The Zig compiler then compiles that source into a native binary. There is no runtime, no interpreter, no VM, no JIT.

```
.tsz source → [tsz codegen] → .zig source → [zig compiler] → native binary
```

The `.tsz` file ceases to exist at runtime. Every `<Box>`, every `useState`, every `onPress` becomes a Zig struct literal, a state slot index, a function pointer — all resolved at compile time. Zero abstraction overhead.

## The Two Modes

The codegen engine operates in two modes. Both use the exact same pipeline internals. The difference is what gets emitted around the generated node tree.

### Full App Build

```bash
./zig-out/bin/tsz build app.tsz
./zig-out/bin/tsz run app.tsz
```

Generates a complete `generated_app.zig` with `pub fn main()`, SDL window creation, the event loop, watchdog initialization, and the compositor. Output is a standalone binary. This is the mode for user apps.

### Pre-compile (Runtime Fragment)

```bash
./zig-out/bin/tsz compile-runtime Panel.tsz
```

Generates a `.gen.zig` fragment — a Zig module with a public API (`init`, `tick`, `getRoot`, named accessors) but no `main` function. It is designed to be `@import`ed by the runtime. This is for framework internals: devtools panels, crash screens, overlay UI.

Pre-compile vs full build is **scope, not capability**. Both emit the same node tree, state slots, handlers, dynamic text, and conditionals. The only difference is the wrapper:

- **Full build:** wraps in `main()` + SDL event loop + compositor
- **Pre-compile:** wraps in `init`/`tick`/`getRoot` + named accessors

Pre-compiled fragments are checked into the repo as Zig source. When `zig build engine` runs, the Zig compiler sees:

```zig
const devtools_panel = @import("compiled/framework/devtoolspanel.gen.zig");
```

To Zig, this is just another module. It optimizes it identically to hand-written code — inlining, dead code elimination, everything. The fact that it was generated from `.tsz` files is invisible.

## Import Merging

Before codegen sees a single token, all imports are resolved into one flat source string.

`main.zig` implements a depth-first recursive merge (`mergeImports`). For each file:

1. Scan the source text for `import { ... } from './path'` statements
2. Resolve each path relative to the importing file's directory (appending `.tsz` if needed)
3. Recursively process each imported file's imports first (depth-first)
4. Append the imported source, then this file's source

Cycle detection prevents infinite loops via a visited set. The result is a single token stream that the codegen engine processes as if it were one file. Import statements themselves are stripped; only the content they reference is included.

This means component composition — splitting a UI across multiple `.tsz` files — has zero runtime cost. By the time codegen runs, the files have already been flattened.

## The 6-Phase Codegen Pipeline

The `Generator.generate()` function in `codegen.zig` runs six sequential phases, each making a pass over the merged token stream:

### Phase 1 — FFI Pragmas

Scans for `// @ffi <header.h>` directives and `declare function` signatures. Produces the `@cImport` block and extern function declarations that appear at the top of the emitted Zig file. Also pre-scans for PTY and inspector built-in usage.

### Phase 2 — Declarations

Collects `declare function` signatures and panel imports (`import { x } from '@panels'`). These become the foreign function declarations that user code can call through.

### Phase 3 — Classifiers and Components

Two sub-passes:

- **Classifiers:** Collects `classifier({...})` blocks — named style presets that expand to inline style literals at JSX emission time. A classifier reference like `<C.Card>` becomes the full struct literal for that style.
- **Components:** Collects all non-`App` function definitions and their prop signatures. Component definitions are stored as token ranges; they are not emitted as Zig functions — they are inlined at their call sites during JSX emission (Phase 6).
- **Utility functions:** Collects lowercase helper functions for use in handler bodies.

### Phase 4 — State Collection

Finds the `App` function and walks it for `useState(initial)` calls. Each call is assigned a **compile-time slot ID** — an integer index into the runtime's flat state array. The getter name, setter name, initial value, and type are recorded.

At runtime init, these become sequential `state.createSlot(initial)` calls. The slot ID is baked into every reference to that state variable throughout the generated code.

### Phase 5 — Effects and Animations

Collects `useEffect` calls (categorized as `mount`, `watch`, `every_frame`, or `interval`), `useTransition` and `useSpring` animation hooks, and local `const` variable bindings. Effect dependency slots are resolved to the slot IDs assigned in Phase 4.

### Phase 6 — JSX Emission

Finds the `return` statement and parses the JSX tree. This is where the generated Zig node arrays are emitted.

Every JSX element becomes a Zig struct literal in a `var _arr_N = [_]Node{ ... }` array. Children reference their parent arrays by name. Event handlers become named Zig functions (`_handler_press_N`). Dynamic text bindings (template literals like `` `Count: ${count}` ``) become fixed-size stack buffers updated by `updateDynamicTexts()` when the relevant state slot is dirty.

When a JSX element references a user-defined component, the component's prop bindings are pushed onto a substitution stack and the component's body is inlined directly — no function call, no indirection.

## Component Inlining

Components in tsz are not functions at runtime. They are inlined node trees.

When the JSX emitter encounters `<StatusBar title={name} />`, it:

1. Looks up the `StatusBar` component definition (collected in Phase 3)
2. Pushes a prop binding: `title` → current value of `name`
3. Recursively emits `StatusBar`'s JSX body with prop references substituted
4. Pops the binding

The output contains no call to a `StatusBar` function. The node tree is as flat as if the user had written out all the nodes by hand. This is why component composition costs nothing at runtime.

## State Slots

State in tsz is a flat array of typed slots, allocated at init and never moved.

Each `useState(initial)` in `.tsz` becomes a slot ID at compile time. The generated code calls `state.createSlot`, `state.createSlotFloat`, `state.createSlotBool`, or `state.createSlotString` once during `main()` init, in the order they were declared. Slot 0 is the first `useState`, slot 1 is the second, and so on.

The state module (`state.zig`) holds a fixed array of 256 `StateSlot` values:

```zig
pub const StateSlot = struct {
    value: Value,  // tagged union: int | float | boolean | string
    dirty: bool,
};
```

A global `_dirty` flag is set whenever any slot changes. Setters check the new value against the current and no-op if unchanged.

For runtime fragments (pre-compiled panels), slots are reserved in blocks via `state.reserveSlots(count)`, so multiple panels can share the same state store without ID collision.

## The Runtime Loop

Every frame, `generated_app.zig`'s main loop runs this sequence:

1. **Poll events** — SDL events are dispatched: window resize, mouse motion (hit test → hover), mouse down (hit test → `on_press` handler), scroll, keyboard.

2. **Dirty check** — `state.isDirty()` is checked. If true, `updateDynamicTexts()` runs: for each dynamic text binding, if its dependent slot is dirty, re-format the string into the stack buffer and point the node's `text` field at the new slice. Then `state.clearDirty()` resets all dirty flags.

3. **Watchdog** — `watchdog.check()` samples RSS. If over the 512 MB limit or growing faster than 50 MB/s, it tears down the window and calls `bsod.show()`.

4. **Layout** — `layout.layout(&root, 0, 0, win_w, win_h)` runs the flexbox engine over the entire node tree, writing pixel coordinates into each node's `computed` field. Text measurement uses FreeType via a callback wired up at init.

5. **Paint** — `compositor.frame(&root, ...)` walks the tree and paints backgrounds, borders, images, and text via SDL2. Scissor clipping is applied for scroll containers. Z-index sorting is applied per-container where needed.

6. **Secondary windows** — `win_mgr.layoutAll()` and `win_mgr.paintAndPresent()` handle any `<Window>` elements that opened separate SDL windows.

There is no virtual DOM. There is no diff. The node tree is rebuilt from state on every dirty frame — but "rebuilt" means updating a handful of text pointers and style fields in a stack-allocated array. The tree structure itself is fixed at compile time.

## Zero Framework Runtime Cost

In a web framework, React ships a reconciler, a virtual DOM, and a diff algorithm — all running in the browser on every frame. In tsz, there is no React. The compiler resolves component composition, prop passing, conditional rendering, and state binding into flat Zig at compile time.

The Love2D stack in this repo illustrates the alternative:

```
.tslx source → [esbuild plugin] → Lua source → [QuickJS interprets JS] → [Lua bridge] → Love2D
```

Three languages at runtime: JavaScript (QuickJS), Lua (LuaJIT), and C (Love2D/OpenGL). Every frame, the JS reconciler diffs the virtual tree, marshals changes across the FFI bridge, and Lua applies them.

In tsz, there is **one language at runtime: Zig.** The state system is ~100 lines of Zig. The layout engine is a Zig port. The painter is Zig calling SDL2. The generated app code is Zig. No bridges, no marshaling, no interpretation.

The `.tsz` file is a **design artifact**, not a runtime dependency. You could delete every `.tsz` file after compiling and the binary would be identical. The `.tsz` exists for humans to read and maintain. The `.gen.zig` exists for Zig to compile. They are different representations of the same thing at different stages of the pipeline.

## Internals

### Key source files

| File | Role |
|------|------|
| `tsz/compiler/main.zig` | CLI entry point, import merging (`mergeImports`, `buildMergedSource`) |
| `tsz/compiler/codegen.zig` | All 6 phases, JSX emitter, component inlining, classifier expansion |
| `tsz/runtime/state.zig` | Slot array, dirty flag, `createSlot*`, `getSlot*`, `setSlot*` |
| `tsz/runtime/generated_app.zig` | Example compiler output — shows what `.tsz` compiles to |
| `tsz/runtime/main.zig` | Standalone runtime entry point (non-generated reference) |
| `tsz/runtime/layout.zig` | Flexbox engine |
| `tsz/runtime/compositor.zig` | SDL2 painter |

### Compile-time limits (codegen.zig)

| Constant | Value | Controls |
|----------|-------|---------|
| `MAX_PANEL_IMPORTS` | 32 | Component imports per file |
| `MAX_CLASSIFIERS` | 256 | Named style presets |
| `MAX_UTIL_FUNCS` | 32 | Helper functions |
| `MAX_UTIL_PARAMS` | 16 | Params per helper |
| `MAX_COMPUTED_ARRAYS` | 16 | `.filter()` / `.split()` derived arrays |
| `MAX_MAP_INNER` | 16 | Nodes inside a `.map()` template |

### State limits (state.zig)

| Constant | Value | Controls |
|----------|-------|---------|
| `MAX_SLOTS` | 256 | Total state slots across all panels |
| `MAX_ARRAY_SLOTS` | 16 | Array state slots |
| `MAX_ARRAY_LEN` | 256 | Elements per array slot |
| `STRING_BUF_SIZE` | 256 | Bytes per string slot |

## See Also

- [Getting Started](../01-getting-started/index.md)
- [useState](../05-state/use-state.md)
- [FFI](../07-ffi/index.md)
- [CLI](../09-cli/index.md)
- [Runtime](../10-runtime/index.md)
