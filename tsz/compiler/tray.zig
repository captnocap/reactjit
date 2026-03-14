//! tsz system tray — libayatana-appindicator3 + GTK3
//!
//! Ported from lua/tray.lua (Lua FFI → Zig extern).
//! Sits in the taskbar notification area with a right-click context menu.
//! Menu is auto-generated from the project registry + actions table.
//!
//! Linux only. On other platforms, all public functions are no-ops that
//! return safe defaults (init() → false, etc.).

const std = @import("std");
const builtin = @import("builtin");
const registry = @import("registry.zig");
const process = @import("process.zig");
const actions_mod = @import("actions.zig");

// Global flags set by GTK callbacks, read by the SDL event loop
pub var should_show_gui: bool = false;
pub var should_quit: bool = false;

// Action dispatch from tray menu
pub var pending_action: ?struct {
    name: [16]u8,
    name_len: u8,
    path: [512]u8,
    path_len: u16,
} = null;

// ── Platform gate: everything below is Linux-only ─────────────────────────
// On non-Linux, the public API compiles to no-ops so callers don't need
// their own #ifdefs.

pub fn init() bool {
    if (comptime builtin.os.tag != .linux) return false;
    return initLinux();
}

pub fn buildMenu(reg: *const registry.Registry) void {
    if (comptime builtin.os.tag != .linux) return;
    buildMenuLinux(reg);
}

pub fn update() void {
    if (comptime builtin.os.tag != .linux) return;
    updateLinux();
}

pub fn resolvePendingAction(reg: *const registry.Registry, alloc: std.mem.Allocator) void {
    if (comptime builtin.os.tag != .linux) return;
    resolvePendingActionLinux(reg, alloc);
}

pub fn deinit() void {
    if (comptime builtin.os.tag != .linux) return;
    deinitLinux();
}

// ── Linux implementation ──────────────────────────────────────────────────

// GTK/GLib/AppIndicator extern declarations — manual to avoid pulling the
// entire GTK header tree (huge, slows compilation dramatically).

const GCallback = *const fn () callconv(.c) void;
const GClosureNotify = ?*const fn (?*anyopaque, ?*anyopaque) callconv(.c) void;

extern fn gtk_init(argc: ?*c_int, argv: ?*?*?[*:0]u8) void;
extern fn gtk_events_pending() c_int;
extern fn gtk_main_iteration_do(blocking: c_int) c_int;
extern fn gtk_menu_new() ?*anyopaque;
extern fn gtk_menu_shell_append(menu_shell: ?*anyopaque, child: ?*anyopaque) void;
extern fn gtk_menu_item_new_with_label(label: [*:0]const u8) ?*anyopaque;
extern fn gtk_separator_menu_item_new() ?*anyopaque;
extern fn gtk_widget_show(widget: ?*anyopaque) void;
extern fn gtk_widget_show_all(widget: ?*anyopaque) void;
extern fn gtk_widget_destroy(widget: ?*anyopaque) void;

extern fn g_object_unref(object: ?*anyopaque) void;
extern fn g_signal_connect_data(
    instance: ?*anyopaque,
    signal: [*:0]const u8,
    handler: GCallback,
    data: ?*anyopaque,
    destroy: GClosureNotify,
    flags: c_int,
) c_ulong;

extern fn app_indicator_new(
    id: [*:0]const u8,
    icon_name: [*:0]const u8,
    category: c_int,
) ?*anyopaque;
extern fn app_indicator_set_status(self: ?*anyopaque, status: c_int) void;
extern fn app_indicator_set_menu(self: ?*anyopaque, menu: ?*anyopaque) void;
extern fn app_indicator_set_title(self: ?*anyopaque, title: [*:0]const u8) void;
extern fn app_indicator_set_label(self: ?*anyopaque, label: [*:0]const u8, guide: [*:0]const u8) void;

// AppIndicator status enum values
const APP_INDICATOR_STATUS_PASSIVE = 0;
const APP_INDICATOR_STATUS_ACTIVE = 1;
const APP_INDICATOR_STATUS_ATTENTION = 2;

// AppIndicator category
const APP_INDICATOR_CATEGORY_APPLICATION_STATUS = 0;

// ── Tray state ──────────────────────────────────────────────────────────

var indicator_ptr: ?*anyopaque = null;
var menu_ptr: ?*anyopaque = null;
var gtk_initialized = false;

// ── Callbacks ───────────────────────────────────────────────────────────

fn onShowDashboard() callconv(.c) void {
    should_show_gui = true;
}

fn onQuit() callconv(.c) void {
    should_quit = true;
}

// Action callback — we encode the project index and action index into a
// static lookup table since GTK callbacks can't carry closure data easily.
const MAX_MENU_ACTIONS = 128;

const MenuAction = struct {
    project_idx: u16,
    action_idx: u8,
    active: bool,
};

var menu_actions: [MAX_MENU_ACTIONS]MenuAction = undefined;
var menu_action_count: usize = 0;

// One callback per slot (GTK needs a function pointer, not a closure)
fn makeCallback(comptime idx: usize) fn () callconv(.c) void {
    return struct {
        fn cb() callconv(.c) void {
            if (idx < menu_action_count and menu_actions[idx].active) {
                // Look up which action this is
                var ai: u8 = 0;
                for (actions_mod.ALL) |a| {
                    if (!a.show_in_gui) continue;
                    if (ai == menu_actions[idx].action_idx) {
                        // We can't call execAction from a GTK callback (wrong thread context).
                        // Set the pending_action flag — the SDL loop will pick it up.
                        var pa: @TypeOf(pending_action.?) = undefined;
                        @memcpy(pa.name[0..a.name.len], a.name);
                        pa.name_len = @intCast(a.name.len);
                        // We need the path — store project_idx and resolve later
                        pa.path_len = 0; // Signal: resolve from project_idx
                        pa.path[0] = @intCast(menu_actions[idx].project_idx);
                        pending_action = pa;
                        break;
                    }
                    ai += 1;
                }
            }
        }
    }.cb;
}

// Generate 32 static callback functions (enough for ~6 projects × 5 actions)
const callbacks = blk: {
    var cbs: [32]*const fn () callconv(.c) void = undefined;
    for (0..32) |i| {
        cbs[i] = &makeCallback(i);
    }
    break :blk cbs;
};

// ── Linux public API ────────────────────────────────────────────────────

fn initLinux() bool {
    if (gtk_initialized) return true;

    gtk_init(null, null);
    gtk_initialized = true;

    indicator_ptr = app_indicator_new(
        "tsz-dashboard",
        "utilities-terminal",
        APP_INDICATOR_CATEGORY_APPLICATION_STATUS,
    );
    if (indicator_ptr == null) return false;

    app_indicator_set_title(indicator_ptr, "tsz");
    app_indicator_set_status(indicator_ptr, APP_INDICATOR_STATUS_ACTIVE);

    return true;
}

/// Rebuild the tray menu from the current registry.
fn buildMenuLinux(reg: *const registry.Registry) void {
    // Destroy old menu
    if (menu_ptr) |m| gtk_widget_destroy(m);

    menu_ptr = gtk_menu_new();
    if (menu_ptr == null) return;

    menu_action_count = 0;

    // "Show Dashboard" item
    const show_item = gtk_menu_item_new_with_label("Show Dashboard");
    if (show_item) |item| {
        _ = g_signal_connect_data(item, "activate", @ptrCast(&onShowDashboard), null, null, 0);
        gtk_menu_shell_append(menu_ptr, item);
        gtk_widget_show(item);
    }

    // Separator
    const sep1 = gtk_separator_menu_item_new();
    if (sep1) |s| {
        gtk_menu_shell_append(menu_ptr, s);
        gtk_widget_show(s);
    }

    // Project items with action subtext
    for (0..reg.count) |i| {
        const p = &reg.projects[i];
        const name = p.getName();
        const status = process.getStatus(name);
        const status_str: []const u8 = switch (status) {
            .running => " (running)",
            .stopped => "",
            .stale => " (stale)",
        };

        // Build label: "counter (running)"
        var label_buf: [160]u8 = undefined;
        const label = std.fmt.bufPrint(&label_buf, "{s}{s}", .{ name, status_str }) catch continue;
        label_buf[label.len] = 0;
        const label_z: [*:0]const u8 = @ptrCast(label_buf[0..label.len :0]);

        const item = gtk_menu_item_new_with_label(label_z);
        if (item == null) continue;

        // Connect to a static callback
        if (menu_action_count < callbacks.len) {
            // Default action: Run if stopped, Build otherwise
            var default_action_idx: u8 = 0;
            var ai: u8 = 0;
            for (actions_mod.ALL) |a| {
                if (!a.show_in_gui) continue;
                if (status == .running and std.mem.eql(u8, a.name, "build")) {
                    default_action_idx = ai;
                    break;
                }
                if (status != .running and std.mem.eql(u8, a.name, "run")) {
                    default_action_idx = ai;
                    break;
                }
                ai += 1;
            }

            menu_actions[menu_action_count] = .{
                .project_idx = @intCast(i),
                .action_idx = default_action_idx,
                .active = true,
            };
            _ = g_signal_connect_data(item, "activate", @ptrCast(callbacks[menu_action_count]), null, null, 0);
            menu_action_count += 1;
        }

        gtk_menu_shell_append(menu_ptr, item);
        gtk_widget_show(item);
    }

    // Separator
    const sep2 = gtk_separator_menu_item_new();
    if (sep2) |s| {
        gtk_menu_shell_append(menu_ptr, s);
        gtk_widget_show(s);
    }

    // Quit
    const quit_item = gtk_menu_item_new_with_label("Quit");
    if (quit_item) |item| {
        _ = g_signal_connect_data(item, "activate", @ptrCast(&onQuit), null, null, 0);
        gtk_menu_shell_append(menu_ptr, item);
        gtk_widget_show(item);
    }

    app_indicator_set_menu(indicator_ptr, menu_ptr);
}

/// Pump GTK events (non-blocking, bounded). Call this from the SDL event loop.
/// Processes up to 4 events per call to avoid stalling the render frame.
fn updateLinux() void {
    if (!gtk_initialized) return;
    var i: u32 = 0;
    while (gtk_events_pending() != 0 and i < 4) : (i += 1) {
        _ = gtk_main_iteration_do(0);
    }
}

/// Resolve a pending tray action — called by the GUI after checking pending_action.
fn resolvePendingActionLinux(reg: *const registry.Registry, alloc: std.mem.Allocator) void {
    if (pending_action) |pa| {
        pending_action = null;
        const aname = pa.name[0..pa.name_len];

        // path_len == 0 means resolve from project_idx stored in path[0]
        if (pa.path_len == 0) {
            const pidx: usize = pa.path[0];
            if (pidx < reg.count) {
                const path = reg.projects[pidx].getPath();
                // Spawn CLI action
                const argv = [_][]const u8{ "./zig-out/bin/tsz", aname, path };
                var child = std.process.Child.init(&argv, alloc);
                child.spawn() catch {};
            }
        }
    }
}

fn deinitLinux() void {
    if (menu_ptr) |m| {
        gtk_widget_destroy(m);
        menu_ptr = null;
    }
    if (indicator_ptr) |ind| {
        app_indicator_set_status(ind, APP_INDICATOR_STATUS_PASSIVE);
        g_object_unref(ind);
        indicator_ptr = null;
    }
}
