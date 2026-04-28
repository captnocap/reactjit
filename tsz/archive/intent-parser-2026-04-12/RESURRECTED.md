# Intent Parser — Resurrected from Git History

**Source commit:** `39da7c596c3b3f47908aa829fc9d262598d1e961` (2026-04-12 20:23:31 -0700)
**Original path:** `tsz/compiler/smith/intent/`
**File count at peak:** 364 `.mod.fart` parser modules + helpers
**Resurrected on:** 2026-04-26

## What happened

These files lived in the Smith-era intent parser tree under `tsz/compiler/smith/intent/`. Two git hard-resets between 2026-04-14 and 2026-04-23 wiped them from the working tree. By snapshot `76d5442a5` (2026-04-23), the directory contained only two `plan-*` planning subdirs — the actual parser was gone from disk.

Recovered via `git archive 39da7c596 tsz/compiler/smith/intent/ | tar -x` from the local repo (the commit objects survived in `.git/objects` even though no ref pointed at them).

## What this is

The full Smith parser for the Intent DSL described in `tsz/docs/INTENT_DICTIONARY.md`. Each `.mod.fart` is itself a Smith module that, once compiled by the Smith binary, emits Zig + Lua source for parsing one slice of the Intent surface — attribute parsing, conditional blocks, for-loops, classifiers, handlers, glyphs, etc.

## Why we kept it

Reference for porting a runtime Intent parser into `runtime/intent/` (TypeScript, runs in V8). The chat-response use case needs a tiny subset of these modules — primarily:

- `parse_children_elements.mod.fart`
- `parse_handlers_press.mod.fart`
- `parse_attrs_basic.mod.fart`
- `parse_for_loop.mod.fart`
- `parse_conditional_blocks.mod.fart`
- `parse_inline_glyph.mod.fart`
- `parse_brace_*.mod.fart`
- `intent_strict_validator.mod.fart`

Plus the dictionary at `tsz/docs/INTENT_DICTIONARY.md` for what the surface should *look* like.

## Do not

- Do not try to compile this with `tsz/zig-out/bin/smith` — Smith may no longer build, and these modules reference dead infrastructure.
- Do not move these files into the active runtime tree as-is — they're Smith DSL, not TypeScript.
- Do not edit these files. They are an archive snapshot, frozen by intent.
