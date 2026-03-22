# experiments/zigos/ — Active Stack

This is the active engine. When the user says "the compiler", "the runtime", "layout", "the inspector" — this is it.

## Structure

```
compiler/         — .tsz → Zig codegen (lexer, parser, 9-phase pipeline, emit)
framework/        — Engine core: layout, GPU, events, state, text, windows, canvas
  gpu/            — wgpu pipelines (rects, text, curves)
  net/            — Networking (HTTP, WebSocket, SOCKS5, Tor)
  engine.zig      — Main loop: SDL init, GPU, event loop, paint
  layout.zig      — Flex layout engine (pixel-perfect, ported from love2d/lua/layout.lua)
carts/            — Apps built with the framework (inspector, dashboard, constraint-graph, etc.)
scripts/          — sync-mod.sh (module variant sync), check-file-length.sh
```

## Build

From repo root:
```bash
zig build compiler           # Build the .tsz compiler
zig build app                # Lite build (codegen + layout + rendering)
zig build app-full           # Full build (+ networking, tor, curl, vterm)
```

## File Extensions

7 file kinds in two isolated worlds (app and module). Full taxonomy: `compiler/cli.zig:165-227`.

## Debug Tools

See memory file `reference_zigos_debug_toolkit.md`. Key ones:
- `ZIGOS_LOG=events,state ./app` — runtime logging by category
- `--strict` — warnings become build errors
- `--embed` — compile UI into `framework/devtools.zig` for engine integration

## File Length Limit (ENFORCED)

**Max 1600 lines per `.zig` or `.tsz` file.** This is enforced by `scripts/check-file-length.sh` and gated into every build target (`zig build app`, `zig build compiler`, etc.). If a file is over 1600 lines, the build fails. The fix is always to split the file — never to raise the limit.

**Do not change the limit. Do not add exceptions. Do not bypass the check.** If you are about to write code that would push a file over 1600 lines, split it first.

## See Also

- `MODULES.md` — Framework module architecture, logging, windows, breakpoints
- `MERGE_PLAN.md` (repo root) — Plan for consolidating tsz/ + tsz-gen/ + zigos/
