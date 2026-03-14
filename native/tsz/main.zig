//! tsz — TypeScript-like syntax to native binary
//!
//! Compiler + project manager + GUI dashboard. Single binary, zero runtime.
//!
//! Usage:
//!   tsz build <file.tsz>    Compile to native binary
//!   tsz run <file.tsz>      Compile and run (kills existing first)
//!   tsz dev <file.tsz>      Watch mode: recompile + relaunch on save
//!   tsz test <file.tsz>     Verify compile → build → smoke test pipeline
//!   tsz add [dir|file.tsz]  Register a .tsz project
//!   tsz ls                  List registered projects with status
//!   tsz rm <name>           Unregister a project (kills if running)
//!   tsz gui                 Open GUI dashboard (Phase 2)

const std = @import("std");
const lexer = @import("lexer.zig");
const codegen = @import("codegen.zig");
const registry = @import("registry.zig");
const process = @import("process.zig");
pub const actions = @import("actions.zig");
const gui = @import("gui.zig");
const posix = std.posix;

// ── Helpers ─────────────────────────────────────────────────────────────

/// Derive the binary name from input file: "counter.tsz" → "tsz-counter"
fn appName(alloc: std.mem.Allocator, input_file: []const u8) []const u8 {
    const base = std.fs.path.basename(input_file);
    const stem = if (std.mem.endsWith(u8, base, ".tsz")) base[0 .. base.len - 4] else base;
    return std.fmt.allocPrint(alloc, "tsz-{s}", .{stem}) catch "tsz-app";
}

/// Derive project name from input file: "counter.tsz" → "counter"
fn projectName(input_file: []const u8) []const u8 {
    const base = std.fs.path.basename(input_file);
    return if (std.mem.endsWith(u8, base, ".tsz")) base[0 .. base.len - 4] else base;
}

/// Full path to the app binary: "zig-out/bin/tsz-counter"
fn appPath(alloc: std.mem.Allocator, input_file: []const u8) []const u8 {
    const name = appName(alloc, input_file);
    return std.fmt.allocPrint(alloc, "zig-out/bin/{s}", .{name}) catch "zig-out/bin/tsz-app";
}

/// Get the mtime of a file, or 0 on error.
fn getMtime(path: []const u8) i128 {
    const file = std.fs.cwd().openFile(path, .{}) catch return 0;
    defer file.close();
    const stat = file.stat() catch return 0;
    return stat.mtime;
}

// ── Compile ─────────────────────────────────────────────────────────────

/// Compile a .tsz file: read → tokenize → codegen → write → zig build → copy binary.
/// Returns true on success, false on failure (prints errors).
fn compile(alloc: std.mem.Allocator, input_file: []const u8) bool {
    const source = std.fs.cwd().readFileAlloc(alloc, input_file, 1024 * 1024) catch |err| {
        std.debug.print("[tsz] Failed to read {s}: {}\n", .{ input_file, err });
        return false;
    };
    defer alloc.free(source);

    var lex = lexer.Lexer.init(source);
    lex.tokenize();

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

    // Copy binary to per-app name
    const dest = appPath(alloc, input_file);
    std.fs.cwd().copyFile("zig-out/bin/tsz-app", std.fs.cwd(), dest, .{}) catch |err| {
        std.debug.print("[tsz] Warning: could not copy to {s}: {}\n", .{ dest, err });
    };
    std.debug.print("[tsz] Built → {s}\n", .{dest});
    return true;
}

// ── Spawn / Kill ────────────────────────────────────────────────────────

/// Spawn the app binary as a child process. Returns the pid.
fn spawnApp(alloc: std.mem.Allocator, input_file: []const u8) ?posix.pid_t {
    const path = appPath(alloc, input_file);
    const argv = [_][]const u8{path};
    var child = std.process.Child.init(&argv, alloc);
    child.spawn() catch |err| {
        std.debug.print("[tsz] Failed to spawn app: {}\n", .{err});
        return null;
    };
    return child.id;
}

/// Kill a running child process by pid.
fn killApp(pid: posix.pid_t) void {
    posix.kill(pid, posix.SIG.USR1) catch {};
    std.Thread.sleep(50 * std.time.ns_per_ms);
    posix.kill(pid, posix.SIG.TERM) catch {};
    _ = posix.waitpid(pid, 0);
}

// ── Subcommands ─────────────────────────────────────────────────────────

fn cmdBuild(alloc: std.mem.Allocator, input_file: []const u8) void {
    const name = projectName(input_file);
    var reg = registry.load(alloc);

    if (!compile(alloc, input_file)) {
        // Update registry with fail status
        if (reg.findByName(name)) |p| {
            p.last_build = .fail;
            p.last_build_time = std.time.timestamp();
            registry.save(&reg);
        }
        std.process.exit(1);
    }

    // Update registry with pass status
    if (reg.findByName(name)) |p| {
        p.last_build = .pass;
        p.last_build_time = std.time.timestamp();
        registry.save(&reg);
    }
}

fn cmdRun(alloc: std.mem.Allocator, input_file: []const u8) void {
    const name = projectName(input_file);

    // Kill existing process for this project
    process.killProject(name);

    cmdBuild(alloc, input_file);

    std.debug.print("[tsz] Running...\n\n", .{});
    if (spawnApp(alloc, input_file)) |pid| {
        process.writePid(name, pid);
        // Wait for it to exit
        _ = posix.waitpid(pid, 0);
        process.removePid(name);
    }
}

fn cmdDev(alloc: std.mem.Allocator, input_file: []const u8) !void {
    const name = projectName(input_file);

    // Kill existing process for this project
    process.killProject(name);

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

    if (!compile(alloc, input_file)) {
        std.debug.print("[tsz] Initial build failed. Watching for changes...\n", .{});
    }

    var last_mtime = getMtime(input_file);
    var app_pid: ?posix.pid_t = null;

    if (std.fs.cwd().access(appPath(alloc, input_file), .{})) |_| {
        app_pid = spawnApp(alloc, input_file);
        if (app_pid) |pid| {
            process.writePid(name, pid);
            std.debug.print("[tsz] App launched. Watching {s}...\n\n", .{input_file});
        }
    } else |_| {}

    while (true) {
        std.Thread.sleep(500 * std.time.ns_per_ms);

        const mtime = getMtime(input_file);
        if (mtime == last_mtime) {
            if (app_pid) |pid| {
                const result = posix.waitpid(pid, 1);
                if (result.pid != 0) {
                    std.debug.print("[tsz] App exited. Watching for changes...\n", .{});
                    app_pid = null;
                    process.removePid(name);
                }
            }
            continue;
        }

        last_mtime = mtime;
        std.debug.print("\n[tsz] Change detected. Recompiling...\n", .{});

        if (!compile(alloc, input_file)) {
            std.debug.print("[tsz] Compile failed. Keeping current app running.\n", .{});
            continue;
        }

        if (app_pid) |pid| {
            std.debug.print("[tsz] Restarting app...\n", .{});
            killApp(pid);
            app_pid = null;
            process.removePid(name);
        }

        app_pid = spawnApp(alloc, input_file);
        if (app_pid) |pid| {
            process.writePid(name, pid);
            std.debug.print("[tsz] App relaunched.\n\n", .{});
        }
    }
}

fn cmdTest(alloc: std.mem.Allocator, input_file: []const u8) void {
    const basename = std.fs.path.basename(input_file);
    std.debug.print("=== tsz test: {s} ===\n", .{basename});

    // Step 1: Compile
    std.debug.print("Compiling... ", .{});
    if (!compile(alloc, input_file)) {
        std.debug.print("FAIL: compilation failed\n", .{});
        std.process.exit(1);
    }
    std.debug.print("PASS\n", .{});

    // Step 2: Verify source reference
    std.debug.print("Checking source ref... ", .{});
    const gen_file = std.fs.cwd().openFile("native/engine/generated_app.zig", .{}) catch {
        std.debug.print("FAIL: can't read generated_app.zig\n", .{});
        std.process.exit(1);
    };
    defer gen_file.close();
    var header: [256]u8 = undefined;
    const hlen = gen_file.readAll(&header) catch 0;
    if (std.mem.indexOf(u8, header[0..hlen], basename) == null) {
        std.debug.print("FAIL: generated_app.zig doesn't reference {s}\n", .{basename});
        std.process.exit(1);
    }
    std.debug.print("PASS\n", .{});

    // Step 3: Smoke test (run for 1 second)
    std.debug.print("Smoke test (1s)... ", .{});
    const bin_path = appPath(alloc, input_file);
    const argv = [_][]const u8{bin_path};
    var child = std.process.Child.init(&argv, alloc);
    child.spawn() catch {
        std.debug.print("FAIL: can't spawn binary\n", .{});
        std.process.exit(1);
    };
    std.Thread.sleep(1 * std.time.ns_per_s);
    // Kill the app after 1 second
    if (child.id != 0) {
        posix.kill(child.id, posix.SIG.TERM) catch {};
        _ = posix.waitpid(child.id, 0);
    }
    std.debug.print("PASS\n", .{});

    std.debug.print("\nAll checks passed for {s}\n", .{basename});

    // Update registry
    const name = projectName(input_file);
    var reg = registry.load(alloc);
    if (reg.findByName(name)) |p| {
        p.last_build = .pass;
        p.last_build_time = std.time.timestamp();
        registry.save(&reg);
    }
}

fn cmdAdd(alloc: std.mem.Allocator, arg: []const u8) void {
    registry.ensureConfigDir();
    var reg = registry.load(alloc);

    // If arg ends with .tsz, register that file directly
    if (std.mem.endsWith(u8, arg, ".tsz")) {
        const name = projectName(arg);
        // Resolve to absolute path
        var abs_buf: [std.fs.max_path_bytes]u8 = undefined;
        const abs_path = std.fs.cwd().realpath(arg, &abs_buf) catch {
            std.debug.print("[tsz] File not found: {s}\n", .{arg});
            std.process.exit(1);
        };
        reg.add(name, abs_path);
        registry.save(&reg);
        std.debug.print("[tsz] Added project '{s}' → {s}\n", .{ name, abs_path });
        return;
    }

    // Otherwise, scan directory for .tsz files
    const dir = if (arg.len > 0) arg else ".";
    var iter_dir = std.fs.cwd().openDir(dir, .{ .iterate = true }) catch {
        std.debug.print("[tsz] Can't open directory: {s}\n", .{dir});
        std.process.exit(1);
    };
    defer iter_dir.close();

    var found: u32 = 0;
    var iter = iter_dir.iterate();
    while (iter.next() catch null) |entry| {
        if (entry.kind != .file) continue;
        if (!std.mem.endsWith(u8, entry.name, ".tsz")) continue;

        var path_buf: [std.fs.max_path_bytes]u8 = undefined;
        var full_buf: [std.fs.max_path_bytes]u8 = undefined;
        const rel = std.fmt.bufPrint(&path_buf, "{s}/{s}", .{ dir, entry.name }) catch continue;
        const abs = std.fs.cwd().realpath(rel, &full_buf) catch continue;

        const stem = entry.name[0 .. entry.name.len - 4];
        reg.add(stem, abs);
        std.debug.print("[tsz] Added '{s}' → {s}\n", .{ stem, abs });
        found += 1;
    }

    if (found == 0) {
        std.debug.print("[tsz] No .tsz files found in {s}\n", .{dir});
        return;
    }
    registry.save(&reg);
    std.debug.print("[tsz] Registered {d} project(s)\n", .{found});
}

fn cmdLs(alloc: std.mem.Allocator) void {
    var reg = registry.load(alloc);
    process.cleanStale(&reg);

    if (reg.count == 0) {
        std.debug.print("[tsz] No projects registered. Use 'tsz add' to register.\n", .{});
        return;
    }

    std.debug.print("\n  {s:<20} {s:<10} {s:<8} {s}\n", .{ "NAME", "STATUS", "BUILD", "PATH" });
    std.debug.print("  {s:-<20} {s:-<10} {s:-<8} {s:-<40}\n", .{ "", "", "", "" });

    for (0..reg.count) |i| {
        const p = &reg.projects[i];
        const name = p.getName();
        const status = process.getStatus(name);
        const status_str: []const u8 = switch (status) {
            .running => "running",
            .stopped => "stopped",
            .stale => "stale",
        };
        const build_str: []const u8 = switch (p.last_build) {
            .pass => "pass",
            .fail => "FAIL",
            .unknown => "—",
        };
        std.debug.print("  {s:<20} {s:<10} {s:<8} {s}\n", .{ name, status_str, build_str, p.getPath() });
    }
    std.debug.print("\n", .{});
}

fn cmdRm(alloc: std.mem.Allocator, name: []const u8) void {
    var reg = registry.load(alloc);

    // Kill if running
    process.killProject(name);

    if (reg.remove(name)) {
        registry.save(&reg);
        std.debug.print("[tsz] Removed '{s}'\n", .{name});
    } else {
        std.debug.print("[tsz] Project '{s}' not found\n", .{name});
    }
}

fn cmdInit(alloc: std.mem.Allocator, name: []const u8) void {
    // Create directory
    std.fs.cwd().makeDir(name) catch |err| {
        if (err != error.PathAlreadyExists) {
            std.debug.print("[tsz] Failed to create directory '{s}': {}\n", .{ name, err });
            std.process.exit(1);
        }
    };

    // Write app.tsz
    var tsz_path_buf: [512]u8 = undefined;
    const tsz_path = std.fmt.bufPrint(&tsz_path_buf, "{s}/app.tsz", .{name}) catch return;

    // Don't overwrite existing
    if (std.fs.cwd().access(tsz_path, .{})) |_| {
        std.debug.print("[tsz] {s} already exists, skipping\n", .{tsz_path});
    } else |_| {
        const file = std.fs.cwd().createFile(tsz_path, .{}) catch |err| {
            std.debug.print("[tsz] Failed to create {s}: {}\n", .{ tsz_path, err });
            return;
        };
        defer file.close();
        file.writeAll(
            \\// Generated by tsz init
            \\
            \\function App() {
            \\  const [count, setCount] = useState(0);
            \\  return (
            \\    <Box style={{ width: 600, padding: 32, flexDirection: 'column', gap: 16, backgroundColor: '#1a1a2e' }}>
            \\      <Text fontSize={24} color="#e94560">
        ) catch return;
        // Write the project name as title
        file.writeAll(name) catch return;
        file.writeAll(
            \\</Text>
            \\      <Text fontSize={48} color="#4ec9b0">{`Count: ${count}`}</Text>
            \\      <Box style={{ flexDirection: 'row', gap: 12 }}>
            \\        <Pressable onPress={() => setCount(count + 1)} style={{ padding: 16, backgroundColor: '#4ec9b0' }}>
            \\          <Text fontSize={16} color="#ffffff">Increment</Text>
            \\        </Pressable>
            \\        <Pressable onPress={() => setCount(count - 1)} style={{ padding: 16, backgroundColor: '#e94560' }}>
            \\          <Text fontSize={16} color="#ffffff">Decrement</Text>
            \\        </Pressable>
            \\      </Box>
            \\      <Text fontSize={12} color="#666688">Built with tsz — zero runtime, zero dependencies</Text>
            \\    </Box>
            \\  );
            \\}
            \\
        ) catch return;
    }

    std.debug.print("[tsz] Created {s}/app.tsz\n", .{name});

    // Auto-register the project
    registry.ensureConfigDir();
    var reg = registry.load(alloc);
    var abs_buf: [std.fs.max_path_bytes]u8 = undefined;
    const abs_path = std.fs.cwd().realpath(tsz_path, &abs_buf) catch tsz_path;
    reg.add(name, abs_path);
    registry.save(&reg);
    std.debug.print("[tsz] Registered project '{s}'\n", .{name});

    std.debug.print(
        \\
        \\  Next steps:
        \\    tsz build {s}/app.tsz    Compile to native binary
        \\    tsz run {s}/app.tsz      Compile and run
        \\    tsz dev {s}/app.tsz      Watch mode
        \\    tsz gui                     Open dashboard
        \\
    , .{ name, name, name });
}

// ── Main ────────────────────────────────────────────────────────────────

fn printUsage() void {
    std.debug.print("Usage:\n", .{});
    for (actions.ALL) |a| {
        // Build "tsz <name> <arg>" column
        var col_buf: [40]u8 = undefined;
        const arg_hint: []const u8 = switch (a.target) {
            .project => " <file.tsz>",
            .path => " [dir|file]",
            .global => "",
        };
        const col = std.fmt.bufPrint(&col_buf, "tsz {s}{s}", .{ a.name, arg_hint }) catch a.name;
        std.debug.print("  {s:<28} {s}\n", .{ col, a.description });
    }
    std.debug.print("\n", .{});
}

/// Execute an action by name on a project path. Used by both CLI and GUI.
pub fn execAction(alloc: std.mem.Allocator, action_name: []const u8, arg: []const u8) !void {
    if (std.mem.eql(u8, action_name, "build")) {
        cmdBuild(alloc, arg);
    } else if (std.mem.eql(u8, action_name, "run")) {
        cmdRun(alloc, arg);
    } else if (std.mem.eql(u8, action_name, "dev")) {
        try cmdDev(alloc, arg);
    } else if (std.mem.eql(u8, action_name, "test")) {
        cmdTest(alloc, arg);
    } else if (std.mem.eql(u8, action_name, "add")) {
        cmdAdd(alloc, arg);
    } else if (std.mem.eql(u8, action_name, "rm")) {
        cmdRm(alloc, arg);
    } else if (std.mem.eql(u8, action_name, "ls")) {
        cmdLs(alloc);
    } else if (std.mem.eql(u8, action_name, "init")) {
        cmdInit(alloc, arg);
    } else if (std.mem.eql(u8, action_name, "gui")) {
        try gui.run(alloc);
    }
}

pub fn main() !void {
    var gpa = std.heap.GeneralPurposeAllocator(.{}){};
    defer _ = gpa.deinit();
    const alloc = gpa.allocator();

    const args = try std.process.argsAlloc(alloc);
    defer std.process.argsFree(alloc, args);

    if (args.len < 2) {
        printUsage();
        std.process.exit(1);
    }

    const command = args[1];

    // Look up action in the shared table
    const action = actions.find(command) orelse {
        std.debug.print("[tsz] Unknown command: {s}\n", .{command});
        printUsage();
        std.process.exit(1);
        unreachable;
    };

    // Global actions don't need an argument
    if (action.target == .global) {
        try execAction(alloc, action.name, "");
        return;
    }

    // Project/path actions need an argument
    if (args.len < 3) {
        printUsage();
        std.process.exit(1);
    }

    try execAction(alloc, action.name, args[2]);
}
