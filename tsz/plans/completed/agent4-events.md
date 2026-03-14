# Agent 4: Event System Expansion

## What This Is

tsz is a compiler that takes `.tsz` files (React-like syntax) and compiles them to native Zig binaries. The compiler is in `tsz/compiler/`, the runtime is in `tsz/runtime/`. You're working on **both** — expanding the event system in the runtime and wiring it through the compiler.

## Your Mission

1. Add `onChangeText` runtime callback support for TextInput
2. Add `onScroll` runtime callback support for ScrollView
3. Refactor compiler handler emission so multiple handler fields can coexist on one node
4. Optionally wire `onKeyDown` if it stays clean
5. **Keep handlers as single-expression lambdas.** Do not add block-bodied `() => { stmt; stmt; }` parsing — that's a separate plan.

**Other agents are working on other parts of codegen.zig in parallel.** Your changes should be confined to:
- `tsz/runtime/events.zig` (full ownership)
- `tsz/runtime/input.zig` (full ownership)
- `tsz/runtime/main.zig` — scroll handler dispatch only (see constraints below)
- `tsz/compiler/codegen.zig` lines 465-518 (attribute parsing for handlers) and lines 687-699 (handler emission) and lines 1006-1103 (`emitHandlerExpr`)
- A new test example `tsz/examples/events-test.tsz`

## Important Constraints

- **Do not add multi-statement handler bodies.** Handlers remain single-expression lambdas: `() => setSomething(value)`. Block-bodied handlers `() => { stmt; stmt; }` are a separate future plan.
- **Do not modify `lexer.zig`** — Agent 1 owns that.
- **Do not modify `state.zig`** — Agent 2 owns that.
- **Do not modify `emitStateExpr`/`emitStateAtom`** (lines 1105-1163) — Agent 1 owns those.
- **Do not modify `collectStateHooks`** (lines 373-422) — Agent 2 owns that.
- **Do not modify the JSX children loop** (lines 558-604) — Agent 3 owns that.
- **main.zig changes:** Only add the scroll handler callback dispatch after scroll mutation. Do not restructure the event loop, change hit-testing semantics, or change input focus logic.
- **TextInput IDs are compile-time stable** and used as the registration key for onChange callbacks. This is already the case in the current system.
- **`onScroll` fires once per wheel input event.** This is intentional for v0. Not batched, not debounced.
- **`getText(<id>)` is a simple handler expression helper only.** Only numeric literal IDs. Only in handler expression position. No arbitrary nested args. No auto-binding of "current input."

## Step 1: Expand EventHandler struct

File: `tsz/runtime/events.zig`

### Current struct (lines 14-19):
```zig
pub const EventHandler = struct {
    on_press: ?*const fn () void = null,
    on_hover_enter: ?*const fn () void = null,
    on_hover_exit: ?*const fn () void = null,
    on_key: ?*const fn (key: c_int) void = null,
};
```

### Add new handlers:
```zig
pub const EventHandler = struct {
    on_press: ?*const fn () void = null,
    on_hover_enter: ?*const fn () void = null,
    on_hover_exit: ?*const fn () void = null,
    on_key: ?*const fn (key: c_int) void = null,
    on_change_text: ?*const fn () void = null,
    on_scroll: ?*const fn () void = null,
};
```

`on_change_text` is `fn () void` — the handler pulls text via `input_mod.getText(id)` directly. This matches the zero-closure design.

### Update `hasHandlers` (lines 48-53):

```zig
fn hasHandlers(h: *const EventHandler) bool {
    return h.on_press != null or
        h.on_hover_enter != null or
        h.on_hover_exit != null or
        h.on_key != null or
        h.on_change_text != null or
        h.on_scroll != null;
}
```

## Step 2: TextInput onChange Callback

File: `tsz/runtime/input.zig`

### Add callback storage

After the `inputs` array (line 24):
```zig
var on_change_callbacks: [MAX_INPUTS]?*const fn () void = [_]?*const fn () void{null} ** MAX_INPUTS;
```

### Add registration function:
```zig
/// Set a change callback for an input. Called when text content changes.
pub fn setOnChange(id: u8, callback: *const fn () void) void {
    if (id < MAX_INPUTS) {
        on_change_callbacks[id] = callback;
    }
}
```

### Fire callback on text changes

The callback should fire when text content actually changes, NOT on cursor movement.

In `handleTextInput` (line 81) — this handles SDL_TEXTINPUT events (character insertion). At the end of the function, after text is inserted:
```zig
if (on_change_callbacks[id]) |cb| cb();
```

In `handleKey` (line 118) — this handles SDL_KEYDOWN in text inputs. Save the length before processing, compare after:

```zig
pub fn handleKey(sym: c_int) void {
    const id = focused_id orelse return;
    if (id >= MAX_INPUTS) return;
    var inp = &inputs[id];
    const prev_len = inp.len;  // <-- add this at the start

    // ... existing handleKey body (backspace, delete, arrows, etc.) ...

    // At the very end, before the closing brace:
    if (inp.len != prev_len) {
        if (on_change_callbacks[id]) |cb| cb();
    }
}
```

This catches backspace, delete, Ctrl+X (cut), Ctrl+V (paste), but NOT arrow keys, Home/End, or selection changes. That's the correct behavior.

Also fire in `setText` (line 426) if text actually changed:
```zig
pub fn setText(id: u8, text_val: []const u8) void {
    if (id >= MAX_INPUTS) return;
    var inp = &inputs[id];
    const prev_len = inp.len;
    const copy_len: u16 = @intCast(@min(text_val.len, BUF_SIZE - 1));
    @memcpy(inp.buf[0..copy_len], text_val[0..copy_len]);
    inp.len = copy_len;
    inp.cursor = copy_len;
    inp.has_selection = false;
    if (inp.len != prev_len) {
        if (on_change_callbacks[id]) |cb| cb();
    }
}
```

## Step 3: Scroll Handler Dispatch

File: `tsz/runtime/main.zig`

Find the `SDL_MOUSEWHEEL` handling section. After the scroll position is updated (`scroll_node.scroll_y = ...`), fire the handler:

```zig
// After: scroll_node.scroll_y = @max(0.0, @min(scroll_node.scroll_y, max_scroll));
if (scroll_node.handlers.on_scroll) |handler| handler();
```

**That's the only change to main.zig.** Do not restructure the event loop or touch any other event handling.

## Step 4: Compiler — Attribute Parsing for New Handlers

File: `tsz/compiler/codegen.zig`

### Add handler attribute variables (near line 465)

Currently only `on_press_start`/`on_press_end` exist. Add:

```zig
var on_change_text_start: ?u32 = null;
var on_change_text_end: ?u32 = null;
var on_scroll_start: ?u32 = null;
var on_scroll_end: ?u32 = null;
```

### Parse new handler attributes (in the attribute loop, after the onPress case at line 514-518)

```zig
} else if (std.mem.eql(u8, attr_name, "onChangeText")) {
    on_change_text_start = self.pos;
    try self.skipBalanced();
    on_change_text_end = self.pos;
} else if (std.mem.eql(u8, attr_name, "onScroll")) {
    on_scroll_start = self.pos;
    try self.skipBalanced();
    on_scroll_end = self.pos;
}
```

## Step 5: Refactor Handler Emission

Currently the handler struct emission (lines 687-699) is hardcoded for `on_press` only:

```zig
if (on_press_start) |start| {
    ...
    try fields.appendSlice(self.alloc, ".handlers = .{ .on_press = ");
    try fields.appendSlice(self.alloc, handler_name);
    try fields.appendSlice(self.alloc, " }");
}
```

Replace with a collected approach that supports multiple handlers on one node:

```zig
// Create handler functions and collect their names
var press_handler_name: ?[]const u8 = null;
var change_handler_name: ?[]const u8 = null;
var scroll_handler_name: ?[]const u8 = null;

if (on_press_start) |start| {
    press_handler_name = try std.fmt.allocPrint(self.alloc, "_handler_press_{d}", .{self.handler_counter});
    self.handler_counter += 1;
    const body = try self.emitHandlerBody(start, on_press_end.?);
    const handler_fn = try std.fmt.allocPrint(self.alloc, "fn {s}() void {{\n    {s}\n}}", .{ press_handler_name.?, body });
    try self.handler_decls.append(self.alloc, handler_fn);
}

if (on_change_text_start) |start| {
    change_handler_name = try std.fmt.allocPrint(self.alloc, "_handler_change_{d}", .{self.handler_counter});
    self.handler_counter += 1;
    const body = try self.emitHandlerBody(start, on_change_text_end.?);
    const handler_fn = try std.fmt.allocPrint(self.alloc, "fn {s}() void {{\n    {s}\n}}", .{ change_handler_name.?, body });
    try self.handler_decls.append(self.alloc, handler_fn);
}

if (on_scroll_start) |start| {
    scroll_handler_name = try std.fmt.allocPrint(self.alloc, "_handler_scroll_{d}", .{self.handler_counter});
    self.handler_counter += 1;
    const body = try self.emitHandlerBody(start, on_scroll_end.?);
    const handler_fn = try std.fmt.allocPrint(self.alloc, "fn {s}() void {{\n    {s}\n}}", .{ scroll_handler_name.?, body });
    try self.handler_decls.append(self.alloc, handler_fn);
}

// Emit combined .handlers struct
var hf: std.ArrayListUnmanaged(u8) = .{};
if (press_handler_name) |n| {
    try hf.appendSlice(self.alloc, ".on_press = ");
    try hf.appendSlice(self.alloc, n);
}
if (change_handler_name) |n| {
    if (hf.items.len > 0) try hf.appendSlice(self.alloc, ", ");
    try hf.appendSlice(self.alloc, ".on_change_text = ");
    try hf.appendSlice(self.alloc, n);
}
if (scroll_handler_name) |n| {
    if (hf.items.len > 0) try hf.appendSlice(self.alloc, ", ");
    try hf.appendSlice(self.alloc, ".on_scroll = ");
    try hf.appendSlice(self.alloc, n);
}
if (hf.items.len > 0) {
    if (fields.items.len > 0) try fields.appendSlice(self.alloc, ", ");
    try fields.appendSlice(self.alloc, ".handlers = .{ ");
    try fields.appendSlice(self.alloc, hf.items);
    try fields.appendSlice(self.alloc, " }");
}
```

## Step 6: Wire onChangeText Registration

For TextInput elements, the generated code needs to register the callback with `input_mod.setOnChange`.

### Track change handler per input ID

Add to Generator struct:
```zig
input_change_handlers: [16]?[]const u8,
```

Initialize in `Generator.init`:
```zig
.input_change_handlers = [_]?[]const u8{null} ** 16,
```

When building a TextInput node, if `change_handler_name` is set, record it:
```zig
if (is_text_input and change_handler_name != null) {
    const iid = self.input_count - 1; // input_count was already incremented above
    if (iid < 16) self.input_change_handlers[iid] = change_handler_name;
}
```

### Emit registration in emitZigSource

After input registration (lines 1408-1416), emit callback registration:
```zig
for (0..self.input_count) |i| {
    if (self.input_change_handlers[i]) |handler_name| {
        try out.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc,
            "    input_mod.setOnChange({d}, {s});\n", .{ i, handler_name }));
    }
}
```

## Step 7: Add getText() to Handler Expressions

File: `tsz/compiler/codegen.zig` lines 1006-1103 (`emitHandlerExpr`)

Add a case for `getText` in the identifier check:

```zig
// After the existing built-in checks (playVideo, stopVideo, etc.):
if (std.mem.eql(u8, name, "getText")) {
    self.advance_token(); // getText
    if (self.curKind() == .lparen) self.advance_token(); // (
    const id = self.curText(); // numeric literal ID only
    self.advance_token();
    if (self.curKind() == .rparen) self.advance_token(); // )
    return try std.fmt.allocPrint(self.alloc, "input_mod.getText({s})", .{id});
}
```

**This is intentionally narrow:** only bare numeric literal IDs. No expressions, no variable references, no auto-binding. `getText(0)` works. `getText(myVar)` does not.

**Note on interaction with Agent 2's typed state:** `getText` returns `[]const u8`. If used with `setName(getText(0))` where `setName` is a string state setter, this will work correctly once Agent 2's typed state is merged. For now, `getText` can be used in `console.log`-style expressions or saved for later.

## Step 8: Test Example

Create `tsz/examples/events-test.tsz`:

```tsx
function App() {
  const [count, setCount] = useState(0);
  const [scrolled, setScrolled] = useState(0);

  return (
    <Box style={{ padding: 32, backgroundColor: '#1e1e2a', width: '100%', height: '100%' }}>
      <Text fontSize={24} color="#ffffff">{`Count: ${count}`}</Text>
      <Text fontSize={18} color="#888888">{`Scrolled: ${scrolled}`}</Text>

      <Pressable onPress={() => setCount(count + 1)} style={{ padding: 16, backgroundColor: '#4ec9b0', marginTop: 8 }}>
        <Text fontSize={16} color="#ffffff">Press Me</Text>
      </Pressable>

      <TextInput placeholder="Type here..." style={{ padding: 8, backgroundColor: '#2d2d3d', marginTop: 8, height: 40 }} />

      <ScrollView onScroll={() => setScrolled(scrolled + 1)} style={{ height: 200, backgroundColor: '#2d2d3d', marginTop: 8 }}>
        <Box style={{ height: 600, padding: 16 }}>
          <Text fontSize={16} color="#ffffff">Scroll this content to increment the counter</Text>
          <Text fontSize={14} color="#888888" style={{ marginTop: 200 }}>Keep scrolling...</Text>
          <Text fontSize={14} color="#888888" style={{ marginTop: 200 }}>Almost there...</Text>
        </Box>
      </ScrollView>
    </Box>
  );
}
```

This tests: onPress (existing, still works), TextInput (existing, still works), onScroll (new — scroll counter increments per wheel event).

**Note:** The example doesn't test onChangeText because we'd need string state (Agent 2) to display the changed text meaningfully. The runtime callback mechanism is tested implicitly — it fires, just doesn't have a visible side effect without typed state. That's fine.

## Verification

```bash
cd /home/siah/creative/reactjit
zig build tsz-compiler && ./zig-out/bin/tsz build tsz/examples/events-test.tsz
```

Run the binary:
- Press button → count increments (onPress still works)
- Type in text input → no crash, text appears (TextInput still works)
- Scroll the ScrollView → scrolled counter increments (onScroll works)

Inspect `tsz/runtime/generated_app.zig`:
- Check that ScrollView node has `.handlers = .{ .on_scroll = _handler_scroll_N }`
- Check that handler function exists and calls `state.setSlot`

## What NOT to Touch

- Do not modify `lexer.zig` — Agent 1 owns that
- Do not modify `state.zig` — Agent 2 owns that
- Do not modify `collectStateHooks` (lines 373-422) — Agent 2 owns that
- Do not modify `emitStateExpr`/`emitStateAtom` (lines 1105-1163) — Agent 1 owns that
- Do not modify the JSX children loop (lines 558-604) — Agent 3 owns that
- Do not restructure main.zig's event loop — only add the scroll callback dispatch

## Commit

After verification, commit with: `feat(tsz): add onChangeText and onScroll event handlers with multi-handler support`
