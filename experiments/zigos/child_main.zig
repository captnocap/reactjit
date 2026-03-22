//! ZigOS Child Window — entry point for independent window processes.
//!
//! Spawned by the parent engine via process.zig when a window is opened
//! with .independent kind. Connects to the parent over TCP/NDJSON,
//! receives tree mutations, renders with its own wgpu surface.
//!
//! Build: zig build child-window

const child_engine = @import("framework/child_engine.zig");

pub fn main() !void {
    try child_engine.run();
}
