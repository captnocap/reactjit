# Intent Compiler Task Board

Last updated: 2026-04-10

## Purpose
Track implementation work for strict intent/chad syntax alignment, hatch behavior, and imperative/module restoration.

## Rules Of Authority
- `tsz/docs/INTENT_DICTIONARY.md` is the source of truth for intent/chad syntax.
- Compiler-internal dictionaries/docs are progress maps, not authority over intent syntax.
- Chad lane must hard-fail on syntax drift instead of silently accepting legacy forms.

## Script Ontology (Policy)
- `<script>`: backend-agnostic routing surface (compiler picks backend).
- `<lscript>`: explicit Lua-targeted intent syntax.
- `<zscript>`: explicit Zig-targeted intent syntax.
- `<jscript>`: explicit JavaScript-targeted intent syntax (to add).
- `<ascript>`: AppleScript-specific surface with separate ontology.
- All script hatches must keep intent syntax; no raw backend-language escape.

## Progress Legend
- `[ ]` not started
- `[-]` in progress
- `[x]` done
- `[!]` blocked

## Phase 0: Guardrails
- [x] Add strict chad syntax validator pass.
- [x] Hard-fail on `<For each=...>` in chad lane with migration hint to `<for ...>`.
- [x] Hard-fail on `<state>` in chad lane with migration hint to `<var> set_*`.
- [x] Hard-fail on `<timer>` in chad lane with migration hint to `name every N:`.
- [x] Hard-fail on uppercase intent tag variants in chad lane.
- [x] Add diagnostics for backend-language leakage inside hatched intent functions.
- [x] Hard-fail on `import`/`from` in intent/chad syntax files.

## Phase 1: Conformance Source Cleanup
- [x] Rewrite `tsz/carts/conformance/chad/apps/` to dictionary-correct syntax.
- [x] Normalize loops in apps to lowercase `<for ...>` forms.
- [x] Remove `<state>` usage in apps; migrate to `<var>` with `set_` declarations.
- [x] Remove `<timer>` usage in apps; migrate to `every` headers in `<functions>`.
- [!] Re-run chad conformance carts and record pass/fail deltas. (blocked by conformance tamper gate until human override)

## Phase 2: Chad Parser Architecture Simplification
- [ ] Refactor top-level chad artifact parsing to a unified block contract.
- [-] Reduce `page.js` special-case behavior for intent/chad lane.
- [ ] Consolidate shared intent function/body lowering for app/page/widget/component/lib.
- [x] Remove chad-lane legacy compatibility behavior not in dictionary.
- [-] Ensure parser behavior is driven by top-most block type + allowed child blocks.
- [x] In intent/chad mode, merge ambient `.tsz` sources from the entry root tree (entry file last), file-name agnostic.

## Phase 3: Hatch Semantics And Parity
- [ ] Keep `<script>` as router surface (not JS-only).
- [ ] Add `<jscript>` explicit backend hatch.
- [ ] Ensure `<script>/<lscript>/<zscript>/<jscript>` share identical intent syntax support.
- [ ] Ensure `every`, `cleanup`, `<during>`, `<if>`, `<for>`, `<while>`, `<switch>/<case>` parity across hatches.
- [ ] Enforce “no raw Lua/Zig/JS body mode” in hatched intent syntax.

## Phase 4: Routing Transparency
- [ ] Emit per-function route decisions and rationale in source-contract/debug output.
- [ ] Emit warnings for single-backend isolation risk (“purist wall” risk).
- [ ] Add tests for cross-backend composition chains with boundary marshaling.

## Phase 5: Imperative Mode Restoration
- [ ] Re-establish robust intent-imperative module codegen path (Zig mask model).
- [ ] Reduce silent fallback to legacy line-by-line transpilers.
- [ ] Convert unsupported intent module features from silent fallback to explicit diagnostics.
- [ ] Validate codegen against at least one framework subsystem target (layout first).
- [ ] Establish diffable generated outputs for modular engine changes.

## Phase 6: Framework Dogfooding Target Shape
- [ ] Stand up `framework/tsz/` dogfood structure for scoped subsystem sources.
- [ ] Stand up `framework/generated_zig/` output mapping.
- [ ] Wire modular build artifacts (`.so`) by subsystem.
- [ ] Validate incremental build/diff workflow for subsystem-level changes.

## Acceptance Checkpoints
- [ ] Checkpoint A: Strict validator merged; known drift patterns hard-fail.
- [ ] Checkpoint B: `chad/apps` rewritten and passing in strict form.
- [ ] Checkpoint C: Unified chad parser contract in place; reduced mini-ecosystem behavior.
- [ ] Checkpoint D: `<jscript>` implemented and hatch parity matrix green.
- [ ] Checkpoint E: Imperative mode baseline restored for layout path with stable diffs.

## Active Work Queue
- [x] Create persistent task board file for multi-turn tracking.
- [x] Start Phase 0 implementation.
- [x] Start Phase 1 chad app syntax rewrites.
- [-] Start Phase 2 parser architecture simplification.

## Notes
- Mixed lane remains operational bridge lane.
- Soup remains React-proxy lane.
- Chad lane remains strict explicit intent lane with dictionary authority.
- Phase 0 implementation lives in `tsz/compiler/smith/lanes/chad/strict_validator.js` and is wired in `tsz/compiler/smith/lanes/chad.js`.
- Phase 1 app rewrite removed `<state>` and legacy `<For each=...>` across `tsz/carts/conformance/chad/apps/`.
- Phase 2 in progress: chad lane now ignores legacy `<state>/<timer>` plumbing and shared `<var>` parsing canonicalizes `set_` declarations.
- Forge now enforces import bans for intent/chad syntax files and switches intent entries to ambient root-tree source merge mode.
