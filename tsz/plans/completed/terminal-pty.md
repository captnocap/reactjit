# Terminal & PTY — Semantic Terminal Port

## CRITICAL: Terminal UI is .tsz — NOT hand-written Zig rendering

Same rule as devtools: tsz has no React crash to survive. The terminal UI
(cell grid, cursor, selection, scrollbar, token-colored rows) is a `.tsz` component
using Box/Text/ScrollView primitives.

**Only these are Zig:**
- `pty.zig` — POSIX PTY spawning (fork, exec, read/write, resize)
- `vterm.zig` — libvterm wrapper (ANSI parsing, damage callbacks, cell access)
- `classifier.zig` — row classification logic (pattern matching on text)

**Everything visual is .tsz:**
- `Terminal.tsz` — cell grid rendering, cursor overlay, scroll
- `SemanticTerminal.tsz` — classified rendering with token color bars

The Zig modules expose built-in functions (`pollPty()`, `getRowText()`, `getCell()`,
`writePty()`, `classifyRow()`) that the .tsz components call. Same pattern as devtools
using telemetry getters.

## What This Is

The most complex subsystem in ReactJIT. ~6,000 lines of Lua implementing a full PTY terminal with semantic classification — no actual terminal surface. Raw PTY bytes → libvterm → classified rows → semantic graph → rendered with token colors.

## Love2D Reference Files

| File | Lines | What it does |
|------|-------|-------------|
| `love2d/lua/pty.lua` | 491 | POSIX PTY spawning via LuaJIT FFI (openpt, fork, setsid, exec) |
| `love2d/lua/vterm.lua` | 634 | libvterm FFI + C shim, damage callbacks, cursor tracking, scrollback |
| `love2d/lua/capabilities/terminal.lua` | 1,199 | Visual terminal — cell-by-cell render, cursor blink, selection, keyboard, hyperlinks |
| `love2d/lua/capabilities/semantic_terminal.lua` | 1,500+ | Classifier pipeline, token coloring, settle timer, semantic events |
| `love2d/lua/claude_canvas.lua` | 900 | Claude-specific canvas — 65-entry semantic style table, turn tracking |
| `love2d/lua/claude_session.lua` | 1,802 | Claude PTY + vterm integration, snapshot capture, recording |
| `love2d/lua/claude_renderer.lua` | 675 | Block-based rendering of classified output |
| `love2d/lua/claude_graph.lua` | 475 | Claude-specific semantic graph builder |
| `love2d/lua/semantic_graph.lua` | 472 | Generic graph framework (parent/child, roles, lanes, scopes) |
| `love2d/lua/classifiers/claude_code.lua` | 250 | Reference classifier — 25+ token types for Claude Code |
| `love2d/lua/classifiers/basic.lua` | 82 | Minimal shell classifier — 7 tokens |

## The Hard Problem: Cursor Without a Terminal Surface

In a normal terminal emulator, the terminal widget manages cursor position. ReactJIT has no terminal widget — it renders everything as Box/Text primitives. The cursor position comes from libvterm's `movecursor` callback, mapped to pixel position:

```lua
cursorX = padding + cursor.col * charWidth
cursorY = padding + (cursor.row * lineHeight) - scrollY
```

Reference: `love2d/lua/capabilities/terminal.lua:731-749` (cursor rendering)

This was "the biggest pain point" — getting cursor position right requires:
1. Correct font metrics (charWidth, lineHeight)
2. Correct scroll offset tracking
3. libvterm's cursor state (row, col, visible)
4. Proper handling of scrollback line count

## Architecture for tsz

### Pipeline

```
std.process.Child (spawn shell)
    ↓ raw bytes
libvterm (@cImport) → damage callbacks → dirty rows
    ↓ classified
Classifier (per-row token assignment) → semantic tokens
    ↓ styled
Renderer (cell-by-cell with token colors) → SDL2 draw calls
```

### Key difference from Lua

Lua uses LuaJIT FFI for POSIX PTY calls and a C shim for libvterm callbacks. Zig can do both natively:
- **PTY:** `@cImport` for `<pty.h>`, `<unistd.h>`, `<sys/ioctl.h>` — direct POSIX calls
- **libvterm:** `@cImport` for `<vterm.h>` — no shim needed, Zig handles struct-by-value callbacks via `@ptrCast`

## Implementation Phases

### Phase 0: PTY Spawning

**New file: `tsz/runtime/pty.zig`**

Port of `love2d/lua/pty.lua` (491 lines). POSIX PTY lifecycle:

```zig
const posix = @cImport({
    @cInclude("pty.h");
    @cInclude("unistd.h");
    @cInclude("sys/ioctl.h");
    @cInclude("sys/wait.h");
    @cInclude("fcntl.h");
    @cInclude("signal.h");
});

pub const PTY = struct {
    master_fd: c_int,
    child_pid: c_int,

    pub fn spawn(shell: [*:0]const u8, rows: u16, cols: u16) !PTY;
    pub fn read(self: *PTY, buf: []u8) ?[]const u8;  // non-blocking
    pub fn write(self: *PTY, data: []const u8) !void;
    pub fn resize(self: *PTY, rows: u16, cols: u16) void;  // TIOCSWINSZ
    pub fn alive(self: *PTY) bool;                          // waitpid(WNOHANG)
    pub fn close(self: *PTY) void;                          // SIGTERM → wait → SIGKILL
};
```

Reference: `love2d/lua/pty.lua:356-459` (spawn sequence — critical: `setsid()` + `TIOCSCTTY` for job control)

Spawn sequence (must be exact):
1. `posix_openpt(O_RDWR | O_NOCTTY | O_CLOEXEC)`
2. `grantpt()` + `unlockpt()`
3. `ptsname_r()` → slave device path
4. `fork()`
5. Child: `close(master)`, `setsid()`, `open(slave)`, `ioctl(TIOCSCTTY)`, `dup2(0/1/2)`, `execvp(shell)`
6. Parent: `ioctl(TIOCSWINSZ)`, `fcntl(O_NONBLOCK)`, return PTY

**Platform note:** Linux/macOS only. Windows would need ConPTY — defer.

### Phase 1: libvterm Integration

**New file: `tsz/runtime/vterm.zig`**

Zig wrapper around libvterm. Handles ANSI parsing, damage tracking, cursor state.

```zig
const vterm = @cImport({ @cInclude("vterm.h"); });

pub const VTerm = struct {
    vt: *vterm.VTerm,
    screen: *vterm.VTermScreen,

    // Damage tracking
    dirty_rows: [256]bool,  // bitset — which rows changed
    has_damage: bool,

    // Cursor
    cursor_row: u16,
    cursor_col: u16,
    cursor_visible: bool,
    cursor_moved: bool,

    pub fn init(rows: u16, cols: u16) !VTerm;
    pub fn feed(self: *VTerm, data: []const u8) void;
    pub fn drain(self: *VTerm) DamageResult;
    pub fn getCell(self: *VTerm, row: u16, col: u16) Cell;
    pub fn getRowText(self: *VTerm, row: u16, buf: []u8) []const u8;
    pub fn resize(self: *VTerm, rows: u16, cols: u16) void;
    pub fn deinit(self: *VTerm) void;
};

pub const Cell = struct {
    char: [4]u8,  // UTF-8 (up to 4 bytes)
    char_len: u8,
    fg: ?Color,   // null = default
    bg: ?Color,   // null = default
    bold: bool,
    italic: bool,
    underline: bool,
    strike: bool,
    width: u8,    // 1 or 2 (wide chars)
};
```

Reference: `love2d/lua/vterm.lua:477-521` (getCell), `love2d/lua/vterm.lua:186-302` (damage/cursor callbacks)

**libvterm callbacks registration:**
- `damage(rect)` → set `dirty_rows[row] = true` for affected rows
- `movecursor(new, old, visible)` → update cursor_row/col/visible
- `settermprop(prop, val)` → track cursor visibility, alt screen

**Build dependency:** `sudo apt install libvterm-dev` (Linux), `brew install libvterm` (macOS)

### Phase 2: Basic Terminal Rendering

**New file: `tsz/runtime/terminal.zig`**

Cell-by-cell renderer using `text.zig` (needs multi-color support from syntax highlighting plan).

```zig
pub const Terminal = struct {
    pty: PTY,
    vt: VTerm,
    rows: u16,
    cols: u16,
    char_width: f32,
    line_height: f32,
    scroll_y: f32,

    // Cursor blink
    blink_timer: f32,
    blink_on: bool,

    pub fn init(rows: u16, cols: u16) !Terminal;
    pub fn tick(self: *Terminal, dt: f32) void;      // read PTY, feed vterm, drain
    pub fn render(self: *Terminal, te: *TextEngine, x: f32, y: f32, w: f32, h: f32) void;
    pub fn handleKey(self: *Terminal, sym: c_int, mod: u16) void;
    pub fn handleTextInput(self: *Terminal, text: [*:0]const u8) void;
    pub fn handleScroll(self: *Terminal, delta: f32) void;
};
```

**Rendering loop** (reference: `terminal.lua:517-761`):
```zig
// For each visible row:
for (visible_start..visible_end) |row| {
    for (0..cols) |col| {
        const cell = vt.getCell(row, col);
        if (cell.bg) |bg| {
            // Draw background rect
            SDL_SetRenderDrawColor(renderer, bg.r, bg.g, bg.b, 255);
            SDL_RenderFillRect(renderer, &rect);
        }
        if (cell.char_len > 0) {
            const fg = cell.fg orelse default_fg;
            te.drawText(cell.char[0..cell.char_len], x + col * char_w, y, font_size, fg);
        }
    }
}

// Cursor
if (self.blink_on and self.vt.cursor_visible) {
    // Draw cursor block at cursor position
    const cx = x + self.vt.cursor_col * char_w;
    const cy = y + (self.vt.cursor_row * line_h) - self.scroll_y;
    SDL_SetRenderDrawColor(renderer, 255, 255, 255, 200);
    SDL_RenderFillRect(renderer, &cursor_rect);
}
```

**Keyboard → PTY bytes** (reference: `terminal.lua:766-914`):
```zig
fn handleKey(self: *Terminal, sym: c_int, mod: u16) void {
    const ctrl = (mod & KMOD_CTRL) != 0;
    if (ctrl) {
        switch (sym) {
            'c' => self.pty.write("\x03"),  // SIGINT
            'd' => self.pty.write("\x04"),  // EOF
            'l' => self.pty.write("\x0c"),  // clear
            'z' => self.pty.write("\x1a"),  // suspend
            // ...
        }
    } else {
        switch (sym) {
            SDLK_RETURN => self.pty.write("\r"),
            SDLK_UP     => self.pty.write("\x1b[A"),
            SDLK_DOWN   => self.pty.write("\x1b[B"),
            SDLK_RIGHT  => self.pty.write("\x1b[C"),
            SDLK_LEFT   => self.pty.write("\x1b[D"),
            SDLK_HOME   => self.pty.write("\x1b[H"),
            SDLK_END    => self.pty.write("\x1b[F"),
            // ...
        }
    }
}
```

### Phase 3: Row Classifier Framework

**New file: `tsz/runtime/classifier.zig`**

Generic classifier interface that any CLI can implement.

```zig
pub const TokenKind = enum {
    // Shell basics (basic.lua)
    command, output, err, success, heading, separator, progress,

    // Claude Code (claude_code.lua, 25+ tokens)
    user_prompt, user_text, assistant_text, thinking, thought_complete,
    tool, result, diff, error_text,
    banner, status_bar, idle_prompt, input_border, input_zone, box_drawing,
    menu_title, menu_option, menu_desc,
    list_selectable, list_selected, list_info,
    permission, confirmation, hint,
    plan_border, plan_mode, task_summary, task_done, task_open, task_active,

    plain,  // fallback
};

pub const Classifier = struct {
    classifyRow: *const fn (text: []const u8, row: u16, total_rows: u16) TokenKind,
    refineAdjacency: ?*const fn (kind: TokenKind, prev_kind: TokenKind, text: []const u8) TokenKind,
    isTurnStart: ?*const fn (kind: TokenKind) bool,
};
```

Reference: `love2d/lua/classifiers/basic.lua` (82 lines — minimal), `love2d/lua/classifiers/claude_code.lua` (250 lines — full)

**Basic classifier (port of basic.lua):**
```zig
fn basicClassify(text: []const u8, row: u16, total_rows: u16) TokenKind {
    if (text.len == 0) return .plain;
    if (text[0] == '$' or text[0] == '#' or text[0] == '>') return .command;
    if (std.mem.startsWith(u8, text, "error") or std.mem.startsWith(u8, text, "Error")) return .err;
    // ... etc
    return .output;
}
```

### Phase 4: Semantic Terminal (Classified Rendering)

**New file: `tsz/runtime/semantic_terminal.zig`**

Extends basic terminal with classification + token coloring.

```zig
pub const SemanticTerminal = struct {
    terminal: Terminal,
    classifier: Classifier,
    classified_cache: [MAX_ROWS]ClassifiedRow,

    // Settle timer (don't classify during rapid output)
    settle_at: u32,         // SDL_GetTicks target
    stream_mode: bool,

    pub fn tick(self: *SemanticTerminal, dt: f32) void;
    pub fn render(self: *SemanticTerminal, ...) void;
};

const ClassifiedRow = struct {
    kind: TokenKind,
    turn_id: u16,
    group_id: u16,
    node_id: u32,
};
```

**Settle timer** (reference: `semantic_terminal.lua:465-491`):
- SETTLE_MS = 120 — wait 120ms after last damage before classifying
- STREAM_MS = 50 — intermediate updates during streaming
- Prevents thrashing during rapid output (compile output, large diffs)

**Token color palette** (reference: `claude_canvas.lua` SEMANTIC_STYLES table):
```zig
const TOKEN_COLORS = [_]Color{
    // Matches Catppuccin-style palette from claude_canvas.lua
    Color.rgb(96, 165, 250),   // user_prompt — blue
    Color.rgb(226, 232, 240),  // assistant_text — light gray
    Color.rgb(167, 139, 250),  // thinking — purple
    Color.rgb(248, 113, 113),  // error — red
    Color.rgb(234, 179, 8),    // tool — yellow
    Color.rgb(74, 222, 128),   // result — green
    // ... all 25+ token colors
};
```

**Rendering with token bars** (reference: `semantic_terminal.lua:829-1100`):
```zig
// For each visible row:
const entry = classified_cache[row];
const token_color = TOKEN_COLORS[@intFromEnum(entry.kind)];

// Draw left accent bar (2px wide)
SDL_SetRenderDrawColor(renderer, token_color.r, token_color.g, token_color.b, 200);
SDL_RenderFillRect(renderer, &bar_rect);

// Draw cell text with vterm colors (as normal)
// ...
```

### Phase 5: Compiler Integration

Make `<Terminal>` a recognized primitive in .tsz:

```tsx
function App() {
  return (
    <Box style={{ width: '100%', height: '100%' }}>
      <Terminal shell="/bin/bash" style={{ flexGrow: 1 }} />
    </Box>
  );
}
```

Or for semantic terminal:
```tsx
<SemanticTerminal shell="claude" classifier="claude_code" style={{ flexGrow: 1 }} />
```

Compiler emits: terminal init in main(), tick in loop, render in paint, keyboard routing.

### Phase 6: Claude Code Classifier

Port `love2d/lua/classifiers/claude_code.lua` (250 lines) to Zig. This is the reference implementation — 25+ token types, adjacency refinement, turn detection, group types.

Pattern matching for Claude Code output:
- `❯` (Unicode 276F) → `idle_prompt`
- `●` or `•` + function signature → `tool`
- `+` or `-` at start → `diff`
- "Do you want to" → `permission`
- `✔` → `task_done`, `◻` → `task_open`

Reference: `love2d/lua/classifiers/claude_code.lua` — entire file

## Dependencies

- **Multi-color text rendering** (syntax highlighting plan, Phase 1) — needed for cell-by-cell coloring
- **libvterm** — system dependency (`libvterm-dev`)
- **POSIX** — Linux/macOS only (Windows ConPTY is a separate effort)

## Build Integration

In `build.zig`:
```zig
exe.linkSystemLibrary("vterm");
```

## Status (2026-03-14)

### Completed
- **Phase 0: PTY Spawning** — `tsz/runtime/pty.zig` (POSIX fork/setsid/exec, non-blocking I/O, resize, close)
- **Phase 1: libvterm** — `tsz/runtime/vterm.zig` (manual extern decls, damage callbacks, cursor, cell access)
- **Phase 2: Terminal Rendering** — `tsz/examples/terminal-test.tsz` (24 rows via .map() + getRowText)
- **Phase 3: Keyboard** — handleKey() SDL→PTY translation (Ctrl+letter, arrows, home/end, pgup/pgdn)
- **Phase 3: Classifier** — `tsz/runtime/classifier.zig` (basic 7-token + Claude Code 25+ token + adjacency refinement + token colors)
- **Build** — libvterm linked for engine + engine-app targets
- **Codegen** — spawnPty/pollPty/writePty/handleTerminalKey/getRowText/getCursorRow/getCursorCol built-ins

### Remaining
- **Phase 4: Dynamic token bar colors** — needs codegen support for runtime style expressions (classifyRow → getTokenColor → backgroundColor)
- **Phase 5: Compiler primitive** — `<Terminal>` / `<SemanticTerminal>` as recognized primitives
- **Phase 6: Claude Code classifier** — already ported in classifier.zig, needs integration test with real Claude output
- **SDL_TEXTINPUT** — handleTextInput() in pty.zig exists but needs codegen/main.zig hookup
- **Scrollback** — vterm scrollback capture deferred (cb_sb_pushline is a no-op)

## Files

**Zig (system-level only):**
| File | Status |
|------|--------|
| `tsz/runtime/pty.zig` | ✔ POSIX PTY + handleKey() + handleTextInput() |
| `tsz/runtime/vterm.zig` | ✔ libvterm wrapper (manual extern, no C shim) |
| `tsz/runtime/classifier.zig` | ✔ basic + claude_code classifiers + token colors |
| `tsz/compiler/codegen.zig` | ✔ PTY built-ins + getRowText in templates + conditional param discard |
| `tsz/compiler/loop_template.txt` | ✔ on_key 2-arg fix |
| `build.zig` | ✔ libvterm linked |

**.tsz (all UI):**
| File | Status |
|------|--------|
| `tsz/examples/terminal-test.tsz` | ✔ 24-row terminal with keyboard input |
| `tsz/examples/semantic-test.tsz` | ✔ scaffolded (static accent bars, dynamic coloring pending) |

## Verification

```bash
# Phase 0-1: PTY + vterm test
zig test tsz/runtime/pty.zig    # spawn /bin/echo, read output
zig test tsz/runtime/vterm.zig  # feed ANSI sequences, check cells

# Phase 2: Basic terminal
zig build tsz-compiler && ./zig-out/bin/tsz build tsz/examples/terminal-test.tsz
# Opens a shell in the tsz window

# Phase 4: Semantic terminal
./zig-out/bin/tsz build tsz/examples/semantic-test.tsz
# Opens classified shell with token-colored left bars
```

## The Cursor Fix

The "biggest pain point" was cursor positioning without a terminal surface. In tsz it's straightforward because:

1. libvterm's `movecursor` callback gives us exact `(row, col)` — stored in `VTerm.cursor_row/col`
2. Font metrics from `text.zig` give us exact `char_width` and `line_height`
3. Pixel position = `x + col * char_width`, `y + (row * line_height) - scroll_y`
4. No accumulated error — monospace font, integer grid, deterministic layout

The Lua version had the same approach but cursor drift was caused by floating-point accumulation in the Lua → Love2D rendering pipeline. Zig's explicit integer/float handling eliminates this.
