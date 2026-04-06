# Lua Tree Architecture

**This is Smith’s current default for app UI:** Lua owns the tree and state; Zig paints (stamps Lua tables into `layout.Node`).

Lua owns the tree and state. Zig paints.

## Three layers

```
┌─────────────────────────────────────┐
│  .tsz source (author writes this)   │
│  Box, Text, Pressable, .map(), etc  │
└──────────────┬──────────────────────┘
               │ compile
               ▼
┌─────────────────────────────────────┐
│  Lua runtime (owns tree + state)    │
│  declareChildren, setState, atoms   │
│  recursive components, .map(), all  │
└──────────────┬──────────────────────┘
               │ shared memory / FFI
               ▼
┌─────────────────────────────────────┐
│  Zig paint (reads tree, draws)      │
│  layout.zig, wgpu, SDL3, FreeType   │
└─────────────────────────────────────┘
```

## What the compiler emits

One Lua file per .tsz app. The Lua file contains:

1. **Component functions** — each component is a Lua function that returns a node table
2. **State atoms** — `_state = {}` shared pool, Lua owns, Zig reads via FFI
3. **Root render** — calls App(), stamps the tree, registers handlers
4. **Dirty callback** — on state change, re-render affected subtree, call declareChildren

## State: shared atom pool

```lua
local _state = {}

function setState(key, value)
  _state[key] = value
  _markDirty()
end

function getState(key)
  return _state[key]
end
```

Zig reads Lua state through **`luajit_runtime`** (Lua C API today; optional **zluajit** wrapper per [ZLUAJIT_EVALUATION.md](../../../../docs/ZLUAJIT_EVALUATION.md)) when resolving dynamic text/style/conditionals after stamping.
No JSON bridge for the hot path — host functions and stamping own the boundary.

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

| Current | New |
|---------|-----|
| State in Zig (`state.zig` slots) | State in Lua (`_state = {}`) |
| Static node tree in Zig | Lua builds tree, stamps to Zig Nodes |
| Map content: complex OA/pool/rebuild | Map content: Lua loop |
| Conditionals: Zig display toggle | Conditionals: Lua if/else, re-stamp |
| Dynamic text: Zig bufPrint | Dynamic text: Lua tostring |
| Handlers: Zig fn ptrs or eval | Handlers: Lua closures |
| 800-line lua_maps.js | Lua loop with substitution table |

## What stays the same

- layout.zig (flexbox engine)
- painter/wgpu (GPU rendering)
- SDL3 (window, input, events)
- FreeType (text measurement)
- .tsz syntax (author-facing)
- Substitution rules (the napkin)
