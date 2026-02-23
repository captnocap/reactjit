# lua/ — Lua Runtime

This is the Lua side of the renderer. It runs inside LuaJIT (SDL2 target) or Love2D, owns the game loop, does the layout math, paints every pixel, and handles all user input. JavaScript lives in QuickJS and sends mutation commands over FFI. Everything here is low-latency, allocation-aware, and frame-budget conscious.

## Architecture in one paragraph

React's reconciler emits mutation commands (CREATE, UPDATE, APPEND, REMOVE). `init.lua` receives them via `bridge_quickjs.lua`, hands them to `tree.lua` which maintains the node graph, marks layout dirty, and queues the next paint. `layout.lua` walks the tree computing flex geometry. `painter.lua` walks it again emitting draw calls. `events.lua` does hit testing and feeds input back to JS as queued events. That is the entire loop — every frame, in that order.

## Module conventions

**Every module is a table returned from a closure.** No global state, no `module()`, no upvalue leakage between files:

```lua
local Foo = {}
local _state = {}          -- private, unexported

function Foo.init(deps)    -- called once from init.lua with injected dependencies
  _measure = deps.measure
end

function Foo.doThing(...)  -- public API
end

return Foo
```

**Dependencies are injected, not required.** Modules do not `require` each other at the top level. `init.lua` requires everything and wires it together via `Module.init({ dep = dep })`. This eliminates circular dependency bugs and makes the load order explicit.

**Public methods are camelCase. Private helpers are snake_case. Constants are UPPER_SNAKE_CASE.** Type/node names are PascalCase (`View`, `TextInput`, `Scene3D`).

## How to add a new Lua-owned interactive component

Follow the pattern in `slider.lua`, `textinput.lua`, `switch.lua`:

1. **State lives on the node, not in a module-level table.** Use a `getState(node)` accessor that lazily creates `node._mywidget = {}`. This avoids stale state when nodes are reused.

2. **Input handlers mutate local state and queue an event.** They do NOT round-trip to JS. Zero-latency means the Lua side handles the interaction fully.

3. **The draw method reads current state and props.** During drag, read `state.value`. At rest, read `node.props.value`. Never cache the draw output.

4. **Queue events back to JS** via the shared `pendingEvents` table (drained each frame in `init.lua`). Format: `{ nodeId = id, type = "widget:change", value = v }`.

## How to add a new capability

Register via the capability system (`capabilities.lua` + `capabilities/` directory for complex capabilities). The schema IS the documentation. If JS needs to discover it, `useCapabilities()` picks it up automatically. Simple capabilities live in `capabilities.lua`; multi-file capabilities (like audio, boids, GPIO) get their own file in `capabilities/`.

```lua
Capabilities.register("MyFeature", {
  visual = true,          -- does this render anything?
  schema = {
    myProp = { type = "string", description = "...", required = false }
  },
  create  = function(nodeId, props) return { state } end,
  update  = function(nodeId, props, prev, state) end,
  tick    = function(nodeId, state, dt, pushEvent) end,
  destroy = function(nodeId, state) end,
})
```

Do not hardcode capability names anywhere in `init.lua` or `painter.lua`. If you find yourself doing that, you have missed the pattern.

## Defensive coding — the rules

**Never crash.** Every function that can receive external input (props from JS, file paths, color strings, FFI values) must handle garbage gracefully:

```lua
local s = node.style or {}                 -- props may be nil
local w = tonumber(s.width) or 0           -- width may be a string or nil
if type(hex) ~= "string" then return 1,1,1,1 end  -- color fallback
```

**Never assume depth.** Recursive functions that walk the node tree or convert JS values must carry a depth counter and bail with a print at a reasonable limit (32 is standard here).

**Wrap IO.** `pcall` around anything that touches files or FFI that can throw.

**Pre-allocate FFI buffers.** Never `ffi.new(...)` inside a hot path. Declare buffers at module level and reuse them:

```lua
local _double_buf = ffi.new("double[1]")  -- module top-level
-- ... later in hot path:
_double_buf[0] = value
```

**Two-phase FFI array conversion.** When converting JS arrays via QuickJS FFI, pin all elements with `JS_DupValue` before converting any of them. Converting while holding un-pinned refs creates GC races. See `bridge_quickjs.lua:jsValueToLua` for the pattern.

## Color

All color parsing goes through `color.lua`. Do not reimplement hex-to-RGB anywhere else. Use `Color.set(r, g, b, a)` or `Color.parse(hex)`. This is the single source of truth.

## Logging

Use `debug_log.lua`. All channels are off by default. Channel names are lowercase: `layout`, `tree`, `events`, `paint`, `bridge`, `recon`, `dispatch`, `focus`, `animate`. Comments explain the *why*, not the *what*:

```lua
Log.log("events", "hitTest (%d,%d) -> id=%s type=%s", mx, my, node.id, node.type)
```

Do not use `print()` for anything other than genuine errors or one-off debugging you intend to remove. Persistent diagnostic output belongs in a log channel.

## Layout rules you must not break

- The three-tier resolution order is explicit in `layout.lua`: explicit sizing → content auto-sizing → proportional surface fallback (1/4 of parent). Do not add a fourth tier without updating all three places that encode this assumption.
- Surfaces (Box/View, Image, Video, Scene3D) get the proportional fallback. Interactive nodes (Text, TextInput, Pressable, CodeBlock) and ScrollView do not.
- ScrollView has explicit height. Do not let it participate in proportional fallback — it breaks scroll viewports.
- Z-index sorting is **stable insertion sort**, not quicksort. Equal Z-indices must preserve tree order. Do not swap this for a faster unstable sort.

## Scroll hit testing

When hit testing inside a scroll container, transform the mouse coordinates by scroll offset before checking children. The children's layout rectangles are in scroll-space, not screen-space:

```lua
if isScroll and node.scrollState then
  childMx = mx + (node.scrollState.scrollX or 0)
  childMy = my + (node.scrollState.scrollY or 0)
end
```

Missing this produces "clicks land in the wrong place after scrolling" bugs that are hard to trace.

## Text and UTF-8

All text cursor math must walk bytes, not characters. A single Unicode codepoint can be 1–4 bytes. Moving left means walking back past continuation bytes (`0x80`–`0xBF`). See `textinput.lua:moveCursorLeft` for the canonical implementation. Do not use `#string` for codepoint length — use the UTF-8 walk pattern.

## The permit system

Any RPC handler that accesses clipboard, storage, network, sensors, or other privileged resources must wrap with the `gated()` helper from `permit.lua`. Ungated handlers are security holes. The pattern:

```lua
local function gated(category, handler, details_fn)
  return function(args)
    if not permit.check(category) then
      audit.log("blocked", category, details_fn and details_fn(args) or {})
      return nil, "capability denied: " .. category
    end
    return handler(args)
  end
end
```

## Visual polish standards

Lua-owned widgets are expected to look as good as their native counterparts. That means:

- **Drop shadows** use two-pass techniques (offset fill + blur approximation), not a single dark circle.
- **Knobs, sliders, faders** have halos and edge anti-aliasing. See `slider.lua:drawSoftCircle`.
- **Hover and focus states** are distinct and animated (eased, not instant).
- **Disabled states** desaturate and reduce opacity — never just hide the widget.

If you are adding a new widget and it looks "flat" or "programmer art," you are not done.

## What init.lua is

`init.lua` is the **RPC orchestrator**, not a dumping ground. Its jobs:
1. Require and wire all modules together.
2. Define the RPC dispatch table — one handler per JS call.
3. Drive the frame loop: receive commands → apply tree mutations → layout → paint → drain events.
4. Nothing else.

If you are adding a feature and you find yourself writing significant logic inside `init.lua`, move it into the appropriate module and expose a clean API. The handler in `init.lua` should be a thin call into that module.

## File tiers — impact of changes

| Tier | Files | Rule |
|------|-------|------|
| **Core** | `init.lua`, `layout.lua`, `tree.lua`, `events.lua`, `bridge_quickjs.lua` | Every change here has framework-wide consequences. Read every call site before modifying. |
| **Target / Paint** | `sdl2_init.lua`, `sdl2_painter.lua`, `sdl2_gl.lua`, `sdl2_measure.lua`, `sdl2_font.lua`, `target_sdl2.lua` (primary); `painter.lua`, `measure.lua`, `target_love2d.lua` (legacy) | The rendering surface. SDL2 files are the active focus. |
| **Infrastructure** | `capabilities.lua`, `capabilities/`, `errors.lua`, `debug_log.lua`, `zindex.lua`, `color.lua`, `focus.lua` | Used by multiple modules. A wrong change breaks things in unexpected places. |
| **Lua-owned components** | `slider.lua`, `textinput.lua`, `texteditor.lua`, `switch.lua`, `checkbox.lua`, `select.lua`, `animate.lua` | Self-contained. Changes affect one widget type. Still read the whole file before touching. |
| **Feature modules** | `images.lua`, `videos.lua`, `http.lua`, `sqlite.lua`, `permit.lua`, `audit.lua`, etc. | Semi-independent. Check `init.lua` for how they are wired before changing their API. |

## The mindset

This is game engine code, not app server code. The frame budget is 16ms for 60fps. Memory allocation in the hot path creates GC pressure. State on the node is fine. A round-trip to JS is expensive. Inline nil-checks are cheaper than helper functions. Comments explain *why* the code does what it does, because the *what* is usually obvious from the code itself.

When something "almost works" — measure it. When a layout is "close enough" — run `reactjit lint` and `reactjit screenshot`. When a widget "looks okay" — check it on a small window and a large one. This codebase has a high standard for correctness and a zero-tolerance policy for "it works on my machine."
