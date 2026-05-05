# Latches Pipeline (V8 Runtime)

Latches are host-owned named numeric values that can drive selected layout style
fields without React reconciliation, JSON mutation batches, or per-frame prop
diffing. Cart code binds a style field to a latch key with a string token like
`"latch:panel:h"`. Zig stores the key on the layout node, reads the current
numeric value from the latch store during the app tick, and writes it directly
into the node's style before layout and paint.

There are two ways to update latch values:

- Direct JS writes with `globalThis.__latchSet(key, value)`.
- Host-driven animations registered once from JS and ticked every frame in Zig.

Direct latch writes avoid React render work but still cross the JS-to-Zig bridge
for every value update. Host animations avoid per-frame JS work; JS registers an
animation once, then Zig updates the latch store every app tick.

## Public API

### Style binding

Bind a supported style field to a latch with a string value:

```tsx
<Box
  style={{
    width: 'latch:panel:w',
    height: 'latch:panel:h',
    left: 'latch:panel:x',
    top: 'latch:panel:y',
  }}
/>
```

Supported fields:

```text
width
height
left
top
right
bottom
```

Other style fields do not currently understand `latch:` tokens. That includes
paint-only fields such as `opacity`, `color`, `backgroundColor`, `borderColor`,
and transform-like fields. Latch values are scalar numbers; they are copied into
the node style as pixels or numeric layout values, not as percentages.

`left`, `top`, `right`, and `bottom` are layout insets. In normal use, pair them
with absolute positioning so the updated inset affects placement.

### Direct host globals

Low-level latch access is exposed directly on `globalThis`:

```ts
declare global {
  var __latchSet: ((key: string, value: number) => void) | undefined;
  var __latchGet: ((key: string) => number) | undefined;
}
```

Example:

```tsx
useEffect(() => {
  let t = 0;
  const id = setInterval(() => {
    t += 0.05;
    globalThis.__latchSet?.('meter:h', 40 + Math.sin(t) * 30);
  }, 16);

  return () => clearInterval(id);
}, []);

return <Box style={{ height: 'latch:meter:h' }} />;
```

`__latchGet(key)` returns the current value or `0` if the key is missing or the
host function is unavailable.

There is no dedicated typed `runtime/hooks` wrapper for direct latches today.
Examples call the global through a small local shim.

### Host animation hook

`runtime/hooks/useHostAnimation.ts` wraps the animation globals in a React effect:

```tsx
import { useHostAnimation } from '@reactjit/runtime/hooks/useHostAnimation';

function MovingDot() {
  useHostAnimation({
    latch: 'dot:x',
    curve: 'easeInOut',
    loop: 'pingpong',
    from: 0,
    to: 240,
    durationMs: 1200,
  });

  return (
    <Box
      style={{
        position: 'absolute',
        left: 'latch:dot:x',
        top: 40,
        width: 16,
        height: 16,
      }}
    />
  );
}
```

Hook config:

```ts
type CurveName =
  | 'linear'
  | 'easeIn'
  | 'easeOut'
  | 'easeInOut'
  | 'spring'
  | 'bounce'
  | 'sine';

type LoopMode = 'once' | 'cycle' | 'pingpong';

type HostAnimationConfig = {
  latch: string;
  curve?: CurveName;       // default: 'linear'
  loop?: LoopMode;         // default: 'cycle'
  from: number;
  to: number;
  durationMs: number;
  startOffsetMs?: number;  // default: 0
};
```

The hook registers on mount or config change and unregisters during cleanup. If
the host animation function is unavailable or registration returns `0`, the hook
does nothing.

### Animation host globals

The hook calls these globals:

```ts
declare global {
  var __anim_register:
    | ((
        latchKey: string,
        curveName: string,
        loopName: string,
        from: number,
        to: number,
        durationMs: number,
        startOffsetMs?: number
      ) => number)
    | undefined;

  var __anim_unregister: ((id: number) => void) | undefined;
}
```

`__anim_register` returns a positive animation id on success and `0` on failure.

## Binding Registration

Latch and animation globals are registered by the V8 `core` ingredient in
`v8_app.zig`:

```zig
.{ .name = "core", .required = true, .reg_fn = "registerCore", .mod = v8_bindings_core },
```

`core` is always loaded. Latches are not source-gated behind a grep prefix. The
core binding registers:

```text
__latchSet(key, value)
__latchGet(key)
__anim_register(latchKey, curveName, loopName, from, to, durationMs, startOffsetMs?)
__anim_unregister(id)
```

## End-to-End Flow: Direct JS Latch

### 1. TSX emits a `latch:` style token

Cart code sets a supported style field to a string beginning with `latch:`:

```tsx
<Box style={{ height: 'latch:bar:0:h' }} />
```

React host config treats this as a normal style value. On mount it appears in the
`CREATE` mutation's `props.style`. On update it appears in the style diff inside
an `UPDATE` mutation.

### 2. V8 stores the latch key on the layout node

When `__hostFlush` drains pending mutations, `v8_app.zig` applies style entries
to the shared `layout.Node` pool.

For supported fields, `applyStyleEntry` calls `applyLatchOrPct`. If the value is
a string with the exact prefix `latch:`, the host:

1. Extracts the suffix after `latch:` as the latch key.
2. Frees any old latch key stored for that field.
3. Duplicates and stores the new key on the node field:
   `latch_width_key`, `latch_height_key`, `latch_left_key`,
   `latch_top_key`, `latch_right_key`, or `latch_bottom_key`.
4. Seeds the numeric style field from `latches.getF32(key)`.
5. Adds the node id to the per-field latch registry.

The seed step means the first layout after binding uses the current latch value.
If the latch key does not exist yet, the seed value is `0`.

### 3. JS writes a new value

Cart code calls:

```ts
globalThis.__latchSet?.('bar:0:h', nextHeight);
```

`framework/v8_bindings_core.zig` converts the first argument to a string, converts
the second argument to an `f64`, and calls:

```zig
latches.set(key, value);
```

`framework/latches.zig` creates or updates the named latch entry and sets a
global dirty flag.

### 4. App tick syncs dirty latches into nodes

During `appTick` in `v8_app.zig`, pending JS mutation flushes are drained first.
Then the host runs:

```zig
animations.tickAll(now_ms);
syncLatchesToNodes();
```

`syncLatchesToNodes` returns immediately if `latches.isDirty()` is false. When
dirty, it walks the six per-field registries and, for each live node id:

1. Reads the node's stored latch key for that field.
2. Reads the current latch value with `latches.getF32(key)`.
3. Writes the value into the corresponding `node.style` field.

After all registered fields are synced, the host clears the latch dirty flag and
sets `g_dirty = true`.

### 5. Layout and paint see ordinary numeric style

Later in the same tick, if `g_dirty` is true, the host snapshots runtime state,
rebuilds the tree, marks layout dirty, and runs the normal layout and paint path.
Layout does not need to know where the number came from. A latched `height` is
just a numeric `height` by the time layout reads it.

No React render or prop update is required for the value change.

## End-to-End Flow: Host Animation

### 1. JS registers once

`useHostAnimation` runs a React effect and calls:

```ts
const id = globalThis.__anim_register(
  latch,
  curve,
  loop,
  from,
  to,
  durationMs,
  startOffsetMs
);
```

The hook stores no frame callback. It only registers the animation and returns a
cleanup function that calls `__anim_unregister(id)`.

### 2. Zig allocates an animation slot

`framework/v8_bindings_core.zig` maps JS strings into internal enums:

- Curve names: `linear`, `easeIn`, `easeOut`, `easeInOut`, `spring`, `bounce`,
  `sine`.
- Loop names: `once`, `cycle`, `pingpong`.

Unknown curve names default to `linear`. Unknown loop names default to `cycle`.

`framework/animations.zig` then finds a free animation slot, assigns a numeric
id, stores the config, clamps non-positive durations to `1ms`, applies
`startOffsetMs`, and seeds the latch with the `from` value.

### 3. App tick computes values in Zig

Every `appTick` calls:

```zig
animations.tickAll(now_ms);
```

For each active animation, Zig computes elapsed time, normalizes it by
`durationMs`, applies the loop mode, applies the easing curve, interpolates
between `from` and `to`, and writes the result:

```zig
latches.set(latch_key, value);
```

That write sets the same latch dirty flag used by direct JS writes.

### 4. The normal latch sync path updates nodes

After animation ticking, `syncLatchesToNodes` copies dirty latch values into any
nodes bound to the updated keys. The rest of the frame is the same as the direct
latch path: mark dirty, rebuild/materialize if needed, layout, and paint.

The key difference is where the per-frame value is computed. Direct latch mode
computes values in JS and crosses the bridge for every write. Host animation mode
computes values in Zig and uses no per-frame JS callback.

## Storage Model

`framework/latches.zig` is a fixed-size process-local store:

```zig
const MAX_LATCHES = 8192;
const MAX_KEY_LEN = 128;

const LatchEntry = struct {
    key_buf: [MAX_KEY_LEN]u8,
    key_len: u8,
    value: f64,
    active: bool,
};
```

Lookup is a linear scan over active entries. Missing values read as `0`.
`getF32` casts the stored `f64` to `f32` for layout.

Important behavior:

- `set` creates an entry on first write and updates it later.
- `set` is a no-op when the pool is full.
- Every successful `set` marks the global latch store dirty.
- `clearAll` resets the pool and dirty flag.
- V8 dev reload clears latches, animations, and the per-field node registries.

Keep latch keys at or below 128 bytes. Host animations reject longer keys and
return id `0`. Direct `__latchSet` does not reject long keys before entering the
store; the store truncates on creation, while exact lookup compares against the
original key length. Treat keys longer than 128 bytes as invalid.

## Animation Registry

`framework/animations.zig` also uses a fixed-size pool:

```zig
const MAX_ANIMS = 8192;
const MAX_KEY_LEN = 128;
```

Each active animation stores:

- `id`
- latch key
- curve
- loop mode
- `from` and `to`
- `duration_ms`
- `start_ms`

Loop behavior:

- `once`: clamp progress to `0..1`, then hold the `to` value.
- `cycle`: wrap progress with fractional time.
- `pingpong`: move forward over the first duration, then backward over the next.

Unregistering marks the animation slot inactive. It does not clear the latch
value; the last written latch value remains until another writer changes it or
the latch store is cleared.

## Clearing And Updating Bindings

Replacing a latched style field with a concrete number or percent clears the
node's stored latch key for that field:

```tsx
<Box style={{ height: 120 }} />
<Box style={{ height: '50%' }} />
```

The node id may remain in the per-field registry, but future syncs become a
cheap no-op because the node field no longer has a latch key.

Removing the style key through React's `removeStyleKeys` path currently resets
the numeric style value but does not clear the stored latch key. On the next
latch dirty sync, the old latch binding can write the value back. To reliably
clear a latch binding today, replace it with a concrete numeric or percent value
instead of only omitting the style property.

Unmounted nodes are not removed from the per-field registries. This is tolerated:
the registry lookup fails for stale ids and sync continues. Registries are
cleared on dev reload.

## Performance Notes

Latches are useful when the expensive part is React state churn, host config
diffing, JSON serialization, or applying mutation commands for many changing
numeric layout values.

They do not remove layout or paint cost. A latched `height`, `width`, or inset
still changes layout-facing data, and `syncLatchesToNodes` marks the app dirty so
the normal frame pipeline can rebuild and lay out updated nodes.

Choosing the update path:

- Use direct `__latchSet` for event-driven changes, low-frequency updates, or
  small numbers of values.
- Use `useHostAnimation` for continuous animations where JS would otherwise
  write every frame.
- For very large visual-only workloads, prefer shader/GPU-driven paths when
  possible. See `docs/gpu-driven-animation.md`.

## Source Map

- `framework/latches.zig`: fixed-size latch store and dirty flag.
- `framework/animations.zig`: host animation registry and easing application.
- `framework/easing.zig`: easing curve implementations.
- `framework/v8_bindings_core.zig`: `__latchSet`, `__latchGet`,
  `__anim_register`, and `__anim_unregister`.
- `v8_app.zig`: style token parsing, per-field node registries, app tick sync,
  hot reload clearing.
- `framework/layout.zig`: `Node` latch key fields.
- `runtime/hooks/useHostAnimation.ts`: React hook wrapper for host animations.
- `cart/chart_stress.tsx`: direct latch examples and stress comparison.
- `cart/app/gallery/components/easings/EasingsHostInterval.tsx`: host animation
  usage example.
