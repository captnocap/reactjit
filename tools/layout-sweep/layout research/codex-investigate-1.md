# ReactJIT Layout Engine Investigation (codex-investigate-1)

Files read fully:
- `/home/siah/creative/reactjit/lua/layout.lua` (1775 lines)
- `/home/siah/creative/reactjit/lua/measure.lua` (341 lines)

## End-to-End Layout Path (from `layoutNode()` to `child.computed = {x,y,w,h}`)

```mermaid
flowchart TD
  A[Layout.layout root entry\nlayout.lua:1722] --> B[Layout.layoutNode node entry\nlayout.lua:554]
  B --> C{display/capability/effect/mask skip?\n564-620}
  C -->|skip| Z1[node.computed=0x0 and return]
  C -->|normal| D[Resolve percentage bases\npctW/pctH from _parentInnerW/_parentInnerH or pw/ph\n628-631]
  D --> E[Resolve explicit/min/max dims\n634-643]
  E --> F[Resolve node w/h base\n649-662, 666-680]
  F --> G[Apply parent signals (_flexW/_stretchH)\n687-709]
  G --> H[Resolve node padding + text/code/input intrinsic\n713-797]
  H --> I[Clamp w/h + possible text remeasure\n799-815]
  I --> J[Compute innerW/innerH + flex context\n826-839]
  J --> K[Collect visible children and pre-measure childInfos\n858-1053]
  K --> L[Split into flex lines\n1064-1110]
  L --> M[Per-line flex distribution\nlineAvail + grow/shrink\n1120-1190]
  M --> N[Post-flex remeasure text/containers\n1216-1274]
  N --> O[Compute line cross size + justify offsets\n1280-1345]
  O --> P[Position each child\n1366-1419]
  P --> Q[Set parent-assigned signals to child\n(_flexW/_stretchH/_parentInnerW/H)\n1421-1467]
  Q --> R[child.computed = {x,y,w,h}\n1463]
  R --> S[Recursive Layout.layoutNode(child, cx, cy, cw_final, ch_final)\n1467]
  S --> T[Track content extents and cursor\n1471-1501]
  T --> U[Auto-height/fallback/final node.computed\n1514-1568]
  U --> V[Absolute children layout path\n1576-1656]
  V --> W[Scroll state finalize\n1661-1705]
```

## 1) How `Layout.layoutNode()` resolves width and height

### Width (`w`)
- Percentage base is chosen first: `pctW = node._parentInnerW or pw` (`layout.lua:628`).
- Explicit width: `explicitW = ru(s.width, pctW)` (`layout.lua:640`).
- Resolution order (`layout.lua:649-662`):
1. explicit `width` -> `w=explicitW`
2. `width: fit-content` -> `w=estimateIntrinsicMain(node, true, pw, ph)`
3. else if `pw` exists -> `w=pw`
4. else content estimate
- Then parent flex override may replace width: if `node._flexW` then `w=node._flexW` (`layout.lua:687-693`).
- Then width clamped by min/max (`layout.lua:799-803`).

### Height (`h`)
- Percentage base: `pctH = node._parentInnerH or ph` (`layout.lua:629`).
- Explicit height: `explicitH = ru(s.height, pctH)` (`layout.lua:641`).
- Early set: `h=explicitH` only (`layout.lua:666`).
- Optional derive from `aspectRatio` (`layout.lua:671-680`).
- Parent cross/main signals may assign height via `_stretchH` (`layout.lua:697-709`).
- Text/code/input/capability intrinsic may set `h` (`layout.lua:726-797`).
- If still nil, auto-height after children (`layout.lua:1514-1532`).
- Final clamp (`layout.lua:1549-1550`).

## 2) How `estimateIntrinsicMain()` works and when it is called

Definition: `layout.lua:413`.

Behavior:
- Computes axis padding (`layout.lua:417-423`).
- Text node branch (`layout.lua:426-455`):
1. Resolves text/font props.
2. If estimating height (`isRow=false`) and `pw` exists, uses `wrapWidth = pw - horizontalPadding` (`layout.lua:439-449`).
3. Calls `Measure.measureText(...)` (`layout.lua:450-451`).
4. Returns axis result + axis padding (`layout.lua:452`).
- TextInput branch (`layout.lua:457-466`) returns intrinsic font-height on vertical path.
- Container branch (`layout.lua:468-545`):
1. Gets children, gap, direction.
2. Derives `childPw` for height-estimation to enforce wrapping (`layout.lua:480-487`).
3. Main-axis measurement sums children (+ margins + gaps) (`layout.lua:492-517`).
4. Cross-axis measurement takes max child (+ margins) (`layout.lua:518-544`).

Call sites in layout flow:
- Node width fit-content/content fallback (`layout.lua:653`, `layout.lua:660`).
- Child pre-measure pass for containers (`layout.lua:945`, `layout.lua:948`).
- Row post-flex re-estimate of non-text child heights with final width (`layout.lua:1267`).
- Absolute children intrinsic fallback (`layout.lua:1603`, `layout.lua:1613`).

## 3) Flex grow/shrink distribution: where remaining space is computed/divided

Per-line flex logic is in `layout.lua:1120-1190`.

- Per-line totals:
1. `lineTotalBasis` from `ci.basis` (`layout.lua:1126-1139`).
2. `lineTotalFlex` sum of `ci.grow` (`layout.lua:1139-1141`).
3. Margins + gaps (`layout.lua:1137`, `layout.lua:1144`).
- Remaining/free space:
- `lineAvail = mainSize - lineTotalBasis - lineGaps - lineTotalMarginMain` (`layout.lua:1145`).
- Grow path:
- If `lineAvail > 0 and lineTotalFlex > 0`, each grow item gets:
`ci.basis += (ci.grow / lineTotalFlex) * lineAvail` (`layout.lua:1162-1168`).
- Shrink path:
1. If `lineAvail < 0`, compute `totalShrinkScaled = sum(flexShrink * basis)` with default `flexShrink=1` (`layout.lua:1171-1179`).
2. Overflow `= -lineAvail` (`layout.lua:1181`).
3. `ci.basis -= (sh*basis/totalShrinkScaled) * overflow` (`layout.lua:1186-1187`).

Final positioned width in row uses this basis: `cw_final = ci.basis` (`layout.lua:1368`).

## 4) Percentage widths: `pctW` vs `pw` vs `innerW`

- `pw`: parent-provided available outer width argument to current `layoutNode(node, px, py, pw, ph)` (`layout.lua:554`). For children, this is passed as `cw_final` by parent recursion (`layout.lua:1467`).
- `innerW`: current node content-box width = `w - padL - padR` (`layout.lua:828`). Used for child sizing, child percentage resolution in first pass (`layout.lua:870`), flex main size (`layout.lua:838`), and propagated as `_parentInnerW` (`layout.lua:1465`).
- `pctW`: basis used when resolving this node's own percentages = `node._parentInnerW or pw` (`layout.lua:628`). This is crucial: percentages are intended to resolve against parent inner width, not child allocated width (`layout.lua:624-627`).

Percent resolution data path:
1. Parent computes `innerW` (`layout.lua:828`).
2. Parent sets `child._parentInnerW = innerW` before recursion (`layout.lua:1465`).
3. Child `layoutNode()` reads that as `pctW` (`layout.lua:628`) and resolves `width: '25%'` as `ru(s.width, pctW)` (`layout.lua:640`).

## 5) How text nodes get measurement constraint (wrap width)

Two main paths:

### Node self-measurement in `layoutNode`
- For text node without explicit W/H (`layout.lua:726-753`):
1. `outerConstraint = explicitW or pw or 0` (`layout.lua:729`).
2. Optional maxWidth clamp (`layout.lua:731-734`).
3. `constrainW = outerConstraint - padL - padR` (`layout.lua:736`).
4. `measureTextNode(node, constrainW)` (`layout.lua:739`).
5. If no explicitW and no parentAssignedW, set `w = measured + padding` (`layout.lua:742-746`).

### Parent child pre-measure path
- During parent child scan (`layout.lua:896-924`):
1. `outerConstraint = cw or innerW` (`layout.lua:908`).
2. `constrainW = outerConstraint - cpadL - cpadR` (`layout.lua:915`).
3. `measureTextNode(child, constrainW)` (`layout.lua:918`).
4. Use result to fill missing `cw/ch`.

Underlying wrapping implementation is in `Measure.measureText(...)`:
- Wrap branch if `maxWidth > 0`, uses `font:getWrap(text, wrapConstraint)` (`measure.lua:249-267`).
- Result width is capped to `maxWidth` (`measure.lua:287`).

## 6) How parent resolved width flows down to children as constraints

Flow is multi-channel:

1. Parent resolves own `w` and derives `innerW` (`layout.lua:649-662`, `layout.lua:828`).
2. Parent uses `innerW` when computing child initial `cw = ru(cs.width, innerW)` (`layout.lua:870`) and basis (`layout.lua:1015`, `layout.lua:1030`).
3. Flex distribution produces per-line `ci.basis` (`layout.lua:1162-1188`).
4. Final row child width set to `cw_final = ci.basis` (`layout.lua:1368`).
5. Parent writes child signals:
- `child._flexW = cw_final` under specific conditions (`layout.lua:1425-1435`, `layout.lua:1444-1445` for column stretch).
- `child._parentInnerW = innerW` always (`layout.lua:1465`).
6. Recurses as `Layout.layoutNode(child, cx, cy, cw_final, ch_final)` (`layout.lua:1467`).
7. Child chooses between explicit %, `pw`, and `_flexW` override during its own resolution (`layout.lua:628-662`, `layout.lua:687-693`).

## Bug Thesis A: Why `flexGrow: 1` in a row can produce `w: 0`

Primary failing path appears to be at the parent->child handoff for row items:

- Parent computes row final width from flex basis (`layout.lua:1368`).
- But parent only signals `_flexW` to child if either:
1. Child had explicit width and `cw_final ~= explicitChildW` (`layout.lua:1425-1427`), or
2. Aspect-ratio special case (`layout.lua:1428-1435`).
- For the common case `flexGrow:1` + no explicit width + no aspectRatio, `_flexW` is **not** set.

Then child `layoutNode` runs with `pw = cw_final`, but child text/intrinsic logic can overwrite width:
- In text self-measure, if `not explicitW` and `not parentAssignedW`, it resets `w` to measured text width (`layout.lua:742-745`).
- `parentAssignedW` is only true when `_flexW` existed (`layout.lua:686-693`).

For empty/non-text containers, child pre-pass may estimate 0 (`estimateIntrinsicMain` on empty returns padding only, often 0: `layout.lua:470-472`), so downstream width can collapse.

Net: row flex width exists as `cw_final` in parent, but is not reliably treated as authoritative in child because `_flexW` signaling is conditional. This mismatch explains "flexGrow child ends at w=0" when intrinsic path returns 0 and no override is present.

Suspicious code path markers:
- `layout.lua:1425-1436` (missing `_flexW` assignment for flex-grown auto-width children).
- `layout.lua:742-745` (text width override unless `parentAssignedW`).
- `layout.lua:470-472` (empty intrinsic estimate returns 0).

## Bug Thesis B: Why `width: '25%'` doesn’t constrain text wrapping

The most direct issue is text constraint source in node self-measure:

- In text path, constraint uses `outerConstraint = explicitW or pw or 0` (`layout.lua:729`).
- If width is percentage, `explicitW` should come from `ru(s.width, pctW)` (`layout.lua:640`), where `pctW = _parentInnerW or pw` (`layout.lua:628`).
- However, when parent final width and percent base diverge, using `pw` as fallback plus conditional `_flexW` behavior can decouple actual allocated width from constraint source.
- Also, parent always passes `_parentInnerW = innerW` of container (`layout.lua:1465`), not child-specific allocated width. So text percentage may be resolved against container inner width while actual child width may later be basis-driven.

Specific inconsistency producing overflow symptoms:
- Parent child pre-measure does use `cw or innerW` (`layout.lua:908`), but child self-measure recomputes with `explicitW or pw` (`layout.lua:729`). If `pw` seen by child does not represent the intended percentage-resolved width, wrapping width can be too large, giving near-natural/full-width measurement.
- When `_flexW` is absent, `parentAssignedW=false` and text may re-expand (`layout.lua:742-745`) despite percentage intent.

Suspicious code path markers:
- `layout.lua:729` (`explicitW or pw` as wrap source; ignores the already-computed `w` path).
- `layout.lua:742-745` (text width override can ignore parent allocation).
- `layout.lua:1425-1436` (missing `_flexW` for non-explicit row children, including percent/auto interaction cases).

## Additional behavior that looks wrong / risky

- `hasDefiniteMainAxis = isRow or (explicitH ~= nil)` (`layout.lua:1329`) treats all row main axes as definite even when row width may be auto/content-sized. This can distort justify behavior.
- In node text path, initial constraint defaults to `0` when both explicitW and pw are nil (`layout.lua:729`), forcing unconstrained-like wrongness in edge recursive contexts.
- The parent writes `child.computed` before recursion (`layout.lua:1463`), then child overwrites inside its own `layoutNode` (`layout.lua:1567`). If the child recomputes width differently, parent’s intended geometry is lost.

## Concise answer to your two critical bugs

1. `flexGrow:1` -> `w:0`:
- Root cause is parent-child authority mismatch. Row parent computes `cw_final` from flex correctly (`layout.lua:1368`, `layout.lua:1162-1168`) but does not always force child to honor it (`layout.lua:1425-1436`). Child then self-sizes via intrinsic/text paths and can collapse to zero.

2. `% width` text overflow:
- Wrap constraint for text comes from `explicitW or pw` (`layout.lua:729`) rather than a single authoritative final allocated width. Combined with conditional `_flexW` signaling and child recomputation, text can measure with too-wide constraint and render at near natural width instead of the `%`-resolved width.

