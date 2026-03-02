# ReactJIT Layout Engine Trace (layout.lua + measure.lua)

Files read completely:
- `lua/layout.lua` (1775 lines)
- `lua/measure.lua` (341 lines)

## End-to-end flow (from `layoutNode()` entry to `child.computed`)

```mermaid
flowchart TD
  A[layoutNode(node, px, py, pw, ph)] --> B{Early exits?\n(display:none, non-visual, background effect, mask)}
  B -->|yes| B1[node.computed={x:px,y:py,w:0,h:0}; return]
  B -->|no| C[Resolve percentage bases\npctW/pctH = _parentInnerW/H or pw/ph\n(layout.lua:L624-L631)]
  C --> D[Resolve constraints + explicit sizes\nmin/max + width/height + fit-content\n(layout.lua:L633-L643)]
  D --> E[Resolve w/h skeleton\nexplicit -> fit-content -> pw -> intrinsic\n+ aspectRatio + parent signals _flexW/_stretchH\n(layout.lua:L648-L710)]
  E --> F[Resolve padding and leaf intrinsic measurement\nText/CodeBlock/TextInput/capability\n(layout.lua:L711-L797)]
  F --> G[Clamp size and text remeasure-on-clamp\n(layout.lua:L799-L815)]
  G --> H[Compute x,y, innerW, innerH, mainSize\n(layout.lua:L819-L839)]
  H --> I[Collect visible children + childInfos\nresolve child cw/ch/grow/shrink/basis/margins\n(layout.lua:L858-L1054)]
  I --> J[Split into flex lines\n(layout.lua:L1064-L1110)]
  J --> K[Per line: compute free space\nlineAvail = mainSize - basis - gaps - margins\n(layout.lua:L1126-L1147)]
  K --> L[Grow/Shrink distribution on ci.basis\n(layout.lua:L1162-L1189)]
  L --> M[Post-distribution remeasure\ntext grow + container height recompute\n(layout.lua:L1214-L1274)]
  M --> N[Line cross size + justify offsets\n(layout.lua:L1276-L1345)]
  N --> O[Position child\ncompute cx/cy/cw_final/ch_final\n(layout.lua:L1352-L1419)]
  O --> P[Signal child overrides\n_flexW/_stretchH + pass _parentInnerW/H\n(layout.lua:L1421-L1466)]
  P --> Q[Assign child.computed={x,y,w,h}\n(layout.lua:L1463)]
  Q --> R[Recurse: layoutNode(child, cx, cy, cw_final, ch_final)\n(layout.lua:L1467)]
  R --> S[Use actual child.computed to advance cursor\n(layout.lua:L1469-L1493)]
  S --> T[After lines: auto-height + surface fallback\nfinal node.computed\n(layout.lua:L1514-L1568)]
  T --> U[Layout absolute children (separate pass)\n(layout.lua:L1576-L1656)]
```

---

## 1) How `Layout.layoutNode()` resolves a node width/height

### Width (`w`)
1. `pctW` is established first: `node._parentInnerW or pw` (`layout.lua:L628`).
2. `explicitW = resolveUnit(style.width, pctW)` (`layout.lua:L640`).
3. Width selection order (`layout.lua:L648-L662`):
   - explicit width
   - `fit-content` -> `estimateIntrinsicMain(node, true, pw, ph)`
   - else `pw` (parent-provided available width)
   - else intrinsic estimate
4. `aspectRatio` may derive missing width from resolved height (`layout.lua:L672-L680`).
5. Parent flex can forcibly override width via `_flexW` (`layout.lua:L687-L693`).
6. Text path can override width again when no explicit width and no parent-assigned flag (`layout.lua:L742-L745`).
7. Width is clamped by min/max (`layout.lua:L801-L803`).

### Height (`h`)
1. Start with explicit height only (`layout.lua:L666-L669`).
2. `aspectRatio` may derive missing height (`layout.lua:L672-L677`).
3. Parent cross-axis assignment can override height via `_stretchH` (`layout.lua:L695-L709`).
4. Leaf measurement (Text/CodeBlock/TextInput/capability) may set auto height (`layout.lua:L726-L797`).
5. Height min/max clamp if already set (`layout.lua:L813-L815`).
6. Final auto-height pass if still nil (`layout.lua:L1514-L1531`), then clamp (`layout.lua:L1550`).

---

## 2) How `estimateIntrinsicMain()` works and when it is called

### Algorithm (`layout.lua:L413-L545`)
- Resolves axis padding first (`L417-L424`).
- Text nodes:
  - measures text via `Measure.measureText(...)`.
  - when estimating height (`isRow=false`), computes `wrapWidth` from `pw - horizontalPadding` so wrapped height is realistic (`L439-L450`).
- `TextInput`:
  - intrinsic height from font metrics for vertical measurement (`L457-L466`).
- Containers:
  - returns padding if empty (`L469-L472`).
  - uses direction + axis comparison:
    - measuring along container main axis: sum child sizes + margins + gaps (`L492-L517`).
    - measuring along cross axis: max child size + margins (`L518-L544`).
  - child explicit dimensions are preferred before recursion (`L507-L513`, `L533-L539`).

### Call sites
- Node width `fit-content`: `layout.lua:L653`.
- Node width content fallback (no explicit and no `pw`): `layout.lua:L660`.
- Child intrinsic width estimation in prepass: `layout.lua:L945`.
- Child intrinsic height estimation in prepass: `layout.lua:L948`.
- Row post-flex container height re-estimation with new width: `layout.lua:L1267`.
- Absolute children intrinsic width/height: `layout.lua:L1603`, `layout.lua:L1613`.

---

## 3) Flex grow/shrink distribution: where free space is calculated and divided

### Basis construction (before distribution)
- Each child gets `basis`:
  - `flexBasis` if provided (`layout.lua:L1013-L1027`), with special wrap+gap percentage correction (`L1021-L1025`).
  - else width/height fallback `(cw or 0)` / `(ch or 0)` (`layout.lua:L1029-L1031`).

### Free space computation
- Per line totals are accumulated (`layout.lua:L1126-L1142`).
- Remaining space:
  - `lineAvail = mainSize - lineTotalBasis - lineGaps - lineTotalMarginMain` (`layout.lua:L1145`).

### Distribution
- Positive space + grow items:
  - `ci.basis += (ci.grow / lineTotalFlex) * lineAvail` (`layout.lua:L1162-L1168`).
- Negative space:
  - default `flexShrink` is `1` if unspecified (`layout.lua:L1176-L1177`, `L1185`).
  - shrink scaled by `shrink * basis` (`layout.lua:L1173-L1188`).

### Where basis becomes concrete size
- Row main-axis width: `cw_final = ci.basis` (`layout.lua:L1368`).
- Column main-axis height: `ch_final = ci.basis` (`layout.lua:L1399`).

---

## 4) Percentage width resolution: `pctW` vs `pw` vs `innerW`

- `pctW` (`layout.lua:L628`):
  - base used for resolving this node’s percentage style values (`width`, `minWidth`, etc.).
  - intended containing-block width: parent content width, passed via `_parentInnerW` (`layout.lua:L1465`).
- `pw` (function arg; docs at `layout.lua:L553-L554`):
  - parent-assigned available outer width for this node in this pass.
  - used for fallback width when no explicit width (`layout.lua:L655-L657`).
- `innerW` (`layout.lua:L828`):
  - this node’s own content-box width (`w - paddingLeft - paddingRight`).
  - used as percentage base for children in prepass (`layout.lua:L870`) and stored to children as `_parentInnerW` (`layout.lua:L1465`).

Net: percentages resolve against `pctW` (parent content box), while flex allocation and fallback sizing flow through `pw`, and child constraint propagation is based on this node’s `innerW`.

---

## 5) How text nodes get their wrapping constraint

There are multiple measurement points:

1. Node’s own text measurement (`layout.lua:L726-L740`):
   - `outerConstraint = explicitW or pw or 0` (`L729`).
   - optional maxWidth clamp (`L731-L734`).
   - wrap width is `constrainW = outerConstraint - padL - padR` (`L736-L737`).
2. Parent child-prepass text measurement (`layout.lua:L896-L924`):
   - if child has no explicit width: `outerConstraint = innerW` (`L908`).
   - then `constrainW = outerConstraint - childHorizontalPadding` (`L915-L916`).
3. Re-measure after width clamp (`layout.lua:L803-L809`).
4. Re-measure after flex grow width change (`layout.lua:L1219-L1243`).

Important behavior from `measure.lua`:
- Wrapping only occurs when `maxWidth > 0` (`measure.lua:L249`).
- If `maxWidth` is `0` or nil, measurement is unconstrained single-line natural width (`measure.lua:L290-L304`).

---

## 6) How parent resolved width flows down to child constraints

For in-flow children:
1. Parent computes `cw_final`/`ch_final` during line positioning (`layout.lua:L1368-L1405`).
2. Parent writes `child.computed = {x,y,w,h}` immediately (`layout.lua:L1463`).
3. Parent passes two constraint channels before recursion:
   - `_parentInnerW/H = parent.innerW/H` for percentage resolution (`layout.lua:L1465-L1466`).
   - function args `pw/ph = cw_final/ch_final` via recursive call (`layout.lua:L1467`).
4. Child consumes `_parentInnerW/H` once (`layout.lua:L628-L631`) for percentage resolution.
5. Child uses `pw/ph` for non-explicit fallback sizing and text constraints.

Absolute children use the same propagation pattern (`layout.lua:L1651-L1655`).

---

## Bug theses and suspicious paths

## Thesis A: Why `flexGrow: 1` can end at `w: 0`

Primary failure path:
1. Row child with `flexGrow > 0` and no explicit width skips intrinsic width pre-estimation (`layout.lua:L941-L944`).
2. Its fallback basis becomes `0` (`layout.lua:L1030`).
3. If row `mainSize` is `0`/collapsed, free space is `<= 0` (`layout.lua:L1145`), so grow adds nothing (`layout.lua:L1162` guard fails).
4. Final row width is `cw_final = ci.basis = 0` (`layout.lua:L1368`).
5. Child recursion gets `pw=0` (`layout.lua:L1467`) and resolves `w=0` (`layout.lua:L655-L657`).

Secondary path that can make row grow appear ignored for text children:
- In rows, `_flexW` is only signaled for explicit-width/aspect-ratio cases (`layout.lua:L1424-L1436`), not generic auto-width children.
- Text child then may overwrite parent-provided width with intrinsic text width (`layout.lua:L742-L745`) when `parentAssignedW` is false.

## Thesis B: Why percentage widths can fail to constrain text

Two concrete risky paths:
1. Zero-width constraint turns into unconstrained measurement:
   - layout clamps negative constraints to `0` (`layout.lua:L737`, `layout.lua:L916`),
   - but `Measure.measureText` treats `maxWidth <= 0` as unconstrained single-line (`measure.lua:L249`, `L290-L304`).
   - result: natural-width measurement appears to ignore container constraint.
2. Flex-adjusted width vs text constraint mismatch:
   - Child width can be overridden by parent via `_flexW` (`layout.lua:L687-L693`),
   - but text constraint still uses `explicitW or pw` (`layout.lua:L729`) instead of the post-override `w`.
   - if `w` is shrunk relative to `explicitW` (common with percentage widths in crowded rows), text can be measured with a wider constraint than final box.

## Marked suspicious/wrong-looking code paths

- `layout.lua:L941-L944`: grow-in-row skips intrinsic width unconditionally; depends entirely on nonzero `mainSize` later.
- `layout.lua:L1030`: `basis = (cw or 0)` hard-falls to `0` for missing width.
- `layout.lua:L1145`: free space derived from possibly collapsed `mainSize`.
- `layout.lua:L1424-L1436`: row path does not set `_flexW` for generic auto-width children.
- `layout.lua:L742-L745`: text can override width from `pw` to intrinsic width unless `parentAssignedW` is true.
- `layout.lua:L729`: text constraint source ignores already-overridden `w`.
- `measure.lua:L249` + `L290-L304`: `maxWidth == 0` means no wrapping, which amplifies overflow in collapsed/percentage-edge cases.
