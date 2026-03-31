# tsz/ — Active Stack

## THE ONLY BUILD COMMAND

```bash
tsz-build carts/conformance/CART.tsz
```

That is it. If you are typing `zig build forge`, `./zig-out/bin/forge`, `cp generated_`, `zig build app`, or ANY combination of those manually — you are doing it wrong. Use `tsz-build`. It does all of that for you.

If `tsz-build` isn't in your PATH: `./scripts/build carts/conformance/CART.tsz`

---

This is the active engine. When the user says "the compiler", "the runtime", "layout", "the inspector" — this is it.

## Structure

```
compiler/
  smith_*.js        — Smith root JS compiler files (.tsz → .zig codegen)
  smith_collect/    — Collection pass
  smith_lanes/      — Entry lanes + surface tiering
  smith_parse/      — JSX/map/element parsing
  smith_preflight/  — Validation rules
  smith_emit/       — Emit helpers
  smith_DICTIONARY.md — Live map of the active Smith layout
  forge.zig         — Forge: Zig binary that hosts Smith via QuickJS
  smith_bridge.zig  — QuickJS bridge (init, eval, pass tokens, get result)
  lexer.zig         — Tokenizer (shared, stays in Zig for speed)
  cli.zig           — CLI interface (used by bin/tsz, will be replaced by forge CLI)
framework/          — Engine core: layout, GPU, events, state, text, windows, canvas
carts/              — Apps built with the framework
  conformance/      — Conformance test carts (d01-d104, verify against bin/tsz)
  smith-test/       — Smith-specific test apps
```

## Build Pipeline

The build has 3 stages. Understand this or you will waste everyone's time:

1. **Forge** (Zig binary) — runs Smith (the JS compiler)
2. **Smith** (JS) — compiles `.tsz` source → `generated_*.zig`
3. **Zig build** — compiles generated Zig → native binary

### Commands

```bash
# === THE ONE COMMAND YOU NEED ===
# From tsz/ directory:
./scripts/build carts/conformance/d01_nested_maps.tsz

# Or with the alias (if set up):
tsz-build carts/conformance/d01_nested_maps.tsz

# Debug build (unoptimized):
./scripts/build carts/conformance/d01_nested_maps.tsz --debug

# Output: zig-out/bin/d01_nested_maps
```

### Manual steps (if you need them individually)

```bash
# Step 1: Build forge (only needed after editing Smith JS files)
zig build forge

# Step 2: Run forge to compile a .tsz → .zig
./zig-out/bin/forge build carts/conformance/d01_nested_maps.tsz
# produces: generated_d01_nested_maps.zig

# Step 3: Copy into place and build binary
cp generated_d01_nested_maps.zig generated_app.zig
zig build app -Dapp-name=d01_nested_maps -Doptimize=ReleaseFast

# Output: zig-out/bin/d01_nested_maps
```

### IMPORTANT: Forge embeds JS at build time

When you edit Smith files in `compiler/` (`smith_*.js`, `smith_collect/`, `smith_lanes/`, `smith_parse/`, `smith_preflight/`, `smith_emit/`), you MUST rebuild forge (`zig build forge`) before those changes take effect. Forge embeds the JS bundle. If you skip this step, forge runs the old Smith code and your changes do nothing.

### IMPORTANT: Zig build caching

Zig aggressively caches. If the binary timestamp doesn't update after `zig build app`, the build used cache. Delete the old binary from `zig-out/bin/` and rebuild.

## Frozen Reference Binary

**`bin/tsz`** is the frozen reference compiler binary. SHA256: `fa6a74bc1ab0e1613cb55e7b33666a71141e3470bbc5b71a24b93860b3c169ab`. Backup at `bin/tsz.frozen`.

**DO NOT rebuild `bin/tsz`. DO NOT use `zig-out/bin/tsz` as reference.** The `zig-out/bin/tsz` binary was rebuilt by other sessions and produces DIFFERENT output. Always verify Smith against `bin/tsz`.

The old compiler source is archived under `../archive/frozen-compilers/` — do not edit frozen snapshots unless you are explicitly preserving history.

## Reference Implementation (Love2D)

**love2d/scripts/tslx_compile.mjs** (1565 lines) is a working reference compiler from the Love2D stack. It already solves every compiler problem — maps, nested maps, component inlining, prop resolution, conditionals inside maps, template literals.

When you hit a compiler bug in Smith, READ THE LOVE2D VERSION FIRST. Copy the approach. Do not invent from scratch.

- love2d compiler → Lua output (tables, closures, ipairs loops)
- Smith compiler → Zig output (static arrays, Node structs, comptime pools)
- The OUTPUT is different but the COMPILER LOGIC (how to walk JSX, track scope, resolve props) is the same.

## Rules

- **Do not add debug logging.** If you need to understand the output, read the generated .zig file.
- **Do not build comptime dispatch tables or academic Zig tricks.** Simple and dumb. If love2d does it in 5 lines, yours should be about 5 lines.
- **Do not trace scope chains.** If something is broken, check the love2d reference for how it handles the same case.
- **Do not declare "fundamental limitations."** We own the compiler, lexer, parser, runtime — everything. Nothing is impossible.

## File Extensions

7 file kinds in two isolated worlds (app and module). Full taxonomy: `compiler/cli.zig:165-227`.

## Debug Tools

- `ZIGOS_LOG=events,state ./app` — runtime logging by category
- `--strict` — warnings become build errors
- `--embed` — compile UI into `framework/devtools.zig` for engine integration

## File Length Limit (ENFORCED)

**Max 1600 lines per `.zig` or `.tsz` file.** Enforced by `scripts/check-file-length.sh`. If a file is over 1600 lines, the build fails. Split the file — never raise the limit.

## See Also

- `MODULES.md` — Framework module architecture, logging, windows, breakpoints
