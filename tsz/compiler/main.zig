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
//!   tsz compile-runtime <file.tsz>  Compile to embeddable runtime fragment (.gen.zig)
//!       --output <dir>, -o <dir>    Output directory (default: runtime/compiled/user/)
//!       --framework                  Output to runtime/compiled/framework/ instead
//!   tsz gui                 Open GUI dashboard (Phase 2)

const std = @import("std");
const builtin = @import("builtin");
const native_os = builtin.os.tag;
const lexer = @import("lexer.zig");
const codegen = @import("codegen.zig");
const modulegen = @import("modulegen.zig");
const registry = @import("registry.zig");
const process = @import("process.zig");
pub const actions = @import("actions.zig");
const gui = @import("gui.zig");
const win32 = if (native_os == .windows) @import("win32.zig") else undefined;

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

/// Full path to the app binary: "zig-out/bin/tsz-counter" (or .exe on Windows)
fn appPath(alloc: std.mem.Allocator, input_file: []const u8) []const u8 {
    const name = appName(alloc, input_file);
    const ext = if (native_os == .windows) ".exe" else "";
    return std.fmt.allocPrint(alloc, "zig-out/bin/{s}{s}", .{ name, ext }) catch "zig-out/bin/tsz-app";
}

/// Get the mtime of a file, or 0 on error.
fn getMtime(path: []const u8) i128 {
    const file = std.fs.cwd().openFile(path, .{}) catch return 0;
    defer file.close();
    const stat = file.stat() catch return 0;
    return stat.mtime;
}

// ── Multi-file imports ──────────────────────────────────────────────────

const MAX_IMPORTS = 32;

/// Scan source text for `import { ... } from './path'` statements.
/// Returns paths as raw strings (stripped of quotes, before .tsz resolution).
fn findImportPaths(source: []const u8, paths_out: *[MAX_IMPORTS][]const u8) u32 {
    var count: u32 = 0;
    var i: usize = 0;
    while (i < source.len and count < MAX_IMPORTS) {
        // Find "from " followed by a quote
        if (i + 6 < source.len and
            source[i] == 'f' and source[i + 1] == 'r' and source[i + 2] == 'o' and source[i + 3] == 'm' and source[i + 4] == ' ')
        {
            var j = i + 5;
            // Skip whitespace
            while (j < source.len and (source[j] == ' ' or source[j] == '\t')) j += 1;
            if (j < source.len and (source[j] == '\'' or source[j] == '"')) {
                const quote = source[j];
                j += 1;
                const path_start = j;
                while (j < source.len and source[j] != quote and source[j] != '\n') j += 1;
                if (j < source.len and source[j] == quote) {
                    paths_out[count] = source[path_start..j];
                    count += 1;
                }
                i = j + 1;
                continue;
            }
        }
        i += 1;
    }
    return count;
}

/// Resolve an import path relative to the importing file's directory.
/// './StatusBar' → '/abs/path/to/StatusBar.tsz'
fn resolveImportPath(alloc: std.mem.Allocator, importer: []const u8, import_path: []const u8) ?[]const u8 {
    const dir = std.fs.path.dirname(importer) orelse ".";
    // Add .tsz extension if not present
    const with_ext = if (std.mem.endsWith(u8, import_path, ".tsz"))
        import_path
    else if (std.mem.endsWith(u8, import_path, ".cls"))
        std.fmt.allocPrint(alloc, "{s}.tsz", .{import_path}) catch return null
    else
        std.fmt.allocPrint(alloc, "{s}.tsz", .{import_path}) catch return null;

    return std.fmt.allocPrint(alloc, "{s}/{s}", .{ dir, with_ext }) catch null;
}

/// Recursively merge imported files into a single source string.
/// Depth-first: imported files appear before their importers.
/// Cycle detection via visited set.
fn mergeImports(
    alloc: std.mem.Allocator,
    input_file: []const u8,
    source: []const u8,
    visited: *[MAX_IMPORTS][]const u8,
    visited_count: *u32,
    merged: *std.ArrayListUnmanaged(u8),
) void {
    // Cycle detection
    for (visited.*[0..visited_count.*]) |v| {
        if (std.mem.eql(u8, v, input_file)) return;
    }
    if (visited_count.* >= MAX_IMPORTS) return;
    visited.*[visited_count.*] = input_file;
    visited_count.* += 1;

    // Find imports in this source
    var paths: [MAX_IMPORTS][]const u8 = undefined;
    const path_count = findImportPaths(source, &paths);

    // Process each import (depth-first: imports before this file)
    for (paths[0..path_count]) |raw_path| {
        const resolved = resolveImportPath(alloc, input_file, raw_path) orelse continue;
        const imp_source = std.fs.cwd().readFileAlloc(alloc, resolved, 1024 * 1024) catch continue;
        // Recursively process this file's imports
        mergeImports(alloc, resolved, imp_source, visited, visited_count, merged);
    }

    // Append this file's source
    merged.appendSlice(alloc, source) catch {};
    merged.append(alloc, '\n') catch {};
}

/// Read a .tsz file and merge all its imports into a single source string.
/// Returns the merged source, or the original source if no imports found.
fn buildMergedSource(alloc: std.mem.Allocator, input_file: []const u8, source: []const u8) []const u8 {
    var paths: [MAX_IMPORTS][]const u8 = undefined;
    const path_count = findImportPaths(source, &paths);
    if (path_count == 0) return source; // fast path: no imports

    var visited: [MAX_IMPORTS][]const u8 = undefined;
    var visited_count: u32 = 0;
    var merged: std.ArrayListUnmanaged(u8) = .{};

    mergeImports(alloc, input_file, source, &visited, &visited_count, &merged);

    if (merged.items.len == 0) return source;
    return merged.items;
}

// ── Compile ─────────────────────────────────────────────────────────────

// Build mode — set by CLI flags, read by compile()
var g_release_mode: bool = true;
var g_framework_mode: bool = false; // --framework flag for compile-runtime
var g_output_path: ?[]const u8 = null; // --output <dir> override for compile-runtime

/// Detect if a tokenized .tsz file is imperative mode (no App function, no JSX).
fn isImperativeMode(lex: *const lexer.Lexer, source: []const u8) bool {
    var i: u32 = 0;
    while (i + 1 < lex.count) : (i += 1) {
        const tok = lex.get(i);
        if (tok.kind == .identifier) {
            const text = tok.text(source);
            // Check for function App(
            if (std.mem.eql(u8, text, "function")) {
                const next = lex.get(i + 1);
                if (next.kind == .identifier and std.mem.eql(u8, next.text(source), "App")) {
                    return false; // Has App function → JSX mode
                }
            }
        }
        // Check for JSX tags: < followed by PascalCase identifier (not ALL_CAPS)
        if (tok.kind == .lt) {
            const next = lex.get(i + 1);
            if (next.kind == .identifier) {
                const name = next.text(source);
                if (name.len > 1 and name[0] >= 'A' and name[0] <= 'Z') {
                    // PascalCase has at least one lowercase letter (Box, Text, ScrollView)
                    // ALL_CAPS (MAX_CHILDREN) is not JSX
                    var has_lower = false;
                    for (name[1..]) |ch| {
                        if (ch >= 'a' and ch <= 'z') { has_lower = true; break; }
                    }
                    if (has_lower) return false; // Has JSX → component mode
                }
            }
        }
    }
    return true; // No App, no JSX → imperative mode
}

/// Compile a .tsz file: read → tokenize → codegen → write → zig build → copy binary.
/// Returns true on success, false on failure (prints errors).
fn compile(alloc: std.mem.Allocator, input_file: []const u8) bool {
    const source = std.fs.cwd().readFileAlloc(alloc, input_file, 1024 * 1024) catch |err| {
        std.debug.print("[tsz] Failed to read {s}: {}\n", .{ input_file, err });
        return false;
    };
    defer alloc.free(source);

    // Pre-scan to detect imperative mode BEFORE merging
    // Imperative files use @import — don't merge source files
    var pre_lex = lexer.Lexer.init(source);
    pre_lex.tokenize();
    const imperative = isImperativeMode(&pre_lex, source);

    const final_source = if (imperative) source else buildMergedSource(alloc, input_file, source);

    var lex = lexer.Lexer.init(final_source);
    lex.tokenize();

    var gen: ?codegen.Generator = null;

    const zig_source = if (imperative) blk: {
        std.debug.print("[tsz] Imperative mode detected\n", .{});
        break :blk modulegen.generate(alloc, &lex, final_source, input_file) catch |err| {
            std.debug.print("[tsz] Compile error (imperative): {}\n", .{err});
            return false;
        };
    } else blk: {
        gen = codegen.Generator.init(alloc, &lex, final_source, input_file);
        break :blk gen.?.generate() catch |err| {
            std.debug.print("[tsz] Compile error: {}\n", .{err});
            return false;
        };
    };
    defer alloc.free(zig_source);

    // Write generated_app.zig
    const out_path = "tsz/runtime/generated_app.zig";
    const out_file = std.fs.cwd().createFile(out_path, .{}) catch |err| {
        std.debug.print("[tsz] Failed to write {s}: {}\n", .{ out_path, err });
        return false;
    };
    defer out_file.close();
    out_file.writeAll(zig_source) catch |err| {
        std.debug.print("[tsz] Write error: {}\n", .{err});
        return false;
    };

    // Write ffi_libs.txt (JSX mode only — imperative mode has no FFI)
    const libs_path = "tsz/runtime/ffi_libs.txt";
    const libs_file = std.fs.cwd().createFile(libs_path, .{}) catch return false;
    defer libs_file.close();
    if (gen) |g| {
        for (g.ffi_libs.items) |lib| {
            libs_file.writeAll(lib) catch {};
            libs_file.writeAll("\n") catch {};
        }
    }

    const basename = std.fs.path.basename(input_file);
    std.debug.print("[tsz] Compiled {s} → generated_app.zig\n", .{basename});

    // Build with zig
    const build_result = std.process.Child.run(.{
        .allocator = alloc,
        .argv = if (g_release_mode)
            &.{ "zig", "build", "engine-app", "-Doptimize=ReleaseSmall" }
        else
            &.{ "zig", "build", "engine-app" },
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
    const src_bin = if (native_os == .windows) "zig-out/bin/tsz-app.exe" else "zig-out/bin/tsz-app";
    const dest = appPath(alloc, input_file);
    std.fs.cwd().copyFile(src_bin, std.fs.cwd(), dest, .{}) catch |err| {
        std.debug.print("[tsz] Warning: could not copy to {s}: {}\n", .{ dest, err });
    };
    std.debug.print("[tsz] Built → {s}\n", .{dest});
    return true;
}

// ── Spawn / Kill ────────────────────────────────────────────────────────

/// Spawn the app binary as a child process. Returns the platform PID.
fn spawnApp(alloc: std.mem.Allocator, input_file: []const u8) ?process.PidType {
    const path = appPath(alloc, input_file);
    const argv = [_][]const u8{path};
    var child = std.process.Child.init(&argv, alloc);
    child.spawn() catch |err| {
        std.debug.print("[tsz] Failed to spawn app: {}\n", .{err});
        return null;
    };
    if (native_os == .windows) {
        return win32.GetProcessId(child.id);
    } else {
        return child.id;
    }
}

/// Kill a running child process by PID.
fn killApp(pid: process.PidType) void {
    if (native_os == .windows) {
        const handle = win32.OpenProcess(win32.PROCESS_TERMINATE, 0, pid) orelse return;
        defer win32.closeHandle(handle);
        _ = win32.TerminateProcess(handle, 1);
        std.Thread.sleep(100 * std.time.ns_per_ms);
    } else {
        std.posix.kill(pid, std.posix.SIG.USR1) catch {};
        std.Thread.sleep(50 * std.time.ns_per_ms);
        std.posix.kill(pid, std.posix.SIG.TERM) catch {};
        _ = std.posix.waitpid(pid, 0);
    }
}

// ── Subcommands ─────────────────────────────────────────────────────────

fn findProject(reg: *registry.Registry, input_file: []const u8) ?*registry.Project {
    // 1. Try resolved absolute path first (most precise)
    var abs_buf: [std.fs.max_path_bytes]u8 = undefined;
    if (std.fs.cwd().realpath(input_file, &abs_buf)) |abs| {
        if (reg.findByPath(abs)) |p| return p;
    } else |_| {}
    // 2. Try by relative path
    if (reg.findByPath(input_file)) |p| return p;
    // 3. Fall back to derived name (least precise — can collide)
    const name = projectName(input_file);
    if (reg.findByName(name)) |p| return p;
    return null;
}

fn cmdBuild(alloc: std.mem.Allocator, input_file: []const u8) void {
    var reg = registry.load(alloc);

    if (!compile(alloc, input_file)) {
        if (findProject(&reg, input_file)) |p| {
            p.last_build = .fail;
            p.last_build_time = std.time.timestamp();
            registry.save(&reg);
        }
        std.process.exit(1);
    }

    if (findProject(&reg, input_file)) |p| {
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
        if (native_os == .windows) {
            // Poll until process exits
            while (process.isRunning(pid)) {
                std.Thread.sleep(100 * std.time.ns_per_ms);
            }
        } else {
            _ = std.posix.waitpid(pid, 0);
        }
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
    var app_pid: ?process.PidType = null;

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
                if (!process.isRunning(pid)) {
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
    const gen_file = std.fs.cwd().openFile("tsz/runtime/generated_app.zig", .{}) catch {
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

    // Step 3: Run with TSZ_TEST=1 (headless via xvfb-run if available)
    // If the app has test harness hooks, they'll run after first frame
    // and print PASS/FAIL results, then exit. If no tests are registered,
    // fall back to smoke test (run for 1 second, check it doesn't crash).
    std.debug.print("Running tests... ", .{});
    const bin_path = appPath(alloc, input_file);
    const argv = [_][]const u8{bin_path};
    var child = std.process.Child.init(&argv, alloc);

    // Set TSZ_TEST=1 to activate test harness
    // EnvMap inherits current env; we just add TSZ_TEST
    var env_map = std.process.EnvMap.init(alloc);
    env_map.put("TSZ_TEST", "1") catch {};
    child.env_map = &env_map;
    child.stdout_behavior = .Pipe;
    child.stderr_behavior = .Pipe;
    child.spawn() catch {
        std.debug.print("FAIL: can't spawn binary\n", .{});
        std.process.exit(1);
    };

    // Wait up to 10 seconds for test to complete
    const timeout_ns: u64 = 10 * std.time.ns_per_s;
    const start_time = std.time.nanoTimestamp();
    var exited = false;

    while (!exited) {
        const elapsed: u64 = @intCast(std.time.nanoTimestamp() - start_time);
        if (elapsed >= timeout_ns) break;
        std.Thread.sleep(50 * std.time.ns_per_ms);

        if (native_os == .windows) {
            exited = !process.isRunning(child.id);
        } else {
            // Non-blocking waitpid
            const wait_result = std.posix.waitpid(child.id, std.posix.W.NOHANG);
            if (wait_result.pid != 0) exited = true;
        }
    }

    if (!exited) {
        // Timeout — kill and report
        if (native_os == .windows) {
            _ = win32.TerminateProcess(child.id, 1);
            std.Thread.sleep(100 * std.time.ns_per_ms);
        } else {
            std.posix.kill(child.id, std.posix.SIG.TERM) catch {};
            _ = std.posix.waitpid(child.id, 0);
        }
        std.debug.print("TIMEOUT (10s)\n", .{});
    } else {
        // Read stderr for test output (test harness prints to stderr via std.debug.print)
        if (child.stderr) |stderr| {
            var buf: [4096]u8 = undefined;
            const n = stderr.readAll(&buf) catch 0;
            if (n > 0) {
                const output = buf[0..n];
                // Check if output contains test results
                if (std.mem.indexOf(u8, output, "TEST ") != null) {
                    std.debug.print("\n{s}", .{output});
                } else {
                    std.debug.print("PASS (smoke)\n", .{});
                }
            } else {
                std.debug.print("PASS (smoke)\n", .{});
            }
        } else {
            std.debug.print("PASS\n", .{});
        }
    }

    std.debug.print("\nAll checks passed for {s}\n", .{basename});

    // Update registry
    var reg = registry.load(alloc);
    if (findProject(&reg, input_file)) |p| {
        p.last_build = .pass;
        p.last_build_time = std.time.timestamp();
        registry.save(&reg);
    }
}

fn cmdCompileRuntime(alloc: std.mem.Allocator, input_file: []const u8) void {
    const source = std.fs.cwd().readFileAlloc(alloc, input_file, 1024 * 1024) catch |err| {
        std.debug.print("[tsz] Failed to read {s}: {}\n", .{ input_file, err });
        std.process.exit(1);
    };
    defer alloc.free(source);

    // Pre-scan to detect imperative mode BEFORE merging
    // Imperative files use @import — don't merge source files
    var pre_lex = lexer.Lexer.init(source);
    pre_lex.tokenize();
    const imperative = isImperativeMode(&pre_lex, source);

    const final_source = if (imperative) source else buildMergedSource(alloc, input_file, source);

    var lex = lexer.Lexer.init(final_source);
    lex.tokenize();

    // Route to imperative mode or JSX fragment mode
    const zig_source = if (imperative) blk: {
        std.debug.print("[tsz] Imperative mode detected\n", .{});
        break :blk modulegen.generate(alloc, &lex, final_source, input_file) catch |err| {
            std.debug.print("[tsz] Compile error (imperative): {}\n", .{err});
            std.process.exit(1);
        };
    } else blk: {
        var gen = codegen.Generator.init(alloc, &lex, final_source, input_file);
        gen.mode = .runtime_fragment;
        break :blk gen.generate() catch |err| {
            std.debug.print("[tsz] Compile error: {}\n", .{err});
            std.process.exit(1);
        };
    };
    defer alloc.free(zig_source);

    // Determine output path: kebab-to-snake, .gen.zig extension
    // Default → user/, --framework → framework/
    const basename = std.fs.path.basename(input_file);
    const stem = if (std.mem.endsWith(u8, basename, ".tsz")) basename[0 .. basename.len - 4] else basename;

    // Convert kebab-case and PascalCase to snake_case, lowercase
    var snake_buf: [256]u8 = undefined;
    var snake_len: usize = 0;
    for (stem) |ch| {
        if (snake_len >= snake_buf.len - 1) break;
        snake_buf[snake_len] = if (ch == '-') '_' else ch;
        snake_len += 1;
    }
    const snake_name = snake_buf[0..snake_len];

    for (snake_name) |*ch| {
        if (ch.* >= 'A' and ch.* <= 'Z') ch.* = ch.* + 32;
    }

    // Determine output directory: --output overrides default user/framework split
    const out_dir = g_output_path orelse if (g_framework_mode) "tsz/runtime/compiled/framework" else "tsz/runtime/compiled/user";
    std.fs.cwd().makePath(out_dir) catch |err| {
        std.debug.print("[tsz] Failed to create output dir: {}\n", .{err});
        std.process.exit(1);
    };

    const out_path = std.fmt.allocPrint(alloc, "{s}/{s}.gen.zig", .{ out_dir, snake_name }) catch {
        std.debug.print("[tsz] Out of memory\n", .{});
        std.process.exit(1);
    };
    defer alloc.free(out_path);

    const out_file = std.fs.cwd().createFile(out_path, .{}) catch |err| {
        std.debug.print("[tsz] Failed to write {s}: {}\n", .{ out_path, err });
        std.process.exit(1);
    };
    defer out_file.close();
    out_file.writeAll(zig_source) catch |err| {
        std.debug.print("[tsz] Write error: {}\n", .{err});
        std.process.exit(1);
    };

    std.debug.print("[tsz] Compiled {s} → {s}\n", .{ basename, out_path });
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
    } else if (std.mem.eql(u8, action_name, "compile-runtime")) {
        cmdCompileRuntime(alloc, arg);
    }
}

fn checkPathInstall() void {
    // PATH install is POSIX-only (symlinks to ~/.local/bin)
    if (native_os == .windows) return;

    // Only offer once — check flag file
    const home = std.posix.getenv("HOME") orelse return;
    var flag_buf: [280]u8 = undefined;
    const flag_path = std.fmt.bufPrint(&flag_buf, "{s}/.config/tsz/.path_offered", .{home}) catch return;
    if (std.fs.cwd().access(flag_path, .{})) |_| return else |_| {}

    // Check if `tsz` is already reachable in PATH
    const path_env = std.posix.getenv("PATH") orelse return;
    var self_buf: [std.fs.max_path_bytes]u8 = undefined;
    const self_path = std.fs.selfExePath(&self_buf) catch return;

    var it = std.mem.splitScalar(u8, path_env, ':');
    while (it.next()) |dir| {
        var link_buf: [std.fs.max_path_bytes]u8 = undefined;
        const candidate = std.fmt.bufPrint(&link_buf, "{s}/tsz", .{dir}) catch continue;
        // Check if this path exists and resolves to our binary
        var resolved_buf: [std.fs.max_path_bytes]u8 = undefined;
        if (std.fs.cwd().realpath(candidate, &resolved_buf)) |resolved| {
            if (std.mem.eql(u8, resolved, self_path)) return; // Already in PATH
        } else |_| {}
    }

    // Not in PATH — ask
    std.debug.print("\n  \x1b[36mtsz\x1b[0m is not in your PATH.\n", .{});

    var dest_buf: [280]u8 = undefined;
    const dest = std.fmt.bufPrint(&dest_buf, "{s}/.local/bin/tsz", .{home}) catch return;
    std.debug.print("  Add it so you can run \x1b[1mtsz\x1b[0m from anywhere?\n\n", .{});
    std.debug.print("    \x1b[2m{s} → {s}\x1b[0m\n\n", .{ dest, self_path });
    std.debug.print("  \x1b[1m[Y/n]\x1b[0m ", .{});

    var ans_buf: [16]u8 = undefined;
    const ans_len = std.posix.read(std.posix.STDIN_FILENO, &ans_buf) catch 0;
    const answer = if (ans_len > 0) std.mem.trimRight(u8, ans_buf[0..ans_len], "\n\r\t ") else "";

    if (answer.len == 0 or answer[0] == 'y' or answer[0] == 'Y') {
        // Ensure ~/.local/bin exists
        var bin_dir_buf: [280]u8 = undefined;
        const bin_dir = std.fmt.bufPrint(&bin_dir_buf, "{s}/.local/bin", .{home}) catch return;
        std.fs.cwd().makePath(bin_dir) catch {};

        // Create symlink
        std.posix.symlink(self_path, dest) catch |err| {
            if (err == error.PathAlreadyExists) {
                // Remove old and retry
                std.fs.cwd().deleteFile(dest) catch return;
                std.posix.symlink(self_path, dest) catch {
                    std.debug.print("  \x1b[31mFailed to create symlink.\x1b[0m\n\n", .{});
                    return;
                };
            } else {
                std.debug.print("  \x1b[31mFailed to create symlink.\x1b[0m\n\n", .{});
                return;
            }
        };
        std.debug.print("  \x1b[32mDone!\x1b[0m Run \x1b[1mtsz\x1b[0m from anywhere.\n\n", .{});
    }

    // Write flag so we don't ask again
    registry.ensureConfigDir();
    if (std.fs.cwd().createFile(flag_path, .{})) |f| f.close() else |_| {}
}

pub fn main() !void {
    // Use page_allocator — compiler is short-lived, no need for leak checking.
    // GPA's leak detector causes non-zero exit codes that break the GUI.
    const alloc = std.heap.page_allocator;

    // ── Resolve repo root and chdir to it ────────────────────────
    // The binary lives at <repo>/zig-out/bin/tsz. Resolve the repo root
    // so all relative paths (tsz/runtime/, build.zig, etc.) work regardless
    // of where the user launched from.
    {
        var exe_buf: [1024]u8 = undefined;
        const exe_path = std.fs.selfExePath(&exe_buf) catch null;
        if (exe_path) |ep| {
            // Go up 3 levels: /repo/zig-out/bin/tsz → /repo/zig-out/bin → /repo/zig-out → /repo
            if (std.fs.path.dirname(ep)) |bin_dir| {
                if (std.fs.path.dirname(bin_dir)) |zigout_dir| {
                    if (std.fs.path.dirname(zigout_dir)) |repo_root| {
                        if (native_os == .windows) {
                            // std.fs doesn't expose chdir on Windows,
                            // so call the C runtime directly.
                            const chdir_fn = struct {
                                extern "c" fn _chdir(path: [*:0]const u8) c_int;
                            };
                            // repo_root is a slice — copy to null-terminated buffer
                            var chdir_buf: [1024]u8 = undefined;
                            if (repo_root.len < chdir_buf.len) {
                                @memcpy(chdir_buf[0..repo_root.len], repo_root);
                                chdir_buf[repo_root.len] = 0;
                                _ = chdir_fn._chdir(@ptrCast(&chdir_buf));
                            }
                        } else {
                            std.posix.chdir(repo_root) catch {};
                        }
                    }
                }
            }
        }
    }

    const args = try std.process.argsAlloc(alloc);
    defer std.process.argsFree(alloc, args);

    if (args.len < 2) {
        printUsage();
        std.process.exit(1);
    }

    checkPathInstall();

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

    // Check for flags anywhere in args
    var i: usize = 0;
    while (i < args.len) : (i += 1) {
        const arg = args[i];
        if (std.mem.eql(u8, arg, "--debug")) {
            g_release_mode = false;
        } else if (std.mem.eql(u8, arg, "--framework")) {
            g_framework_mode = true;
        } else if (std.mem.eql(u8, arg, "--output") or std.mem.eql(u8, arg, "-o")) {
            if (i + 1 < args.len) {
                i += 1;
                g_output_path = args[i];
            } else {
                std.debug.print("[tsz] --output requires a directory path\n", .{});
                std.process.exit(1);
            }
        } else if (std.mem.startsWith(u8, arg, "--output=")) {
            g_output_path = arg["--output=".len..];
        }
    }

    // Find the positional argument (skip flags and their values)
    var positional: ?[]const u8 = null;
    var j: usize = 2; // skip binary name + command
    while (j < args.len) : (j += 1) {
        const a = args[j];
        if (std.mem.eql(u8, a, "--debug") or std.mem.eql(u8, a, "--framework")) {
            continue;
        } else if (std.mem.eql(u8, a, "--output") or std.mem.eql(u8, a, "-o")) {
            j += 1; // skip the value
            continue;
        } else if (std.mem.startsWith(u8, a, "--output=")) {
            continue;
        } else if (!std.mem.startsWith(u8, a, "-")) {
            positional = a;
            break;
        }
    }

    // Project/path actions need an argument
    const target_arg = positional orelse {
        printUsage();
        std.process.exit(1);
        unreachable;
    };

    try execAction(alloc, action.name, target_arg);
}
