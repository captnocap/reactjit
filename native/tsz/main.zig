//! tsz compiler — TypeScript-like syntax to native binary
//!
//! Reads .tsz files and produces Zig source code, then builds via zig build.
//! No Node.js. No npm. No TypeScript package. Just Zig all the way down.
//!
//! Usage:
//!   tsz build <file.tsz>
//!   tsz run <file.tsz>

const std = @import("std");
const lexer = @import("lexer.zig");
const codegen = @import("codegen.zig");

pub fn main() !void {
    var gpa = std.heap.GeneralPurposeAllocator(.{}){};
    defer _ = gpa.deinit();
    const alloc = gpa.allocator();

    const args = try std.process.argsAlloc(alloc);
    defer std.process.argsFree(alloc, args);

    if (args.len < 3) {
        std.debug.print("Usage: tsz build <file.tsz>\n       tsz run <file.tsz>\n", .{});
        std.process.exit(1);
    }

    const command = args[1];
    const input_file = args[2];

    // Read source file
    const source = std.fs.cwd().readFileAlloc(alloc, input_file, 1024 * 1024) catch |err| {
        std.debug.print("[tsz] Failed to read {s}: {}\n", .{ input_file, err });
        std.process.exit(1);
    };
    defer alloc.free(source);

    // Tokenize
    var lex = lexer.Lexer.init(source);
    lex.tokenize();

    // Generate Zig source
    var gen = codegen.Generator.init(alloc, &lex, source, input_file);
    const zig_source = gen.generate() catch |err| {
        std.debug.print("[tsz] Compile error: {}\n", .{err});
        std.process.exit(1);
    };
    defer alloc.free(zig_source);

    // Find repo root (go up from the binary or use cwd)
    // Write to native/engine/generated_app.zig relative to cwd
    const out_path = "native/engine/generated_app.zig";
    const out_file = std.fs.cwd().createFile(out_path, .{}) catch |err| {
        std.debug.print("[tsz] Failed to write {s}: {}\n", .{ out_path, err });
        std.process.exit(1);
    };
    defer out_file.close();
    out_file.writeAll(zig_source) catch |err| {
        std.debug.print("[tsz] Write error: {}\n", .{err});
        std.process.exit(1);
    };

    // Write ffi_libs.txt
    const libs_path = "native/engine/ffi_libs.txt";
    const libs_file = std.fs.cwd().createFile(libs_path, .{}) catch |err| {
        std.debug.print("[tsz] Failed to write {s}: {}\n", .{ libs_path, err });
        std.process.exit(1);
    };
    defer libs_file.close();
    for (gen.ffi_libs.items) |lib| {
        libs_file.writeAll(lib) catch {};
        libs_file.writeAll("\n") catch {};
    }

    const basename = std.fs.path.basename(input_file);
    std.debug.print("[tsz] Compiled {s} → generated_app.zig\n", .{basename});
    if (gen.ffi_libs.items.len > 0) {
        std.debug.print("[tsz] FFI libs:", .{});
        for (gen.ffi_libs.items) |lib| std.debug.print(" {s}", .{lib});
        std.debug.print("\n", .{});
    }

    // Build with zig
    const build_result = std.process.Child.run(.{
        .allocator = alloc,
        .argv = &.{ "zig", "build", "engine-app" },
    }) catch |err| {
        std.debug.print("[tsz] Build failed to start: {}\n", .{err});
        std.process.exit(1);
    };
    defer alloc.free(build_result.stdout);
    defer alloc.free(build_result.stderr);

    if (build_result.term.Exited != 0) {
        std.debug.print("[tsz] Build failed:\n{s}\n", .{build_result.stderr});
        std.process.exit(1);
    }
    std.debug.print("[tsz] Built → zig-out/bin/tsz-app\n", .{});

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
