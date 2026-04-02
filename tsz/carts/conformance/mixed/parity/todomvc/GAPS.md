# TodoMVC React Parity — Compiler Gap Report

Source: [tastejs/todomvc](https://github.com/tastejs/todomvc/tree/master/examples/react) (React 17, useReducer + hooks)

## Status: COMPILES AND RUNS

The TodoMVC port builds and renders. Core display loop works. Interactive features (add/toggle/filter/clear) wired through script. The following gaps were hit and documented during conversion.

---

## G1: Ternary color expressions in .map() style props

**Severity**: HIGH — blocks dynamic per-item styling
**Pattern**: `color={todo.completed ? '#d9d9d9' : '#4d4d4d'}`
**What happens**: Compiler emits `if (_item.completed != 0) '#5dc2af' else '#ededed'` — single-quoted hex strings are not valid Zig. Color.rgb() expects integers.
**Root cause**: The style expression evaluator doesn't resolve ternary→Color.rgb() at codegen time for map items.
**Workaround**: Use static colors; encode completion status in the text content (prefix with ✓).
**Fix difficulty**: MEDIUM — needs ternary-aware Color.rgb() emission in emit.zig style codegen for map inner nodes.

## G2: .map() item property access requires object array schema

**Severity**: HIGH — blocks real React data binding
**Pattern**: `{item.text}` inside `.map()` with `useState([])`
**What happens**: `useState([])` creates an int array slot. The `.map()` codegen emits `state.getArraySlot(N)` returning `[]const i64`. Property access on i64 fails.
**Root cause**: Empty array `useState([])` doesn't provide a schema. The compiler needs at least one template object.
**Workaround**: Initialize with `useState([{ text: '' }])` to trigger the object array path. The compiler already has full `is_object_array` support in emit.zig with per-field string arrays — it just needs a type hint.
**Fix difficulty**: LOW — could infer schema from first `.map()` access pattern, or accept `useState<{text: string}>([])` type annotation.

## G3: No per-item event handler index passing

**Severity**: HIGH — blocks toggle/delete per item
**Pattern**: `onPress={() => toggleItem(index)}` inside `.map()`
**What happens**: `onPress` handlers inside `.map()` compile but can't pass the iteration index to the script function. `todo_toggle()` has no way to know WHICH item was pressed.
**Root cause**: Handler codegen emits `qjs_runtime.callGlobal("todo_toggle")` with no arguments. The map index `_i` is not passed through.
**Workaround**: None clean. Could use a global "last pressed index" set by the engine, or split into per-index handlers (not scalable).
**Fix difficulty**: MEDIUM — handler codegen needs to capture `_i` from the map loop and pass it as an argument to `callGlobal`.

## G4: No onDoubleClick event

**Severity**: LOW — only affects inline edit mode
**Pattern**: `onDoubleClick={handleDoubleClick}` on todo item labels
**What happens**: Not recognized by the compiler. The event system only has: onPress, onHoverEnter, onHoverExit, onKey, onChangeText, onScroll, onRightClick.
**Workaround**: Not implemented (inline editing skipped).
**Fix difficulty**: LOW — add `on_double_click` to events.zig, wire through engine event loop (SDL already reports double-click).

## G5: No onKeyDown with key detection

**Severity**: MEDIUM — blocks Enter-to-submit pattern
**Pattern**: `onKeyDown={(e) => { if (e.key === 'Enter') onSubmit(e.target.value) }}`
**What happens**: No `onKeyDown` event on TextInput. Only `onSubmit` exists.
**Root cause**: The engine fires `on_change_text` on text mutation and there's a submit path, but no per-key event with key code.
**Workaround**: Use `onSubmit` on TextInput (the engine handles Enter key internally and fires submit).
**Fix difficulty**: MEDIUM — need to add onKeyDown to events.zig with key code passing.

## G6: useReducer / useCallback / useMemo / memo not supported

**Severity**: LOW — not needed for native rendering
**Pattern**: `const [todos, dispatch] = useReducer(todoReducer, [])`
**What happens**: Compiler doesn't recognize `useReducer`.
**Workaround**: Replace with `useState` + script-side reducer logic. Since tsz has no React reconciler, memoization hooks are unnecessary — the engine diffs the node tree directly.
**Fix difficulty**: N/A — architectural difference, not a bug.

## G7: No react-router (URL-based routing)

**Severity**: LOW — only affects filter tabs
**Pattern**: `const { pathname: route } = useLocation()`
**What happens**: No routing system.
**Workaround**: Use state-based filter (`todo_filter_all/active/completed` script functions).
**Fix difficulty**: N/A — native apps don't have URL routing. Could add a Tab/Router component.

## G8: No conditional rendering (ternary in JSX body)

**Severity**: MEDIUM — blocks show/hide sections
**Pattern**: `{isWritable ? <Input .../> : <><input .../><label .../>...</>}`
**What happens**: Ternary in JSX body position compiles but can't produce/destroy nodes at runtime. The node tree is static.
**Root cause**: .tsz compiles to a static Zig node tree. Conditional rendering would require a node pool or runtime tree mutation.
**Workaround**: Show all sections always, or use display/visibility state (not yet supported).
**Fix difficulty**: HIGH — requires dynamic node tree or display toggling support in the layout engine.

## G9: HTML elements mapped to primitives

**Severity**: LOW — expected for native rendering
**Pattern**: `<header>`, `<footer>`, `<main>`, `<li>`, `<ul>`, `<input type="checkbox">`
**What happens**: HTML elements don't exist in the native renderer.
**Workaround**: Map to Box, Text, Pressable, TextInput, ScrollView. All TodoMVC UI is expressible with these 5 primitives.
**Fix difficulty**: N/A — by design.

## G10: onChangeText handler parameter `t` not in scope

**Severity**: MEDIUM — blocks reading text in handler
**Pattern**: `onChangeText={(t) => { setInputText(t); pii_scan(t) }}`
**What happens**: Handler compiles as `fn() void` — no text parameter. The generated code references `t` but it's undeclared.
**Root cause**: Handler codegen for `on_change_text` doesn't pass the new text value as a parameter.
**Workaround**: Use `onChangeText={() => scriptFn()}` (parameterless) and read text via `getInputText(input_id)` from the script.
**Fix difficulty**: LOW — change handler signature to `fn([]const u8) void` and pass the text.

---

## Summary

| Gap | Severity | Blocks | Fixable |
|-----|----------|--------|---------|
| G1 | HIGH | Per-item dynamic colors | MEDIUM |
| G2 | HIGH | Data-driven lists | LOW (schema hint) |
| G3 | HIGH | Per-item interactions | MEDIUM |
| G4 | LOW | Inline editing | LOW |
| G5 | MEDIUM | Key event handling | MEDIUM |
| G6 | LOW | Nothing (by design) | N/A |
| G7 | LOW | Nothing (by design) | N/A |
| G8 | MEDIUM | Show/hide sections | HIGH |
| G9 | LOW | Nothing (by design) | N/A |
| G10 | MEDIUM | Text handler args | LOW |

**Verdict**: The critical path to full TodoMVC interactivity is G3 (per-item handler index). Fix G3 and the add/toggle/delete/filter loop works end-to-end. G2 is already solved with the template object hint. G1 and G8 are visual polish.
