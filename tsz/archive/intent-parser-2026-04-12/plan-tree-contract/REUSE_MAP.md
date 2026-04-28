# Phase 5: Reuse Analysis

## Canonical Shapes

Reading the decomposition, the same semantic operations appear under different names across multiple units. Here are the canonical shapes that emerge.

---

### Shape 1: `TreeNode` — the universal node type

Every unit in the decomposition references "the node carries X." The canonical node shape:

```
<TreeNode>
  name is string
  type is string
  path is string
  parent is TreeNode or null
  children is array
  content is object
</TreeNode>
```

`content` is an open object. Each node type puts different things in it:
- App root: `stateSlots`, `scriptBlock`, `pages`, `pageSelector`
- Page node: `stateSlots`, `components`, `scriptFuncs`
- Component node: `props`, `stateSlots`, `handlers`
- `<for>` node: `oa`, `mapBackend`, `itemParam`, `indexParam`, `handlers`, `dynTexts`
- `<if>` node: `condExpr`, `luaCondExpr`
- Text node: `dynText`, `staticText`, `glyphs`
- Styled node: `dynColor`, `dynStyle`, `classifiers`

The content shape IS the routing key for emit atoms. No `kind` enum needed — the presence of fields determines what the node is.

**Currently inlined in:** `buildSourceContract` (copies to flat arrays), `_contractScopedBlocks` (reassembles from blocks), `_contractEntry` (searches for root), `buildMeta` (derives flags from arrays), every emit atom (reads from flat arrays by index).

**Extraction boundary:** One `TreeNode` type shared by all. Parse produces nodes. Contract IS nodes. Emit walks nodes. Resolution traverses nodes.

---

### Shape 2: `resolve` — single tree traversal

The decomposition found 8 search paths in `resolveIdentity` that all do the same thing: "find a name by looking in progressively wider scope." Four separate resolution files (`identity`, `resolve_state_access`, `field_access`, `const_oa`) each implement variants of this search.

Canonical shape:

```
resolve(node, name):
  <if node.content.has(name)>
    node.content.get(name)
    stop
  </if>
  <if node.parent>
    resolve(node.parent, name)
  </if>
```

That's it. Walk up. First match wins. The `kind` of the resolution is determined by what type of node contained the match: var node → slot, for node → map item, component node → prop.

**Currently inlined in:** `resolveIdentity` (8 paths), `resolveStateAccess` (slot search), `fieldAccess` (OA field search), `constOaLookup` (const OA search), `peekPropsAccess` (prop stack search), every brace/template parser that calls these.

**Extraction boundary:** One `resolve` function replaces all of them. The callers don't change their interface — they still get back a kind + expression. But internally, one tree walk replaces 4+ separate flat-list searches.

---

### Shape 3: `walkTree` — depth-first tree visitor

Multiple units need to "visit every node and do something." The decomposition found this pattern in:
- `_countNodeMisses` — already a tree walk (the one function doing it right)
- `buildMeta` — derives 16 boolean flags from "does any node have X?"
- `derivePreflightIntents` — checks "does the tree contain maps/state/scripts?"
- `buildPreflightScanState` — collects allDecls, handlerNameSet from all nodes
- Emit atoms — "for each node with matching content, emit code"

Canonical shape:

```
walkTree(node, visitor):
  visitor(node)
  <for node.children as child>
    walkTree(child, visitor)
  </for>
```

Or with a collector variant:

```
collectFromTree(node, predicate):
  result is array
  <if predicate(node)>
    result push node
  </if>
  <for node.children as child>
    childResults is collectFromTree(child, predicate)
    <for childResults as cr>
      result push cr
    </for>
  </for>
  result
```

**Currently inlined in:** `_countNodeMisses` (explicit), `derivePreflightIntents` (implicit — checks flat array lengths instead of walking), `buildMeta` (implicit — same), every emit atom's `_applies` check (implicit).

**Extraction boundary:** One `walkTree` + one `collectFromTree`. Emit atoms call `collectFromTree(root, nodeHasMyContent)` instead of checking flat array lengths.

---

### Shape 4: `emitForShape` — shape-dispatched emission

Every emit atom does: "check if my content exists, then emit code for it." Currently this is split across `_applies` (boolean check) and `_emit` (code generation). In the tree model, these merge.

Canonical shape:

```
emitForShape(tree, shapeName, emitFn):
  nodes is collectFromTree(tree, node.content.has(shapeName))
  <for nodes as node>
    emitFn(node)
  </for>
```

Example: a036 (conditional updates) becomes:
```
emitForShape(tree, 'condExpr', emitConditionalUpdate)
```

No `_applies` check. No flat array index. Collect matching nodes, emit for each.

**Currently inlined in:** All 56 emit atoms. Each has its own `_applies` + `_emit` pair.

**Extraction boundary:** `emitForShape` is the shared orchestrator. Each atom provides only `emitFn` — the actual code generation for one node. The collection, iteration, and applies-check are canonical.

---

### Shape 5: `attachToNode` — parse-time content attachment

During parse, ~30 files push data into flat arrays. In the tree model, they attach content to the current node instead. The pattern is always:

```
// Current (flat):
ctx.handlers.push(handler)

// Tree:
currentNode.content.set('handlers', currentNode.content.get('handlers').concat(handler))
```

Or with the `push` verb:
```
currentNode.content.handlers push handler
```

**Currently inlined in:** Every parse file that does `ctx.handlers.push()`, `ctx.conditionals.push()`, `ctx.maps.push()`, etc. (~30 files, ~472 `.concat()` calls from the readability audit).

**Extraction boundary:** Replace `ctx.flatArray.push(item)` with `currentNode.content.collection push item`. The parse files don't need to know about the global flat array — they attach to the node they're currently building.

---

## Overlap Matrix

| Canonical shape | Units that currently inline it | Files affected |
|----------------|-------------------------------|----------------|
| `TreeNode` | buildSourceContract, _contractScopedBlocks, _contractEntry, buildMeta, all emit atoms | ~70 |
| `resolve` | resolveIdentity, resolveStateAccess, fieldAccess, constOaLookup, peekPropsAccess | ~15 |
| `walkTree` / `collectFromTree` | _countNodeMisses, derivePreflightIntents, buildMeta, buildPreflightScanState, 56 emit atoms | ~65 |
| `emitForShape` | 56 emit atoms (_applies + _emit) | 56 |
| `attachToNode` | ~30 parse files pushing to flat arrays | ~30 |

---

## What Is Genuinely Reusable vs What Only Looks Similar

**Genuinely reusable (extract):**
- `TreeNode` — universal. Every file touches it.
- `resolve` — universal. One traversal function replaces 4+ resolution modules.
- `walkTree` / `collectFromTree` — universal. Tree visitor pattern used everywhere.

**Looks similar but stays local:**
- Individual emit functions (`emitConditionalUpdate`, `emitHandlerPtrInit`, `emitStateManifest`) — each produces different Zig/Lua output. The OUTPUT is unique per atom. Only the ORCHESTRATION is shared.
- Parse-time content construction — each parse file builds different content shapes (handlers vs conditionals vs maps). The PUSH is shared, the BUILD is local.
- Coherence checks — each check validates a different invariant. The WALK is shared, the PREDICATE is local.

---

## Migration Leverage

Implementing the 5 canonical shapes in order:

1. **`TreeNode`** (1 type) — enables everything else
2. **`attachToNode`** (replace `ctx.flat.push` with `node.content push`) — parse files migrate
3. **`resolve`** (1 function) — replaces 4 resolution modules
4. **`walkTree` / `collectFromTree`** (2 functions) — enables tree-based queries
5. **`emitForShape`** (1 orchestrator) — emit atoms migrate

5 canonical shapes. 5 implementations. ~105 files migrate to use them. The shapes are the shared infrastructure. Everything else is local.
