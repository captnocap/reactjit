# Lua Map Emit Pattern

Every `.map()` body produces the same Lua shape. No exceptions.

## Wrapper

```lua
function __rebuildLuaMap{N}()
  __clearLuaNodes()
  local wrapper = __mw{N}
  if not wrapper then return end
  local items = __luaMapData{N}
  if not items or #items == 0 then
    __declareChildren(wrapper, {})
    return
  end
  local tmpl = {}
  for _i, _item in ipairs(items) do
    tmpl[#tmpl + 1] = {BODY}
  end
  __declareChildren(wrapper, tmpl)
end
```

`{N}` is the map index. `{BODY}` is a Lua table literal, always.

## Body shape

The body is always a Lua table. Every element becomes one table. Tables nest via `children`.

```lua
{
  style = { field = value, field = value },
  text = "literal" or tostring(_item.field) or "a" .. tostring(_item.b) .. "c",
  font_size = 14,
  text_color = 0xff6600,
  lua_on_press = "handlerName(" .. (_item.id) .. ")",
  children = {
    { ... },
    { ... },
    (_item.done == 1) and { ... } or nil,
    (not (_item.done == 1)) and { ... } or nil,
    (_item.field ~= "") and { ... } or nil,
  }
}
```

All fields optional. `children` is recursive — same table shape all the way down.

## Substitution rules

These are the ONLY translations. Every value in the body table comes from one of these.

| Source (.tsz)              | Lua output                              |
|----------------------------|-----------------------------------------|
| `#ff6600`                  | `0xff6600`                              |
| `{item.field}`             | `_item.field`                           |
| `{idx}`                    | `(_i - 1)`                              |
| `` {`text ${item.x}`} ``  | `"text " .. tostring(_item.x)`          |
| `===`                      | `==`                                    |
| `!==`                      | `~=`                                    |
| `&&`                       | `and`                                   |
| `cond ? <A/> : <B/>`      | `(cond) and {A} or nil` + `(not (cond)) and {B} or nil` |
| `cond && <A/>`             | `(cond) and {A} or nil`                 |
| `camelCase` style key      | `snake_case`                            |
| `'row'` / `'none'` etc    | `"row"` / `"none"`                      |
| `100%`                     | (percentage — pass as string `"100%"`)  |

## Style keys

Style is always a flat table. camelCase from .tsz becomes snake_case in Lua.

```
backgroundColor  -> background_color
borderRadius     -> border_radius
flexDirection    -> flex_direction
alignItems       -> align_items
justifyContent   -> justify_content
paddingLeft      -> padding_left
paddingRight     -> padding_right
paddingTop       -> padding_top
paddingBottom    -> padding_bottom
borderWidth      -> border_width
borderColor      -> border_color
flexGrow         -> flex_grow
flexShrink       -> flex_shrink
alignSelf        -> align_self
marginBottom     -> margin_bottom
```

Static values are literals. Dynamic values use `_item.field` directly.

```lua
-- static
style = { background_color = 0x0f172a, border_radius = 6, padding_left = 10 }

-- dynamic
style = { background_color = _item.label_bg, border_radius = 6 }
```

## Text content

Three forms:

```lua
-- static string
text = "hello"

-- field reference
text = tostring(_item.title)

-- template literal
text = "Score: " .. tostring(_item.points) .. " pts"
```

## Handlers

Static handler (no item data):
```lua
lua_on_press = "doThing()"
```

Dynamic handler (uses item field):
```lua
lua_on_press = "toggleTodo(" .. (_item.id) .. ")"
```

Dynamic handler with index:
```lua
lua_on_press = "upvote(" .. ((_i - 1)) .. ")"
```

## Nested maps

When a map body contains another `.map()`, use `__luaNestedMap`:

```lua
children = {
  __luaNestedMap(_item.subItems, function(_nitem, _ni)
    return { text = tostring(_nitem.name) }
  end)
}
```

Inner map uses `_nitem` / `_ni` to avoid shadowing outer `_item` / `_i`.

## Component inlining

If the map body contains `<UserComponent prop={item.field} />`, inline the component's JSX body with prop values substituted. The result is the same table shape — components don't create a new concept, they just expand into more tables.

## What this means for a030

Atom 30 should EMIT this Lua by walking the parsed JSX tree from ctx. Apply the substitution table above. Produce the wrapper + body. That's it. No separate token walker. No 800-line parallel parser. Same parsed tree, same substitutions, same table shape.
