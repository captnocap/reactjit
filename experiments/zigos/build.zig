//! ZigOS — isolated experiment build
//!
//! zig build compiler    — build the .tsz compiler
//! zig build app         — zigos-lite (codegen + layout + rendering)
//! zig build app-full    — zigos-full (+ networking, tor, etc.)

const std = @import("std");

pub fn build(b: *std.Build) void {
    const target = b.standardTargetOptions(.{});
    const optimize = b.standardOptimizeOption(.{});

    // ── wgpu-native dependency (always release — debug wgpu has a GPF in hashbrown) ──
    const wgpu_dep = b.dependency("wgpu_native_zig", .{
        .target = target,
        .optimize = .ReleaseSmall,
    });
    const wgpu_mod = wgpu_dep.module("wgpu");

    // ── App binary (name from -Dapp-name, defaults to "zigos-app") ──
    const app_name = b.option([]const u8, "app-name", "Output binary name (set by compiler)") orelse "zigos-app";
    const lite_exe = addAppExe(b, target, optimize, wgpu_mod, app_name, false);
    const lite_install = b.addInstallArtifact(lite_exe, .{});
    const lite_step = b.step("app", "zigos-app — codegen + layout + rendering");
    lite_step.dependOn(&lite_install.step);

    // ── zigos-full (batteries included — networking, tor, everything) ──
    const full_exe = addAppExe(b, target, optimize, wgpu_mod, "zigos-full", true);
    const full_install = b.addInstallArtifact(full_exe, .{});
    const full_step = b.step("app-full", "zigos-full — networking, tor, etc.");
    full_step.dependOn(&full_install.step);

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

    // ── Compiler tests ───────────────────────────────────────────
    const compiler_tests = b.addTest(.{
        .root_module = b.createModule(.{
            .root_source_file = b.path("compiler/run_tests.zig"),
            .target = target,
            .optimize = optimize,
        }),
    });
    const run_compiler_tests = b.addRunArtifact(compiler_tests);
    const test_step = b.step("test", "Run compiler tests");
    test_step.dependOn(&run_compiler_tests.step);
}

// ── Shared app executable builder ────────────────────────────────────────
//
// Both lean and full builds share the same source + core deps. The full
// build layers on networking libraries (curl) and sets a build option so
// framework code can conditionally expose net APIs.

fn addAppExe(
    b: *std.Build,
    target: std.Build.ResolvedTarget,
    optimize: std.builtin.OptimizeMode,
    wgpu_mod: *std.Build.Module,
    name: []const u8,
    full: bool,
) *std.Build.Step.Compile {
    const os = target.result.os.tag;

    const root_mod = b.createModule(.{
        .root_source_file = b.path("generated_app.zig"),
        .target = target,
        .optimize = optimize,
    });
    const exe = b.addExecutable(.{
        .name = name,
        .root_module = root_mod,
    });
    exe.stack_size = 16 * 1024 * 1024; // 16MB — devtools tree has ~2000 nodes

    // ── Core deps (both builds) ──────────────────────────────────
    // QuickJS
    exe.root_module.addIncludePath(b.path("../../love2d/quickjs"));
    exe.root_module.addCSourceFiles(.{
        .root = b.path("../../love2d/quickjs"),
        .files = &.{ "cutils.c", "dtoa.c", "libregexp.c", "libunicode.c", "quickjs.c", "quickjs-libc.c" },
        .flags = &.{ "-O2", "-D_GNU_SOURCE", "-DQUICKJS_NG_BUILD" },
    });
    // stb
    exe.root_module.addIncludePath(b.path("."));
    exe.root_module.addCSourceFile(.{ .file = b.path("stb/stb_image_impl.c"), .flags = &.{"-O2"} });
    exe.root_module.addCSourceFile(.{ .file = b.path("stb/stb_image_write_impl.c"), .flags = &.{"-O2"} });
    // FFI shims
    exe.root_module.addCSourceFile(.{ .file = b.path("ffi/clock_shim.c"), .flags = &.{"-O2"} });
    exe.root_module.addCSourceFile(.{ .file = b.path("ffi/compute_shim.c"), .flags = &.{"-O2"} });
    exe.root_module.addIncludePath(b.path("ffi"));
    // wgpu
    exe.root_module.addImport("wgpu", wgpu_mod);
    // System
    exe.linkLibC();
    exe.linkSystemLibrary("SDL2");
    exe.linkSystemLibrary("freetype");
    exe.linkSystemLibrary("sqlite3");

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

    // ── Full build extras (networking, tor, etc.) ────────────────
    if (full) {
        exe.linkSystemLibrary("curl");
        exe.linkSystemLibrary("vterm");
        exe.linkSystemLibrary("archive");
        if (os == .linux) {
            exe.root_module.addIncludePath(.{ .cwd_relative = "/usr/include/x86_64-linux-gnu" });
        } else if (os == .macos) {
            exe.root_module.addIncludePath(.{ .cwd_relative = "/opt/homebrew/include" });
        }
    }

    return exe;
}
