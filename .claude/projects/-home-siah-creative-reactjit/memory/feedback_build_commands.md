---
name: Only two build commands
description: Claude must ONLY use forge build and smith build — never touch build internals
type: feedback
---

There are exactly TWO build commands. Nothing else.

- `forge build` — rebuild the compiler (after editing smith/ JS files)
- `smith build <app.tsz>` — build a cart from .tsz to native binary

**Why:** A Claude session nuked the entire working build tree (link.lua, bin/rjit, scripts/build) by "improving" the build pipeline. This caused hours of wasted debugging — stale .a linking, broken colors, broken layout, broken packaging. The build script internals (zig build-obj, link.lua, packaging) run automatically inside smith build.

**How to apply:** Never run zig build cart-fast, zig build app, zig build core, luajit scripts/link.lua, or any manual build step. Never edit scripts/build or scripts/link.lua. If the build is broken, report it — don't try to fix the pipeline.
