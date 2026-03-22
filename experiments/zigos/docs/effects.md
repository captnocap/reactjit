# Effects API

Composable pixel-buffer effects where the framework provides primitives (pixel ops, math, timing) and users write the math in .tsz.

## .tsz API

### Standalone effect (fills own layout box)
```tsx
<Effect onRender={(e) => {
  for (let y = 0; y < e.height; y++) {
    for (let x = 0; x < e.width; x++) {
      const d = e.sin(x * 0.1 + e.time) * 0.5 + 0.5;
      e.setPixel(x, y, d, d * 0.5, 1.0 - d, 1.0);
    }
  }
}} style={{ width: 400, height: 300 }} />
```

### Background effect (behind parent's children)
```tsx
<Box style={{ width: '100%', height: 200 }}>
  <Effect background onRender={(e) => { /* renders behind siblings */ }} />
  <Text fontSize={24}>Content on top</Text>
</Box>
```

### Mask effect (post-process parent content) [pipeline stubbed]
```tsx
<Box>
  <Text fontSize={24}>This gets filtered</Text>
  <Effect mask onRender={(e) => {
    for (let y = 0; y < e.height; y++)
      for (let x = 0; x < e.width; x++) {
        const src = e.getSource(x, y);
        e.setPixel(x, y, src[0] * 0.5, src[1], src[2], src[3]);
      }
  }} />
</Box>
```

### EffectContext API (the `e` parameter)

**Properties:** `width`, `height`, `time`, `dt`, `frame`, `mouse_x`, `mouse_y`, `mouse_inside`

**Pixel ops:** `setPixel(x, y, r, g, b, a)`, `getPixel(x, y)`, `clear()`, `clearColor(r, g, b, a)`, `fillRect(x, y, w, h, r, g, b, a)`, `blendPixel(x, y, r, g, b, a)`, `fade(factor)`

**Drawing:** `line(x0, y0, x1, y1, r, g, b, a)`, `circle(cx, cy, radius, r, g, b, a)`, `circleFill(cx, cy, radius, r, g, b, a)`

**Math builtins (compiled to @sin etc):** `sin`, `cos`, `sqrt`, `abs`, `floor`, `ceil`, `mod`

**Math delegates (call math.zig):** `noise(x, y)`, `lerp(a, b, t)`, `remap(v, inMin, inMax, outMin, outMax)`, `smoothstep(e0, e1, x)`, `clamp(v, lo, hi)`, `dist(x0, y0, x1, y1)`

**Color:** `hsv(h, s, v)` -> [3]f32, `hsl(h, s, l)` -> [3]f32

**Mask-only:** `getSource(x, y)` -> [4]f32

## Framework files
- `framework/effect_ctx.zig` — EffectContext struct, all pixel/math/color methods
- `framework/effects.zig` — Instance lifecycle, pixel buffer, wgpu texture upload, dual path (registry + custom render)
- `framework/engine.zig` — paintCustomEffect() call in paintNodeVisuals, background effect scan in paintNode

## Compiler files
- `compiler/jsx.zig` — `<Effect>` primitive, `onRender` callback parsing, `background`/`mask` bare boolean attrs
- `compiler/handlers.zig` — `emitEffectRenderBody()`, effect_param translation in emitStateAtom/emitStatement
- `compiler/emit.zig` — conditional `effect_ctx` import
- `compiler/validate.zig` — Effect in primitives list
- `compiler/codegen.zig` — effect_param, has_effect_render fields

## Known limitations
- Mask pipeline not fully wired — getSource() API ready but engine doesn't capture parent to offscreen texture yet
- For-loop variables are i32, auto-cast to f32 for effect math — may lose precision for large values
- No GPU-accelerated effects (all CPU pixel buffer) — fine for <800x600, slow for fullscreen
- HSV/HSL return [3]f32 arrays — array indexing (`rgb[0]`) works but destructuring doesn't
- Effect instances matched by function pointer — if two Effect elements use the same onRender function, they share state
