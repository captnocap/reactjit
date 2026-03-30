# Node Pool Migration Plan

## ENFORCED — READ BEFORE TOUCHING ANYTHING

This plan converts the codegen model from static pre-allocated Node arrays to a dynamic arena-backed NodePool. This is the single architectural change that fixes:
- 22,000+ phantom nodes visible in the Inspector (should be ~200-800)
- Stack overflow requiring 64MB bump
- 300MB+ build artifacts from over-allocated map pools
- Inspector being useless because you can't find real nodes in the noise

**The Inspector build (`./scripts/build carts/inspector/Inspector.tsz`) is the gate. The plan is done when the Inspector compiles, runs, and shows only real nodes.**

---

## HARD RULES — VIOLATIONS MEAN YOU STOP AND REPORT

1. **DO NOT modify any .tsz file in carts/inspector/.** These files are hash-locked. If the compiler can't handle them, fix the compiler. Run `bash scripts/conformance_verify.sh verify-all` before and after every change.
2. **DO NOT modify layout.zig or engine_paint.zig.** The layout and paint systems take `*Node` and read `.children`. They don't care where nodes come from. If you think you need to change them, you're wrong — re-read this plan.
3. **DO NOT bump stack sizes, pool sizes, or array limits.** If you hit a size limit, the fix is dynamic allocation, not a bigger number.
4. **DO NOT declare limitations.** You own the compiler, the framework, the runtime. Nothing is impossible. If something doesn't work, fix it.
5. **DO NOT skip verification steps.** Each phase has a verification command. Run it. If it fails, fix it before moving on.
6. **DO NOT rewrite conformance tests.** They are hash-locked. `bash scripts/conformance_verify.sh verify-all` must pass at all times.

---

## Phase 0: Baseline (do this FIRST)

Establish what works right now before changing anything.

```bash
cd /home/siah/creative/reactjit/tsz

# Record which conformance tests currently pass
bash scripts/conformance_test.sh 2>&1 | tee /tmp/baseline_conformance.txt

# Record Inspector status
./scripts/build carts/inspector/Inspector.tsz 2>&1 | tee /tmp/baseline_inspector.txt

# Verify all test hashes are clean
bash scripts/conformance_verify.sh verify-all
```

Save these outputs. They are your regression baseline. After EVERY change, re-run and diff against baseline. If a test that passed before now fails, you introduced a regression. Fix it before continuing.

---

## Phase 1: Add NodePool to the framework

**Files to create/modify:** `framework/api.zig` only.

Add a `NodePool` type. It wraps an arena allocator and provides:
- `init(backing_allocator) -> NodePool`
- `add(node: Node) -> *Node` — append a node, return pointer
- `addSlice(nodes: []const Node) -> []Node` — append N nodes, return slice
- `allocChildren(count: usize) -> []Node` — allocate a children slice
- `reset()` — free everything, start fresh (one instruction)
- `count() -> usize` — how many nodes are live

Implementation guidance:
- Use `std.heap.ArenaAllocator` over `std.heap.page_allocator`
- Nodes are contiguous in the arena — cache-friendly, like static arrays
- `reset()` is the equivalent of "rebuild" — called when state changes trigger a map rebuild
- The pool REPLACES static `[N]Node` arrays, not supplements them

**Verification:**
```bash
cd /home/siah/creative/reactjit/tsz
zig build core  # Framework must still compile
```

**What NOT to do:**
- Don't change the Node struct itself (diet is a separate initiative)
- Don't touch layout.zig
- Don't touch engine_paint.zig
- Don't add the pool to the cart ABI yet — that's Phase 2

---

## Phase 2: Wire the pool into the cart ABI

**Files to modify:** `framework/api.zig` (ABI exports), `framework/engine.zig` (pool lifecycle).

The cart ABI currently has 6 exports:
```
app_get_root, app_get_init, app_get_tick, app_get_title, app_state_count, app_state_*
```

Add a 7th: `app_get_pool` which returns a `*NodePool`. Or, simpler: pass the pool as a parameter to `app_get_init` so the generated code can use it during initialization.

The engine creates the pool, passes it to the cart, and calls `pool.reset()` before each rebuild cycle.

**Verification:**
```bash
cd /home/siah/creative/reactjit/tsz
zig build core          # Framework compiles
zig build app-lib       # Cart .so target compiles (even if no cart uses pool yet)
```

**Key constraint:** Existing generated code (without pool usage) must still compile and link. The pool is opt-in at this stage. Old carts that use static arrays still work.

---

## Phase 3: Migrate static tree emission in Smith

**Files to modify:** `compiler/smith/parse.js`, `compiler/smith/parse_map.js`, `compiler/smith/soup_smith.js`

Currently these files emit:
```js
ctx.arrayDecls.push(`var ${arrName} = [_]Node{ ${childExprs} };`);
```

Change to emit pool-based allocation:
```js
ctx.arrayDecls.push(`const ${arrName} = pool.addSlice(&.{ ${childExprs} });`);
```

Children wiring changes from:
```zig
.children = &_arr_0    // pointer to static array
```
To:
```zig
.children = _arr_0     // slice from pool (already a []Node)
```

This is ~5 sites across 3 files. Small change, high impact.

**Verification:**
```bash
cd /home/siah/creative/reactjit/tsz

# Rebuild forge (Smith JS is embedded)
zig build forge

# Run baseline conformance tests — compare against Phase 0 output
bash scripts/conformance_test.sh 2>&1 | tee /tmp/phase3_conformance.txt
diff /tmp/baseline_conformance.txt /tmp/phase3_conformance.txt

# MUST have same or more passes. Zero regressions allowed.
```

---

## Phase 4: Migrate map pool emission in Smith (THE BIG ONE)

**Files to modify:** `compiler/smith/emit.js` — primarily lines 469-1325.

This is the core change. The current code emits:
```zig
var _map_pool_0: [MAX_MAP_0]Node = undefined;
var _map_count_0: usize = 0;
var _map_inner_0: [MAX_MAP_0][3]Node = undefined;
var _map_text_bufs_0_0: [MAX_MAP_0][256]u8 = undefined;
var _map_texts_0_0: [MAX_MAP_0][]const u8 = undefined;
```

This becomes:
```zig
// No pre-allocation. Nodes are added to the pool during rebuild.
// Text buffers can stay as fixed arrays — they're small and bounded.
```

The rebuild loop changes from:
```zig
_map_pool_0[_i] = Node{ .text = ..., .children = &_map_inner_0[_i] };
```
To:
```zig
const _map_inner_0_i = pool.addSlice(&.{ child0, child1, child2 });
pool.add(.{ .text = ..., .children = _map_inner_0_i });
```

### Sub-steps within Phase 4:

**4a: Simple maps (no nesting, no inner maps)**
Start with maps that have a single pool node per item, no nested maps, no component inlining. These are the simplest cases (like d01-d05).

Verify: `./scripts/build carts/conformance/d01_nested_maps.tsz` through d05.

**4b: Maps with inner children arrays**
Maps where each pool node has children (the `_map_inner_N` arrays). Change children from pre-allocated 2D arrays to per-iteration pool.addSlice() calls.

Verify: d06-d13 conformance tests.

**4c: Nested maps (map inside map)**
The `_map_pool_N[_i][_jj]` 2D patterns. These become pool.add() calls in the inner loop.

Verify: d01 (nested maps), d109 (map in ternary in map).

**4d: Maps with component inlining**
Maps that inline components — the `im` (inline map) code paths. These are the most complex because component inlining interacts with map scope.

Verify: d08, d11, d108, d112 conformance tests.

**4e: Text buffers and Lua pointer buffers**
These can STAY as fixed-size arrays for now. They're `[256]u8` per item — small, bounded, and not Node arrays. Converting them to pool allocation is optional and lower priority. The 22k phantom node problem is about Node arrays, not text buffers.

**After ALL sub-steps, full regression:**
```bash
cd /home/siah/creative/reactjit/tsz
zig build forge
bash scripts/conformance_test.sh 2>&1 | tee /tmp/phase4_conformance.txt
diff /tmp/baseline_conformance.txt /tmp/phase4_conformance.txt
# Zero regressions. Same or more passes.
```

---

## Phase 5: Inspector builds

This is the gate. Everything before this was preparation.

```bash
cd /home/siah/creative/reactjit/tsz
./scripts/build carts/inspector/Inspector.tsz
```

If it fails:
1. Read the error
2. Fix the COMPILER (smith/*.js), NOT the Inspector
3. Inspector .tsz files are hash-locked — you cannot modify them
4. Re-run the build
5. Repeat until it succeeds

If it succeeds:
1. Run the binary
2. Count how many nodes the Inspector reports
3. If it's under 1000 for a normal view, the migration worked
4. If it's still 22k, the old static arrays are still being emitted somewhere — find and convert them

**Verification:**
```bash
# Inspector builds
./scripts/build carts/inspector/Inspector.tsz

# Full conformance still passes
bash scripts/conformance_test.sh

# All hashes still clean
bash scripts/conformance_verify.sh verify-all
```

---

## Phase 6: Lock it down

After the migration is verified:

1. Add comptime size guard:
```zig
comptime {
    // NodePool.add() returns *Node. If this fires, someone went back to static arrays.
    // The presence of this guard means: nodes come from the pool, not from var declarations.
    if (@sizeOf(@TypeOf(app_nodes)) != 0)
        @compileError("Static node arrays detected. Use NodePool.");
}
```

2. Hash-lock `emit.js` and `api.zig` so Claude can't revert to static allocation:
```bash
bash scripts/conformance_verify.sh lock compiler/smith/emit.js
bash scripts/conformance_verify.sh lock framework/api.zig
```

3. Add a build-time check that counts `[_]Node` declarations in generated output. If count > 0 for a pool-migrated cart, the build fails.

---

## What NOT to do during this migration

- **Node struct diet** — separate initiative. Do it AFTER pool migration. Both changes at once will make debugging impossible.
- **Style hot/cold split** — same. After pool migration.
- **Tracy integration** — nice to have, not needed for this.
- **SoA conversion** — not needed. Pool gives contiguous AoS which is already good.
- **New features** — no new compiler features until the pool migration is done and the Inspector builds.

---

## Reference: Love2D equivalent

In Love2D, this "migration" never needed to happen because Lua's default behavior IS dynamic allocation:

```lua
local nodes = {}
table.insert(nodes, { text = "hello", children = {} })  -- exists because created
-- Inspector sees 1 node. Because there IS 1 node.
```

The pool migration makes Zig behave the same way. Nodes exist because they were created, not because they were pre-allocated. The Inspector shows what exists. The stack doesn't overflow. Build sizes are proportional to app complexity, not array size constants.

---

## Time estimate

Don't estimate time. Just do the phases in order. Each phase has clear verification. Move forward when verification passes, stop when it fails.
