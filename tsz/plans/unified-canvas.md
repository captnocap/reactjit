# Unified Canvas Primitive — `<Canvas type="">`

## The Problem

Love2D has 23 separate visual capabilities, each with their own:
- Hit testing implementation
- Mouse/keyboard routing
- Sizing/layout integration
- Lifecycle management (create/tick/render/destroy)

That's 23 copies of the same boilerplate. In tsz, we collapse them into **one primitive**
with a `type` discriminator. The runtime handles hit testing, sizing, events, and lifecycle
once. Each canvas type only implements what's unique to it.

## What the User Writes

```tsx
<Canvas type="paint" width={400} height={300} background="#ffffff"
  onReady={() => console.log("canvas ready")} />

<Canvas type="terminal" shell="/bin/bash" style={{ flexGrow: 1 }} />

<Canvas type="video" src="movie.mp4" style={{ width: '100%' }} />

<Canvas type="led-matrix" cols={16} rows={8} color="#00ff00" pattern="heart" />

<Canvas type="spectrum" spectrumType="ir" compound="ethanol" />
```

One primitive. The `type` prop selects the renderer. Everything else passes through.

## Love2D Reference — 23 Capabilities

| # | Type | File | Lines | What it renders |
|---|------|------|-------|----------------|
| 1 | render | render.lua | 129 | Display capture, VMs, webcam |
| 2 | libretro | libretro.lua | 934 | Retro game emulation |
| 3 | paint | draw_canvas.lua | 500 | Interactive paint canvas |
| 4 | imaging | imaging.lua | 1,261 | Non-destructive image processing |
| 5 | svg-animation | svg_animation.lua | 518 | Animated SVG (reveal, morph, follow) |
| 6 | physics | physics.lua | 1,388 | Box2D 2D physics |
| 7 | led-matrix | led_matrix.lua | 339 | NxM LED dot display |
| 8 | spectrum | spectrum_view.lua | 325 | Scientific spectral data |
| 9 | pcb | pcb_board.lua | 302 | PCB board visualization |
| 10 | terminal | terminal.lua | 1,199 | PTY terminal (covered by terminal-pty plan) |
| 11 | semantic-terminal | semantic_terminal.lua | 1,859 | Classified terminal |
| 12 | bohr-model | bohr_model.lua | 394 | Atomic structure |
| 13 | molecule | structure_view.lua | 495 | Molecular visualization |
| 14 | image-process | image_process.lua | 429 | Frame-distributed resize/compress |
| 15 | phase-diagram | phase_diagram.lua | 469 | Chemistry phase plots |
| 16 | periodic-table | periodic_table.lua | 232 | Interactive periodic table |
| 17 | reaction | reaction_view.lua | 198 | Chemical reaction animation |
| 18 | reagent-test | reagent_test.lua | 354 | Test tube simulation |
| 19 | element-tile | element_tile.lua | 242 | Element card |
| 20 | element-detail | element_detail.lua | 171 | Element info panel |
| 21 | molecule-card | molecule_card.lua | 166 | Molecule display card |
| 22 | shatter | shatter.lua | 152 | Shatter animation |
| 23 | electron-shell | electron_shell.lua | 127 | Orbital visualization |

## Architecture: Canvas Registry

### Runtime: `tsz/runtime/canvas.zig`

A registry of canvas type renderers. Each type implements a simple interface:

```zig
pub const CanvasRenderer = struct {
    init_fn: *const fn (props: *const CanvasProps) void,
    tick_fn: *const fn (dt: f32) void,
    render_fn: *const fn (x: f32, y: f32, w: f32, h: f32) void,
    destroy_fn: *const fn () void,

    // Optional
    handle_key_fn: ?*const fn (sym: c_int, mod: u16) void = null,
    handle_text_fn: ?*const fn (text: [*:0]const u8) void = null,
    handle_click_fn: ?*const fn (mx: f32, my: f32) bool = null,
    handle_scroll_fn: ?*const fn (delta: f32) void = null,
    handle_mouse_fn: ?*const fn (mx: f32, my: f32) void = null,
};
```

Registry:
```zig
const MAX_CANVAS_TYPES = 32;

var type_names: [MAX_CANVAS_TYPES][]const u8 = undefined;
var type_renderers: [MAX_CANVAS_TYPES]CanvasRenderer = undefined;
var type_count: usize = 0;

pub fn register(name: []const u8, renderer: CanvasRenderer) void;
pub fn get(name: []const u8) ?*CanvasRenderer;
```

### Compiler: One `<Canvas>` Primitive

The compiler recognizes `<Canvas type="X" ...>` and emits:
1. Node with `canvas_type` field set
2. Props passed through to the renderer
3. Hit testing enabled (the canvas handles its own input)

```zig
// In Node struct (layout.zig):
canvas_type: ?[]const u8 = null,
canvas_props: ?*CanvasProps = null,
```

### Shared Behavior (handled ONCE by the canvas system)

| Behavior | How |
|----------|-----|
| **Hit testing** | Canvas nodes are always hittable. Click/hover routed to the active canvas renderer. |
| **Sizing** | Uses standard flex layout. Canvas gets its computed `w × h` passed to `render_fn`. |
| **Focus** | One canvas focused at a time. Keyboard input routes to focused canvas. |
| **Lifecycle** | `init_fn` on first render, `tick_fn` every frame, `destroy_fn` on removal. |
| **Mouse** | Click/move/scroll events translated to canvas-local coordinates before dispatch. |

This eliminates 23 copies of hit testing, sizing, and event routing.

## Implementation Phases

### Phase 1: Canvas Registry + Compiler

Create the registry and teach the compiler `<Canvas type="X">`.

**Files:**
- `tsz/runtime/canvas.zig` — registry, shared lifecycle, input dispatch
- `tsz/compiler/codegen.zig` — recognize Canvas tag, emit canvas_type field

### Phase 2: Core Canvas Types (Pure Zig)

These need direct system access and can't be .tsz:

| Type | What | Why Zig |
|------|------|---------|
| `terminal` | PTY terminal | Fork/exec, libvterm FFI |
| `video` | Video playback | libmpv FFI |
| `paint` | Drawing canvas | Pixel-level GPU texture manipulation |
| `render` | Display capture | XShm, process spawning |
| `libretro` | Game emulation | libretro C API FFI |

Register these in `canvas.zig` at init time.

### Phase 3: Composable Canvas Types (.tsz)

These are just styled Box/Text compositions — use `.tsz` and compile to `.gen.zig`:

| Type | What | Why .tsz |
|------|------|----------|
| `led-matrix` | LED grid | Boxes with computed colors |
| `periodic-table` | Element grid | Boxes + Text + click handlers |
| `element-tile` | Element card | Box + Text |
| `element-detail` | Info panel | Box + Text + ScrollView |
| `molecule-card` | Molecule display | Box + Text + Image |
| `pcb` | PCB board | Boxes with positioned elements |
| `spectrum` | Spectral plot | Boxes as bars + Text labels |
| `phase-diagram` | Phase plot | Boxes as regions + Text labels |
| `reaction` | Reaction arrows | Boxes + Text |
| `reagent-test` | Test tube | Boxes with animated colors |
| `shatter` | Shatter animation | Boxes with spring physics |
| `electron-shell` | Orbital rings | Boxes positioned in circles |

**These use classifiers for styling, .tsz for composition, and compile down via
`tsz compile-runtime`.**

### Phase 4: Physics Canvas

Box2D integration. This is its own world:
- Link `libbox2d` or use a Zig physics library
- `<Canvas type="physics">` creates a physics world
- Child elements become rigid bodies
- Positions sync back to node computed bounds each frame

Reference: `love2d/lua/capabilities/physics.lua` (1,388 lines)

### Phase 5: Domain-Specific (Deferred)

These are specialized enough to be separate plans:
- `imaging` — 40+ image operations, non-destructive pipeline (1,261 lines)
- `svg-animation` — path morphing, reveal, follow effects (518 lines)
- `bohr-model` — 2D/3D atomic visualization (394 lines)
- `molecule` — SMILES parser + 3D ball-and-stick (495 lines, needs libindigo)

## Props Convention

All canvas types share base props:
```tsx
<Canvas
  type="X"           // required — selects renderer
  width={400}        // optional — explicit size (otherwise flex)
  height={300}       // optional
  style={{...}}      // standard flex style
  onReady={() => {}} // optional — fires after init
  onError={() => {}} // optional — fires on error

  // Type-specific props pass through:
  shell="/bin/bash"  // terminal
  src="video.mp4"    // video
  cols={16}          // led-matrix
  // etc.
/>
```

The compiler doesn't validate type-specific props — they pass through to the
renderer which handles them.

## Files

**Zig (registry + system canvas types):**
| File | What |
|------|------|
| `tsz/runtime/canvas.zig` | **New** — registry, lifecycle, shared input dispatch |
| `tsz/runtime/layout.zig` | Add `canvas_type`, `canvas_props` to Node |
| `tsz/compiler/codegen.zig` | Recognize `<Canvas>`, emit type + props |

**.tsz (composable canvas types):**
| File | What |
|------|------|
| `tsz/canvas/led-matrix/` | `.tsz` + `.cls.tsz` → `.gen.zig` |
| `tsz/canvas/periodic-table/` | `.tsz` + `.cls.tsz` → `.gen.zig` |
| `tsz/canvas/spectrum/` | `.tsz` + `.cls.tsz` → `.gen.zig` |
| (etc. for each composable type) | |

## Agent Split

| Agent | Phases | What |
|-------|--------|------|
| A | 1 | Canvas registry + compiler support (foundation) |
| B | 2 | Core Zig canvas types (terminal, video, paint) |
| C | 3 | Composable .tsz canvas types (LED, periodic table, etc.) |

A first. B and C parallel after A.

## Verification

```bash
zig build tsz-compiler && ./zig-out/bin/tsz build tsz/examples/canvas-test.tsz
```

```tsx
function App() {
  return (
    <Box style={{ width: '100%', height: '100%', gap: 16, padding: 16 }}>
      <Canvas type="led-matrix" cols={16} rows={8} color="#00ff00" pattern="heart"
        style={{ width: 320, height: 160 }} />
      <Canvas type="terminal" shell="/bin/bash" style={{ flexGrow: 1 }} />
    </Box>
  );
}
```

Expected: LED matrix with heart pattern at top, bash terminal filling the rest.
Both use `<Canvas>`, both get proper hit testing, sizing, and event routing
from the same shared system.
