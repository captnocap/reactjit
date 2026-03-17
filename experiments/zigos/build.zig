//! ZigOS — isolated experiment build
//!
//! zig build compiler    — build the .tsz compiler
//! zig build app         — build app from generated_app.zig

const std = @import("std");

pub fn build(b: *std.Build) void {
    const target = b.standardTargetOptions(.{});
    const optimize = b.standardOptimizeOption(.{});
    const os = target.result.os.tag;

    // ── wgpu-native dependency (always release — debug wgpu has a GPF in hashbrown) ──
    const wgpu_dep = b.dependency("wgpu_native_zig", .{
        .target = target,
        .optimize = .ReleaseSmall,
    });
    const wgpu_mod = wgpu_dep.module("wgpu");

    // ── App binary (compiled from generated_app.zig by the compiler) ─
    const app_exe = b.addExecutable(.{
        .name = "zigos-app",
        .root_module = b.createModule(.{
            .root_source_file = b.path("generated_app.zig"),
            .target = target,
            .optimize = optimize,
        }),
    });
    app_exe.root_module.addIncludePath(b.path("../../love2d/quickjs"));
    app_exe.root_module.addCSourceFiles(.{
        .root = b.path("../../love2d/quickjs"),
        .files = &.{ "cutils.c", "dtoa.c", "libregexp.c", "libunicode.c", "quickjs.c", "quickjs-libc.c" },
        .flags = &.{ "-O2", "-D_GNU_SOURCE", "-DQUICKJS_NG_BUILD" },
    });
    app_exe.root_module.addIncludePath(b.path("."));
    app_exe.root_module.addCSourceFile(.{ .file = b.path("stb/stb_image_impl.c"), .flags = &.{"-O2"} });
    app_exe.root_module.addCSourceFile(.{ .file = b.path("stb/stb_image_write_impl.c"), .flags = &.{"-O2"} });
    app_exe.root_module.addCSourceFile(.{ .file = b.path("ffi/clock_shim.c"), .flags = &.{"-O2"} });
    app_exe.root_module.addIncludePath(b.path("ffi"));
    app_exe.root_module.addImport("wgpu", wgpu_mod);
    app_exe.linkLibC();
    app_exe.linkSystemLibrary("SDL2");
    app_exe.linkSystemLibrary("freetype");
    if (os == .linux) {
        app_exe.linkSystemLibrary("m");
        app_exe.linkSystemLibrary("pthread");
        app_exe.linkSystemLibrary("dl");
        app_exe.root_module.addIncludePath(.{ .cwd_relative = "/usr/include/freetype2" });
        app_exe.root_module.addIncludePath(.{ .cwd_relative = "/usr/include/x86_64-linux-gnu" });
    } else if (os == .macos) {
        app_exe.root_module.addLibraryPath(.{ .cwd_relative = "/opt/homebrew/lib" });
        app_exe.root_module.addIncludePath(.{ .cwd_relative = "/opt/homebrew/include" });
        app_exe.root_module.addIncludePath(.{ .cwd_relative = "/opt/homebrew/include/freetype2" });
    }
    const app_install = b.addInstallArtifact(app_exe, .{});
    const app_step = b.step("app", "Build app from generated_app.zig");
    app_step.dependOn(&app_install.step);

    // ── TSZ compiler ─────────────────────────────────────────────
    const compiler_exe = b.addExecutable(.{
        .name = "zigos-compiler",
        .root_module = b.createModule(.{
            .root_source_file = b.path("compiler/cli.zig"),
            .target = target,
            .optimize = optimize,
        }),
    });
    compiler_exe.linkLibC();
    const compiler_install = b.addInstallArtifact(compiler_exe, .{});
    const compiler_step = b.step("compiler", "Build TSZ compiler");
    compiler_step.dependOn(&compiler_install.step);
}
