//! v8_bindings_autotest — host-fn surface for the self-probe autotest.
//!
//! Exposes six globals to the V8 side so the cart can call them without
//! TypeError before the real walker + event injector + hasher land:
//!
//!   __probe_tree()                → Array (currently empty; will enumerate
//!                                   every affordance on the scene graph)
//!   __probe_click(id)             → null   (will dispatch a click at node center)
//!   __probe_type(id, text)        → null   (will fire typed input)
//!   __probe_drag(id, dx, dy)      → null   (will fire drag)
//!   __probe_scroll(id, dy)        → null   (will fire scroll wheel)
//!   __probe_hash()                → "00000000"  (will hash the scene graph)
//!
//! The Zig-side scene tree is owned by framework/layout.zig, query tools
//! live in framework/query.zig, synthetic event dispatch is already
//! implemented in framework/testdriver.zig, and witness/record-replay is
//! framework/witness.zig. Future commits wire those into these stubs
//! rather than duplicating them. This commit is ONLY the host-fn surface
//! so the JS side can call the probe API without crashing.

const std = @import("std");
const v8 = @import("v8");
const v8_runtime = @import("v8_runtime.zig");

fn setReturnNull(info: v8.FunctionCallbackInfo) void {
    info.getReturnValue().set(info.getIsolate().initNull());
}

fn hostProbeTree(info_c: ?*const v8.c.FunctionCallbackInfo) callconv(.c) void {
    const info = v8.FunctionCallbackInfo.initFromV8(info_c);
    const iso = info.getIsolate();
    const arr = v8.Array.init(iso, 0);
    info.getReturnValue().set(arr);
}

fn hostProbeClick(info_c: ?*const v8.c.FunctionCallbackInfo) callconv(.c) void {
    const info = v8.FunctionCallbackInfo.initFromV8(info_c);
    setReturnNull(info);
}

fn hostProbeType(info_c: ?*const v8.c.FunctionCallbackInfo) callconv(.c) void {
    const info = v8.FunctionCallbackInfo.initFromV8(info_c);
    setReturnNull(info);
}

fn hostProbeDrag(info_c: ?*const v8.c.FunctionCallbackInfo) callconv(.c) void {
    const info = v8.FunctionCallbackInfo.initFromV8(info_c);
    setReturnNull(info);
}

fn hostProbeScroll(info_c: ?*const v8.c.FunctionCallbackInfo) callconv(.c) void {
    const info = v8.FunctionCallbackInfo.initFromV8(info_c);
    setReturnNull(info);
}

fn hostProbeHash(info_c: ?*const v8.c.FunctionCallbackInfo) callconv(.c) void {
    const info = v8.FunctionCallbackInfo.initFromV8(info_c);
    const iso = info.getIsolate();
    info.getReturnValue().set(v8.String.initUtf8(iso, "00000000"));
}

pub fn registerAutotest(vm: anytype) void {
    _ = vm;
    v8_runtime.registerHostFn("__probe_tree", hostProbeTree);
    v8_runtime.registerHostFn("__probe_click", hostProbeClick);
    v8_runtime.registerHostFn("__probe_type", hostProbeType);
    v8_runtime.registerHostFn("__probe_drag", hostProbeDrag);
    v8_runtime.registerHostFn("__probe_scroll", hostProbeScroll);
    v8_runtime.registerHostFn("__probe_hash", hostProbeHash);
}
