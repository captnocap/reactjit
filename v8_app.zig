//! qjs_app.zig — React (via react-reconciler + love2d hostConfig) running in the
//! framework's real QuickJS VM, producing mutation commands that land directly on
//! framework.layout.Node. Event press → engine's js_on_press evals
//! `__dispatchEvent(id,'onClick')` → React handler runs → commit flushes new
//! mutations via __hostFlush → applied to the same Node pool → layout dirtied.
//! No hermes subprocess. Same AppConfig seam Smith uses.
//!
//! Build:
//!   zig build app -Dapp-name=qjs_d152 -Dapp-source=qjs_app.zig -Doptimize=ReleaseFast

const std = @import("std");
const build_options = @import("build_options");
const IS_LIB = if (@hasDecl(build_options, "is_lib")) build_options.is_lib else false;

const layout = @import("framework/layout.zig");
const Node = layout.Node;
const Style = layout.Style;
const Color = layout.Color;
const effect_ctx = @import("framework/effect_ctx.zig");
const input = @import("framework/input.zig");
const state = @import("framework/state.zig");
const events = @import("framework/events.zig");
const engine = if (IS_LIB) struct {} else @import("framework/engine.zig");
const qjs_runtime = @import("framework/qjs_runtime.zig"); // kept for non-VM state (input, telemetry, dock resize, pty)
const v8_runtime = @import("framework/v8_runtime.zig");
const v8_bindings_core = @import("framework/v8_bindings_core.zig");
const v8_bindings_fs = @import("framework/v8_bindings_fs.zig");
const v8_bindings_websocket = @import("framework/v8_bindings_websocket.zig");
const v8_bindings_telemetry = @import("framework/v8_bindings_telemetry.zig");
const v8_bindings_zigcall = @import("framework/v8_bindings_zigcall.zig");
// v8_bindings_sdk: deferred (see appInit comment).
const luajit_runtime = @import("framework/luajit_runtime.zig");
const fs_mod = @import("framework/fs.zig");
const localstore = @import("framework/localstore.zig");
comptime { if (!IS_LIB) _ = @import("framework/core.zig"); }

// Per-cart bundle. Path is `bundle-<app-name>.js` so that two parallel ships
// (different carts) don't race on a shared `bundle.js`. If you run
// `zig build app` directly, make sure the matching bundle file exists.
const BUNDLE_FILE_NAME = std.fmt.comptimePrint("bundle-{s}.js", .{build_options.app_name});
const BUNDLE_BYTES = @embedFile(BUNDLE_FILE_NAME);

// Window title = the build's -Dapp-name (set by scripts/ship). Falls back to
// "reactjit" for plain `zig build app` invocations that don't pass a name.
const WINDOW_TITLE = std.fmt.comptimePrint("{s}", .{
    if (@hasDecl(build_options, "app_name") and build_options.app_name.len > 0)
        build_options.app_name
    else
        "reactjit",
});

// ── Globals ────────────────────────────────────────────────────────

var g_alloc: std.mem.Allocator = undefined;
var g_arena: std.heap.ArenaAllocator = undefined;
var g_node_by_id: std.AutoHashMap(u32, *Node) = undefined;
var g_children_ids: std.AutoHashMap(u32, std.ArrayList(u32)) = undefined;
var g_root_child_ids: std.ArrayList(u32) = .{};
var g_root: Node = .{};
var g_dirty: bool = true;
var g_press_expr_pool: std.ArrayList([:0]u8) = .{};
var g_input_slot_by_node_id: std.AutoHashMap(u32, u8) = undefined;
var g_node_id_by_input_slot: [input.MAX_INPUTS]u32 = [_]u32{0} ** input.MAX_INPUTS;

// Content store + pending-flush queue live in v8_bindings_core. Exposed via
// contentStoreGet/drainPendingFlushes accessors above.

// ── Dev mode — hot reload of the JS bundle ──────────────────────────
// When DEV_MODE is enabled (via -Ddev-mode=true), the binary reads bundle.js
// from disk on startup and polls its mtime each tick. When the file changes
// (esbuild watch mode rebundles it), we tear down the tree + the QuickJS
// context, reinit, and re-eval the new bundle. React state resets on reload
// in phase 1; phase 2 will use LuaJIT hotstate atoms to preserve it.
const DEV_MODE = if (@hasDecl(build_options, "dev_mode")) build_options.dev_mode else false;
const CUSTOM_CHROME_MODE = if (@hasDecl(build_options, "custom_chrome")) build_options.custom_chrome else false;
const BORDERLESS_MODE = DEV_MODE or CUSTOM_CHROME_MODE;
const DEV_BUNDLE_PATH = "bundle.js";

var g_dev_bundle_buf: []u8 = &.{};
var g_last_bundle_mtime: i128 = 0;
var g_mtime_poll_counter: u32 = 0;
var g_reload_pending: bool = false;

const dev_ipc = @import("framework/dev_ipc.zig");

/// A dev-mode tab. Each tab has a human-readable name (cart name) and a
/// heap-owned bundle. The active tab is the one currently evaluated in QJS;
/// others sit dormant until re-activated via IPC push or (future) chrome click.
const Tab = struct {
    name: []u8, // owned
    bundle: []u8, // owned — the bundle we will evaluate next
    // Last bundle that evaluated without throwing. When a hot-reload (edit +
    // rebundle + push) throws during eval — a runtime error in top-level or
    // initial render — we restore this instead of leaving the UI wiped.
    // Owned. null until the first successful eval on this tab.
    last_good: ?[]u8 = null,
};

var g_tabs: std.ArrayList(Tab) = .{};
var g_active_tab: usize = 0;

const MAX_TABS = 16;

/// Comptime-generated per-tab click handler. We can't close over an index at
/// runtime in Zig, so we specialize one callback per slot ahead of time.
fn makeTabClickCallback(comptime idx: usize) *const fn () void {
    return struct {
        fn callback() void {
            if (idx < g_tabs.items.len and idx != g_active_tab) switchToTab(idx);
        }
    }.callback;
}

const g_tab_click_callbacks = blk: {
    var arr: [MAX_TABS]*const fn () void = undefined;
    for (0..MAX_TABS) |i| arr[i] = makeTabClickCallback(i);
    break :blk arr;
};

const CHROME_HEIGHT: f32 = 32;
const CHROME_PAD: f32 = 6;
const TAB_PAD_H: f32 = 14;
const TAB_PAD_V: f32 = 4;

fn isInputType(type_name: []const u8) bool {
    return std.mem.eql(u8, type_name, "TextInput") or
        std.mem.eql(u8, type_name, "TextArea") or
        std.mem.eql(u8, type_name, "TextEditor");
}

fn isMultilineInputType(type_name: []const u8) bool {
    return std.mem.eql(u8, type_name, "TextArea") or
        std.mem.eql(u8, type_name, "TextEditor");
}

fn isTerminalType(type_name: []const u8) bool {
    return std.mem.eql(u8, type_name, "Terminal") or
        std.mem.eql(u8, type_name, "terminal");
}

fn dupJsonText(v: std.json.Value) ?[]const u8 {
    return switch (v) {
        .string => |s| g_alloc.dupe(u8, s) catch null,
        .integer => |i| std.fmt.allocPrint(g_alloc, "{d}", .{i}) catch null,
        .float => |f| std.fmt.allocPrint(g_alloc, "{d}", .{f}) catch null,
        .bool => |b| g_alloc.dupe(u8, if (b) "true" else "false") catch null,
        else => null,
    };
}

fn dispatchInputEvent(slot: u8, global_name: [*:0]const u8) void {
    const node_id = g_node_id_by_input_slot[slot];
    if (node_id == 0) return;
    v8_runtime.callGlobal("__beginJsEvent");
    v8_runtime.callGlobal2Int(global_name, @intCast(node_id), @intCast(slot));
    v8_runtime.callGlobal("__endJsEvent");
    // Additive LuaJIT dispatch — cart code running in the Lua VM picks up the
    // same event by defining a matching global. Silent no-op if absent.
    if (luajit_runtime.hasGlobal(global_name)) {
        luajit_runtime.callGlobalInt(global_name, @intCast(node_id));
    }
}

fn makeInputChangeCallback(comptime slot: u8) *const fn () void {
    return struct {
        fn callback() void {
            dispatchInputEvent(slot, "__dispatchInputChange");
        }
    }.callback;
}

fn makeInputSubmitCallback(comptime slot: u8) *const fn () void {
    return struct {
        fn callback() void {
            dispatchInputEvent(slot, "__dispatchInputSubmit");
        }
    }.callback;
}

fn makeInputFocusCallback(comptime slot: u8) *const fn () void {
    return struct {
        fn callback() void {
            dispatchInputEvent(slot, "__dispatchInputFocus");
        }
    }.callback;
}

fn makeInputBlurCallback(comptime slot: u8) *const fn () void {
    return struct {
        fn callback() void {
            dispatchInputEvent(slot, "__dispatchInputBlur");
        }
    }.callback;
}

fn dispatchInputKeyEvent(slot: u8, key: c_int, mods: u16) void {
    const node_id = g_node_id_by_input_slot[slot];
    if (node_id == 0) return;
    v8_runtime.callGlobal("__beginJsEvent");
    v8_runtime.callGlobal3Int("__dispatchInputKey", @intCast(node_id), key, mods);
    v8_runtime.callGlobal("__endJsEvent");
    if (luajit_runtime.hasGlobal("__dispatchInputKey")) {
        luajit_runtime.callGlobal3Int("__dispatchInputKey", @intCast(node_id), key, mods);
    }
}

fn makeInputKeyCallback(comptime slot: u8) *const fn (key: c_int, mods: u16) void {
    return struct {
        fn callback(key: c_int, mods: u16) void {
            dispatchInputKeyEvent(slot, key, mods);
        }
    }.callback;
}

const g_input_change_callbacks = blk: {
    var arr: [input.MAX_INPUTS]*const fn () void = undefined;
    for (0..input.MAX_INPUTS) |i| arr[i] = makeInputChangeCallback(@intCast(i));
    break :blk arr;
};

const g_input_submit_callbacks = blk: {
    var arr: [input.MAX_INPUTS]*const fn () void = undefined;
    for (0..input.MAX_INPUTS) |i| arr[i] = makeInputSubmitCallback(@intCast(i));
    break :blk arr;
};

const g_input_focus_callbacks = blk: {
    var arr: [input.MAX_INPUTS]*const fn () void = undefined;
    for (0..input.MAX_INPUTS) |i| arr[i] = makeInputFocusCallback(@intCast(i));
    break :blk arr;
};

const g_input_blur_callbacks = blk: {
    var arr: [input.MAX_INPUTS]*const fn () void = undefined;
    for (0..input.MAX_INPUTS) |i| arr[i] = makeInputBlurCallback(@intCast(i));
    break :blk arr;
};

const g_input_key_callbacks = blk: {
    var arr: [input.MAX_INPUTS]*const fn (key: c_int, mods: u16) void = undefined;
    for (0..input.MAX_INPUTS) |i| arr[i] = makeInputKeyCallback(@intCast(i));
    break :blk arr;
};

fn ensureInputSlot(node: *Node, id: u32, type_name: []const u8) void {
    if (!isInputType(type_name)) return;

    var slot = g_input_slot_by_node_id.get(id);
    if (slot == null) {
        var reusable: ?u8 = null;
        for (g_node_id_by_input_slot, 0..) |owner_id, i| {
            if (owner_id == 0) {
                reusable = @intCast(i);
                break;
            }
        }
        if (reusable == null) {
            std.debug.print("[qjs] input slot overflow for node {d} ({s})\n", .{ id, type_name });
            return;
        }
        const new_slot = reusable.?;
        g_input_slot_by_node_id.put(id, new_slot) catch {
            std.debug.print("[qjs] failed to allocate input slot for node {d}\n", .{id});
            return;
        };
        slot = new_slot;
    }

    const sid = slot.?;
    g_node_id_by_input_slot[sid] = id;
    if (isMultilineInputType(type_name)) input.registerMultiline(sid) else input.register(sid);
    input.setOnChange(sid, g_input_change_callbacks[sid]);
    input.setOnSubmit(sid, g_input_submit_callbacks[sid]);
    input.setOnFocus(sid, g_input_focus_callbacks[sid]);
    input.setOnBlur(sid, g_input_blur_callbacks[sid]);
    input.setOnKey(sid, g_input_key_callbacks[sid]);
    node.input_id = sid;
}

fn syncInputValue(node: *Node, text: []const u8) void {
    node.text = text;
    if (node.input_id) |slot| {
        input.syncValue(slot, text);
    }
}

fn releaseInputSlot(node_id: u32) void {
    const slot = g_input_slot_by_node_id.get(node_id) orelse return;
    input.unregister(slot);
    g_node_id_by_input_slot[slot] = 0;
    _ = g_input_slot_by_node_id.remove(node_id);
}

// ── Color & prop parsing (JSON-value version) ─────────────────────

fn jsonFloat(v: std.json.Value) ?f32 {
    return switch (v) {
        .integer => |i| @floatFromInt(i),
        .float   => |f| @floatCast(f),
        else => null,
    };
}
fn jsonInt(v: std.json.Value) ?i64 {
    return switch (v) {
        .integer => |i| i,
        .float   => |f| @intFromFloat(f),
        else => null,
    };
}

// JSX idiom is `hoverable={1}` / `noWrap={0}` — accept bool or numeric 0/1 so
// carts don't have to care which literal the reconciler happens to emit.
fn jsonBool(v: std.json.Value) ?bool {
    return switch (v) {
        .bool => |b| b,
        .integer => |i| i != 0,
        .float => |f| f != 0,
        else => null,
    };
}

fn parseStringFloat(s: []const u8) ?f32 {
    const t = std.mem.trim(u8, s, " \t\r\n");
    if (t.len == 0) return null;
    return std.fmt.parseFloat(f32, t) catch null;
}

fn jsonMaybePct(v: std.json.Value) ?f32 {
    return switch (v) {
        .integer => |i| @floatFromInt(i),
        .float   => |f| @floatCast(f),
        .string  => |s| blk: {
            const t = std.mem.trim(u8, s, " \t\r\n");
            if (t.len == 0) break :blk null;
            if (std.mem.endsWith(u8, t, "%")) {
                const pct = std.fmt.parseFloat(f32, t[0 .. t.len - 1]) catch break :blk null;
                break :blk -(pct / 100.0);
            }
            break :blk std.fmt.parseFloat(f32, t) catch null;
        },
        else => null,
    };
}

fn jsonSpacing(v: std.json.Value) ?f32 {
    return switch (v) {
        .string => |s| blk: {
            const t = std.mem.trim(u8, s, " \t\r\n");
            if (std.mem.eql(u8, t, "auto")) break :blk std.math.inf(f32);
            if (std.mem.endsWith(u8, t, "%")) {
                const pct = std.fmt.parseFloat(f32, t[0 .. t.len - 1]) catch break :blk null;
                break :blk -(pct / 100.0);
            }
            break :blk parseStringFloat(t);
        },
        else => jsonFloat(v),
    };
}

fn parseHex(s: []const u8) ?Color {
    if (s.len < 4 or s[0] != '#') return null;
    const body = s[1..];
    if (body.len == 3) {
        const r = std.fmt.parseInt(u8, body[0..1], 16) catch return null;
        const g = std.fmt.parseInt(u8, body[1..2], 16) catch return null;
        const b = std.fmt.parseInt(u8, body[2..3], 16) catch return null;
        return Color.rgb(r * 17, g * 17, b * 17);
    }
    if (body.len == 6) {
        const r = std.fmt.parseInt(u8, body[0..2], 16) catch return null;
        const g = std.fmt.parseInt(u8, body[2..4], 16) catch return null;
        const b = std.fmt.parseInt(u8, body[4..6], 16) catch return null;
        return Color.rgb(r, g, b);
    }
    if (body.len == 8) {
        const r = std.fmt.parseInt(u8, body[0..2], 16) catch return null;
        const g = std.fmt.parseInt(u8, body[2..4], 16) catch return null;
        const b = std.fmt.parseInt(u8, body[4..6], 16) catch return null;
        const a = std.fmt.parseInt(u8, body[6..8], 16) catch return null;
        return Color.rgba(r, g, b, a);
    }
    return null;
}

fn parseRgb(s: []const u8) ?Color {
    var i: usize = 0;
    while (i < s.len and s[i] != '(') i += 1;
    if (i >= s.len or s[s.len - 1] != ')') return null;
    const body = s[i + 1 .. s.len - 1];
    var it = std.mem.splitScalar(u8, body, ',');
    var parts: [4]u8 = .{ 0, 0, 0, 255 };
    var idx: usize = 0;
    while (it.next()) |p| : (idx += 1) {
        if (idx >= 4) break;
        const t = std.mem.trim(u8, p, " \t");
        const v = std.fmt.parseFloat(f32, t) catch continue;
        const clamped = @max(@min(v, 255.0), 0.0);
        parts[idx] = @intFromFloat(clamped);
    }
    return Color.rgba(parts[0], parts[1], parts[2], parts[3]);
}

fn parseColor(s: []const u8) ?Color {
    if (s.len == 0) return null;
    if (s[0] == '#') return parseHex(s);
    if (std.mem.startsWith(u8, s, "rgb")) return parseRgb(s);
    const eq = std.mem.eql;
    if (eq(u8, s, "black"))   return Color.rgb(0, 0, 0);
    if (eq(u8, s, "white"))   return Color.rgb(255, 255, 255);
    if (eq(u8, s, "red"))     return Color.rgb(220, 50, 50);
    if (eq(u8, s, "blue"))    return Color.rgb(70, 130, 230);
    if (eq(u8, s, "green"))   return Color.rgb(60, 190, 100);
    if (eq(u8, s, "yellow"))  return Color.rgb(240, 210, 60);
    if (eq(u8, s, "cyan"))    return Color.rgb(70, 210, 230);
    if (eq(u8, s, "magenta")) return Color.rgb(220, 80, 200);
    if (eq(u8, s, "transparent")) return Color.rgba(0, 0, 0, 0);
    return null;
}

// tslx:GEN:PARSERS START
fn parseGutterRows(v: std.json.Value) ?[]const layout.GutterRow {
    if (v != .array) return null;
    const out = g_alloc.alloc(layout.GutterRow, v.array.items.len) catch return null;
    for (v.array.items, 0..) |row_v, idx| {
        var row: layout.GutterRow = .{};
        if (row_v == .object) {
        if (row_v.object.get("line")) |v_| { if (jsonInt(v_)) |i| row.line = @intCast(@max(0, i)); }
        if (row_v.object.get("marker")) |v_| { if (v_ == .string) row.marker = parseColor(v_.string); }
        }
        out[idx] = row;
    }
    return out;
}

fn parseMinimapRows(v: std.json.Value) ?[]const layout.MinimapRow {
    if (v != .array) return null;
    const out = g_alloc.alloc(layout.MinimapRow, v.array.items.len) catch return null;
    for (v.array.items, 0..) |row_v, idx| {
        var row: layout.MinimapRow = .{};
        if (row_v == .object) {
        if (row_v.object.get("width")) |v_| { if (jsonFloat(v_)) |f| row.width = f; }
        if (row_v.object.get("marker")) |v_| { if (v_ == .string) row.marker = parseColor(v_.string); }
        if (row_v.object.get("active")) |v_| { if (jsonBool(v_)) |b| row.active = b; }
        }
        out[idx] = row;
    }
    return out;
}
// tslx:GEN:PARSERS END

/// Parse a linear-gradient prop from JSON:
///   { x1, y1, x2, y2, stops: [{ offset, color, opacity? }] }
/// Coordinates default to (0,0)→(24,24) — the SVG viewBox icons are authored in.
/// Stops are allocated in g_alloc; lifetime matches the node (leaked on replace,
/// same pattern as canvas_path_d). Returns null on malformed input so the
/// dispatcher can fall through to canvas_fill_color.
fn parseLinearGradient(v: std.json.Value) ?layout.LinearGradient {
    if (v != .object) return null;
    var grad: layout.LinearGradient = .{ .x2 = 24, .y2 = 24 };
    if (v.object.get("x1")) |x1v| if (jsonFloat(x1v)) |f| { grad.x1 = f; };
    if (v.object.get("y1")) |y1v| if (jsonFloat(y1v)) |f| { grad.y1 = f; };
    if (v.object.get("x2")) |x2v| if (jsonFloat(x2v)) |f| { grad.x2 = f; };
    if (v.object.get("y2")) |y2v| if (jsonFloat(y2v)) |f| { grad.y2 = f; };

    const stops_v = v.object.get("stops") orelse return null;
    if (stops_v != .array) return null;
    if (stops_v.array.items.len == 0) return null;

    const buf = g_alloc.alloc(layout.GradientStop, stops_v.array.items.len) catch return null;
    var n: usize = 0;
    for (stops_v.array.items) |sv| {
        if (sv != .object) continue;
        const off_v = sv.object.get("offset") orelse continue;
        const col_v = sv.object.get("color") orelse continue;
        if (col_v != .string) continue;
        const offset = jsonFloat(off_v) orelse continue;
        var color = parseColor(col_v.string) orelse continue;
        if (sv.object.get("opacity")) |op_v| {
            if (jsonFloat(op_v)) |op| {
                const clamped: f32 = if (op < 0) 0 else if (op > 1) 1 else op;
                color.a = @intFromFloat(@as(f32, @floatFromInt(color.a)) * clamped);
            }
        }
        buf[n] = .{ .offset = offset, .color = color };
        n += 1;
    }
    if (n == 0) return null;
    grad.stops = buf[0..n];
    return grad;
}

fn parseColorTextRows(v: std.json.Value) ?[]const layout.ColorTextRow {
    if (v != .array) return null;

    const rows = g_alloc.alloc(layout.ColorTextRow, v.array.items.len) catch return null;
    for (v.array.items, 0..) |row_v, row_idx| {
        if (row_v != .array) {
            rows[row_idx] = .{};
            continue;
        }

        const spans = g_alloc.alloc(layout.ColorTextSpan, row_v.array.items.len) catch {
            rows[row_idx] = .{};
            continue;
        };

        var span_count: usize = 0;
        for (row_v.array.items) |span_v| {
            if (span_v != .object) continue;
            const text_v = span_v.object.get("text") orelse continue;
            const color_v = span_v.object.get("color") orelse continue;
            if (text_v != .string or color_v != .string) continue;

            spans[span_count] = .{
                .text = g_alloc.dupe(u8, text_v.string) catch "",
                .color = parseColor(color_v.string) orelse Color.rgb(255, 255, 255),
            };
            span_count += 1;
        }

        rows[row_idx] = .{ .spans = spans[0..span_count] };
    }
    return rows;
}

fn parseOverflow(s: []const u8) layout.Overflow {
    if (std.mem.eql(u8, s, "hidden")) return .hidden;
    if (std.mem.eql(u8, s, "scroll")) return .scroll;
    if (std.mem.eql(u8, s, "auto")) return .auto;
    return .visible;
}

fn parseDisplay(s: []const u8) layout.Display {
    if (std.mem.eql(u8, s, "none")) return .none;
    return .flex;
}

fn parsePosition(s: []const u8) layout.Position {
    if (std.mem.eql(u8, s, "absolute")) return .absolute;
    return .relative;
}

fn parseTextAlign(s: []const u8) layout.TextAlign {
    if (std.mem.eql(u8, s, "center")) return .center;
    if (std.mem.eql(u8, s, "right")) return .right;
    if (std.mem.eql(u8, s, "justify")) return .justify;
    return .left;
}

fn parseAlignItems(s: []const u8) layout.AlignItems {
    if (std.mem.eql(u8, s, "center")) return .center;
    if (std.mem.eql(u8, s, "flex-start") or std.mem.eql(u8, s, "start")) return .start;
    if (std.mem.eql(u8, s, "flex-end") or std.mem.eql(u8, s, "end")) return .end;
    if (std.mem.eql(u8, s, "baseline")) return .baseline;
    return .stretch;
}

fn parseAlignSelf(s: []const u8) layout.AlignSelf {
    if (std.mem.eql(u8, s, "center")) return .center;
    if (std.mem.eql(u8, s, "flex-start") or std.mem.eql(u8, s, "start")) return .start;
    if (std.mem.eql(u8, s, "flex-end") or std.mem.eql(u8, s, "end")) return .end;
    if (std.mem.eql(u8, s, "stretch")) return .stretch;
    if (std.mem.eql(u8, s, "baseline")) return .baseline;
    return .auto;
}

fn parseAlignContent(s: []const u8) layout.AlignContent {
    if (std.mem.eql(u8, s, "center")) return .center;
    if (std.mem.eql(u8, s, "flex-start") or std.mem.eql(u8, s, "start")) return .start;
    if (std.mem.eql(u8, s, "flex-end") or std.mem.eql(u8, s, "end")) return .end;
    if (std.mem.eql(u8, s, "space-between") or std.mem.eql(u8, s, "spaceBetween")) return .space_between;
    if (std.mem.eql(u8, s, "space-around")) return .space_around;
    if (std.mem.eql(u8, s, "space-evenly")) return .space_evenly;
    return .stretch;
}

fn applyStyleEntry(node: *Node, key: []const u8, val: std.json.Value) void {
    const eq = std.mem.eql;
    if (eq(u8, key, "width")) {
        if (jsonMaybePct(val)) |f| node.style.width = f;
    } else if (eq(u8, key, "height")) {
        if (jsonMaybePct(val)) |f| node.style.height = f;
    } else if (eq(u8, key, "minWidth")) {
        if (jsonMaybePct(val)) |f| node.style.min_width = f;
    } else if (eq(u8, key, "maxWidth")) {
        if (jsonMaybePct(val)) |f| node.style.max_width = f;
    } else if (eq(u8, key, "minHeight")) {
        if (jsonMaybePct(val)) |f| node.style.min_height = f;
    } else if (eq(u8, key, "maxHeight")) {
        if (jsonMaybePct(val)) |f| node.style.max_height = f;
    } else if (eq(u8, key, "flexDirection")) {
        if (val == .string) {
            const s = val.string;
            if (eq(u8, s, "row")) node.style.flex_direction = .row
            else if (eq(u8, s, "row-reverse")) node.style.flex_direction = .row_reverse
            else if (eq(u8, s, "column-reverse")) node.style.flex_direction = .column_reverse
            else node.style.flex_direction = .column;
        }
    } else if (eq(u8, key, "flex")) {
        // CSS shorthand: `flex: N` ≡ `flex: N 1 0%` → flexGrow=N, flexShrink=1, flexBasis=0.
        // Full `flex: grow shrink basis` parsing not needed yet — apps write them separate.
        if (jsonFloat(val)) |f| {
            node.style.flex_grow = f;
            node.style.flex_shrink = 1;
            node.style.flex_basis = 0;
        }
    } else if (eq(u8, key, "flexGrow")) {
        if (jsonFloat(val)) |f| node.style.flex_grow = f;
    } else if (eq(u8, key, "flexShrink")) {
        if (jsonFloat(val)) |f| node.style.flex_shrink = f;
    } else if (eq(u8, key, "flexBasis")) {
        if (jsonMaybePct(val)) |f| node.style.flex_basis = f;
    } else if (eq(u8, key, "flexWrap")) {
        if (val == .string) {
            if (eq(u8, val.string, "wrap")) node.style.flex_wrap = .wrap
            else if (eq(u8, val.string, "wrap-reverse")) node.style.flex_wrap = .wrap_reverse
            else node.style.flex_wrap = .no_wrap;
        }
    } else if (eq(u8, key, "gap")) {
        if (jsonFloat(val)) |f| node.style.gap = f;
    } else if (eq(u8, key, "rowGap")) {
        if (jsonFloat(val)) |f| node.style.row_gap = f;
    } else if (eq(u8, key, "columnGap")) {
        if (jsonFloat(val)) |f| node.style.column_gap = f;
    } else if (eq(u8, key, "justifyContent")) {
        if (val == .string) {
            const s = val.string;
            if (eq(u8, s, "center")) node.style.justify_content = .center
            else if (eq(u8, s, "space-between") or eq(u8, s, "spaceBetween")) node.style.justify_content = .space_between
            else if (eq(u8, s, "space-around")) node.style.justify_content = .space_around
            else if (eq(u8, s, "space-evenly")) node.style.justify_content = .space_evenly
            else if (eq(u8, s, "flex-end") or eq(u8, s, "end")) node.style.justify_content = .end
            else node.style.justify_content = .start;
        }
    } else if (eq(u8, key, "alignItems")) {
        if (val == .string) node.style.align_items = parseAlignItems(val.string);
    } else if (eq(u8, key, "alignSelf")) {
        if (val == .string) node.style.align_self = parseAlignSelf(val.string);
    } else if (eq(u8, key, "alignContent")) {
        if (val == .string) node.style.align_content = parseAlignContent(val.string);
    } else if (eq(u8, key, "padding")) {
        if (jsonFloat(val)) |f| node.style.padding = f;
    } else if (eq(u8, key, "paddingLeft")) {
        if (jsonFloat(val)) |f| node.style.padding_left = f;
    } else if (eq(u8, key, "paddingRight")) {
        if (jsonFloat(val)) |f| node.style.padding_right = f;
    } else if (eq(u8, key, "paddingTop")) {
        if (jsonFloat(val)) |f| node.style.padding_top = f;
    } else if (eq(u8, key, "paddingBottom")) {
        if (jsonFloat(val)) |f| node.style.padding_bottom = f;
    } else if (eq(u8, key, "margin")) {
        if (jsonSpacing(val)) |f| node.style.margin = f;
    } else if (eq(u8, key, "marginLeft")) {
        if (jsonSpacing(val)) |f| node.style.margin_left = f;
    } else if (eq(u8, key, "marginRight")) {
        if (jsonSpacing(val)) |f| node.style.margin_right = f;
    } else if (eq(u8, key, "marginTop")) {
        if (jsonSpacing(val)) |f| node.style.margin_top = f;
    } else if (eq(u8, key, "marginBottom")) {
        if (jsonSpacing(val)) |f| node.style.margin_bottom = f;
    } else if (eq(u8, key, "display")) {
        if (val == .string) node.style.display = parseDisplay(val.string);
    } else if (eq(u8, key, "overflow")) {
        if (val == .string) node.style.overflow = parseOverflow(val.string);
    } else if (eq(u8, key, "textAlign")) {
        if (val == .string) node.style.text_align = parseTextAlign(val.string);
    } else if (eq(u8, key, "position")) {
        if (val == .string) node.style.position = parsePosition(val.string);
    } else if (eq(u8, key, "top")) {
        if (jsonMaybePct(val)) |f| node.style.top = f;
    } else if (eq(u8, key, "left")) {
        if (jsonMaybePct(val)) |f| node.style.left = f;
    } else if (eq(u8, key, "right")) {
        if (jsonMaybePct(val)) |f| node.style.right = f;
    } else if (eq(u8, key, "bottom")) {
        if (jsonMaybePct(val)) |f| node.style.bottom = f;
    } else if (eq(u8, key, "aspectRatio")) {
        if (jsonFloat(val)) |f| node.style.aspect_ratio = f;
    } else if (eq(u8, key, "borderWidth")) {
        if (jsonFloat(val)) |f| node.style.border_width = f;
    } else if (eq(u8, key, "borderTopWidth")) {
        if (jsonFloat(val)) |f| node.style.border_top_width = f;
    } else if (eq(u8, key, "borderRightWidth")) {
        if (jsonFloat(val)) |f| node.style.border_right_width = f;
    } else if (eq(u8, key, "borderBottomWidth")) {
        if (jsonFloat(val)) |f| node.style.border_bottom_width = f;
    } else if (eq(u8, key, "borderLeftWidth")) {
        if (jsonFloat(val)) |f| node.style.border_left_width = f;
    } else if (eq(u8, key, "borderColor")) {
        if (val == .string) node.style.border_color = parseColor(val.string);
    } else if (eq(u8, key, "borderDash")) {
        // Accept [onPx, offPx] — both required, but only one needed to switch
        // the border paint path. Anything shorter/longer is ignored.
        if (val == .array and val.array.items.len >= 2) {
            if (jsonFloat(val.array.items[0])) |on| node.style.border_dash_on = on;
            if (jsonFloat(val.array.items[1])) |off| node.style.border_dash_off = off;
        }
    } else if (eq(u8, key, "borderDashOn")) {
        if (jsonFloat(val)) |f| node.style.border_dash_on = f;
    } else if (eq(u8, key, "borderDashOff")) {
        if (jsonFloat(val)) |f| node.style.border_dash_off = f;
    } else if (eq(u8, key, "borderFlowSpeed")) {
        // px/second, positive = clockwise march, negative = reverse.
        if (jsonFloat(val)) |f| node.style.border_flow_speed = f;
    } else if (eq(u8, key, "borderDashWidth")) {
        // Explicit stroke width for the animated dashed border, independent of
        // `borderWidth`. Use this when you want `borderWidth: 0` (no baked
        // outline) but still want thick animated dashes.
        if (jsonFloat(val)) |f| node.style.border_dash_width = f;
    } else if (eq(u8, key, "borderRadius")) {
        if (jsonFloat(val)) |f| node.style.border_radius = f;
    } else if (eq(u8, key, "borderTopLeftRadius")) {
        if (jsonFloat(val)) |f| node.style.border_top_left_radius = f;
    } else if (eq(u8, key, "borderTopRightRadius")) {
        if (jsonFloat(val)) |f| node.style.border_top_right_radius = f;
    } else if (eq(u8, key, "borderBottomRightRadius")) {
        if (jsonFloat(val)) |f| node.style.border_bottom_right_radius = f;
    } else if (eq(u8, key, "borderBottomLeftRadius")) {
        if (jsonFloat(val)) |f| node.style.border_bottom_left_radius = f;
    } else if (eq(u8, key, "backgroundColor")) {
        if (val == .string) node.style.background_color = parseColor(val.string);
    } else if (eq(u8, key, "opacity")) {
        if (jsonFloat(val)) |f| node.style.opacity = f;
    } else if (eq(u8, key, "rotation")) {
        if (jsonFloat(val)) |f| node.style.rotation = f;
    } else if (eq(u8, key, "scaleX")) {
        if (jsonFloat(val)) |f| node.style.scale_x = f;
    } else if (eq(u8, key, "scaleY")) {
        if (jsonFloat(val)) |f| node.style.scale_y = f;
    } else if (eq(u8, key, "zIndex")) {
        if (jsonInt(val)) |i| node.style.z_index = @intCast(i);
    }
    // Text-typography keys: also valid inside `style`, since React code
    // (and hostConfig.ts's HTML heading defaults) routes them there. Without
    // this block, `<Text style={{ fontSize: 14 }}>` and `<h1>...</h1>` both
    // silently render at the default size.
    else if (eq(u8, key, "fontSize")) {
        if (jsonInt(val)) |i| node.font_size = @intCast(@max(i, 1));
    } else if (eq(u8, key, "color")) {
        if (val == .string) node.text_color = parseColor(val.string);
    } else if (eq(u8, key, "letterSpacing")) {
        if (jsonFloat(val)) |f| node.letter_spacing = f;
    } else if (eq(u8, key, "lineHeight")) {
        if (jsonFloat(val)) |f| node.line_height = f;
    }
}

fn applyStyle(node: *Node, style_v: std.json.Value) void {
    if (style_v != .object) return;
    var it = style_v.object.iterator();
    while (it.next()) |e| applyStyleEntry(node, e.key_ptr.*, e.value_ptr.*);
}

fn resetStyleEntry(node: *Node, key: []const u8) void {
    const d = Style{};
    const eq = std.mem.eql;
    if (eq(u8, key, "width")) node.style.width = d.width
    else if (eq(u8, key, "height")) node.style.height = d.height
    else if (eq(u8, key, "minWidth")) node.style.min_width = d.min_width
    else if (eq(u8, key, "maxWidth")) node.style.max_width = d.max_width
    else if (eq(u8, key, "minHeight")) node.style.min_height = d.min_height
    else if (eq(u8, key, "maxHeight")) node.style.max_height = d.max_height
    else if (eq(u8, key, "flexDirection")) node.style.flex_direction = d.flex_direction
    else if (eq(u8, key, "flexGrow")) node.style.flex_grow = d.flex_grow
    else if (eq(u8, key, "flexShrink")) node.style.flex_shrink = d.flex_shrink
    else if (eq(u8, key, "flexBasis")) node.style.flex_basis = d.flex_basis
    else if (eq(u8, key, "flexWrap")) node.style.flex_wrap = d.flex_wrap
    else if (eq(u8, key, "gap")) node.style.gap = d.gap
    else if (eq(u8, key, "rowGap")) node.style.row_gap = d.row_gap
    else if (eq(u8, key, "columnGap")) node.style.column_gap = d.column_gap
    else if (eq(u8, key, "justifyContent")) node.style.justify_content = d.justify_content
    else if (eq(u8, key, "alignItems")) node.style.align_items = d.align_items
    else if (eq(u8, key, "alignSelf")) node.style.align_self = d.align_self
    else if (eq(u8, key, "alignContent")) node.style.align_content = d.align_content
    else if (eq(u8, key, "padding")) node.style.padding = d.padding
    else if (eq(u8, key, "paddingLeft")) node.style.padding_left = d.padding_left
    else if (eq(u8, key, "paddingRight")) node.style.padding_right = d.padding_right
    else if (eq(u8, key, "paddingTop")) node.style.padding_top = d.padding_top
    else if (eq(u8, key, "paddingBottom")) node.style.padding_bottom = d.padding_bottom
    else if (eq(u8, key, "margin")) node.style.margin = d.margin
    else if (eq(u8, key, "marginLeft")) node.style.margin_left = d.margin_left
    else if (eq(u8, key, "marginRight")) node.style.margin_right = d.margin_right
    else if (eq(u8, key, "marginTop")) node.style.margin_top = d.margin_top
    else if (eq(u8, key, "marginBottom")) node.style.margin_bottom = d.margin_bottom
    else if (eq(u8, key, "display")) node.style.display = d.display
    else if (eq(u8, key, "overflow")) node.style.overflow = d.overflow
    else if (eq(u8, key, "textAlign")) node.style.text_align = d.text_align
    else if (eq(u8, key, "position")) node.style.position = d.position
    else if (eq(u8, key, "top")) node.style.top = d.top
    else if (eq(u8, key, "left")) node.style.left = d.left
    else if (eq(u8, key, "right")) node.style.right = d.right
    else if (eq(u8, key, "bottom")) node.style.bottom = d.bottom
    else if (eq(u8, key, "aspectRatio")) node.style.aspect_ratio = d.aspect_ratio
    else if (eq(u8, key, "borderWidth")) node.style.border_width = d.border_width
    else if (eq(u8, key, "borderTopWidth")) node.style.border_top_width = d.border_top_width
    else if (eq(u8, key, "borderRightWidth")) node.style.border_right_width = d.border_right_width
    else if (eq(u8, key, "borderBottomWidth")) node.style.border_bottom_width = d.border_bottom_width
    else if (eq(u8, key, "borderLeftWidth")) node.style.border_left_width = d.border_left_width
    else if (eq(u8, key, "borderColor")) node.style.border_color = d.border_color
    else if (eq(u8, key, "borderRadius")) node.style.border_radius = d.border_radius
    else if (eq(u8, key, "borderTopLeftRadius")) node.style.border_top_left_radius = d.border_top_left_radius
    else if (eq(u8, key, "borderTopRightRadius")) node.style.border_top_right_radius = d.border_top_right_radius
    else if (eq(u8, key, "borderBottomRightRadius")) node.style.border_bottom_right_radius = d.border_bottom_right_radius
    else if (eq(u8, key, "borderBottomLeftRadius")) node.style.border_bottom_left_radius = d.border_bottom_left_radius
    else if (eq(u8, key, "backgroundColor")) node.style.background_color = d.background_color
    else if (eq(u8, key, "opacity")) node.style.opacity = d.opacity
    else if (eq(u8, key, "rotation")) node.style.rotation = d.rotation
    else if (eq(u8, key, "scaleX")) node.style.scale_x = d.scale_x
    else if (eq(u8, key, "scaleY")) node.style.scale_y = d.scale_y
    else if (eq(u8, key, "zIndex")) node.style.z_index = d.z_index;
}

fn removeStyleKeys(node: *Node, keys_v: std.json.Value) void {
    if (keys_v != .array) return;
    for (keys_v.array.items) |entry| {
        if (entry == .string) resetStyleEntry(node, entry.string);
    }
}

fn removePropKeys(node: *Node, keys_v: std.json.Value) void {
    if (keys_v != .array) return;
    for (keys_v.array.items) |entry| {
        if (entry != .string) continue;
        const k = entry.string;
        if (std.mem.eql(u8, k, "fontSize")) {
            if (node.terminal) node.terminal_font_size = 13 else node.font_size = 16;
        }
        else if (std.mem.eql(u8, k, "color")) node.text_color = null
        else if (std.mem.eql(u8, k, "letterSpacing")) node.letter_spacing = 0
        else if (std.mem.eql(u8, k, "lineHeight")) node.line_height = 0
        else if (std.mem.eql(u8, k, "numberOfLines")) node.number_of_lines = 0
        else if (std.mem.eql(u8, k, "noWrap")) node.no_wrap = false
        else if (std.mem.eql(u8, k, "paintText")) node.input_paint_text = true
        else if (std.mem.eql(u8, k, "colorRows")) node.input_color_rows = null
        else if (std.mem.eql(u8, k, "placeholder")) node.placeholder = null
        else if (std.mem.eql(u8, k, "value")) node.text = null
        else if (std.mem.eql(u8, k, "source")) node.image_src = null
        else if (std.mem.eql(u8, k, "href")) node.href = null
        else if (std.mem.eql(u8, k, "tooltip")) node.tooltip = null
        else if (std.mem.eql(u8, k, "hoverable")) node.hoverable = false
        else if (std.mem.eql(u8, k, "debugName")) node.debug_name = null
        else if (std.mem.eql(u8, k, "testID")) node.test_id = null
        else if (std.mem.eql(u8, k, "windowDrag")) node.window_drag = false
        else if (std.mem.eql(u8, k, "windowResize")) node.window_resize = false;
    }
}

fn applyTypeDefaults(node: *Node, id: u32, type_name: []const u8) void {
    const eq = std.mem.eql;
    if (eq(u8, type_name, "ScrollView")) {
        node.style.overflow = .scroll;
    // tslx:GEN:TYPE_DEFAULTS START
    } else if (eq(u8, type_name, "CodeGutter")) {
        node.gutter_rows = &[_]layout.GutterRow{};
    } else if (eq(u8, type_name, "Minimap")) {
        node.minimap_rows = &[_]layout.MinimapRow{};
    // tslx:GEN:TYPE_DEFAULTS END
    } else if (eq(u8, type_name, "Canvas")) {
        // Infinite pan/zoom surface. `canvas_type` is what wires engine paint,
        // hit-testing, drag-to-pan and wheel-to-zoom in events.zig / engine.zig.
        node.canvas_type = "canvas";
        node.graph_container = true;
    } else if (eq(u8, type_name, "Graph")) {
        // Static viewport — view transform only, no interaction.
        node.graph_container = true;
    } else if (eq(u8, type_name, "Canvas.Node") or eq(u8, type_name, "Graph.Node")) {
        node.canvas_node = true;
    } else if (eq(u8, type_name, "Canvas.Path") or eq(u8, type_name, "Graph.Path")) {
        node.canvas_path = true;
    } else if (eq(u8, type_name, "Canvas.Clamp")) {
        node.canvas_clamp = true;
    } else if (isTerminalType(type_name)) {
        node.terminal = true;
    }
    ensureInputSlot(node, id, type_name);
}

fn applyProps(node: *Node, props: std.json.Value, type_name: ?[]const u8) void {
    if (props != .object) return;
    const is_input = node.input_id != null or (type_name != null and isInputType(type_name.?));
    const is_terminal = node.terminal or (type_name != null and isTerminalType(type_name.?));
    var it = props.object.iterator();
    while (it.next()) |e| {
        const k = e.key_ptr.*;
        const v = e.value_ptr.*;
        if (std.mem.eql(u8, k, "style")) applyStyle(node, v)
        else if (std.mem.eql(u8, k, "fontSize")) {
            if (jsonInt(v)) |i| {
                const size: u16 = @intCast(@max(i, 1));
                if (is_terminal) node.terminal_font_size = size else node.font_size = size;
            }
        } else if (is_terminal and std.mem.eql(u8, k, "terminalFontSize")) {
            if (jsonInt(v)) |i| node.terminal_font_size = @intCast(@max(i, 1));
        } else if (std.mem.eql(u8, k, "color")) {
            if (v == .string) node.text_color = parseColor(v.string);
        } else if (std.mem.eql(u8, k, "letterSpacing")) {
            if (jsonFloat(v)) |f| node.letter_spacing = f;
        } else if (std.mem.eql(u8, k, "lineHeight")) {
            if (jsonFloat(v)) |f| node.line_height = f;
        } else if (std.mem.eql(u8, k, "numberOfLines")) {
            if (jsonInt(v)) |i| node.number_of_lines = @intCast(@max(i, 0));
        } else if (std.mem.eql(u8, k, "noWrap")) {
            if (jsonBool(v)) |b| node.no_wrap = b;
        } else if (is_input and std.mem.eql(u8, k, "paintText")) {
            if (jsonBool(v)) |b| node.input_paint_text = b;
        } else if (is_input and std.mem.eql(u8, k, "colorRows")) {
            node.input_color_rows = parseColorTextRows(v);
        }
        // tslx:GEN:PROPS START
                // ── CodeGutter primitive props ──
        else if (node.gutter_rows != null and std.mem.eql(u8, k, "rows")) {
            node.gutter_rows = parseGutterRows(v);
        } else if (node.gutter_rows != null and std.mem.eql(u8, k, "rowHeight")) {
            if (jsonFloat(v)) |f| node.gutter_row_height = f;
        } else if (node.gutter_rows != null and std.mem.eql(u8, k, "cursorLine")) {
            if (jsonInt(v)) |i| node.gutter_cursor_line = @intCast(@max(0, i));
        } else if (node.gutter_rows != null and std.mem.eql(u8, k, "activeBg")) {
            if (v == .string) node.gutter_active_bg = parseColor(v.string);
        } else if (node.gutter_rows != null and std.mem.eql(u8, k, "activeText")) {
            if (v == .string) node.gutter_active_text = parseColor(v.string);
        } else if (node.gutter_rows != null and std.mem.eql(u8, k, "textColor")) {
            if (v == .string) node.gutter_text = parseColor(v.string);
        }
                // ── Minimap primitive props ──
        else if (node.minimap_rows != null and std.mem.eql(u8, k, "rows")) {
            node.minimap_rows = parseMinimapRows(v);
        } else if (node.minimap_rows != null and std.mem.eql(u8, k, "rowHeight")) {
            if (jsonFloat(v)) |f| node.minimap_row_height = f;
        } else if (node.minimap_rows != null and std.mem.eql(u8, k, "rowGap")) {
            if (jsonFloat(v)) |f| node.minimap_row_gap = f;
        } else if (node.minimap_rows != null and std.mem.eql(u8, k, "activeColor")) {
            if (v == .string) node.minimap_active_color = parseColor(v.string);
        } else if (node.minimap_rows != null and std.mem.eql(u8, k, "inactiveColor")) {
            if (v == .string) node.minimap_inactive_color = parseColor(v.string);
        }
        // tslx:GEN:PROPS END
        else if (is_input and std.mem.eql(u8, k, "placeholder")) {
            if (dupJsonText(v)) |s| node.placeholder = s;
        } else if (is_input and std.mem.eql(u8, k, "value")) {
            if (dupJsonText(v)) |s| syncInputValue(node, s);
        } else if (is_input and std.mem.eql(u8, k, "contentHandle")) {
            // Handle-based content: skip the 1MB string-prop round-trip. The
            // buffer already lives in g_content_store; point node.text directly
            // at it so the paint path reads the Zig-owned bytes. Stays valid
            // until the hook cleanup releases the handle.
            const handle: u32 = switch (v) {
                .integer => @intCast(@max(0, v.integer)),
                .float => @intFromFloat(@max(0.0, v.float)),
                else => 0,
            };
            if (handle != 0) {
                if (contentStoreGet(handle)) |buf| syncInputValue(node, buf);
            }
        } else if (std.mem.eql(u8, k, "source")) {
            if (dupJsonText(v)) |s| node.image_src = s;
        } else if (std.mem.eql(u8, k, "renderSrc")) {
            if (dupJsonText(v)) |s| node.render_src = s;
        } else if (std.mem.eql(u8, k, "href")) {
            if (dupJsonText(v)) |s| node.href = s;
        } else if (std.mem.eql(u8, k, "tooltip")) {
            if (dupJsonText(v)) |s| node.tooltip = s;
        } else if (std.mem.eql(u8, k, "hoverable")) {
            if (jsonBool(v)) |b| node.hoverable = b;
        } else if (std.mem.eql(u8, k, "debugName")) {
            if (dupJsonText(v)) |s| node.debug_name = s;
        } else if (std.mem.eql(u8, k, "testID")) {
            if (dupJsonText(v)) |s| node.test_id = s;
        } else if (std.mem.eql(u8, k, "windowDrag")) {
            if (jsonBool(v)) |b| node.window_drag = b;
        } else if (std.mem.eql(u8, k, "windowResize")) {
            if (jsonBool(v)) |b| node.window_resize = b;
        } else if (std.mem.eql(u8, k, "initialScrollY")) {
            // One-shot: set scroll_y on CREATE so dev hot reloads can restore
            // the user's scroll position via the ScrollView React wrapper.
            // CREATE passes a non-null type_name; UPDATE passes null. Applying
            // on UPDATE would clobber the user's live scroll on every prop
            // commit. The framework clamps this to content bounds on first layout.
            if (type_name != null) {
                if (jsonFloat(v)) |f| node.scroll_y = f;
            }
        } else if (std.mem.eql(u8, k, "initialScrollX")) {
            if (type_name != null) {
                if (jsonFloat(v)) |f| node.scroll_x = f;
            }
        } else if (std.mem.eql(u8, k, "originTopLeft")) {
            // Graph/Canvas container: flip world-origin from center to top-left.
            // Opt-in; polar / pan-zoom code stays on the center-origin default.
            if (jsonBool(v)) |b| node.graph_origin_topleft = b;
        }
        // ── Canvas / Graph props ──
        else if (std.mem.eql(u8, k, "gx")) {
            if (jsonFloat(v)) |f| node.canvas_gx = f;
        } else if (std.mem.eql(u8, k, "gy")) {
            if (jsonFloat(v)) |f| node.canvas_gy = f;
        } else if (std.mem.eql(u8, k, "gw")) {
            if (jsonFloat(v)) |f| node.canvas_gw = f;
        } else if (std.mem.eql(u8, k, "gh")) {
            if (jsonFloat(v)) |f| node.canvas_gh = f;
        } else if (std.mem.eql(u8, k, "d")) {
            if (dupJsonText(v)) |s| node.canvas_path_d = s;
        } else if (std.mem.eql(u8, k, "stroke")) {
            // `stroke` maps to text_color — that's the field engine_paint.zig
            // reads for Canvas.Path / Graph.Path stroke color.
            if (v == .string) node.text_color = parseColor(v.string);
        } else if (std.mem.eql(u8, k, "strokeWidth")) {
            if (jsonFloat(v)) |f| node.canvas_stroke_width = f;
        } else if (std.mem.eql(u8, k, "fill")) {
            if (v == .string) node.canvas_fill_color = parseColor(v.string);
        } else if (std.mem.eql(u8, k, "gradient")) {
            node.canvas_fill_gradient = parseLinearGradient(v);
        } else if (std.mem.eql(u8, k, "fillEffect")) {
            if (dupJsonText(v)) |s| node.canvas_fill_effect = s;
        } else if (std.mem.eql(u8, k, "textEffect")) {
            if (dupJsonText(v)) |s| node.text_effect = s;
        } else if (std.mem.eql(u8, k, "viewX")) {
            // Initial camera — engine applies once per canvas instance, then
            // user drag/scroll takes over (see paintCanvasContainer).
            if (jsonFloat(v)) |f| { node.canvas_view_x = f; node.canvas_view_set = true; }
        } else if (std.mem.eql(u8, k, "viewY")) {
            if (jsonFloat(v)) |f| { node.canvas_view_y = f; node.canvas_view_set = true; }
        } else if (std.mem.eql(u8, k, "viewZoom")) {
            if (jsonFloat(v)) |f| { node.canvas_view_zoom = f; node.canvas_view_set = true; }
        }
        // ── Effect props ──
        else if (std.mem.eql(u8, k, "name")) {
            if (dupJsonText(v)) |s| node.effect_name = s;
        } else if (std.mem.eql(u8, k, "background")) {
            if (jsonBool(v)) |b| node.effect_background = b;
        } else if (std.mem.eql(u8, k, "shader")) {
            // WGSL fragment shader body. We prepend a standard header
            // (uniforms struct, fullscreen-triangle vs_main) and the
            // shared math library (snoise, fbm, hsv2rgb, hsl2rgb, …)
            // before the user code so every cart sees the same surface.
            if (v == .string) {
                if (assembleEffectShader(v.string)) |wgsl| {
                    node.effect_shader = .{ .wgsl = wgsl };
                }
            }
        }
    }
}

// WGSL header: uniforms + fullscreen-triangle vertex shader. Matches the
// GpuUniforms layout in framework/effects.zig and the `vs_main`/`fs_main`
// entry points renderGpu expects.
const EFFECT_WGSL_HEADER: []const u8 =
    \\struct Uniforms {
    \\  size_w: f32,
    \\  size_h: f32,
    \\  time: f32,
    \\  dt: f32,
    \\  frame: f32,
    \\  mouse_x: f32,
    \\  mouse_y: f32,
    \\  mouse_inside: f32,
    \\};
    \\@group(0) @binding(0) var<uniform> U: Uniforms;
    \\
    \\struct VsOut {
    \\  @builtin(position) pos: vec4f,
    \\  @location(0) uv: vec2f,
    \\};
    \\
    \\@vertex fn vs_main(@builtin(vertex_index) i: u32) -> VsOut {
    \\  let positions = array<vec2f, 3>(vec2f(-1.0, -1.0), vec2f(3.0, -1.0), vec2f(-1.0, 3.0));
    \\  // UV's Y is inverted relative to framebuffer: the image shader
    \\  // (framework/gpu/shaders.zig image_wgsl) samples with `uv.y = 1 - corner.y`
    \\  // to compensate for CPU-path flipRowsInPlace. To get the same top-down
    \\  // display for shader-written textures, we map framebuffer y=0 → uv.y=1
    \\  // (user's "bottom"), so that texture row 0 holds "bottom content" and the
    \\  // image shader's flip displays "top content" at screen top.
    \\  let uvs = array<vec2f, 3>(vec2f(0.0, 0.0), vec2f(2.0, 0.0), vec2f(0.0, 2.0));
    \\  var out: VsOut;
    \\  out.pos = vec4f(positions[i], 0.0, 1.0);
    \\  out.uv = uvs[i];
    \\  return out;
    \\}
    \\
;

const EFFECT_WGSL_MATH: []const u8 = @embedFile("framework/gpu/effect_math.wgsl");

fn assembleEffectShader(user_wgsl: []const u8) ?[]const u8 {
    const total = EFFECT_WGSL_HEADER.len + EFFECT_WGSL_MATH.len + user_wgsl.len + 2;
    const out = g_alloc.alloc(u8, total) catch return null;
    var i: usize = 0;
    @memcpy(out[i .. i + EFFECT_WGSL_HEADER.len], EFFECT_WGSL_HEADER);
    i += EFFECT_WGSL_HEADER.len;
    @memcpy(out[i .. i + EFFECT_WGSL_MATH.len], EFFECT_WGSL_MATH);
    i += EFFECT_WGSL_MATH.len;
    out[i] = '\n';
    i += 1;
    @memcpy(out[i .. i + user_wgsl.len], user_wgsl);
    i += user_wgsl.len;
    return out[0..i];
}

// Called by effects.renderCpuNow when a node has node.effect_render pointing
// at us. `ctx.user_data` carries the React fiber id (set on the Instance as
// node_key = node.scroll_persist_slot, see effects.zig instanceKey). That id
// is what handlerRegistry maps to the user's onRender closure.
fn v8_effect_shim(ctx: *effect_ctx.EffectContext) void {
    const id_u: usize = ctx.user_data;
    if (id_u == 0) return;
    const id: u32 = @intCast(id_u);
    const buf_len: usize = @as(usize, ctx.height) * @as(usize, ctx.stride);
    v8_runtime.dispatchEffectRender(
        id,
        ctx.buf,
        buf_len,
        ctx.width,
        ctx.height,
        ctx.stride,
        ctx.time,
        ctx.dt,
        ctx.mouse_x,
        ctx.mouse_y,
        ctx.mouse_inside,
        ctx.frame,
    );
}

// Placeholder render_fn for shader-only effects. `paintCustomEffect` only
// engages when node.effect_render is non-null, so shader-only nodes need a
// real pointer here. The GPU path fires first (shouldTryGpu → renderGpu)
// and the CPU path never actually calls this — it's just a gate.
fn noop_effect_render(_: *effect_ctx.EffectContext) void {}

// ── Event wiring: set js_on_press = `__dispatchEvent(<id>, 'onClick')` ───

fn cmdHasHandlerName(cmd: std.json.Value, name: []const u8) bool {
    const names_v = cmd.object.get("handlerNames") orelse return false;
    if (names_v != .array) return false;
    for (names_v.array.items) |entry| {
        if (entry == .string and std.mem.eql(u8, entry.string, name)) return true;
    }
    return false;
}

fn cmdHasAnyHandlerName(cmd: std.json.Value, comptime names: []const []const u8) bool {
    inline for (names) |name| {
        if (cmdHasHandlerName(cmd, name)) return true;
    }
    return false;
}

fn installJsExpr(comptime expr_fmt: []const u8, id: u32) ?[*:0]const u8 {
    const s = std.fmt.allocPrint(g_alloc, expr_fmt, .{id}) catch return null;
    const sz: [:0]u8 = s[0 .. s.len - 1 :0];
    g_press_expr_pool.append(g_alloc, sz) catch {};
    return sz.ptr;
}

fn applyHandlerFlags(node: *Node, id: u32, cmd: std.json.Value) void {
    node.handlers.js_on_press = null;
    node.handlers.js_on_mouse_down = null;
    node.handlers.js_on_mouse_up = null;
    node.handlers.js_on_hover_enter = null;
    node.handlers.js_on_hover_exit = null;
    node.handlers.on_scroll = null;
    node.handlers.on_right_click = null;
    node.canvas_move_draggable = false;
    node.effect_render = null;

    if (cmdHasAnyHandlerName(cmd, &.{ "onClick", "onPress" })) {
        node.handlers.js_on_press = installJsExpr("__dispatchEvent({d},'onClick')\x00", id);
    }
    if (cmdHasAnyHandlerName(cmd, &.{ "onMouseDown" })) {
        node.handlers.js_on_mouse_down = installJsExpr("__dispatchEvent({d},'onMouseDown')\x00", id);
    }
    if (cmdHasAnyHandlerName(cmd, &.{ "onMouseUp" })) {
        node.handlers.js_on_mouse_up = installJsExpr("__dispatchEvent({d},'onMouseUp')\x00", id);
    }
    if (cmdHasAnyHandlerName(cmd, &.{ "onHoverEnter", "onMouseEnter" })) {
        node.handlers.js_on_hover_enter = installJsExpr("__dispatchEvent({d},'onHoverEnter')\x00", id);
    }
    if (cmdHasAnyHandlerName(cmd, &.{ "onHoverExit", "onMouseLeave" })) {
        node.handlers.js_on_hover_exit = installJsExpr("__dispatchEvent({d},'onHoverExit')\x00", id);
    }
    if (cmdHasAnyHandlerName(cmd, &.{"onScroll"})) {
        node.handlers.on_scroll = qjs_runtime.dispatchPreparedScroll;
    }
    if (cmdHasAnyHandlerName(cmd, &.{ "onRightClick", "onContextMenu" })) {
        node.handlers.on_right_click = qjs_runtime.dispatchPreparedRightClick;
    }
    if (cmdHasAnyHandlerName(cmd, &.{"onMove"})) {
        node.canvas_move_draggable = true;
    }
    // onRender wires this node into the Effect custom-render path. The React
    // id is carried through materializeChildren via node.scroll_persist_slot
    // and read back from ctx.user_data inside v8_effect_shim.
    if (cmdHasHandlerName(cmd, "onRender")) {
        node.effect_render = &v8_effect_shim;
    } else if (node.effect_shader != null) {
        // Shader-only effect — paintCustomEffect gates on effect_render being
        // non-null. The GPU pipeline (shouldTryGpu → renderGpu) fires before
        // the CPU path so this pointer is only a gate, never called.
        node.effect_render = &noop_effect_render;
    }
}

// Engine-owned Alt+drag writes the in-progress canvas_gx/gy straight into the
// host Node pool so each motion picks up the new position without going through
// a React setState (which would re-render the whole Canvas.Node subtree and
// saturate __hostFlush with multi-KB UPDATE batches).
fn setCanvasNodePosition(id: u32, gx: f32, gy: f32) void {
    if (g_node_by_id.get(id)) |node| {
        node.canvas_gx = gx;
        node.canvas_gy = gy;
    }
}

// ── Command application ─────────────────────────────────────────

fn ensureNode(id: u32) !*Node {
    if (g_node_by_id.get(id)) |n| return n;
    const n = try g_alloc.create(Node);
    n.* = .{};
    n.scroll_persist_slot = id;
    try g_node_by_id.put(id, n);
    try g_children_ids.put(id, .{});
    return n;
}

/// When a bare text node (created by CREATE_TEXT, i.e. React's TextInstance
/// for a string child) is appended to a parent, copy the parent's typography
/// so `<Text fontSize={17}>Hello</Text>` actually renders "Hello" at 17. The
/// reconciler makes the parent Text and child TextInstance separate nodes;
/// without this propagation the child inherits nothing and uses the default 16.
fn inheritTypography(parent_id: u32, child_id: u32) void {
    const parent = g_node_by_id.get(parent_id) orelse return;
    const child = g_node_by_id.get(child_id) orelse return;
    if (child.text == null) return;
    child.font_size = parent.font_size;
    if (parent.text_color) |c| child.text_color = c;
    child.letter_spacing = parent.letter_spacing;
    // Only propagate line_height when the parent explicitly set one. Without
    // this guard, a child with its own `lineHeight` style would get stomped
    // back to 0 by any parent UPDATE (the default), which desynchronises
    // paint (uses node.line_height) from hit-test (uses node.line_height).
    if (parent.line_height > 0) child.line_height = parent.line_height;
}

fn applyCommand(cmd: std.json.Value) !void {
    if (cmd != .object) return;
    const op = (cmd.object.get("op") orelse return).string;

    if (std.mem.eql(u8, op, "CREATE")) {
        const id: u32 = @intCast(cmd.object.get("id").?.integer);
        const n = try ensureNode(id);
        var type_name: ?[]const u8 = null;
        if (cmd.object.get("type")) |t| if (t == .string) {
            type_name = t.string;
            applyTypeDefaults(n, id, t.string);
        };
        if (cmd.object.get("props")) |props| applyProps(n, props, type_name);
        // debugName / debugSource are emitted as top-level siblings to props
        // by renderer/hostConfig.ts (not inside the props object). Capture
        // them here so witness.zig / autotest can label pressables by the
        // user-component name the reconciler resolved via fiber walk.
        if (cmd.object.get("debugName")) |dn| if (dn == .string and dn.string.len > 0) {
            if (g_alloc.dupe(u8, dn.string)) |owned| {
                n.debug_name = owned;
            } else |_| {}
        };
        applyHandlerFlags(n, id, cmd);
        g_dirty = true;
    } else if (std.mem.eql(u8, op, "CREATE_TEXT")) {
        const id: u32 = @intCast(cmd.object.get("id").?.integer);
        const n = try ensureNode(id);
        if (cmd.object.get("text")) |t| if (t == .string) {
            n.text = try g_alloc.dupe(u8, t.string);
        };
        g_dirty = true;
    } else if (std.mem.eql(u8, op, "APPEND")) {
        const pid: u32 = @intCast(cmd.object.get("parentId").?.integer);
        const cid: u32 = @intCast(cmd.object.get("childId").?.integer);
        _ = try ensureNode(pid); _ = try ensureNode(cid);
        if (g_children_ids.getPtr(pid)) |list| try list.append(g_alloc, cid);
        inheritTypography(pid, cid);
        g_dirty = true;
    } else if (std.mem.eql(u8, op, "APPEND_TO_ROOT")) {
        const cid: u32 = @intCast(cmd.object.get("childId").?.integer);
        _ = try ensureNode(cid);
        try g_root_child_ids.append(g_alloc, cid);
        g_dirty = true;
    } else if (std.mem.eql(u8, op, "INSERT_BEFORE_ROOT")) {
        const cid: u32 = @intCast(cmd.object.get("childId").?.integer);
        const bid: u32 = @intCast(cmd.object.get("beforeId").?.integer);
        _ = try ensureNode(cid);
        var idx: usize = g_root_child_ids.items.len;
        for (g_root_child_ids.items, 0..) |x, i| if (x == bid) { idx = i; break; };
        try g_root_child_ids.insert(g_alloc, idx, cid);
        g_dirty = true;
    } else if (std.mem.eql(u8, op, "INSERT_BEFORE")) {
        const pid: u32 = @intCast(cmd.object.get("parentId").?.integer);
        const cid: u32 = @intCast(cmd.object.get("childId").?.integer);
        const bid: u32 = @intCast(cmd.object.get("beforeId").?.integer);
        _ = try ensureNode(cid);
        if (g_children_ids.getPtr(pid)) |list| {
            var idx: usize = list.items.len;
            for (list.items, 0..) |x, i| if (x == bid) { idx = i; break; };
            try list.insert(g_alloc, idx, cid);
        }
        inheritTypography(pid, cid);
        g_dirty = true;
    } else if (std.mem.eql(u8, op, "REMOVE")) {
        const pid: u32 = @intCast(cmd.object.get("parentId").?.integer);
        const cid: u32 = @intCast(cmd.object.get("childId").?.integer);
        if (g_children_ids.getPtr(pid)) |list| {
            for (list.items, 0..) |x, i| if (x == cid) { _ = list.orderedRemove(i); break; };
        }
        g_dirty = true;
    } else if (std.mem.eql(u8, op, "REMOVE_FROM_ROOT")) {
        const cid: u32 = @intCast(cmd.object.get("childId").?.integer);
        for (g_root_child_ids.items, 0..) |x, i| if (x == cid) { _ = g_root_child_ids.orderedRemove(i); break; };
        g_dirty = true;
    } else if (std.mem.eql(u8, op, "UPDATE")) {
        const id: u32 = @intCast(cmd.object.get("id").?.integer);
        if (g_node_by_id.get(id)) |n| {
            if (cmd.object.get("removeKeys")) |keys| removePropKeys(n, keys);
            if (cmd.object.get("removeStyleKeys")) |keys| removeStyleKeys(n, keys);
            if (cmd.object.get("props")) |props| applyProps(n, props, null);
            applyHandlerFlags(n, id, cmd);
            // Propagate typography to bare text children so dynamic fontSize
            // changes on the parent flow through to the child TextInstances.
            if (g_children_ids.get(id)) |children| {
                for (children.items) |child_id| inheritTypography(id, child_id);
            }
            g_dirty = true;
        }
    } else if (std.mem.eql(u8, op, "UPDATE_TEXT")) {
        const id: u32 = @intCast(cmd.object.get("id").?.integer);
        if (g_node_by_id.get(id)) |n| {
            if (cmd.object.get("text")) |t| if (t == .string) {
                n.text = try g_alloc.dupe(u8, t.string);
            };
            g_dirty = true;
        }
    }
}

fn applyCommandBatch(json_bytes: []const u8) void {
    const t0 = std.time.microTimestamp();
    const parsed = std.json.parseFromSlice(std.json.Value, g_alloc, json_bytes, .{}) catch |err| {
        std.debug.print("[qjs] parse error: {s}\n", .{@errorName(err)});
        return;
    };
    defer parsed.deinit();
    if (parsed.value != .array) return;
    const t1 = std.time.microTimestamp();
    const cmd_count = parsed.value.array.items.len;
    for (parsed.value.array.items) |cmd| applyCommand(cmd) catch |err| {
        std.debug.print("[qjs] apply error: {s}\n", .{@errorName(err)});
    };
    const t2 = std.time.microTimestamp();
    cleanupDetachedNodes();
    const t3 = std.time.microTimestamp();
    if (json_bytes.len > 10_000) {
        std.debug.print("[batch-timing] bytes={d} cmds={d} parse={d}ms apply={d}ms cleanup={d}ms\n", .{
            json_bytes.len, cmd_count,
            @divTrunc(t1 - t0, 1000), @divTrunc(t2 - t1, 1000), @divTrunc(t3 - t2, 1000),
        });
    }
}

// __hostFlush, __getInputTextForNode, __hostLoadFileToBuffer, __hostReleaseFileBuffer
// are registered by v8_bindings_core.registerCore(). The pending-flush queue and
// content store live there too.

fn contentStoreGet(id: u32) ?[]const u8 {
    return v8_bindings_core.contentStoreGet(id);
}

fn drainPendingFlushes() void {
    v8_bindings_core.drainPendingFlushes(applyCommandBatch);
}

// ── Tree materialization ────────────────────────────────────────

fn materializeChildren(arena: std.mem.Allocator, parent_id: u32) []Node {
    const ids = g_children_ids.get(parent_id) orelse return &.{};
    if (ids.items.len == 0) return &.{};
    const out = arena.alloc(Node, ids.items.len) catch return &.{};
    for (ids.items, 0..) |cid, i| {
        const src = g_node_by_id.get(cid) orelse { out[i] = .{}; continue; };
        out[i] = src.*;
        out[i].children = materializeChildren(arena, cid);
    }
    return out;
}

fn syncRenderedNodeState(node: *const Node) void {
    if (node.scroll_persist_slot != 0) {
        if (g_node_by_id.get(node.scroll_persist_slot)) |stable| {
            stable.scroll_x = node.scroll_x;
            stable.scroll_y = node.scroll_y;
        }
    }
    for (node.children) |*child| syncRenderedNodeState(child);
}

fn markReachable(reachable: *std.AutoHashMap(u32, void), id: u32) void {
    if (reachable.contains(id)) return;
    reachable.put(id, {}) catch return;
    if (g_children_ids.get(id)) |children| {
        for (children.items) |child_id| {
            markReachable(reachable, child_id);
        }
    }
}

fn destroyDetachedNode(id: u32) void {
    releaseInputSlot(id);
    if (g_children_ids.getPtr(id)) |children| {
        children.deinit(g_alloc);
    }
    _ = g_children_ids.remove(id);
    if (g_node_by_id.get(id)) |node| {
        g_alloc.destroy(node);
    }
    _ = g_node_by_id.remove(id);
}

fn cleanupDetachedNodes() void {
    var reachable = std.AutoHashMap(u32, void).init(g_alloc);
    defer reachable.deinit();
    for (g_root_child_ids.items) |child_id| {
        markReachable(&reachable, child_id);
    }

    var stale: std.ArrayList(u32) = .{};
    defer stale.deinit(g_alloc);

    var it = g_node_by_id.iterator();
    while (it.next()) |entry| {
        const id = entry.key_ptr.*;
        if (!reachable.contains(id)) {
            stale.append(g_alloc, id) catch return;
        }
    }

    for (stale.items) |id| {
        destroyDetachedNode(id);
    }
}

fn snapshotRuntimeState() void {
    for (g_root.children) |*child| syncRenderedNodeState(child);
}

/// Build the dev-mode tab strip as a row of arena-allocated Nodes. Returns
/// a single Node (the row container) whose children are the individual tab
/// buttons. Callers prepend this to g_root.children in rebuildTree.
fn onWinMinimize() void { engine.windowMinimize(); }
fn onWinMaximize() void { engine.windowMaximize(); }
fn onWinClose() void { engine.windowClose(); }

fn buildChromeNode(arena: std.mem.Allocator) ?Node {
    // Filter out the "main" bootstrap tab (a duplicate of whatever was first pushed)
    var visible: std.ArrayList(usize) = .{};
    defer visible.deinit(arena);
    for (g_tabs.items, 0..) |t, i| {
        if (std.mem.eql(u8, t.name, "main")) continue;
        visible.append(arena, i) catch return null;
    }

    // Chrome layout: [tab1, tab2, ..., spacer(flex), min, max, close]
    // Even with zero visible tabs we still show the window controls so the
    // borderless window is always closable.
    const tab_count = visible.items.len;
    const control_count: usize = 3;
    const child_count = tab_count + 1 + control_count; // +1 = spacer
    const children = arena.alloc(Node, child_count) catch return null;

    for (visible.items, 0..) |tab_idx, i| {
        children[i] = .{};
        const name = arena.dupe(u8, g_tabs.items[tab_idx].name) catch g_tabs.items[tab_idx].name;
        children[i].text = name;
        children[i].font_size = 13;
        children[i].text_color = layout.Color.rgb(230, 232, 237);
        children[i].style.padding_left = TAB_PAD_H;
        children[i].style.padding_right = TAB_PAD_H;
        children[i].style.padding_top = TAB_PAD_V;
        children[i].style.padding_bottom = TAB_PAD_V;
        children[i].style.border_top_left_radius = 6;
        children[i].style.border_top_right_radius = 6;
        children[i].style.background_color = if (tab_idx == g_active_tab)
            layout.Color.rgb(30, 40, 56)
        else
            layout.Color.rgb(17, 22, 30);
        children[i].hoverable = true;
        if (tab_idx < MAX_TABS) {
            children[i].handlers.on_press = g_tab_click_callbacks[tab_idx];
        }
    }

    // Spacer — flex-grows to push window controls to the right edge.
    children[tab_count] = .{};
    children[tab_count].style.flex_grow = 1;

    // Window controls. Using unicode dashes/squares/X so we don't need icons.
    const ctrl_labels = [_][]const u8{ "\u{2013}", "\u{25A1}", "\u{00D7}" };
    const ctrl_handlers = [_]*const fn () void{ onWinMinimize, onWinMaximize, onWinClose };
    const ctrl_hover_bg = [_]layout.Color{
        layout.Color.rgb(40, 46, 56),
        layout.Color.rgb(40, 46, 56),
        layout.Color.rgb(200, 40, 40),
    };
    _ = ctrl_hover_bg; // future use — framework doesn't expose hover background yet
    for (0..control_count) |k| {
        const idx = tab_count + 1 + k;
        children[idx] = .{};
        children[idx].text = ctrl_labels[k];
        children[idx].font_size = 16;
        children[idx].text_color = layout.Color.rgb(200, 204, 212);
        children[idx].style.width = 36;
        children[idx].style.height = 26;
        children[idx].style.padding_top = 2;
        children[idx].style.align_items = .center;
        children[idx].style.justify_content = .center;
        children[idx].style.text_align = .center;
        children[idx].style.border_top_left_radius = 4;
        children[idx].style.border_top_right_radius = 4;
        children[idx].hoverable = true;
        children[idx].handlers.on_press = ctrl_handlers[k];
    }

    var chrome: Node = .{};
    chrome.style.position = .absolute;
    chrome.style.top = 0;
    chrome.style.left = 0;
    chrome.style.right = 0;
    chrome.style.height = CHROME_HEIGHT;
    chrome.style.flex_direction = .row;
    chrome.style.align_items = .end;
    chrome.style.gap = 3;
    chrome.style.padding_left = CHROME_PAD;
    chrome.style.padding_right = CHROME_PAD;
    chrome.style.background_color = layout.Color.rgb(8, 11, 15);
    // Empty chrome space in this top strip drags the (borderless) window.
    // Tab + control buttons have on_press which overrides drag in
    // framework/engine.zig's hitTestChrome.
    chrome.window_drag = true;
    chrome.children = children;
    return chrome;
}

/// Build four invisible absolute-positioned edge nodes with window_resize=true
/// so the (borderless) window can still be resized by dragging its edges.
/// Corners are auto-detected in chromeResizeEdge (framework/engine.zig) from
/// cursor position within a 20px threshold of the window corners.
fn buildResizeEdges(arena: std.mem.Allocator) ?[]Node {
    const edges = arena.alloc(Node, 4) catch return null;

    // Top — thin (3px) so it barely overlaps the chrome's click area.
    edges[0] = .{};
    edges[0].style.position = .absolute;
    edges[0].style.top = 0;
    edges[0].style.left = 0;
    edges[0].style.right = 0;
    edges[0].style.height = 3;
    edges[0].window_resize = true;

    // Bottom
    edges[1] = .{};
    edges[1].style.position = .absolute;
    edges[1].style.bottom = 0;
    edges[1].style.left = 0;
    edges[1].style.right = 0;
    edges[1].style.height = 6;
    edges[1].window_resize = true;

    // Left
    edges[2] = .{};
    edges[2].style.position = .absolute;
    edges[2].style.top = 0;
    edges[2].style.bottom = 0;
    edges[2].style.left = 0;
    edges[2].style.width = 6;
    edges[2].window_resize = true;

    // Right
    edges[3] = .{};
    edges[3].style.position = .absolute;
    edges[3].style.top = 0;
    edges[3].style.bottom = 0;
    edges[3].style.right = 0;
    edges[3].style.width = 6;
    edges[3].window_resize = true;

    return edges;
}

fn rebuildTree() void {
    _ = g_arena.reset(.retain_capacity);
    const arena = g_arena.allocator();

    const chrome_opt = if (DEV_MODE) buildChromeNode(arena) else null;
    const resize_edges = if (BORDERLESS_MODE) buildResizeEdges(arena) else null;
    const cart_child_count = g_root_child_ids.items.len;
    const chrome_count: usize = if (chrome_opt != null) 1 else 0;
    const edge_count: usize = if (resize_edges) |e| e.len else 0;

    if (cart_child_count == 0 and chrome_count == 0 and edge_count == 0) {
        g_root.children = &.{};
        return;
    }

    g_root.style.flex_direction = .column;

    // When the chrome exists, wrap the cart's top-level children in a
    // flex-grow container so the cart's `height: '100%'` is relative to the
    // remaining space (window - chrome), not the full window. Without this
    // wrapper, chrome (32px) + cart (100% of full window) overflows and the
    // cart's bottom toolbar disappears below the visible area.
    const use_wrapper = chrome_count > 0 and cart_child_count > 0;
    const wrapper_count: usize = if (use_wrapper) 1 else 0;
    const flat_cart_count: usize = if (use_wrapper) 0 else cart_child_count;

    const total = chrome_count + wrapper_count + flat_cart_count + edge_count;
    const out = arena.alloc(Node, total) catch return;

    if (chrome_opt) |c| out[0] = c;

    if (use_wrapper) {
        // Materialize the cart's children into the wrapper's children array.
        const cart_nodes = arena.alloc(Node, cart_child_count) catch return;
        for (g_root_child_ids.items, 0..) |cid, i| {
            const src = g_node_by_id.get(cid) orelse { cart_nodes[i] = .{}; continue; };
            cart_nodes[i] = src.*;
            cart_nodes[i].children = materializeChildren(arena, cid);
        }
        var wrapper: Node = .{};
        wrapper.style.flex_grow = 1;
        wrapper.style.flex_direction = .column;
        wrapper.style.overflow = .hidden;
        wrapper.style.width = null;
        wrapper.children = cart_nodes;
        out[chrome_count] = wrapper;
    } else {
        // No chrome — keep the original flat layout used by non-dev builds.
        for (g_root_child_ids.items, 0..) |cid, i| {
            const dst_idx = chrome_count + i;
            const src = g_node_by_id.get(cid) orelse { out[dst_idx] = .{}; continue; };
            out[dst_idx] = src.*;
            out[dst_idx].children = materializeChildren(arena, cid);
        }
    }

    // Resize edges go LAST so hitTestChrome (which walks children in reverse)
    // checks them first. A cursor near a window edge gets a resize cursor
    // before the chrome's drag region takes over.
    if (resize_edges) |edges| {
        const base = chrome_count + wrapper_count + flat_cart_count;
        for (edges, 0..) |edge, i| out[base + i] = edge;
    }
    g_root.children = out;
    g_root.style.width = null;
    g_root.style.height = null;
}

// ── Dev reload helpers ──────────────────────────────────────────

fn readBundleFromDisk() ![]u8 {
    const file = try std.fs.cwd().openFile(DEV_BUNDLE_PATH, .{});
    defer file.close();
    const stat = try file.stat();
    const buf = try g_alloc.alloc(u8, stat.size);
    errdefer g_alloc.free(buf);
    const n = try file.readAll(buf);
    return buf[0..n];
}

fn bundleMtimeOrZero() i128 {
    const s = std.fs.cwd().statFile(DEV_BUNDLE_PATH) catch return 0;
    return s.mtime;
}

fn maybeScheduleReload() void {
    if (!DEV_MODE) return;
    g_mtime_poll_counter +%= 1;
    // Poll every 16 ticks (~250ms at 60fps) — cheap, responsive enough.
    if (g_mtime_poll_counter & 0xF != 0) return;
    const mt = bundleMtimeOrZero();
    if (mt != 0 and mt != g_last_bundle_mtime) {
        g_last_bundle_mtime = mt;
        g_reload_pending = true;
    }
}

fn clearTreeStateForReload() void {
    // Drop the engine's reference to the current node tree BEFORE freeing any
    // memory it points into. The engine paints from g_root.children each
    // frame — leave it pointing at stale memory and we SIGSEGV on paint.
    g_root.children = &.{};

    for (g_press_expr_pool.items) |s| g_alloc.free(s);
    g_press_expr_pool.clearRetainingCapacity();

    // pending_flush queue is owned by v8_bindings_core; draining here isn't
    // needed for reload since bindings will also lose their queue on VM tear-down.

    // Unregister every live input slot so framework/input.zig doesn't keep
    // dispatching callbacks that read into the freed Node pool.
    var slot_it = g_input_slot_by_node_id.valueIterator();
    while (slot_it.next()) |slot| input.unregister(slot.*);
    g_input_slot_by_node_id.clearRetainingCapacity();
    for (&g_node_id_by_input_slot) |*v| v.* = 0;

    // Destroy every Node struct. node.text ownership is mixed (some g_alloc
    // dupes, some slices into framework/input.zig's buffers) so we leak the
    // text for dev-mode safety — kilobytes per reload, acceptable.
    var node_it = g_node_by_id.valueIterator();
    while (node_it.next()) |n_ptr| g_alloc.destroy(n_ptr.*);
    g_node_by_id.clearRetainingCapacity();

    var cid_it = g_children_ids.valueIterator();
    while (cid_it.next()) |list| list.deinit(g_alloc);
    g_children_ids.clearRetainingCapacity();

    // The root-child list is populated by APPEND_ROOT; clear so new React
    // mounts don't see stale IDs mixed with fresh ones.
    g_root_child_ids.clearRetainingCapacity();

    // Arena holds only materializeChildren output (rebuilt every frame from
    // g_children_ids + g_node_by_id). Safe to reset now that g_root.children
    // no longer references it.
    _ = g_arena.reset(.retain_capacity);

    g_dirty = true;
}

fn performReload() void {
    // Re-read the active tab's source file. Only the first tab ("main") has a
    // disk-backed source; others come from IPC pushes and have no disk file.
    if (g_active_tab != 0) return;
    const new_bundle = readBundleFromDisk() catch |e| {
        std.log.warn("[dev] bundle read failed: {}, skipping reload", .{e});
        return;
    };
    replaceActiveTabBundle(new_bundle);
    evalActiveTab();
    std.log.info("[dev] reloaded '{s}' ({d} bytes)", .{ tabName(g_active_tab), new_bundle.len });
}

/// Swap the active tab's stored bundle bytes for `new_bundle`. Frees the old
/// storage. Takes ownership of `new_bundle`.
fn replaceActiveTabBundle(new_bundle: []u8) void {
    g_alloc.free(g_tabs.items[g_active_tab].bundle);
    g_tabs.items[g_active_tab].bundle = new_bundle;
    if (g_active_tab == 0) {
        // Keep the legacy fields in sync for the disk-backed "main" tab.
        g_dev_bundle_buf = new_bundle;
    }
}

/// Tear down the JS world and re-eval the currently-active tab's bundle.
/// V8's platform is single-shot (InitializePlatform cannot run twice in a
/// process), so we keep the Isolate and Platform alive and only rebuild the
/// Context + top-level HandleScope. appInit() re-registers host funcs onto
/// the fresh context.
fn evalActiveTab() void {
    std.log.info("[dev] evalActiveTab: clearing tree", .{});
    clearTreeStateForReload();
    std.log.info("[dev] evalActiveTab: resetting context", .{});
    v8_runtime.resetContextForReload();
    std.log.info("[dev] evalActiveTab: appInit", .{});
    appInit();
    const tab = &g_tabs.items[g_active_tab];
    std.log.info("[dev] evalActiveTab: evalScript ({d} bytes)", .{tab.bundle.len});
    const ok = v8_runtime.evalScriptChecked(tab.bundle);
    if (ok) {
        // Snapshot this bundle as the rollback target for the next reload.
        if (tab.last_good) |lg| g_alloc.free(lg);
        tab.last_good = g_alloc.dupe(u8, tab.bundle) catch null;
        std.log.info("[dev] evalActiveTab: done", .{});
        return;
    }
    // New bundle threw. Tree was already cleared, so the UI is currently
    // blank. Restore the last good bundle if we have one so the user keeps
    // working instead of staring at an empty window until their next clean
    // save. If we have nothing to restore (first-ever eval failed), leave
    // the window blank and log — there's nothing better to do.
    if (tab.last_good) |lg| {
        std.log.warn("[dev] bundle failed — restoring last good ({d} bytes)", .{lg.len});
        clearTreeStateForReload();
        v8_runtime.resetContextForReload();
        appInit();
        _ = v8_runtime.evalScriptChecked(lg);
    } else {
        std.log.warn("[dev] bundle failed — no last good to restore", .{});
    }
}

fn tabName(idx: usize) []const u8 {
    return g_tabs.items[idx].name;
}

/// Find a tab by name. Returns its index or null.
fn findTab(name: []const u8) ?usize {
    for (g_tabs.items, 0..) |t, i| {
        if (std.mem.eql(u8, t.name, name)) return i;
    }
    return null;
}

/// Install a tab. If one with `name` already exists, replaces its bundle.
/// Otherwise appends a new tab. Takes ownership of both slices.
fn upsertTab(name: []u8, bundle: []u8) !usize {
    if (findTab(name)) |idx| {
        g_alloc.free(name); // duplicate — free the new name
        g_alloc.free(g_tabs.items[idx].bundle);
        g_tabs.items[idx].bundle = bundle;
        return idx;
    }
    try g_tabs.append(g_alloc, .{ .name = name, .bundle = bundle });
    return g_tabs.items.len - 1;
}

fn switchToTab(idx: usize) void {
    if (idx >= g_tabs.items.len) return;
    g_active_tab = idx;
    evalActiveTab();
    std.log.info("[dev] active tab: '{s}'", .{tabName(idx)});
}

/// Pull any pending IPC push messages and act on them. Called each tick.
fn processIncomingPushes() void {
    while (dev_ipc.takeNext()) |msg| {
        const idx = upsertTab(msg.name, msg.bundle) catch |e| {
            std.log.warn("[dev] upsertTab failed: {}", .{e});
            continue;
        };
        switchToTab(idx);
    }
}

// ── init / tick ─────────────────────────────────────────────────

fn appInit() void {
    // QJS VM is already initialized by engine before this is called (engine calls
    // v8_runtime.initVM() then evalScript(js_logic)). But we need __hostFlush
    // registered BEFORE evalScript runs. Engine order matters — see below.
    //
    // We piggyback on engine's eval: we pass the bundle via AppConfig.js_logic,
    // engine evals it, hostConfig's transportFlush tries to call globalThis.__hostFlush.
    // We must register __hostFlush BEFORE the bundle evals. Since appInit runs BEFORE
    // evalScript in engine.run order (tsz convention: init → evalScript), register here.
    v8_bindings_core.registerCore({});
    v8_bindings_fs.registerFs({});
    v8_bindings_websocket.registerWebSocket({});
    v8_bindings_telemetry.registerTelemetry({});
    v8_bindings_zigcall.registerZigCall({});
    v8_bindings_zigcall.registerZigCallList({});
    // SDK bindings are still deferred; they have latent type errors from the
    // initial port that we'll revisit after the V8 baseline settles.
    // v8_bindings_sdk.registerSdk({});

    // Polyfills — V8 has no setTimeout/setInterval/console.log. QJS path
    // installs an equivalent block from qjs_runtime.initVM; mirror the minimal
    // subset here so the bundle boot (React + runtime/index.tsx) succeeds.
    v8_runtime.evalScript(
        \\globalThis.console = {
        \\  log: function(){ var s=''; for (var i=0;i<arguments.length;i++){ if(i)s+=' '; s+=String(arguments[i]); } __hostLog(0, s); },
        \\  warn: function(){ var s=''; for (var i=0;i<arguments.length;i++){ if(i)s+=' '; s+=String(arguments[i]); } __hostLog(1, s); },
        \\  error: function(){ var s=''; for (var i=0;i<arguments.length;i++){ if(i)s+=' '; s+=String(arguments[i]); } __hostLog(2, s); },
        \\  info: function(){ var s=''; for (var i=0;i<arguments.length;i++){ if(i)s+=' '; s+=String(arguments[i]); } __hostLog(0, s); },
        \\  debug: function(){ var s=''; for (var i=0;i<arguments.length;i++){ if(i)s+=' '; s+=String(arguments[i]); } __hostLog(0, s); },
        \\};
        \\globalThis._timers = [];
        \\globalThis._timerIdNext = 1;
        \\globalThis.setTimeout = function(fn, ms) {
        \\  var id = globalThis._timerIdNext++;
        \\  globalThis._timers.push({ id: id, fn: fn, ms: ms || 0, at: Date.now() + (ms || 0), interval: false });
        \\  return id;
        \\};
        \\globalThis.setInterval = function(fn, ms) {
        \\  var id = globalThis._timerIdNext++;
        \\  globalThis._timers.push({ id: id, fn: fn, ms: ms || 16, at: Date.now() + (ms || 16), interval: true });
        \\  return id;
        \\};
        \\globalThis.clearTimeout = function(id) {
        \\  globalThis._timers = globalThis._timers.filter(function(t){ return t.id !== id; });
        \\};
        \\globalThis.clearInterval = globalThis.clearTimeout;
        \\globalThis.__jsTick = function(now) {
        \\  var ready = [];
        \\  for (var i=0; i<globalThis._timers.length; i++) {
        \\    var t = globalThis._timers[i];
        \\    if (now >= t.at) ready.push(t);
        \\  }
        \\  for (var j=0; j<ready.length; j++) {
        \\    var t = ready[j];
        \\    try { t.fn(); } catch(e) { __hostLog(2, 'timer error: ' + e); }
        \\    if (t.interval) t.at = now + t.ms;
        \\  }
        \\  var keep = [];
        \\  for (var k=0; k<globalThis._timers.length; k++) {
        \\    var t = globalThis._timers[k];
        \\    if (t.interval || now < t.at) keep.push(t);
        \\  }
        \\  globalThis._timers = keep;
        \\};
        \\globalThis.__beginJsEvent = function(){};
        \\globalThis.__endJsEvent = function(){};
    );

    // Persistent-store substrate for runtime/hooks/localstore. Best-effort —
    // if init fails the hooks gracefully no-op (see qjs_bindings.storeGet etc.).
    fs_mod.init("reactjit") catch |e| std.log.warn("fs init failed: {}", .{e});
    localstore.init() catch |e| std.log.warn("localstore init failed: {}", .{e});
}

fn appTick(now: u32) void {
    // Dev-mode: accept incoming IPC pushes (may switch the active tab) and
    // check the active tab's disk source for mtime-triggered reloads. Either
    // path tears down the JS world and re-evals before the rest of the frame.
    if (DEV_MODE) {
        dev_ipc.pollOnce();
        processIncomingPushes();
    }
    maybeScheduleReload();
    if (g_reload_pending) {
        g_reload_pending = false;
        performReload();
        return;
    }

    // Async exec drain — emits __ffiEmit('exec:<rid>', payload) for every
    // completed subprocess. The rest of the SDK tickDrain (http/claude/etc.)
    // stays deferred.
    v8_bindings_core.execTickDrain();

    // Fire any JS timers whose due-time has arrived. setTimeout/setInterval
    // in the bundle are implemented against this — see runtime/index.tsx.
    // This may append new batches to g_pending_flush via React commits triggered
    // from handlers that ran inside timers. Drain after.
    v8_runtime.callGlobalInt("__jsTick", @intCast(now));

    // Poll active WebSocket connections and emit open/message/close/error events.
    v8_bindings_websocket.tickDrain();

    // Apply any CMD batches that accumulated during press events since last tick.
    // Must happen BEFORE rebuildTree so the tree reflects the new g_node_by_id.
    drainPendingFlushes();

    if (g_dirty) {
        const t0 = std.time.microTimestamp();
        snapshotRuntimeState();
        const t1 = std.time.microTimestamp();
        rebuildTree();
        const t2 = std.time.microTimestamp();
        layout.markLayoutDirty();
        g_dirty = false;
        const snap_us = t1 - t0;
        const rebuild_us = t2 - t1;
        if (snap_us > 1000 or rebuild_us > 1000) {
            // Count the tree size for context.
            var node_count: usize = 0;
            var kid_it = g_children_ids.valueIterator();
            while (kid_it.next()) |list| node_count += list.items.len;
            std.debug.print("[rebuild-timing] snapshot={d}us rebuildTree={d}us nodes={d} (g_node_by_id={d})\n", .{ snap_us, rebuild_us, node_count, g_node_by_id.count() });
        }
    }
}

fn appShutdown() void {
    localstore.deinit();
    fs_mod.deinit();
}

// ── main ────────────────────────────────────────────────────────

pub fn main() !void {
    if (IS_LIB) return;

    var gpa = std.heap.GeneralPurposeAllocator(.{}){};
    g_alloc = gpa.allocator();
    g_arena = std.heap.ArenaAllocator.init(g_alloc);
    g_node_by_id = std.AutoHashMap(u32, *Node).init(g_alloc);
    g_children_ids = std.AutoHashMap(u32, std.ArrayList(u32)).init(g_alloc);
    g_input_slot_by_node_id = std.AutoHashMap(u32, u8).init(g_alloc);

    g_root = .{};

    const initial_bundle: []const u8 = if (DEV_MODE) blk: {
        g_dev_bundle_buf = readBundleFromDisk() catch |e| {
            std.log.err("[dev] initial bundle.js read failed: {}", .{e});
            return e;
        };
        g_last_bundle_mtime = bundleMtimeOrZero();

        // Seed the tab registry with the disk-backed "main" tab. Pre-seed
        // last_good with a dupe of the boot bundle so the first post-boot
        // reload can roll back if it throws (the boot bundle is the baseline
        // known-working state — engine.run will eval it immediately after we
        // return from main()'s setup).
        const name_copy = try g_alloc.dupe(u8, "main");
        const last_good_seed = try g_alloc.dupe(u8, g_dev_bundle_buf);
        try g_tabs.append(g_alloc, .{
            .name = name_copy,
            .bundle = g_dev_bundle_buf,
            .last_good = last_good_seed,
        });
        g_active_tab = 0;

        // dev_ipc must allocate push buffers with the SAME allocator qjs_app
        // uses when it later frees them via upsertTab. Cross-allocator free is
        // UB — this caller caused the SIGSEGV on re-push (2026-04-19 fix).
        dev_ipc.setAllocator(g_alloc);
        dev_ipc.start();

        std.log.info("[dev] dev mode — watching bundle.js ({d} bytes), IPC @ {s}", .{ g_dev_bundle_buf.len, dev_ipc.SOCKET_PATH });
        break :blk g_dev_bundle_buf;
    } else BUNDLE_BYTES;

    try engine.run(.{
        .title = WINDOW_TITLE,
        .root = &g_root,
        .js_logic = initial_bundle,
        .lua_logic = "",
        .init = appInit,
        .tick = appTick,
        .shutdown = appShutdown,
        // In dev mode, strip the OS titlebar so our tab chrome sits in the
        // titlebar position. Empty chrome area gets window_drag; tab buttons
        // with on_press override drag so clicks still switch tabs.
        .borderless = BORDERLESS_MODE,
        .set_canvas_node_position = setCanvasNodePosition,
    });
}
