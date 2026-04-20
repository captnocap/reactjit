//! Root build.zig — builds qjs_app.zig against framework/ into zig-out/bin/<name>.
//!
//! Usage:
//!   zig build app                                       # default: qjs_app.zig → zig-out/bin/app
//!   zig build app -Dapp-name=hello                      # → zig-out/bin/hello
//!   zig build app -Dapp-name=hello -Dapp-source=foo.zig # different root source
//!
//! Everything Smith-era lives in the frozen tsz/ directory and is not built here.

const std = @import("std");

pub fn build(b: *std.Build) void {
    const target = b.standardTargetOptions(.{});
    const optimize = b.standardOptimizeOption(.{});

    const app_name = b.option([]const u8, "app-name", "Output binary name") orelse "app";
    const app_source = b.option([]const u8, "app-source", "Root Zig source file") orelse "qjs_app.zig";
    const sysroot = b.option([]const u8, "sysroot", "Optional sysroot for cross-builds");
    const dev_mode = b.option(bool, "dev-mode", "Read bundle.js from disk and hot-reload on change") orelse false;

    // ── wgpu-native ────────────────────────────────────────────
    const wgpu_dep = b.dependency("wgpu_native_zig", .{
        .target = target,
        .optimize = optimize,
    });
    const wgpu_mod = wgpu_dep.module("wgpu");

    // ── tls.zig (browser page fetch path) ───────────────────────
    const tls_dep = b.dependency("tls_zig", .{
        .target = target,
        .optimize = optimize,
    });
    const tls_mod = b.createModule(.{
        .root_source_file = tls_dep.path("src/root.zig"),
        .target = target,
        .optimize = optimize,
    });

    // ── zluajit (LuaJIT worker compute) ────────────────────────
    const zluajit_dep = b.dependency("zluajit", .{
        .target = target,
        .optimize = optimize,
        .system = true,
    });

    // ── Build options ──────────────────────────────────────────
    const options = b.addOptions();
    options.addOption(bool, "is_lib", false);
    options.addOption([]const u8, "app_name", app_name);
    options.addOption(bool, "dev_mode", dev_mode);
    options.addOption(bool, "has_quickjs", true);
    options.addOption(bool, "has_physics", true);
    options.addOption(bool, "has_terminal", true);
    options.addOption(bool, "has_video", true);
    options.addOption(bool, "has_render_surfaces", true);
    options.addOption(bool, "has_effects", true);
    options.addOption(bool, "has_canvas", true);
    options.addOption(bool, "has_3d", true);
    options.addOption(bool, "has_transitions", true);
    options.addOption(bool, "has_networking", true);
    options.addOption(bool, "has_crypto", true);
    options.addOption(bool, "has_blend2d", false);
    options.addOption(bool, "has_debug_server", true);

    const root_mod = b.createModule(.{
        .root_source_file = b.path(app_source),
        .target = target,
        .optimize = optimize,
    });
    root_mod.addOptions("build_options", options);
    root_mod.addImport("wgpu", wgpu_mod);
    root_mod.addImport("tls", tls_mod);
    root_mod.addImport("zluajit", zluajit_dep.module("zluajit"));

    const exe = b.addExecutable(.{
        .name = app_name,
        .root_module = root_mod,
    });
    // 64MB stack. Debug frames are massive (SDL_Event union + engine.run locals
    // alone burn through the old 16MB), and recursive hitTest/paint walks on
    // deep trees compound fast. VA-only; no RSS cost until used.
    exe.stack_size = 64 * 1024 * 1024;

    // ── Always linked ──────────────────────────────────────────
    exe.linkLibC();
    exe.linkSystemLibrary("SDL3");
    exe.linkSystemLibrary("freetype");
    exe.linkSystemLibrary("luajit-5.1");

    const os_tag = target.result.os.tag;
    if (os_tag == .linux) {
        root_mod.addIncludePath(.{ .cwd_relative = "/usr/include/luajit-2.1" });
        exe.linkSystemLibrary("X11");
        exe.linkSystemLibrary("m");
        exe.linkSystemLibrary("pthread");
        exe.linkSystemLibrary("dl");
        if (sysroot) |sr| {
            root_mod.addIncludePath(.{ .cwd_relative = b.fmt("{s}/usr/include/freetype2", .{sr}) });
            root_mod.addIncludePath(.{ .cwd_relative = b.fmt("{s}/usr/include", .{sr}) });
            root_mod.addLibraryPath(.{ .cwd_relative = b.fmt("{s}/usr/lib", .{sr}) });
        } else {
            root_mod.addIncludePath(.{ .cwd_relative = "/usr/include/freetype2" });
            root_mod.addIncludePath(.{ .cwd_relative = "/usr/include/x86_64-linux-gnu" });
        }
    } else if (os_tag == .macos) {
        root_mod.addIncludePath(.{ .cwd_relative = "/opt/homebrew/include/luajit-2.1" });
        root_mod.addLibraryPath(.{ .cwd_relative = "/opt/homebrew/lib" });
        root_mod.addIncludePath(.{ .cwd_relative = "/opt/homebrew/include" });
        root_mod.addIncludePath(.{ .cwd_relative = "/opt/homebrew/include/freetype2" });
        root_mod.addLibraryPath(.{ .cwd_relative = "/opt/homebrew/opt/libarchive/lib" });
        root_mod.addIncludePath(.{ .cwd_relative = "/opt/homebrew/opt/libarchive/include" });
        exe.linkFramework("Foundation");
        exe.linkFramework("QuartzCore");
        exe.linkFramework("Metal");
        exe.linkFramework("Cocoa");
        exe.linkFramework("IOKit");
        exe.linkFramework("CoreVideo");
        root_mod.addCSourceFile(.{ .file = b.path("framework/ffi/applescript_shim.m"), .flags = &.{"-O2"} });
    }

    // ── Include paths ──────────────────────────────────────────
    root_mod.addIncludePath(b.path("."));
    root_mod.addIncludePath(b.path("love2d/quickjs"));
    root_mod.addIncludePath(b.path("framework/ffi"));

    // ── QuickJS ────────────────────────────────────────────────
    root_mod.addCSourceFiles(.{
        .root = b.path("love2d/quickjs"),
        .files = &.{ "cutils.c", "dtoa.c", "libregexp.c", "libunicode.c", "quickjs.c", "quickjs-libc.c" },
        .flags = &.{ "-O2", "-D_GNU_SOURCE", "-DQUICKJS_NG_BUILD" },
    });

    // ── stb image write ────────────────────────────────────────
    root_mod.addCSourceFile(.{ .file = b.path("stb/stb_image_write_impl.c"), .flags = &.{"-O2"} });

    // ── Framework FFI shims ────────────────────────────────────
    root_mod.addCSourceFile(.{ .file = b.path("framework/ffi/compute_shim.c"), .flags = &.{"-O2"} });
    root_mod.addCSourceFile(.{ .file = b.path("framework/ffi/physics_shim.cpp"), .flags = &.{"-O2"} });

    // ── System libraries ──────────────────────────────────────
    exe.linkSystemLibrary("box2d");
    exe.linkSystemLibrary("sqlite3");
    exe.linkSystemLibrary("vterm");
    exe.linkSystemLibrary("curl");

    // ── C++ runtime ────────────────────────────────────────────
    // physics_shim.cpp still requires the C++ runtime even with Blend2D gone.
    exe.linkLibCpp();

    if (os_tag == .linux) {
        if (sysroot) |sr| {
            root_mod.addIncludePath(.{ .cwd_relative = b.fmt("{s}/usr/include", .{sr}) });
        } else {
            root_mod.addIncludePath(.{ .cwd_relative = "/usr/include/x86_64-linux-gnu" });
        }
    } else if (os_tag == .macos) {
        root_mod.addIncludePath(.{ .cwd_relative = "/opt/homebrew/include" });
    }

    b.installArtifact(exe);

    const app_step = b.step("app", "Build the qjs_app binary");
    app_step.dependOn(&b.addInstallArtifact(exe, .{}).step);
}
