# Architecture Overview

How all the pieces of tsz fit together.

## The Big Picture

```
                    ┌─────────────────────────────────────────────┐
                    │              .tsz Source Files               │
                    │  app.tsz  _c.tsz  _cls.tsz  _script.tsz    │
                    └──────────────────┬──────────────────────────┘
                                       │
                              ┌────────▼────────┐
                              │    Compiler      │
                              │  (28 Zig files)  │
                              │  9-phase pipeline│
                              └───┬─────────┬───┘
                                  │         │
                    ┌─────────────▼──┐  ┌───▼──────────────┐
                    │ generated_app  │  │   JS_LOGIC       │
                    │    .zig        │  │ (embedded string) │
                    └───────┬────────┘  └───────┬──────────┘
                            │                   │
                    ┌───────▼───────────────────▼──────────┐
                    │           Framework Runtime           │
                    │                                       │
                    │  engine.zig ── main loop              │
                    │  layout.zig ── flex layout             │
                    │  state.zig ── slot-based state         │
                    │  gpu/     ── wgpu rendering            │
                    │  text.zig ── FreeType text             │
                    │  qjs_runtime.zig ── QuickJS VM         │
                    │  vterm.zig ── terminal emulation       │
                    │  cartridge.zig ── .so loading          │
                    │  + 50 more modules                    │
                    └───────────────┬───────────────────────┘
                                    │
                    ┌───────────────▼───────────────────────┐
                    │         Native Dependencies           │
                    │  SDL3 · wgpu · FreeType · libvterm    │
                    │  QuickJS · zlib · Bullet3D (optional) │
                    └───────────────────────────────────────┘
```

## Layer Breakdown

### 1. Source Layer (`.tsz` files)

The input. TypeScript + JSX syntax that describes UI structure, state, event handlers, styles, and JavaScript logic. Organized as "carts" — self-contained app directories.

**Key insight**: `.tsz` is NOT TypeScript. It's a custom language that borrows TS/JSX syntax but compiles to Zig, not JavaScript. There is no `tsc`, no `node_modules`, no npm.

See: [Cart Structure](systems/cart-structure.md)

### 2. Compiler (`tsz/compiler/`)

A single-pass, ahead-of-time compiler written in Zig. 28 source files, ~15,000 lines.

```
cli.zig          Entry point, subcommand routing, import resolution
lexer.zig        Tokenizer (TS/JSX tokens)
codegen.zig      Pipeline orchestrator, Generator struct, types/constants
collect.zig      Phases 1-7.5: token scanning, declaration collection
validate.zig     Phase 7.9: pre-emission error checking
jsx.zig          Phase 8: recursive-descent JSX → Zig node tree
components.zig   Component inlining (called from jsx.zig)
attrs.zig        Attribute/style parsing
handlers.zig     Event handler and expression compilation
emit.zig         Phase 9: final Zig source assembly
modulegen.zig    Imperative mode (_zscript.tsz → .zig)
stmtgen.zig      Statement codegen (if/for/switch → Zig)
exprgen.zig      Expression codegen (arithmetic, comparisons, calls)
typegen.zig      Type declarations (enum, interface, type alias)
lint.zig         Structural linter
html_tags.zig    HTML → primitive mapping
tailwind.zig     Tailwind class → style resolution
```

**Two output modes**:
- **App mode**: Full `generated_app.zig` with main(), lifecycle, state, handlers
- **Module mode**: Fragment `.gen.zig` with `pub fn render() Node`

See: [Compiler Pipeline](systems/compiler-pipeline.md)

### 3. Framework Runtime (`tsz/framework/`)

The engine that makes compiled apps run. ~60 Zig source files. The generated app imports and calls into this layer.

#### Core modules

| Module | Role |
|--------|------|
| `engine.zig` | Main loop: SDL3 init, event dispatch, layout, paint, tick |
| `layout.zig` | Pixel-perfect flex layout engine (ported from Love2D) |
| `state.zig` | Global state slot array with dirty flags |
| `text.zig` | FreeType font rendering and text measurement |
| `events.zig` | Input event handling and dispatch |
| `input.zig` | Keyboard/mouse state tracking |
| `windows.zig` | SDL3 window management |

#### GPU pipeline (`framework/gpu/`)

| Module | Role |
|--------|------|
| `gpu.zig` | wgpu initialization and orchestration |
| `rects.zig` | Rectangle/rounded-rect batch renderer |
| `text.zig` | GPU text atlas and glyph rendering |
| `shaders.zig` | WGSL shader source |
| `3d.zig` | 3D mesh rendering with Scene3D |
| `procgen.zig` | Procedural geometry generation |

#### Feature modules (build-option gated)

| Module | Build flag | Role |
|--------|-----------|------|
| `qjs_runtime.zig` | `HAS_QUICKJS` | QuickJS VM + JS↔Zig bridge |
| `vterm.zig` | `HAS_TERMINAL` | libvterm FFI for terminal emulation |
| `classifier.zig` | `HAS_TERMINAL` | Semantic terminal token classification |
| `physics2d.zig` | `HAS_PHYSICS` | 2D rigid body physics |
| `physics3d.zig` | `HAS_PHYSICS3D` | Bullet3D physics (optional) |
| `canvas.zig` | `HAS_CANVAS` | Interactive node graph canvas |
| `effects.zig` | `HAS_EFFECTS` | useEffect lifecycle system |
| `transition.zig` | `HAS_TRANSITIONS` | CSS-like transitions |
| `videos.zig` | `HAS_VIDEO` | Video playback |
| `crypto.zig` | `HAS_CRYPTO` | Cryptographic primitives |
| `render_surfaces.zig` | `HAS_RENDER_SURFACES` | Off-screen render targets |

#### Build tiers

| Binary | Includes | Use case |
|--------|----------|----------|
| `bin/tsz` (lean) | Layout + GPU + SDL3 | Fast builds, simple apps |
| `bin/tsz-full` (full) | + QuickJS, terminal, physics, 3D, video, crypto | Full-featured apps |

### 4. Generated Code Bridge

The compiler's output (`generated_app.zig`) is the bridge between source and runtime:

```zig
// generated_app.zig (simplified)
const engine = @import("engine.zig");
const state = @import("state.zig");
const Node = @import("layout.zig").Node;

// Node tree (from JSX)
var root = Node{ .style = .{...}, .children = &_arr_0 };

// State init
fn _initState() void { state.setSlot(0, 42); }

// Per-frame tick
fn _appTick() void { _updateDynamicTexts(); _updateConditionals(); }

// Event handlers
fn _handler_press_0() void { state.setSlot(0, state.getSlot(0) + 1); }

// Entry point
pub fn main() !void { engine.run(&root, _appInit, _appTick); }
```

### 5. Cartridge System

Apps can be loaded dynamically as `.so` shared libraries:

```
┌─────────────────────────────────────────────┐
│               Dev Shell (tsz-dev)           │
│                                             │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐    │
│  │ Cart A   │ │ Cart B   │ │ Cart C   │    │
│  │ (.so)    │ │ (.so)    │ │ (.so)    │    │
│  └──────────┘ └──────────┘ └──────────┘    │
│                                             │
│  Shared: state slots, event loop, GPU       │
│  Independent: node trees, tick callbacks    │
└─────────────────────────────────────────────┘
```

**Cartridge ABI**: 6 C-exported functions (`app_get_root`, `app_get_init`, `app_get_tick`, `app_get_title`, `app_state_count`, `app_state_*`). Any language that produces a `.so` with these exports works.

See: [Dev Mode](systems/dev-mode.md)

### 6. Dev Tools (`tsz/carts/inspector/`, `.claude/hooks/`)

Two categories:

**Inspector app**: A tsz cart that connects to running apps via IPC for live inspection — element tree, performance, console, network, wireframe overlay.

**Claude Code hooks**: Shell scripts that fire on every tool call for multi-session coordination:
- `session-ping.sh` — session awareness + file collision prevention
- `edit-log.sh` — audit trail of all edits
- `auto-commit.sh` — every edit auto-committed to `edit-trail` branch

See: [Hook System](systems/hook-system.md)

## Data Flow

### Compile time
```
.tsz → lexer → tokens → collect phases → validate → JSX parse → emit → generated_app.zig
                                                                         ↓
_script.tsz → JS concatenation ──────────────────────────────→ JS_LOGIC string (embedded)
_cls.tsz → classifier collection ─────────────────────────────→ inline style expansion
_c.tsz → component collection ────────────────────────────────→ compile-time inlining
```

### Runtime (per frame)
```
SDL3 event poll → input.zig → events.zig → handler dispatch → state.setSlot()
                                                                    ↓
state dirty? → _appTick() → _updateDynamicTexts() → _updateConditionals()
                                                                    ↓
layout.zig (flex) → gpu paint (rects, text, 3d) → wgpu present
                                                                    ↓
QuickJS tick → setInterval callbacks → __setState() → state dirty
```

### Hot-reload (dev mode)
```
file change detected (500ms poll) → recompile .tsz → rebuild .so
                                                        ↓
dev shell detects .so mtime change → dlclose → dlopen → re-resolve ABI
                                                        ↓
call app_get_init() → new node tree ← state slots preserved
```

## Key Design Decisions

1. **No runtime component concept**: Components are compile-time macros. Zero overhead at runtime.

2. **Slot-based state**: Fixed-size array of typed slots, not a key-value store. Enables O(1) access and dirty-flag tracking.

3. **Zig all the way down**: Layout, rendering, state, events — all Zig. JS (QuickJS) is only for business logic that doesn't need to be fast.

4. **Build-option gating**: Features are `comptime` eliminated. Lean builds don't pay for unused features — no dead code, no unused dependencies.

5. **Self-extracting binaries**: Production builds are single-file executables with zero system dependencies.

6. **Two worlds**: App (`.tsz`) and module (`.mod.tsz`) file systems are isolated to prevent circular dependencies between application code and framework runtime.
