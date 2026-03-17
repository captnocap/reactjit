//! Stripped-down TSZ compiler for ZigOS experiment
//! Only: compile-runtime <file.tsz> [--output <dir>]

const std = @import("std");
const codegen = @import("codegen.zig");
const lexer_mod = @import("lexer.zig");

pub fn main() !void {
    var gpa = std.heap.GeneralPurposeAllocator(.{}){};
    defer _ = gpa.deinit();
    const alloc = gpa.allocator();

    const args = try std.process.argsAlloc(alloc);
    defer std.process.argsFree(alloc, args);

    if (args.len < 3) {
        std.debug.print("Usage: zigos-compiler compile-runtime <file.tsz> [--output <dir>]\n", .{});
        return;
    }

    const input_path = args[2];
    var output_dir: []const u8 = ".";
    var i: usize = 3;
    while (i < args.len) : (i += 1) {
        if ((std.mem.eql(u8, args[i], "--output") or std.mem.eql(u8, args[i], "-o")) and i + 1 < args.len) {
            output_dir = args[i + 1];
            i += 1;
        }
    }

    const source = std.fs.cwd().readFileAlloc(alloc, input_path, 4 * 1024 * 1024) catch |err| {
        std.debug.print("Error reading {s}: {any}\n", .{ input_path, err });
        return;
    };
    defer alloc.free(source);

    // Always JSX codegen for .tsz → runtime fragment
    var lex = lexer_mod.Lexer.init(source);
    lex.tokenize();
    var gen = codegen.Generator.init(alloc, &lex, source, input_path);
    gen.mode = .runtime_fragment;
    const zig_source = gen.generate() catch |err| {
        std.debug.print("Compile error: {}\n", .{err});
        return;
    };
    defer alloc.free(zig_source);

    // Output path: lowercase stem + .gen.zig
    const basename = std.fs.path.basename(input_path);
    const stem = std.fs.path.stem(basename);
    var name_buf: [256]u8 = undefined;
    var nl: usize = 0;
    for (stem) |ch| {
        if (nl >= name_buf.len - 1) break;
        name_buf[nl] = if (ch >= 'A' and ch <= 'Z') ch + 32 else if (ch == '-') '_' else ch;
        nl += 1;
    }

    std.fs.cwd().makePath(output_dir) catch {};
    const out_path = std.fmt.allocPrint(alloc, "{s}/{s}.gen.zig", .{ output_dir, name_buf[0..nl] }) catch return;
    defer alloc.free(out_path);

    const f = std.fs.cwd().createFile(out_path, .{}) catch |err| {
        std.debug.print("Error creating {s}: {any}\n", .{ out_path, err });
        return;
    };
    defer f.close();
    f.writeAll(zig_source) catch return;
    std.debug.print("[zigos-compiler] {s} -> {s}\n", .{ input_path, out_path });
}
