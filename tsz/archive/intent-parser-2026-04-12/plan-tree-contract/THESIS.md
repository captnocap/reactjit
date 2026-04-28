# Phase 2: Thesis — Source Contract Tree Migration

## Current Shape

The source contract is a **flat bag of indexed arrays**. During parse, ~30 files accumulate data into 12 flat arrays on `ctx` (stateSlots, handlers, maps, conditionals, objectArrays, dynTexts, dynColors, dynStyles, scriptFuncs, variantBindings, components, pages). `buildSourceContract` copies these arrays into a contract object. 56 emit atoms consume the contract by walking arrays and cross-referencing between them via integer indices (condIdx, dynBufId, mapIdx, oaIdx, variantBindingId).

The parser builds a tree (block headers are the namespace). `buildSourceContract` flattens the tree into arrays. The emitters try to reconstruct tree relationships from indices. The address is destroyed during contract building and reconstructed by fragile index math during emission.

## Target Shape

The source contract IS the tree. Each tree node carries:
- **address** — the block header path (e.g., `my.home.pet`)
- **content** — the vars, handlers, conditionals, dynamic texts, etc. that belong to THIS node
- **children** — nested tree nodes

The tree is built during parse (it already is — `intentBlocks` exists). The contract preserves the tree without flattening. Emit atoms walk the tree and dispatch by content shape at each node. Identity resolution is a single `resolve(node, name)` that walks up the tree.

No integer indices. No cross-referencing between flat arrays. The tree path IS the address. Content shape IS the routing key.

## The Thesis

**The change is: replace the flat-array source contract with the parsed block tree, route emit atoms by content shape instead of array index, and resolve names by tree traversal instead of flat-array lookup.**

## Done Standard

1. `buildSourceContract` produces a tree, not a bag of arrays
2. Zero uses of `condIdx`, `dynBufId`, `mapIdx`, `oaIdx`, `variantBindingId` as integer cross-references — all addressing is by tree path
3. All 56 emit atoms produce **byte-identical output** to their current output for the full conformance suite
4. `resolve(node, name)` replaces `resolveIdentity`, `resolveStateAccess`, `fieldAccess`, and `constOaLookup` — one resolution function, tree traversal
5. `contract_schema` validates tree structure and path coherence instead of array-length and index-range checks
6. `forge build --contract` JSON output preserves the tree shape (v3 format)
7. All conformance tests pass: `./scripts/conformance-report` shows no regressions

## What Does NOT Change

- **The parser** — parse-time token walking, JSX element parsing, attribute resolution, handler collection, conditional detection. These still work the same way. They just attach results to tree nodes instead of pushing to flat arrays.
- **The emit atom interface** — `_applies(ctx, meta)` and `_emit(ctx, meta)` signatures stay. What changes is how they access data (tree walk vs array index).
- **The generated output** — Zig and Lua output must be byte-identical. This is a structural refactor, not a behavior change.
- **The Zig build pipeline** — forge.zig, smith_bridge.zig, the lexer, the CLI. Untouched.
- **The framework** — layout.zig, state.zig, gpu, events. Untouched.
- **Conformance tests** — the tests themselves don't change. They're the verification surface.

## The Postal Model

- **Sender** (author) writes valid addresses via block structure
- **Postal service** (compiler) validates addresses during preflight, delivers content by shape
- **Receiver** (emitter) accepts content whose shape matches its pattern — doesn't need to know the sender's address
- **Address** = tree path (structural, stable). NOT array index (positional, fragile).
- **Routing key** = content shape (is this a `<for>`? a handler? a conditional?). NOT "is this at index 7 in the handlers array?"
