# V8 Math Pipeline

Last updated: 2026-05-04

This document traces the math pipeline end to end. In this repository "math"
means three separate systems:

- numeric math: `runtime/hooks/math.ts` calls `framework/math.zig` through the
  V8 `__zig_call` reflection bridge.
- visual math: the gallery LaTeX components parse formulas into ordinary
  ReactJIT `Box`/`Row`/`Col`/`Text` trees.
- effect math: CPU and WGSL effect render paths expose math/noise/color helpers
  for procedural pixels.

There is also an HTML `<math>` remap in `renderer/hostConfig.ts`, but the V8
host does not give host type `Math` special layout or paint behavior today.

## Source Map

| Layer | Files | Role |
| --- | --- | --- |
| Public numeric API | `runtime/hooks/math.ts`, `runtime/hooks/index.ts` | JS `math` Proxy and TypeScript advisory surface. |
| Build gates | `build.zig`, `v8_app.zig`, `scripts/ship` | Enables `__zig_call` and `__zig_call_list` when `runtime/hooks/math.ts` is bundled. |
| Reflection bridge | `framework/v8_bindings_zigcall.zig` | Converts V8 values to Zig values, dispatches reflected `pub fn`s, converts returns back to V8. |
| Numeric implementation | `framework/math.zig` | Pure f32 math library: vecs, matrices, quats, boxes, geometry, interpolation, noise, Bezier. |
| Visual formula parser | `cart/app/gallery/components/latex/useLaTeXParse.ts` | Parses LaTeX-ish source into `MathNode[]`. |
| Visual formula renderer | `cart/app/gallery/components/latex/*.tsx`, `mathRender.ts`, `SymbolMap.ts` | Lowers parsed math nodes to normal ReactJIT primitives. |
| Host remap | `renderer/hostConfig.ts` | Maps HTML `<math>` to host type `Math`; no special Zig semantics. |
| CPU effect context | `runtime/effectContext.ts`, `framework/effect_ctx.zig` | Per-pixel CPU effect helpers and math/noise/color functions. |
| GPU effect math | `framework/gpu/effect_math.wgsl`, `v8_app.zig` | Shared WGSL helper library injected into effect shaders. |
| Existing docs | `docs/v8/effects.md`, `docs/v8/paint.md`, `docs/v8/layout.md` | Adjacent effect/render/layout behavior. |

## Numeric Math: Executive Flow

1. Cart code imports:

```ts
import { math } from '@reactjit/runtime/hooks/math';
```

or:

```ts
import { math } from '@reactjit/runtime/hooks';
```

2. `scripts/ship` sees `runtime/hooks/math.ts` in the bundle and sets
   `WANT_ZIGCALL=1`.
3. The build receives `-Dhas-zigcall=true`.
4. `v8_app.zig` imports `framework/v8_bindings_zigcall.zig` instead of the
   stub.
5. Startup registers:

```text
__zig_call
__zig_call_list
```

6. `runtime/hooks/math.ts` creates a Proxy. Any property access such as
   `math.v2add` returns a JS function.
7. Calling that function executes:

```ts
globalThis.__zig_call('math', 'v2add', ...args)
```

8. `framework/v8_bindings_zigcall.zig` reads the module and function names.
9. It dispatches only across whitelisted modules:

```zig
math
easing
transition
```

10. For module `math`, it reflects over every `pub fn` in `framework/math.zig`.
11. If the function signature is supported and the name matches, V8 arguments
    are converted to Zig values.
12. The Zig function is called directly.
13. The return value is converted back to a V8 value.
14. JS receives a number, boolean, object, array, `null`, or `undefined`.

## Build And Registration

### `build.zig`

The build option is:

```text
-Dhas-zigcall=true
```

It writes `build_options.has_zigcall`.

### `v8_app.zig`

`v8_app.zig` gates the binding:

```zig
const v8_bindings_zigcall =
    if (build_options.has_zigcall)
        @import("framework/v8_bindings_zigcall.zig")
    else
        stub;
```

The ingredient table registers two optional ingredients:

```zig
.{ .name = "zigcall",      .grep_prefix = "__zig_call", .reg_fn = "registerZigCall" },
.{ .name = "zigcall_list", .grep_prefix = "__zig_call", .reg_fn = "registerZigCallList" },
```

Both are optional. If the binding is absent, `runtime/hooks/math.ts` returns
`null` for calls and `{}` for `listZigCallable()`.

### `scripts/ship`

`scripts/ship` reports:

```text
zigcall: runtime/hooks/math.ts
```

and adds:

```text
-Dhas-zigcall=true
```

when the dependency resolver finds the math hook in the bundled cart.

## JS Numeric API

`runtime/hooks/math.ts` exports:

```ts
export const math: MathSurface;
export function listZigCallable(): Record<string, string[]>;
```

The TypeScript surface includes:

- `Vec2`
- `Vec3`
- `BBox2`
- `BBox3`
- `SmoothDampResult`
- common Vec2/Vec3 functions
- scalar interpolation helpers
- geometry helpers
- noise helpers
- Bezier helpers
- an index signature for all other reflected functions

The important runtime detail is that the TypeScript interface is advisory. The
Proxy forwards any function name:

```ts
math.someFunction(...args)
```

to:

```ts
__zig_call('math', 'someFunction', ...args)
```

So functions present in `framework/math.zig` but missing from `MathSurface` can
still be called at runtime. TypeScript may not know their signatures.

### Failure Values

| Case | Return |
| --- | --- |
| `__zig_call` missing | `null` |
| unknown module | `null` |
| unknown function | `null` |
| missing argument | `null` |
| argument conversion failure | `null` |
| unsupported Zig signature | function is skipped; call returns `null` |
| `void` Zig return | JS `undefined` |
| optional Zig return with `null` | JS `null` |

There is no JS exception or structured error from the bridge.

### Introspection

`listZigCallable()` calls:

```text
__zig_call_list()
```

and parses the returned JSON:

```ts
{
  math: ['v2', 'v2add', ...],
  easing: [...],
  transition: [...]
}
```

This is the best way to see the real runtime callable surface for a build.

## Reflection Bridge

`framework/v8_bindings_zigcall.zig` exposes all supported `pub fn`s from a
small whitelist.

### Whitelist

```zig
const MODULES = .{
    .{ "math",       @import("math.zig") },
    .{ "easing",     @import("easing.zig") },
    .{ "transition", @import("transition.zig") },
};
```

Adding a module here is the wiring step for `__zig_call`; no per-function host
binding is required.

### Supported Types

The bridge supports arguments and returns made of:

- `bool`
- integers
- floats
- `void`
- `?T`
- structs whose fields are supported types
- slices of supported types

Unsupported signatures are skipped at compile-time reflection dispatch. They do
not fail the build.

Unsupported today:

- raw pointers
- non-slice pointers
- function pointers
- unions
- enums
- `anytype`
- comptime-only functions

### Argument Conversion

V8 values convert as follows:

| Zig type | V8 input |
| --- | --- |
| `bool` | `toBool` |
| int | `toF64`, then integer cast |
| float | `toF64`, then float cast |
| optional | `null`/`undefined` -> `null`, otherwise child conversion |
| struct | JS object; fields read by exact Zig field names |
| slice | JS array-like object; copied into a temporary Zig allocation |

Slice arguments are allocated with `std.heap.c_allocator` and freed after the
call.

Important edge case: output-by-mutation slice APIs are not useful from JS. For
example, `framework/math.zig` has `bezierCurve(points, segments, out) -> u32`.
The `out` array is copied into temporary Zig memory, then freed after the call;
mutations do not update the original JS array. Prefer return-value APIs such as
`bezierPoint`, `cubicBezier`, and `quadraticBezier`.

### Return Conversion

| Zig return | JS value |
| --- | --- |
| `bool` | boolean |
| int/float | number |
| `void` | `undefined` |
| optional | value or `null` |
| struct | plain object with matching fields |
| slice | JS array |

The current bridge can convert slice returns, but it does not define an
ownership/free policy for newly allocated returned slices. Avoid adding owning
slice-returning functions until that policy exists.

## `framework/math.zig` API Surface

`framework/math.zig` is pure Zig math. It uses `f32` almost everywhere, so JS
numbers are narrowed from double precision to single precision at the bridge.

### Value Types

| Type | Shape in JS |
| --- | --- |
| `Vec2` | `{ x, y }` |
| `Vec3` | `{ x, y, z }` |
| `Vec4` / `Quat` | `{ x, y, z, w }` |
| `Mat4` | array of 16 numbers |
| `BBox2` | `{ x, y, w, h }` |
| `BBox3` | `{ x, y, z, w, h, d }` |
| `Decomposed` | struct fields from matrix decomposition |
| `SmoothDampResult` | `{ value, velocity }` |

### Vec2

Functions include:

```text
v2, v2zero, v2one
v2add, v2sub, v2mul, v2div, v2scale, v2negate
v2dot, v2cross
v2length, v2lengthSq, v2distance, v2distanceSq
v2normalize
v2abs, v2floor, v2ceil, v2round
v2min, v2max, v2clamp
v2lerp, v2smoothstep
v2angle, v2fromAngle, v2rotate
v2equals, v2almostEquals
```

### Vec3

Functions include:

```text
v3, v3zero, v3one, v3up, v3forward, v3right
v3add, v3sub, v3mul, v3div, v3scale, v3negate
v3dot, v3cross
v3length, v3lengthSq, v3distance, v3distanceSq
v3normalize
v3abs, v3floor, v3ceil, v3round
v3min, v3max, v3clamp
v3lerp, v3smoothstep
v3reflect, v3slerp
v3equals, v3almostEquals
```

### Vec4

Functions include:

```text
v4, v4zero, v4one
v4add, v4sub, v4mul, v4div, v4scale, v4negate
v4dot, v4length, v4lengthSq, v4normalize
v4lerp, v4min, v4max, v4clamp
v4equals, v4almostEquals
```

`runtime/hooks/math.ts` does not currently define `Vec4` in its typed surface,
but the Proxy can still forward these calls.

### Mat4

Functions include:

```text
m4identity
m4multiply
m4transpose
m4determinant
m4invert
m4translate
m4scale
m4rotateX, m4rotateY, m4rotateZ
m4lookAt
m4perspective
m4ortho
m4transformPoint
m4transformDir
m4fromQuat
m4fromEuler
m4decompose
```

Matrices are `[16]f32` in Zig and JS arrays at the bridge.

### Quat

Functions include:

```text
quatIdentity
quatCreate
quatMultiply
quatConjugate
quatInverse
quatNormalize
quatDot
quatLength
quatFromAxisAngle
quatFromEuler
quatToEuler
quatToMat4
quatSlerp
quatRotateVec3
```

`Quat` aliases the Vec4 shape.

### Bounding Boxes

Functions include:

```text
bbox2
bbox2width
bbox2height
bbox2center
bbox2containsPoint
bbox2containsBBox
bbox2intersects
bbox2intersection
bbox2union
bbox2expand

bbox3
bbox3containsPoint
bbox3intersects
bbox3union
bbox3expand
```

### Geometry

Functions include:

```text
distancePointToSegment
distancePointToRect
circleContainsPoint
circleIntersectsRect
lineIntersection
```

### Scalar And Interpolation

Functions include:

```text
lerp
inverseLerp
smoothstep
smootherstep
remap
clamp
wrap
damp
step
pingPong
moveTowards
moveTowardsAngle
smoothDamp
toRadians
toDegrees
```

### Trig And Numeric Helpers

Functions include:

```text
sin, cos, tan
asin, acos, atan, atan2
exp, exp2
log, log2, log10
sqrt, pow
absf, floorf, ceilf, roundf, signf
hypot, fract
piValue, tauValue
```

`pi` is a private constant. Use `piValue()` and `tauValue()` from JS.

### Noise

Functions include:

```text
noise2d
noise3d
fbm2d
fbm3d
```

`fbm2d` and `fbm3d` take octave count, seed, lacunarity, and persistence.

### Bezier

Functions include:

```text
bezierPoint
bezierCurve
cubicBezier
cubicBezierDerivative
quadraticBezier
```

From JS, prefer the point-returning functions. `bezierCurve` mutates an output
slice and only returns a count, so the current bridge does not expose the
computed points back into the JS array.

## Numeric Usage Patterns

### Good: non-trivial kernels

```ts
const p = math.cubicBezier(
  { x: 0, y: 0 },
  { x: 0.25, y: 1 },
  { x: 0.75, y: 1 },
  { x: 1, y: 0 },
  0.5,
);

const n = math.fbm2d(x * 0.05, y * 0.05, 4, 1337, 2.0, 0.5);
```

These calls do enough work to justify the bridge.

### Risky: hot scalar loops

```ts
for (let i = 0; i < 10000; i++) {
  y += math.smootherstep(0, 1, i / 10000);
}
```

Every call crosses V8 -> Zig -> V8. For trivial scalar math, V8's own `Math.*`
or a local JS helper is usually faster. The `EasingsZigMath` gallery atom exists
specifically to stress this assumption.

### Good: constants once

```ts
const TAU = math.tauValue();
```

`BrailleGraph.tsx` uses this pattern: resolve a constant from Zig once at module
load, then reuse it.

## Visual Formula Pipeline

The visual formula stack lives in:

```text
cart/app/gallery/components/latex/
```

It is not a native host primitive and does not call `framework/math.zig`. It is
a cart-level parser/renderer that lowers formula source to ordinary ReactJIT
layout nodes.

### Public Component Surface

`Latex.tsx` exports:

```ts
type LatexProps = {
  source: string;
  inline?: boolean;
  numbered?: boolean;
  equationNumber?: string | number;
  fontSize?: number;
  color?: string;
  style?: any;
};
```

Behavior:

- `inline=true` renders `LaTeXInline`.
- default/block mode renders `LaTeXBlock`.
- block mode can show an equation number on the right.

### Parse

`useLaTeXParse(source)` memoizes:

```ts
parseLaTeX(source): MathNode[]
```

`MathNode` variants:

```ts
text
symbol
group
fraction
sqrt
script
matrix
empty
```

Supported command groups:

| Source | Output |
| --- | --- |
| plain text/math atoms | `text` nodes |
| `^`, `_` | `script` nodes |
| `\frac{a}{b}` | `fraction` |
| `\binom{a}{b}` | parenthesized fraction group |
| `\sqrt{x}` | `sqrt` |
| `\sqrt[n]{x}` | indexed `sqrt` |
| `\begin{matrix}` / `pmatrix` / `bmatrix` / `vmatrix` | `matrix` |
| `\text{...}`, `\mathrm{...}`, `\operatorname{...}` | roman text |
| `\mathbb{...}` | Unicode double-struck mapping |
| `\mathbf{...}`, `\bm{...}` | bold mode |
| `\mathit{...}` | math italic mode |
| `\mathcal{...}` | italic/cal mode |
| `\vec`, `\hat`, `\bar`, `\overline`, `\tilde`, `\dot`, `\ddot` | combining marks |
| `\underline{...}` | soft fallback to content |
| `\ce{...}` | chemistry normalization then parse |
| `\chemfig{...}` | raw text then parse |
| symbol commands | `SymbolMap.ts` lookup |

Chemistry normalization handles common arrows and numeric subscripts:

- `<=>` / `<->` -> `\leftrightarrow`
- `->` -> `\to`
- `<-` -> `\leftarrow`
- element-number pairs -> subscript form

Unknown commands fall back to text containing the command name.

### Render

`mathRender.ts` lowers `MathNode` to primitives:

| Node | Render |
| --- | --- |
| `text` | `Text` |
| `symbol` | `Text` |
| `group` | `Row` |
| `script` | `Row` plus stacked `Col` for super/sub |
| `fraction` | `Col` numerator, rule `Box`, denominator |
| `sqrt` | `Row` with `√` text and overline border |
| `matrix` | `Row` delimiters plus `Col` rows and `Row` cells |

After this point, formula rendering uses the normal ReactJIT pipeline:

```text
Box/Row/Col/Text
  -> renderer/hostConfig.ts mutation commands
  -> v8_app.zig Node pool
  -> framework/layout.zig flex layout and text measurement
  -> framework/engine.zig paint
  -> framework/gpu/text.zig glyph atlas
```

There is no TeX layout engine, no DOM MathML, and no KaTeX in this V8 path.

### HTML `<math>`

`renderer/hostConfig.ts` maps:

```ts
'math': 'Math'
```

But `v8_app.zig:applyTypeDefaults` has no `Math` case, and the paint/layout
code has no special Math branch. So a literal HTML `<math>` host node behaves
like a generic node unless the cart wraps it with a component that renders real
children.

Use the gallery `Latex` component for visible formula rendering.

## Effect Math Pipeline

Effects have their own math surface because per-pixel code needs to avoid a
host bridge call for every pixel.

### JS CPU Effects

`runtime/effectContext.ts` builds an `EffectContext` for JS `onRender`
callbacks. It exposes:

- dimensions and time: `width`, `height`, `time`, `dt`, `frame`
- mouse info
- pixel ops: `setPixel`, `setPixelRaw`, `getPixel`, `clearColor`, `fade`
- scalar helpers: `sin`, `cos`, `tan`, `atan2`, `sqrt`, `abs`, `floor`,
  `ceil`, `pow`, `exp`, `log`, `min`, `max`, `clamp`, `mod`
- procedural helpers: `noise2`, `noise3`, `fbm`
- color helpers: `hsv`, `hsl`

These are JS functions over a `Uint8ClampedArray` view of the effect pixel
buffer. They deliberately do not call `__zig_call` per pixel.

### Zig CPU Effects

`framework/effect_ctx.zig` defines the Zig-side `EffectContext` for compiled
effect callbacks. Its comments describe the compiler-era mapping:

```text
e.sin       -> @sin
e.noise     -> math.noise2d
e.noise3    -> math.noise3d
```

It owns pixel operations and color conversion; math/noise delegates to
`framework/math.zig`.

### WGSL Effect Math

`framework/gpu/effect_math.wgsl` is embedded into `v8_app.zig`:

```zig
const EFFECT_WGSL_MATH = @embedFile("framework/gpu/effect_math.wgsl");
```

`assembleEffectShader(user_wgsl)` prepends:

- effect uniform/header code
- fullscreen-triangle vertex shader
- `effect_math.wgsl`
- user WGSL fragment body

Helpers include:

```text
snoise
snoise3
fbm
voronoi
hsv2rgb
hsl2rgb
_lerp
_remap
_dist
```

This path is GPU-local. It is separate from `runtime/hooks/math.ts` and does not
cross `__zig_call`.

## Legacy TSZ Math Notes

`manifest/s00c_manifest.tsz` and `manifest/s00c_manifest.effects.tsz` describe
older TSZ-facing `math.*` utilities such as:

```text
math.clamp
math.lerp
math.map
math.deg / math.rad
math.plasma
math.turbulence
math.waves
math.fbm
math.hue
math.ramp
math.smoothstep
```

Those are design/compiler-era surfaces. In the V8 runtime:

- numeric cart calls use `runtime/hooks/math.ts` -> `framework/math.zig`.
- JS effect callbacks use `runtime/effectContext.ts`.
- WGSL effects use `framework/gpu/effect_math.wgsl`.
- gallery formulas use `cart/app/gallery/components/latex`.

Do not assume a TSZ `math.*` helper exists in V8 JS unless it is exported by one
of those live surfaces.

## Review Notes

### 1. `Math` host type is inert

`renderer/hostConfig.ts` maps HTML `<math>` to `Math`, but the Zig host has no
special case for it. This can mislead anyone expecting MathML-like behavior.
Document and use `Latex` for formulas.

### 2. TypeScript surface lags Zig exports

`runtime/hooks/math.ts` types Vec2/Vec3 and common helpers, but
`framework/math.zig` also exports Vec4, Mat4, Quat, BBox, trig, constants, and
more. The Proxy forwards them, but TypeScript does not fully describe them.

### 3. Bridge calls are not free

Every `math.fn(...)` call crosses V8/Zig and marshals arguments. Use it for
non-trivial kernels or one-off constants. Keep hot scalar loops in JS or batch
them behind a larger Zig API.

### 4. Null means many things

`null` can mean the binding is missing, the function is unknown, conversion
failed, an argument was missing, or an optional Zig return was actually null.
Callers that need diagnostics should check `listZigCallable()` and validate
inputs before calling.

### 5. f32 narrowing is real

Most `framework/math.zig` APIs use `f32`. JS numbers are double precision, but
the bridge narrows to `f32` before computation.

### 6. Output slice APIs do not round-trip mutations

Functions that mutate slice arguments, such as `bezierCurve(..., out)`, mutate a
temporary Zig copy of the JS array. The mutation is lost when the bridge frees
the temporary buffer.

## Change Checklist

When changing the math pipeline, check:

1. `framework/math.zig` function signature uses only supported reflected types.
2. `runtime/hooks/math.ts` TypeScript surface matches any newly advertised API.
3. `listZigCallable()` shows the expected function.
4. Hot call sites do not add thousands of tiny bridge calls per frame.
5. Formula rendering changes still lower to normal primitives unless adding a
   real host `Math` implementation intentionally.
6. Effect helper changes are mirrored in the correct surface:
   `runtime/effectContext.ts`, `framework/effect_ctx.zig`, or
   `framework/gpu/effect_math.wgsl`.
