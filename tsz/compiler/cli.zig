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

pub fn main() !void {
    var arena = std.heap.ArenaAllocator.init(std.heap.page_allocator);
    defer arena.deinit();
    const alloc = arena.allocator();

    const args = try std.process.argsAlloc(alloc);
    defer std.process.argsFree(alloc, args);

    // Subcommand routing
    if (args.len >= 2) {
        const cmd = args[1];
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
    }

    if (args.len < 3) {
        std.debug.print("Usage: tsz build|dev|check|lint|test|init|convert|setup-editor [--strict] <file.tsz>\n", .{});
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
    // If the file also has an App function, route through the app path instead —
    // <zscript> blocks will be treated as JS for QuickJS by the codegen.
    if (file_kind == .zscript and std.mem.indexOf(u8, source, "function App()") == null) {
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
    else
        if (tsz_root) |root| std.fmt.allocPrint(alloc, "{s}/generated_app.zig", .{root}) catch "generated_app.zig" else "generated_app.zig";
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
        &.{ "zig", "build", "--prefix", "zig-out", "-Doptimize=ReleaseFast", app_name_opt, "app" },
        alloc,
    );
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
        ".tsz",     "_c.tsz",      "_cls.tsz",    "_script.tsz",
        ".mod.tsz", "_cmod.tsz",   "_clsmod.tsz",
        ".c.tsz",   ".cls.tsz",    ".script.tsz", // legacy
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

// ── Dev mode: hot-reload development server ──────────────────────────────
// tsz dev <app.tsz>
//
// Compiles the app as a shared library, builds the dev shell (once), and
// launches it. Watches for source changes and recompiles the .so — the
// running shell auto-detects changes and hot-reloads.

fn runDev(alloc: std.mem.Allocator, args: []const []const u8) void {
    if (args.len < 3) {
        std.debug.print("Usage: tsz dev <file.tsz>\n", .{});
        return;
    }

    // Find the input file (last non-flag argument)
    const input_path = args[args.len - 1];

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
    if (!devCompileTsz(alloc, input_path, tsz_root)) return;

    // Step 2: Build the .so
    const basename = std.fs.path.basename(input_path);
    const dot_pos = std.mem.lastIndexOfScalar(u8, basename, '.') orelse basename.len;
    const app_name = basename[0..dot_pos];
    const app_name_opt = std.fmt.allocPrint(alloc, "-Dapp-name={s}", .{app_name}) catch return;

    std.debug.print("[dev] Building shared library...\n", .{});
    if (!devRunZigBuild(alloc, tsz_root, &.{ "zig", "build", app_name_opt, "app-lib" })) return;

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

    // Step 5: Check if a dev shell is already running (PID file)
    const pid_path = "/tmp/tsz-dev.pid";
    const existing_pid = blk: {
        const pid_file = std.fs.openFileAbsolute(pid_path, .{}) catch break :blk null;
        defer pid_file.close();
        var pid_buf: [32]u8 = undefined;
        const n = pid_file.read(&pid_buf) catch break :blk null;
        if (n == 0) break :blk null;
        const pid_str = std.mem.trimRight(u8, pid_buf[0..n], &.{ '\n', '\r', ' ', 0 });
        break :blk std.fmt.parseInt(std.posix.pid_t, pid_str, 10) catch null;
    };

    if (existing_pid) |pid| {
        // Check if process is still alive (signal 0 = just check, no actual signal sent)
        if (std.posix.kill(pid, 0)) {
            // Shell is still running — just rebuild, it'll hot-reload
            std.debug.print("[dev] Dev shell already running (pid {d}) — rebuilt .so, it will auto-reload\n", .{pid});
            return;
        } else |_| {
            // Process not found or no permission — stale PID file, launch new shell
        }
    }

    std.debug.print("[dev] Launching: {s} {s}\n", .{ shell_path, so_path });
    std.debug.print("[dev] Watching {s} for changes...\n", .{input_path});

    // Launch dev shell as a child process
    var shell_child = std.process.Child.init(&.{ shell_path, so_path }, alloc);
    shell_child.stderr_behavior = .Inherit;
    shell_child.stdout_behavior = .Inherit;
    _ = shell_child.spawn() catch |err| {
        std.debug.print("[dev] Failed to launch dev shell: {}\n", .{err});
        return;
    };
    const shell_pid = shell_child.id;

    // Write PID file so other sessions know a shell is running
    if (std.fs.createFileAbsolute(pid_path, .{})) |f| {
        const pid_str = std.fmt.allocPrint(alloc, "{d}", .{shell_pid}) catch "";
        f.writeAll(pid_str) catch {};
        f.close();
    } else |_| {}

    // Step 6: Watch loop — poll all .tsz files in the cart directory for changes
    const watch_dir = std.fs.path.dirname(input_path) orelse ".";
    var last_max_mtime: i128 = getMaxMtime(alloc, watch_dir);

    while (true) {
        std.Thread.sleep(500 * std.time.ns_per_ms);

        // Check if shell process exited (non-blocking waitpid with WNOHANG)
        const wr = std.posix.waitpid(@intCast(shell_pid), 1); // WNOHANG = 1
        if (wr.pid != 0) {
            std.debug.print("[dev] Shell exited\n", .{});
            std.fs.deleteFileAbsolute("/tmp/tsz-dev.pid") catch {};
            break;
        }

        // Check max mtime across all .tsz files in the directory
        const current_max = getMaxMtime(alloc, watch_dir);
        if (current_max == last_max_mtime) continue;
        last_max_mtime = current_max;

        std.debug.print("[dev] Change detected, recompiling...\n", .{});

        // Recompile .tsz → generated_app.zig
        if (!devCompileTsz(alloc, input_path, tsz_root)) {
            std.debug.print("[dev] Compile failed — keeping last working build\n", .{});
            continue;
        }

        // Rebuild .so
        if (!devRunZigBuild(alloc, tsz_root, &.{ "zig", "build", app_name_opt, "app-lib" })) {
            std.debug.print("[dev] .so build failed — keeping last working build\n", .{});
            continue;
        }

        std.debug.print("[dev] Rebuilt .so — shell will auto-reload\n", .{});
    }
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
    var child = std.process.Child.init(argv, alloc);
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
