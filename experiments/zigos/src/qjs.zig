//! QuickJS bridge for ZigOS
//!
//! Embeds QuickJS. JS apps produce render commands via __hostFlush().

const std = @import("std");

pub const c = @cImport({
    @cDefine("_GNU_SOURCE", "1");
    @cDefine("QUICKJS_NG_BUILD", "1");
    @cInclude("quickjs.h");
});

pub const JSValue = c.JSValue;
pub const JSContext = c.JSContext;
pub const JSRuntime = c.JSRuntime;

pub const JS_UNDEFINED = JSValue{ .u = .{ .int32 = 0 }, .tag = 3 };

pub const GuestNode = struct {
    kind: NodeKind = .box,
    width: ?f32 = null,
    height: ?f32 = null,
    padding: f32 = 0,
    gap: f32 = 0,
    flex_direction: enum { row, column } = .column,
    flex_grow: f32 = 0,
    background_color: ?[4]u8 = null,
    border_radius: f32 = 0,
    text: ?[]const u8 = null,
    font_size: u16 = 16,
    text_color: ?[4]u8 = null,
    /// Direct child indices into guest_nodes array (arena-allocated)
    child_indices: []const u32 = &.{},
    on_press_id: ?u32 = null,

    pub const NodeKind = enum { box, text, image, pressable, scroll_view };
};

pub const VM = struct {
    alloc: std.mem.Allocator,
    arena: std.heap.ArenaAllocator,
    rt: *JSRuntime,
    ctx: *JSContext,
    guest_nodes: std.ArrayList(GuestNode) = .empty,
    dirty: bool = true,
    bound: bool = false,

    pub fn init(alloc: std.mem.Allocator) !VM {
        std.log.info("[qjs] Creating runtime...", .{});
        const rt = c.JS_NewRuntime() orelse return error.QJSRuntimeFailed;
        c.JS_SetMemoryLimit(rt, 64 * 1024 * 1024);
        c.JS_SetMaxStackSize(rt, 1024 * 1024);

        std.log.info("[qjs] Creating context...", .{});
        const ctx = c.JS_NewContext(rt) orelse {
            c.JS_FreeRuntime(rt);
            return error.QJSContextFailed;
        };

        std.log.info("[qjs] VM created OK", .{});
        return VM{
            .alloc = alloc,
            .arena = std.heap.ArenaAllocator.init(alloc),
            .rt = rt,
            .ctx = ctx,
        };
    }

    /// Must be called after VM is at its final address (not moved).
    /// Sets the context opaque pointer so host functions can find us.
    pub fn bind(self: *VM) void {
        std.log.info("[qjs] Binding VM at {*}", .{self});
        c.JS_SetContextOpaque(self.ctx, @ptrCast(self));
        self.registerHostFunctions();
        self.injectPolyfills();
        self.bound = true;
        std.log.info("[qjs] Bind complete, host functions registered", .{});
    }

    pub fn deinit(self: *VM) void {
        c.JS_FreeContext(self.ctx);
        c.JS_FreeRuntime(self.rt);
        self.guest_nodes.deinit(self.alloc);
        self.arena.deinit();
    }

    pub fn eval(self: *VM, source: []const u8, filename: []const u8) !void {
        std.log.info("[qjs] Eval {d} bytes from {s}", .{ source.len, filename });
        var fname_buf: [512]u8 = undefined;
        const fname_len = @min(filename.len, fname_buf.len - 1);
        @memcpy(fname_buf[0..fname_len], filename[0..fname_len]);
        fname_buf[fname_len] = 0;

        const val = c.JS_Eval(self.ctx, source.ptr, source.len, &fname_buf, c.JS_EVAL_TYPE_GLOBAL);
        defer c.JS_FreeValue(self.ctx, val);

        if (c.JS_IsException(val)) {
            self.dumpException();
            return error.JSEvalFailed;
        }
        std.log.info("[qjs] Eval OK, guest_nodes={d}", .{self.guest_nodes.items.len});
    }

    pub fn tick(self: *VM) void {
        const global = c.JS_GetGlobalObject(self.ctx);
        defer c.JS_FreeValue(self.ctx, global);

        const tick_fn = c.JS_GetPropertyStr(self.ctx, global, "__zigOS_tick");
        defer c.JS_FreeValue(self.ctx, tick_fn);

        if (!c.JS_IsUndefined(tick_fn) and !c.JS_IsNull(tick_fn)) {
            const result = c.JS_Call(self.ctx, tick_fn, global, 0, null);
            defer c.JS_FreeValue(self.ctx, result);
            if (c.JS_IsException(result)) self.dumpException();
        }

        var ctx2: ?*JSContext = null;
        while (c.JS_ExecutePendingJob(self.rt, &ctx2) > 0) {}
    }

    pub fn dispatchPress(self: *VM, press_id: u32) void {
        std.log.info("[qjs] dispatchPress id={d}", .{press_id});
        const global = c.JS_GetGlobalObject(self.ctx);
        defer c.JS_FreeValue(self.ctx, global);

        const on_press = c.JS_GetPropertyStr(self.ctx, global, "__onPress");
        defer c.JS_FreeValue(self.ctx, on_press);

        if (!c.JS_IsUndefined(on_press)) {
            var args = [1]JSValue{c.JS_NewInt32(self.ctx, @intCast(press_id))};
            const result = c.JS_Call(self.ctx, on_press, global, 1, &args);
            c.JS_FreeValue(self.ctx, result);
            std.log.info("[qjs] dispatchPress done, guest_nodes={d}", .{self.guest_nodes.items.len});
        } else {
            std.log.info("[qjs] __onPress not found", .{});
        }
    }

    fn registerHostFunctions(self: *VM) void {
        const global = c.JS_GetGlobalObject(self.ctx);
        defer c.JS_FreeValue(self.ctx, global);
        _ = c.JS_SetPropertyStr(self.ctx, global, "__hostFlush", c.JS_NewCFunction(self.ctx, hostFlush, "__hostFlush", 1));
        _ = c.JS_SetPropertyStr(self.ctx, global, "__hostLog", c.JS_NewCFunction(self.ctx, hostLog, "__hostLog", 2));
    }

    fn injectPolyfills(self: *VM) void {
        const polyfill =
            \\globalThis.console = {
            \\  log: function(...args) { __hostLog(0, args.map(String).join(' ')); },
            \\  warn: function(...args) { __hostLog(1, args.map(String).join(' ')); },
            \\  error: function(...args) { __hostLog(2, args.map(String).join(' ')); },
            \\};
            \\globalThis._timers = [];
            \\globalThis._timerIdNext = 1;
            \\globalThis.setTimeout = function(fn, ms) {
            \\  const id = globalThis._timerIdNext++;
            \\  globalThis._timers.push({ id, fn, ms: ms || 0, at: Date.now() + (ms || 0), interval: false });
            \\  return id;
            \\};
            \\globalThis.setInterval = function(fn, ms) {
            \\  const id = globalThis._timerIdNext++;
            \\  globalThis._timers.push({ id, fn, ms: ms || 16, at: Date.now() + (ms || 16), interval: true });
            \\  return id;
            \\};
            \\globalThis.clearTimeout = function(id) {
            \\  globalThis._timers = globalThis._timers.filter(t => t.id !== id);
            \\};
            \\globalThis.clearInterval = globalThis.clearTimeout;
            \\globalThis._rafCallbacks = [];
            \\globalThis._rafIdNext = 1;
            \\globalThis.requestAnimationFrame = function(fn) {
            \\  const id = globalThis._rafIdNext++;
            \\  globalThis._rafCallbacks.push({ id, fn });
            \\  return id;
            \\};
            \\globalThis.cancelAnimationFrame = function(id) {
            \\  globalThis._rafCallbacks = globalThis._rafCallbacks.filter(r => r.id !== id);
            \\};
            \\globalThis.__zigOS_tick = function() {
            \\  const now = Date.now();
            \\  const ready = globalThis._timers.filter(t => now >= t.at);
            \\  for (const t of ready) {
            \\    t.fn();
            \\    if (t.interval) { t.at = now + t.ms; }
            \\  }
            \\  globalThis._timers = globalThis._timers.filter(t => t.interval || now < t.at);
            \\  const cbs = globalThis._rafCallbacks;
            \\  globalThis._rafCallbacks = [];
            \\  for (const r of cbs) { r.fn(now); }
            \\};
        ;
        const val = c.JS_Eval(self.ctx, polyfill.ptr, polyfill.len, "<polyfill>", c.JS_EVAL_TYPE_GLOBAL);
        if (c.JS_IsException(val)) {
            std.log.err("[qjs] Polyfill injection FAILED", .{});
            self.dumpException();
        }
        c.JS_FreeValue(self.ctx, val);
    }

    pub fn dumpException(self: *VM) void {
        const exc = c.JS_GetException(self.ctx);
        defer c.JS_FreeValue(self.ctx, exc);
        const str = c.JS_ToCString(self.ctx, exc);
        if (str != null) {
            std.log.err("[JS] {s}", .{std.mem.span(str)});
            c.JS_FreeCString(self.ctx, str);
        }
        const stack = c.JS_GetPropertyStr(self.ctx, exc, "stack");
        defer c.JS_FreeValue(self.ctx, stack);
        if (!c.JS_IsUndefined(stack)) {
            const ss = c.JS_ToCString(self.ctx, stack);
            if (ss != null) {
                std.log.err("[JS Stack] {s}", .{std.mem.span(ss)});
                c.JS_FreeCString(self.ctx, ss);
            }
        }
    }

    pub fn applyFlush(self: *VM, json_str: []const u8) !void {
        std.log.info("[qjs] applyFlush: {d} bytes", .{json_str.len});
        _ = self.arena.reset(.retain_capacity);
        self.guest_nodes.clearRetainingCapacity();

        const parsed = std.json.parseFromSlice(std.json.Value, self.arena.allocator(), json_str, .{}) catch |err| {
            std.log.err("[qjs] JSON parse error: {}", .{err});
            return error.InvalidJSON;
        };
        _ = try self.parseNode(parsed.value);
        self.dirty = true;
        std.log.info("[qjs] applyFlush done: {d} guest nodes", .{self.guest_nodes.items.len});
    }

    fn parseNode(self: *VM, value: std.json.Value) !u32 {
        const obj = switch (value) {
            .object => |o| o,
            else => return error.InvalidJSON,
        };

        var node = GuestNode{};

        if (obj.get("kind")) |k| {
            if (k == .string) {
                const s = k.string;
                if (std.mem.eql(u8, s, "text")) node.kind = .text
                else if (std.mem.eql(u8, s, "pressable")) node.kind = .pressable
                else if (std.mem.eql(u8, s, "scroll")) node.kind = .scroll_view
                else if (std.mem.eql(u8, s, "image")) node.kind = .image;
            }
        }

        if (obj.get("text")) |t| {
            if (t == .string) node.text = try self.arena.allocator().dupe(u8, t.string);
        }

        if (obj.get("style")) |style_val| {
            if (style_val == .object) {
                const s = style_val.object;
                if (s.get("width")) |v| node.width = jsonFloat(v);
                if (s.get("height")) |v| node.height = jsonFloat(v);
                if (s.get("padding")) |v| node.padding = jsonFloat(v) orelse 0;
                if (s.get("gap")) |v| node.gap = jsonFloat(v) orelse 0;
                if (s.get("flexGrow")) |v| node.flex_grow = jsonFloat(v) orelse 0;
                if (s.get("borderRadius")) |v| node.border_radius = jsonFloat(v) orelse 0;
                if (s.get("flexDirection")) |v| {
                    if (v == .string and std.mem.eql(u8, v.string, "row")) node.flex_direction = .row;
                }
                if (s.get("backgroundColor")) |v| {
                    if (v == .string) node.background_color = parseColorStr(v.string);
                }
            }
        }

        if (obj.get("fontSize")) |v| {
            if (jsonFloat(v)) |f| node.font_size = @intFromFloat(f);
        }
        if (obj.get("color")) |v| {
            if (v == .string) node.text_color = parseColorStr(v.string);
        }
        if (obj.get("onPressId")) |v| {
            if (v == .integer) node.on_press_id = @intCast(v.integer);
        }

        const my_idx: u32 = @intCast(self.guest_nodes.items.len);
        try self.guest_nodes.append(self.alloc, node);

        if (obj.get("children")) |children_val| {
            if (children_val == .array) {
                const arr = children_val.array.items;
                var indices = try self.arena.allocator().alloc(u32, arr.len);
                for (arr, 0..) |child, ci| {
                    indices[ci] = try self.parseNode(child);
                }
                self.guest_nodes.items[my_idx].child_indices = indices;
            }
        }

        return my_idx;
    }
};

fn parseColorStr(s: []const u8) ?[4]u8 {
    if (s.len == 7 and s[0] == '#') {
        const r = std.fmt.parseInt(u8, s[1..3], 16) catch return null;
        const g = std.fmt.parseInt(u8, s[3..5], 16) catch return null;
        const b = std.fmt.parseInt(u8, s[5..7], 16) catch return null;
        return .{ r, g, b, 255 };
    }
    return null;
}

fn jsonFloat(v: std.json.Value) ?f32 {
    return switch (v) {
        .integer => |i| @as(f32, @floatFromInt(i)),
        .float => |f| @as(f32, @floatCast(f)),
        else => null,
    };
}

fn getVM(ctx: ?*JSContext) ?*VM {
    const ptr = c.JS_GetContextOpaque(ctx);
    if (ptr == null) {
        std.log.err("[qjs] getVM: opaque pointer is NULL!", .{});
        return null;
    }
    return @ptrCast(@alignCast(ptr));
}

fn hostFlush(ctx: ?*JSContext, this: JSValue, argc: c_int, argv: [*c]JSValue) callconv(.c) JSValue {
    _ = this;
    if (argc < 1) return JS_UNDEFINED;
    const vm = getVM(ctx) orelse return JS_UNDEFINED;
    const json_str = c.JS_ToCString(ctx, argv[0]);
    if (json_str == null) return JS_UNDEFINED;
    defer c.JS_FreeCString(ctx, json_str);
    vm.applyFlush(std.mem.span(json_str)) catch |err| {
        std.log.err("[hostFlush] error: {}", .{err});
    };
    return JS_UNDEFINED;
}

fn hostLog(ctx: ?*JSContext, this: JSValue, argc: c_int, argv: [*c]JSValue) callconv(.c) JSValue {
    _ = this;
    if (argc < 2) return JS_UNDEFINED;
    var level: i32 = 0;
    _ = c.JS_ToInt32(ctx, &level, argv[0]);
    const msg = c.JS_ToCString(ctx, argv[1]);
    if (msg == null) return JS_UNDEFINED;
    defer c.JS_FreeCString(ctx, msg);
    const prefix: []const u8 = switch (level) {
        1 => "WARN",
        2 => "ERROR",
        else => "LOG",
    };
    std.log.info("[JS {s}] {s}", .{ prefix, std.mem.span(msg) });
    return JS_UNDEFINED;
}
