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
    const use_v8 = b.option(bool, "use-v8", "Use V8 JS engine instead of QuickJS") orelse false;
    const default_src: []const u8 = if (use_v8) "v8_app.zig" else "qjs_app.zig";
    const app_source = b.option([]const u8, "app-source", "Root Zig source file") orelse default_src;
    const sysroot = b.option([]const u8, "sysroot", "Optional sysroot for cross-builds");
    const dev_mode = b.option(bool, "dev-mode", "Read bundle.js from disk and hot-reload on change") orelse false;
    const custom_chrome = b.option(bool, "custom-chrome", "Cart draws its own window chrome (borderless)") orelse false;
    const prebuilt_v8_path = b.option(
        []const u8,
        "prebuilt_v8_path",
        "Absolute path to prebuilt libc_v8.a",
    ) orelse b.pathFromRoot("deps/v8-prebuilt/libc_v8.a");

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
    options.addOption(bool, "custom_chrome", custom_chrome);
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
    options.addOption(bool, "use_v8", use_v8);

    const root_mod = b.createModule(.{
        .root_source_file = b.path(app_source),
        .target = target,
        .optimize = optimize,
    });
    root_mod.addOptions("build_options", options);
    root_mod.addImport("wgpu", wgpu_mod);
    root_mod.addImport("tls", tls_mod);
    root_mod.addImport("zluajit", zluajit_dep.module("zluajit"));

    const v8_dep_opt = if (use_v8) b.dependency("v8", .{
        .target = target,
        .optimize = optimize,
        .prebuilt_v8_path = @as([]const u8, prebuilt_v8_path),
    }) else null;
    if (v8_dep_opt) |v8_dep| root_mod.addImport("v8", v8_dep.module("v8"));

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

    // ── v8-hello: smoke test for framework/v8_runtime.zig ──────
    const v8_hello_dep = b.dependency("v8", .{
        .target = target,
        .optimize = optimize,
        .prebuilt_v8_path = @as([]const u8, prebuilt_v8_path),
    });
    const v8_mod = v8_hello_dep.module("v8");

    const v8_hello_mod = b.createModule(.{
        .root_source_file = b.path("v8_hello.zig"),
        .target = target,
        .optimize = optimize,
    });
    v8_hello_mod.addImport("v8", v8_mod);

    const v8_hello_exe = b.addExecutable(.{
        .name = "v8-hello",
        .root_module = v8_hello_mod,
    });
    v8_hello_exe.linkLibC();
    v8_hello_exe.linkLibCpp();

    const v8_hello_step = b.step("v8-hello", "Build v8_hello smoke test");
    v8_hello_step.dependOn(&b.addInstallArtifact(v8_hello_exe, .{}).step);

    // ── luajit_runtime bridge library for the Zig integration test ───
    const bridge_mod = b.createModule(.{
        .root_source_file = b.path("framework/luajit_runtime_bridge.zig"),
        .target = target,
        .optimize = optimize,
    });
    bridge_mod.addOptions("build_options", options);
    bridge_mod.addImport("wgpu", wgpu_mod);
    bridge_mod.addImport("tls", tls_mod);
    bridge_mod.addImport("zluajit", zluajit_dep.module("zluajit"));

    bridge_mod.addIncludePath(b.path("."));
    bridge_mod.addIncludePath(b.path("love2d/quickjs"));
    bridge_mod.addIncludePath(b.path("framework/ffi"));

    bridge_mod.addCSourceFiles(.{
        .root = b.path("love2d/quickjs"),
        .files = &.{ "cutils.c", "dtoa.c", "libregexp.c", "libunicode.c", "quickjs.c", "quickjs-libc.c" },
        .flags = &.{ "-O2", "-D_GNU_SOURCE", "-DQUICKJS_NG_BUILD" },
    });
    bridge_mod.addCSourceFile(.{ .file = b.path("stb/stb_image_write_impl.c"), .flags = &.{"-O2"} });
    bridge_mod.addCSourceFile(.{ .file = b.path("framework/ffi/compute_shim.c"), .flags = &.{"-O2"} });
    bridge_mod.addCSourceFile(.{ .file = b.path("framework/ffi/physics_shim.cpp"), .flags = &.{"-O2"} });

    if (os_tag == .linux) {
        bridge_mod.addIncludePath(.{ .cwd_relative = "/usr/include/luajit-2.1" });
        if (sysroot) |sr| {
            bridge_mod.addIncludePath(.{ .cwd_relative = b.fmt("{s}/usr/include/freetype2", .{sr}) });
            bridge_mod.addIncludePath(.{ .cwd_relative = b.fmt("{s}/usr/include", .{sr}) });
            bridge_mod.addLibraryPath(.{ .cwd_relative = b.fmt("{s}/usr/lib", .{sr}) });
        } else {
            bridge_mod.addIncludePath(.{ .cwd_relative = "/usr/include/freetype2" });
            bridge_mod.addIncludePath(.{ .cwd_relative = "/usr/include/x86_64-linux-gnu" });
        }
    } else if (os_tag == .macos) {
        bridge_mod.addIncludePath(.{ .cwd_relative = "/opt/homebrew/include/luajit-2.1" });
        bridge_mod.addLibraryPath(.{ .cwd_relative = "/opt/homebrew/lib" });
        bridge_mod.addIncludePath(.{ .cwd_relative = "/opt/homebrew/include" });
        bridge_mod.addIncludePath(.{ .cwd_relative = "/opt/homebrew/include/freetype2" });
        bridge_mod.addLibraryPath(.{ .cwd_relative = "/opt/homebrew/opt/libarchive/lib" });
        bridge_mod.addIncludePath(.{ .cwd_relative = "/opt/homebrew/opt/libarchive/include" });
        bridge_mod.addCSourceFile(.{ .file = b.path("framework/ffi/applescript_shim.m"), .flags = &.{"-O2"} });
    }

    if (os_tag == .linux) {
        if (sysroot) |sr| {
            bridge_mod.addIncludePath(.{ .cwd_relative = b.fmt("{s}/usr/include", .{sr}) });
        } else {
            bridge_mod.addIncludePath(.{ .cwd_relative = "/usr/include/x86_64-linux-gnu" });
        }
    } else if (os_tag == .macos) {
        bridge_mod.addIncludePath(.{ .cwd_relative = "/opt/homebrew/include" });
    }

    const luajit_runtime_bridge = b.addLibrary(.{
        .name = "luajit-runtime-bridge",
        .linkage = .static,
        .root_module = bridge_mod,
    });

    // ── Zig-side integration test ───────────────────────────────
    const test_mod = b.createModule(.{
        .root_source_file = b.path("framework/luajit_runtime_test.zig"),
        .target = target,
        .optimize = optimize,
    });
    const luajit_runtime_test = b.addTest(.{
        .name = "luajit-runtime-test",
        .root_module = test_mod,
    });
    luajit_runtime_test.linkLibrary(luajit_runtime_bridge);
    luajit_runtime_test.linkLibC();
    luajit_runtime_test.linkSystemLibrary("SDL3");
    luajit_runtime_test.linkSystemLibrary("freetype");
    luajit_runtime_test.linkSystemLibrary("luajit-5.1");
    if (os_tag == .linux) {
        luajit_runtime_test.linkSystemLibrary("X11");
        luajit_runtime_test.linkSystemLibrary("m");
        luajit_runtime_test.linkSystemLibrary("pthread");
        luajit_runtime_test.linkSystemLibrary("dl");
    } else if (os_tag == .macos) {
        luajit_runtime_test.linkFramework("Foundation");
        luajit_runtime_test.linkFramework("QuartzCore");
        luajit_runtime_test.linkFramework("Metal");
        luajit_runtime_test.linkFramework("Cocoa");
        luajit_runtime_test.linkFramework("IOKit");
        luajit_runtime_test.linkFramework("CoreVideo");
    }
    luajit_runtime_test.linkSystemLibrary("box2d");
    luajit_runtime_test.linkSystemLibrary("sqlite3");
    luajit_runtime_test.linkSystemLibrary("vterm");
    luajit_runtime_test.linkSystemLibrary("curl");
    luajit_runtime_test.linkLibCpp();

    const run_luajit_runtime_test = b.addRunArtifact(luajit_runtime_test);
    const luajit_runtime_test_step = b.step("test-luajit-runtime", "Run the LuaJIT runtime integration test");
    luajit_runtime_test_step.dependOn(&run_luajit_runtime_test.step);
}
