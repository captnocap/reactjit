# Compiler Pipeline

How `.tsz` source becomes a native binary.

## Overview

The tsz compiler is a single-pass, ahead-of-time compiler that transforms TypeScript + JSX (`.tsz`) into Zig source code, which is then compiled to a native binary by `zig build`. There is no runtime interpreter — all UI structure, state management, and event handling are resolved at compile time.

```
.tsz source → lexer → lint → 9-phase codegen → generated_app.zig → zig build → native binary
```

## Pipeline Phases

The compiler runs a 9-phase pipeline, all driven by `codegen.zig`'s `Generator.generate()`:

| Phase | Name | What it does |
|-------|------|-------------|
| 1 | `collectFFIPragmas` | Scans `// @ffi <header.h> -llib` pragmas for C interop |
| 2 | `collectDeclaredFunctions` | Scans `declare function foo(): type` for FFI function signatures |
| 3 | `collectClassifiers` | Scans `classifier({...})` blocks for semantic style abstractions |
| 4 | `collectComponents` | Scans `function MyComp({props}) { return <...> }` for component definitions |
| 4.5 | `collectUtilFunctions` | Scans lowercase `function helpers()` (non-component, non-App) |
| 5 | `extractComputeBlock` | Extracts `<script>...</script>` JS logic for QuickJS |
| 6 | `collectStateHooks` | Scans `useState`, `useFFI`, `useTransition`, `useSpring` declarations |
| 6.25 | `collectEffectHooks` | Scans `useEffect` lifecycle hooks |
| 6.5 | `collectLetVars` | Scans `let x = expr` mutable variable declarations |
| 7 | `countComponentUsage` | Counts `<MyComp>` references for multi-use optimization |
| 7.5 | `collectAppConditionals` | Scans root-level `{state && <JSX>}` conditional patterns |
| 7.9 | `validate` | Catches unknown tags, bad props, unknown identifiers |
| 8 | `parseJSXElement` | Recursive-descent JSX parsing → Zig node tree |
| 9 | `emitZigSource` | Assembles the final `.zig` output file |

## Generated Output Structure

The emitted `generated_app.zig` contains (in order):

1. **Imports** — `std`, `layout`, `engine`, `state`, `router`, `qjs_runtime`, FFI headers
2. **FFI wrappers** — `_ffi_funcName` functions wrapping C calls
3. **State manifest** — human-readable slot-to-name mapping
4. **Node tree** — `var _arr_N = [_]Node{...}; var root = Node{...};`
5. **Dynamic text buffers** — `var _dyn_buf_N: [size]u8 = undefined;`
6. **Event handlers** — `fn _handler_press_N() void { state.setSlot(...); }`
7. **Component init functions** — `fn _initMyComp(...) Node { ... }`
8. **JS_LOGIC** — embedded JavaScript string for QuickJS execution
9. **Lifecycle functions** — `_initState`, `_updateDynamicTexts`, `_updateConditionals`
10. **`_appInit`** — calls all init functions at startup
11. **`_appTick`** — per-frame: FFI polling, state dirty checks, text updates
12. **`main()`** — calls `engine.run(...)` with the root node and callbacks

## Compilation Modes

### App mode (default)
```bash
bin/tsz build myapp.tsz
```
Produces `generated_app.zig` → full binary at `zig-out/bin/myapp`.

### Module mode (`.mod.tsz`)
```bash
bin/tsz build state.mod.tsz
```
Produces `state.gen.zig` — a lighter fragment with `pub fn render() Node { ... }`. Used for runtime modules.

### Embed mode (`--embed`)
```bash
bin/tsz build --embed inspector.tsz
```
Writes to `framework/devtools.zig` instead of `generated_app.zig`. The engine imports it directly — no separate binary.

### Imperative mode (`_zscript.tsz`)
Pure TypeScript without JSX, compiled to a Zig module. No App function needed. Delegates to `modulegen.zig` which uses `typegen`, `stmtgen`, and `exprgen` for statement-level codegen.

## Import Resolution

The compiler resolves imports from `from './path'` statements:

1. Strips leading `./` from import paths
2. Tries suffix-mapped extensions: `_cls.tsz`, `_c.tsz`, `_script.tsz`, etc.
3. Falls back to trying extensions in priority order
4. `_script.tsz` imports are loaded as JS (not merged into the Zig source)
5. All other imports are textually merged (inlined) into the source before codegen

### Import boundaries

Two isolated worlds exist — **app** and **module**:

- App world: `.tsz` can import `_c.tsz`, `_cls.tsz`, `_script.tsz`
- Module world: `.mod.tsz` can import `_cmod.tsz`, `_clsmod.tsz`, `_script.tsz`
- Cross-world imports are rejected at compile time

## CLI Subcommands

| Command | Description |
|---------|-------------|
| `tsz build <file.tsz>` | Full compile + build binary |
| `tsz dev <file.tsz>` | Hot-reload dev mode (see dev-mode.md) |
| `tsz check <file.tsz>` | Preflight validation — full pipeline, no output |
| `tsz lint <file.tsz>` | Standalone lint pass — no codegen |
| `tsz test <file.tsz>` | Build and run with test harness |
| `tsz init` | Scaffold a new cart |
| `tsz convert` | Convert between file formats |
| `tsz setup-editor` | Install VSCode extension for .tsz |

## Flags

| Flag | Effect |
|------|--------|
| `--strict` | Warnings become build errors |
| `--embed` | Output to `framework/devtools.zig` instead of `generated_app.zig` |

## Self-Extracting Binaries

After `zig build` produces a raw binary, `cli_dist.zig` packages it as a self-extracting binary. The result runs on any x86_64 Linux with zero dependencies.

## Known Limitations

- Max 1600 lines per `.zig` or `.tsz` file (enforced by build)
- Max 32 imports per file (`MAX_IMPORTS`)
- Max 512 state slots, 512 dynamic texts, 512 conditionals
- Max 64 components, 128 component instances
- The `<` operator in script blocks is parsed as a JSX tag opening — use `count > i` instead of `i < count`
