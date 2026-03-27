//! TSZ build
//!
//! zig build tsz            — lean: compiler + layout + GPU + SDL3
//! zig build tsz-full       — full: compiler + everything (networking, QuickJS, physics, 3D, terminal, video, crypto)
//! zig build app            — compile generated_app.zig and link against the full engine
//! zig build test           — run compiler tests
//! zig build wasm           — WASM layout engine
//! zig build wasm-gpu       — WASM GPU renderer
//! zig build wasm-rt        — WASM QuickJS runtime

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
    const sysroot = b.option([]const u8, "sysroot", "Cross-compile sysroot path (e.g., Alpine rootfs with -dev packages)");

    // ── zigos (lean) — compiler + layout + primitives + GPU ─────────
    const lean_exe = addEngineExe(b, target, optimize, wgpu_mod, "tsz", .lean, sysroot);
    const lean_install = b.addInstallArtifact(lean_exe, .{});
    const lean_step = b.step("tsz", "Lean: compiler + layout + GPU + SDL3");
    lean_step.dependOn(&lean_install.step);

    // ── tsz-full — compiler + everything ────────────────────────────
    const full_exe = addEngineExe(b, target, optimize, wgpu_mod, "tsz-full", .full, sysroot);
    const full_install = b.addInstallArtifact(full_exe, .{});
    const full_step = b.step("tsz-full", "Full: compiler + networking + QuickJS + physics + 3D + terminal + video + crypto");
    full_step.dependOn(&full_install.step);

    // ── App binary (compiled .tsz app) ──────────────────────────────
    const app_name = b.option([]const u8, "app-name", "Output binary name (set by compiler)") orelse "tsz-app";
    const app_exe = addAppExe(b, target, optimize, wgpu_mod, app_name, .full, sysroot);
    const app_install = b.addInstallArtifact(app_exe, .{});
    const app_step = b.step("app", "Build a compiled .tsz app (links full engine)");
    app_step.dependOn(&app_install.step);

    // ── App shared library (hot-reloadable .so for dev shell) ──────
    const app_lib = addAppLib(b, target, optimize, app_name);
    const app_lib_install = b.addInstallArtifact(app_lib, .{});
    const app_lib_step = b.step("app-lib", "Build .tsz app as a hot-reloadable shared library (.so)");
    app_lib_step.dependOn(&app_lib_install.step);

    // ── Dev shell (hot-reload host — loads app .so at runtime) ───
    // Always build dev shell in ReleaseFast — Debug mode tanks layout perf
    const dev_shell_optimize = if (optimize == .Debug) .ReleaseFast else optimize;
    const dev_shell_exe = addDevShellExe(b, target, dev_shell_optimize, wgpu_mod, sysroot);
    const dev_shell_install = b.addInstallArtifact(dev_shell_exe, .{});
    const dev_shell_step = b.step("dev-shell", "Build the hot-reload development shell");
    dev_shell_step.dependOn(&dev_shell_install.step);

    // ── Custom cartridge .so (build any .zig file as a cartridge) ──
    const cart_source = b.option([]const u8, "cart-source", "Path to a .zig file to build as a cartridge .so");
    const cart_name_opt = b.option([]const u8, "cart-name", "Name for the cartridge .so") orelse "custom-cart";
    if (cart_source) |src| {
        const cart_mod = b.createModule(.{
            .root_source_file = b.path(src),
            .target = target,
            .optimize = optimize,
        });
        const cart_lib = b.addLibrary(.{
            .linkage = .dynamic,
            .name = cart_name_opt,
            .root_module = cart_mod,
        });
        cart_lib.linkLibC();
        const cart_install = b.addInstallArtifact(cart_lib, .{});
        const cart_step = b.step("cart", "Build a custom .zig file as a cartridge .so");
        cart_step.dependOn(&cart_install.step);
    }

    // ── Forge (compiler kernel + QuickJS → runs Smith JS codegen) ──
    {
        const forge_mod = b.createModule(.{
            .root_source_file = b.path("compiler/forge.zig"),
            .target = target,
            .optimize = optimize,
        });
        const forge_exe = b.addExecutable(.{
            .name = "forge",
            .root_module = forge_mod,
        });
        forge_exe.linkLibC();
        forge_exe.root_module.addIncludePath(b.path("../love2d/quickjs"));
        forge_exe.root_module.addCSourceFiles(.{
            .root = b.path("../love2d/quickjs"),
            .files = &.{ "cutils.c", "dtoa.c", "libregexp.c", "libunicode.c", "quickjs.c" },
            .flags = &.{ "-O2", "-D_GNU_SOURCE", "-DQUICKJS_NG_BUILD" },
        });
        if (target.result.os.tag == .linux) {
            forge_exe.linkSystemLibrary("m");
            forge_exe.linkSystemLibrary("pthread");
        }
        const forge_install = b.addInstallArtifact(forge_exe, .{});
        const forge_step = b.step("forge", "Forge: compiler kernel + QuickJS (hosts Smith JS codegen)");
        forge_step.dependOn(&forge_install.step);
    }

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

    // ── Web target — full engine compiled to wasm32-emscripten ──────
    //
    // Uses the same wgpu Zig types (extern fn wgpu*) but resolved by
    // emcc/emdawnwebgpu instead of wgpu-native Rust library.
    // Output: .a static lib, linked by emcc into .wasm + .js.
    {
        const emsdk_root = "/home/siah/creative/emsdk";
        const em_sysroot = emsdk_root ++ "/upstream/emscripten/cache/sysroot";
        const em_webgpu_include = emsdk_root ++ "/upstream/emscripten/cache/ports/emdawnwebgpu/emdawnwebgpu_pkg/webgpu/include";

        const web_target = b.resolveTargetQuery(.{
            .cpu_arch = .wasm32,
            .os_tag = .emscripten,
        });

        // Web-specific wgpu module — wraps @cImport("webgpu/webgpu.h") with
        // method-style API matching wgpu_native_zig. Struct layouts come from
        // emdawnwebgpu's header, guaranteeing ABI correctness.
        const web_wgpu_mod = b.createModule(.{
            .root_source_file = b.path("wgpu_web/root.zig"),
            .target = web_target,
            .optimize = .ReleaseSmall,
            .link_libc = true,
        });
        web_wgpu_mod.addSystemIncludePath(.{ .cwd_relative = em_sysroot ++ "/include" });
        web_wgpu_mod.addSystemIncludePath(.{ .cwd_relative = em_webgpu_include });

        // Build options for generated_app.zig — engine_web.zig handles the web runtime
        const web_options = b.addOptions();
        web_options.addOption(bool, "is_lib", false);
        web_options.addOption(bool, "has_quickjs", true);
        web_options.addOption(bool, "has_physics", false);
        web_options.addOption(bool, "has_terminal", false);
        web_options.addOption(bool, "has_video", false);
        web_options.addOption(bool, "has_render_surfaces", false);
        web_options.addOption(bool, "has_effects", false);
        web_options.addOption(bool, "has_canvas", false);
        web_options.addOption(bool, "has_3d", false);
        web_options.addOption(bool, "has_transitions", false);
        web_options.addOption(bool, "has_networking", false);
        web_options.addOption(bool, "has_crypto", false);
        web_options.addOption(bool, "has_blend2d", false);
        web_options.addOption(bool, "has_debug_server", false);

        const web_mod = b.createModule(.{
            .root_source_file = b.path("generated_app.zig"),
            .target = web_target,
            .optimize = .ReleaseSmall,
            .link_libc = true,
        });
        web_mod.addImport("wgpu", web_wgpu_mod);
        web_mod.addOptions("build_options", web_options);

        // Emscripten sysroot + emdawnwebgpu + FreeType headers
        web_mod.addSystemIncludePath(.{ .cwd_relative = em_sysroot ++ "/include" });
        web_mod.addSystemIncludePath(.{ .cwd_relative = em_sysroot ++ "/include/freetype2" });
        web_mod.addSystemIncludePath(.{ .cwd_relative = em_webgpu_include });

        // QuickJS (same source as wasm-rt and tsz-full)
        web_mod.addIncludePath(b.path("../love2d/quickjs"));
        web_mod.addCSourceFiles(.{
            .root = b.path("../love2d/quickjs"),
            .files = &.{ "cutils.c", "dtoa.c", "libregexp.c", "libunicode.c", "quickjs.c" },
            .flags = &.{ "-O2", "-D_GNU_SOURCE", "-DQUICKJS_NG_BUILD", "-D_WASI_EMULATED_SIGNAL" },
        });

        // stb_image
        web_mod.addCSourceFile(.{ .file = b.path("stb/stb_image_impl.c"), .flags = &.{"-O2"} });

        // Framework includes (for @cImport in framework code)
        web_mod.addIncludePath(b.path("."));

        // TinyEMU x86 emulator (runs pre-compiled cartridges in-browser)
        web_mod.addIncludePath(b.path("../deps/tinyemu"));
        web_mod.addCSourceFiles(.{
            .root = b.path("../deps/tinyemu"),
            .files = &.{
                "x86_cpu.c",
                "x86_machine.c",
                "machine.c",
                "cutils.c",
                "iomem.c",
                "pci.c",
                "ide.c",
                "ps2.c",
                "pckbd.c",
                "vga.c",
                "virtio.c",
                "softfp.c",
                "simplefb.c",
                "json.c",
                "elf.c",
                "vmmouse.c",
                "fs.c",
                "fs_utils.c",
            },
            .flags = &.{ "-O2", "-D_GNU_SOURCE", "-DCONFIG_X86EMU", "-DMAX_XLEN=32", "-DEMSCRIPTEN" },
        });
        // TinyEMU Emscripten files disabled — using v86 for Linux VM instead.
        // jsemu.c conflicts with our Emscripten init. TinyEMU core (x86_cpu.c etc.)
        // is still compiled for future direct integration.

        const web_lib = b.addLibrary(.{
            .linkage = .static,
            .name = "tsz-web",
            .root_module = web_mod,
        });

        const web_install = b.addInstallArtifact(web_lib, .{});

        // emcc link step: .a → .wasm + .js (resolves wgpu* symbols via emdawnwebgpu)
        const emcc_exe = emsdk_root ++ "/upstream/emscripten/emcc";
        const emcc = b.addSystemCommand(&.{
            emcc_exe,
            "--use-port=emdawnwebgpu",
            "-sUSE_FREETYPE=1",
            "-sALLOW_MEMORY_GROWTH",
            "--preload-file", "web/font.ttf@/font.ttf",
            "-sEXPORTED_FUNCTIONS=[\"_main\",\"_malloc\",\"_free\"]",
            "-sEXPORTED_RUNTIME_METHODS=[\"ccall\",\"cwrap\",\"HEAPU8\",\"HEAP32\"]",
            "-sERROR_ON_UNDEFINED_SYMBOLS=0",
            "-sASSERTIONS=2",
            "-sNO_EXIT_RUNTIME=1",
            "-sSTACK_SIZE=2097152",
            "-sFETCH",
            "-O1",
            "-o",
        });
        const web_out = emcc.addOutputFileArg("tsz-web.js");
        emcc.addArtifactArg(web_lib);
        emcc.step.dependOn(&web_install.step);

        // Install the emcc outputs (.js + .wasm) to zig-out/
        const install_js = b.addInstallFile(web_out, "tsz-web.js");
        // The .wasm is a sibling of the .js — emcc generates it automatically
        const web_out_wasm = web_out.dirname().path(b, "tsz-web.wasm");
        const install_wasm = b.addInstallFile(web_out_wasm, "tsz-web.wasm");
        install_js.step.dependOn(&emcc.step);
        install_wasm.step.dependOn(&emcc.step);

        const web_step = b.step("web", "Web target — wasm32-emscripten + WebGPU → .wasm + .js");
        web_step.dependOn(&install_js.step);
        web_step.dependOn(&install_wasm.step);
    }

    // ── LuaJIT benchmarks (zluajit) ─────────────────────────────────
    {
        const zluajit_dep = b.dependency("zluajit", .{
            .target = target,
            .optimize = optimize,
            .system = true,
        });

        const bench_mod = b.createModule(.{
            .root_source_file = b.path("bench_zluajit.zig"),
            .target = target,
            .optimize = optimize,
        });
        bench_mod.addImport("zluajit", zluajit_dep.module("zluajit"));

        const bench_exe = b.addExecutable(.{
            .name = "bench-luajit",
            .root_module = bench_mod,
        });
        bench_exe.linkLibC();
        bench_exe.linkSystemLibrary("luajit-5.1");

        const bench_install = b.addInstallArtifact(bench_exe, .{});
        const bench_run = b.addRunArtifact(bench_exe);
        bench_run.step.dependOn(&bench_install.step);

        const bench_step = b.step("bench-luajit", "Run LuaJIT worker benchmarks (zluajit bindings)");
        bench_step.dependOn(&bench_run.step);
    }

    // ── QuickJS vs LuaJIT head-to-head benchmark ────────────────────
    {
        const vs_mod = b.createModule(.{
            .root_source_file = b.path("bench_qjs_vs_luajit.zig"),
            .target = target,
            .optimize = .ReleaseFast,
        });

        // QuickJS (compiled from source, same as tsz-full)
        vs_mod.addIncludePath(b.path("../love2d/quickjs"));
        vs_mod.addCSourceFiles(.{
            .root = b.path("../love2d/quickjs"),
            .files = &.{ "cutils.c", "dtoa.c", "libregexp.c", "libunicode.c", "quickjs.c" },
            .flags = &.{ "-O2", "-D_GNU_SOURCE", "-DQUICKJS_NG_BUILD" },
        });

        // LuaJIT (system library)
        vs_mod.addIncludePath(.{ .cwd_relative = "/usr/include/luajit-2.1" });

        const vs_exe = b.addExecutable(.{
            .name = "bench-vs",
            .root_module = vs_mod,
        });
        vs_exe.linkLibC();
        vs_exe.linkSystemLibrary("luajit-5.1");

        const vs_install = b.addInstallArtifact(vs_exe, .{});
        const vs_run = b.addRunArtifact(vs_exe);
        vs_run.step.dependOn(&vs_install.step);

        const vs_step = b.step("bench-vs", "QuickJS vs LuaJIT head-to-head benchmark");
        vs_step.dependOn(&vs_run.step);
    }
}

// ── Distribution tiers ──────────────────────────────────────────────────

const Tier = enum { lean, full };

// ── Engine executable (compiler + runtime) ──────────────────────────────
//
// Both zigos and zigos-full include the compiler AND runtime.
// The compiler is pure Zig (no framework deps). The runtime is the
// framework (layout, GPU, SDL3, etc.). They're independent modules
// linked into one binary.

fn addEngineExe(
    b: *std.Build,
    target: std.Build.ResolvedTarget,
    optimize: std.builtin.OptimizeMode,
    _: *std.Build.Module, // wgpu_mod — will be used when runtime is linked
    name: []const u8,
    _: Tier, // tier — will be used when runtime is linked
    _: ?[]const u8, // sysroot — will be used when runtime is linked
) *std.Build.Step.Compile {
    // Engine root: compiler/cli.zig for now.
    // Next step: unified entry point that handles both compile and run.
    const root_mod = b.createModule(.{
        .root_source_file = b.path("compiler/cli.zig"),
        .target = target,
        .optimize = optimize,
    });

    const exe = b.addExecutable(.{
        .name = name,
        .root_module = root_mod,
    });
    exe.linkLibC();
    exe.stack_size = 64 * 1024 * 1024; // 64MB — Generator struct + recursive parseJSXElement frames

    return exe;
}

// ── App executable (compiled .tsz, links framework) ─────────────────────
//
// This builds generated_app.zig against the full framework. The engine
// object files are cached — only the app-specific code recompiles.

fn addAppExe(
    b: *std.Build,
    target: std.Build.ResolvedTarget,
    optimize: std.builtin.OptimizeMode,
    wgpu_mod: *std.Build.Module,
    name: []const u8,
    tier: Tier,
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
    options.addOption(bool, "has_blend2d", !is_lean);
    options.addOption(bool, "has_debug_server", true); // always available, gated by TSZ_DEBUG=1 at runtime

    const root_mod = b.createModule(.{
        .root_source_file = b.path("generated_app.zig"),
        .target = target,
        .optimize = optimize,
    });
    root_mod.addOptions("build_options", options);

    // ── zluajit (LuaJIT worker compute) ─────────────────────────
    const zluajit_dep = b.dependency("zluajit", .{
        .target = target,
        .optimize = optimize,
        .system = true,
    });
    root_mod.addImport("zluajit", zluajit_dep.module("zluajit"));

    const exe = b.addExecutable(.{
        .name = name,
        .root_module = root_mod,
    });
    exe.stack_size = 16 * 1024 * 1024; // 16MB — deep component trees

    // ── Always linked (both tiers) ──────────────────────────────
    exe.root_module.addImport("wgpu", wgpu_mod);
    exe.linkLibC();
    exe.linkSystemLibrary("SDL3");
    exe.linkSystemLibrary("freetype");
    exe.linkSystemLibrary("luajit-5.1");
    exe.root_module.addIncludePath(.{ .cwd_relative = "/usr/include/luajit-2.1" });
    exe.linkSystemLibrary("X11");

    if (os == .linux) {
        exe.linkSystemLibrary("m");
        exe.linkSystemLibrary("pthread");
        exe.linkSystemLibrary("dl");
        if (sysroot) |sr| {
            exe.root_module.addIncludePath(.{ .cwd_relative = b.fmt("{s}/usr/include/freetype2", .{sr}) });
            exe.root_module.addIncludePath(.{ .cwd_relative = b.fmt("{s}/usr/include", .{sr}) });
            exe.root_module.addLibraryPath(.{ .cwd_relative = b.fmt("{s}/usr/lib", .{sr}) });
        } else {
            exe.root_module.addIncludePath(.{ .cwd_relative = "/usr/include/freetype2" });
            exe.root_module.addIncludePath(.{ .cwd_relative = "/usr/include/x86_64-linux-gnu" });
        }
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
    exe.root_module.addIncludePath(b.path("../love2d/quickjs"));
    exe.root_module.addIncludePath(b.path("ffi"));

    // ── stb_image (lean keeps image loading for textures) ───────
    exe.root_module.addCSourceFile(.{ .file = b.path("stb/stb_image_impl.c"), .flags = &.{"-O2"} });

    // ── Full tier only ──────────────────────────────────────────
    if (!is_lean) {
        exe.root_module.addIncludePath(b.path("../love2d/quickjs"));
        exe.root_module.addCSourceFiles(.{
            .root = b.path("../love2d/quickjs"),
            .files = &.{ "cutils.c", "dtoa.c", "libregexp.c", "libunicode.c", "quickjs.c", "quickjs-libc.c" },
            .flags = &.{ "-O2", "-D_GNU_SOURCE", "-DQUICKJS_NG_BUILD" },
        });
        exe.root_module.addCSourceFile(.{ .file = b.path("stb/stb_image_write_impl.c"), .flags = &.{"-O2"} });
        exe.root_module.addCSourceFile(.{ .file = b.path("ffi/clock_shim.c"), .flags = &.{"-O2"} });
        exe.root_module.addCSourceFile(.{ .file = b.path("ffi/compute_shim.c"), .flags = &.{"-O2"} });
        exe.root_module.addCSourceFile(.{ .file = b.path("ffi/supervisor_shim.c"), .flags = &.{"-O2"} });
        exe.root_module.addCSourceFile(.{ .file = b.path("ffi/physics_shim.cpp"), .flags = &.{"-O2"} });
        exe.root_module.addIncludePath(b.path("ffi"));
        exe.linkSystemLibrary("box2d");
        exe.linkSystemLibrary("sqlite3");
        exe.linkSystemLibrary("vterm");
        exe.linkSystemLibrary("curl");
        exe.linkSystemLibrary("archive");

        // ── Blend2D (2D vector graphics engine) ──
        exe.root_module.addIncludePath(b.path("../blend2d"));
        exe.addObjectFile(b.path("../blend2d/build/libblend2d_full.a"));
        exe.linkLibCpp();

        // ── Vello CPU (anti-aliased 2D path rendering via Rust FFI) ──
        exe.addObjectFile(b.path("../deps/vello_ffi/target/release/libvello_ffi_stripped.a"));

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

// ── App shared library (hot-reloadable .so — pure Zig, no native deps) ──
//
// Compiles generated_app.zig as a shared library with IS_LIB=true.
// Heavy framework modules (engine, qjs_runtime, input, etc.) are replaced
// with no-op stubs at compile time, so the .so has zero native dependencies
// and compiles near-instantly.

fn addAppLib(
    b: *std.Build,
    target: std.Build.ResolvedTarget,
    optimize: std.builtin.OptimizeMode,
    name: []const u8,
) *std.Build.Step.Compile {
    const options = b.addOptions();
    options.addOption(bool, "is_lib", true);
    // Stub out all feature flags so conditional imports don't pull in native deps
    options.addOption(bool, "has_quickjs", false);
    options.addOption(bool, "has_physics", false);
    options.addOption(bool, "has_terminal", false);
    options.addOption(bool, "has_video", false);
    options.addOption(bool, "has_render_surfaces", false);
    options.addOption(bool, "has_effects", false);
    options.addOption(bool, "has_canvas", false);
    options.addOption(bool, "has_3d", false);
    options.addOption(bool, "has_transitions", false);
    options.addOption(bool, "has_networking", false);
    options.addOption(bool, "has_crypto", false);
    options.addOption(bool, "has_debug_server", false);

    const lib_name = b.fmt("{s}-lib", .{name});

    const root_mod = b.createModule(.{
        .root_source_file = b.path("generated_app.zig"),
        .target = target,
        .optimize = optimize,
    });
    root_mod.addOptions("build_options", options);

    const lib = b.addLibrary(.{
        .linkage = .dynamic,
        .name = lib_name,
        .root_module = root_mod,
    });
    lib.linkLibC();

    return lib;
}

// ── Dev shell executable (hot-reload host — full framework) ──────────────
//
// The dev shell binary contains the entire engine (SDL, wgpu, FreeType, etc.)
// and loads app code from a .so at runtime via dlopen. It checks the .so's
// mtime each frame and hot-reloads when it changes.

fn addDevShellExe(
    b: *std.Build,
    target: std.Build.ResolvedTarget,
    optimize: std.builtin.OptimizeMode,
    wgpu_mod: *std.Build.Module,
    sysroot: ?[]const u8,
) *std.Build.Step.Compile {
    const os = target.result.os.tag;

    const options = b.addOptions();
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
    options.addOption(bool, "has_blend2d", true);
    options.addOption(bool, "has_debug_server", true);

    const root_mod = b.createModule(.{
        .root_source_file = b.path("framework/dev_shell.zig"),
        .target = target,
        .optimize = optimize,
    });
    root_mod.addOptions("build_options", options);

    const exe = b.addExecutable(.{
        .name = "tsz-dev",
        .root_module = root_mod,
    });
    exe.stack_size = 16 * 1024 * 1024;

    // ── Same deps as addAppExe (.full tier) ──────────────────────
    exe.root_module.addImport("wgpu", wgpu_mod);
    exe.linkLibC();
    exe.linkSystemLibrary("SDL3");
    exe.linkSystemLibrary("freetype");
    exe.linkSystemLibrary("luajit-5.1");
    exe.linkSystemLibrary("X11");

    if (os == .linux) {
        exe.linkSystemLibrary("m");
        exe.linkSystemLibrary("pthread");
        exe.linkSystemLibrary("dl");
        if (sysroot) |sr| {
            exe.root_module.addIncludePath(.{ .cwd_relative = b.fmt("{s}/usr/include/freetype2", .{sr}) });
            exe.root_module.addIncludePath(.{ .cwd_relative = b.fmt("{s}/usr/include", .{sr}) });
            exe.root_module.addLibraryPath(.{ .cwd_relative = b.fmt("{s}/usr/lib", .{sr}) });
        } else {
            exe.root_module.addIncludePath(.{ .cwd_relative = "/usr/include/freetype2" });
            exe.root_module.addIncludePath(.{ .cwd_relative = "/usr/include/x86_64-linux-gnu" });
        }
    } else if (os == .macos) {
        exe.root_module.addLibraryPath(.{ .cwd_relative = "/opt/homebrew/lib" });
        exe.root_module.addIncludePath(.{ .cwd_relative = "/opt/homebrew/include" });
        exe.root_module.addIncludePath(.{ .cwd_relative = "/opt/homebrew/include/freetype2" });
    }

    exe.root_module.addIncludePath(b.path("."));
    exe.root_module.addIncludePath(b.path("../love2d/quickjs"));
    exe.root_module.addIncludePath(b.path("ffi"));

    // stb_image
    exe.root_module.addCSourceFile(.{ .file = b.path("stb/stb_image_impl.c"), .flags = &.{"-O2"} });

    // Full tier C sources
    exe.root_module.addCSourceFiles(.{
        .root = b.path("../love2d/quickjs"),
        .files = &.{ "cutils.c", "dtoa.c", "libregexp.c", "libunicode.c", "quickjs.c", "quickjs-libc.c" },
        .flags = &.{ "-O2", "-D_GNU_SOURCE", "-DQUICKJS_NG_BUILD" },
    });
    exe.root_module.addCSourceFile(.{ .file = b.path("stb/stb_image_write_impl.c"), .flags = &.{"-O2"} });
    exe.root_module.addCSourceFile(.{ .file = b.path("ffi/clock_shim.c"), .flags = &.{"-O2"} });
    exe.root_module.addCSourceFile(.{ .file = b.path("ffi/compute_shim.c"), .flags = &.{"-O2"} });
    exe.root_module.addCSourceFile(.{ .file = b.path("ffi/supervisor_shim.c"), .flags = &.{"-O2"} });
    exe.root_module.addCSourceFile(.{ .file = b.path("ffi/physics_shim.cpp"), .flags = &.{"-O2"} });
    exe.root_module.addCSourceFile(.{ .file = b.path("ffi/lua_worker_shim.c"), .flags = &.{"-O2"} });
    exe.root_module.addIncludePath(b.path("ffi"));
    exe.root_module.addIncludePath(.{ .cwd_relative = "/usr/include/luajit-2.1" });
    exe.linkSystemLibrary("luajit-5.1");
    exe.linkSystemLibrary("box2d");
    exe.linkSystemLibrary("sqlite3");
    exe.linkSystemLibrary("vterm");
    exe.linkSystemLibrary("curl");
    exe.linkSystemLibrary("archive");

    // ── Blend2D (2D vector graphics engine) ──
    exe.root_module.addIncludePath(b.path("../blend2d"));
    exe.addObjectFile(b.path("../blend2d/build/libblend2d_full.a"));
    exe.linkLibCpp();

    // ── Vello CPU (anti-aliased 2D path rendering via Rust FFI) ──
    exe.addObjectFile(b.path("../deps/vello_ffi/target/release/libvello_ffi_stripped.a"));

    if (os == .linux) {
        if (sysroot) |sr| {
            exe.root_module.addIncludePath(.{ .cwd_relative = b.fmt("{s}/usr/include", .{sr}) });
        } else {
            exe.root_module.addIncludePath(.{ .cwd_relative = "/usr/include/x86_64-linux-gnu" });
        }
    } else if (os == .macos) {
        exe.root_module.addIncludePath(.{ .cwd_relative = "/opt/homebrew/include" });
    }

    return exe;
}
