# Cursor IDE — Session Handoff

## What We Built

The cursor-ide cart (`tsz/carts/conformance/mixed/cursor-ide/`) is a Cursor IDE clone — a real app pushing every compiler edge. 13 files, 531 lines of .tsz source, compiles to 54KB native binary in 458ms.

**What renders:** Sidebar file tree (19 items with TS/MD/CS type badges + directory chevrons), tab bar with click-to-open tabs, editable TextInput editor area, AI chat panel with 3 messages + input, status bar with auto-margin right-alignment, breadcrumbs, Search/Terminal/Chat toggle buttons in top bar.

**Autotest:** `tsz/tests/cursor-ide.autotest` — 60/64 PASS, 4 FAIL.

## Compiler Fixes Made This Session

Every fix is committed on main. These are real compiler/runtime bugs found by building a real app:

1. **OA item ref marker** (`core.js`, `component_brace_values.js`) — passing whole map item as component prop (`file={file}`) stores `\x02OA_ITEM:oaIdx:iterVar:itemParam` marker. `peekPropsAccess` resolves `props.file.icon` → `_oa0_icon[_i]`. All `skipPropsAccess` callers updated.

2. **Color.rgba in Lua** (`lua_map_style.js`) — 8-digit hex `#2d62ff20` now converts to `0xRRGGBB` in Lua (alpha dropped), not `__eval("Color.rgba()")`.

3. **TypeScript stripping** (`lua_tree_emit.js`, `transforms.js`) — `var x: any`, `declare function`, `export {}` stripped from JS_LOGIC for QuickJS.

4. **props.X in Lua conditionals** (`conditional.js`) — `_buildLuaCondFromTokens` resolves `propsObjectName.field` + `.length` → `#str`.

5. **props.children forwarding** (`brace.js`) — `{props.children}` now works (was only `{children}`).

6. **Conditional props.children** (`conditional.js`) — `{condition && props.children}` injects children with conditional wrapping, preserving `_luaMapWrapper` → `__mapLoop` conversion.

7. **Lua truthiness** (`ternary.js`) — bare values in ternary conditions wrapped with `~= 0` (Lua treats 0 as truthy unlike JS).

8. **Render-local resolution** (`conditional.js`) — map item param aliasing, `.len` → `#`, compound expression paren wrapping.

9. **props.X.map() → _luaMapWrapper** (`brace.js`) — maps from prop resolution now create `_luaMapRebuilders` entries for lua-tree emit.

10. **js_on_press routing** (`build_node.js`, `press.js`) — `function()` handlers (not just arrows) now have jsBody parsed. Handler refs `_handler_press_N` route to JS. Forwarded handler refs in Lua body detected and switched to JS.

11. **margin: auto** (`classifiers.js`, `build_node.js`, `luajit_runtime.zig`, `layout.zig`) — Full stack: classifier emits `std.math.inf(f32)`, build_node converts to `"auto"`, Lua runtime reads `"auto"` → inf, layout `marLeft/Right/Top/Bottom` clamp inf to 0 for size calc, auto-margin distribution applies. **Also fixed:** margin start applied BEFORE child positioning (was after — every marginLeft was broken).

12. **TextInput value binding** (`attrs_basic.js`, `build_node.js`, `lua_map_node.js`, `luajit_runtime.zig`) — TextInput `value={expr}` emits `text_input=true`, `input_id`, `text=tostring(var)`. Lua runtime reads these fields.

13. **Flight check fixes** (`flight-check`) — setter delegation detection (1-line lookahead), `js_on_press` strings excluded from Zig `if()` leak check.

14. **String state sync** (`lua_tree_emit.js`) — `__luaEscStr` helper escapes newlines/quotes/backslashes for JS→Lua string state transfer via `__luaEval`.

## 4 Remaining Failures (60/64)

All the same pattern — file content doesn't switch when clicking sidebar files:

### Bug A: `props . _handler_press_3(5)` in js_on_press
The sidebar file click handler `onPress={function() { props.onSelectFile(idx); }}` resolves `onSelectFile` to `_handler_press_3` but keeps the `props .` prefix. The JS handler body prop resolution in `build_node.js` line 757-780 resolves props for the Lua path but the `props.` prefix from `_jsExprToLua` isn't being stripped. The raw luaBody has `props . onSelectFile` which gets the prop VALUE substituted but not the `props .` prefix removed.

**Fix needed:** In the Lua→JS handler resolution at `build_node.js:757-780`, after prop substitution, strip any remaining `props .` or `props.` prefixes.

### Bug B: `updateEditorContent ( text )` — text is not defined
The TextInput onChange handler `onChange={props.onChange}` resolves to `updateEditorContent(text)` but `text` is a placeholder variable that the runtime should provide as the TextInput's current content. The Zig input system passes text via the handler dispatch, but the Lua/JS path doesn't bridge this.

**Fix needed:** The `js_on_press` handler for TextInput needs to receive the current input text. The runtime's `js_on_press` dispatch should pass `text` as a variable in the eval context, or the handler should be rewritten to use the runtime's text input API.

### Bug C: File content state sync
Even when the handler works, `setEditorContent(newContent)` from JS calls `__luaEval("setEditorContent('...')")`. The Lua setter updates `editorContent` and calls `__markDirty()`. The re-render evaluates `text = tostring(editorContent)` which SHOULD be the new content. But the autotest `expect` doesn't find it — unclear if it's a rendering issue or autotest visibility (TextInput text may not appear in the witness search).

## Architecture Notes

- Cart uses lua-tree emit path (`lua_tree_emit.js`) — Lua owns the entire tree, Zig provides root + paint
- State: scalar slots in Lua globals + JS_LOGIC mirrors, OA arrays synced via `evalLuaMapData`
- Handlers: `lua_on_press` for setter-only, `js_on_press` for script functions
- Maps: `__mapLoop(arr, function(_item, _i) return {...} end)` in Lua tree
- Script: `.script.tsz` import → content in JS_LOGIC via `globalThis.__scriptContent`
- Components: inlined at parse time, props via `propStack`, maps via `_luaMapWrapper`

## Key Files
- `cursor-ide.tsz` — main app (state, layout, component composition)
- `cursor.script.tsz` — file operations, tab management, chat, terminal
- `cursor.cls.tsz` — 100+ named styles (dark theme)
- `Sidebar.c.tsz` — file tree with inline conditionals for type badges
- `Editor.c.tsz` — TextInput editor with line count
- `ChatPanel.c.tsz` — AI chat with messages + input
- `StatusBar.c.tsz` — status bar with auto-margin right section
- `TopBar.c.tsz` — panel toggle buttons
- `TabBar.c.tsz` — tab management (still uses if/else — compiler gap)
- `Terminal.c.tsz` — terminal panel
- `SearchPanel.c.tsz` — search panel
