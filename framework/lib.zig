//! Framework library root — re-exports all public modules for app linking.
//!
//! Apps import this as the "framework" module:
//!   const fw = @import("framework");
//!   const Node = fw.layout.Node;
//!   const engine = fw.engine;

pub const layout = @import("layout.zig");
pub const engine = @import("engine.zig");
pub const state = @import("state.zig");
pub const qjs_runtime = @import("qjs_runtime.zig");
