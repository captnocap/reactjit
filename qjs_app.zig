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
const input = @import("framework/input.zig");
const state = @import("framework/state.zig");
const events = @import("framework/events.zig");
const engine = if (IS_LIB) struct {} else @import("framework/engine.zig");
const qjs_runtime = @import("framework/qjs_runtime.zig");
comptime { if (!IS_LIB) _ = @import("framework/core.zig"); }

const qjs = @cImport({
    @cInclude("quickjs.h");
});

// bundle.js is embedded at compile time — binary is self-contained, no CWD lookup.
const BUNDLE_BYTES = @embedFile("bundle.js");
const QJS_UNDEFINED: qjs.JSValue = .{ .u = .{ .int32 = 0 }, .tag = 3 };

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

fn isInputType(type_name: []const u8) bool {
    return std.mem.eql(u8, type_name, "TextInput") or
        std.mem.eql(u8, type_name, "TextArea") or
        std.mem.eql(u8, type_name, "TextEditor");
}

fn isMultilineInputType(type_name: []const u8) bool {
    return std.mem.eql(u8, type_name, "TextArea") or
        std.mem.eql(u8, type_name, "TextEditor");
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
    qjs_runtime.callGlobal("__beginJsEvent");
    qjs_runtime.callGlobalInt(global_name, @intCast(node_id));
    qjs_runtime.callGlobal("__endJsEvent");
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
    qjs_runtime.callGlobal("__beginJsEvent");
    qjs_runtime.callGlobal3Int("__dispatchInputKey", @intCast(node_id), key, mods);
    qjs_runtime.callGlobal("__endJsEvent");
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
        const current = input.getText(slot);
        if (!std.mem.eql(u8, current, text)) {
            input.setText(slot, text);
        }
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
        if (std.mem.eql(u8, k, "fontSize")) node.font_size = 16
        else if (std.mem.eql(u8, k, "color")) node.text_color = null
        else if (std.mem.eql(u8, k, "letterSpacing")) node.letter_spacing = 0
        else if (std.mem.eql(u8, k, "lineHeight")) node.line_height = 0
        else if (std.mem.eql(u8, k, "numberOfLines")) node.number_of_lines = 0
        else if (std.mem.eql(u8, k, "noWrap")) node.no_wrap = false
        else if (std.mem.eql(u8, k, "placeholder")) node.placeholder = null
        else if (std.mem.eql(u8, k, "value")) node.text = null
        else if (std.mem.eql(u8, k, "source")) node.image_src = null
        else if (std.mem.eql(u8, k, "href")) node.href = null
        else if (std.mem.eql(u8, k, "tooltip")) node.tooltip = null
        else if (std.mem.eql(u8, k, "hoverable")) node.hoverable = false
        else if (std.mem.eql(u8, k, "debugName")) node.debug_name = null
        else if (std.mem.eql(u8, k, "testID")) node.test_id = null;
    }
}

fn applyTypeDefaults(node: *Node, id: u32, type_name: []const u8) void {
    const eq = std.mem.eql;
    if (eq(u8, type_name, "ScrollView")) {
        node.style.overflow = .scroll;
    } else if (eq(u8, type_name, "Canvas.Node") or eq(u8, type_name, "Graph.Node")) {
        node.canvas_node = true;
    } else if (eq(u8, type_name, "Canvas.Path") or eq(u8, type_name, "Graph.Path")) {
        node.canvas_path = true;
    } else if (eq(u8, type_name, "Canvas.Clamp")) {
        node.canvas_clamp = true;
    }
    ensureInputSlot(node, id, type_name);
}

fn applyProps(node: *Node, props: std.json.Value, type_name: ?[]const u8) void {
    if (props != .object) return;
    const is_input = node.input_id != null or (type_name != null and isInputType(type_name.?));
    var it = props.object.iterator();
    while (it.next()) |e| {
        const k = e.key_ptr.*;
        const v = e.value_ptr.*;
        if (std.mem.eql(u8, k, "style")) applyStyle(node, v)
        else if (std.mem.eql(u8, k, "fontSize")) {
            if (jsonInt(v)) |i| node.font_size = @intCast(@max(i, 1));
        } else if (std.mem.eql(u8, k, "color")) {
            if (v == .string) node.text_color = parseColor(v.string);
        } else if (std.mem.eql(u8, k, "letterSpacing")) {
            if (jsonFloat(v)) |f| node.letter_spacing = f;
        } else if (std.mem.eql(u8, k, "lineHeight")) {
            if (jsonFloat(v)) |f| node.line_height = f;
        } else if (std.mem.eql(u8, k, "numberOfLines")) {
            if (jsonInt(v)) |i| node.number_of_lines = @intCast(@max(i, 0));
        } else if (std.mem.eql(u8, k, "noWrap")) {
            if (v == .bool) node.no_wrap = v.bool;
        } else if (is_input and std.mem.eql(u8, k, "placeholder")) {
            if (dupJsonText(v)) |s| node.placeholder = s;
        } else if (is_input and std.mem.eql(u8, k, "value")) {
            if (dupJsonText(v)) |s| syncInputValue(node, s);
        } else if (std.mem.eql(u8, k, "source")) {
            if (dupJsonText(v)) |s| node.image_src = s;
        } else if (std.mem.eql(u8, k, "href")) {
            if (dupJsonText(v)) |s| node.href = s;
        } else if (std.mem.eql(u8, k, "tooltip")) {
            if (dupJsonText(v)) |s| node.tooltip = s;
        } else if (std.mem.eql(u8, k, "hoverable")) {
            if (v == .bool) node.hoverable = v.bool;
        } else if (std.mem.eql(u8, k, "debugName")) {
            if (dupJsonText(v)) |s| node.debug_name = s;
        } else if (std.mem.eql(u8, k, "testID")) {
            if (dupJsonText(v)) |s| node.test_id = s;
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
        } else if (std.mem.eql(u8, k, "fillEffect")) {
            if (dupJsonText(v)) |s| node.canvas_fill_effect = s;
        } else if (std.mem.eql(u8, k, "textEffect")) {
            if (dupJsonText(v)) |s| node.text_effect = s;
        }
    }
}

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
    node.handlers.js_on_hover_enter = null;
    node.handlers.js_on_hover_exit = null;
    node.handlers.on_scroll = null;
    node.handlers.on_right_click = null;

    if (cmdHasAnyHandlerName(cmd, &.{ "onClick", "onPress" })) {
        node.handlers.js_on_press = installJsExpr("__dispatchEvent({d},'onClick')\x00", id);
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
    const parsed = std.json.parseFromSlice(std.json.Value, g_alloc, json_bytes, .{}) catch |err| {
        std.debug.print("[qjs] parse error: {s}\n", .{@errorName(err)});
        return;
    };
    defer parsed.deinit();
    if (parsed.value != .array) return;
    for (parsed.value.array.items) |cmd| applyCommand(cmd) catch |err| {
        std.debug.print("[qjs] apply error: {s}\n", .{@errorName(err)});
    };
    cleanupDetachedNodes();
}

// ── QJS host function: __hostFlush(json) ────────────────────────
// JSCFunction signature: fn(ctx, this, argc, argv) -> JSValue

export fn host_flush(ctx: ?*qjs.JSContext, _: qjs.JSValue, argc: c_int, argv: [*c]qjs.JSValue) qjs.JSValue {
    _ = argc;
    if (ctx == null) return QJS_UNDEFINED;
    const c_str = qjs.JS_ToCString(ctx, argv[0]);
    if (c_str == null) return QJS_UNDEFINED;
    defer qjs.JS_FreeCString(ctx, c_str);
    const slice = std.mem.span(c_str);
    applyCommandBatch(slice);
    return QJS_UNDEFINED;
}

export fn host_get_input_text_for_node(ctx: ?*qjs.JSContext, _: qjs.JSValue, argc: c_int, argv: [*c]qjs.JSValue) qjs.JSValue {
    if (ctx == null or argc < 1) return qjs.JS_NewString(ctx, "");
    var node_id: i32 = 0;
    _ = qjs.JS_ToInt32(ctx, &node_id, argv[0]);
    if (node_id <= 0) return qjs.JS_NewString(ctx, "");
    const slot = g_input_slot_by_node_id.get(@intCast(node_id)) orelse return qjs.JS_NewString(ctx, "");
    const text = input.getText(slot);
    if (text.len == 0) return qjs.JS_NewString(ctx, "");
    return qjs.JS_NewStringLen(ctx, text.ptr, @intCast(text.len));
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

fn rebuildTree() void {
    _ = g_arena.reset(.retain_capacity);
    const arena = g_arena.allocator();
    if (g_root_child_ids.items.len == 0) {
        g_root.children = &.{};
        return;
    }
    const out = arena.alloc(Node, g_root_child_ids.items.len) catch return;
    for (g_root_child_ids.items, 0..) |cid, i| {
        const src = g_node_by_id.get(cid) orelse { out[i] = .{}; continue; };
        out[i] = src.*;
        out[i].children = materializeChildren(arena, cid);
    }
    g_root.children = out;
    g_root.style.width = null;
    g_root.style.height = null;
}

// ── init / tick ─────────────────────────────────────────────────

fn appInit() void {
    // QJS VM is already initialized by engine before this is called (engine calls
    // qjs_runtime.initVM() then evalScript(js_logic)). But we need __hostFlush
    // registered BEFORE evalScript runs. Engine order matters — see below.
    //
    // We piggyback on engine's eval: we pass the bundle via AppConfig.js_logic,
    // engine evals it, hostConfig's transportFlush tries to call globalThis.__hostFlush.
    // We must register __hostFlush BEFORE the bundle evals. Since appInit runs BEFORE
    // evalScript in engine.run order (tsz convention: init → evalScript), register here.
    qjs_runtime.registerHostFn("__hostFlush", @ptrCast(&host_flush), 1);
    qjs_runtime.registerHostFn("__getInputTextForNode", @ptrCast(&host_get_input_text_for_node), 1);
}

fn appTick(now: u32) void {
    // Fire any JS timers whose due-time has arrived. setTimeout/setInterval
    // in the bundle are implemented against this — see runtime/index.tsx.
    qjs_runtime.callGlobalInt("__jsTick", @intCast(now));

    if (g_dirty) {
        snapshotRuntimeState();
        rebuildTree();
        layout.markLayoutDirty();
        g_dirty = false;
    }
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

    try engine.run(.{
        .title = "qjs-d152",
        .root = &g_root,
        .js_logic = BUNDLE_BYTES,
        .lua_logic = "",
        .init = appInit,
        .tick = appTick,
    });
}
