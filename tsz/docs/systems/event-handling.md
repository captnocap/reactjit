# Event Handling

How user interactions compile to Zig handler functions.

## Overview

Event handlers in tsz use React-like syntax (`onPress`, `onScroll`, etc.) but compile to standalone Zig functions. The compiler parses the handler body, resolves state references, and emits a function that directly manipulates state slots. There is no event object, no synthetic event system, no bubbling.

## Supported Events

| Event | Element | Description |
|-------|---------|-------------|
| `onPress` | `Pressable` | Touch/click interaction |
| `onScroll` | `ScrollView` | Scroll position change |
| `onChangeText` | `TextInput` | Text value change |
| `onSubmit` | `TextInput` | Enter key pressed |
| `onHover` | Any | Mouse hover (enter) |
| `onHoverEnd` | Any | Mouse hover (leave) |

## Basic Usage

```tsx
function App() {
  const [count, setCount] = useState(0);

  return (
    <Pressable onPress={() => { setCount(count + 1) }}>
      <Text>{`Count: ${count}`}</Text>
    </Pressable>
  );
}
```

## Compilation

The handler `() => { setCount(count + 1) }` compiles to:

```zig
fn _handler_press_0() void {
    state.setSlot(0, state.getSlot(0) + 1);
}
```

The compiler (`handlers.zig`):
1. Parses the arrow function body as a statement block
2. Resolves `count` → `state.getSlot(N)` using the state slot table
3. Resolves `setCount(expr)` → `state.setSlot(N, expr)`
4. Emits the handler as a named Zig function
5. Binds the function pointer to the node's event callback

## Handler Body Statements

Handlers support a subset of TypeScript statements:

### State mutations
```tsx
onPress={() => { setCount(count + 1) }}
onPress={() => { setActive(!active) }}
onPress={() => { setLabel("clicked") }}
```

### Multiple statements
```tsx
onPress={() => {
  setCount(0);
  setLabel("reset");
  setActive(false);
}}
```

### Conditionals
```tsx
onPress={() => {
  if (count > 10) {
    setCount(0);
  } else {
    setCount(count + 1);
  }
}}
```

### Navigation
```tsx
onPress={() => { navigate('/about') }}
```

Compiles to `router.push("/about")`.

### FFI calls
```tsx
onPress={() => { resetSensor() }}
```

If `resetSensor` is a declared FFI function, it's called directly.

### Console logging
```tsx
onPress={() => { console.log("clicked") }}
```

Compiles to `log.info(.events, "clicked", .{})`.

## Expression Chain

Handler expressions go through a precedence chain in `handlers.zig`:

```
emitStateExpr → emitTernary → emitOr → emitAnd →
emitEquality → emitComparison → emitAddSub →
emitMulDiv → emitUnary → emitStateAtom
```

Each level handles its operators and delegates to the next level for higher-precedence subexpressions. `emitStateAtom` resolves:
- State getter references (`count` → `state.getSlot(N)`)
- Numeric/string/boolean literals
- FFI function calls
- Utility function calls
- Ternary expressions

## TextInput Events

```tsx
<TextInput
  onChangeText={(text) => { setQuery(text) }}
  onSubmit={() => { doSearch() }}
/>
```

`onChangeText` receives the input text as a parameter. `onSubmit` fires on Enter key.

## Known Limitations

- No event object — handlers don't receive event metadata (coordinates, modifiers)
- No event bubbling or capturing — handlers fire on the exact element
- No `preventDefault` or `stopPropagation`
- No async handlers — all handler code is synchronous
- The `<` operator in handler bodies may be misinterpreted as JSX — use `count > i` instead of `i < count`
- Handler bodies must be inline arrow functions — no function references
- No `for`/`while` loops in handlers (use utility functions for complex logic)
