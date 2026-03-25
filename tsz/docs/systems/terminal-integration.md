# Terminal / PTY Integration

Embedded terminal emulation via libvterm.

## Overview

tsz provides native terminal emulation through libvterm, a C library for ANSI/VT100 terminal parsing. Terminal instances are managed as framework-level resources and rendered through the standard node tree using `Box` + `Text` primitives.

## Architecture

```
PTY process → raw bytes → libvterm (C) → vterm.zig (FFI bridge) → classifier.zig → renderer
```

### vterm.zig — libvterm FFI bridge

`framework/vterm.zig` wraps libvterm with manual extern declarations (Zig's `@cImport` can't handle C bitfield structs). It provides:

- **Terminal slots**: Up to `MAX_TERMINALS` (4) concurrent terminal instances
- **Damage tracking**: Only repaints rows that changed (dirty_rows bitmap)
- **Cell access**: Per-cell character, foreground/background color, bold/italic/underline attributes
- **Cursor state**: Position, visibility, blink
- **Scrollback**: Push/pop line callbacks for scroll history

### Key API

```zig
// Terminal lifecycle
pub fn init(idx: u8, rows: u16, cols: u16) void
pub fn deinit(idx: u8) void
pub fn write(idx: u8, data: []const u8) void  // feed PTY output
pub fn resize(idx: u8, rows: u16, cols: u16) void

// Reading state
pub fn getCell(idx: u8, row: u16, col: u16) VTermScreenCell
pub fn getRowText(idx: u8, row: u16, buf: []u8) []const u8
pub fn getCursorPos(idx: u8) VTermPos
pub fn isDirtyRow(idx: u8, row: u16) bool
```

### classifier.zig — semantic classification

The classifier assigns semantic tokens to each terminal row based on text pattern matching. This replaces raw ANSI colors with semantically meaningful colors.

Two built-in classifiers:

**Basic** (generic shell):
- Detects error/success keywords, shell prompts, progress indicators, headings, separators

**Claude Code**:
- 25+ token types for Claude Code CLI output
- Detects user prompts, assistant text, thinking blocks, tool calls, diffs, permissions, task lists

### Multi-terminal support

Both vterm and classifier support indexed operations for multiple terminals:

```zig
// Slot 0 (default)
vterm.write(data);
classifier.setMode(.claude_code);

// Slot 2 (explicit)
vterm.writeIdx(2, data);
classifier.setModeIdx(2, .basic);
```

## PTY Remote

`framework/pty_remote.zig` provides remote PTY connections over the network, allowing terminal instances to connect to processes on other machines.

## Rendering

Terminal rendering is NOT done in vterm.zig. `.tsz` `<Terminal>` components read the vterm state (dirty rows, cells, row text) and render via standard `Box` + `Text` primitives. This means terminal content participates in the normal layout and paint pipeline.

## Classifier Configuration

```zig
pub const Mode = enum { none, basic, claude_code, json };
```

- `none` — no classification, raw terminal colors
- `basic` — generic shell pattern matching
- `claude_code` — Claude Code CLI-specific patterns
- `json` — JSON-driven custom classification (external config)

## Token Colors

Each semantic token maps to a hardcoded color:

| Token | Color | Hex |
|-------|-------|-----|
| output | Slate 200 | #e2e8f0 |
| command | Blue 400 | #60a5fa |
| error | Red 400 | #f87171 |
| success | Green 400 | #4ade80 |
| thinking | Purple 400 | #a78bfa |
| tool | Yellow 500 | #eab308 |
| permission | Orange 500 | #f97316 |

## Known Limitations

- Max 4 concurrent terminal instances (`MAX_TERMINALS`)
- Max 256 rows per terminal cached for classification
- Classification is per-row, not per-character
- libvterm's C bitfield structs require manual Zig type declarations
- Terminal features require the full compiler (`bin/tsz-full`)
- Scrollback buffer is limited by the push/pop line callback capacity
