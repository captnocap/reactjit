# tsz/ — FROZEN (Smith-era stack)

This directory is **read-only reference**, same treatment as `archive/` and `love2d/`.

Active development has moved to the repo root:
- `framework/` — lifted from `tsz/framework/` (copy, not symlink)
- `qjs_app.zig` — the React-reconciler host (in-process QuickJS)
- `runtime/` + `renderer/` + `cart/` — `.tsx` carts + bundler

See the root `CLAUDE.md` for the active ship path.

## Why frozen, not deleted

`.tsz` + Smith was 50 days of work. The lesson from that: we didn't need a custom DSL — the reconciler-over-QuickJS shape from `love2d/` was already the answer. `qjs_app.zig` proved it (`qjs_d152` performs identically to Smith-compiled d152; see `benchmark_bridge_perf.md` in memory).

Everything in here — the d-suite, cockpit's Smith-compiled pages, InspectorTsz, wpt-flex tests, sweatshop carts — stays available as a reference for shape, screenshots, and intent. Regenerate in `.tsx` on demand rather than porting mechanically.

## Do not

- Rebuild `zig-out/bin/forge`, `zig-out/bin/smith`, or `zig-out/bin/tsz` from this tree.
- Run `./scripts/build`, `./zig-out/bin/forge build`, or any Smith-era pipeline against root-level `.tsx` carts.
- Treat `carts/conformance/` as a test suite for current work — those are Smith regression fixtures.
- Invoke the `flight-check-loop`, `chad-audit`, or `conformance` skills against root-level work.

## Reference material worth knowing exists

- `tsz/screenshots/Inspector.png` — shape of the inspector we want to regenerate in `.tsx`.
- `tsz/reference/lua/inspector.lua` — love2d's inspector, imported here for porting.
- `tsz/carts/cockpit/` — the cockpit app's Smith-era form.
- `tsz/framework/` — preserved here too, identical to the root copy at the time of lift.
- `tsz/docs/ARCHITECTURE.md` — Smith-era architecture notes, still useful context.
- `tsz/compiler/smith_DICTIONARY.md` — historical record of Smith's lane/surface vocabulary.
