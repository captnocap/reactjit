# App-Time Testing — Playwright-Style for tsz

## What Love2D Has

A full testing system that lets Claude programmatically test running apps — find elements, click them, type text, assert layout, capture screenshots. Three layers:

| File | Lines | What |
|------|-------|------|
| `love2d/lua/testrunner.lua` | 1,199 | Core: node query, click/type/key injection, layout audit |
| `love2d/cli/lib/test-shim.js` | 364 | Test API: `test()`, `page.find()`, `expect()`, `Locator` |
| `love2d/cli/commands/test.mjs` | ~200 | CLI: bundle spec, launch Love2D with `RJIT_TEST=1`, parse results |

## Key Feature: debugName

Every node can have a `debugName` prop that survives compilation. This is how tests find specific nodes in a compiled app:

```tsx
<Box debugName="sidebar" style={{ width: 200 }}>
  <Text testId="title">Hello</Text>
</Box>
```

In Love2D, `debugName` is auto-derived from the React fiber tree (component name). In tsz, we set it explicitly or derive it from the component function name.

Reference: `love2d/packages/renderer/src/hostConfig.ts` (debugName from fiber), `love2d/lua/tree.lua` (stored on node at CREATE)

## tsz Architecture: Compile-Time Test Runner

In Love2D, tests run inside the Love2D process via QuickJS RPC. In tsz, the test runner can be **compiled into the binary** when building in test mode.

### How it works

```
tsz test app.tsz spec.test.tsz
```

1. Compiler reads `app.tsz` (the app) + `spec.test.tsz` (the test spec)
2. Generates a binary that:
   - Inits the app normally
   - After first frame, runs test functions
   - Each test function can query nodes, simulate input, assert layout
   - Prints PASS/FAIL results
   - Exits

No QuickJS, no RPC, no bridge. Tests are compiled Zig code that directly accesses the node tree.

## Implementation

### Phase 1: debugName on Nodes

**File: `tsz/runtime/layout.zig`**

Add to Node struct:
```zig
debug_name: ?[]const u8 = null,
test_id: ?[]const u8 = null,
```

**File: `tsz/compiler/codegen.zig`**

Recognize `debugName` and `testId` as props:
```tsx
<Box debugName="sidebar" testId="main-panel" style={{ ... }}>
```

Emits:
```zig
.{ .debug_name = "sidebar", .test_id = "main-panel", .style = .{ ... } }
```

Auto-derive `debug_name` from component function name when not explicit:
- `function Sidebar()` → all nodes emitted by Sidebar get `.debug_name = "Sidebar"`

Reference: `love2d/packages/renderer/src/hostConfig.ts` (auto-derivation from fiber)

### Phase 2: Node Query Engine

**New file: `tsz/runtime/query.zig`**

Walk the node tree and find nodes by type, debugName, testId, or text content.

```zig
pub const QueryResult = struct {
    node: *Node,
    x: f32,
    y: f32,
    w: f32,
    h: f32,
    cx: f32,  // center x
    cy: f32,  // center y
};

pub fn find(root: *Node, opts: QueryOpts) ?QueryResult;
pub fn findAll(root: *Node, opts: QueryOpts, out: []QueryResult) usize;

pub const QueryOpts = struct {
    debug_name: ?[]const u8 = null,  // match by debugName
    test_id: ?[]const u8 = null,     // match by testId
    text: ?[]const u8 = null,        // match by text content
    node_type: ?[]const u8 = null,   // match by primitive type (Box, Text, etc.)
};
```

Reference: `love2d/lua/testrunner.lua` `matchesQuery()` — matches by type, props, text content

### Phase 3: Input Simulation

**New file: `tsz/runtime/testdriver.zig`**

Inject synthetic SDL events into the event queue.

```zig
/// Simulate a click at (x, y)
pub fn click(x: f32, y: f32) void {
    // Push SDL_MOUSEBUTTONDOWN + SDL_MOUSEBUTTONUP events
    var down: c.SDL_Event = .{ .type = c.SDL_MOUSEBUTTONDOWN };
    down.button.x = @intFromFloat(x);
    down.button.y = @intFromFloat(y);
    down.button.button = c.SDL_BUTTON_LEFT;
    _ = c.SDL_PushEvent(&down);

    var up = down;
    up.type = c.SDL_MOUSEBUTTONUP;
    _ = c.SDL_PushEvent(&up);
}

/// Simulate typing text
pub fn typeText(text: []const u8) void {
    for (text) |ch| {
        var event: c.SDL_Event = .{ .type = c.SDL_TEXTINPUT };
        event.text.text[0] = ch;
        event.text.text[1] = 0;
        _ = c.SDL_PushEvent(&event);
    }
}

/// Simulate a key press
pub fn key(sym: c_int) void {
    var down: c.SDL_Event = .{ .type = c.SDL_KEYDOWN };
    down.key.keysym.sym = sym;
    _ = c.SDL_PushEvent(&down);

    var up: c.SDL_Event = .{ .type = c.SDL_KEYUP };
    up.key.keysym.sym = sym;
    _ = c.SDL_PushEvent(&up);
}

/// Wait N frames (run the main loop N times)
pub fn waitFrames(n: u32) void;
```

Reference: `love2d/lua/testrunner.lua` — `test:click` injects `mousepressed`/`mousereleased`, `test:type` injects `textinput` character by character

### Phase 4: Assertions

**New file: `tsz/runtime/testassert.zig`**

```zig
pub fn expectVisible(result: QueryResult) !void {
    if (result.w <= 0 or result.h <= 0) return error.NotVisible;
}

pub fn expectText(node: *Node, expected: []const u8) !void {
    if (node.text) |text| {
        if (!std.mem.eql(u8, text, expected)) return error.TextMismatch;
    } else return error.NoText;
}

pub fn expectContainsText(node: *Node, substring: []const u8) !void {
    if (node.text) |text| {
        if (std.mem.indexOf(u8, text, substring) == null) return error.TextNotFound;
    } else return error.NoText;
}

pub fn expectRect(result: QueryResult, expected: struct { x: f32, y: f32, w: f32, h: f32 }) !void {
    // ±1px tolerance
    if (@abs(result.x - expected.x) > 1 or @abs(result.y - expected.y) > 1 or
        @abs(result.w - expected.w) > 1 or @abs(result.h - expected.h) > 1)
        return error.RectMismatch;
}
```

Reference: `love2d/cli/lib/test-shim.js` Matchers — `toBeVisible()`, `toHaveText()`, `toContainText()`, `toHaveRect()`

### Phase 5: Layout Audit

**Add to `tsz/runtime/testassert.zig`**

Detect layout violations automatically:

```zig
pub const Violation = struct {
    kind: enum { child_overflow, sibling_overlap, off_viewport },
    message: [256]u8,
    msg_len: u8,
    node: *Node,
};

pub fn audit(root: *Node, viewport_w: f32, viewport_h: f32, out: []Violation) usize;
```

Checks:
- **child_overflow** — child extends beyond parent bounds
- **sibling_overlap** — siblings overlap by >2px
- **off_viewport** — node completely off-screen

Reference: `love2d/lua/testrunner.lua` audit section — detects child-overflow, sibling-overlap, off-viewport, text-overlap

### Phase 6: Test Spec Syntax

Users write test specs as `.tsz` files with a `test()` built-in:

```tsx
// app.test.tsz

test("counter increments", () => {
  const btn = find("Pressable", { text: "Increment" });
  click(btn.cx, btn.cy);
  waitFrames(2);
  const display = find("Text", { debugName: "counter-display" });
  expectContainsText(display, "Count: 1");
});

test("no layout violations", () => {
  const violations = audit();
  expectEqual(violations, 0);
});
```

The compiler recognizes `test()` blocks and emits them as functions called after app init.

### Phase 7: CLI Integration

```bash
tsz test app.tsz                    # Run app.test.tsz (convention)
tsz test app.tsz spec.test.tsz      # Explicit spec file
tsz test app.tsz --visible          # Show window (default: headless)
tsz test app.tsz --timeout=10       # Timeout in seconds
```

For headless: use `SDL_VIDEODRIVER=dummy` or `xvfb-run` (same as Love2D).

Reference: `love2d/cli/commands/test.mjs` — spawns `xvfb-run` for headless CI

### Phase 8: Screenshot Capture

```zig
pub fn screenshot(path: []const u8) void {
    // SDL_RenderReadPixels → write PNG via stb_image_write
}
```

Reference: `love2d/lua/testrunner.lua` `test:screenshot` — captures full frame

## Files

| File | Change |
|------|--------|
| `tsz/runtime/layout.zig` | Add `debug_name`, `test_id` to Node struct |
| `tsz/runtime/query.zig` | **New** — node query by debugName/testId/text/type |
| `tsz/runtime/testdriver.zig` | **New** — click/type/key simulation via SDL_PushEvent |
| `tsz/runtime/testassert.zig` | **New** — assertions + layout audit |
| `tsz/compiler/codegen.zig` | Recognize debugName/testId props, test() blocks |
| `tsz/compiler/main.zig` | Add `tsz test` subcommand |

## Implementation Order

1. ~~**debugName/testId on Node**~~ — **DONE** — `layout.zig` Node struct has `debug_name`, `test_id`
2. ~~**Query engine**~~ — **DONE** — `query.zig` (find, findAll, countMatches, findByText/Name/Id)
3. ~~**Input simulation**~~ — **DONE** — `testdriver.zig` (click, clickNode, moveMouse, key, typeText, scroll, resize, quit)
4. ~~**Assertions**~~ — **DONE** — `testassert.zig` (expectVisible, expectHidden, expectText, expectContainsText, expectRect, expectWidth, expectHeight, expectExists, expectCount)
5. ~~**Layout audit**~~ — **DONE** — `testassert.zig` audit() (child_overflow, sibling_overlap, off_viewport)
6. **Test spec compilation** — **PARTIAL** — codegen emits `debug_name`/`test_id` props. **TODO:** parse `test()` blocks, emit test runner harness
7. **CLI `tsz test`** — orchestrate build + run + parse output — **NEEDS Phase 6 test() blocks**
8. ~~**Screenshots**~~ — **DONE** — `testdriver.zig` screenshot() via stb_image_write

All unit tests pass (27 total across query.zig and testassert.zig).

## Verification

```bash
# Build test binary
tsz test tsz/examples/counter.tsz

# Output:
# TEST counter increments ... PASS
# TEST no layout violations ... PASS
# 2/2 tests passed
```

## Why This Matters

Without this, every UI change requires manual visual verification — launch the app, click around, eyeball it. With this, Claude can write a test, run it, and know if the UI is correct in seconds. Same capability that made the Love2D stack reliable across hundreds of storybook stories.
