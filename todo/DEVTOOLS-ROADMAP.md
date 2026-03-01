# DevTools Roadmap

Every visualization operates on the same underlying tree/graph data. Same data, different projections. Each view can be popped out into its own OS window via `<Window>` (spawns a child Love2D process over TCP). A user could have all of these open on a second monitor simultaneously.

**Architecture:** Each visualization is a React component or Lua drawing pass that consumes data from the existing tree (`Tree.getTree()`, `Tree.getNodes()`), layout engine (`node.computed`), RPCs, and perf counters. Popping out = wrapping in `<Window>`. Selection, hover, and freeze state are shared across all views.

---

## Phase 1: Inspector Tree Polish

**Status:** Not started
**Priority:** High — foundation every other view builds on
**Effort:** Small

The current inspector tree mashes caret, node type, identity, and metadata into one text stream. Split it into proper columns.

### Row layout

```
[caret] [node type badge] [identity] ............. [jsx preview]
```

- **Caret** — `▸` collapsed, `▾` expanded, `·` leaf. Owns expand/collapse state only.
- **Node type** — `View`, `Text`, `Image`. Dim badge. Lua-side identity.
- **Identity** — `Box`, `Slider`, `Header`. Primary brightness. This is `node.debugName`.
- **Metadata** — `w=2`, `id=114`, `grow=1`. Tiny dim tags.
- **JSX preview** — Right-aligned, truncated with ellipsis, dimmer monospace.

### Typography hierarchy

| Tier | Elements | Treatment |
|------|----------|-----------|
| Dim | Caret, indent guides, JSX preview | Low opacity, thin |
| Normal | Identity name (`debugName`) | Full brightness |
| Muted | Node type badge, metadata tags | Mid opacity, smaller |

### Other details

- **Indent guides** — Thin low-contrast vertical rails. Only draw for levels that continue. +2px row height.
- **Selection** — Slightly brighter background + 2px left accent bar. Non-selected rows recede.
- **Leaves** — No caret (`·` or blank). Same columns, preserved alignment.

### Implementation

- **File:** `lua/inspector.lua` — `drawTreePanel()` and `drawTreeRow()` functions
- **Data available:** `node.type`, `node.debugName`, `node.id`, `node.computed`, `node.style.flexGrow`, `node.children` (empty = leaf)
- **Approach:** Restructure `drawTreeRow()` to draw 4 column regions at fixed x-offsets. Use `love.graphics.setColor()` with 3 opacity tiers. `Inspector.truncateWithEllipsis()` already exists in `painter.lua` for JSX preview clipping.

---

## Phase 1b: Live Source Editor in Detail Panel

**Status:** Not started
**Priority:** High — turns DevTools from "inspect" into "inspect AND edit"
**Effort:** Medium
**Depends on:** Phase 1

The detail panel has massive dead space below the box model diagram + style section. Embed the playground's TextEditor there, showing the actual source file of the selected node. Edits trigger esbuild rebuild, HMR fires, layout updates live. Full visual editing loop without leaving DevTools.

### What it shows

When a node is selected:
- The detail panel's lower half becomes a live code editor
- Editor opens `node.debugSource.fileName` scrolled to `node.debugSource.lineNumber`
- Syntax-highlighted JSX/TSX with the selected node's line highlighted
- Edits save to disk, esbuild watch picks it up, HMR applies — the tree updates in place

### Why this is platinum

The existing inline style editor lets you tweak individual values (`flexGrow: 1` → `2`). This lets you restructure the JSX itself — move children, add wrappers, change component hierarchy. You're not adjusting parameters; you're reshaping the layout from inside the inspector.

### Interaction

- Select node in tree → editor scrolls to its source line
- Edit JSX → save → HMR → tree updates, selection preserved (same node ID survives HMR)
- Box model diagram + style section stay above the editor (they update live too)
- Editor respects the playground's existing TextEditor cross-link: hover a JSX tag in the editor → highlight the corresponding node on the canvas

### Implementation

- **Data available:** `node.debugSource = { fileName, lineNumber }` on every node (set by React fiber in `hostConfig.ts`)
- **Editor component:** The playground already has a TextEditor with syntax highlighting + playground cross-link (`Inspector.setPlaygroundLink`). Reuse it.
- **File read:** New RPC `dev:readFile` — reads source file from disk, returns content. The TextEditor displays it.
- **File write:** New RPC `dev:writeFile` — writes edited content back to disk. esbuild watch detects the change, rebuilds, HMR applies via the existing `ReactJIT.reload()` path.
- **Detail panel integration:** Split `drawDetailPanel()` in `lua/inspector.lua` — upper region keeps box model + style + props, lower region hosts the TextEditor (either as a Lua-drawn editor or as a React `<TextEditor>` rendered in the devtools child window).
- **Scroll-to-line:** On node selection change, send `{ fileName, lineNumber }` to the editor, which scrolls and highlights that line.

---

## Phase 2: Lua / Hybrid / React Toggle

**Status:** Not started
**Priority:** High — the "perspective switch" concept
**Effort:** Medium
**Depends on:** Phase 1

Three-segment toggle at the top of the inspector:

```
[ Lua ]  [ Hybrid ]  [ React ]
```

Same tree structure, caret column, indentation, and selection. Only the projection changes.

### Mode definitions

| Mode | Primary | Secondary | Tertiary |
|------|---------|-----------|----------|
| **Lua** | Node type (`View`, `Text`) | Layout info (`w=2`, `grow=1`, bounds, id) | JSX hidden or very faint |
| **React** | JSX element (`<Box>`, `<Slider>`) | Props (`flexGrow`, handlers) | Lua internals hidden |
| **Hybrid** | Semantic name (`Box`, `Text`) | Lua type as small badge | JSX preview right-aligned |

### Behavior

- **Transition:** Crossfade opacity between column emphasis. No hard re-render.
- **Cross-mode sync:** Click a node in Lua mode → stays selected in React mode. Same node, different lens.
- **Hybrid reads:** `▾ Box [View]  <Box flexGrow={1} ...>`

### Implementation

- **File:** `lua/inspector.lua` — add `state.viewMode` (`"lua"` / `"hybrid"` / `"react"`), modify `drawTreeRow()` to pick column visibility/opacity per mode
- **Toggle:** Draw 3-segment bar in `drawTreePanel()` header. Click regions set `state.viewMode`.
- **Data:** All needed data already on every node — `node.type` (Lua), `node.debugName` (React), `node.style`/`node.props` (metadata)

---

## Phase 3: Mini Wireframe Viewport

**Status:** Not started
**Priority:** High — most intuitive layout debugging tool
**Effort:** Medium-Large
**Can pop out:** Yes

A scaled-down wireframe of the actual rendered UI. Each node is a thin-outline rectangle at its computed position/size. No real styling — just geometry.

### What it shows

- Every node as a thin-outline rectangle at computed `{x, y, w, h}`
- Faint labels inside larger nodes
- Flex direction visually represented (children stacked horizontally or vertically)
- Gaps and padding as spacing
- Reflects computed layout, not source structure

### Color coding

| Color | Meaning |
|-------|---------|
| Cool blue | Static content (render count = 1 since mount) |
| Amber | Dynamic content (stateful, updates on interaction) |
| Red tint | High-frequency re-render hotspot |
| Gray | Pure layout container (no own rendering) |
| Pulse | Regions where updates are happening (opacity modulation) |

### Interaction

- Bidirectional selection sync: click wireframe → highlight in real app + inspector tree. Click real app → highlight in wireframe.
- Independent zoom (when popped out to separate window)
- Hover shows node identity + computed bounds

### Implementation

- **New RPC:** `inspector:layoutTree` — walk `Tree.getTree()` recursively, serialize `{ id, type, debugName, x, y, w, h, wSource, hSource, flexDirection, children[] }` per node. Register in `init.lua`'s `rpcHandlers`.
- **Option A (Lua overlay):** Draw as a new devtools tab in `lua/devtools.lua`, using raw `love.graphics.rectangle("line", ...)` calls with scaled coordinates. Same pattern as inspector's box model diagram but for the full tree.
- **Option B (React component):** New `<WireframeView>` component consuming the RPC. Render each node as an absolutely-positioned `<Box>` with thin borders. Scale factor = `viewportWidth / appWidth`.
- **Selection sync:** Reuse `Inspector.selectNode(node)` / `Inspector.getSelectedNode()`. DevTools IPC already forwards selection both directions.

---

## Phase 4: Flex Pressure Visualization

**Status:** Not started
**Priority:** Medium — killer feature for flex debugging
**Effort:** Medium
**Depends on:** Phase 3

Overlay on the wireframe showing flex distribution math per node.

### Per-node overlay (when flex child is selected)

```
Parent width: 1200
Total basis:  348
Remaining:    852
This node:    ────────── 172 (flexGrow: 1, 20.2%)
Sibling A:    ────── 114 (flexGrow: 0.6, 13.4%)
```

### Visual representation

- Each child in a flex container shows a proportional bar
- Bar width = portion of remaining space received
- Color intensity = grow factor weight

### Constraint flow (stretch goal)

Arrows showing constraint propagation: parent width → child width, flex distribution → sibling allocations. Click a node → animate arrows showing layout flow.

### Implementation

- **Data gap:** Flex intermediates (`lineAvail`, `lineTotalFlex`, `lineTotalBasis`) are locals in `Layout.layoutNode()`, not persisted. Two options:
  - **Re-derive post-hoc:** Free space = parent inner width - sum of children `computed.w` - gaps - margins. Each child's grow contribution = `child.computed.w - child.style.flexBasis`. All data available from settled `node.computed` + `node.style`.
  - **Persist in layout:** Add `node.computed.flexInfo = { parentAvail, totalBasis, totalGrow, freeSpace, myContribution }` in `lua/layout.lua`'s flex distribution loop.
- **Rendering:** Overlay bars in the wireframe viewport using the same draw system.

---

## Phase 5: Skill Tree / Semantic Graph View

**Status:** Not started
**Priority:** Medium — the "wow factor" visualization
**Effort:** Large
**Can pop out:** Yes

Radial or force-directed visualization of the component tree, colored by semantic category.

### Layout

- Root node at center (or top)
- Branches spread outward radially or force-directed
- Each branch colored by semantic category
- Soft curved connections, glow intensity = activity level

### Branch color categories

| Color | Category | Examples |
|-------|----------|---------|
| Cool blue | Layout containers | Box, ScrollView, flex wrappers |
| Green | Interactive | Pressable, TextInput, Slider |
| Amber | Data-driven | Stateful components, store consumers |
| Purple | Effects / side-effects | Animations, timers, subscriptions |
| Cyan | AI-generated | LLM output, agent responses |
| Orange | Network-bound | API calls, async data |

### Node badges (traits)

- `S` — Static (never re-rendered since mount)
- `R` — Reactive (local state/props)
- `A` — Async (timer/network triggered)
- `H` — Hotspot (above threshold ms or frequency)
- `D` — Dirty-layout (frequent layout invalidation)

### Interaction

- Click branch → highlight layout region in wireframe
- Click layout region → highlight semantic branch
- Zoom into subtrees

### Implementation

- **Option A (Lua effect):** New `lua/effects/forcegraph.lua` registered via effects system. `<ForceGraph>` React component. Full GPU-accelerated drawing. Best performance for large trees.
- **Option B (Pure React):** Absolutely-positioned `<Box>` nodes + rotated thin `<Box>` edges. `useLuaInterval(16, tick)` for physics. Viable for <100 nodes. `RadarChart` in storybook uses `polygonPoints` for arbitrary shapes — same technique for curved edges.
- **Classification data:** Requires Phase 6 (Node Classification) for branch coloring by behavior. Without it, color by type/category only.

---

## Phase 6: Node Classification System

**Status:** Not started
**Priority:** Medium — feeds into wireframe colors, skill tree branches, perf tab
**Effort:** Medium

Runtime-observed classification of every node. Not compile-time guesses — measured behavior.

### Taxonomy (`contentKind`)

| Kind | Definition | Detection |
|------|-----------|-----------|
| `static` | Never re-rendered since mount | Render count = 1 after initial mount |
| `reactive` | Re-renders on local state/props | Re-renders correlate with setState |
| `procedural` | Re-renders on timer/interval | Regular cadence |
| `async` | Re-render triggered by network/RPC | Follows async resolution |
| `ai-generated` | Content from LLM/agent | Originates from `claude:*` RPC data |
| `external` | Content from external service | Originates from network fetch |

### HMR-aware

After hot update, nodes in the update path get `changed-by-hmr` tag that fades after N seconds. Skill tree shows affected branch lighting up.

### Integration points

- Wireframe viewport → color coding
- Skill tree → branch colors
- Performance tab → filter/sort by kind
- Inspector tree → badge in all three modes

### Implementation

- **JS side:** Add render counter per node in `packages/native/src/hostConfig.ts` — increment on `commitUpdate`. Store in `Instance` alongside existing props.
- **Lua side:** Add `node.renderCount` field updated via `UPDATE` mutation command. Add `node.contentKind` derived from render pattern analysis.
- **Expose:** New field on nodes, consumed by all visualization phases.

---

## Phase 7: Performance Tab

**Status:** Not started
**Priority:** Medium-High
**Effort:** Large
**Can pop out:** Yes

### Top-level health indicator

```
Frame: ████████░░░░░░░░ 8.2ms / 16.6ms (49% budget used)
```

### Top offenders (ranked by render cost)

```
1. Slider#114     2.1ms  (layout + paint)
2. ProcessList    1.4ms  (re-render churn)
3. CoreHeatmap    0.8ms  (paint)
```

Click → highlights in all views (wireframe, skill tree, inspector).

### Metrics

- Per-node render time (JS reconciler)
- Per-node layout time (Lua layout engine)
- Per-node paint time (Love2D painter)
- Re-render frequency per node
- Total frame breakdown: JS → transport → layout → paint → GPU

### Implementation

- **Existing:** `Inspector.getPerfData()` returns `{ fps, layoutMs, paintMs, nodeCount }`. `dev:perf` RPC exposes it to React.
- **New timing:** Wrap per-node layout in `lua/layout.lua` with `love.timer.getTime()` around `layoutNode()`. Store `node.computed.layoutMs`. Same for painter: time each node's draw call.
- **Frame budget bar:** `frameMs = 1000 / fps`. Budget = `(layoutMs + paintMs) / 16.6 * 100`.
- **History buffer:** Ring buffer of last 120 frame times in inspector state for sparkline display.
- **Tab:** New tab in `lua/devtools.lua` alongside Elements/Console/Logs.

---

## Phase 8: HMR Impact Report

**Status:** Not started
**Priority:** Medium
**Effort:** Medium
**Depends on:** Phase 6, Phase 7

Auto-generated diagnostic card after every hot module replacement.

### Report card

```
┌─ HMR Impact Report ─────────────────────┐
│ Updated:              AudioRackStory.tsx  │
│ Preserved state:      yes                │
│ Nodes remounted:      0                  │
│ Layout invalidations: 12 nodes           │
│ Paint time delta:     +0.4ms             │
│ Biggest new hotspot:  Slider#114 (+0.2ms)│
└──────────────────────────────────────────┘
```

### What it measures

- Which modules were updated (from bundle change detection)
- Whether state was preserved (`__devState` / `__hotstateCache` survived)
- Nodes remounted vs survived
- Layout invalidation count
- Paint time delta (2s sample before vs after)
- New hotspots introduced

### Implementation

- **HMR hook:** `ReactJIT.reload()` in `lua/init.lua` already runs the full teardown/rebuild. Add pre/post perf snapshots around it.
- **Report data:** Store `{ preReloadPerf, postReloadPerf, modulesChanged, statePreserved, remountCount }` in inspector state.
- **Display:** Toast or card overlay in devtools after each reload. Wireframe + skill tree highlight affected subtree for 3 seconds.

---

## Phase 9: State Snapshot System

**Status:** Not started
**Priority:** Medium
**Effort:** Large

### Controls

```
[ Capture ] [ Restore ▾ ] [ Diff ▾ ]  Preserve state: [ON]
```

### Capabilities

- **Capture:** Serialize React state (`__devState`) + localstore + Lua node properties. Named snapshot in localstore.
- **Restore:** Hydrate from snapshot. State restores, UI re-renders.
- **Diff goggles:** Overlay comparing snapshot-A vs current:
  - Wireframe: changed bounds flash, appeared/disappeared show as ghosts, changed props get badge
  - Skill tree: dynamic branches glow warm, quieted branches fade
  - Inspector: changed props get delta badge

### State preservation knobs

- Preserve state on HMR (default: on)
- Preserve layout cache (optional)
- Reset subtree on hot update (scoped reset)

### Implementation

- **Capture:** `bridge:callGlobalReturn("__getDevState")` already exists for HMR. Extend to include localstore dump via `sqlite:*` RPCs.
- **Restore:** Reverse of HMR — inject `__devState` and trigger re-render.
- **Diff:** Compare two serialized state objects, annotate changed node IDs, forward to visualization layers.

---

## Phase 10: Live / Frozen Toggle

**Status:** Not started
**Priority:** Low-Medium
**Effort:** Small-Medium

### Live mode (default)

All views auto-update with animations.

### Frozen mode

Paused inspection. When frozen, a timeline appears:

```
─────●───────●────●──────●────────●── now
     │       │    │      │        │
     HMR     snap layout render   HMR
     applied taken recalc spike   applied
```

Scrub through events. Not full time-travel — a list of engine events with timestamps.

### Events tracked

- HMR applied (with module list)
- State snapshot taken/restored
- Node mounted/unmounted
- Layout recalculated (with trigger)
- Render spike (above threshold)

### Implementation

- **Event log:** Ring buffer in `lua/init.lua` or inspector state. Each entry: `{ type, timestamp, data }`. Append on HMR, layout, perf spike, etc.
- **Freeze:** `state.frozen = true` in inspector → stop updating tree/perf data. Show last-captured state.
- **Timeline scrub:** Display event markers proportionally spaced by timestamp. Click → show state at that moment (from event log + nearest snapshot).

---

## Phase 11: Pop-Out Window Architecture

**Status:** Partially exists
**Priority:** High (cross-cutting)
**Effort:** Small (infrastructure exists)

### How it works

Each DevTools tab is already a React component (or Lua draw pass). To pop out:

```tsx
// Inline
<WireframeView data={layoutTree} selection={selectedId} />

// Popped out
<Window title="Wireframe" width={800} height={600}>
  <WireframeView data={layoutTree} selection={selectedId} />
</Window>
```

Same component, same props, different container. Selection syncs via shared state.

### Per-tab pop-out

Each tab header gets a `⧉` button. Click → `<Window>`. Tab shows "Popped out →" with pull-back option.

### Implementation

- **Already working:** `DevTools.popOut()` in `lua/devtools.lua` spawns child Love2D via TCP IPC (`lua/window_ipc.lua`). Mutation forwarding, perf sync, selection sync all functional.
- **Extend incrementally:** As each visualization lands, add pop-out button. For Lua-drawn tabs (Elements, Perf), the existing child window approach works. For React component tabs (Wireframe, Skill Tree), use `<Window>` from React side.
- **Shared state:** Selection, hover, frozen/live, active snapshot are either inspector state (Lua-drawn views) or React context (React-drawn views). IPC already syncs both directions.

---

## Implementation Order

```
Phase 1: Inspector Tree Polish ──┐
Phase 1b: Live Source Editor ────┤
                                 ├── Phase 2: Lua/Hybrid/React Toggle
                                 │
Phase 3: Mini Wireframe ─────────┤
                                 ├── Phase 4: Flex Pressure
Phase 6: Node Classification ────┤
                                 ├── Phase 5: Skill Tree
Phase 7: Performance Tab ────────┤
                                 ├── Phase 8: HMR Impact Report
                                 │
Phase 9: State Snapshots         │
Phase 10: Live/Frozen Toggle     │
                                 │
Phase 11: Pop-Out Windows ───────┘ (wire incrementally as each view lands)
```

**Suggested execution:** 1 → 1b → 2 → 3 → 6 → 7 → 4 → 5 → 8 → 9 → 10. Phase 11 wired into each as it ships.

---

## Design Language

All DevTools views share a diagnostic aesthetic distinct from the user's app:

- Dark backgrounds, neon accents
- Monospace for data (node IDs, sizes, props)
- Sans-serif for labels (tab titles, headers)
- Consistent color tokens across all views
- Subtle animations — crossfades, glows, breathing opacity
- No visual noise — every element earns its pixels
