# Merge Plan: tsz + tsz-gen + experiments/zigos → unified stack

**Status:** WAITING — do not execute until inspector work is complete
**Written:** 2026-03-18
**Context:** Three stacks exist on main that need to become one. The inspector and other active work must finish first.

## The Three Stacks

| Directory | Era | What it is | Verdict |
|-----------|-----|-----------|---------|
| `tsz/` | v1 | Hand-written `.zig` runtime, monolithic compiler, no QuickJS | **ARCHIVE** |
| `tsz-gen/` | v2 | `.mod.tsz → .gen.zig` pipeline, 90 modules, storybook, examples | **CHERRY-PICK then ARCHIVE** |
| `experiments/zigos/` | v3 | Active engine — QuickJS bridge, multi-phase compiler, carts, inspector | **PROMOTE to top-level** |

## Phase 1: Promote zigos

Move `experiments/zigos/` to top-level. This is the engine — it has the best compiler, the inspector, QuickJS bridge, and is where all active development happens.

**Steps:**
1. Ensure all active Claude sessions are done and work is committed
2. Move `experiments/zigos/` → `zigos/` (or whatever top-level name we choose)
3. Update `build.zig` at repo root to point to new location
4. Update CLAUDE.md references
5. Commit

## Phase 2: Full math port (DONE SEPARATELY — needed now for inspector)

Port `love2d/lua/math_utils.lua` (1269 lines, 10 modules) to `experiments/zigos/framework/math.zig`. The tsz-gen version only ported 7/10 modules and skipped:
- **bezier** — curve evaluation, splitting, smoothing (needed for SVG path work)
- **noise** — Perlin noise 2D/3D, noise fields
- **fft** — FFT/IFFT
- **geo advanced** — distancePointToSegment, distancePointToRect, circleContainsPoint, circleIntersectsRect, lineIntersection
- **interp advanced** — damp, step, pingPong, moveTowards, smootherstep, wrap

## Phase 3: Cherry-pick from tsz-gen

### 3a: Compiler features (tsz-gen → zigos compiler)

Zigos compiler already has `.mod.tsz → .gen.zig` (JSX module mode). What it's missing for full imperative module compilation:

| tsz-gen file | Lines | What it does | Priority |
|-------------|-------|-------------|----------|
| `modulegen.zig` | 1063 | Full imperative `.mod.tsz → .gen.zig` pipeline | HIGH |
| `typegen.zig` | 980 | `interface → struct`, `enum → enum`, `union → tagged union` | HIGH |
| `stmtgen.zig` | 1176 | Imperative codegen (var, if/else, for, while, switch) | HIGH |
| `exprgen.zig` | 2131 | Type-tracked expression compilation with coercion | HIGH |

These 4 files (5,350 lines) enable compiling the heavy `.mod.tsz` modules (layout, gpu, state, events, text — entire Zig subsystems written in TS syntax). The current zigos module mode only handles JSX-shaped components.

**Note:** The tsz-gen monolith `codegen.zig` (8191 lines) is superseded by zigos's multi-phase architecture. Only the 4 helper files above need porting.

### 3b: Runtime modules worth porting

**From tsz-gen `.mod.tsz` sources (tsz-gen/runtime/tsz/):**

HIGH priority (core functionality missing from zigos):
- Networking: `http.mod.tsz`, `httpserver.mod.tsz`, `http_client.mod.tsz`, `manager.mod.tsz`, `wsserver.mod.tsz`, `socks5.mod.tsz`, `tor.mod.tsz`, `ring_buffer.mod.tsz`
- Testing: `testharness.mod.tsz`, `testdriver.mod.tsz`, `testassert.mod.tsz`, `leaktest.mod.tsz`
- System: `watchdog.mod.tsz`, `process_registry.mod.tsz`, `pty.mod.tsz`, `sysmon.mod.tsz`
- Dev tooling: `console.mod.tsz`, `event_trail.mod.tsz`, `debug_log.mod.tsz`, `search.mod.tsz`

MEDIUM priority (useful features):
- Security: `permit.mod.tsz`, `permit_audit.mod.tsz`, `privacy.mod.tsz`
- Multimedia: `image.mod.tsz`, `image_cache.mod.tsz`
- Text: `syntax.mod.tsz`, `codeblock.mod.tsz`
- UI: `panels.mod.tsz`, `overlay.mod.tsz`, `zindex.mod.tsz`, `classifier.mod.tsz`
- Data: `crypto.mod.tsz`, `hotstate.mod.tsz`, `docstore.mod.tsz`

LOW priority (domain-specific):
- `finance.mod.tsz`, `geo.mod.tsz`, `gpio.mod.tsz`, `latex_parser.mod.tsz`, `latex_layout.mod.tsz`
- `wireguard.mod.tsz`, `session_player.mod.tsz`, `cart_reader.mod.tsz`

SKIP (deprecated):
- `audit.mod.tsz`, `quarantine.mod.tsz`, `image_select.mod.tsz`, `miner_signatures.mod.tsz`, `indigo.mod.tsz`

### 3c: Storybook

`tsz-gen/examples/storybook/` has a full storybook with 11 stories (Box, Text, Input, Layout, Animation, Crypto, Form, Router, ScrollView, Style, DataDashboard) + shared styles (`styles.cls.tsz`). Use as starting point for zigos storybook.

### 3d: Example apps

`tsz-gen/examples/` has 85+ `.app.tsz` test apps. Cherry-pick useful ones as compiler test cases. Many are specific feature tests (conditional, map, effect, component, filter, fragment, etc.) that validate compiler correctness.

## Phase 4: Port Lua cop-outs

These tsz-gen compiled modules are stubs or partial ports of their Lua originals. When porting to zigos, use the Lua source as reference, not the tsz-gen output:

| Module | tsz-gen status | Lua source (love2d/lua/) | Lines | What's missing |
|--------|---------------|-------------------------|-------|---------------|
| **compositor** | STUB (227 lines) | painter.lua | 2186 | Gradients, shadows, rounded rects, stencil clipping, transforms, video, 60+ module integrations |
| **events** | STUB (102 lines) | events.lua | 786 | Event bubbling, drag state, scroll routing, hover tracking |
| **syntax** | PARTIAL (709 lines) | syntax.lua | 2091 | Tokenizer functions are empty stubs — palette defined, no parsing logic |
| **mpv** | STUB (107 lines) | videos.lua | 1150 | Opens external window instead of embedding. Full rewrite needed with wgpu texture upload |
| **text** | PARTIAL (798 lines) | measure + text rendering | ~13K | Measurement stubs only, no wrapping/caching |
| **overlay** | PARTIAL (349 lines) | overlay.lua | 385 | Type definitions only, no SDL2/X11 integration |

## Phase 5: Archive

1. Move `tsz/` → `legacy/tsz/` (or delete — it's fully superseded)
2. Move `tsz-gen/` → `legacy/tsz-gen/` (keep as reference for `.mod.tsz` sources and compiler test cases)
3. Clean up the tsz-old worktree: `git worktree remove /tmp/tsz-old`
4. Delete the `cartridge-os-v0.1.0` branch if no longer needed

## Phase 6: Update documentation

1. Update root `CLAUDE.md` to reflect single stack
2. Update memory files (MEMORY.md and related)
3. Write `zigos/CLAUDE.md` (or update existing)

## Video integration (future, after merge)

mpv.zig needs a full rewrite for embedded video. Two viable approaches:
- **Software renderer** (`MPV_RENDER_API_TYPE_SW`): mpv → CPU buffer → `wgpuQueueWriteTexture`. Simple, no GL interop. Works up to ~1080p.
- **GL interop** (recommended): mpv → GL FBO → wgpu texture import via shared handle. Zero-copy, works at any resolution including 4K. SDL2 manages a dedicated GL context for mpv, separate from wgpu.

Reference implementation: `love2d/lua/videos.lua` — same SDL2 window, same mpv library, same render API. The GL state isolation nightmare from Love2D (17 variables) is actually simpler because mpv gets its own GL context, not sharing with the main renderer.

## Inspector cleanup (do during merge, not before)

The inspector cart (`carts/inspector/`) had stale `.cmod.tsz` copies that were deleted (2026-03-18). When the inspector is done and ready to become a module:
1. Rename `.c.tsz` → `.cmod.tsz` for all inspector components
2. Rename `Inspector.tsz` → `Inspector.mod.tsz`
3. Compile via module pipeline

## Notes

- The tsz-gen `.mod.tsz → .gen.zig` compiler has bugs (e.g., `/=` operators get mangled in `m4lookAt`). Generated `.zig` should be verified, not blindly trusted.
- The compiled `.zig` in `tsz-gen/runtime/compiled/` is the SAME quality as `tsz/runtime/framework/` — because the `.mod.tsz` sources were written as stubs. The compiler faithfully compiled incomplete code into incomplete code.
- When porting anything to zigos, always reference the Lua source in `love2d/lua/`, never trust the tsz/tsz-gen Zig as "complete."
