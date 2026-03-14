# Rendering Gaps — borderRadius, Gradients, Transforms, Ellipsis

## What's Done (layout claude's 4 commits)

All layout/measure/style parity is complete. These 4 items are **rendering-only** — the layout engine already has the data, the painter just can't draw it yet.

## Item 1: borderRadius (SDL2 lacks rounded rects)

**Problem:** SDL2's `SDL_RenderFillRect` only draws sharp rectangles. `borderRadius` is in the Style struct and flows through layout, but the painter ignores it.

**Approach: Quadrant circle + center rects**

Draw a rounded rect as 5 filled rects + 4 filled circles (quarter circles):

```
  ┌──────────┐
  │ TL  top  TR │   TL/TR/BL/BR = filled circles at corners
  │  ┌──────┐  │   top/bottom/left/right/center = filled rects
  │L │center│ R│
  │  └──────┘  │
  │ BL  bot  BR │
  └──────────┘
```

SDL2 doesn't have circle primitives either, but you can:

**Option A: Pre-rendered circle texture.** Create a small white filled circle texture at init (e.g., 64x64). Scale and tint it for each corner. Fast, GPU-accelerated, slight quality loss at very large radii.

**Option B: Bresenham circle with SDL_RenderDrawPoint.** CPU-side, pixel by pixel. Slow for large radii but pixel-perfect.

**Option C: OpenGL direct.** You're already linking GL. Draw a rounded rect as a triangle fan with arc vertices at corners. Best quality, best performance, but requires switching from SDL_Renderer to raw GL calls for this primitive.

**Recommendation: Option A** (circle texture). It's what Love2D does internally for rounded rects — pre-render a quarter circle, blit 4 copies + fill center. Fast, simple, good enough for UI.

Reference: `love2d/lua/painter.lua` — Love2D uses `love.graphics.rectangle("fill", x, y, w, h, rx, ry)` which handles this internally.

### Implementation

```zig
// At init: create a 32x32 white filled circle texture
var circle_tex: ?*c.SDL_Texture = null;

fn initCircleTexture(renderer: *c.SDL_Renderer) void {
    // Create 32x32 RGBA surface, fill with circle pixels
    // SDL_CreateTextureFromSurface
}

fn fillRoundedRect(renderer: *c.SDL_Renderer, x: f32, y: f32, w: f32, h: f32, r: f32, color: Color) void {
    const radius = @min(r, @min(w, h) / 2.0); // clamp to half size
    // Fill center rect (full width, minus top/bottom radius)
    // Fill top/bottom strips (between corners)
    // Blit 4 quarter-circle textures at corners (tinted with SDL_SetTextureColorMod)
}
```

**File:** `tsz/runtime/main.zig` (or a new `painter.zig` module) — add `fillRoundedRect`, call it instead of `SDL_RenderFillRect` when `borderRadius > 0`.

## Item 2: Gradients

**Problem:** No gradient support in SDL2's 2D renderer. Need multi-color fills.

**Approach: Horizontal/vertical stripe approximation**

For linear gradients, draw N thin filled rects (1-2px each), each with a lerped color between start and end. At 1px per stripe, a 400px tall gradient is 400 draw calls — fine for 60fps.

```zig
fn fillGradient(renderer: *c.SDL_Renderer, x: f32, y: f32, w: f32, h: f32,
                color_top: Color, color_bottom: Color) void {
    const steps: u32 = @intFromFloat(h);
    var i: u32 = 0;
    while (i < steps) : (i += 1) {
        const t: f32 = @as(f32, @floatFromInt(i)) / @as(f32, @floatFromInt(steps));
        const c = lerpColor(color_top, color_bottom, t);
        _ = c.SDL_SetRenderDrawColor(renderer, c.r, c.g, c.b, c.a);
        var rect = c.SDL_Rect{ .x = @intFromFloat(x), .y = @intFromFloat(y) + @as(c_int, @intCast(i)), .w = @intFromFloat(w), .h = 1 };
        _ = c.SDL_RenderFillRect(renderer, &rect);
    }
}
```

**Style API:**
```tsx
<Box style={{ background: 'linear-gradient(#1e1e2a, #2d2d3d)' }}>
```

Or simpler for v0:
```tsx
<Box style={{ backgroundGradient: ['#1e1e2a', '#2d2d3d'], gradientDirection: 'vertical' }}>
```

**Defer if needed.** Gradients are nice-to-have, not blocking. borderRadius and ellipsis are more impactful.

## Item 3: Transforms (SDL2 has no transform stack)

**Problem:** CSS transforms (translate, rotate, scale) need a matrix stack. SDL2's 2D renderer has `SDL_RenderSetScale` and `SDL_RenderCopyEx` (rotation for textures) but no general transform stack.

Reference: `love2d/lua/painter.lua:666-720` — Love2D uses `love.graphics.push()`, `translate()`, `rotate()`, `scale()`, `pop()`. This is OpenGL matrix stack under the hood.

**Approach: OpenGL direct**

tsz already links OpenGL. The painter currently uses SDL_Renderer (which uses GL internally). For transforms:

**Option A: Switch to raw OpenGL for transformed nodes.** When a node has a transform, push a GL matrix, apply translate/rotate/scale, render children, pop. This is what Love2D does.

```zig
if (node.style.transform) |tf| {
    c.glPushMatrix();
    // Origin point
    const ox = screen_x + tf.origin_x * node.computed.w;
    const oy = screen_y + tf.origin_y * node.computed.h;
    c.glTranslatef(ox, oy, 0);
    if (tf.rotate != 0) c.glRotatef(tf.rotate, 0, 0, 1);
    if (tf.scale_x != 1 or tf.scale_y != 1) c.glScalef(tf.scale_x, tf.scale_y, 1);
    c.glTranslatef(-ox, -oy, 0);
    if (tf.translate_x != 0 or tf.translate_y != 0) c.glTranslatef(tf.translate_x, tf.translate_y, 0);
    // ... render node + children ...
    c.glPopMatrix();
}
```

**Complication:** Mixing SDL_Renderer calls with raw GL calls can be fragile. SDL_Renderer maintains its own GL state. You'd need to flush SDL's batch before/after GL calls.

**Option B: Render-to-texture + SDL_RenderCopyEx.** Render the subtree to an offscreen texture, then blit it with rotation/scale via `SDL_RenderCopyEx`. Supports rotation and scale but not skew. Performance cost for the extra render target.

**Recommendation: Defer transforms.** They're the most complex item and least impactful for typical UI. borderRadius and ellipsis cover 90% of visual polish needs. Transforms matter for animations (Phase 4b of the animation plan) and can land alongside that work.

## Item 4: Text Truncation with Ellipsis

**Problem:** Long text that overflows its container should show `"This is a long te..."` instead of being clipped mid-character. The measurement code in `text.zig` already measures text width — the painter just needs to truncate and append "...".

**Approach:**

```zig
fn drawTextTruncated(self: *TextEngine, text: []const u8, x: f32, y: f32,
                      size_px: u16, max_w: f32, color: Color) void {
    const full = self.measureText(text, size_px);
    if (full.width <= max_w) {
        // Fits — render normally
        self.drawText(text, x, y, size_px, color);
        return;
    }
    // Measure "..."
    const ellipsis_w = self.measureText("...", size_px).width;
    const avail = max_w - ellipsis_w;
    if (avail <= 0) {
        self.drawText("...", x, y, size_px, color);
        return;
    }
    // Binary search for truncation point (or linear scan)
    var end: usize = text.len;
    while (end > 0) {
        // Walk back to UTF-8 boundary
        end = utf8PrevBoundary(text, end);
        const w = self.measureText(text[0..end], size_px).width;
        if (w <= avail) break;
    }
    // Draw truncated text + ellipsis
    self.drawText(text[0..end], x, y, size_px, color);
    const trunc_w = self.measureText(text[0..end], size_px).width;
    self.drawText("...", x + trunc_w, y, size_px, color);
}
```

**Style API:** `numberOfLines: 1` on a Text node triggers truncation. Already in the Style struct from the layout audit.

**Integration:** In the painter, when rendering a text node with `numberOfLines == 1` and text overflows width, call `drawTextTruncated` instead of `drawTextWrapped`.

For multi-line truncation (`numberOfLines: 3`): render up to N lines, truncate the last line with ellipsis. The wrapping code already tracks line count.

## Files

| File | Change |
|------|--------|
| `tsz/runtime/text.zig` | Add `drawTextTruncated()`, ellipsis logic |
| `tsz/runtime/main.zig` or painter template | Add `fillRoundedRect()` with circle texture, gradient helper |
| `tsz/runtime/layout.zig` | Already has all style fields — no changes needed |
| `tsz/compiler/codegen.zig` | May need `numberOfLines` wired (check if already emitted) |

## Priority Order

1. **Ellipsis** — easiest, highest impact, text-only change in `text.zig`
2. **borderRadius** — medium effort, high visual impact, circle texture approach
3. **Gradients** — easy (stripe rects) but low priority
4. **Transforms** — hardest, defer to animation plan Phase 4b

## Agent Split

| Agent | Items | Files |
|-------|-------|-------|
| A | Ellipsis + borderRadius | `text.zig`, painter in templates |
| B | Gradients (if time) | painter in templates |

Transforms deferred — lands with animation work.

## Verification

```bash
zig build tsz-compiler && ./zig-out/bin/tsz build tsz/examples/rendering-test.tsz
```

Test .tsz with:
- Long text in a narrow Box (should show "...")
- Box with `borderRadius: 16` (should have rounded corners)
- Box with gradient background (should fade between colors)
