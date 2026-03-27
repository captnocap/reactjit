//! cli_dist.zig — self-extracting binary packaging for tsz apps.
//!
//! Produces a single file that runs on any x86_64 Linux with zero
//! dependencies. Bundles the compiled app binary, all shared libraries
//! (including glibc and ld-linux), into a self-extracting archive.
//!
//! Same technique as Steam Runtime / AppImage / the Love2D dist builder.

const std = @import("std");

/// Package an already-compiled binary into a self-extracting dist binary.
/// Replaces the binary at `bin_path` in-place with the packaged version.
pub fn packageBinary(alloc: std.mem.Allocator, bin_path: []const u8, app_name: []const u8) void {
    const bin_real = std.fs.cwd().realpathAlloc(alloc, bin_path) catch {
        std.debug.print("[tsz] Packaging: binary not found at {s}\n", .{bin_path});
        return;
    };

    std.debug.print("[tsz] Packaging {s}...\n", .{app_name});

    const tmp_dir = std.fmt.allocPrint(alloc, "/tmp/tsz-dist-{s}", .{app_name}) catch return;
    const lib_dir = std.fmt.allocPrint(alloc, "{s}/lib", .{tmp_dir}) catch return;

    // Clean and create staging dirs
    shellExec(alloc, &.{ "rm", "-rf", tmp_dir });
    shellExec(alloc, &.{ "mkdir", "-p", lib_dir });

    // Copy the app binary
    const staged_bin = std.fmt.allocPrint(alloc, "{s}/app.bin", .{tmp_dir}) catch return;
    shellExec(alloc, &.{ "cp", bin_real, staged_bin });

    // ldd the binary and copy all shared libs
    const ldd_result = shellCapture(alloc, &.{ "ldd", bin_real });
    if (ldd_result) |ldd_output| {
        var lines = std.mem.splitScalar(u8, ldd_output, '\n');
        var lib_count: u32 = 0;
        while (lines.next()) |line| {
            if (std.mem.indexOf(u8, line, "linux-vdso") != null) continue;

            const arrow = std.mem.indexOf(u8, line, " => ") orelse continue;
            const after_arrow = line[arrow + 4 ..];
            const space = std.mem.indexOfScalar(u8, after_arrow, ' ') orelse continue;
            const lib_path = std.mem.trim(u8, after_arrow[0..space], " \t");
            if (lib_path.len == 0 or lib_path[0] != '/') continue;

            const real_path = shellCapture(alloc, &.{ "readlink", "-f", lib_path });
            if (real_path) |rp| {
                const trimmed = std.mem.trim(u8, rp, " \t\n");
                const soname = std.mem.trim(u8, line[0..arrow], " \t");
                const dest = std.fmt.allocPrint(alloc, "{s}/{s}", .{ lib_dir, soname }) catch continue;
                shellExec(alloc, &.{ "cp", trimmed, dest });
                lib_count += 1;
            }
        }
        std.debug.print("[tsz] Bundled {d} shared libraries\n", .{lib_count});
    }

    // Bundle ld-linux
    const ld_linux = shellCapture(alloc, &.{ "readlink", "-f", "/lib64/ld-linux-x86-64.so.2" });
    if (ld_linux) |ld_path| {
        const trimmed = std.mem.trim(u8, ld_path, " \t\n");
        const dest = std.fmt.allocPrint(alloc, "{s}/ld-linux-x86-64.so.2", .{lib_dir}) catch return;
        shellExec(alloc, &.{ "cp", trimmed, dest });
    } else {
        std.debug.print("[tsz] Warning: could not find ld-linux — binary will not be portable\n", .{});
        return;
    }

    // Create launcher script
    const launcher =
        "#!/bin/sh\n" ++
        "DIR=\"$(cd \"$(dirname \"$0\")\" && pwd)\"\n" ++
        "exec \"$DIR/lib/ld-linux-x86-64.so.2\" --inhibit-cache --library-path \"$DIR/lib\" \"$DIR/app.bin\" \"$@\"\n";
    {
        const run_path = std.fmt.allocPrint(alloc, "{s}/run", .{tmp_dir}) catch return;
        const f = std.fs.cwd().createFile(run_path, .{ .mode = 0o755 }) catch return;
        f.writeAll(launcher) catch {};
        f.close();
    }

    // Pack into self-extracting binary
    const tarball = std.fmt.allocPrint(alloc, "/tmp/tsz-{s}-payload.tar.gz", .{app_name}) catch return;
    shellExec(alloc, &.{
        "sh", "-c",
        std.fmt.allocPrint(alloc, "cd \"{s}\" && tar czf \"{s}\" .", .{ tmp_dir, tarball }) catch return,
    });

    const header = std.fmt.allocPrint(alloc,
        "#!/bin/sh\n" ++
        "set -e\n" ++
        "APP_DIR=${{XDG_CACHE_HOME:-$HOME/.cache}}/tsz-{s}\n" ++
        "SIG=$(md5sum \"$0\" 2>/dev/null | cut -c1-8 || cksum \"$0\" | cut -d\" \" -f1)\n" ++
        "CACHE=\"$APP_DIR/$SIG\"\n" ++
        "if [ ! -f \"$CACHE/.ready\" ]; then\n" ++
        "  rm -rf \"$APP_DIR\"\n" ++
        "  mkdir -p \"$CACHE\"\n" ++
        "  SKIP=$(awk '/^__ARCHIVE__$/{{print NR + 1; exit}}' \"$0\")\n" ++
        "  tail -n+\"$SKIP\" \"$0\" | tar xz -C \"$CACHE\"\n" ++
        "  touch \"$CACHE/.ready\"\n" ++
        "fi\n" ++
        "exec \"$CACHE/run\" \"$@\"\n" ++
        "__ARCHIVE__\n",
        .{app_name},
    ) catch return;

    // Write self-extracting binary, replacing the original raw binary in-place
    {
        const out_file = std.fs.cwd().createFile(bin_real, .{ .mode = 0o755 }) catch {
            std.debug.print("[tsz] Error: could not write dist binary\n", .{});
            return;
        };
        defer out_file.close();

        out_file.writeAll(header) catch return;

        const tar_file = std.fs.cwd().openFile(tarball, .{}) catch return;
        defer tar_file.close();

        var buf: [65536]u8 = undefined;
        while (true) {
            const n = tar_file.read(&buf) catch break;
            if (n == 0) break;
            out_file.writeAll(buf[0..n]) catch break;
        }
    }

    // Get file size
    const stat = std.fs.cwd().statFile(bin_real) catch {
        std.debug.print("[tsz] Packaged → {s}\n", .{bin_path});
        shellExec(alloc, &.{ "rm", "-rf", tmp_dir });
        shellExec(alloc, &.{ "rm", "-f", tarball });
        return;
    };
    const size_mb = @as(f64, @floatFromInt(stat.size)) / (1024.0 * 1024.0);

    // Cleanup
    shellExec(alloc, &.{ "rm", "-rf", tmp_dir });
    shellExec(alloc, &.{ "rm", "-f", tarball });

    std.debug.print("[tsz] Packaged {d:.1} MB → {s}\n", .{ size_mb, bin_path });
}

/// Standalone `tsz dist <file.tsz>` command — compiles then packages.
pub fn run(alloc: std.mem.Allocator, args: []const []const u8) void {
    if (args.len < 3) {
        std.debug.print("Usage: tsz dist <file.tsz>\n", .{});
        return;
    }

    const input = args[2];
    const basename = std.fs.path.basename(input);
    const dot_pos = std.mem.lastIndexOfScalar(u8, basename, '.') orelse basename.len;
    const app_name = basename[0..dot_pos];

    // Compile first (this will also call packageBinary at the end)
    const self_path = std.fs.selfExePathAlloc(alloc) catch {
        std.debug.print("Error: could not determine self path\n", .{});
        return;
    };
    var compile = std.process.Child.init(
        &.{ self_path, "build", input },
        alloc,
    );
    compile.stderr_behavior = .Inherit;
    compile.stdout_behavior = .Inherit;
    const compile_term = compile.spawnAndWait() catch {
        std.debug.print("Error: failed to spawn compiler\n", .{});
        return;
    };
    if (compile_term.Exited != 0) {
        std.debug.print("Compilation failed.\n", .{});
        return;
    }
    _ = app_name;
}

// ── Helpers ──────────────────────────────────────────────────────

fn shellExec(alloc: std.mem.Allocator, argv: []const []const u8) void {
    var child = std.process.Child.init(argv, alloc);
    child.stderr_behavior = .Pipe;
    child.stdout_behavior = .Pipe;
    _ = child.spawnAndWait() catch {};
}

fn shellCapture(alloc: std.mem.Allocator, argv: []const []const u8) ?[]const u8 {
    const result = std.process.Child.run(.{
        .allocator = alloc,
        .argv = argv,
    }) catch return null;
    if (result.stdout.len == 0) return null;
    return result.stdout;
}
