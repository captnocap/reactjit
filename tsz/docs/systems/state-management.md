# State Management

Compiled state slots, FFI polling, transitions, and springs.

## Overview

State in tsz is managed through numbered slots in a global state array. Each `useState` call reserves a slot at compile time. There is no runtime reconciler — state changes trigger direct node mutations via dirty-flag checks in `_appTick`.

## useState

```tsx
function App() {
  const [count, setCount] = useState(0);
  const [label, setLabel] = useState("Hello");
  const [active, setActive] = useState(false);
  const [progress, setProgress] = useState(0.5);
  // ...
}
```

The destructuring syntax mirrors React but compiles to:
- `count` → `state.getSlot(N)` (integer)
- `setCount(value)` → `state.setSlot(N, value)` + dirty flag

### Supported initial value types

| Syntax | State type | Getter | Setter |
|--------|-----------|--------|--------|
| `useState(0)` | `int` (i64) | `state.getSlot(N)` | `state.setSlot(N, val)` |
| `useState(0.5)` | `float` (f64) | `state.getSlotFloat(N)` | `state.setSlotFloat(N, val)` |
| `useState("text")` | `string` | `state.getSlotString(N)` | `state.setSlotString(N, val)` |
| `useState(false)` | `boolean` | `state.getSlotBool(N)` | `state.setSlotBool(N, val)` |
| `useState([1, 2, 3])` | `array` | array API | array API |
| `useState([{...}])` | object array | object array API | object array API |

## useFFI

Polls a C function at a fixed interval and stores the result in a read-only state slot:

```tsx
// @ffi <sys/sysinfo.h> -lc
declare function getUptime(): number

function App() {
  const [uptime] = useFFI(getUptime, 1000);  // poll every 1000ms
  return <Text>{`Uptime: ${uptime}s`}</Text>;
}
```

The compiler:
1. Registers the FFI function from the `declare` + `// @ffi` pragma
2. Creates a state slot (read-only, no setter)
3. Generates a polling call in `_appTick` that runs every N milliseconds

## useTransition

Animates a float state slot toward a target value over time:

```tsx
const [opacity, setOpacity] = useState(0.0);
useTransition(opacity, targetOpacity, 300, "easeInOut");
```

Parameters:
1. State variable name (must be a float useState)
2. Target expression (evaluated each frame)
3. Duration in milliseconds
4. Easing function: `"linear"`, `"easeIn"`, `"easeOut"`, `"easeInOut"`

The compiler generates per-frame interpolation code in `_appTick` with animation timestamps and easing math.

## useSpring

Physics-based spring animation for a float state slot:

```tsx
const [x, setX] = useState(0.0);
useSpring(x, targetX, 170, 26);
```

Parameters:
1. State variable name (must be a float useState)
2. Target expression
3. Stiffness (higher = snappier, typical: 100-300)
4. Damping (higher = less bounce, typical: 10-30)

The compiler auto-allocates a hidden velocity slot and generates spring physics in `_appTick`.

## useEffect

Lifecycle hooks that run code on state changes:

```tsx
useEffect(() => {
  console.log("count changed to " + count);
}, [count]);
```

Effects run after the frame when their dependency values change.

## Dynamic Text

State values in text use template literals that compile to `_updateDynamicTexts`:

```tsx
<Text>{`Count: ${count}`}</Text>
```

The compiler allocates a fixed-size buffer (`_dyn_buf_N`) and generates `std.fmt.bufPrint` calls in `_appTick` to update the text when the referenced state slot is dirty.

## Conditional Rendering

```tsx
{isVisible && <Box><Text>Shown when true</Text></Box>}
{mode === 1 ? <Text>Mode 1</Text> : <Text>Other</Text>}
```

Compiles to visibility toggles on child nodes in `_updateConditionals`. The nodes always exist in the tree — only their visibility changes.

## Computed Arrays

Derived arrays from state:

```tsx
const [items, setItems] = useState([1, 2, 3, 4, 5]);
const filtered = items.filter(item => item > 3);
const labels = items.map(item => `Item ${item}`);
```

Compiled to Zig filter/map operations over the state array slots.

## Let Variables

Mutable variables in the App function body:

```tsx
function App() {
  let threshold = 50;
  const [value, setValue] = useState(0);
  // ...
}
```

Compiled to `var` declarations in Zig. Distinct from `const` (which is compile-time substitution).

## State in Event Handlers

```tsx
<Pressable onPress={() => { setCount(count + 1) }}>
```

The handler body compiles to a Zig function that reads the current slot value and writes the new one:
```zig
fn _handler_press_0() void {
    state.setSlot(0, state.getSlot(0) + 1);
}
```

## State in Script Blocks

JS script blocks access state through auto-generated bridge functions:

```javascript
// In _script.tsz:
setCpu(45);           // → __setState(slotId, 45)
const val = getCpu(); // → __getState(slotId)
```

`useState()` lines in script blocks are stripped — the Zig side owns state initialization.

## Known Limitations

- Max 512 state slots per app
- State is global (App-level) — components don't have their own state
- Object state supports max 16 fields, 16 object state vars, 16 object arrays
- Array state supports max 64 initial values
- `useTransition` and `useSpring` only work with float state slots
- Max 16 FFI hooks, 32 effect hooks, 16 animation hooks
