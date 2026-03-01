# Tooltip Systems in ReactJIT

Three tooltip placement patterns, one unified Lua-owned system.

---

## Pattern 1: Cursor-Relative

The tooltip floats directly next to the thing you're hovering. It anchors to the pixel position of the hovered element or word, with smart edge detection — prefers above, flips below if no room, clamps horizontally to stay in bounds.

**Existing implementation:** TextEditor hover tooltips (`lua/texteditor.lua`).

**Behavior:**
- Lua tracks mouse position every frame via `es.lastMouseX/Y`
- `screenToPos()` converts pixels to logical position (line, col), `tokenAtPos()` finds the token under the cursor
- Hover timer accumulates `dt` each frame on the same target. After **0.4 seconds**, tooltip becomes visible
- Moving to a new target: old tooltip vanishes instantly, timer resets to 0
- Moving off all targets: tooltip vanishes, state clears

**Rendering:**
- Drawn in the paint pass **after** the scissor is restored — floats above all clipped content
- Positioned using font metrics: `font:getWidth(text:sub(1, col))` gives exact X, `line * lineHeight` gives Y
- Clamped: `math.max(areaX + 4, math.min(wordX, areaX + areaW - boxW - 4))`
- Flip logic: if `tooltipY < areaTop`, render below the word instead of above
- Rounded rect bg (radius 6, 95% opacity), 1px border, word-wrapped text inside

**Strengths:**
- Spatially intimate — the explanation is right next to the thing it describes
- Good for dense content where elements are close together (code, forms, data grids)
- Pixel-accurate positioning using layout results Lua already has

**Weakness:**
- Can obscure nearby content, especially in tight layouts
- Position jumps as you move between targets

---

## Pattern 2: Anchor-Relative

The tooltip is positioned relative to the parent element's edge — not the cursor. It sits at a fixed offset from one of the four sides: top, bottom, left, right.

**Existing implementation:** ChartTooltip (`packages/core/src/ChartTooltip.tsx`) — currently React-owned, needs to move to Lua.

**Behavior:**
- Parent element declares which edge to anchor on (`top`, `bottom`, `left`, `right`)
- Tooltip appears centered on that edge with a small gap (4px)
- No cursor tracking — position is deterministic from the parent's layout rect

**Positioning (per anchor):**

| Anchor | X | Y |
|--------|---|---|
| `top` | parent center X - tooltip half W | parent Y - tooltip H - gap |
| `bottom` | parent center X - tooltip half W | parent Y + parent H + gap |
| `left` | parent X - tooltip W - gap | parent Y |
| `right` | parent X + parent W + gap | parent Y |

**Strengths:**
- Predictable — tooltip always appears in the same spot relative to the element
- Good for labeled UI elements (buttons, icons, chart segments) where you want a stable callout
- No jitter from cursor movement within the element

**Weakness:**
- Can clip if parent is near a window edge (needs boundary clamping)
- Can't adapt to cursor position within large elements
- Fixed to one edge — if something is above, you can't show the tooltip above too

---

## Pattern 3: Corner-Fixed

The tooltip appears in one of the four window corners. It doesn't track the cursor or the element. The hovered element triggers it; the corner displays it.

**No existing implementation.** This is new.

**Behavior:**
- Hover detection works the same as cursor-relative: Lua's hit-test identifies the node, timer accumulates
- But the tooltip renders at a fixed screen position: one of the four corners, inset by a margin

**Positioning:**

| Corner | X | Y |
|--------|---|---|
| `top-left` | margin | margin |
| `top-right` | windowW - boxW - margin | margin |
| `bottom-left` | margin | windowH - boxH - margin |
| `bottom-right` | windowW - boxW - margin | windowH - boxH - margin |

No clamping needed. No flip logic. The corner is always the corner.

**Strengths:**
- Never obscures the hovered element — the description is far from the cursor
- Stable reading position — the user's eyes learn where to look
- Works at any window size, any zoom level
- Can hold longer content (the corner has predictable available space)
- No visual noise — a single quiet region updates, the rest of the UI is untouched

**Weakness:**
- Spatial disconnect — the explanation isn't next to the thing it describes
- The user must glance away from where they're looking
- Less useful for dense grids where spatial proximity matters

---

## What All Three Share (The Non-Negotiables)

These are the properties that make a tooltip correct in ReactJIT, regardless of placement pattern:

1. **Lua-owned.** The tooltip is not a React node. It doesn't exist in the instance tree. It never triggers reconciliation, layout, or tree mutation. It's paint-level decoration.

2. **Drawn in an overlay pass.** After all tree painting is done, after all scissors are restored. A tooltip can never be clipped by a parent's overflow. It floats above everything.

3. **Delay.** Default 0.4 seconds. Timer accumulates real `dt` each frame. No setTimeout, no effects, no state cycles. Deterministic and smooth. Override with `delay` on any tooltip.

4. **Instant reset.** Moving to a new target kills the old tooltip immediately and starts a fresh timer. Moving off all targets clears everything. No fade-out, no lingering.

5. **Single active tooltip.** Only one tooltip is visible at a time. Last-hovered-wins. No stacking.

6. **React declares, Lua executes.** The React side is a prop. The Lua side does everything else — hit detection, timing, positioning, rendering.

7. **Uniform visual style.** Every tooltip looks the same regardless of type or placement. Same background, same border, same text rendering, same border radius. The type controls *where* it appears, not *how* it looks. Style overrides exist but the default is one consistent treatment.

8. **No truncation by default.** Text wraps. Content flows. Truncation is an opt-in behavior you enable explicitly when you want it, not something that silently eats your content.

9. **Absolute viewport clamping — zero clipping, ever.** The tooltip must be fully visible within the window at all times. No edge of the tooltip box may extend beyond the window boundary — not by 1 pixel. This is not a best-effort clamp. It is a hard constraint enforced at the positioning step before draw. Every placement type must resolve to final `(x, y)` coordinates that satisfy: `x >= margin`, `y >= margin`, `x + boxW <= windowW - margin`, `y + boxH <= windowH - margin`. If the natural position violates any edge, the tooltip relocates — it does not clip. For cursor-relative: flip above/below, then clamp horizontally. For anchor-relative: try the opposite edge, then clamp. For corner-fixed: the math is inherently safe but the margin inset still applies. The draw pass must also clear any active scissor rect before painting. The tooltip lives outside all clipping regions — it is the last thing drawn, on top of everything, with `love.graphics.setScissor()` called with no arguments to disable all clips.

---

## Unified Tooltip API

### The Usage Spectrum

Tooltips scale from one-liner to fully specified. The simplest case is the most common. Every parameter has a sensible default. You only spell out what you're changing.

```tsx
// ── Minimal: just content ──────────────────────────────────
// Type defaults to 'cursor'. Layout defaults to 'compact'.
// No truncation. 0.4s delay. Default style.
<Box tooltip="Navigation sidebar" />

// ── Common: type + layout + content ────────────────────────
// Corner placement, dense layout for lots of data
<Box tooltip={{
  content: "CPU: 82%\nMem: 4.2GB\nSwap: 0.1GB\nUptime: 14d",
  type: 'corner',
  layout: 'dense',
}} />

// ── Verbose: everything specified ──────────────────────────
// Anchor placement, custom delay, truncation on, table layout,
// style overrides on the layout itself
<Box tooltip={{
  content: "Sidebar container — holds navigation links, user avatar, collapse toggle",
  type: 'anchor',
  anchor: 'right',
  layout: 'table',
  truncate: true,
  delay: 0.1,
  style: { maxWidth: 400 },
}} />
```

### Type (placement)

Controls *where* the tooltip renders. Always defaults to `'cursor'`.

| Type | Behavior | Default |
|------|----------|---------|
| `'cursor'` | Floats near the hovered element, prefers above, flips below if clipped | **This is the default** |
| `'anchor'` | Fixed to parent element edge. Requires `anchor` sub-prop | — |
| `'corner'` | Fixed to a window corner. Requires `corner` sub-prop | — |

```typescript
type: 'cursor' | 'anchor' | 'corner'  // default: 'cursor'
```

### Layout (content formatting)

Controls *how* the content is arranged inside the tooltip box. Layouts are not style opinions — they are structural formulas that organize content. You can pass style overrides onto any layout.

| Layout | Purpose | Structure |
|--------|---------|-----------|
| `'compact'` | Short label or single line. The default. | Single text block, auto-wraps |
| `'descriptive'` | Title + explanation. For teaching. | Bold title line, body text below with smaller font |
| `'dense'` | Lots of key-value data crammed in. System monitors, debug info, stat blocks. | Monospace, tight line spacing, no wrapping — each `\n` is a row |
| `'table'` | Structured rows with alignment. Data readouts, property inspectors. | Two-column grid: labels left-aligned dim, values right-aligned bright |

Layouts are formulas, not styles. A layout says "title on top, body below, smaller font for body." It doesn't say "blue text" — that's what the style override is for. Layouts accept style as input so you can tint, resize, or recolor the structure without redefining it.

```typescript
layout: 'compact' | 'descriptive' | 'dense' | 'table'  // default: 'compact'
```

### Content

The thing being displayed. Always a string. Layouts interpret the string differently:

- `'compact'`: renders as-is, word-wrapped
- `'descriptive'`: first line becomes the title, rest becomes the body. Separated by `\n`
- `'dense'`: each `\n` is a literal row, no wrapping
- `'table'`: each `\n` is a row, each row split on the first `:` or `\t` into label and value

```tsx
// compact — just wraps
tooltip="This is a sidebar"

// descriptive — first line bold, rest normal
tooltip={{ content: "Sidebar\nHolds navigation links and user settings", layout: 'descriptive' }}

// dense — monospace rows
tooltip={{ content: "CPU: 82%\nMem: 4.2GB\nGPU: 45°C", layout: 'dense' }}

// table — aligned key:value
tooltip={{ content: "Width:\t240px\nHeight:\t100%\nGrow:\t1", layout: 'table' }}
```

### Truncation

**Off by default.** Text wraps and the tooltip grows to fit. Truncation is explicitly enabled when you know the content might be long and you want to cap it.

```typescript
truncate: boolean       // default: false
maxLines?: number       // only applies when truncate is true, default: 3
```

When `truncate` is true and content exceeds `maxLines`, the last visible line ends with `...`. The tooltip box stops growing.

### Delay

How long the cursor must hover before the tooltip appears. In seconds. Override per-tooltip.

```typescript
delay: number           // default: 0.4
```

```tsx
// Instant (useful for toolbar icons where the user is hunting)
<Box tooltip={{ content: "Save", delay: 0 }} />

// Slow (useful for ambient annotations that shouldn't distract)
<Box tooltip={{ content: "This panel auto-refreshes every 30s", delay: 1.5 }} />
```

### Style

Optional overrides applied onto the layout. Does not replace the layout's structure — injects into it. The layout decides which style properties apply to which part of its structure.

```typescript
style?: {
  maxWidth?: number;          // override the default max width (300)
  fontSize?: number;          // override base font size
  fontFamily?: string;        // override font
  color?: string | number[];  // override text color
  backgroundColor?: string | number[];  // override bg
}
```

Style is the escape hatch. The defaults are correct for 95% of cases. When you need a wider tooltip for a table layout, or a smaller font for dense data, style lets you do that without creating a new layout.

### Full Type Definition

```typescript
type TooltipProp = string | {
  content: string;

  // Placement
  type?: 'cursor' | 'anchor' | 'corner';           // default: 'cursor'
  prefer?: 'above' | 'below';                       // cursor only, default: 'above'
  anchor?: 'top' | 'bottom' | 'left' | 'right';    // anchor only, default: 'top'
  corner?: 'top-left' | 'top-right'
         | 'bottom-left' | 'bottom-right';           // corner only, default: 'bottom-left'

  // Content formatting
  layout?: 'compact' | 'descriptive' | 'dense' | 'table';  // default: 'compact'
  truncate?: boolean;                                        // default: false
  maxLines?: number;                                         // truncate only, default: 3

  // Timing
  delay?: number;                                   // seconds, default: 0.4

  // Style overrides (applied onto the layout)
  style?: {
    maxWidth?: number;
    fontSize?: number;
    fontFamily?: string;
    color?: string | number[];
    backgroundColor?: string | number[];
  };
};
```

The string shorthand `tooltip="text"` is equivalent to `tooltip={{ content: "text" }}` — cursor type, compact layout, no truncation, 0.4s delay, default style.

---

## What Lua Does With It

Every frame, in the existing hit-test pass:

1. **Read.** The hit-test already identifies which node the mouse is over. Check if that node has a `tooltip` prop. If not, clear tooltip state and stop.

2. **Parse.** Normalize the prop — string becomes `{ content = str, type = "cursor", layout = "compact" }`. Object fills in defaults for missing fields. Cache the parsed result on the node so it's not reparsed every frame.

3. **Timer.** If same node as last frame, accumulate `dt`. If different node, reset to 0 and store new node reference. If timer < delay, stop here.

4. **Format.** Once timer crosses the delay threshold, run the content through the layout formatter:
   - `compact`: word-wrap content into lines that fit within maxWidth
   - `descriptive`: split on first `\n`, format line 1 as title (bold, slightly larger), rest as body (normal, slightly smaller), word-wrap both
   - `dense`: split on `\n`, no wrapping, monospace font, tight line height
   - `table`: split on `\n`, split each line on first `:` or `\t`, measure label column width, align values
   - If `truncate` is true, cap at `maxLines` and append `...` to last line

5. **Position.** Compute the tooltip box position based on `type`. The formatted content from step 4 gives us the final `boxW` and `boxH`. All three types must produce a final `(tooltipX, tooltipY)` that keeps the entire box inside the window with a margin inset.

   - `cursor`: start above the node's layout rect, centered on the element. If `tooltipY < margin`, flip below. Clamp X so `tooltipX >= margin` and `tooltipX + boxW <= windowW - margin`.
   - `anchor`: start at the configured edge offset from the node's layout rect. If the box would breach any window edge, try the opposite anchor edge. Then clamp both axes.
   - `corner`: `margin` inset from the configured corner. Inherently safe but the margin still applies.

   After type-specific logic, run the **universal clamp** — this is not optional, it runs for every type every frame:
   ```
   tooltipX = math.max(margin, math.min(tooltipX, windowW - boxW - margin))
   tooltipY = math.max(margin, math.min(tooltipY, windowH - boxH - margin))
   ```
   If the tooltip box is larger than the window minus margins (edge case: massive content, tiny window), it pins to top-left and the content overflows downward. This is the only scenario where content can be partially hidden, and it's the caller's problem for putting a novel in a tooltip.

6. **Draw.** In a final overlay pass, after all tree painting is complete:
   - **Clear all scissors.** Call `love.graphics.setScissor()` with no arguments. The tooltip is not part of any clipping hierarchy. It must not inherit a scissor from a ScrollView, a panel, or any ancestor. This is the single most important line in the draw function.
   - Draw: rounded rect background, 1px border, formatted content lines. Same visual chrome for all types — uniform appearance regardless of placement.
   - After drawing, restore the previous scissor state if the caller expects it (though as the last overlay pass, there typically isn't one).

### Module interface

```
lua/tooltips.lua
  .update(hoveredNode, dt, mx, my)  -- called each frame with hit-test result
  .draw(windowW, windowH)           -- called after all tree painting
```

Two functions. No state leaks into the instance tree. No bridge calls. No React lifecycle.

---

## What React Never Does

- No `useState` for hover tracking
- No `onPointerEnter` / `onPointerLeave` handlers for tooltip visibility
- No conditional rendering (`visible ? <Tooltip> : null`)
- No `position: 'absolute'` nodes in the tree for tooltip chrome
- No `setTimeout` for delay logic
- No `useEffect` for cleanup

The tooltip prop is inert metadata on the React node. It flows through the reconciler into the Lua tree as a prop value. Lua reads it. React forgets about it.

---

## Migration Rule (NON-NEGOTIABLE)

When this system is built, every existing tooltip in the codebase must be migrated to it. There is one tooltip system. This is it.

- **TextEditor hover tooltips** (`lua/texteditor.lua`) — the hover detection, delay timer, dictionary lookup, and paint-pass rendering must be refactored to use `lua/tooltips.lua`. The TextEditor calls `Tooltips.update()` and `Tooltips.draw()` instead of doing its own hover tracking and rendering. The tooltip dictionary (`texteditor_tooltips.lua`) stays as-is — it feeds content into the unified system, it doesn't bypass it.

- **ChartTooltip** (`packages/core/src/ChartTooltip.tsx`) — deleted. Every usage (BoxBasic story, chart components, anything else) gets replaced with the `tooltip` prop. `<ChartTooltip visible={...} anchor="top">` becomes `<Box tooltip={{ content: "...", type: 'anchor', anchor: 'top' }}>`. The React component ceases to exist.

- **Inspector tooltips** (`lua/inspector.lua`, `lua/devtools.lua`) — if they draw their own tooltip-like overlays, they use `lua/tooltips.lua`. Same delay, same chrome, same viewport clamping.

- **Any future tooltip** — if you are implementing something and you find yourself drawing a rounded rect with text near the cursor after a hover delay, you are reimplementing this system. Stop. Use `lua/tooltips.lua`. There are no special cases. There are no "it's just a small one-off" exceptions. One system, one draw path, one set of rules.

If during implementation you discover an existing tooltip mechanism that isn't listed above, it is not a new type — it is a migration target. Convert it.
