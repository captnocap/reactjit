# ReactJIT Layout Engine Analysis

## Complete Layout Path Execution Flow
Here is the step-by-step layout flow mapping a node from entry all the way through dimensional resolution.

```mermaid
flowchart TD
    A[Layout.layoutNode() Entry] --> B[Resolve Units and Percentages]
    B --> C{Explicit Width?}
    C -- Yes --> D[w = explicitW]
    C -- No --> E{fit-content?}
    E -- Yes --> F[w = estimateIntrinsicMain]
    E -- No --> G{Has Parent Width pw?}
    G -- Yes --> H[w = pw]
    G -- No --> I[w = estimateIntrinsicMain]
    
    D --> J[Apply Flex Overrides]
    F --> J
    H --> J
    I --> J
    
    J --> K{Has node._flexW?}
    K -- Yes --> L[w = node._flexW\nparentAssignedW = true]
    K -- No --> M[parentAssignedW = false]
    
    L --> N[Paddings Resolved]
    M --> N
    
    N --> O{Is Text Node & No explicit dimension?}
    O -- Yes --> P[Measure Intrinsic Text Dimensions]
    P --> Q{Not parentAssignedW ?}
    Q -- Yes --> R[Overwrite w = measuredW + padding]
    Q -- No --> S[Compute h = measuredH]
    O -- No --> S
    R --> S
    
    S --> T[Determine Flex/Cross Props & Collect Children]
    T --> U[Line Wrapping Algorithm]
    U --> V[Flex Distribution grow/shrink]
    V --> W[Re-Measure flex items with distributed basis]
    W --> X[Justify Content Main Axis]
    X --> Y[Align Items Cross Axis & Position Children]
    
    Y --> Z{Signal Child Flex Dimensions}
    Z --> AA[Set child._flexW if explicitChildW modified]
    AA --> AB[Set child._stretchH for column stretching]
    
    AB --> AC[Recursive Layout.layoutNode child]
    AC --> AD[Auto-Height Content Shrink-Wrap]
    AD --> AE[Surface Proportion Fallback]
    AE --> AF[Assign node.computed = x,y,w,h]
    AF --> AG[Position absolute children]
    AG --> AH[Calculate Final Scroll Content Dimensions]
```

## Bug 1: `flexGrow: 1` Produces `w: 0`
**Thesis:** 
When `flexGrow: 1` correctly calculates the expanded distributed width (`lineAvail`), the layout engine assigns this to `cw_final`. It is then supposed to signal this dynamically absorbed dimension back to the child via `_flexW` so the child knows the parent assigned its dimensions.

However, on **lines 1425-1427**, the parent uses:
```lua
local explicitChildW = ru(cs.width, innerW)
if explicitChildW and cw_final ~= explicitChildW then
  child._flexW = cw_final
end
```
Because the flex item uses `flexGrow: 1` and has NO explicit `width` defined, `explicitChildW` remains `nil`. Consequently, the parent **never sets `child._flexW`**, which leaves the `parentAssignedW` flag evaluating to `false` when the child's `layoutNode()` triggers.

Later in the child's execution (**lines 743-747**), if the child happens to be a text node or contains one whose measurement fails to evaluate to the container size, the layout engine executes:
```lua
if not explicitW and not parentAssignedW then
  w = mw + padL + padR
end
```
Because `parentAssignedW` is `false`, the text completely discards `cw_final` (which safely fell back to `pw`) and overwrites its own width `w` with its *intrinsic measure constraint `mw`*. If the string is empty or small, the node drastically shrinks to its content, ignoring the flex container's instruction to absorb the remaining space.

## Bug 2: Percentage Widths Don't Constrain Text (`width: '25%'`)
**Thesis:** 
The issue occurs strictly when a container does not have an explicit dimension and relies on `estimateIntrinsicMain` to size itself. In `estimateIntrinsicMain()`, the function loops through children recursively calculating auto-measured dimensions to define its own constraint bounds.

However, since the parent is auto-sizing, the `pw` (parent width) context passed downward evaluates to `nil`. On **line 507**:
```lua
local explicitMain = isRow and ru(cs.width, pw) ...
```
When `cs.width` is `"25%"` and `pw` is `nil`, the internal `ru(cs.width, nil)` percentage resolution returns `nil`. Because it returns `nil`, the code treats it natively as an unconstrained child and falls to the `else` case, dispatching another recursive `estimateIntrinsicMain()` down text nodes.

During this deeper text dimension estimation step, `pw/wrapWidth` fundamentally equals `nil` because no container constraints are passed. It subsequently calls `measureTextNode(text, fontSize, nil)` (**line 450**), prompting love2d text functions to compute the **unconstrained, single-line natural dimension**. 

This effectively stretches the parent container horizontally to fit the *entire* unconstrained text block. During the active layout phase, `25%` of an exceptionally large parent bounds ends up being far too wide, failing to visually restrict the text limits!

## Key Code Paths Involved
- `layout.lua` **Line 1425 - 1427**: Failure to set `child._flexW` for nodes with `grow` but no explicit `width`, dropping the `parentAssignedW` signal.
- `layout.lua` **Line 743 - 747**: Hard overwrite of `w` during intrinsic layout execution based on `parentAssignedW`.
- `layout.lua` **Line 507 - 513**: Failure in resolving `ru()` to evaluate percentages cleanly to constraint dimensions for auto-sizing estimations. 
- `layout.lua` **Line 450**: Passing `wrapWidth=nil` due to lost dimension estimations, inflating container blocks naturally.
