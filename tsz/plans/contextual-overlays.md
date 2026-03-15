# Contextual Overlays — Menus, Popovers, Modals, Tooltips

## What These Are

UI elements that float ABOVE everything else without disrupting layout:
- **Right-click context menu** — appears at cursor, disappears on click elsewhere
- **Popover** — anchored to a trigger element, positioned relative to it
- **Modal** — centered overlay with backdrop dimming
- **Tooltip** — small text box near hover target, auto-positioned

All share: **highest z-index, absolute positioning, no layout impact on siblings,
dismiss-on-click-outside**.

## The Problem in a Static Tree

tsz's node tree is compiled static. These overlays need to:
1. Appear/disappear dynamically (conditional rendering — already works)
2. Render ON TOP of everything (z-index or paint order)
3. Position relative to a trigger element (need computed bounds at runtime)
4. Not push other elements around (position: absolute)
5. Dismiss when clicking outside (global click handler)

## Design: Overlay Layer

All contextual overlays render in a **dedicated overlay layer** that paints AFTER
the main tree. Same concept as the inspector overlay — it sits above everything.

```
Paint order:
  1. App tree (normal layout)
  2. Overlay layer (contextual elements — menus, modals, tooltips)
  3. Inspector overlay (devtools — if active)
```

### Runtime: `tsz/runtime/overlay.zig`

```zig
const MAX_OVERLAYS = 8;

pub const OverlayKind = enum {
    context_menu,
    popover,
    modal,
    tooltip,
};

pub const Overlay = struct {
    kind: OverlayKind,
    visible: bool,
    // Position (absolute screen coords)
    x: f32,
    y: f32,
    // Anchor (for popovers — the trigger element's bounds)
    anchor_x: f32,
    anchor_y: f32,
    anchor_w: f32,
    anchor_h: f32,
    // Content
    root: ?*Node,  // the overlay's node subtree
};

var overlays: [MAX_OVERLAYS]Overlay = [_]Overlay{.{}} ** MAX_OVERLAYS;
var overlay_count: usize = 0;

pub fn show(kind: OverlayKind, x: f32, y: f32) usize;  // returns overlay ID
pub fn showAnchored(kind: OverlayKind, anchor: LayoutRect) usize;
pub fn hide(id: usize) void;
pub fn hideAll() void;
pub fn isVisible(id: usize) bool;

// Called by main loop
pub fn handleClick(mx: f32, my: f32) bool;  // returns true if click hit an overlay
pub fn render() void;  // paint all visible overlays
```

### Click-Outside Dismiss

In the main loop, overlay click handling runs FIRST (before app hit testing):
```zig
// In event loop:
if (overlay.handleClick(mx, my)) {
    continue;  // consumed by overlay
}
// ... normal app click handling
```

`handleClick` checks:
1. Is click inside any visible overlay? → route to overlay's content
2. Is click outside all overlays? → `hideAll()`, return false (pass to app)

### Auto-Positioning

**Context menu:** appears at cursor position (mx, my). Clamped to viewport edges.

**Popover:** anchored to trigger element. Position options:
- `top` — centered above anchor
- `bottom` — centered below anchor (default)
- `left` / `right` — beside anchor
- Auto-flip if would overflow viewport

```zig
pub fn positionPopover(anchor: LayoutRect, popover_w: f32, popover_h: f32,
                        preferred: Position, viewport_w: f32, viewport_h: f32) struct { x: f32, y: f32 } {
    // Try preferred position
    // If overflows viewport, flip to opposite side
    // If still overflows, clamp to viewport edge
}
```

**Modal:** centered in viewport with optional backdrop.

**Tooltip:** offset from cursor by (8, 8) pixels. Clamp to viewport.

## What the User Writes

### Context Menu
```tsx
function App() {
  const [menuVisible, setMenuVisible] = useState(0);
  const [menuX, setMenuX] = useState(0);
  const [menuY, setMenuY] = useState(0);

  return (
    <Box style={{ width: '100%', height: '100%' }}
      onRightClick={(x, y) => { setMenuX(x); setMenuY(y); setMenuVisible(1); }}>

      <Text>Right-click anywhere</Text>

      <Overlay type="context-menu" visible={menuVisible} x={menuX} y={menuY}
        onDismiss={() => setMenuVisible(0)}>
        <Box style={{ backgroundColor: '#2d2d3d', borderRadius: 8, padding: 4, width: 180 }}>
          <Pressable onPress={() => { console.log("cut"); setMenuVisible(0); }}
            style={{ padding: 8 }}>
            <Text fontSize={13} color="#ffffff">Cut</Text>
          </Pressable>
          <Pressable onPress={() => { console.log("copy"); setMenuVisible(0); }}
            style={{ padding: 8 }}>
            <Text fontSize={13} color="#ffffff">Copy</Text>
          </Pressable>
          <Pressable onPress={() => { console.log("paste"); setMenuVisible(0); }}
            style={{ padding: 8 }}>
            <Text fontSize={13} color="#ffffff">Paste</Text>
          </Pressable>
        </Box>
      </Overlay>
    </Box>
  );
}
```

### Modal
```tsx
<Overlay type="modal" visible={showModal} onDismiss={() => setShowModal(0)}>
  <Box style={{ width: 400, backgroundColor: '#1e1e2a', borderRadius: 12, padding: 24 }}>
    <Text fontSize={20} color="#ffffff">Confirm Action</Text>
    <Text fontSize={14} color="#888888">Are you sure?</Text>
    <Box style={{ flexDirection: 'row', gap: 8, marginTop: 16 }}>
      <Pressable onPress={() => setShowModal(0)} style={{ padding: 12, backgroundColor: '#333' }}>
        <Text fontSize={14} color="#ffffff">Cancel</Text>
      </Pressable>
      <Pressable onPress={() => { doThing(); setShowModal(0); }}
        style={{ padding: 12, backgroundColor: '#4ec9b0' }}>
        <Text fontSize={14} color="#ffffff">Confirm</Text>
      </Pressable>
    </Box>
  </Box>
</Overlay>
```

### Tooltip
```tsx
<Pressable
  onHoverEnter={() => showTooltip(0)}
  onHoverExit={() => hideTooltip(0)}>
  <Text>Hover me</Text>
</Pressable>

<Overlay type="tooltip" id={0} visible={tooltipVisible}>
  <Box style={{ backgroundColor: '#000000', borderRadius: 4, padding: 6 }}>
    <Text fontSize={11} color="#ffffff">This is a tooltip</Text>
  </Box>
</Overlay>
```

## Compiler Support

### `<Overlay>` Primitive

The compiler recognizes `<Overlay>` and:
1. Compiles the children normally (same JSX → Node tree)
2. Instead of adding them to the parent's children array, registers them in the overlay system
3. Emits `overlay.show()` / `overlay.hide()` calls tied to the `visible` prop
4. Positions based on `type`, `x`, `y`, or auto-anchor

### `onRightClick` Event

New event handler on Box/Pressable:
```zig
// In EventHandler struct:
on_right_click: ?*const fn (x: f32, y: f32) void = null,
```

Dispatched on `SDL_MOUSEBUTTONDOWN` with `button == SDL_BUTTON_RIGHT`.

### Modal Backdrop

When `type="modal"`, the overlay system renders a semi-transparent full-screen
rectangle BEHIND the modal content:
```zig
// backdrop: rgba(0, 0, 0, 0.5)
gpu.drawRect(0, 0, viewport_w, viewport_h, 0, 0, 0, 0.5, 0, 0, 0, 0, 0, 0);
// then render modal content centered
```

Clicking the backdrop calls `onDismiss`.

## Files

| File | Change |
|------|--------|
| `tsz/runtime/overlay.zig` | **New** — overlay registry, positioning, click-outside dismiss |
| `tsz/runtime/events.zig` | Add `on_right_click` to EventHandler |
| `tsz/compiler/codegen.zig` | Recognize `<Overlay>` primitive, emit overlay registration |
| `tsz/compiler/codegen.zig` | Recognize `onRightClick` event attribute |
| Main loop template | Overlay click dispatch before app clicks, overlay render after app paint |

## Implementation Order

1. **`overlay.zig`** — registry, show/hide, click-outside dismiss
2. **`onRightClick`** — SDL right-click event + handler wiring
3. **Context menu** — position at cursor, dismiss on outside click
4. **Modal** — centered + backdrop
5. **Tooltip** — cursor-relative, show on hover
6. **Popover** — anchor-relative with auto-flip
7. **Compiler: `<Overlay>` tag** — parse and emit

## Verification

```bash
zig build tsz-compiler && ./zig-out/bin/tsz build tsz/examples/overlay-test.tsz
```

Right-click → menu appears at cursor → click item → action + dismiss.
Button click → modal appears centered with dark backdrop → Cancel dismisses.
Hover → tooltip appears near cursor → move away → disappears.
