//! Frame-by-frame performance telemetry.
//! Collects layout/paint timing, FPS, node count.
//! No rendering — just measurement. All getters are read by devtools components.

const std = @import("std");
const c = @import("c.zig").imports;
const layout = @import("layout.zig");
const watchdog = @import("watchdog.zig");

const Node = layout.Node;

// ── Data ────────────────────────────────────────────────────────────────────

pub const HISTORY_SIZE: usize = 120; // ~2 seconds at 60fps

pub const FrameSample = struct {
    layout_ms: f32 = 0,
    paint_ms: f32 = 0,
    total_ms: f32 = 0,
};

var history: [HISTORY_SIZE]FrameSample = [_]FrameSample{.{}} ** HISTORY_SIZE;
var history_idx: usize = 0;
var history_count: usize = 0; // fills up to HISTORY_SIZE

var fps: f32 = 0;
var fps_frames: u32 = 0;
var fps_last_tick: u32 = 0;

var node_count: u32 = 0;
var last_layout_ms: f32 = 0;
var last_paint_ms: f32 = 0;

// High-resolution timing
var layout_start: u64 = 0;
var paint_start: u64 = 0;
var perf_freq: f64 = 0;

// ── Timing API ──────────────────────────────────────────────────────────────

fn perfFreq() f64 {
    if (perf_freq == 0) {
        perf_freq = @floatFromInt(c.SDL_GetPerformanceFrequency());
    }
    return perf_freq;
}

fn ticksToMs(start: u64, end: u64) f32 {
    const delta: f64 = @as(f64, @floatFromInt(end -% start));
    return @floatCast(delta / perfFreq() * 1000.0);
}

pub fn beginLayout() void {
    layout_start = c.SDL_GetPerformanceCounter();
}

pub fn endLayout() void {
    const now = c.SDL_GetPerformanceCounter();
    last_layout_ms = ticksToMs(layout_start, now);
}

pub fn beginPaint() void {
    paint_start = c.SDL_GetPerformanceCounter();
}

pub fn endPaint() void {
    const now = c.SDL_GetPerformanceCounter();
    last_paint_ms = ticksToMs(paint_start, now);

    // Record frame sample
    const sample = FrameSample{
        .layout_ms = last_layout_ms,
        .paint_ms = last_paint_ms,
        .total_ms = last_layout_ms + last_paint_ms,
    };
    history[history_idx] = sample;
    history_idx = (history_idx + 1) % HISTORY_SIZE;
    if (history_count < HISTORY_SIZE) history_count += 1;

    // Update FPS (every 500ms)
    fps_frames += 1;
    const now_ticks = c.SDL_GetTicks();
    const elapsed = now_ticks -% fps_last_tick;
    if (elapsed >= 500) {
        fps = @as(f32, @floatFromInt(fps_frames)) / (@as(f32, @floatFromInt(elapsed)) / 1000.0);
        fps_frames = 0;
        fps_last_tick = now_ticks;
    }
}

// ── Node counting ───────────────────────────────────────────────────────────

pub fn countNodes(root: *const Node) u32 {
    var count: u32 = 1;
    for (root.children) |*child| {
        count += countNodes(child);
    }
    node_count = count;
    return count;
}

// ── Getters ─────────────────────────────────────────────────────────────────

pub fn getFps() f32 {
    return fps;
}

pub fn getLayoutMs() f32 {
    return last_layout_ms;
}

pub fn getPaintMs() f32 {
    return last_paint_ms;
}

pub fn getNodeCount() u32 {
    return node_count;
}

pub fn getRssMb() u64 {
    return watchdog.getRssMb();
}

/// Get total_ms for a specific ring buffer entry.
/// idx 0 = most recent, idx 1 = one frame ago, etc.
pub fn getFrameTime(idx: usize) f32 {
    if (idx >= history_count) return 0;
    // history_idx points to next write slot, so most recent is history_idx - 1
    const actual = (history_idx + HISTORY_SIZE - 1 - idx) % HISTORY_SIZE;
    return history[actual].total_ms;
}

pub fn getHistoryCount() usize {
    return history_count;
}

/// Get the raw history buffer and current index (for compositor sparkline rendering).
pub fn getHistory() *const [HISTORY_SIZE]FrameSample {
    return &history;
}

pub fn getHistoryIdx() usize {
    return history_idx;
}

// ── Debug ───────────────────────────────────────────────────────────────────

pub fn debugPrint() void {
    std.debug.print("[telemetry] FPS: {d:.0} | Layout: {d:.2}ms | Paint: {d:.2}ms | Nodes: {d} | RSS: {d}MB\n", .{
        fps,
        last_layout_ms,
        last_paint_ms,
        node_count,
        watchdog.getRssMb(),
    });
}
