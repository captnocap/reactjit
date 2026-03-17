//! State Slots — the bridge between JS logic and TSZ UI
//!
//! JS calls __setState(slotId, value) to poke a value.
//! The TSZ node tree reads slot values at layout/paint time.
//! No JSON. No tree rebuild. Just slot pokes.

const std = @import("std");
const qjs = @import("qjs.zig");
const c = qjs.c;
const JSValue = qjs.JSValue;
const JSContext = qjs.JSContext;
const JS_UNDEFINED = qjs.JS_UNDEFINED;

pub const MAX_SLOTS = 256;

pub const SlotValue = union(enum) {
    int: i64,
    float: f64,
    string: []const u8,
    bool_val: bool,
    none,
};

pub const Slots = struct {
    values: [MAX_SLOTS]SlotValue = [_]SlotValue{.none} ** MAX_SLOTS,
    dirty: bool = false,
    /// String storage arena (for string slot values from JS)
    arena: std.heap.ArenaAllocator,

    pub fn init(alloc: std.mem.Allocator) Slots {
        return .{ .arena = std.heap.ArenaAllocator.init(alloc) };
    }

    pub fn deinit(self: *Slots) void {
        self.arena.deinit();
    }

    pub fn set(self: *Slots, slot: usize, val: SlotValue) void {
        if (slot >= MAX_SLOTS) return;
        self.values[slot] = val;
        self.dirty = true;
    }

    pub fn getInt(self: *Slots, slot: usize) i64 {
        if (slot >= MAX_SLOTS) return 0;
        return switch (self.values[slot]) {
            .int => |v| v,
            .float => |v| @intFromFloat(v),
            .bool_val => |v| if (v) @as(i64, 1) else 0,
            else => 0,
        };
    }

    pub fn getBool(self: *Slots, slot: usize) bool {
        if (slot >= MAX_SLOTS) return false;
        return switch (self.values[slot]) {
            .bool_val => |v| v,
            .int => |v| v != 0,
            else => false,
        };
    }

    pub fn getFloat(self: *Slots, slot: usize) f64 {
        if (slot >= MAX_SLOTS) return 0;
        return switch (self.values[slot]) {
            .float => |v| v,
            .int => |v| @floatFromInt(v),
            else => 0,
        };
    }

    pub fn getString(self: *Slots, slot: usize) []const u8 {
        if (slot >= MAX_SLOTS) return "";
        return switch (self.values[slot]) {
            .string => |v| v,
            else => "",
        };
    }

    /// Register host functions on a QuickJS context
    pub fn registerHostFunctions(self: *Slots, ctx: *c.JSContext) void {
        c.JS_SetContextOpaque(ctx, @ptrCast(self));
        const global = c.JS_GetGlobalObject(ctx);
        defer c.JS_FreeValue(ctx, global);

        _ = c.JS_SetPropertyStr(ctx, global, "__setState", c.JS_NewCFunction(ctx, hostSetState, "__setState", 2));
        _ = c.JS_SetPropertyStr(ctx, global, "__getState", c.JS_NewCFunction(ctx, hostGetState, "__getState", 1));
    }
};

// Global slots pointer for host functions (set during bind)
var g_slots: ?*Slots = null;

pub fn bindSlots(slots: *Slots) void {
    g_slots = slots;
}

fn getSlots(ctx: ?*JSContext) ?*Slots {
    _ = ctx;
    return g_slots;
}

fn hostSetState(ctx: ?*JSContext, this: JSValue, argc: c_int, argv: [*c]JSValue) callconv(.c) JSValue {
    _ = this;
    if (argc < 2) return JS_UNDEFINED;
    const slots = getSlots(ctx) orelse return JS_UNDEFINED;

    var slot_id: i32 = 0;
    _ = c.JS_ToInt32(ctx, &slot_id, argv[0]);
    if (slot_id < 0 or slot_id >= MAX_SLOTS) return JS_UNDEFINED;
    const idx: usize = @intCast(slot_id);

    const val = argv[1];
    if (c.JS_IsBool(val)) {
        slots.set(idx, .{ .bool_val = c.JS_ToBool(ctx, val) != 0 });
    } else if (c.JS_IsNumber(val)) {
        var f: f64 = 0;
        _ = c.JS_ToFloat64(ctx, &f, val);
        // Check if it's actually an integer
        var i: i32 = 0;
        if (c.JS_ToInt32(ctx, &i, val) == 0 and @as(f64, @floatFromInt(i)) == f) {
            slots.set(idx, .{ .int = @intCast(i) });
        } else {
            slots.set(idx, .{ .float = f });
        }
    } else if (c.JS_IsString(val)) {
        const str = c.JS_ToCString(ctx, val);
        if (str != null) {
            // Copy string into arena
            const span = std.mem.span(str);
            const duped = slots.arena.allocator().dupe(u8, span) catch {
                c.JS_FreeCString(ctx, str);
                return JS_UNDEFINED;
            };
            c.JS_FreeCString(ctx, str);
            slots.set(idx, .{ .string = duped });
        }
    }

    return JS_UNDEFINED;
}

fn hostGetState(ctx: ?*JSContext, this: JSValue, argc: c_int, argv: [*c]JSValue) callconv(.c) JSValue {
    _ = this;
    if (argc < 1) return JS_UNDEFINED;
    const slots = getSlots(ctx) orelse return JS_UNDEFINED;

    var slot_id: i32 = 0;
    _ = c.JS_ToInt32(ctx, &slot_id, argv[0]);
    if (slot_id < 0 or slot_id >= MAX_SLOTS) return JS_UNDEFINED;
    const idx: usize = @intCast(slot_id);

    return switch (slots.values[idx]) {
        .int => |v| c.JS_NewInt32(ctx, @intCast(@as(i32, @truncate(v)))),
        .float => |v| c.JS_NewFloat64(ctx, v),
        .bool_val => |v| c.JS_NewInt32(ctx, if (v) @as(i32, 1) else @as(i32, 0)),
        .string => |v| c.JS_NewStringLen(ctx, v.ptr, v.len),
        .none => JS_UNDEFINED,
    };
}
