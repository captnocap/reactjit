# Smith Refactor Checklist

Goal: break Smith into small, purpose-scoped units that are easy for humans and models to trace, while keeping the current compiler behavior stable until the new structure is ready to take over.

Current constraint:
- Forge still concatenates Smith JS files and global-evals them.
- Until bundle/module authoring lands, every extraction must preserve that load model.

## Ground Rules

- [x] Create a single checklist with dependency order.
- [x] Start from reusable primitives before parser/emit coordinators.
- [ ] Keep master files as composition only; move logic down into named helpers.
- [ ] Preserve current compile path while extracting pieces.
- [ ] Prefer semantic splits (`map/header`, `emit/map_pools`) over line-count splits.
- [ ] When a concept exists across phases, keep its name stable.

## Ongoing Sync

- [ ] Before each refactor slice, compare the live Smith files against the refactor lane for any newly added logic from parallel work.
- [ ] Carry forward new legacy Smith behavior into the refactor files before marking a seam complete.
- [ ] Re-run targeted sync scans on active legacy files (`index.js`, `parse.js`, `parse_map.js`, `attrs.js`, `preflight.js`, `emit.js`) as the refactor continues.

## Phase 0: Scaffolding

- [x] Add this checklist.
- [x] Add a first shared Smith support file for primitive helpers.
- [ ] Decide long-term authored layout (`smith/src/**`) versus current flat bundle inputs.
- [ ] Add a bundle step so Forge embeds one built Smith artifact instead of a manual concat list.

## Phase 1: Core Primitives

- [x] Shared low-level helpers: `leftFoldExpr`, `utf8ByteLen`, `zigEscape`, `ZIG_KEYWORDS`.
- [x] Shared cursor constructor: `mkCursor`.
- [x] Shared compiler context owner: `ctx`, `resetCtx`.
- [x] Slot/state helper home: `findSlot`, `isGetter`, `isSetter`, `slotGet`.
- [x] Shared brace/offset parse helpers: `skipBraces`, `offsetToLine`.
- [x] Shared press-handler capture helpers: forwarded refs, named handlers, inline closures.
- [x] Shared attr value readers: signed numbers, vectors, repeated field emit helpers.
- [ ] Shared parse utility home for byte/offset/tag helpers.

## Phase 2: Collection Pass

- [x] Extract component collection into its own unit.
- [x] Extract script block collection into its own unit.
- [x] Extract state/object-array collection into its own unit.
- [x] Extract classifier collection into its own unit.
- [x] Reduce `index.js` collection work to composition only.

## Phase 3: Parse Dispatch

- [x] Split `parseJSXElement` into dispatcher + helpers.
- [x] Extract fragment/script/finish flow from `parseJSXElement`.
- [x] Extract tag normalization and classifier/dot-tag rewriting from `parseJSXElement`.
- [x] Extract tag-based default node/style setup from `parseJSXElement`.
- [x] Extract component prop collection from `parseJSXElement`.
- [x] Extract component prop spread and brace-value helpers.
- [x] Extract component inlining flow from `parseJSXElement`.
- [x] Split `parseChildren` into child-type dispatchers.
- [x] Extract element and brace child handlers from `parseChildren`.
- [x] Move `buildNode` into its own file.
- [x] Extract plain element callback attribute parsing from `parseJSXElement`.
- [x] Extract basic element attribute parsing from `parseJSXElement`.
- [x] Extract generic text color attribute parsing from `parseJSXElement`.
- [x] Extract 3D/Physics spatial attribute parsing from `parseJSXElement`.
- [x] Extract canvas/graph attribute parsing from `parseJSXElement`.
- [x] Extract element attribute dispatch order from `parseJSXElement`.
- [x] Extract post-attr element finalization from `parseJSXElement`.
- [x] Split tag normalization from attribute parsing.
- [x] Split handler parsing from non-handler prop parsing.

## Phase 4: `.map()` and Brace Expressions

- [x] Create `map/header` responsibility: recognize `.map(...)` and parse params.
- [x] Create shared map metadata builder used by `.map()`, nested `.map()`, and `For`.
- [x] Create `map/context` responsibility: reserve map slot, swap array target, restore state.
- [x] Reduce legacy `parse_map.js` to a compatibility coordinator.
- [x] Create `map/finalize` responsibility: produce placeholder node and finalized map metadata.
- [x] Create `map/nested` responsibility: nested and inline map variants.
- [x] Keep OA inference separate from map lowering.
- [x] Move template literal parsing out of the map file.
- [x] Move conditional parsing out of the map file.
- [x] Move ternary parsing out of the map file.
- [x] Move `For` parsing out of the map file.

## Phase 5: Preflight

- [ ] Split lane/intents derivation out of `preflight`.
- [ ] Group handler rules in one rules file.
- [ ] Group map rules in one rules file.
- [ ] Group dynText/dynStyle rules in one rules file.
- [ ] Group classifier/tag leak rules in one rules file.
- [ ] Make `preflight.js` a rule runner only.

## Phase 6: Emit

- [ ] Extract preamble/import emission.
- [ ] Extract state manifest emission.
- [ ] Extract node-tree emission.
- [ ] Extract dynamic text buffer emission.
- [ ] Extract non-map handler emission.
- [ ] Extract effect render emission.
- [ ] Extract object-array emission.
- [ ] Extract map-pool emission.
- [ ] Extract update/entrypoint emission.
- [ ] Extract final cleanup/post-processing.
- [ ] Reduce `emit.js` to a top-level emit coordinator.

## Phase 7: Lane Compilers

- [ ] Separate app lane composition.
- [ ] Separate page lane composition.
- [ ] Separate module lane composition.
- [ ] Separate soup lane composition.
- [ ] Make lane-specific masters call shared collect/parse/preflight/emit helpers.

## Phase 8: Build Integration

- [ ] Replace manual Forge concat list with one generated Smith bundle.
- [ ] Keep flat load order documented until bundle step lands.
- [ ] Verify new authored structure does not require runtime import resolution in QuickJS.

## Immediate Next Targets

- [x] Extract slot/state helper ownership from `attrs.js`.
- [x] Start splitting `parse_map.js` by responsibility, beginning with map header/context/finalize seams.
- [x] After map seams exist, reduce `parse.js` to dispatcher-style composition.
