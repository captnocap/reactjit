//! Forge — the Zig kernel that hosts Smith (JS compiler intelligence).
//!
//! Usage: forge build <file.tsz>
//!
//! 1. Reads .tsz source
//! 2. Lexes into tokens (fast, Zig)
//! 3. Passes tokens + source to Smith via QuickJS
//! 4. Smith returns complete .zig source
//! 5. Writes .zig file
//! 6. Invokes zig build to produce the binary

const std = @import("std");
const lexer_mod = @import("lexer.zig");
const Lexer = lexer_mod.Lexer;
const smith = @import("smith_bridge.zig");

// Smith JS source — embedded at compile time, concatenated in load order
const SMITH_JS = @embedFile("smith/rules.js") ++ "\n" ++
    @embedFile("smith/index.js") ++ "\n" ++
    @embedFile("smith/attrs.js") ++ "\n" ++
    @embedFile("smith/parse.js") ++ "\n" ++
    @embedFile("smith/emit.js");

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
    var input_path: []const u8 = undefined;
    var got_path = false;
    while (args.next()) |arg| {
        if (std.mem.eql(u8, arg, "--fast")) {
            fast_build = true;
        } else if (std.mem.eql(u8, arg, "--mod")) {
            mod_build = true;
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
    const source = std.fs.cwd().readFileAlloc(std.heap.page_allocator, input_path, 10 * 1024 * 1024) catch |err| {
        std.debug.print("[forge] Cannot read '{s}': {}\n", .{ input_path, err });
        return;
    };

    // 1b. Resolve imports — scan all from "..." imports, route .cls to __clsContent
    var script_content: ?[]const u8 = null;
    var cls_content: ?[]const u8 = null;
    const input_dir = std.fs.path.dirname(input_path) orelse ".";
    {
        var search_start: usize = 0;
        while (std.mem.indexOfPos(u8, source, search_start, "from \"./")) |from_pos| {
            const path_start = from_pos + 6; // skip 'from "'
            if (std.mem.indexOfScalarPos(u8, source, path_start, '"')) |path_end| {
                const import_rel = source[path_start..path_end];
                const import_path = std.fmt.allocPrint(std.heap.page_allocator, "{s}/{s}.tsz", .{ input_dir, import_rel }) catch null;
                if (import_path) |ip| {
                    const content = std.fs.cwd().readFileAlloc(std.heap.page_allocator, ip, 1024 * 1024) catch null;
                    if (content) |cnt| {
                        if (std.mem.endsWith(u8, import_rel, ".cls")) {
                            cls_content = cnt;
                        } else {
                            script_content = cnt;
                        }
                    }
                }
                search_start = path_end + 1;
            } else break;
        }
    }

    // 2. Lex
    var lexer = Lexer.init(source);
    lexer.tokenize();
    std.debug.print("[forge] Lexed {d} tokens from {s}\n", .{ lexer.count, input_path });

    // 3. Init Smith (QuickJS)
    smith.init();
    defer smith.deinit();

    // 4. Pass data to Smith
    smith.setGlobalString("__source", source);
    smith.setGlobalString("__file", input_path);
    if (script_content) |sc| smith.setGlobalString("__scriptContent", sc);
    if (cls_content) |cc| smith.setGlobalString("__clsContent", cc);
    smith.setGlobalInt("__fastBuild", if (fast_build) 1 else 0);
    smith.setGlobalInt("__modBuild", if (mod_build) 1 else 0);

    // Build token kind array as u8 slice for the bridge
    const kinds = std.heap.page_allocator.alloc(u8, lexer.count) catch return;
    const starts = std.heap.page_allocator.alloc(u32, lexer.count) catch return;
    const ends = std.heap.page_allocator.alloc(u32, lexer.count) catch return;
    for (0..lexer.count) |i| {
        const tok = lexer.get(@intCast(i));
        kinds[i] = @intFromEnum(tok.kind);
        starts[i] = tok.start;
        ends[i] = tok.end;
    }
    smith.setTokenData(kinds, starts, ends, lexer.count);

    // 5. Load Smith JS
    if (!smith.loadModule(SMITH_JS, "smith/index.js")) {
        std.debug.print("[forge] Failed to load Smith\n", .{});
        return;
    }

    // 6. Call compile()
    const zig_output = smith.callCompile(std.heap.page_allocator) orelse {
        std.debug.print("[forge] Smith compile() failed\n", .{});
        return;
    };

    // 7. Compute body hash and patch BODYHASH placeholder
    // Strip integrity header lines to hash just the body
    var body_start: usize = 0;
    var newline_count: u8 = 0;
    for (zig_output, 0..) |ch, idx| {
        if (ch == '\n') {
            newline_count += 1;
            if (newline_count == 2) { body_start = idx + 1; break; }
        }
    }
    const body = if (body_start < zig_output.len) zig_output[body_start..] else zig_output;
    var hash: [32]u8 = undefined;
    std.crypto.hash.sha2.Sha256.hash(body, &hash, .{});
    var hash_hex: [16]u8 = undefined;
    const hex_chars = "0123456789abcdef";
    for (0..8) |i| {
        hash_hex[i * 2] = hex_chars[hash[i] >> 4];
        hash_hex[i * 2 + 1] = hex_chars[hash[i] & 0xf];
    }
    // Replace BODYHASH placeholder in output
    const final_output = std.mem.replaceOwned(u8, std.heap.page_allocator, zig_output, "BODYHASH", &hash_hex) catch zig_output;

    // 8. Write output .zig file
    const basename = std.fs.path.basename(input_path);
    const dot_pos = std.mem.lastIndexOfScalar(u8, basename, '.') orelse basename.len;
    const stem = basename[0..dot_pos];

    const out_path = std.fmt.allocPrint(std.heap.page_allocator, "generated_{s}.zig", .{stem}) catch return;
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

    // 8. TODO: invoke zig build to compile the .zig into a binary
    // For now, just print what would happen
    std.debug.print("[forge] Next: zig build-exe {s} (not yet wired)\n", .{out_path});
}
