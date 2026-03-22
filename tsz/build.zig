//! TSZ build — compiler, dist-lean, dist-full
//!
//! zig build compiler     — build the .tsz compiler
//! zig build app          — standard app build (used by compiler, links everything)
//! zig build dist-lean    — minimal: layout + GPU + SDL2 (no QuickJS/physics/3D/terminal/video)
//! zig build dist-full    — batteries included: networking, QuickJS, physics, 3D, terminal, video, crypto

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

    // ── User flags ──────────────────────────────────────────────────
    const no_debug = b.option(bool, "no-debug", "Strip debug server from binary (default for dist builds)") orelse false;

    // ── App binary (used by compiler: -Dapp-name=X) ──────────────
    const app_name = b.option([]const u8, "app-name", "Output binary name (set by compiler)") orelse "zigos-app";
    const app_exe = addAppExe(b, target, optimize, wgpu_mod, app_name, .full, !no_debug);
    const app_install = b.addInstallArtifact(app_exe, .{});
    const app_step = b.step("app", "tsz app — codegen + layout + rendering");
    app_step.dependOn(&app_install.step);

    // ── dist-lean — lean code addict tier ─────────────────────────
    const lean_exe = addAppExe(b, target, optimize, wgpu_mod, "zigos-lean", .lean, false);
    const lean_install = b.addInstallArtifact(lean_exe, .{});
    const lean_step = b.step("dist-lean", "Lean tier — layout + GPU + SDL2 only");
    lean_step.dependOn(&lean_install.step);

    // ── dist-full — batteries included tier ───────────────────────
    const full_exe = addAppExe(b, target, optimize, wgpu_mod, "zigos-full", .full, false);
    const full_install = b.addInstallArtifact(full_exe, .{});
    const full_step = b.step("dist-full", "Full tier — networking, QuickJS, physics, 3D, terminal, video, crypto");
    full_step.dependOn(&full_install.step);

    // ── Backward compat alias ────────────────────────────────────
    const full_compat_step = b.step("app-full", "tsz-full (alias for dist-full)");
    full_compat_step.dependOn(&full_install.step);

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
    compiler_exe.stack_size = 64 * 1024 * 1024; // 64MB — Generator struct + recursive parseJSXElement frames are large
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

// ── Distribution tiers ──────────────────────────────────────────────────

const Tier = enum { lean, full };

// ── Shared app executable builder ────────────────────────────────────────

fn addAppExe(
    b: *std.Build,
    target: std.Build.ResolvedTarget,
    optimize: std.builtin.OptimizeMode,
    wgpu_mod: *std.Build.Module,
    name: []const u8,
    tier: Tier,
    debug_server: bool,
) *std.Build.Step.Compile {
    const os = target.result.os.tag;
    const is_lean = tier == .lean;

    // ── Build options (passed to framework code via @import("build_options")) ──
    const options = b.addOptions();
    options.addOption(bool, "has_quickjs", !is_lean);
    options.addOption(bool, "has_physics", !is_lean);
    options.addOption(bool, "has_terminal", !is_lean);
    options.addOption(bool, "has_video", !is_lean);
    options.addOption(bool, "has_render_surfaces", !is_lean);
    options.addOption(bool, "has_effects", !is_lean);
    options.addOption(bool, "has_canvas", !is_lean);
    options.addOption(bool, "has_3d", !is_lean);
    options.addOption(bool, "has_transitions", !is_lean);
    options.addOption(bool, "has_networking", !is_lean);
    options.addOption(bool, "has_crypto", !is_lean);
    options.addOption(bool, "has_debug_server", debug_server);

    const root_mod = b.createModule(.{
        .root_source_file = b.path("generated_app.zig"),
        .target = target,
        .optimize = optimize,
    });
    root_mod.addOptions("build_options", options);

    const exe = b.addExecutable(.{
        .name = name,
        .root_module = root_mod,
    });
    exe.stack_size = 16 * 1024 * 1024; // 16MB — devtools tree has ~2000 nodes

    // ── Always linked (both tiers) ──────────────────────────────
    exe.root_module.addImport("wgpu", wgpu_mod);
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

    // ── Include paths needed by framework headers (even in lean — for @cImport) ──
    exe.root_module.addIncludePath(b.path("."));
    exe.root_module.addIncludePath(b.path("../love2d/quickjs")); // quickjs.h (header-only in lean)
    exe.root_module.addIncludePath(b.path("ffi"));               // physics_shim.h etc

    // ── stb_image (lean keeps image loading for textures) ───────
    exe.root_module.addCSourceFile(.{ .file = b.path("stb/stb_image_impl.c"), .flags = &.{"-O2"} });

    // ── Full tier only ──────────────────────────────────────────
    if (!is_lean) {
        // QuickJS
        exe.root_module.addIncludePath(b.path("../love2d/quickjs"));
        exe.root_module.addCSourceFiles(.{
            .root = b.path("../love2d/quickjs"),
            .files = &.{ "cutils.c", "dtoa.c", "libregexp.c", "libunicode.c", "quickjs.c", "quickjs-libc.c" },
            .flags = &.{ "-O2", "-D_GNU_SOURCE", "-DQUICKJS_NG_BUILD" },
        });
        // stb_image_write
        exe.root_module.addCSourceFile(.{ .file = b.path("stb/stb_image_write_impl.c"), .flags = &.{"-O2"} });
        // FFI shims
        exe.root_module.addCSourceFile(.{ .file = b.path("ffi/clock_shim.c"), .flags = &.{"-O2"} });
        exe.root_module.addCSourceFile(.{ .file = b.path("ffi/compute_shim.c"), .flags = &.{"-O2"} });
        exe.root_module.addCSourceFile(.{ .file = b.path("ffi/physics_shim.cpp"), .flags = &.{"-O2"} });
        exe.root_module.addIncludePath(b.path("ffi"));
        // Libraries
        exe.linkSystemLibrary("box2d");
        exe.linkSystemLibrary("sqlite3");
        exe.linkSystemLibrary("vterm");
        // Networking
        exe.linkSystemLibrary("curl");
        exe.linkSystemLibrary("archive");
        if (os == .linux) {
            exe.root_module.addIncludePath(.{ .cwd_relative = "/usr/include/x86_64-linux-gnu" });
        } else if (os == .macos) {
            exe.root_module.addIncludePath(.{ .cwd_relative = "/opt/homebrew/include" });
        }
    }

    return exe;
}
