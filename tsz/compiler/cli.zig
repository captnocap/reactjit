//! tsz compiler — tsz build|check <file.tsz>
//! build: Compiles .tsz to generated_app.zig, then builds the binary.
//! check: Preflight validation — runs full pipeline without writing output or building.
//!        Outputs structured PREFLIGHT: lines to stdout for tooling consumption.

const std = @import("std");
const codegen = @import("codegen.zig");
const lexer_mod = @import("lexer.zig");
const lint = @import("lint.zig");
const modulegen = @import("modulegen.zig");
const cli_init = @import("cli_init.zig");
const cli_convert = @import("cli_convert.zig");
const cli_serve = @import("cli_serve.zig");

const zig_local_cache_dir = ".zig-cache";
const zig_global_cache_dir = ".zig-global-cache";

fn resolveBuildRoot(alloc: std.mem.Allocator, tsz_root: ?[]const u8) ?[]const u8 {
    if (tsz_root) |root| return root;
    return std.fs.cwd().realpathAlloc(alloc, ".") catch null;
}

fn ensureZigPackageCacheSeeded(alloc: std.mem.Allocator, build_root: []const u8) void {
    const cache_root = std.fmt.allocPrint(alloc, "{s}/{s}", .{ build_root, zig_global_cache_dir }) catch return;
    const cache_packages = std.fmt.allocPrint(alloc, "{s}/p", .{cache_root}) catch return;

    if (std.fs.cwd().access(cache_packages, .{})) |_| return else |_| {}

    std.fs.makeDirAbsolute(cache_root) catch |err| switch (err) {
        error.PathAlreadyExists => {},
        else => return,
    };

    const home = std.posix.getenv("HOME") orelse return;
    const home_packages = std.fmt.allocPrint(alloc, "{s}/.cache/zig/p", .{home}) catch return;
    if (std.fs.cwd().access(home_packages, .{})) |_| {
        std.fs.symLinkAbsolute(home_packages, cache_packages, .{}) catch |err| switch (err) {
            error.PathAlreadyExists => {},
            else => {},
        };
    } else |_| {}
}

fn cachedZigBuildArgv(alloc: std.mem.Allocator, argv: []const []const u8) ![]const []const u8 {
    if (argv.len < 2 or
        !std.mem.eql(u8, argv[0], "zig") or
        !std.mem.eql(u8, argv[1], "build"))
    {
        return argv;
    }

    for (argv) |arg| {
        if (std.mem.eql(u8, arg, "--cache-dir") or std.mem.eql(u8, arg, "--global-cache-dir")) {
            return argv;
        }
    }

    // Keep build caches inside the repo instead of relying on ~/.cache/zig.
    // This avoids poisoned or unwritable global caches breaking tsz builds.
    const out = try alloc.alloc([]const u8, argv.len + 4);
    out[0] = argv[0];
    out[1] = argv[1];
    out[2] = "--cache-dir";
    out[3] = zig_local_cache_dir;
    out[4] = "--global-cache-dir";
    out[5] = zig_global_cache_dir;
    @memcpy(out[6..], argv[2..]);
    return out;
}

pub fn main() !void {
    var arena = std.heap.ArenaAllocator.init(std.heap.page_allocator);
    defer arena.deinit();
    const alloc = arena.allocator();

    const args = try std.process.argsAlloc(alloc);
    defer std.process.argsFree(alloc, args);

    // Subcommand routing
    if (args.len >= 2) {
        const cmd = args[1];
        if (std.mem.eql(u8, cmd, "run")) {
            runCommand(alloc, args);
            return;
        }
        if (std.mem.eql(u8, cmd, "check") or std.mem.eql(u8, cmd, "preflight")) {
            runCheck(alloc, args);
            return;
        }
        if (std.mem.eql(u8, cmd, "lint")) {
            runLint(alloc, args);
            return;
        }
        if (std.mem.eql(u8, cmd, "test")) {
            runTest(alloc, args);
            return;
        }
        if (std.mem.eql(u8, cmd, "setup-editor")) {
            runSetupEditor(alloc);
            return;
        }
        if (std.mem.eql(u8, cmd, "init")) {
            cli_init.run(alloc, args);
            return;
        }
        if (std.mem.eql(u8, cmd, "convert")) {
            cli_convert.run(alloc, args);
            return;
        }
        if (std.mem.eql(u8, cmd, "dist")) {
            const cli_dist = @import("cli_dist.zig");
            cli_dist.run(alloc, args);
            return;
        }
        if (std.mem.eql(u8, cmd, "dev")) {
            runDev(alloc, args);
            return;
        }
        if (std.mem.eql(u8, cmd, "pack")) {
            runPack(alloc, args);
            return;
        }
        if (std.mem.eql(u8, cmd, "serve")) {
            cli_serve.run(alloc, args);
            return;
        }
    }

    if (args.len < 3) {
        std.debug.print("Usage: tsz build|dev|run|check|lint|test|init|convert|serve|setup-editor [--strict] <file.tsz>\n", .{});
        return;
    }

    // Parse flags
    var strict_mode = false;
    var embed_mode = false;
    var web_mode = false;
    var input_idx: usize = 2;
    for (args[2..]) |arg| {
        if (std.mem.eql(u8, arg, "--strict")) {
            strict_mode = true;
            input_idx += 1;
        } else if (std.mem.eql(u8, arg, "--embed")) {
            embed_mode = true;
            input_idx += 1;
        } else if (std.mem.eql(u8, arg, "--web")) {
            web_mode = true;
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

    // Script files are never standalone entry points — they're imported by .tsz or .mod.tsz
    if (file_kind == .zscript or file_kind == .script) {
        const ext = if (file_kind == .zscript) "zscript" else "script";
        std.debug.print("\n[tsz] ERROR: .{s}.tsz is not a compile entry point.\n", .{ext});
        std.debug.print("[tsz] Script files are imported by a .tsz or .mod.tsz entry via <{s}> blocks.\n", .{ext});
        return;
    }

    // Non-entry files: components, classifiers — these are imported, not compiled directly
    if (file_kind == .app_comp or file_kind == .app_cls or file_kind == .mod_comp or file_kind == .mod_cls) {
        std.debug.print("\n[tsz] ERROR: This file is not a compile entry point.\n", .{});
        std.debug.print("[tsz] Components (.c.tsz) and classifiers (.cls.tsz) are imported by a .tsz entry.\n", .{});
        std.debug.print("[tsz] Only .tsz and .mod.tsz can be compiled directly.\n", .{});
        return;
    }

    if (file_kind == .unknown) {
        std.debug.print("\n[tsz] ERROR: Unrecognized file extension for '{s}'\n", .{input_path});
        std.debug.print("[tsz] Valid entry points: .tsz (app/lib/widget) and .mod.tsz (module)\n", .{});
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
    const lscript_lua = loadLscriptImports(alloc, input_path, source);

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
    // If we found _lscript.tsz imports, set compute_lua so codegen emits LUA_LOGIC
    if (lscript_lua) |lua_src| {
        gen.compute_lua = lua_src;
    }
    const zig_source = gen.generate() catch |err| {
        std.debug.print("[tsz] Compile error: {}\n", .{err});
        gen.printDiagnosticSummary();
        return;
    };
    gen.printDiagnosticSummary();
    if (gen.errors.items.len > 0) return;
    defer alloc.free(zig_source);

    // Resolve tsz root (where build.zig lives) from compiler binary location.
    // Binary can be at:
    //   <repo>/bin/tsz           → go up 1 level, then into tsz/
    //   <repo>/tsz/zig-out/bin/tsz → go up 3 levels
    const tsz_root: ?[]const u8 = blk: {
        var buf: [std.fs.max_path_bytes]u8 = undefined;
        const exe_path = std.fs.selfExePath(&buf) catch break :blk null;
        const bin_dir = std.fs.path.dirname(exe_path) orelse break :blk null;
        const parent = std.fs.path.dirname(bin_dir) orelse break :blk null;

        // Try <parent>/tsz/build.zig (binary at <repo>/bin/tsz)
        const try1 = std.fmt.allocPrint(alloc, "{s}/tsz", .{parent}) catch break :blk null;
        if (std.fs.cwd().access(std.fmt.allocPrint(alloc, "{s}/build.zig", .{try1}) catch break :blk null, .{})) |_| {
            break :blk try1;
        } else |_| {}

        // Try going up 3 levels (binary at <tsz>/zig-out/bin/tsz)
        const grandparent = std.fs.path.dirname(parent) orelse break :blk null;
        break :blk std.fmt.allocPrint(alloc, "{s}", .{grandparent}) catch null;
    };

    // Write output — embedded goes to framework/devtools.zig, normal to generated_app.zig
    // Resolve paths relative to tsz root so the build system can find them.
    const out_path = if (embed_mode)
        if (tsz_root) |root| std.fmt.allocPrint(alloc, "{s}/framework/devtools.zig", .{root}) catch "framework/devtools.zig" else "framework/devtools.zig"
    else if (tsz_root) |root| std.fmt.allocPrint(alloc, "{s}/generated_app.zig", .{root}) catch "generated_app.zig" else "generated_app.zig";
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

    if (web_mode) {
        std.debug.print("[tsz] Building for web (wasm32-emscripten + WebGPU)...\n", .{});
        const web_argv = cachedZigBuildArgv(
            alloc,
            &.{ "zig", "build", "web" },
        ) catch |err| {
            std.debug.print("[tsz] Failed to prepare build args: {}\n", .{err});
            return;
        };
        if (resolveBuildRoot(alloc, tsz_root)) |build_root| ensureZigPackageCacheSeeded(alloc, build_root);
        var web_child = std.process.Child.init(web_argv, alloc);
        if (tsz_root) |root| web_child.cwd = root;
        web_child.stderr_behavior = .Inherit;
        web_child.stdout_behavior = .Inherit;
        const web_term = web_child.spawnAndWait() catch |err| {
            std.debug.print("[tsz] Web build failed to spawn: {}\n", .{err});
            return;
        };
        if (web_term.Exited != 0) {
            std.debug.print("[tsz] Web build failed (exit {d})\n", .{web_term.Exited});
            return;
        }

        // Copy web output to <app-name>-web/ directory next to the source
        const src_dir = std.fs.path.dirname(input_path) orelse ".";
        const web_out_dir = std.fmt.allocPrint(alloc, "{s}/{s}-web", .{ src_dir, app_name }) catch return;
        std.fs.cwd().makePath(web_out_dir) catch {};

        // Copy wasm + js + data from zig-out and web/ to the output dir
        const root_dir = tsz_root orelse ".";
        const files_to_copy = [_][2][]const u8{
            .{ "zig-out/tsz-web.wasm", "tsz-web.wasm" },
            .{ "zig-out/tsz-web.js", "tsz-web.js" },
            .{ "web/index.html", "index.html" },
            .{ "web/font.ttf", "font.ttf" },
            .{ "web/libv86.js", "libv86.js" },
            .{ "web/v86.wasm", "v86.wasm" },
            .{ "web/seabios.bin", "seabios.bin" },
            .{ "web/vgabios.bin", "vgabios.bin" },
            .{ "web/alpine-virt.iso", "alpine-virt.iso" },
        };
        for (files_to_copy) |pair| {
            const src_path = std.fmt.allocPrint(alloc, "{s}/{s}", .{ root_dir, pair[0] }) catch continue;
            const dst_path = std.fmt.allocPrint(alloc, "{s}/{s}", .{ web_out_dir, pair[1] }) catch continue;
            std.fs.cwd().copyFile(src_path, std.fs.cwd(), dst_path, .{}) catch continue;
        }
        // Copy .data file from zig cache
        {
            const data_src = std.fmt.allocPrint(alloc, "{s}/zig-out/tsz-web.data", .{root_dir}) catch "";
            const data_dst = std.fmt.allocPrint(alloc, "{s}/tsz-web.data", .{web_out_dir}) catch "";
            std.fs.cwd().copyFile(data_src, std.fs.cwd(), data_dst, .{}) catch {
                // Try finding it in the cache
            };
        }

        std.debug.print("[tsz] Web bundle: {s}/\n", .{web_out_dir});
        std.debug.print("[tsz] Serve with: tsz serve {s}\n", .{web_out_dir});
        return;
    }

    std.debug.print("[tsz] Building...\n", .{});
    const build_argv = cachedZigBuildArgv(
        alloc,
        &.{ "zig", "build", "--prefix", "zig-out", "-Doptimize=ReleaseFast", app_name_opt, "app" },
    ) catch |err| {
        std.debug.print("[tsz] Failed to prepare build args: {}\n", .{err});
        return;
    };
    if (resolveBuildRoot(alloc, tsz_root)) |build_root| ensureZigPackageCacheSeeded(alloc, build_root);
    var child = std.process.Child.init(build_argv, alloc);
    if (tsz_root) |root| {
        child.cwd = root;
    }
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

    // Package as self-extracting dist binary (replaces raw binary in-place)
    const cli_dist = @import("cli_dist.zig");
    const raw_bin = if (tsz_root) |root|
        std.fmt.allocPrint(alloc, "{s}/zig-out/bin/{s}", .{ root, app_name }) catch return
    else
        std.fmt.allocPrint(alloc, "zig-out/bin/{s}", .{app_name}) catch return;
    cli_dist.packageBinary(alloc, raw_bin, app_name);
    std.debug.print("[tsz] Built -> zig-out/bin/{s}\n", .{app_name});
}

// ── File type classification ────────────────────────────────────

const FileKind = enum {
    app, // .tsz — app entry point
    app_comp, // _c.tsz — app component
    app_cls, // _cls.tsz — app classifiers
    module, // .mod.tsz — runtime module entry point
    mod_comp, // _cmod.tsz — module component
    mod_cls, // _clsmod.tsz — module classifiers
    script, // _script.tsz — JS logic (entry points only)
    zscript, // _zscript.tsz — imperative Zig module (no JSX)
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
    // Catch hallucinated .app.tsz before the generic .tsz match
    if (std.mem.endsWith(u8, path, ".app.tsz")) {
        std.debug.print("\n[tsz] ERROR: '.app.tsz' is not a valid extension. Use '.tsz' instead.\n", .{});
        std.debug.print("[tsz] Rename: {s} → remove the '.app' part\n", .{path});
        return .unknown;
    }
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

const MAX_IMPORTS = 64;

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

    // Strip leading './' from import path to prevent path accumulation (./././file)
    const raw = if (std.mem.startsWith(u8, import_path, "./"))
        import_path[2..]
    else
        import_path;

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
        if (std.mem.endsWith(u8, raw, m.suffix)) {
            const base = raw[0 .. raw.len - m.suffix.len];
            const candidate = std.fmt.allocPrint(alloc, "{s}/{s}{s}", .{ dir, base, m.ext }) catch continue;
            if (std.fs.cwd().access(candidate, .{})) |_| return candidate else |_| {}
        }
    }

    // Try extensions in priority order
    const extensions = [_][]const u8{
        ".tsz",     "_c.tsz",    "_cls.tsz",    "_script.tsz",
        ".mod.tsz", "_cmod.tsz", "_clsmod.tsz",
        ".c.tsz", ".cls.tsz", ".script.tsz", // legacy
    };
    for (extensions) |ext| {
        const candidate = std.fmt.allocPrint(alloc, "{s}/{s}{s}", .{ dir, raw, ext }) catch continue;
        if (std.fs.cwd().access(candidate, .{})) |_| return candidate else |_| {}
    }
    return std.fmt.allocPrint(alloc, "{s}/{s}.tsz", .{ dir, raw }) catch null;
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

/// Load all .lscript.tsz imports and concatenate their contents as LUA_LOGIC.
fn loadLscriptImports(alloc: std.mem.Allocator, input_file: []const u8, source: []const u8) ?[]const u8 {
    var paths: [MAX_IMPORTS][]const u8 = undefined;
    const path_count = findImportPaths(source, &paths);
    var lua_buf: std.ArrayListUnmanaged(u8) = .{};

    for (paths[0..path_count]) |raw_path| {
        const resolved = resolveImportPath(alloc, input_file, raw_path) orelse continue;
        if (!std.mem.endsWith(u8, resolved, ".lscript.tsz")) continue;
        const content = std.fs.cwd().readFileAlloc(alloc, resolved, 1024 * 1024) catch continue;
        lua_buf.appendSlice(alloc, content) catch continue;
        lua_buf.append(alloc, '\n') catch {};
    }

    if (lua_buf.items.len == 0) return null;
    return lua_buf.items;
}

// ── Lint subcommand ─────────────────────────────────────────────
//
// tsz lint [--strict] <file.tsz>
//
// Standalone lint pass — no codegen. Outputs parseable diagnostics to stderr:
//   [tsz] file:line:col: level: message

fn runLint(alloc: std.mem.Allocator, args: []const []const u8) void {
    var strict_mode = false;
    var input_idx: usize = 2;
    while (input_idx < args.len) {
        if (std.mem.eql(u8, args[input_idx], "--strict")) {
            strict_mode = true;
            input_idx += 1;
        } else break;
    }
    if (input_idx >= args.len) {
        std.debug.print("Usage: tsz lint [--strict] <file.tsz>\n", .{});
        return;
    }

    const input_path = args[input_idx];
    const source = std.fs.cwd().readFileAlloc(alloc, input_path, 4 * 1024 * 1024) catch |err| {
        std.debug.print("[tsz] {s}:0:0: error: cannot read file: {}\n", .{ std.fs.path.basename(input_path), err });
        std.process.exit(1);
    };

    // Resolve imports so we lint the full merged source
    const final_source = buildMergedSource(alloc, input_path, source);

    var lex = lexer_mod.Lexer.init(final_source);
    lex.tokenize();

    var linter = lint.Linter.init(alloc, &lex, final_source);
    const result = linter.run();

    const basename = std.fs.path.basename(input_path);
    var error_count: u32 = 0;
    for (result.diagnostics) |d| {
        const level_str: []const u8 = switch (d.level) {
            .err => "error",
            .warn => "warning",
            .hint => "hint",
        };
        std.debug.print("[tsz] {s}:{d}:{d}: {s}: {s}\n", .{ basename, d.line, d.col, level_str, d.message });
        if (d.level == .err) error_count += 1;
        if (strict_mode and d.level == .warn) error_count += 1;
    }

    if (result.diagnostics.len == 0) {
        std.debug.print("[tsz] {s}: OK (0 issues)\n", .{basename});
    } else {
        std.debug.print("[tsz] {s}: {d} error(s), {d} warning(s), {d} hint(s)\n", .{
            basename, result.error_count, result.warning_count, result.hint_count,
        });
    }

    if (error_count > 0) std.process.exit(1);
}

// ── Setup editor ────────────────────────────────────────────────
//
// tsz setup-editor
//
// Installs the VSCode extension for .tsz file support.

fn runSetupEditor(_: std.mem.Allocator) void {
    // Check if code is on PATH
    const code_result = std.process.Child.run(.{
        .allocator = std.heap.page_allocator,
        .argv = &.{ "which", "code" },
    }) catch {
        std.debug.print("[tsz] VSCode (code) not found on PATH. Install VSCode first.\n", .{});
        return;
    };
    if (code_result.term.Exited != 0) {
        std.debug.print("[tsz] VSCode (code) not found on PATH. Install VSCode first.\n", .{});
        return;
    }

    // Look for .vsix in editor/vscode/
    const vsix_paths = [_][]const u8{
        "editor/vscode/tsz.vsix",
        "editor/vscode/tsz-0.1.0.vsix",
        "../editor/vscode/tsz.vsix",
        "../editor/vscode/tsz-0.1.0.vsix",
    };
    var found_vsix: ?[]const u8 = null;
    for (vsix_paths) |p| {
        if (std.fs.cwd().access(p, .{})) |_| {
            found_vsix = p;
            break;
        } else |_| {}
    }

    if (found_vsix) |vsix| {
        std.debug.print("[tsz] Installing VSCode extension from {s}...\n", .{vsix});
        const install_result = std.process.Child.run(.{
            .allocator = std.heap.page_allocator,
            .argv = &.{ "code", "--install-extension", vsix },
        }) catch |err| {
            std.debug.print("[tsz] Failed to run code --install-extension: {}\n", .{err});
            return;
        };
        if (install_result.term.Exited == 0) {
            std.debug.print("[tsz] VSCode extension installed successfully.\n", .{});
        } else {
            std.debug.print("[tsz] Extension install failed (exit {d}).\n", .{install_result.term.Exited});
        }
    } else {
        std.debug.print("[tsz] No .vsix found. Expected at editor/vscode/tsz*.vsix\n", .{});
        std.debug.print("[tsz] Build it first: cd editor/vscode && npx vsce package\n", .{});
    }
}

// ── Preflight check / check ─────────────────────────────────────
//
// tsz check [--strict] <file.tsz>
// tsz preflight [--strict] <file.tsz>
//
// Runs the full compilation pipeline (lex → lint → codegen phases 1-9)
// but discards the output. Reports structured PREFLIGHT: lines to stderr
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
    const lscript_lua_chk = if (file_kind != .module) loadLscriptImports(alloc, input_path, source) else null;

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
    if (lscript_lua_chk) |lua_src| gen.compute_lua = lua_src;

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
    {
        const lscript_lua_test = loadLscriptImports(alloc, input_path, source);
        if (lscript_lua_test) |lua_src| gen.compute_lua = lua_src;
    }
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
    const build_argv = cachedZigBuildArgv(
        alloc,
        &.{ "zig", "build", "--build-file", "build.zig", "--prefix", "zig-out", "-Doptimize=ReleaseFast", app_name_opt, "app" },
    ) catch |err| {
        std.debug.print("[test] Failed to prepare build args: {}\n", .{err});
        return;
    };
    if (resolveBuildRoot(alloc, null)) |build_root| ensureZigPackageCacheSeeded(alloc, build_root);
    var build_child = std.process.Child.init(build_argv, alloc);
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

// ── Dev mode: hot-reload development server ──────────────────────────────
// tsz dev <app.tsz>
//
// Compiles the app as a shared library, builds the dev shell (once), and
// launches it. Watches for source changes and recompiles the .so — the
// running shell auto-detects changes and hot-reloads.

fn runDev(alloc: std.mem.Allocator, args: []const []const u8) void {
    runDevWithUsage(alloc, args, 2, "tsz dev");
}

fn runDevWithUsage(
    alloc: std.mem.Allocator,
    args: []const []const u8,
    start_idx: usize,
    usage_name: []const u8,
) void {
    // Check if argument is a directory with carts.json (manifest mode)
    if (start_idx < args.len) {
        const arg = args[start_idx];
        // Check for carts.json directly, or directory containing carts.json
        const manifest_path: ?[]const u8 = blk: {
            if (std.mem.endsWith(u8, arg, "carts.json")) {
                if (std.fs.cwd().access(arg, .{})) |_| break :blk arg else |_| {}
            }
            // Check if arg is a directory containing carts.json
            const try_path = std.fmt.allocPrint(alloc, "{s}/carts.json", .{arg}) catch break :blk null;
            if (std.fs.cwd().access(try_path, .{})) |_| break :blk try_path else |_| {}
            break :blk null;
        };
        if (manifest_path) |_| {
            // TODO: runDevManifest not yet implemented
            std.debug.print("[dev] carts.json manifest mode not yet implemented\n", .{});
            return;
        }
    }

    const input_path = resolveDevInputPath(alloc, args, start_idx, usage_name);
    if (input_path == null) {
        return;
    }
    const resolved_input_path = input_path.?;

    // Resolve tsz root
    const tsz_root: ?[]const u8 = blk: {
        var buf: [std.fs.max_path_bytes]u8 = undefined;
        const exe_path = std.fs.selfExePath(&buf) catch break :blk null;
        const bin_dir = std.fs.path.dirname(exe_path) orelse break :blk null;
        const parent = std.fs.path.dirname(bin_dir) orelse break :blk null;
        const try1 = std.fmt.allocPrint(alloc, "{s}/tsz", .{parent}) catch break :blk null;
        if (std.fs.cwd().access(std.fmt.allocPrint(alloc, "{s}/build.zig", .{try1}) catch break :blk null, .{})) |_| {
            break :blk try1;
        } else |_| {}
        const grandparent = std.fs.path.dirname(parent) orelse break :blk null;
        break :blk std.fmt.allocPrint(alloc, "{s}", .{grandparent}) catch null;
    };

    // Step 1: Compile .tsz → generated_app.zig
    if (!devCompileTsz(alloc, resolved_input_path, tsz_root)) return;

    // Step 2: Build the .so
    const basename = std.fs.path.basename(resolved_input_path);
    const dot_pos = std.mem.lastIndexOfScalar(u8, basename, '.') orelse basename.len;
    const app_name = basename[0..dot_pos];
    const app_name_opt = std.fmt.allocPrint(alloc, "-Dapp-name={s}", .{app_name}) catch return;

    std.debug.print("[dev] Building shared library...\n", .{});
    if (!devRunZigBuild(alloc, tsz_root, &.{ "zig", "build", "-Doptimize=ReleaseFast", app_name_opt, "app-lib" })) return;

    // Step 3: Build the dev shell (first time only — cached after that)
    const shell_path = if (tsz_root) |root|
        std.fmt.allocPrint(alloc, "{s}/zig-out/bin/tsz-dev", .{root}) catch return
    else
        "zig-out/bin/tsz-dev";

    if (std.fs.cwd().access(shell_path, .{})) |_| {
        std.debug.print("[dev] Dev shell already built\n", .{});
    } else |_| {
        std.debug.print("[dev] Building dev shell (first time, may take a while)...\n", .{});
        if (!devRunZigBuild(alloc, tsz_root, &.{ "zig", "build", "dev-shell" })) return;
    }

    // Step 4: Resolve .so path
    const lib_name = std.fmt.allocPrint(alloc, "{s}-lib", .{app_name}) catch return;
    const so_path = if (tsz_root) |root|
        std.fmt.allocPrint(alloc, "{s}/zig-out/lib/lib{s}.so", .{ root, lib_name }) catch return
    else
        std.fmt.allocPrint(alloc, "zig-out/lib/lib{s}.so", .{lib_name}) catch return;

    // Step 5: Try to register with a running dev shell via HTTP
    const abs_so = std.fs.cwd().realpathAlloc(alloc, so_path) catch so_path;

    var owns_shell = false;
    var shell_pid: std.posix.pid_t = 0;

    if (devRegisterViaHttp(alloc, abs_so)) {
        // Shell is running, we just registered
    } else {
        // No shell running — launch one
        std.debug.print("[dev] Launching: {s} {s}\n", .{ shell_path, abs_so });

        var shell_child = std.process.Child.init(&.{ shell_path, abs_so }, alloc);
        shell_child.stderr_behavior = .Inherit;
        shell_child.stdout_behavior = .Inherit;
        _ = shell_child.spawn() catch |err| {
            std.debug.print("[dev] Failed to launch dev shell: {}\n", .{err});
            return;
        };
        shell_pid = @intCast(shell_child.id);
        owns_shell = true;

        if (std.fs.createFileAbsolute("/tmp/tsz-dev.pid", .{})) |f| {
            const pid_str = std.fmt.allocPrint(alloc, "{d}", .{shell_pid}) catch "";
            f.writeAll(pid_str) catch {};
            f.close();
        } else |_| {}
    }

    std.debug.print("[dev] Watching {s} for changes...\n", .{resolved_input_path});

    // Step 6: Watch loop — poll .tsz files for changes, rebuild .so
    const watch_dir = std.fs.path.dirname(resolved_input_path) orelse ".";
    var last_max_mtime: i128 = getMaxMtime(alloc, watch_dir);

    while (true) {
        std.Thread.sleep(500 * std.time.ns_per_ms);

        // If we own the shell, check if it exited
        if (owns_shell) {
            const wr = std.posix.waitpid(shell_pid, 1); // WNOHANG = 1
            if (wr.pid != 0) {
                std.debug.print("[dev] Shell exited\n", .{});
                std.fs.deleteFileAbsolute("/tmp/tsz-dev.pid") catch {};
                break;
            }
        }

        const current_max = getMaxMtime(alloc, watch_dir);
        if (current_max == last_max_mtime) continue;
        last_max_mtime = current_max;

        std.debug.print("[dev] Change detected, recompiling...\n", .{});

        if (!devCompileTsz(alloc, resolved_input_path, tsz_root)) {
            std.debug.print("[dev] Compile failed — keeping last working build\n", .{});
            continue;
        }

        if (!devRunZigBuild(alloc, tsz_root, &.{ "zig", "build", "-Doptimize=ReleaseFast", app_name_opt, "app-lib" })) {
            std.debug.print("[dev] .so build failed — keeping last working build\n", .{});
            continue;
        }

        std.debug.print("[dev] Rebuilt .so — shell will auto-reload\n", .{});
    }
}

/// `tsz pack <output.pack> <file1.so> [file2.so] ...`
/// `tsz pack <output.pack> <directory/>`  — packs all .so files in the directory
fn runPack(alloc: std.mem.Allocator, args: []const []const u8) void {
    if (args.len < 4) {
        std.debug.print("Usage: tsz pack <output.pack> <file.so|dir/> [file2.so] ...\n", .{});
        std.debug.print("\nBundle multiple .so cartridges into a single .pack file.\n", .{});
        return;
    }

    const out_path = args[2];

    // Collect .so paths — if arg is a directory, scan it for .so files
    var so_paths: [64][]const u8 = undefined;
    var so_names: [64][]const u8 = undefined;
    var so_count: usize = 0;

    for (args[3..]) |arg| {
        // Check if directory
        if (std.fs.cwd().openDir(arg, .{ .iterate = true })) |dir_val| {
            var dir = dir_val;
            var iter = dir.iterate();
            while (iter.next() catch null) |entry| {
                if (entry.kind != .file) continue;
                if (!std.mem.endsWith(u8, entry.name, ".so")) continue;
                if (so_count >= 64) break;
                const full = std.fmt.allocPrint(alloc, "{s}/{s}", .{ arg, entry.name }) catch continue;
                so_paths[so_count] = full;
                // Name = basename without lib prefix and -lib.so suffix
                var name = entry.name;
                if (std.mem.startsWith(u8, name, "lib")) name = name[3..];
                if (std.mem.endsWith(u8, name, "-lib.so")) {
                    so_names[so_count] = std.fmt.allocPrint(alloc, "{s}", .{name[0 .. name.len - 7]}) catch name;
                } else if (std.mem.endsWith(u8, name, ".so")) {
                    so_names[so_count] = std.fmt.allocPrint(alloc, "{s}", .{name[0 .. name.len - 3]}) catch name;
                } else {
                    so_names[so_count] = std.fmt.allocPrint(alloc, "{s}", .{name}) catch name;
                }
                so_count += 1;
            }
            dir.close();
        } else |_| {
            // It's a file path
            if (so_count >= 64) continue;
            so_paths[so_count] = arg;
            var name = std.fs.path.basename(arg);
            if (std.mem.startsWith(u8, name, "lib")) name = name[3..];
            if (std.mem.endsWith(u8, name, "-lib.so")) {
                so_names[so_count] = std.fmt.allocPrint(alloc, "{s}", .{name[0 .. name.len - 7]}) catch name;
            } else if (std.mem.endsWith(u8, name, ".so")) {
                so_names[so_count] = std.fmt.allocPrint(alloc, "{s}", .{name[0 .. name.len - 3]}) catch name;
            } else {
                so_names[so_count] = name;
            }
            so_count += 1;
        }
    }

    if (so_count == 0) {
        std.debug.print("[pack] No .so files found\n", .{});
        return;
    }

    // Create the pack file
    const MAGIC = "CART";
    const NAME_LEN = 64;
    const ENTRY_SIZE = NAME_LEN + 8 + 8;
    const HEADER_SIZE = 4 + 4;

    // Measure sizes
    var sizes: [64]u64 = undefined;
    for (0..so_count) |i| {
        const stat = std.fs.cwd().statFile(so_paths[i]) catch {
            std.debug.print("[pack] Can't stat {s}\n", .{so_paths[i]});
            return;
        };
        sizes[i] = stat.size;
    }

    // Compute offsets
    const toc_size: u64 = @as(u64, @intCast(so_count)) * ENTRY_SIZE;
    const data_start: u64 = HEADER_SIZE + toc_size;
    var offsets: [64]u64 = undefined;
    var cursor: u64 = data_start;
    for (0..so_count) |i| {
        offsets[i] = cursor;
        cursor += sizes[i];
    }

    // Write
    const file = std.fs.cwd().createFile(out_path, .{}) catch {
        std.debug.print("[pack] Can't create {s}\n", .{out_path});
        return;
    };
    defer file.close();

    file.writeAll(MAGIC) catch return;
    var count_buf: [4]u8 = undefined;
    std.mem.writeInt(u32, &count_buf, @intCast(so_count), .little);
    file.writeAll(&count_buf) catch return;

    for (0..so_count) |i| {
        var ebuf: [ENTRY_SIZE]u8 = [_]u8{0} ** ENTRY_SIZE;
        const nl = @min(so_names[i].len, NAME_LEN);
        @memcpy(ebuf[0..nl], so_names[i][0..nl]);
        std.mem.writeInt(u64, ebuf[NAME_LEN..][0..8], offsets[i], .little);
        std.mem.writeInt(u64, ebuf[NAME_LEN + 8 ..][0..8], sizes[i], .little);
        file.writeAll(&ebuf) catch return;
    }

    for (0..so_count) |i| {
        const src = std.fs.cwd().openFile(so_paths[i], .{}) catch continue;
        defer src.close();
        var buf: [65536]u8 = undefined;
        while (true) {
            const n = src.read(&buf) catch break;
            if (n == 0) break;
            file.writeAll(buf[0..n]) catch break;
        }
    }

    // Summary
    const total_mb = @as(f32, @floatFromInt(cursor)) / (1024.0 * 1024.0);
    std.debug.print("[pack] Created {s} — {d} cartridge(s), {d:.1} MB\n", .{ out_path, so_count, total_mb });
    for (0..so_count) |i| {
        const mb = @as(f32, @floatFromInt(sizes[i])) / (1024.0 * 1024.0);
        std.debug.print("[pack]   {s} ({d:.1} MB)\n", .{ so_names[i], mb });
    }
}

fn runCommand(alloc: std.mem.Allocator, args: []const []const u8) void {
    if (args.len < 3) {
        std.debug.print("Usage: tsz run dev [file.tsz]\n", .{});
        return;
    }

    const subcmd = args[2];
    if (std.mem.eql(u8, subcmd, "dev")) {
        runDevWithUsage(alloc, args, 3, "tsz run dev");
        return;
    }

    std.debug.print("Usage: tsz run dev [file.tsz]\n", .{});
}

fn resolveDevInputPath(
    alloc: std.mem.Allocator,
    args: []const []const u8,
    start_idx: usize,
    usage_name: []const u8,
) ?[]const u8 {
    var idx = start_idx;
    while (idx < args.len) : (idx += 1) {
        const arg = args[idx];
        if (arg.len > 0 and arg[0] == '-') {
            std.debug.print("Usage: {s} [file.tsz]\n", .{usage_name});
            return null;
        }
        return arg;
    }
    return inferAppEntryFromCwd(alloc, usage_name);
}

fn inferAppEntryFromCwd(alloc: std.mem.Allocator, usage_name: []const u8) ?[]const u8 {
    var dir = std.fs.cwd().openDir(".", .{ .iterate = true }) catch |err| {
        std.debug.print("[tsz] Failed to inspect current directory: {}\n", .{err});
        return null;
    };
    defer dir.close();

    const cwd_real = std.fs.cwd().realpathAlloc(alloc, ".") catch ".";
    const cwd_name = std.fs.path.basename(cwd_real);

    const preferred_names = [_][]const u8{
        tryAllocPrint(alloc, "{s}.app.tsz", .{cwd_name}) orelse "",
        tryAllocPrint(alloc, "{s}.tsz", .{cwd_name}) orelse "",
        "main.app.tsz",
        "main.tsz",
        "app.app.tsz",
        "app.tsz",
        "index.app.tsz",
        "index.tsz",
    };

    var candidates: std.ArrayListUnmanaged([]const u8) = .{};
    defer candidates.deinit(alloc);

    var it = dir.iterate();
    while (it.next() catch null) |entry| {
        if (entry.kind != .file) continue;
        if (classifyFile(entry.name) != .app) continue;
        const owned_name = alloc.dupe(u8, entry.name) catch return null;
        candidates.append(alloc, owned_name) catch return null;
    }

    if (candidates.items.len == 0) {
        std.debug.print("[tsz] No app entry found in the current directory.\n", .{});
        std.debug.print("Usage: {s} [file.tsz]\n", .{usage_name});
        return null;
    }

    for (preferred_names) |preferred| {
        if (preferred.len == 0) continue;
        for (candidates.items) |candidate| {
            if (std.mem.eql(u8, candidate, preferred)) return candidate;
        }
    }

    if (candidates.items.len == 1) return candidates.items[0];

    std.debug.print("[tsz] Multiple app entries found in the current directory. Pass one explicitly:\n", .{});
    for (candidates.items) |candidate| {
        std.debug.print("  {s}\n", .{candidate});
    }
    std.debug.print("Usage: {s} [file.tsz]\n", .{usage_name});
    return null;
}

fn tryAllocPrint(alloc: std.mem.Allocator, comptime fmt: []const u8, args: anytype) ?[]const u8 {
    return std.fmt.allocPrint(alloc, fmt, args) catch null;
}

fn devCompileTsz(alloc: std.mem.Allocator, input_path: []const u8, tsz_root: ?[]const u8) bool {
    const source = std.fs.cwd().readFileAlloc(alloc, input_path, 4 * 1024 * 1024) catch |err| {
        std.debug.print("[dev] Error reading {s}: {any}\n", .{ input_path, err });
        return false;
    };

    // Resolve imports
    const final_source = buildMergedSource(alloc, input_path, source);
    var lex = lexer_mod.Lexer.init(final_source);
    lex.tokenize();

    var gen = codegen.Generator.init(alloc, &lex, final_source, input_path);
    const script_js = loadScriptImports(alloc, input_path, source);
    if (script_js) |js| gen.compute_js = js;
    const lscript_lua_dev = loadLscriptImports(alloc, input_path, source);
    if (lscript_lua_dev) |lua_src| gen.compute_lua = lua_src;

    const zig_source = gen.generate() catch |err| {
        std.debug.print("[dev] Compile error: {}\n", .{err});
        gen.printDiagnosticSummary();
        return false;
    };
    gen.printDiagnosticSummary();
    if (gen.errors.items.len > 0) return false;

    const out_path = if (tsz_root) |root|
        std.fmt.allocPrint(alloc, "{s}/generated_app.zig", .{root}) catch return false
    else
        "generated_app.zig";

    const f = std.fs.cwd().createFile(out_path, .{}) catch |err| {
        std.debug.print("[dev] Error creating {s}: {any}\n", .{ out_path, err });
        return false;
    };
    defer f.close();
    f.writeAll(zig_source) catch return false;

    std.debug.print("[dev] Compiled {s} -> {s}\n", .{ std.fs.path.basename(input_path), out_path });
    return true;
}

fn devRunZigBuild(alloc: std.mem.Allocator, tsz_root: ?[]const u8, argv: []const []const u8) bool {
    const build_argv = cachedZigBuildArgv(alloc, argv) catch |err| {
        std.debug.print("[dev] Failed to prepare build args: {}\n", .{err});
        return false;
    };
    if (resolveBuildRoot(alloc, tsz_root)) |build_root| ensureZigPackageCacheSeeded(alloc, build_root);
    var child = std.process.Child.init(build_argv, alloc);
    if (tsz_root) |root| child.cwd = root;
    child.stderr_behavior = .Inherit;
    child.stdout_behavior = .Inherit;
    const term = child.spawnAndWait() catch |err| {
        std.debug.print("[dev] Build failed to spawn: {}\n", .{err});
        return false;
    };
    if (term.Exited != 0) {
        std.debug.print("[dev] Build failed (exit {d})\n", .{term.Exited});
        return false;
    }
    return true;
}

/// Scan a directory for all .tsz files and return the maximum mtime.
/// Used by the dev watcher to detect changes in any imported file.
/// Try to register a .so with a running dev shell via HTTP POST to localhost:7778/load.
/// Returns true if the shell accepted it, false if no shell is reachable.
fn devRegisterViaHttp(alloc: std.mem.Allocator, so_abs_path: []const u8) bool {
    const addr = std.net.Address.parseIp4("127.0.0.1", 7778) catch return false;
    const sock = std.posix.socket(std.posix.AF.INET, std.posix.SOCK.STREAM, 0) catch return false;
    defer std.posix.close(sock);

    std.posix.connect(sock, &addr.any, addr.getOsSockLen()) catch return false;

    // Send HTTP POST
    var req_buf: [1024]u8 = undefined;
    const req = std.fmt.bufPrint(&req_buf, "POST /load HTTP/1.1\r\nHost: 127.0.0.1:7778\r\nContent-Length: {d}\r\nConnection: close\r\n\r\n{s}", .{ so_abs_path.len, so_abs_path }) catch return false;
    _ = std.posix.write(sock, req) catch return false;

    // Read response
    var resp_buf: [512]u8 = undefined;
    const n = std.posix.read(sock, &resp_buf) catch return false;
    if (n == 0) return false;
    const resp = resp_buf[0..n];

    // Check for 200
    if (std.mem.startsWith(u8, resp, "HTTP/1.1 200")) {
        // Print the JSON body
        if (std.mem.indexOf(u8, resp, "\r\n\r\n")) |body_start| {
            const body = resp[body_start + 4 ..];
            _ = alloc;
            std.debug.print("[dev] Shell accepted: {s}", .{body});
        } else {
            std.debug.print("[dev] Shell accepted cartridge\n", .{});
        }
        return true;
    }

    std.debug.print("[dev] Shell rejected: {s}\n", .{resp});
    return false;
}

fn getMaxMtime(alloc: std.mem.Allocator, dir_path: []const u8) i128 {
    _ = alloc;
    var max: i128 = 0;
    var dir = std.fs.cwd().openDir(dir_path, .{ .iterate = true }) catch return 0;
    defer dir.close();
    var it = dir.iterate();
    while (it.next() catch null) |entry| {
        if (entry.kind == .file and std.mem.endsWith(u8, entry.name, ".tsz")) {
            // Build full path for stat
            var path_buf: [1024]u8 = undefined;
            const full = std.fmt.bufPrint(&path_buf, "{s}/{s}", .{ dir_path, entry.name }) catch continue;
            const stat = std.fs.cwd().statFile(full) catch continue;
            if (stat.mtime > max) max = stat.mtime;
        }
    }
    return max;
}
