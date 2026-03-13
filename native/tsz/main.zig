//! tsz compiler — TypeScript-like syntax to native binary
//!
//! Reads .tsz files and produces Zig source code, then builds via zig build.
//! No Node.js. No npm. No TypeScript package. Just Zig all the way down.
//!
//! Usage:
//!   tsz build <file.tsz>    — compile to native binary
//!   tsz run <file.tsz>      — compile and run
//!   tsz dev <file.tsz>      — watch mode: recompile + relaunch on save

const std = @import("std");
const lexer = @import("lexer.zig");
const codegen = @import("codegen.zig");
const posix = std.posix;

/// Compile a .tsz file: read → tokenize → codegen → write → zig build.
/// Returns true on success, false on failure (prints errors).
fn compile(alloc: std.mem.Allocator, input_file: []const u8) bool {
    // Read source
    const source = std.fs.cwd().readFileAlloc(alloc, input_file, 1024 * 1024) catch |err| {
        std.debug.print("[tsz] Failed to read {s}: {}\n", .{ input_file, err });
        return false;
    };
    defer alloc.free(source);

    // Tokenize
    var lex = lexer.Lexer.init(source);
    lex.tokenize();

    // Codegen
    var gen = codegen.Generator.init(alloc, &lex, source, input_file);
    const zig_source = gen.generate() catch |err| {
        std.debug.print("[tsz] Compile error: {}\n", .{err});
        return false;
    };
    defer alloc.free(zig_source);

    // Write generated_app.zig
    const out_path = "native/engine/generated_app.zig";
    const out_file = std.fs.cwd().createFile(out_path, .{}) catch |err| {
        std.debug.print("[tsz] Failed to write {s}: {}\n", .{ out_path, err });
        return false;
    };
    defer out_file.close();
    out_file.writeAll(zig_source) catch |err| {
        std.debug.print("[tsz] Write error: {}\n", .{err});
        return false;
    };

    // Write ffi_libs.txt
    const libs_path = "native/engine/ffi_libs.txt";
    const libs_file = std.fs.cwd().createFile(libs_path, .{}) catch return false;
    defer libs_file.close();
    for (gen.ffi_libs.items) |lib| {
        libs_file.writeAll(lib) catch {};
        libs_file.writeAll("\n") catch {};
    }

    const basename = std.fs.path.basename(input_file);
    std.debug.print("[tsz] Compiled {s} → generated_app.zig\n", .{basename});

    // Build with zig
    const build_result = std.process.Child.run(.{
        .allocator = alloc,
        .argv = &.{ "zig", "build", "engine-app" },
    }) catch |err| {
        std.debug.print("[tsz] Build failed to start: {}\n", .{err});
        return false;
    };
    defer alloc.free(build_result.stdout);
    defer alloc.free(build_result.stderr);

    if (build_result.term.Exited != 0) {
        std.debug.print("[tsz] Build failed:\n{s}\n", .{build_result.stderr});
        return false;
    }
    std.debug.print("[tsz] Built → zig-out/bin/tsz-app\n", .{});
    return true;
}

/// Get the mtime of a file, or 0 on error.
fn getMtime(path: []const u8) i128 {
    const file = std.fs.cwd().openFile(path, .{}) catch return 0;
    defer file.close();
    const stat = file.stat() catch return 0;
    return stat.mtime;
}

/// Spawn tsz-app as a child process. Returns the pid.
/// Uses posix.spawn which inherits the full environment (DISPLAY, etc.).
fn spawnApp(alloc: std.mem.Allocator) ?posix.pid_t {
    const argv = [_][]const u8{"./zig-out/bin/tsz-app"};
    var child = std.process.Child.init(&argv, alloc);
    child.spawn() catch |err| {
        std.debug.print("[tsz] Failed to spawn app: {}\n", .{err});
        return null;
    };
    return child.id;
}

/// Kill a running child process by pid.
fn killApp(pid: posix.pid_t) void {
    posix.kill(pid, posix.SIG.TERM) catch {};
    // Wait for it to die (reap zombie)
    _ = posix.waitpid(pid, 0);
}

/// Dev mode: watch file, recompile on change, relaunch app.
fn devMode(alloc: std.mem.Allocator, input_file: []const u8) !void {
    std.debug.print(
        \\
        \\  ┌──────────────────────────────────────┐
        \\  │  tsz dev — watching for changes       │
        \\  │  Save the .tsz file to recompile.     │
        \\  │  Ctrl+C to stop.                      │
        \\  └──────────────────────────────────────┘
        \\
        \\
    , .{});

    // Initial build
    if (!compile(alloc, input_file)) {
        std.debug.print("[tsz] Initial build failed. Watching for changes...\n", .{});
    }

    var last_mtime = getMtime(input_file);
    var app_pid: ?posix.pid_t = null;

    // Launch if initial build succeeded
    if (std.fs.cwd().access("zig-out/bin/tsz-app", .{})) |_| {
        app_pid = spawnApp(alloc);
        if (app_pid != null) std.debug.print("[tsz] App launched. Watching {s}...\n\n", .{input_file});
    } else |_| {}

    // Poll loop
    while (true) {
        std.Thread.sleep(500 * std.time.ns_per_ms); // check every 500ms

        const mtime = getMtime(input_file);
        if (mtime == last_mtime) {
            // Check if child died on its own (user closed window)
            if (app_pid) |pid| {
                const result = posix.waitpid(pid, 1);
                if (result.pid != 0) {
                    std.debug.print("[tsz] App exited. Watching for changes...\n", .{});
                    app_pid = null;
                }
            }
            continue;
        }

        // File changed
        last_mtime = mtime;
        std.debug.print("\n[tsz] Change detected. Recompiling...\n", .{});

        if (!compile(alloc, input_file)) {
            std.debug.print("[tsz] Compile failed. Keeping current app running.\n", .{});
            continue;
        }

        // Kill old app
        if (app_pid) |pid| {
            std.debug.print("[tsz] Restarting app...\n", .{});
            killApp(pid);
            app_pid = null;
        }

        // Launch new app
        app_pid = spawnApp(alloc);
        if (app_pid != null) {
            std.debug.print("[tsz] App relaunched.\n\n", .{});
        }
    }
}

pub fn main() !void {
    var gpa = std.heap.GeneralPurposeAllocator(.{}){};
    defer _ = gpa.deinit();
    const alloc = gpa.allocator();

    const args = try std.process.argsAlloc(alloc);
    defer std.process.argsFree(alloc, args);

    if (args.len < 3) {
        std.debug.print(
            \\Usage:
            \\  tsz build <file.tsz>    Compile to native binary
            \\  tsz run <file.tsz>      Compile and run
            \\  tsz dev <file.tsz>      Watch mode: recompile + relaunch on save
            \\
        , .{});
        std.process.exit(1);
    }

    const command = args[1];
    const input_file = args[2];

    // Dev mode — watch + recompile + relaunch
    if (std.mem.eql(u8, command, "dev")) {
        try devMode(alloc, input_file);
        return;
    }

    // Build
    if (!compile(alloc, input_file)) {
        std.process.exit(1);
    }

    // Run if requested
    if (std.mem.eql(u8, command, "run")) {
        std.debug.print("[tsz] Running...\n\n", .{});
        const run_result = std.process.Child.run(.{
            .allocator = alloc,
            .argv = &.{"./zig-out/bin/tsz-app"},
        }) catch |err| {
            std.debug.print("[tsz] Run failed: {}\n", .{err});
            return;
        };
        defer alloc.free(run_result.stdout);
        defer alloc.free(run_result.stderr);
    }
}
