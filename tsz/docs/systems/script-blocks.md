# Script Blocks

JavaScript logic via QuickJS, running alongside the compiled Zig UI.

## Overview

Script blocks provide runtime JavaScript execution for logic that doesn't need to be compiled to Zig — data fetching, timers, complex business logic, and dynamic state updates. The JS runs in an embedded QuickJS VM. **Layout and paint stay in Zig** (`layout.zig`, `gpu/`); the UI *structure* may be static Zig nodes or a **lua-tree** stamped from Lua — see [ARCHITECTURE.md](../ARCHITECTURE.md).

### Default lua-tree and QuickJS

**`LUA_LOGIC`** is the normal app emit; **LuaJIT** owns the tree. **QuickJS** still loads when the cart has **`JS_LOGIC`** from `<script>`, and the engine uses QuickJS for **`__eval(jsExpr)`** (Lua → `qjs_runtime.evalToString`) and **`evalLuaMapData`** (JS expressions feeding Lua). Script blocks and lua-tree are **not** mutually exclusive.

There are two ways to add JS logic to a cart:

1. **Inline `<script>` blocks** — inside the `.tsz` file itself
2. **External `_script.tsz` files** — imported via `from './name_script'`

## Inline Script Blocks

```tsx
<script>
setInterval(function() {
  setCount(getCount() + 1);
}, 1000);
</script>

function App() {
  const [count, setCount] = useState(0);
  return (
    <Box>
      <Text>{`Count: ${count}`}</Text>
    </Box>
  );
}
```

The compiler extracts the `<script>` block (Phase 5: `extractComputeBlock`) and embeds it as `JS_LOGIC` in the generated Zig. At runtime, QuickJS evaluates it after the first frame.

## External Script Files

For larger JS logic, use a separate `_script.tsz` (or `.script.tsz`) file:

**dashboard.tsz:**
```tsx
from './metrics_script'

function App() {
  const [cpu, setCpu] = useState(0);
  // ...
}
```

**metrics_script.tsz:**
```javascript
setInterval(function() {
  setCpu(Math.floor(Math.random() * 100));
}, 1000);
```

Script files contain raw JavaScript — no function App(), no JSX. The compiler concatenates all imported script files into a single `JS_LOGIC` string.

## State Bridge

The compiler automatically generates getter/setter bridge functions that connect JS to the Zig state system:

| In .tsz | Available in JS | Zig equivalent |
|---------|-----------------|----------------|
| `const [count, setCount] = useState(0)` | `getCount()`, `setCount(value)` | `state.getSlot(N)`, `state.setSlot(N, value)` |

The setter calls in JS (`setCpu(45)`) are rewritten to `__setState(slotId, value)` calls that cross the QuickJS → Zig bridge. The bridge runs at ~52M calls/second — it is not a bottleneck.

### Built-in bridge functions

These are always available in script blocks:

| Function | Description |
|----------|-------------|
| `getFps()` | Current frames per second |
| `getLayoutUs()` | Layout time in microseconds |
| `getPaintUs()` | Paint time in microseconds |
| `getTickUs()` | Tick time in microseconds |
| `console.log(msg)` | Prints to stderr |
| `setInterval(fn, ms)` | Periodic timer |
| `setTimeout(fn, ms)` | One-shot timer |

## What Goes in Script vs. Zig

| Use case | Where |
|----------|-------|
| Timers, polling, intervals | Script |
| Data transformation, math | Script |
| API calls (when networking lands) | Script |
| State initialization | Zig (useState) |
| Event handlers (onPress) | Zig and/or Lua strings (`lua_on_*` / `js_on_*`) depending on emit |
| Layout, rendering | Zig (framework) |
| Performance-critical loops | Zig (useFFI or _zscript.tsz) |

## Compilation Details

1. `<script>` content or `_script.tsz` imports are loaded before codegen
2. `useState()` lines are stripped from the JS (state is managed by Zig)
3. Setter calls like `setFoo(val)` are rewritten to `__setState(N, val)`
4. The final JS string is embedded as a `const JS_LOGIC` in generated_app.zig
5. At runtime, `qjs_runtime.evalScript(JS_LOGIC)` executes it after the first frame

## Known Limitations

- No `import`/`require` — all JS must be self-contained or concatenated via `_script.tsz` imports
- No async/await — use `setInterval`/`setTimeout` for async patterns
- No direct DOM access — JS communicates with the UI only through state getters/setters
- The `<` operator in script blocks can be misinterpreted as JSX — use `count > i` instead of `i < count`
- QuickJS only (not V8/SpiderMonkey) — ES2020 subset, no bleeding-edge JS features
- Script blocks require the full compiler (`bin/tsz-full`); lean builds omit QuickJS
