//! tsz actions — shared action descriptors for CLI and GUI
//!
//! Every action that can be performed on a project is defined here.
//! The CLI dispatcher and GUI both read from this table, so adding
//! a new action automatically surfaces it everywhere.

const std = @import("std");

/// What kind of target does this action operate on?
pub const TargetKind = enum {
    project, // operates on a registered project (needs name/path)
    global, // operates on the whole registry (ls, gui)
    path, // operates on a file/dir argument (add)
};

/// An action that can be performed via CLI or GUI.
pub const Action = struct {
    name: []const u8, // CLI subcommand name
    label: []const u8, // Human-readable label (for GUI buttons)
    description: []const u8, // Help text
    target: TargetKind,
    show_in_gui: bool, // whether to show as a button in project rows
    icon: []const u8, // single char for GUI badge (e.g. "▶" "⚙" "✓")
};

/// The canonical list of all tsz actions. CLI and GUI both iterate this.
pub const ALL = [_]Action{
    .{
        .name = "build",
        .label = "Build",
        .description = "Compile to native binary",
        .target = .project,
        .show_in_gui = true,
        .icon = "B",
    },
    .{
        .name = "run",
        .label = "Run",
        .description = "Compile and run (kills existing first)",
        .target = .project,
        .show_in_gui = true,
        .icon = "R",
    },
    .{
        .name = "dev",
        .label = "Dev",
        .description = "Watch mode: recompile + relaunch on save",
        .target = .project,
        .show_in_gui = true,
        .icon = "D",
    },
    .{
        .name = "test",
        .label = "Test",
        .description = "Verify compile + build + smoke test",
        .target = .project,
        .show_in_gui = true,
        .icon = "T",
    },
    .{
        .name = "add",
        .label = "Add",
        .description = "Register a .tsz project",
        .target = .path,
        .show_in_gui = false,
        .icon = "+",
    },
    .{
        .name = "ls",
        .label = "List",
        .description = "List registered projects with status",
        .target = .global,
        .show_in_gui = false,
        .icon = "L",
    },
    .{
        .name = "rm",
        .label = "Remove",
        .description = "Unregister a project",
        .target = .project,
        .show_in_gui = true,
        .icon = "X",
    },
    .{
        .name = "init",
        .label = "Init",
        .description = "Scaffold a new .tsz project",
        .target = .path,
        .show_in_gui = false,
        .icon = "I",
    },
    .{
        .name = "gui",
        .label = "Dashboard",
        .description = "Open GUI dashboard",
        .target = .global,
        .show_in_gui = false,
        .icon = "G",
    },
};

/// Find an action by CLI name.
pub fn find(name: []const u8) ?*const Action {
    // Handle aliases
    const lookup = if (std.mem.eql(u8, name, "list")) "ls"
        else if (std.mem.eql(u8, name, "remove")) "rm"
        else name;

    for (&ALL) |*a| {
        if (std.mem.eql(u8, a.name, lookup)) return a;
    }
    return null;
}

/// Return only actions that should appear as buttons in GUI project rows.
pub fn guiActions() []const Action {
    // Return the full array — GUI filters by show_in_gui at render time
    return &ALL;
}

/// Count how many actions are shown in GUI project rows.
pub fn guiActionCount() usize {
    var count: usize = 0;
    for (ALL) |a| {
        if (a.show_in_gui) count += 1;
    }
    return count;
}
