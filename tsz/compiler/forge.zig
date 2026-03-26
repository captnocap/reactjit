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

    const input_path = args.next() orelse {
        std.debug.print("Usage: forge build <file.tsz>\n", .{});
        return;
    };

    // 1. Read source file
    const source = std.fs.cwd().readFileAlloc(std.heap.page_allocator, input_path, 10 * 1024 * 1024) catch |err| {
        std.debug.print("[forge] Cannot read '{s}': {}\n", .{ input_path, err });
        return;
    };

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

    // 7. Write output .zig file
    const basename = std.fs.path.basename(input_path);
    const dot_pos = std.mem.lastIndexOfScalar(u8, basename, '.') orelse basename.len;
    const stem = basename[0..dot_pos];

    const out_path = std.fmt.allocPrint(std.heap.page_allocator, "generated_{s}.zig", .{stem}) catch return;
    const out_file = std.fs.cwd().createFile(out_path, .{}) catch |err| {
        std.debug.print("[forge] Cannot write '{s}': {}\n", .{ out_path, err });
        return;
    };
    defer out_file.close();
    out_file.writeAll(zig_output) catch |err| {
        std.debug.print("[forge] Write error: {}\n", .{err});
        return;
    };

    std.debug.print("[forge] Wrote {d} bytes to {s}\n", .{ zig_output.len, out_path });

    // 8. TODO: invoke zig build to compile the .zig into a binary
    // For now, just print what would happen
    std.debug.print("[forge] Next: zig build-exe {s} (not yet wired)\n", .{out_path});
}
