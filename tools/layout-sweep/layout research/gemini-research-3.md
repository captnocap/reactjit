# ReactJIT Layout Engine Analysis

This document traces the exact path a node follows during a `Layout.layoutNode(node, px, py, pw, ph)` call in the ReactJIT Lua layout engine.

## Layout Flowchart

```mermaid
flowchart TD
    Start[Layout.layoutNode called] --> CheckSkip{Display: none or Skippable?}
    CheckSkip -- Yes --> ReturnZero[Set computed w/h = 0, return]
    CheckSkip -- No --> ResolveParent[Resolve PctW / PctH from _parentInner or pw/ph]
    
    ResolveParent --> ResolveOwnDimensions[Resolve width / deferred height]
    ResolveOwnDimensions --> HandleFlexSignals{Does parent provide _flexW or _stretchH?}
    HandleFlexSignals -- Yes --> OverrideDimensions[Override width/height from flex signals]
    HandleFlexSignals -- No --> IntrinsicContent[Intrinsic Measurement for Text / Capabilities]
    IntrinsicContent --> ClampWidth[Clamp Width min/max & Re-measure Text if needed]
    
    ClampWidth --> FilterChildren[Filter Visible Children & Resolve child min/max/padding]
    FilterChildren --> PreFlexMeasure[Pre-Flex Measurement of Children]
    PreFlexMeasure --> BuildFlexLines[Split Children into Lines Wrap/NoWrap]
    
    BuildFlexLines --> FlexDistribute[Flex Grow & Shrink Distribution per Line]
    FlexDistribute --> ReMeasure{Did Flex change Text / Container width?}
    ReMeasure -- Yes --> ReMeasureText[Re-measure Text wrap & container auto-height]
    ReMeasure -- No --> CrossAxisSize[Compute Line Cross-Axis Size]
    ReMeasureText --> CrossAxisSize
    
    CrossAxisSize --> JustifyMain[Justify Content Main Axis]
    JustifyMain --> AlignCross[Align Items Cross Axis]
    AlignCross --> DispatchChildren[Set Signals & call layoutNode for Children]
    
    DispatchChildren --> AutoHeight[Deferred Auto-Height Resolution]
    AutoHeight --> ProportionalFallback[Proportional Surface Fallback for unsized nodes]
    ProportionalFallback --> ClampHeight[Clamp Final Height min/max]
    
    ClampHeight --> PositionAbsolute[Position Absolute Children]
    PositionAbsolute --> ScrollState[Compute Scroll State Bounding Box]
    ScrollState --> End[Set child.computed = {x, y, w, h}]
```

## Detailed Path Trace (layout.lua)

### 1. How width and height are resolved for a node (every possible source)
When a node starts layout, its width and height define its boundary constraints. 
*   **Percentage Baselines:** Percentage values first look for `node._parentInnerW` / `node._parentInnerH` before falling back to `pw` / `ph` (lines 628-631).
*   **Initial Width:** 
    *   Explicitly defined `width` (line 640/650) `wSource = explicit`.
    *   `width="fit-content"` calls `estimateIntrinsicMain` (line 654) `wSource = fit-content`.
    *   If no explicit width but `pw` is given, it takes `pw` (line 657) `wSource = parent`.
    *   Fallback auto-size: calls `estimateIntrinsicMain` (line 661) `wSource = content`.
*   **Initial Height:** Only explicit and `fit-content` are collected early. Auto-height resolution is deferred until after children are laid out (lines 666-669). 
*   **Aspect Ratio:** Completes a missing dimension using the other if `aspectRatio` is set (lines 672-681).
*   **Parent Flex Signals:** If a parent explicitly tells a child to be a certain size via flex distribution algorithms, these values (`_flexW`, `_stretchH`) overwrite the computed dimensions (lines 687-709).
*   **Text and Capability Node Sizing:** If dimensions are missing, Text, CodeBlock, and Capabilities fall back to measuring their actual pixel dimensions (lines 722-797). For Text nodes, the constraint is `pw - padding` or the maximum explicit width constraint available.
*   **Finalizing Dimensions:** Width is clamped via `minWidth/maxWidth` constraints (line 802). Since clamping can change a text node's width, text height is re-measured here (lines 803-810). Height is also min/max clamped (line 814).
*   **Deferred Auto-Height:** After laying out children, if `h` was still `nil`, it resolves to either `0` (for explicit scroll containers), `crossCursor + padT + padB` (for row layout), or `contentMainEnd + padB` (for column layout) (lines 1515-1532). 
*   **Proportional Fallback:** Empty visual surface nodes with zero explicit sizing eventually shrink to `parentHeight / 4` (lines 1541-1547).

### 2. How children are measured before flex distribution
Before a parent node distributes its space, it must collect the "basis" (standard operating size) for every child. (Lines 847-1054)
1.  Skips `display:none` and queues `position:absolute` children to process separately (lines 863-867).
2.  Resolves explicit dimensions for the child (`cw`, `ch`).
3.  **Text Initial Sizing:** Text children without explicit constraints are measured. If `width="fit-content"`, it is unconstrained (natural single line). Otherwise, bounded by available parent width (`innerW`) (lines 897-924).
4.  **Container Intrinsic Sizing:** Non-text children without explicit dimensions have their sizes intrinsically guessed using `estimateIntrinsicMain` recursively bottom-up (lines 934-950). *(Surprising behavior: we skip guessing intrinsic main-axis size if the child has `flexGrow > 0`. This stops large flexible-content blocks from exploding the flex-basis and forcing layout offscreen).*
5.  **Flex Basis Priority:** `flexBasis` value overrides `cw/ch`. Gap-aware percentage widths are factored in if it is wrapping and has gaps calculated (lines 1012-1031).
6.  `minContent` is computed for use in wrapping considerations (lines 1033-1040).

### 3. How flex distribution (grow/shrink) calculates final sizes
Children are split into wrapping lines (Line 1064-1110) based on `ci.basis` + `ci.minContent`.
Once split into lines, free space is distributed along the Main Axis: (Lines 1123-1190)
1.  **Calculate Availability:** Computes `lineAvail = mainSize - lineTotalBasis - lineGaps - lineTotalMarginMain`.
2.  **Flex Grow (Positive space):** If `lineAvail > 0` and `lineTotalFlex > 0`, each item adds `(ci.grow / lineTotalFlex) * lineAvail` to its `ci.basis` (items stretch).
3.  **Flex Shrink (Negative space):** If `lineAvail < 0`, the line overflows its container. It scales shrink proportions based on `ci.shrink * ci.basis`, then reduces each item's basis relative to its proportional weight of the overflow.
4.  **Re-Measurement:** Crucially, if flex-grow changes a text node's main axis, and it didn't have an explicit cross-axis, its text block wraps differently, necessitating an immediate re-measurement of the child text node's height! Container heights get similar treatment if widths adjusted (lines 1215-1274).

### 4. How percentage values resolve at each level
It fundamentally relies on a shadow property `_parentInnerW` / `_parentInnerH` passed from parent to child right before recursive execution.
*   **Parent Side Setup:** At layout resolution, parent creates `innerW = w - padL - padR` and `innerH = h - padT - padB` (lines 828-829). These inner properties are passed into the nested object representation as `child._parentInnerW` and `child._parentInnerH` (lines 1465-1466).
*   **Child Side Consumption:** At the start of the `layoutNode` call, the node prioritizes assigning `pctW` and `pctH` to the `_parentInner` constraints from its parent over the immediate boundary rect passed as arguments (`pw/ph`) (lines 628-629). `pctx` variables are heavily used in helper `ru(value, targetPct)` everywhere an absolute calculation is needed. *(Crucial: This ensures padding bounds do not warp valid child 100% percentages).*

### 5. How text measurement constraints flow from parent to child
1.  **Pre-Flex:** Parent collects constraints checking `cMaxW` against `cw` or `innerW` for outer bounds. Creates `constrainW = outerConstraint - cpadL - cpadR` and attempts a pre-flex measurement (lines 908-922).
2.  **Post-Flex:** After grow/shrink adjustments alter `ci.basis` (which equals `w` in row configurations), the parent fires a second dimension recalculation, using the new scaled `finalW` minus padding (lines 1222-1250).
3.  **On Child `layoutNode` Exec:** The final decided width block flows into the child's `layoutNode()` invocation as `pw`. The child verifies constraints against `pw`, `maxW` explicit declarations, and computes `constrainW` stripping its inner padding, processing the final text wrap bounds (lines 728-745). If child min/max pushes rules farther it repeats one last wrap measure at lines (803-810).

### 6. How `estimateIntrinsicMain()` works
Found at Lines 404-545. It is a recursive pure-measurement pass. 
*   **Text Handling:** Resolves raw font rendering scales, padding sizes, bounding constraints for the text object and calls `measureText` on `Measure`.
*   **Container Handling:** Recursively parses all visible, non-absolute children.
*   **Main Axis Accumulation:** If querying the main axis (e.g. measuring width of row), the size is the mathematical `sum` of every inner child's dimensions, inclusive of `gap` counts, plus parent padding (lines 492-517).
*   **Cross Axis Accumulation:** If querying the cross axis (e.g. measuring height of row), the size is fundamentally the `max()` of the largest single inner piece (lines 518-544). 

### 7. How the recursive call to layoutNode for children works and what gets passed
Lines 1421-1494.
The engine calculates exact Cartesian positions `cx`, `cy` depending on the `cursor` tracking, inner padding starts, margin gaps, and alignment requirements (center, end, stretch offsets).
1.  **Implicit Flex State Mutations:** The parent physically injects properties `_flexW`, `_stretchH`, `_flexGrowH` onto the child's object state model when flex adjustments mutate the original width/heights. This gives the children an explicit "overriding" dimension path down to them, preventing their independent `estimateIntrinsicMain` calls from returning size zero because they lack pre-rendered contents (lines 1421-1461).
2.  **Computed Application:** The parent stores an initial `{x: cx, y: cy, w: cw_final, h: ch_final}` to `child.computed` and executes:
    `Layout.layoutNode(child, cx, cy, cw_final, ch_final)` (line 1467).
3.  **Advance Cursor Iteration:** The cursor tracks its place alongside the child's actual computed dimensions returned and iterates offsets based on margin and gaps (lines 1469-1494).

A secondary loop at the end of the script runs layout logic explicitly just for absolute positioned children `absoluteIndices` (Lines 1569-1656).

## Potential Ambiguities and Concerns
1.  **Flex Parent State Mutations:** The Layout engine mutates child dictionary structures in-flight to send metadata signals `child._flexW = cw_final`, `child._stretchH = ch_final`. If layout runs are short-circuited or unexpectedly error mid-flight, tree models could hold corrupted stale layout measurements.
2.  **Aspect Ratio Resolution Flow (Line 957-972):** Aspect Ratio computations inside the `Filter visible children` loop rely on `explicitChildW` because previously `cw` might falsely compute truthy on 0 values returned by `estimateIntrinsicMain`. It explicitly guards against zeroes... *unless* the estimate function correctly yields a valid width, but no valid height, making the un-explicit AR flow rely entirely on content guesses recursively.
3.  **Zero-Sized Auto Scroll:** `overflow="scroll"` containers lacking explicit height values instantly set height `h = 0` (line 1515-1520), skipping cross-cursor resolution logic completely. If users wrap content in `<Box overflow="scroll">` assuming it fits to its inner extent limits, it yields an invisible block visually without flex rules forcing its boundaries out.
4.  **Min-Content Recursion Logging:** `computeMinContentW` debug variables are globally exposed mutating `_mcwDebug` based on `node.props.debugLayout`. An asynchronous or coroutine execution involving the engine might race print outputs.
