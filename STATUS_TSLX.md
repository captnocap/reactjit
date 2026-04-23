# tslx-compile port — status snapshot

## Where I am

Mid-refactor on `scripts/tslx_compile.mjs`. The compiler went through
two versions in this session:

### V1 (shipped in commit `0f5da30ee`)

Fully working end-to-end for `CodeGutter` + `Minimap`:

- `framework/primitives/<name>.tslx` — source of truth (indent-block
  DSL: `primitive`, `guard_field`, `row_type`, `fields`, `props`,
  `intrinsic_height`, `paint`).
- `scripts/tslx_compile.mjs` reads each `.tslx` and writes:
  - `framework/primitives/generated/<name>.zig` — paint function +
    row struct. Imported from `framework/engine.zig` via
    `code_gutter_gen = @import(...)` and called from `paintNodeVisuals`.
  - `runtime/primitives_gen/<Name>.tsx` — React wrapper (one-liner).
- `runtime/primitives.tsx` re-exports the generated wrappers.
- `scripts/ship` runs `node scripts/tslx_compile.mjs --all` before
  esbuild so a forgotten .tslx edit never gets shipped.

**Remaining hand-written in V1**: Node struct fields, row-type
`struct` definitions, the `parseXRows` functions in `qjs_app.zig`, the
`applyTypeDefaults` branches, the `applyProps` branches. The compiler
printed those as snippets and they were pasted in manually. This was
the thing the user said "you either did the thing or you didn't" about.

### V2 (in progress, **NOT working** — do not ship as-is)

Redesigned the compiler to auto-splice all of the hand-written bits
between marker comments. The markers are in place and the compiler
runs without error, but the splice output has **indentation bugs** —
the splice engine adds the marker's indent on top of emitter-side
indent, producing doubled indent (see `qjs_app.zig` current `PROPS`
region, which is nonsense).

Splice markers added (do not remove these):

- `framework/layout.zig`:
  - `// tslx:GEN:ROW_TYPES START/END` — row struct definitions
  - `// tslx:GEN:NODE_FIELDS START/END` — Node struct primitive fields
  - `// tslx:GEN:INTRINSIC_HEIGHT START/END` — inside
    `estimateIntrinsicHeight`
  - `// tslx:GEN:INTRINSIC_HEIGHT_FALLBACK START/END` — inside
    `layoutNode` `h == null` cascade
- `qjs_app.zig`:
  - `// tslx:GEN:PARSERS START/END` — parseXRows functions
  - `// tslx:GEN:TYPE_DEFAULTS START/END` — inside `applyTypeDefaults`
  - `// tslx:GEN:PROPS START/END` — inside `applyProps`

The V2 compiler emits ALL primitive content into those regions. It
works if emitters output at indent 0 and splice engine adds marker
indent, but **the emitters I edited still have absolute indent baked
in for some sections**, so the current state is broken.

## What's left to do (V2 completion)

1. Fix the emitter indentation. Pick one discipline:
   - **Option A** (what I started): emitters emit at indent-0, splice
     engine prefixes marker indent on every non-empty line. Each
     emitter's indent string was partially stripped. Finish by
     auditing each emitter + the `splice` function together.
   - **Option B**: emitters emit at absolute indent matching the
     target marker's nesting level. Splice engine writes content
     verbatim. Simpler to reason about but requires knowing each
     marker's indent at the emitter level.

2. Rerun `node scripts/tslx_compile.mjs --all` and diff the Zig files
   to confirm the splice regions match what was hand-written in V1
   (before my splice markers replaced them). The paint functions are
   already generated and unchanged from V1 — they should keep working.

3. `zig build app` to confirm Zig still compiles, then
   `./scripts/ship sweatshop` and run the binary to confirm gutter
   and minimap still paint correctly.

4. Delete the now-redundant `STATUS_TSLX.md` (this file) once V2
   lands.

## Build state when I stopped

- `framework/layout.zig` has marker regions; the `INTRINSIC_HEIGHT`,
  `INTRINSIC_HEIGHT_FALLBACK`, `NODE_FIELDS`, `ROW_TYPES` regions
  contain V1-era hand-written content that the V1 compiler ran once
  and correctly filled in. After my emitter indent changes the next
  compile run will OVERWRITE those regions with (incorrectly-
  indented) content and the build will break.
- `qjs_app.zig` splice regions: `TYPE_DEFAULTS` and `PARSERS` are OK
  from V1. `PROPS` is already wrong (doubled indent).
- Zig build: would likely succeed for `code_gutter_gen.paintCodeGutter`
  (generated .zig file is fine), fail for `qjs_app.zig` because of the
  malformed PROPS region.

## How to resume

```bash
# 1. See what the broken splice produced:
grep -n "tslx:GEN:PROPS" qjs_app.zig -A 40

# 2. Pick indent discipline (see "Option A" / "Option B" above).
#    Option A is closer to the current code — finish stripping the
#    leading indent from every emit* function in tslx_compile.mjs,
#    check splice() adds indent consistently.

# 3. Rerun:
node scripts/tslx_compile.mjs --all

# 4. Verify compile:
zig build app -Dapp-name=sweatshop -Doptimize=ReleaseFast

# 5. Ship + run:
./scripts/ship sweatshop
./zig-out/bin/sweatshop
```

## Files touched this session

- `scripts/tslx_compile.mjs` — NEW. The compiler. V2 mid-edit.
- `scripts/ship` — modified to run tslx compile before bundle.
- `framework/primitives/code_gutter.tslx` — NEW. Source for CodeGutter.
- `framework/primitives/minimap.tslx` — NEW. Source for Minimap.
- `framework/primitives/generated/code_gutter.zig` — generated.
- `framework/primitives/generated/minimap.zig` — generated.
- `runtime/primitives_gen/CodeGutter.tsx` — generated.
- `runtime/primitives_gen/Minimap.tsx` — generated.
- `runtime/primitives.tsx` — re-exports from generated wrappers.
- `framework/engine.zig` — `@import`s the generated paint modules;
  removed the hand-written `paintCodeGutter` / `paintMinimap`.
- `framework/layout.zig` — splice markers added.
- `qjs_app.zig` — splice markers added.
- `cart/sweatshop/components/editor.tsx` — uses `<CodeGutter>` +
  `<Minimap>` instead of `.map() → JSX`.
- Several other `cart/sweatshop/*` files — part of a sibling
  session's refactor that accumulated in the working tree.

## Context for perf fix thread

User's click-to-paint latency on "Open TSX Cart" started at ~3.3s
(2.2 MB host_flush, 4624 visible nodes). After virtualizing gutter +
minimap and coalescing drag hit-tests, it dropped to ~2.1s. Adding
`CodeGutter` + `Minimap` native primitives cut another ~400 reconciler
ops. Zig side itself is 7ms; the remaining cost is React's render-
and-reconcile phase walking the tree in QuickJS at ~1.2 ms/op.

Finishing V2 of the compiler doesn't change the runtime cost — it's
a DX win (one `.tslx` file per primitive instead of touching four
files). The runtime savings already shipped in `0f5da30ee`.
