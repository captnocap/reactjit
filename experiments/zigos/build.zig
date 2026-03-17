//! ZigOS — isolated experiment build
//!
//! Build:  cd experiments/zigos && zig build
//! Run:    cd experiments/zigos && zig build run
//! Or:     cd experiments/zigos && ./zig-out/bin/zigos-shell [path/to/app.js]

const std = @import("std");

pub fn build(b: *std.Build) void {
    const target = b.standardTargetOptions(.{});
    const optimize = b.standardOptimizeOption(.{});
    const os = target.result.os.tag;

    const exe = b.addExecutable(.{
        .name = "zigos-shell",
        .root_module = b.createModule(.{
            .root_source_file = b.path("main.zig"),
            .target = target,
            .optimize = optimize,
        }),
    });

    // QuickJS — statically compiled in
    exe.root_module.addIncludePath(b.path("../../love2d/quickjs"));
    exe.root_module.addCSourceFiles(.{
        .root = b.path("../../love2d/quickjs"),
        .files = &.{
            "cutils.c",
            "dtoa.c",
            "libregexp.c",
            "libunicode.c",
            "quickjs.c",
            "quickjs-libc.c",
        },
        .flags = &.{ "-O2", "-D_GNU_SOURCE", "-DQUICKJS_NG_BUILD" },
    });

    // stb_image
    exe.root_module.addIncludePath(b.path("."));
    exe.root_module.addCSourceFile(.{
        .file = b.path("stb/stb_image_impl.c"),
        .flags = &.{"-O2"},
    });
    exe.root_module.addCSourceFile(.{
        .file = b.path("stb/stb_image_write_impl.c"),
        .flags = &.{"-O2"},
    });

    // System libs
    exe.linkLibC();
    exe.linkSystemLibrary("SDL2");
    exe.linkSystemLibrary("freetype");

    if (os == .linux) {
        exe.linkSystemLibrary("m");
        exe.linkSystemLibrary("pthread");
        exe.linkSystemLibrary("dl");
        exe.root_module.addIncludePath(.{ .cwd_relative = "/usr/include/freetype2" });
        exe.root_module.addIncludePath(.{ .cwd_relative = "/usr/include/x86_64-linux-gnu" });
    } else if (os == .macos) {
        exe.root_module.addLibraryPath(.{ .cwd_relative = "/opt/homebrew/lib" });
        exe.root_module.addIncludePath(.{ .cwd_relative = "/opt/homebrew/include" });
        exe.root_module.addIncludePath(.{ .cwd_relative = "/opt/homebrew/include/freetype2" });
    }

    const install = b.addInstallArtifact(exe, .{});
    b.getInstallStep().dependOn(&install.step);

    // Run step
    const run_cmd = b.addRunArtifact(exe);
    run_cmd.step.dependOn(b.getInstallStep());
    if (b.args) |a| for (a) |arg| run_cmd.addArg(arg);
    const run_step = b.step("run", "Build and run ZigOS shell (JSON flush)");
    run_step.dependOn(&run_cmd.step);

    // ── Slots binary (TSZ UI + JS logic, no JSON) ────────────────────
    const slots_exe = b.addExecutable(.{
        .name = "zigos-slots",
        .root_module = b.createModule(.{
            .root_source_file = b.path("main_slots.zig"),
            .target = target,
            .optimize = optimize,
        }),
    });

    slots_exe.root_module.addIncludePath(b.path("../../love2d/quickjs"));
    slots_exe.root_module.addCSourceFiles(.{
        .root = b.path("../../love2d/quickjs"),
        .files = &.{ "cutils.c", "dtoa.c", "libregexp.c", "libunicode.c", "quickjs.c", "quickjs-libc.c" },
        .flags = &.{ "-O2", "-D_GNU_SOURCE", "-DQUICKJS_NG_BUILD" },
    });
    slots_exe.root_module.addIncludePath(b.path("."));
    slots_exe.root_module.addCSourceFile(.{ .file = b.path("stb/stb_image_impl.c"), .flags = &.{"-O2"} });
    slots_exe.root_module.addCSourceFile(.{ .file = b.path("stb/stb_image_write_impl.c"), .flags = &.{"-O2"} });
    slots_exe.linkLibC();
    slots_exe.linkSystemLibrary("SDL2");
    slots_exe.linkSystemLibrary("freetype");
    if (os == .linux) {
        slots_exe.linkSystemLibrary("m");
        slots_exe.linkSystemLibrary("pthread");
        slots_exe.linkSystemLibrary("dl");
        slots_exe.root_module.addIncludePath(.{ .cwd_relative = "/usr/include/freetype2" });
        slots_exe.root_module.addIncludePath(.{ .cwd_relative = "/usr/include/x86_64-linux-gnu" });
    } else if (os == .macos) {
        slots_exe.root_module.addLibraryPath(.{ .cwd_relative = "/opt/homebrew/lib" });
        slots_exe.root_module.addIncludePath(.{ .cwd_relative = "/opt/homebrew/include" });
        slots_exe.root_module.addIncludePath(.{ .cwd_relative = "/opt/homebrew/include/freetype2" });
    }

    const slots_install = b.addInstallArtifact(slots_exe, .{});
    b.getInstallStep().dependOn(&slots_install.step);

    const slots_run = b.addRunArtifact(slots_exe);
    slots_run.step.dependOn(b.getInstallStep());
    if (b.args) |a| for (a) |arg| slots_run.addArg(arg);
    const slots_run_step = b.step("run-slots", "Build and run ZigOS slots (TSZ UI + JS logic)");
    slots_run_step.dependOn(&slots_run.step);
}
