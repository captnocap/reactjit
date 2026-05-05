# GPU-Driven Animation (exploration)

A future optimization for animations that need to scale beyond what
`useHostInterval` (host-CPU-driven latches) can comfortably handle.
This is not on the roadmap yet — captured here so the next person
considering it has the context, the size estimate, and the failure
mode for "do we even need this?"

---

## Motivation

`useHostInterval` (the next step we're shipping) closes the JS-driven
RAF gap by moving the per-frame animation tick into the Zig painter
loop. Per-frame work becomes:

1. Painter calls `animations.tickAll(now_ms)`
2. For each registered animation: compute `eased = curve(t)`, `value = lerp(from, to, eased)`, write to latch buffer
3. `syncLatchesToNodes` writes latches into `node.style.X`
4. Painter draws

Steps 2 and 3 still cost Zig CPU per frame. For ~20 animated things
(Easings) that's basically free. For ~1000 (the chart_stress shape,
data viz, particle systems, animated grids) the per-frame Zig CPU
work starts to add up — tens of microseconds → milliseconds at the
top end.

GPU-driven animation eliminates ALL per-frame CPU work for the
moving things. The painter sets a single `uniform float u_time`
per frame. The vertex shader computes each quad's position from
its baked-in start/end/curve params + the global time.

## What it would look like

### Cart-side primitive

A new primitive (or a flag on Box) that the painter recognizes as
GPU-animated:

```tsx
<AnimatedQuad
  startPos={{ x: 0, y: 0 }}
  endPos={{ x: 200, y: 100 }}
  curve="easeInOut"
  durationMs={1800}
  loop="cycle"
  size={{ w: 6, h: 6 }}
  color="theme:atch"
/>
```

The cart never touches per-frame state for this quad. Mount once,
the GPU handles the rest until unmount.

### Painter pipeline

A second draw pipeline alongside the normal Box pipeline:
- Per-instance attributes: `start_x, start_y, end_x, end_y, duration, curve_id, loop_mode, w, h, color_rgba`
- One uniform buffer: `u_time` (monotonic ms since cart start)
- Vertex shader does:
  ```wgsl
  let t = fract(u_time / inst.duration);
  let eased = applyCurve(inst.curve_id, t);
  let pos = mix(inst.start, inst.end, eased);
  // ... transform pos to clip space, output
  ```

### Shader work

Port `framework/easing.zig` to WGSL — basically a `switch (curve_id)`
over the easing functions. `framework/gpu/effect_math.wgsl` already
mirrors `math.zig`, so the precedent for this is in place.

### Painter dispatch

When the painter walks the node tree, it routes each node:
- Normal Box → existing pipeline
- AnimatedQuad → new instanced-animated pipeline (collect all
  AnimatedQuads of a frame, draw as one instanced batch)

Per-frame CPU cost for N AnimatedQuads: **one uniform write**,
regardless of N. The GPU does N-quads worth of math per frame, but
that's exactly what it's for.

## Size estimate

Maybe 200-400 lines, contained:
- `framework/gpu/anim_pipeline.wgsl` — vertex/fragment shader (~50 lines)
- `framework/gpu/anim_pipeline.zig` — pipeline setup, instance buffer mgmt (~150 lines)
- `framework/animated_quad.zig` — node primitive type, CRUD (~50 lines)
- v8 bindings: `__animated_quad_create / _update / _destroy` (~50 lines)
- `runtime/hooks/useAnimatedQuad.ts` (~30 lines)
- New `<AnimatedQuad>` JSX primitive (~10 lines)

Plus a Zig binary rebuild.

## When this is worth doing

Indicator: useHostInterval is at its ceiling and the per-frame Zig
CPU cost of `tickAll` is showing up in profiling.

Concrete shapes that hit that ceiling:
- Particle systems (hundreds-thousands of particles)
- Animated data viz with thousands of independently-moving points
  (the chart_stress 1000-bars scenario, sweep across a dataset)
- Per-character text animations (typewriter, glitch, wave) where
  each character is its own animated quad
- Animated grid backgrounds with N×M cells each pulsing
- Long lists of items entering/exiting with stagger animations on
  large screens

Indicators that you DON'T need it:
- ≤ ~100 simultaneous animated things
- Animations that are mostly UI accents (buttons, transitions, dots)
- Anything where useHostInterval is already pegging vsync

For typical app UI, useHostInterval is enough. This is for the
"feels like a game engine" tier of motion density.

## Risk / unknowns

1. **Pipeline switching cost** — the painter would have two pipelines
   per frame; switching between them per node is more expensive than
   one batched pipeline. Likely mitigated by collecting all
   AnimatedQuads and drawing them as one instanced batch at the
   end of the frame, but worth measuring.
2. **Z-order interaction** — AnimatedQuads drawn in their own batch
   means they all draw at the same depth slot. If they need to
   interleave with normal Boxes (say, an animated dot ON TOP of a
   chart that has hover labels above it), need either depth values
   per instance or multiple pipeline-switches per frame.
3. **WGSL easing fidelity** — bit-exact matching between
   `easing.zig` and the WGSL port is unlikely (different float
   semantics, different math libs). The dot positions might be
   off-by-tiny-amounts from the CPU version. Probably invisible,
   worth confirming.
4. **Curve evolution** — adding a new easing function means updating
   both `easing.zig` and the WGSL. Drift risk.

## What `useHostInterval` already gets us

For comparison, when sizing this against the alternative:
- ~250-280fps on Easings (predicted, based on closing the ~5ms
  unaccounted JS RAF gap from the 185fps Combined number).
- Zero JS per frame.
- Smooth animation under JS thread load (since the painter loop
  doesn't depend on JS).
- Works for any latch-bound style prop (left, top, width, height,
  right, bottom — all wired in v8_app.zig:applyLatchOrPct).

For the realistic next-year use cases, that's probably enough.
GPU-driven becomes the right move when we hit the chart_stress
1000-bars shape in production code.

## See also

- `framework/latches.zig` — host-side animated value store
- `framework/easing.zig` — CPU easing curves (port these to WGSL)
- `framework/gpu/effect_math.wgsl` — precedent for math.zig→WGSL mirror
- `framework/animations.zig` — host-side animation registry (added
  with useHostInterval)
- `runtime/hooks/useHostAnimation.ts` — JS hook for host-side animations
- `cart/chart_stress.tsx` — the canonical "many animated things"
  benchmark; future regression test for GPU-driven mode
