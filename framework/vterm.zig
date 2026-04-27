//! framework/vterm.zig — feature-gated dispatcher for the libvterm/PTY
//! surface.
//!
//! When -Dhas-terminal=true (passed by scripts/ship for carts whose
//! source triggers the `terminal` feature in
//! sdk/dependency-registry.json), this re-exports
//! framework/vterm_real.zig (the real libvterm-backed implementation).
//! Otherwise it re-exports framework/vterm_stub.zig, whose methods all
//! return empty/false/0/null, and libvterm isn't linked.
//!
//! The conditional `@import` ensures the unselected file isn't compiled,
//! so vterm_real.zig's `extern "vterm" fn …` declarations only get
//! resolved against libvterm when the library is actually being linked.
//!
//! recorder.zig has no C dependency; recordings stay functional in stub
//! mode but receive no PTY data.

const build_options = @import("build_options");

const HAS_TERMINAL = if (@hasDecl(build_options, "has_terminal"))
    build_options.has_terminal
else
    false;

const impl = if (HAS_TERMINAL)
    @import("vterm_real.zig")
else
    @import("vterm_stub.zig");

// Recording (pure-Zig, available in both modes)
pub const startRecording = impl.startRecording;
pub const stopRecording = impl.stopRecording;
pub const saveRecording = impl.saveRecording;
pub const isRecording = impl.isRecording;
pub const getRecorder = impl.getRecorder;

// Public types
pub const Color = impl.Color;
pub const Cell = impl.Cell;
pub const MAX_TERMINALS = impl.MAX_TERMINALS;
pub const VTerm = impl.VTerm;

// Single-terminal API
pub const initVterm = impl.initVterm;
pub const feed = impl.feed;
pub const readOutput = impl.readOutput;
pub const getRowText = impl.getRowText;
pub const getCell = impl.getCell;
pub const getCursorRow = impl.getCursorRow;
pub const getCursorCol = impl.getCursorCol;
pub const getCursorVisible = impl.getCursorVisible;
pub const hasDamage = impl.hasDamage;
pub const clearDamageState = impl.clearDamageState;
pub const getRows = impl.getRows;
pub const getCols = impl.getCols;
pub const resizeVterm = impl.resizeVterm;
pub const deinit = impl.deinit;

// PTY
pub const setSpawnCwd = impl.setSpawnCwd;
pub const spawnShell = impl.spawnShell;
pub const pollPty = impl.pollPty;
pub const writePty = impl.writePty;
pub const ptyAlive = impl.ptyAlive;
pub const closePty = impl.closePty;

// Scrollback
pub const getScrollbackCell = impl.getScrollbackCell;
pub const scrollbackCount = impl.scrollbackCount;
pub const scrollOffset = impl.scrollOffset;
pub const scrollUp = impl.scrollUp;
pub const scrollDown = impl.scrollDown;
pub const scrollToBottom = impl.scrollToBottom;
pub const copySelectedText = impl.copySelectedText;

// Multi-terminal Idx variants
pub const scrollUpIdx = impl.scrollUpIdx;
pub const scrollDownIdx = impl.scrollDownIdx;
pub const spawnShellIdx = impl.spawnShellIdx;
pub const resizeVtermIdx = impl.resizeVtermIdx;
pub const pollPtyIdx = impl.pollPtyIdx;
pub const ptyAliveIdx = impl.ptyAliveIdx;
pub const getCellIdx = impl.getCellIdx;
pub const getColsIdx = impl.getColsIdx;
pub const getRowsIdx = impl.getRowsIdx;
pub const getCursorRowIdx = impl.getCursorRowIdx;
pub const getCursorColIdx = impl.getCursorColIdx;
pub const getCursorVisibleIdx = impl.getCursorVisibleIdx;
pub const getRowTextIdx = impl.getRowTextIdx;
pub const getScrollbackCellIdx = impl.getScrollbackCellIdx;
pub const scrollOffsetIdx = impl.scrollOffsetIdx;
pub const scrollToBottomIdx = impl.scrollToBottomIdx;
pub const copySelectedTextIdx = impl.copySelectedTextIdx;
pub const writePtyIdx = impl.writePtyIdx;
