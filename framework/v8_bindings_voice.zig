//! V8 host bindings for the voice subsystem (framework/voice.zig).
//!
//! Exposes:
//!   __voice_start()              → bool   open mic + begin VAD streaming
//!   __voice_stop()               → void   close mic + finalise current utterance
//!   __voice_set_mode(int)        → void   libfvad aggressiveness 0..3 (default 2)
//!   __voice_release_buffer(int)  → void   free a captured utterance buffer
//!
//! Events (fired from voice.tick on the engine thread, picked up by useVoiceInput):
//!   __voice_onLevel(rms_x100)    every tick while listening, 0..10000 (×100)
//!   __voice_onSpeechStart()      VAD edge: confirmed speech start
//!   __voice_onSpeechEnd(id, len) VAD edge: confirmed silence end. id keys
//!                                a buffer of `len` int16 samples.
//!   __voice_onTranscript(text)   reserved — fired by whisper integration once
//!                                that lands. Cart can listen for it today; it
//!                                just stays silent until wired.

const std = @import("std");
const v8 = @import("v8");
const v8_runtime = @import("v8_runtime.zig");
const voice = @import("voice.zig");

fn argToI32(info: v8.FunctionCallbackInfo, idx: u32) ?i32 {
    if (idx >= info.length()) return null;
    const ctx = info.getIsolate().getCurrentContext();
    return @as(i32, @intCast(info.getArg(idx).toI32(ctx) catch return null));
}

fn hostStart(info_c: ?*const v8.c.FunctionCallbackInfo) callconv(.c) void {
    const info = v8.FunctionCallbackInfo.initFromV8(info_c);
    const ok = voice.start();
    info.getReturnValue().set(v8.Boolean.init(info.getIsolate(), ok));
}

fn hostStop(info_c: ?*const v8.c.FunctionCallbackInfo) callconv(.c) void {
    const info = v8.FunctionCallbackInfo.initFromV8(info_c);
    _ = info;
    voice.stop();
}

fn hostSetMode(info_c: ?*const v8.c.FunctionCallbackInfo) callconv(.c) void {
    const info = v8.FunctionCallbackInfo.initFromV8(info_c);
    const mode = argToI32(info, 0) orelse return;
    voice.setMode(@as(c_int, mode));
}

fn hostSetFloor(info_c: ?*const v8.c.FunctionCallbackInfo) callconv(.c) void {
    const info = v8.FunctionCallbackInfo.initFromV8(info_c);
    const floor = argToI32(info, 0) orelse return;
    voice.setFloor(floor);
}

fn hostReleaseBuffer(info_c: ?*const v8.c.FunctionCallbackInfo) callconv(.c) void {
    const info = v8.FunctionCallbackInfo.initFromV8(info_c);
    const id = argToI32(info, 0) orelse return;
    if (id < 0) return;
    voice.releaseBuffer(@intCast(id));
}

pub fn registerVoice(_: anytype) void {
    v8_runtime.registerHostFn("__voice_start", hostStart);
    v8_runtime.registerHostFn("__voice_stop", hostStop);
    v8_runtime.registerHostFn("__voice_set_mode", hostSetMode);
    v8_runtime.registerHostFn("__voice_set_floor", hostSetFloor);
    v8_runtime.registerHostFn("__voice_release_buffer", hostReleaseBuffer);
}

pub fn tickDrain() void {
    // Voice ticks itself in framework/voice.zig.tick (driven from engine.zig
    // alongside clipboard_watch). The Ingredient table calls tickDrain on
    // every binding each frame; for voice the actual draining happens inside
    // voice.tick, so this is a no-op kept only to satisfy the registry shape.
}
