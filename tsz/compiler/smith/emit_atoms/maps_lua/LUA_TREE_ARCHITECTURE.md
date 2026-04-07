# Lua Tree Architecture

**Smith’s default app emit:** `**LUA_LOGIC`** builds the UI as **Lua tables**; `**__declareChildren`** stamps them into Zig `**layout.Node**`; **layout and paint** run in Zig.

**Important:** “State” is **not** only Zig `state.zig` slots. Carts often have **Lua-local** `_state` / globals, **and** `**JS_LOGIC`** vars in QuickJS, **and** Zig slots when bridged. See [ARCHITECTURE.md](../../../../docs/ARCHITECTURE.md) § *Where runtime work actually happens*.

## Three layers (compile → runtime)

```
┌─────────────────────────────────────┐
│  .tsz source (author writes this)   │
│  Box, Text, Pressable, .map(), etc  │
└──────────────┬──────────────────────┘
               │ Forge + Smith
               ▼
┌─────────────────────────────────────┐
│  LuaJIT — LUA_LOGIC                 │
│  Tree tables, lua_on_press, __render│
│  Lua heap state + __markDirty → Zig │
└──────────────┬──────────────────────┘
               │ host FFI (stamp, dirty)
               ▼
┌─────────────────────────────────────┐
│  Zig — Node graph, layout, paint    │
│  engine, layout.zig, gpu, SDL3      │
└─────────────────────────────────────┘
         ▲
         │ __eval, evalLuaMapData, JS_LOGIC
┌────────┴────────────────────────────┐
│  QuickJS — JS_LOGIC + eval harness    │
└─────────────────────────────────────┘
```

## What the compiler emits

One Lua file per .tsz app. The Lua file contains:

1. **Component functions** — each component is a Lua function that returns a node table
2. **State in Lua** — `_state = {}` and/or globals the emitter mirrors; values live in the **Lua VM** until restamp
3. **Optional `JS_LOGIC`** — parallel **QuickJS** vars/setters; map data may flow **QJS → Lua** via `__luaMapData*` / `evalLuaMapData`
4. **Root render** — `__render` clears/stamps, may pull `__luaMapData*` before `App()`
5. **Dirty** — `__markDirty()` calls into **Zig** so the engine re-layouts after Lua/JS updates

## State: where values actually live

Emitters may combine **all** of the following in one cart:


| Location                  | Example                                                          | Notes                                                                     |
| ------------------------- | ---------------------------------------------------------------- | ------------------------------------------------------------------------- |
| **Lua heap**              | `local _state = {}`, `expandedProject`, `projects = {}`          | Primary for many lua-tree UIs; `setX(v)` updates Lua then `__markDirty()` |
| **QJS heap**              | `var projects = []; function setProjects(v) { … }` in `JS_LOGIC` | Init / script-side data; may feed Lua through eval bridges                |
| **Zig `state.zig` slots** | `__setState(slot, n)` from JS/Lua when wired                     | O(1) bridge when the compiler emits slot IDs                              |


Zig does **not** automatically mirror every Lua key into slots — **read the generated `logic.zig`** for the cart. Stamping reads **Lua tables** to build **Zig `Node`** fields (text, style, handler strings).

Host access uses `**luajit_runtime**` (Lua C API; optional **zluajit** per [ZLUAJIT_EVALUATION.md](../../../../docs/ZLUAJIT_EVALUATION.md)).

```lua
local _state = {}
function setExpandedProject(v)
  _state["expandedProject"] = v
  expandedProject = v
  __markDirty()  -- → Zig
end
```

## Tree: Lua tables → Zig Node pointers

Lua builds a tree of tables:

```lua
{ style = { ... }, text = "hello", children = { ... } }
```

`__declareChildren(parent_ptr, children_table)` walks the Lua table and stamps
Zig `Node` structs. This function already exists in `luajit_runtime.zig`.

## Components: just Lua functions

```lua
-- Compiler emits this from: function Button({label}) { return <Pressable>... }
function Button(props)
  return {
    style = { padding = 12, background_color = 0x3b82f6, border_radius = 8 },
    children = {
      { text = tostring(props.label), text_color = 0xffffff }
    }
  }
end
```

## Maps: just Lua loops

```lua
-- Compiler emits this from: {items.map((item) => <Box>...)}
local tmpl = {}
for _i, _item in ipairs(getState("items")) do
  tmpl[#tmpl + 1] = {
    style = { padding = 12, background_color = 0x0f3460 },
    children = {
      { text = tostring(_item.label) },
      { text = tostring(_item.count) }
    }
  }
end
__declareChildren(wrapper, tmpl)
```

No map pools. No OA arrays. No rebuild functions. Just a loop.

## Recursive components: just Lua recursion

```lua
function RecursiveCard(node, depth)
  local children = {}
  for _, child in ipairs(node.children) do
    children[#children + 1] = RecursiveCard(child, depth + 1)
  end
  return {
    style = { padding = 8, margin = 4, border_width = 1 },
    text = tostring(node.value),
    children = children
  }
end
```

No depth limits. No pre-allocated slots. Lua's stack handles it.

## Conditionals: just Lua if/else

```lua
-- from: {mode === 0 ? <BoxA/> : <BoxB/>}
local child
if getState("mode") == 0 then
  child = { style = { background_color = 0x0f3460 }, text = "Mode A" }
else
  child = { style = { background_color = 0x533483 }, text = "Mode B" }
end
```

## Handlers: Lua closures

```lua
-- from: onPress={() => setCount(count + 1)}
lua_on_press = function()
  setState("count", getState("count") + 1)
end
```

## What Zig does

1. Call `luajit_runtime.init()` — loads the emitted Lua
2. Each frame: check if Lua marked dirty
3. If dirty: Lua already rebuilt the tree via `__declareChildren`
4. Layout pass on the Zig Node tree (unchanged — layout.zig)
5. Paint pass (unchanged — painter/wgpu)
6. Event dispatch: on press → call the Lua closure

## What changes from current architecture


| Current                              | New                                  |
| ------------------------------------ | ------------------------------------ |
| State in Zig (`state.zig` slots)     | State in Lua (`_state = {}`)         |
| Static node tree in Zig              | Lua builds tree, stamps to Zig Nodes |
| Map content: complex OA/pool/rebuild | Map content: Lua loop                |
| Conditionals: Zig display toggle     | Conditionals: Lua if/else, re-stamp  |
| Dynamic text: Zig bufPrint           | Dynamic text: Lua tostring           |
| Handlers: Zig fn ptrs or eval        | Handlers: Lua closures               |
| 800-line lua_maps.js                 | Lua loop with substitution table     |


## What stays the same

- layout.zig (flexbox engine)
- painter/wgpu (GPU rendering)
- SDL3 (window, input, events)
- FreeType (text measurement)
- .tsz syntax (author-facing)
- Substitution rules (the napkin)

