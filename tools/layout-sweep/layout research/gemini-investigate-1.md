# ReactJIT Layout Engine Investigation

## Layout Node Path Tracing
Here is the complete path that a node traces from `layoutNode()` entry to its final computed dimensions:

```mermaid
flowchart TD
    A[layoutNode() Entry] --> B{display: none?}
    B -- Yes --> C[Return {w: 0, h: 0}]
    B -- No --> D[Resolve Constraints & Units <br/> pctW/pctH, min/max]
    
    D --> E{Width Source}
    E -- Explicit / Parent --> F[w = explicitW or pw]
    E -- fit-content / auto --> G[w = estimateIntrinsicMain]
    
    F --> H[Flex Overrides]
    G --> H
    H -- child._flexW sets w --> I[w = node._flexW]
    H -- node._stretchH sets h --> I
    
    I --> J{Is Text Node?}
    J -- Yes --> K[measureTextNode() to get w/h]
    J -- No/Generic --> L[Resolve Early Heights]
    K --> L
    
    L --> M[Child Prep Loop <br/> ru() bounds, estimate child dims]
    M --> N[Flex Wrap Lines]
    N --> O[Flex Distribution: Grow/Shrink]
    O --> P[Re-measure Text With Flexed Width]
    
    P --> Q[Align Items / Justify Line]
    Q --> R[Compute cx, cy, cw_final, ch_final]
    
    R --> S[Set flex override signals for child <br/> child._flexW / child._stretchH]
    S --> T[Recursive layoutNode() on Children]
    
    T --> U[Auto Height Resolution <br/> Furthest descendent extent]
    U --> V[Proportional Surface Fallback]
    V --> W[Save node.computed = {x,y,w,h}]
```

## Detailed Path Analysis

1. **How does `Layout.layoutNode()` resolve a node's width and height?**
   Width is resolved first (Lines 649-663). It prioritizes explicit style (`w = explicitW`), then `fit-content` (via `estimateIntrinsicMain()`), then passing down parent constraints (`pw`), and ultimately falling back to content estimation if no constraint exists. Height starts with explicit rules only, deferring auto-height calculation to after all flex children are laid out (Lines 1515-1533). Crucially, the flex algorithm signals values upward via `node._flexW` and `node._stretchH`, which preempt local sizing parameters if set.

2. **How does `estimateIntrinsicMain()` work and when is it called?**
   It's the bottom-up measurement scanner. It is invoked when containers lack explicit sizes and need to wrap their content (e.g., `width: auto` or `fit-content`). It recursively drops down the tree summing the main-axis values (`child_size + gaps + margins`) or taking the cross-axis maximum metric. Text elements fall back to exact font bounds.

3. **How does flex grow/shrink distribution work? Where does remaining space get calculated and divided?**
   Flex runs per-line. In lines 1120-1190, the layout loop totals the flex basis of all children on that line (`lineTotalBasis`). Free space `lineAvail` is equal to `mainSize - lineTotalBasis - lineGaps - lineTotalMarginMain`. If `lineAvail > 0`, it shares space proportionally to `grow / lineTotalFlex` across growing kids. If `< 0`, it inversely delegates space based on `shrink`.

4. **How do percentage widths resolve? What is `pctW` vs `pw` vs `innerW`?**
   Percentages string-match in `Layout.resolveUnit()` (e.g., `ru("25%", pctW)`).
   - `pw`: The available literal layout width slotted for a node by its parent's flex allocator (a raw number).
   - `innerW`: The usable tracking size of a container after `padL` and `padR` are subtracted.
   - `pctW`: Represents `node._parentInnerW or pw`. This ensures that `50%` means half the parent's actual content box, disregarding any flex/stretch distortions that might have arrived through `pw`.

5. **How do text nodes get their measurement constraint (the available width for wrapping)?**
   Line 726 determines standard text boxes: `outerConstraint` looks at `explicitW` or `pw`. Padding is clipped off to generate `constrainW`, which routes into `measureTextNode(node, constrainW)`. If there isn't an explicit width arraying limits on the element, the constraint defaults down or acts purely unconstrained (`0` wraps without constraint in LÖVE text APIs).

6. **How does a parent's resolved width flow down to its children as a constraint?**
   At the end of flex calculation (Lines 1464-1467), the finalized slot sizes form `cw_final` and `ch_final`. The parent signals the child layout recursively `Layout.layoutNode(child, cx, cy, cw_final, ch_final)`. `cw_final` enters the child layout as `pw`, establishing its constraint ceiling.

---

## Thesis on BUG 1: WHY flexGrow produces 0 width 
**The issue lies in asymmetric flex override signaling (Lines 1424-1430 vs Lines 1459-1461).**

When allocating space down the tree, a parent *must* signal that the main-axis width is explicitly driven by flex distribution. It does this via `child._flexW`. 
Look closely at the Row dispatch phase (Line 1425):
```lua
if isRow then
  local explicitChildW = ru(cs.width, innerW)
  if explicitChildW and cw_final ~= explicitChildW then
    child._flexW = cw_final
  ...
```
Compare that against the Column phase (Line 1458):
```lua
  elseif not isRow and ci.grow > 0 then
    child._stretchH = ch_final
```
For `flexGrow: 1` items inside a Row, children *rarely have explicit widths*. Because `explicitChildW` evaluates to `nil`, `child._flexW = cw_final` is **skipped completely**. 
As a result, inside the child's own pass, `parentAssignedW` resolves to `false` (Line 688). For generic containers, they silently fall back to `pw` and absorb space normally. But if the child is a generic Text Node or any `auto`-sizing internal surface, it shrinks directly to `w = mw + padL + padR` (Line 744) because it believes it never received an explicit width mandate. It folds and ignores all flex distribution space, giving you `w: 0` for empty items or text elements.

## Thesis on BUG 2: WHY percentage widths don't constrain text
**The issue lies in Lua truthiness masking a missing metric during unconstrained bounds checking.**

When `<Text width="25%">` is evaluated by an auto-sizing percentage wrapper, its intrinsic capacity is calculated inside `estimateIntrinsicMain`. In `estimateIntrinsicMain`, measuring horizontal extents uses `pw` (Line 507). If outer sizes are indeterminate (`nil`), parsing `ru("25%", nil)` spits out exact `0` rather than `nil`.

With `explicitW` technically set to `0` (and `0` is truthy in Lua, passing the `if explicitW then` checks), the system sets `w = 0`. As it cascades down into the Text node's constrainer:
```lua
local outerConstraint = explicitW or pw or 0
local constrainW = outerConstraint - padL - padR
-- constrainW becomes 0
```
It enters `measureTextNode(child, 0)`. The measuring hook intercepts this via `if maxWidth and maxWidth > 0 then` (Line 251 in `measure.lua`), triggering the `else` block because `0 > 0` is false. This causes Love2D to process the element natively *unconstrained* — rendering the full natural width of the unbroken logical line, completely destroying parent constraints and spilling over the screen. `__TEXT__` leaf components mirror the exact same behavior if parent container logic breaks layout signals.
