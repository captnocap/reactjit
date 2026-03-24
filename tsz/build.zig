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
    const sysroot = b.option([]const u8, "sysroot", "Cross-compile sysroot path (e.g., Alpine rootfs with -dev packages)");

    // ── App binary (used by compiler: -Dapp-name=X) ──────────────
    const app_name = b.option([]const u8, "app-name", "Output binary name (set by compiler)") orelse "zigos-app";
    const app_exe = addAppExe(b, target, optimize, wgpu_mod, app_name, .full, !no_debug, sysroot);
    const app_install = b.addInstallArtifact(app_exe, .{});
    const app_step = b.step("app", "tsz app — codegen + layout + rendering");
    app_step.dependOn(&app_install.step);

    // ── dist-lean — lean code addict tier ─────────────────────────
    const lean_exe = addAppExe(b, target, optimize, wgpu_mod, "zigos-lean", .lean, false, sysroot);
    const lean_install = b.addInstallArtifact(lean_exe, .{});
    const lean_step = b.step("dist-lean", "Lean tier — layout + GPU + SDL2 only");
    lean_step.dependOn(&lean_install.step);

    // ── dist-full — batteries included tier ───────────────────────
    const full_exe = addAppExe(b, target, optimize, wgpu_mod, "zigos-full", .full, false, sysroot);
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

    // ── WASM target — layout engine only, no native deps ──────────
    const wasm_lib = b.addExecutable(.{
        .name = "tsz-layout",
        .root_module = b.createModule(.{
            .root_source_file = b.path("wasm_exports.zig"),
            .target = b.resolveTargetQuery(.{
                .cpu_arch = .wasm32,
                .os_tag = .freestanding,
            }),
            .optimize = .ReleaseSmall,
        }),
    });
    wasm_lib.entry = .disabled;
    wasm_lib.root_module.export_symbol_names = &.{
        "node_create",
        "node_reset",
        "node_set_width",
        "node_set_height",
        "node_set_flex_direction",
        "node_set_flex_grow",
        "node_set_flex_basis",
        "node_set_padding",
        "node_set_margin",
        "node_set_gap",
        "node_set_align_items",
        "node_set_justify_content",
        "node_set_display",
        "node_add_child",
        "layout_compute",
        "node_get_x",
        "node_get_y",
        "node_get_w",
        "node_get_h",
        "get_node_count",
    };
    const wasm_install = b.addInstallArtifact(wasm_lib, .{});
    const wasm_step = b.step("wasm", "WASM target — layout engine for browser");
    wasm_step.dependOn(&wasm_install.step);

    // ── WASM GPU target — WebGPU rect rendering via JS shim ───────
    const wasm_gpu = b.addExecutable(.{
        .name = "tsz-gpu",
        .root_module = b.createModule(.{
            .root_source_file = b.path("wasm_gpu.zig"),
            .target = b.resolveTargetQuery(.{
                .cpu_arch = .wasm32,
                .os_tag = .freestanding,
            }),
            .optimize = .ReleaseSmall,
        }),
    });
    wasm_gpu.entry = .disabled;
    wasm_gpu.root_module.export_symbol_names = &.{
        "node_create",
        "node_reset",
        "node_set_width",
        "node_set_height",
        "node_set_flex_direction",
        "node_set_flex_grow",
        "node_set_flex_basis",
        "node_set_padding",
        "node_set_margin",
        "node_set_gap",
        "node_set_align_items",
        "node_set_justify_content",
        "node_set_display",
        "node_set_color",
        "node_add_child",
        "layout_compute",
        "node_get_x",
        "node_get_y",
        "node_get_w",
        "node_get_h",
        "get_node_count",
        "render",
    };
    const wasm_gpu_install = b.addInstallArtifact(wasm_gpu, .{});
    const wasm_gpu_step = b.step("wasm-gpu", "WASM GPU target — WebGPU rect rendering");
    wasm_gpu_step.dependOn(&wasm_gpu_install.step);

    // ── WASM Runtime: QuickJS + layout + WebGPU ─────────────────────────
    const wasm_rt_mod = b.createModule(.{
        .root_source_file = b.path("wasm_runtime.zig"),
        .target = b.resolveTargetQuery(.{
            .cpu_arch = .wasm32,
            .os_tag = .wasi,
        }),
        .optimize = .ReleaseSmall,
        .link_libc = true,
    });
    wasm_rt_mod.addIncludePath(b.path("../love2d/quickjs"));
    wasm_rt_mod.addCSourceFiles(.{
        .root = b.path("../love2d/quickjs"),
        .files = &.{ "cutils.c", "dtoa.c", "libregexp.c", "libunicode.c", "quickjs.c" },
        .flags = &.{ "-O2", "-D_GNU_SOURCE", "-DQUICKJS_NG_BUILD", "-D_WASI_EMULATED_SIGNAL" },
    });
    const wasm_rt = b.addExecutable(.{
        .name = "tsz-runtime",
        .root_module = wasm_rt_mod,
    });
    wasm_rt.entry = .disabled;
    wasm_rt.root_module.export_symbol_names = &.{
        "rt_init",
        "rt_eval",
        "rt_destroy",
        "rt_mouse_event",
        "rt_key_event",
        "node_create",
        "node_reset",
        "render",
        "layout_compute",
        "get_node_count",
    };
    const wasm_rt_install = b.addInstallArtifact(wasm_rt, .{});
    const wasm_rt_step = b.step("wasm-rt", "WASM Runtime — QuickJS + layout + WebGPU");
    wasm_rt_step.dependOn(&wasm_rt_install.step);
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
    sysroot: ?[]const u8,
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
    exe.stack_size = 16 * 1024 * 1024; // 16MB — deep component trees

    // ── Always linked (both tiers) ──────────────────────────────
    exe.root_module.addImport("wgpu", wgpu_mod);
    exe.linkLibC();
    exe.linkSystemLibrary("SDL2");
    exe.linkSystemLibrary("freetype");

    if (os == .linux) {
        exe.linkSystemLibrary("m");
        exe.linkSystemLibrary("pthread");
        exe.linkSystemLibrary("dl");
        if (sysroot) |sr| {
            // Cross-compile: use sysroot paths (Alpine musl)
            exe.root_module.addIncludePath(.{ .cwd_relative = b.fmt("{s}/usr/include/freetype2", .{sr}) });
            exe.root_module.addIncludePath(.{ .cwd_relative = b.fmt("{s}/usr/include", .{sr}) });
            exe.root_module.addLibraryPath(.{ .cwd_relative = b.fmt("{s}/usr/lib", .{sr}) });
        } else {
            // Native build: use host system paths
            exe.root_module.addIncludePath(.{ .cwd_relative = "/usr/include/freetype2" });
            exe.root_module.addIncludePath(.{ .cwd_relative = "/usr/include/x86_64-linux-gnu" });
        }
        // musl compat shim: glibc-built static libs (wgpu-native) need stat64/mmap64 aliases
        if (target.result.abi == .musl) {
            exe.root_module.addCSourceFile(.{ .file = b.path("ffi/musl_compat.c"), .flags = &.{"-O2"} });
        }
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
            if (sysroot) |sr| {
                exe.root_module.addIncludePath(.{ .cwd_relative = b.fmt("{s}/usr/include", .{sr}) });
            } else {
                exe.root_module.addIncludePath(.{ .cwd_relative = "/usr/include/x86_64-linux-gnu" });
            }
        } else if (os == .macos) {
            exe.root_module.addIncludePath(.{ .cwd_relative = "/opt/homebrew/include" });
        }
    }

    return exe;
}
