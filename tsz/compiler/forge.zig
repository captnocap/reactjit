//! Forge — the Zig kernel that hosts Smith (JS compiler intelligence).
//!
//! Usage: forge build <file.tsz>
//!
//! 1. Reads .tsz source
//! 2. Resolves imports recursively (components merged into source, cls/script separated)
//! 3. Lexes merged source into tokens (fast, Zig)
//! 4. Passes tokens + source to Smith via QuickJS
//! 5. Smith returns complete .zig source
//! 6. Writes .zig file

const std = @import("std");
const lexer_mod = @import("lexer.zig");
const Lexer = lexer_mod.Lexer;
const smith = @import("smith_bridge.zig");

// Smith JS source — generated bundle from compiler/smith_LOAD_ORDER.txt
const SMITH_JS = @embedFile("dist/smith.bundle.js");

const MAX_IMPORTS = 64;
const Alloc = std.heap.page_allocator;

const FileClass = enum { component, classifier, script, unknown };

fn classifyFile(path: []const u8) FileClass {
    if (std.mem.endsWith(u8, path, "_cls.tsz") or std.mem.endsWith(u8, path, ".cls.tsz") or
        std.mem.endsWith(u8, path, "_clsmod.tsz") or std.mem.endsWith(u8, path, ".clsmod.tsz") or
        std.mem.endsWith(u8, path, ".effects.tsz") or std.mem.endsWith(u8, path, "_effects.tsz") or
        std.mem.endsWith(u8, path, ".glyphs.tsz") or std.mem.endsWith(u8, path, "_glyphs.tsz") or
        std.mem.endsWith(u8, path, ".tcls.tsz") or std.mem.endsWith(u8, path, "_tcls.tsz") or
        std.mem.endsWith(u8, path, ".vcls.tsz") or std.mem.endsWith(u8, path, "_vcls.tsz"))
        return .classifier;
    if (std.mem.endsWith(u8, path, ".script.tsz") or std.mem.endsWith(u8, path, "_script.tsz"))
        return .script;
    if (std.mem.endsWith(u8, path, "_c.tsz") or std.mem.endsWith(u8, path, ".c.tsz") or
        std.mem.endsWith(u8, path, "_cmod.tsz") or std.mem.endsWith(u8, path, ".cmod.tsz"))
        return .component;
    return .unknown;
}

fn resolveImportPath(importer: []const u8, raw_import: []const u8) ?[]const u8 {
    const dir = std.fs.path.dirname(importer) orelse ".";

    // Strip leading './' to prevent path accumulation
    const raw = if (std.mem.startsWith(u8, raw_import, "./"))
        raw_import[2..]
    else
        raw_import;

    // Suffix map — explicit suffix in import path → resolve directly
    // Cross-convention: _cls imports also try .cls.tsz files (and vice versa)
    const suffix_map = [_]struct { suffix: []const u8, ext: []const u8 }{
        .{ .suffix = "_cls", .ext = "_cls.tsz" },
        .{ .suffix = "_cls", .ext = ".cls.tsz" },
        .{ .suffix = "_clsmod", .ext = "_clsmod.tsz" },
        .{ .suffix = "_clsmod", .ext = ".clsmod.tsz" },
        .{ .suffix = "_c", .ext = "_c.tsz" },
        .{ .suffix = "_c", .ext = ".c.tsz" },
        .{ .suffix = "_cmod", .ext = "_cmod.tsz" },
        .{ .suffix = "_cmod", .ext = ".cmod.tsz" },
        .{ .suffix = "_script", .ext = "_script.tsz" },
        .{ .suffix = "_script", .ext = ".script.tsz" },
        .{ .suffix = "_effects", .ext = "_effects.tsz" },
        .{ .suffix = "_effects", .ext = ".effects.tsz" },
        .{ .suffix = "_glyphs", .ext = "_glyphs.tsz" },
        .{ .suffix = "_glyphs", .ext = ".glyphs.tsz" },
        .{ .suffix = "_tcls", .ext = "_tcls.tsz" },
        .{ .suffix = "_tcls", .ext = ".tcls.tsz" },
        .{ .suffix = "_vcls", .ext = "_vcls.tsz" },
        .{ .suffix = "_vcls", .ext = ".vcls.tsz" },
        .{ .suffix = ".cls", .ext = ".cls.tsz" },
        .{ .suffix = ".c", .ext = ".c.tsz" },
        .{ .suffix = ".script", .ext = ".script.tsz" },
        .{ .suffix = ".effects", .ext = ".effects.tsz" },
        .{ .suffix = ".glyphs", .ext = ".glyphs.tsz" },
        .{ .suffix = ".tcls", .ext = ".tcls.tsz" },
        .{ .suffix = ".vcls", .ext = ".vcls.tsz" },
    };
    for (suffix_map) |m| {
        if (std.mem.endsWith(u8, raw, m.suffix)) {
            const base = raw[0 .. raw.len - m.suffix.len];
            const candidate = std.fmt.allocPrint(Alloc, "{s}/{s}{s}", .{ dir, base, m.ext }) catch continue;
            if (std.fs.cwd().access(candidate, .{})) |_| return candidate else |_| {}
        }
    }

    // Try extensions in priority order
    const extensions = [_][]const u8{
        ".tsz",      "_c.tsz",     "_cls.tsz",    "_script.tsz",
        ".mod.tsz",  "_cmod.tsz",  "_clsmod.tsz",
        ".c.tsz",    ".cls.tsz",   ".script.tsz",
    };
    for (extensions) |ext| {
        const candidate = std.fmt.allocPrint(Alloc, "{s}/{s}{s}", .{ dir, raw, ext }) catch continue;
        if (std.fs.cwd().access(candidate, .{})) |_| return candidate else |_| {}
    }
    return std.fmt.allocPrint(Alloc, "{s}/{s}.tsz", .{ dir, raw }) catch null;
}

fn findImportPaths(source: []const u8, paths_out: *[MAX_IMPORTS][]const u8) u32 {
    var count: u32 = 0;
    var i: usize = 0;
    while (i < source.len and count < MAX_IMPORTS) {
        // Look for: from "..." or from '...'
        if (i + 6 < source.len and
            source[i] == 'f' and source[i + 1] == 'r' and
            source[i + 2] == 'o' and source[i + 3] == 'm' and
            source[i + 4] == ' ')
        {
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

/// Strip `function App() { ... }` test stubs from component files.
/// Component files often have a standalone App() for testing. When merged into
/// a larger app, these stubs confuse the parser (multiple App definitions,
/// orphaned JSX tokens). Returns a slice of source up to the App stub.
fn stripAppStub(source: []const u8) []const u8 {
    // Find "function App()" — scan for the pattern
    var i: usize = 0;
    while (i + 14 < source.len) : (i += 1) {
        if (source[i] == 'f' and
            std.mem.startsWith(u8, source[i..], "function App("))
        {
            // Check it's at start of line (preceded by newline or start of file)
            if (i == 0 or source[i - 1] == '\n') {
                // Return everything before this function definition
                return source[0..i];
            }
        }
    }
    return source;
}

/// Recursively resolve imports. Component sources are merged into component_buf
/// (depth-first, so dependencies come before dependents). Classifiers and scripts
/// are accumulated separately.
fn mergeImports(
    file_path: []const u8,
    source: []const u8,
    visited: *[MAX_IMPORTS][]const u8,
    visited_count: *u32,
    component_buf: *std.ArrayListUnmanaged(u8),
    cls_buf: *std.ArrayListUnmanaged(u8),
    script_buf: *std.ArrayListUnmanaged(u8),
) void {
    // Cycle check
    for (visited.*[0..visited_count.*]) |v| {
        if (std.mem.eql(u8, v, file_path)) return;
    }
    if (visited_count.* >= MAX_IMPORTS) return;
    visited.*[visited_count.*] = file_path;
    visited_count.* += 1;

    // Find import paths in this file
    var paths: [MAX_IMPORTS][]const u8 = undefined;
    const path_count = findImportPaths(source, &paths);

    std.debug.print("[forge:merge] {s} class={s} imports={d}\n", .{ file_path, @tagName(classifyFile(file_path)), path_count });

    for (paths[0..path_count]) |raw_path| {
        const resolved = resolveImportPath(file_path, raw_path) orelse {
            std.debug.print("[forge:merge]   UNRESOLVED: {s}\n", .{raw_path});
            continue;
        };
        const imp_source = std.fs.cwd().readFileAlloc(Alloc, resolved, 1024 * 1024) catch continue;
        const class = classifyFile(resolved);

        switch (class) {
            .classifier => {
                // Recursively resolve imports from classifier files (e.g. .cls imports .tcls)
                mergeImports(resolved, imp_source, visited, visited_count, component_buf, cls_buf, script_buf);
                cls_buf.appendSlice(Alloc, imp_source) catch {};
                cls_buf.append(Alloc, '\n') catch {};
            },
            .script => {
                script_buf.appendSlice(Alloc, imp_source) catch {};
                script_buf.append(Alloc, '\n') catch {};
            },
            .component, .unknown => {
                // Recursively resolve this file's imports first (depth-first)
                mergeImports(resolved, imp_source, visited, visited_count, component_buf, cls_buf, script_buf);
            },
        }
    }

    // Append this file's source to component_buf (after its deps)
    // For component files, strip `function App() { ... }` test stubs that would
    // pollute the merged source and confuse the App-finding logic in Smith.
    const this_class = classifyFile(file_path);
    if (this_class == .component) {
        // Strip function App() test stubs from component files only
        const stripped = stripAppStub(source);
        component_buf.appendSlice(Alloc, stripped) catch {};
        component_buf.append(Alloc, '\n') catch {};
    } else if (this_class == .unknown) {
        // Main entry file — keep function App() intact
        component_buf.appendSlice(Alloc, source) catch {};
        component_buf.append(Alloc, '\n') catch {};
    }
}

pub fn main() !void {
    var args = std.process.args();
    _ = args.next(); // skip argv[0]

    const cmd = args.next() orelse {
        std.debug.print("Usage: forge build <file.tsz>\n", .{});
        return;
    };

    if (!std.mem.eql(u8, cmd, "build")) {
        std.debug.print("Unknown command: {s}\nUsage: forge build <file.tsz>\n", .{cmd});
        return;
    }

    // Parse optional flags before the file path
    var fast_build = false;
    var mod_build = false;
    var mod_target: []const u8 = "zig"; // zig, lua, js
    var split_output = false;
    var single_output = false;
    var strict_mode = false;
    var logs_enabled = false;
    var logs_find: ?[]const u8 = null;
    var out_dir: []const u8 = "/tmp/tsz-gen";
    var input_path: []const u8 = undefined;
    var got_path = false;
    while (args.next()) |arg| {
        if (std.mem.eql(u8, arg, "--fast")) {
            fast_build = true;
        } else if (std.mem.eql(u8, arg, "--mod")) {
            mod_build = true;
        } else if (std.mem.startsWith(u8, arg, "--target=")) {
            mod_target = arg["--target=".len..];
        } else if (std.mem.startsWith(u8, arg, "--out-dir=")) {
            out_dir = arg["--out-dir=".len..];
        } else if (std.mem.eql(u8, arg, "--split")) {
            split_output = true;
        } else if (std.mem.eql(u8, arg, "--single")) {
            single_output = true;
        } else if (std.mem.eql(u8, arg, "--strict")) {
            strict_mode = true;
        } else if (std.mem.eql(u8, arg, "--logs")) {
            logs_enabled = true;
        } else if (std.mem.startsWith(u8, arg, "--logs=find:")) {
            logs_find = arg["--logs=find:".len..];
        } else {
            input_path = arg;
            got_path = true;
            break;
        }
    }
    if (!got_path) {
        std.debug.print("Usage: forge build [--fast] [--mod] <file.tsz>\n", .{});
        return;
    }

    // 1. Read source file
    const source = std.fs.cwd().readFileAlloc(Alloc, input_path, 10 * 1024 * 1024) catch |err| {
        std.debug.print("[forge] Cannot read '{s}': {}\n", .{ input_path, err });
        return;
    };

    // 1b. Recursively resolve all imports
    var visited: [MAX_IMPORTS][]const u8 = undefined;
    var visited_count: u32 = 0;
    var component_buf: std.ArrayListUnmanaged(u8) = .{};
    var cls_buf: std.ArrayListUnmanaged(u8) = .{};
    var script_buf: std.ArrayListUnmanaged(u8) = .{};

    mergeImports(input_path, source, &visited, &visited_count, &component_buf, &cls_buf, &script_buf);

    // Build merged source: component deps first, then main app source
    // (mergeImports already added the main source to component_buf via the recursive call)
    const merged_source = if (component_buf.items.len > 0) component_buf.items else source;

    // 2. Lex the merged source
    var lexer = Lexer.init(merged_source);
    lexer.tokenize();
    std.debug.print("[forge] Lexed {d} tokens from {s}", .{ lexer.count, input_path });
    if (visited_count > 1) std.debug.print(" (+{d} imports)", .{visited_count - 1});
    std.debug.print("\n", .{});

    // 3. Init Smith (QuickJS)
    smith.init();
    defer smith.deinit();

    // 4. Pass data to Smith
    smith.setGlobalString("__source", merged_source);
    smith.setGlobalString("__file", input_path);
    if (script_buf.items.len > 0) smith.setGlobalString("__scriptContent", script_buf.items);
    if (cls_buf.items.len > 0) smith.setGlobalString("__clsContent", cls_buf.items);
    smith.setGlobalInt("__fastBuild", if (fast_build) 1 else 0);
    smith.setGlobalInt("__modBuild", if (mod_build) 1 else 0);
    if (mod_build) smith.setGlobalString("__modTarget", mod_target);
    // Split output is default unless --single is passed
    if (!single_output and !mod_build) smith.setGlobalInt("__splitOutput", 1);
    if (split_output) smith.setGlobalInt("__splitOutput", 1);
    if (strict_mode) smith.setGlobalInt("__strict", 1);
    if (logs_enabled) smith.setGlobalInt("__SMITH_LOGS", 1);
    if (logs_find) |query| smith.setGlobalString("__SMITH_LOGS_FIND", query);

    // Build token kind array as u8 slice for the bridge
    const kinds = Alloc.alloc(u8, lexer.count) catch return;
    const starts = Alloc.alloc(u32, lexer.count) catch return;
    const ends = Alloc.alloc(u32, lexer.count) catch return;
    for (0..lexer.count) |i| {
        const tok = lexer.get(@intCast(i));
        kinds[i] = @intFromEnum(tok.kind);
        starts[i] = tok.start;
        ends[i] = tok.end;
    }
    smith.setTokenData(kinds, starts, ends, lexer.count);

    // 5. Load Smith JS
    if (!smith.loadModule(SMITH_JS, "compiler/dist/smith.bundle.js")) {
        std.debug.print("[forge] Failed to load Smith\n", .{});
        return;
    }

    // 6. Call compile()
    const zig_output = smith.callCompile(Alloc) orelse {
        std.debug.print("[forge] Smith compile() failed\n", .{});
        return;
    };

    // 7. Extract stem for output path, ensure out_dir exists
    const basename = std.fs.path.basename(input_path);
    const dot_pos = std.mem.lastIndexOfScalar(u8, basename, '.') orelse basename.len;
    const stem = basename[0..dot_pos];

    std.fs.cwd().makePath(out_dir) catch |err| {
        std.debug.print("[forge] Cannot create out-dir '{s}': {}\n", .{ out_dir, err });
        return;
    };

    // 8. Detect split output and write accordingly
    const split_marker = "__SPLIT_OUTPUT__\n";
    if (zig_output.len > split_marker.len and std.mem.startsWith(u8, zig_output, split_marker)) {
        // ── Split output: create directory with per-concern files ──
        const dir_path = std.fmt.allocPrint(Alloc, "{s}/generated_{s}", .{ out_dir, stem }) catch return;
        std.fs.cwd().makePath(dir_path) catch |err| {
            std.debug.print("[forge] Cannot create dir '{s}': {}\n", .{ dir_path, err });
            return;
        };

        // Create framework symlink so @import("framework/...") resolves
        const fw_link = std.fmt.allocPrint(Alloc, "{s}/framework", .{dir_path}) catch return;
        // Remove existing symlink/file first (ignore errors)
        std.fs.cwd().deleteFile(fw_link) catch {};
        // Use absolute path — output dir may be outside the repo (e.g. /tmp)
        const fw_abs = std.fs.cwd().realpathAlloc(Alloc, "framework") catch |err| {
            std.debug.print("[forge] Cannot resolve framework path: {}\n", .{err});
            return;
        };
        std.fs.cwd().symLink(fw_abs, fw_link, .{}) catch |err| {
            std.debug.print("[forge] Cannot create framework symlink: {}\n", .{err});
        };

        const content = zig_output[split_marker.len..];
        const file_marker = "__FILE:";
        const marker_end = "__\n";
        var total_bytes: usize = 0;
        var file_count: u32 = 0;

        var pos: usize = 0;
        while (pos < content.len) {
            // Find __FILE:name.zig__\n
            if (!std.mem.startsWith(u8, content[pos..], file_marker)) {
                pos += 1;
                continue;
            }
            const name_start = pos + file_marker.len;
            const name_end_rel = std.mem.indexOf(u8, content[name_start..], marker_end) orelse break;
            const fname = content[name_start .. name_start + name_end_rel];
            const data_start = name_start + name_end_rel + marker_end.len;

            // Find end (next __FILE: or end of content)
            const next_file = std.mem.indexOf(u8, content[data_start..], file_marker);
            const data_end = if (next_file) |nf| data_start + nf else content.len;
            const file_data = content[data_start..data_end];

            // Write file
            const file_path = std.fmt.allocPrint(Alloc, "{s}/{s}", .{ dir_path, fname }) catch continue;
            const f = std.fs.cwd().createFile(file_path, .{}) catch |err| {
                std.debug.print("[forge] Cannot write '{s}': {}\n", .{ file_path, err });
                pos = data_end;
                continue;
            };
            f.writeAll(file_data) catch {};
            f.close();
            total_bytes += file_data.len;
            file_count += 1;
            pos = data_end;
        }

        // Also write the monolith as generated_X.zig for backward-compat lint
        // (not needed for compilation — just for scripts/build lint checks)

        std.debug.print("[forge] Wrote {d} files ({d} bytes) to {s}/\n", .{ file_count, total_bytes, dir_path });
    } else {
        // ── Single file output (legacy / --single) ──
        // Create framework symlink in output dir so @import("framework/...") resolves
        const mono_fw_link = std.fmt.allocPrint(Alloc, "{s}/framework", .{out_dir}) catch return;
        std.fs.cwd().access(mono_fw_link, .{}) catch {
            const mono_fw_abs = std.fs.cwd().realpathAlloc(Alloc, "framework") catch null;
            if (mono_fw_abs) |abs| std.fs.cwd().symLink(abs, mono_fw_link, .{}) catch {};
        };
        // Compute body hash and patch BODYHASH placeholder
        var body_start: usize = 0;
        var newline_count: u8 = 0;
        for (zig_output, 0..) |ch, idx| {
            if (ch == '\n') {
                newline_count += 1;
                if (newline_count == 2) { body_start = idx + 1; break; }
            }
        }
        const body2 = if (body_start < zig_output.len) zig_output[body_start..] else zig_output;
        var hash: [32]u8 = undefined;
        std.crypto.hash.sha2.Sha256.hash(body2, &hash, .{});
        var hash_hex: [16]u8 = undefined;
        const hex_chars = "0123456789abcdef";
        for (0..8) |i| {
            hash_hex[i * 2] = hex_chars[hash[i] >> 4];
            hash_hex[i * 2 + 1] = hex_chars[hash[i] & 0xf];
        }
        const final_output = std.mem.replaceOwned(u8, Alloc, zig_output, "BODYHASH", &hash_hex) catch zig_output;

        const ext = if (mod_build and std.mem.eql(u8, mod_target, "lua")) ".lua" else if (mod_build and std.mem.eql(u8, mod_target, "js")) ".js" else ".zig";
        const out_path = std.fmt.allocPrint(Alloc, "{s}/generated_{s}{s}", .{ out_dir, stem, ext }) catch return;
        const out_file = std.fs.cwd().createFile(out_path, .{}) catch |err| {
            std.debug.print("[forge] Cannot write '{s}': {}\n", .{ out_path, err });
            return;
        };
        defer out_file.close();
        out_file.writeAll(final_output) catch |err| {
            std.debug.print("[forge] Write error: {}\n", .{err});
            return;
        };

        std.debug.print("[forge] Wrote {d} bytes to {s}\n", .{ final_output.len, out_path });
    }
}
