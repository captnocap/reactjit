//! ZigOS compiler — tsz build|check <file.tsz>
//! build: Compiles .tsz to generated_app.zig, then builds the binary.
//! check: Preflight validation — runs full pipeline without writing output or building.
//!        Outputs structured PREFLIGHT: lines to stdout for tooling consumption.

const std = @import("std");
const codegen = @import("codegen.zig");
const lexer_mod = @import("lexer.zig");
const lint = @import("lint.zig");
const modulegen = @import("modulegen.zig");

pub fn main() !void {
    var arena = std.heap.ArenaAllocator.init(std.heap.page_allocator);
    defer arena.deinit();
    const alloc = arena.allocator();

    const args = try std.process.argsAlloc(alloc);
    defer std.process.argsFree(alloc, args);

    // Subcommand routing
    if (args.len >= 2 and std.mem.eql(u8, args[1], "check")) {
        runCheck(alloc, args);
        return;
    }
    if (args.len >= 2 and std.mem.eql(u8, args[1], "test")) {
        runTest(alloc, args);
        return;
    }

    if (args.len < 3) {
        std.debug.print("Usage: zigos-compiler build|check|test [--strict] <file.tsz>\n", .{});
        return;
    }

    // Parse flags
    var strict_mode = false;
    var embed_mode = false;
    var input_idx: usize = 2;
    for (args[2..]) |arg| {
        if (std.mem.eql(u8, arg, "--strict")) {
            strict_mode = true;
            input_idx += 1;
        } else if (std.mem.eql(u8, arg, "--embed")) {
            embed_mode = true;
            input_idx += 1;
        } else break;
    }
    if (input_idx >= args.len) {
        std.debug.print("Usage: zigos-compiler build [--strict] <file.tsz>\n", .{});
        return;
    }

    const input_path = args[input_idx];
    const file_kind = classifyFile(input_path);

    const source = std.fs.cwd().readFileAlloc(alloc, input_path, 4 * 1024 * 1024) catch |err| {
        std.debug.print("Error reading {s}: {any}\n", .{ input_path, err });
        return;
    };
    defer alloc.free(source);

    // Imperative compilation: _zscript.tsz → .zig module (no JSX)
    if (file_kind == .zscript) {
        var lex = lexer_mod.Lexer.init(source);
        lex.tokenize();
        const zig_source = modulegen.generate(alloc, &lex, source, input_path) catch |err| {
            std.debug.print("[tsz] Compile error (imperative): {}\n", .{err});
            return;
        };
        const basename = std.fs.path.basename(input_path);
        const stem = basename[0 .. basename.len - "_zscript.tsz".len];
        const out_path = std.fmt.allocPrint(alloc, "{s}.zig", .{stem}) catch return;
        {
            const f = std.fs.cwd().createFile(out_path, .{}) catch |err| {
                std.debug.print("Error creating {s}: {any}\n", .{ out_path, err });
                return;
            };
            defer f.close();
            f.writeAll(zig_source) catch return;
        }
        std.debug.print("[tsz] Compiled imperative {s} -> {s}\n", .{ basename, out_path });
        return;
    }

    // Module compilation: .mod.tsz → .gen.zig fragment
    if (file_kind == .module) {
        const final_source = buildMergedSource(alloc, input_path, source);
        var lex = lexer_mod.Lexer.init(final_source);
        lex.tokenize();
        var gen = codegen.Generator.init(alloc, &lex, final_source, input_path);
        gen.is_module = true;
        gen.strict_mode = strict_mode;
        const zig_source = gen.generate() catch |err| {
            std.debug.print("[tsz] Module compile error: {}\n", .{err});
            gen.printDiagnosticSummary();
            return;
        };
        gen.printDiagnosticSummary();
        // Output: basename.gen.zig
        const basename = std.fs.path.basename(input_path);
        const stem = basename[0 .. basename.len - ".mod.tsz".len];
        const out_path = std.fmt.allocPrint(alloc, "{s}.gen.zig", .{stem}) catch return;
        {
            const f = std.fs.cwd().createFile(out_path, .{}) catch |err| {
                std.debug.print("Error creating {s}: {any}\n", .{ out_path, err });
                return;
            };
            defer f.close();
            f.writeAll(zig_source) catch return;
        }
        std.debug.print("[tsz] Compiled module {s} -> {s}\n", .{ basename, out_path });
        return;
    }

    // App compilation: .tsz → generated_app.zig + binary

    // Extract _script.tsz imports as JS logic (before merging)
    const script_js = loadScriptImports(alloc, input_path, source);

    // Resolve imports (inlines _cls.tsz classifiers, _c.tsz components)
    const final_source = buildMergedSource(alloc, input_path, source);

    // Compile .tsz → Zig
    var lex = lexer_mod.Lexer.init(final_source);
    lex.tokenize();

    // Lint pass — catch structural issues before codegen
    var linter = lint.Linter.init(alloc, &lex, final_source);
    const lint_result = linter.run();
    // Only print hints/warnings — don't abort on lint (codegen has its own error handling)
    for (lint_result.diagnostics) |d| {
        if (d.level == .err) continue; // codegen catches real errors with better context
        const level_str: []const u8 = switch (d.level) {
            .err => "error",
            .warn => "warning",
            .hint => "hint",
        };
        std.debug.print("[tsz] {s}:{d}:{d}: {s}: {s}\n", .{
            std.fs.path.basename(input_path), d.line, d.col, level_str, d.message,
        });
    }

    var gen = codegen.Generator.init(alloc, &lex, final_source, input_path);
    gen.strict_mode = strict_mode;
    gen.is_embedded = embed_mode;

    // If we found _script.tsz imports, set compute_js so codegen emits JS_LOGIC
    if (script_js) |js| {
        gen.compute_js = js;
    }
    const zig_source = gen.generate() catch |err| {
        std.debug.print("[tsz] Compile error: {}\n", .{err});
        gen.printDiagnosticSummary();
        return;
    };
    gen.printDiagnosticSummary();
    if (gen.errors.items.len > 0) return;
    defer alloc.free(zig_source);

    // Write output — embedded goes to framework/devtools.zig, normal to generated_app.zig
    const out_path = if (embed_mode) "framework/devtools.zig" else "generated_app.zig";
    {
        const f = std.fs.cwd().createFile(out_path, .{}) catch |err| {
            std.debug.print("Error creating {s}: {any}\n", .{ out_path, err });
            return;
        };
        defer f.close();
        f.writeAll(zig_source) catch return;
    }
    std.debug.print("[tsz] Compiled {s} -> {s}\n", .{ std.fs.path.basename(input_path), out_path });

    // Embedded mode: no binary build — the engine imports devtools.zig directly
    if (embed_mode) return;

    // Build binary — name it after the entry point
    const basename = std.fs.path.basename(input_path);
    const dot_pos = std.mem.lastIndexOfScalar(u8, basename, '.') orelse basename.len;
    const app_name = basename[0..dot_pos];
    const app_name_opt = try std.fmt.allocPrint(alloc, "-Dapp-name={s}", .{app_name});

    std.debug.print("[tsz] Building...\n", .{});
    var child = std.process.Child.init(
        &.{ "zig", "build", "--build-file", "build.zig", "--prefix", "zig-out", "-Doptimize=ReleaseFast", app_name_opt, "app" },
        alloc,
    );
    child.stderr_behavior = .Inherit;
    child.stdout_behavior = .Inherit;
    const term = child.spawnAndWait() catch |err| {
        std.debug.print("[tsz] Build failed to spawn: {}\n", .{err});
        return;
    };
    if (term.Exited != 0) {
        std.debug.print("[tsz] Build failed (exit {d})\n", .{term.Exited});
        return;
    }
    std.debug.print("[tsz] Built -> zig-out/bin/{s}\n", .{app_name});
}

// ── File type classification ────────────────────────────────────

const FileKind = enum {
    app,         // .tsz — app entry point
    app_comp,    // _c.tsz — app component
    app_cls,     // _cls.tsz — app classifiers
    module,      // .mod.tsz — runtime module entry point
    mod_comp,    // _cmod.tsz — module component
    mod_cls,     // _clsmod.tsz — module classifiers
    script,      // _script.tsz — JS logic (entry points only)
    zscript,     // _zscript.tsz — imperative Zig module (no JSX)
    unknown,
};

fn classifyFile(path: []const u8) FileKind {
    if (std.mem.endsWith(u8, path, "_clsmod.tsz")) return .mod_cls;
    if (std.mem.endsWith(u8, path, "_cmod.tsz")) return .mod_comp;
    if (std.mem.endsWith(u8, path, "_cls.tsz")) return .app_cls;
    if (std.mem.endsWith(u8, path, "_zscript.tsz")) return .zscript;
    if (std.mem.endsWith(u8, path, "_script.tsz")) return .script;
    if (std.mem.endsWith(u8, path, "_c.tsz")) return .app_comp;
    if (std.mem.endsWith(u8, path, ".c.tsz")) return .app_comp; // legacy
    if (std.mem.endsWith(u8, path, ".mod.tsz")) return .module;
    if (std.mem.endsWith(u8, path, ".script.tsz")) return .script; // legacy
    if (std.mem.endsWith(u8, path, ".cls.tsz")) return .app_cls; // legacy
    if (std.mem.endsWith(u8, path, ".tsz")) return .app;
    return .unknown;
}

/// Check if importer is allowed to import importee.
/// Returns error message or null if allowed.
///
/// App world:    .tsz  can import _c.tsz, _cls.tsz, _script.tsz
///               _c.tsz can import _c.tsz, _cls.tsz
/// Module world: .mod.tsz can import _cmod.tsz, _clsmod.tsz, _script.tsz
///               _cmod.tsz can import _cmod.tsz, _clsmod.tsz
/// Worlds cannot cross-import components or classifiers.
fn checkImportAllowed(importer: []const u8, importee: []const u8) ?[]const u8 {
    const from = classifyFile(importer);
    const to = classifyFile(importee);

    return switch (from) {
        .app => switch (to) {
            .app_comp, .app_cls, .script => null,
            .module, .mod_comp, .mod_cls => "app (.tsz) cannot import module world (.mod.tsz/_cmod.tsz/_clsmod.tsz)",
            else => null,
        },
        .app_comp => switch (to) {
            .app_comp, .app_cls => null,
            .script => "_c.tsz cannot import _script.tsz (only entry points can)",
            .module, .mod_comp, .mod_cls => "_c.tsz cannot import module world (.mod.tsz/_cmod.tsz/_clsmod.tsz)",
            else => null,
        },
        .module => switch (to) {
            .mod_comp, .mod_cls, .script => null,
            .app, .app_comp, .app_cls => ".mod.tsz cannot import app world (.tsz/_c.tsz/_cls.tsz)",
            else => null,
        },
        .mod_comp => switch (to) {
            .mod_comp, .mod_cls => null,
            .script => "_cmod.tsz cannot import _script.tsz (only entry points can)",
            .app, .app_comp, .app_cls => "_cmod.tsz cannot import app world (.tsz/_c.tsz/_cls.tsz)",
            else => null,
        },
        else => null,
    };
}

// ── Import resolution ───────────────────────────────────────────

const MAX_IMPORTS = 32;

fn buildMergedSource(alloc: std.mem.Allocator, input_file: []const u8, source: []const u8) []const u8 {
    var paths: [MAX_IMPORTS][]const u8 = undefined;
    const path_count = findImportPaths(source, &paths);
    if (path_count == 0) return source;
    var visited: [MAX_IMPORTS][]const u8 = undefined;
    var visited_count: u32 = 0;
    var merged: std.ArrayListUnmanaged(u8) = .{};
    mergeImports(alloc, input_file, source, &visited, &visited_count, &merged);
    if (merged.items.len == 0) return source;
    return merged.items;
}

fn findImportPaths(source: []const u8, paths_out: *[MAX_IMPORTS][]const u8) u32 {
    var count: u32 = 0;
    var i: usize = 0;
    while (i < source.len and count < MAX_IMPORTS) {
        if (i + 6 < source.len and source[i] == 'f' and source[i + 1] == 'r' and source[i + 2] == 'o' and source[i + 3] == 'm' and source[i + 4] == ' ') {
            var j = i + 5;
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

fn resolveImportPath(alloc: std.mem.Allocator, importer: []const u8, import_path: []const u8) ?[]const u8 {
    const dir = std.fs.path.dirname(importer) orelse ".";

    // Explicit suffix in the import path — resolve directly
    // e.g., './style_cls' → style_cls.tsz, './StatCard_c' → StatCard_c.tsz
    const suffix_map = [_]struct { suffix: []const u8, ext: []const u8 }{
        .{ .suffix = "_cls", .ext = "_cls.tsz" },
        .{ .suffix = "_clsmod", .ext = "_clsmod.tsz" },
        .{ .suffix = "_c", .ext = "_c.tsz" },
        .{ .suffix = "_cmod", .ext = "_cmod.tsz" },
        .{ .suffix = "_script", .ext = "_script.tsz" },
        // Legacy dot-separated suffixes
        .{ .suffix = ".cls", .ext = ".cls.tsz" },
        .{ .suffix = ".c", .ext = ".c.tsz" },
        .{ .suffix = ".script", .ext = ".script.tsz" },
    };
    for (suffix_map) |m| {
        if (std.mem.endsWith(u8, import_path, m.suffix)) {
            const base = import_path[0 .. import_path.len - m.suffix.len];
            const candidate = std.fmt.allocPrint(alloc, "{s}/{s}{s}", .{ dir, base, m.ext }) catch continue;
            if (std.fs.cwd().access(candidate, .{})) |_| return candidate else |_| {}
        }
    }

    // Try extensions in priority order
    const extensions = [_][]const u8{
        ".tsz",     "_c.tsz",      "_cls.tsz",    "_script.tsz",
        ".mod.tsz", "_cmod.tsz",   "_clsmod.tsz",
        ".c.tsz",   ".cls.tsz",    ".script.tsz", // legacy
    };
    for (extensions) |ext| {
        const candidate = std.fmt.allocPrint(alloc, "{s}/{s}{s}", .{ dir, import_path, ext }) catch continue;
        if (std.fs.cwd().access(candidate, .{})) |_| return candidate else |_| {}
    }
    return std.fmt.allocPrint(alloc, "{s}/{s}.tsz", .{ dir, import_path }) catch null;
}

fn mergeImports(alloc: std.mem.Allocator, input_file: []const u8, source: []const u8, visited: *[MAX_IMPORTS][]const u8, visited_count: *u32, merged: *std.ArrayListUnmanaged(u8)) void {
    for (visited.*[0..visited_count.*]) |v| {
        if (std.mem.eql(u8, v, input_file)) return;
    }
    if (visited_count.* >= MAX_IMPORTS) return;
    visited.*[visited_count.*] = input_file;
    visited_count.* += 1;
    var paths: [MAX_IMPORTS][]const u8 = undefined;
    const path_count = findImportPaths(source, &paths);
    for (paths[0..path_count]) |raw_path| {
        const resolved = resolveImportPath(alloc, input_file, raw_path) orelse continue;
        // Skip _script.tsz — they're JS, handled separately via loadScriptImports
        if (classifyFile(resolved) == .script) continue;
        // Enforce import boundaries
        if (checkImportAllowed(input_file, resolved)) |err_msg| {
            std.debug.print("[tsz] Import error: {s}\n  {s} -> {s}\n", .{ err_msg, std.fs.path.basename(input_file), std.fs.path.basename(resolved) });
            std.process.exit(1);
        }
        const imp_source = std.fs.cwd().readFileAlloc(alloc, resolved, 1024 * 1024) catch continue;
        mergeImports(alloc, resolved, imp_source, visited, visited_count, merged);
    }
    merged.appendSlice(alloc, source) catch {};
    merged.append(alloc, '\n') catch {};
}

/// Load all .script.tsz imports and concatenate their contents as JS_LOGIC.
fn loadScriptImports(alloc: std.mem.Allocator, input_file: []const u8, source: []const u8) ?[]const u8 {
    var paths: [MAX_IMPORTS][]const u8 = undefined;
    const path_count = findImportPaths(source, &paths);
    var js: std.ArrayListUnmanaged(u8) = .{};

    for (paths[0..path_count]) |raw_path| {
        const resolved = resolveImportPath(alloc, input_file, raw_path) orelse continue;
        if (!std.mem.endsWith(u8, resolved, ".script.tsz")) continue;
        const content = std.fs.cwd().readFileAlloc(alloc, resolved, 1024 * 1024) catch continue;
        js.appendSlice(alloc, content) catch continue;
        js.append(alloc, '\n') catch {};
    }

    if (js.items.len == 0) return null;
    return js.items;
}

// ── Preflight check ─────────────────────────────────────────────
//
// Runs the full compilation pipeline (lex → lint → codegen phases 1-9)
// but discards the output. Reports structured PREFLIGHT: lines to stdout
// for consumption by scripts/preflight.sh and Claude Code hooks.
//
// Output format (one per line, to stdout):
//   PREFLIGHT:DEP:<path>           — each file in the import graph
//   PREFLIGHT:ERROR:<file>:<line>:<col>:<message>
//   PREFLIGHT:WARN:<file>:<line>:<col>:<message>
//   PREFLIGHT:STATUS:OK            — or ERROR as final line

fn runCheck(alloc: std.mem.Allocator, args: []const []const u8) void {
    // Parse flags
    var strict_mode = false;
    var input_idx: usize = 2;
    while (input_idx < args.len) {
        if (std.mem.eql(u8, args[input_idx], "--strict")) {
            strict_mode = true;
            input_idx += 1;
        } else break;
    }
    if (input_idx >= args.len) {
        std.debug.print("Usage: zigos-compiler check [--strict] <file.tsz>\n", .{});
        return;
    }

    const input_path = args[input_idx];
    const file_kind = classifyFile(input_path);

    const source = std.fs.cwd().readFileAlloc(alloc, input_path, 4 * 1024 * 1024) catch |err| {
        std.debug.print("PREFLIGHT:ERROR:{s}:0:0:cannot read file: {}\n", .{ std.fs.path.basename(input_path), err });
        std.debug.print("PREFLIGHT:STATUS:ERROR\n", .{});
        return;
    };

    // Load script imports for app entry points
    const script_js = if (file_kind != .module) loadScriptImports(alloc, input_path, source) else null;

    // Resolve imports — track full dependency set
    var deps: [MAX_IMPORTS][]const u8 = undefined;
    var dep_count: u32 = 0;
    var merged: std.ArrayListUnmanaged(u8) = .{};
    mergeImports(alloc, input_path, source, &deps, &dep_count, &merged);
    const final_source = if (merged.items.len > 0) merged.items else source;

    // Emit dependency list
    for (deps[0..dep_count]) |dep| {
        std.debug.print("PREFLIGHT:DEP:{s}\n", .{dep});
    }

    // Lex
    var lex = lexer_mod.Lexer.init(final_source);
    lex.tokenize();

    // Lint
    var linter = lint.Linter.init(alloc, &lex, final_source);
    const lint_result = linter.run();
    var has_error = false;
    for (lint_result.diagnostics) |d| {
        const pfx: []const u8 = switch (d.level) {
            .err => "ERROR",
            .warn => "WARN",
            .hint => "HINT",
        };
        std.debug.print("PREFLIGHT:{s}:{s}:{d}:{d}:{s}\n", .{
            pfx, std.fs.path.basename(input_path), d.line, d.col, d.message,
        });
        if (d.level == .err) has_error = true;
    }

    // Codegen — full pipeline, discard generated output
    var gen = codegen.Generator.init(alloc, &lex, final_source, input_path);
    gen.strict_mode = strict_mode;
    if (file_kind == .module) gen.is_module = true;
    if (script_js) |js| gen.compute_js = js;

    _ = gen.generate() catch {
        for (gen.errors.items) |e| {
            std.debug.print("PREFLIGHT:ERROR:{s}:{d}:{d}:{s}\n", .{
                std.fs.path.basename(input_path), e.line, e.col, e.msg,
            });
        }
        std.debug.print("PREFLIGHT:STATUS:ERROR\n", .{});
        return;
    };

    // Collect soft errors and warnings from codegen
    for (gen.errors.items) |e| {
        std.debug.print("PREFLIGHT:ERROR:{s}:{d}:{d}:{s}\n", .{
            std.fs.path.basename(input_path), e.line, e.col, e.msg,
        });
        has_error = true;
    }
    for (gen.warnings.items) |w| {
        std.debug.print("PREFLIGHT:WARN:{s}:{d}:{d}:{s}\n", .{
            std.fs.path.basename(input_path), w.line, w.col, w.msg,
        });
    }

    if (has_error) {
        std.debug.print("PREFLIGHT:STATUS:ERROR\n", .{});
    } else {
        std.debug.print("PREFLIGHT:STATUS:OK\n", .{});
    }
}

// ── Test subcommand ─────────────────────────────────────────────────────
//
// zigos-compiler test <app.tsz>
//
// Compiles the app, builds the binary, then runs it with ZIGOS_TEST=1.
// The engine enables the test harness, which runs registered tests after
// the first rendered frame and exits with 0 (all pass) or 1 (any fail).

fn runTest(alloc: std.mem.Allocator, args: []const []const u8) void {
    if (args.len < 3) {
        std.debug.print("Usage: zigos-compiler test <file.tsz>\n", .{});
        return;
    }

    const input_path = args[2];

    // Step 1: Read and compile the .tsz source
    const source = std.fs.cwd().readFileAlloc(alloc, input_path, 4 * 1024 * 1024) catch |err| {
        std.debug.print("[test] Error reading {s}: {any}\n", .{ input_path, err });
        return;
    };
    defer alloc.free(source);

    const final_source = buildMergedSource(alloc, input_path, source);
    const script_js = loadScriptImports(alloc, input_path, source);

    var lex = lexer_mod.Lexer.init(final_source);
    lex.tokenize();

    var gen = codegen.Generator.init(alloc, &lex, final_source, input_path);
    if (script_js) |js| gen.compute_js = js;
    const zig_source = gen.generate() catch |err| {
        std.debug.print("[test] Compile error: {}\n", .{err});
        gen.printDiagnosticSummary();
        return;
    };
    gen.printDiagnosticSummary();
    if (gen.compile_error != null) return;

    // Write generated_app.zig
    const out_path = "generated_app.zig";
    {
        const f = std.fs.cwd().createFile(out_path, .{}) catch |err| {
            std.debug.print("[test] Error creating {s}: {any}\n", .{ out_path, err });
            return;
        };
        defer f.close();
        f.writeAll(zig_source) catch return;
    }

    // Step 2: Build the binary
    const basename = std.fs.path.basename(input_path);
    const dot_pos = std.mem.lastIndexOfScalar(u8, basename, '.') orelse basename.len;
    const app_name = basename[0..dot_pos];
    const app_name_opt = std.fmt.allocPrint(alloc, "-Dapp-name={s}", .{app_name}) catch return;

    std.debug.print("[test] Building {s}...\n", .{app_name});
    var build_child = std.process.Child.init(
        &.{ "zig", "build", "--build-file", "build.zig", "--prefix", "zig-out", "-Doptimize=ReleaseFast", app_name_opt, "app" },
        alloc,
    );
    build_child.stderr_behavior = .Inherit;
    build_child.stdout_behavior = .Inherit;
    const build_term = build_child.spawnAndWait() catch |err| {
        std.debug.print("[test] Build failed to spawn: {}\n", .{err});
        return;
    };
    if (build_term.Exited != 0) {
        std.debug.print("[test] Build failed (exit {d})\n", .{build_term.Exited});
        return;
    }

    // Step 3: Run with ZIGOS_TEST=1
    const bin_path = std.fmt.allocPrint(alloc, "zig-out/bin/{s}", .{app_name}) catch return;
    std.debug.print("[test] Running {s} with ZIGOS_TEST=1...\n", .{bin_path});

    var run_child = std.process.Child.init(&.{bin_path}, alloc);
    run_child.stderr_behavior = .Inherit;
    run_child.stdout_behavior = .Inherit;
    // Set ZIGOS_TEST=1 in the environment
    var env_map = std.process.EnvMap.init(alloc);
    // Copy current env
    if (std.process.getEnvMap(alloc)) |*current| {
        var it = current.iterator();
        while (it.next()) |entry| {
            env_map.put(entry.key_ptr.*, entry.value_ptr.*) catch {};
        }
    } else |_| {}
    env_map.put("ZIGOS_TEST", "1") catch {};
    run_child.env_map = &env_map;

    const run_term = run_child.spawnAndWait() catch |err| {
        std.debug.print("[test] Failed to run: {}\n", .{err});
        return;
    };

    if (run_term.Exited == 0) {
        std.debug.print("[test] ALL TESTS PASSED\n", .{});
    } else {
        std.debug.print("[test] TESTS FAILED (exit {d})\n", .{run_term.Exited});
    }
}
