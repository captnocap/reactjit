//! ReactJIT — build.zig
//!
//! Compiles all native C artifacts via zig cc with full cross-compilation support.
//! Replaces the gcc-based Makefile targets for C code.
//!
//! Usage:
//!   zig build                          → libquickjs + blake3 for native host (debug)
//!   zig build -Doptimize=ReleaseFast   → optimized
//!   zig build libquickjs               → QuickJS shared library only
//!   zig build blake3                   → BLAKE3 hash library
//!   zig build cartridge                → CartridgeOS PID 1 (x86_64-linux-musl, static)
//!   zig build overlay-hook             → LD_PRELOAD game overlay hook (Linux .so)
//!   zig build all                      → all of the above
//!
//! Cross-compilation (all steps respect -Dtarget):
//!   zig build all -Dtarget=x86_64-windows-gnu
//!   zig build all -Dtarget=aarch64-linux-gnu
//!   zig build all -Dtarget=x86_64-macos
//!   zig build all -Dtarget=aarch64-macos
//!   zig build win-launcher  → zig-out/bin/rjit-launcher.exe (always x86_64-windows)
//!
//! Outputs → zig-out/lib/ (shared libraries) and zig-out/cartridge/ (init binary).
//! The Makefile cli-setup target copies from zig-out/lib/ into cli/runtime/lib/.

const std = @import("std");

pub fn build(b: *std.Build) void {
    const optimize = b.standardOptimizeOption(.{});
    const target = b.standardTargetOptions(.{});

    const all_step = b.step("all", "Build all native artifacts");

    // ── wgpu-native dependency ───────────────────────────────────────────
    const wgpu_dep = b.dependency("wgpu_native_zig", .{
        .target = target,
        .optimize = optimize,
    });
    const wgpu_mod = wgpu_dep.module("wgpu");

    // ── libquickjs ────────────────────────────────────────────────────────
    // QuickJS JS engine + FFI shim. Loaded by LuaJIT via ffi.load() in
    // lua/bridge_quickjs.lua. Compiled from quickjs-ng source + our shim.
    {
        const mod = b.createModule(.{
            .target = target,
            .optimize = optimize,
        });

        const lib = b.addLibrary(.{
            .name = "quickjs",
            .linkage = .dynamic,
            .root_module = mod,
        });

        // quickjs-ng core sources. addIncludePath lets them resolve each other
        // via their internal #include "..." directives (no subdirectory prefix).
        mod.addIncludePath(b.path("quickjs"));
        mod.addCSourceFiles(.{
            .root = b.path("quickjs"),
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

        // Our FFI shim — canonical copy in love2d/native/quickjs-shim/ (tracked in
        // git). build.zig references it directly — no manual cp step needed.
        mod.addCSourceFile(.{
            .file = b.path("love2d/native/quickjs-shim/qjs_ffi_shim.c"),
            .flags = &.{ "-O2", "-D_GNU_SOURCE", "-DQUICKJS_NG_BUILD" },
        });

        lib.linkLibC();
        // -lm / -lpthread / -ldl are Linux/POSIX only.
        // macOS has them in libSystem; Windows has no equivalent.
        const os = target.result.os.tag;
        if (os == .linux) {
            lib.linkSystemLibrary("m");
            lib.linkSystemLibrary("pthread");
            lib.linkSystemLibrary("dl");
        }

        const install = b.addInstallArtifact(lib, .{});
        b.getInstallStep().dependOn(&install.step);

        const step = b.step("libquickjs", "Build libquickjs shared library");
        step.dependOn(&install.step);
        all_step.dependOn(&install.step);
    }

    // ── libblake3 ───────────────────────────────────────────────────────
    // BLAKE3 hash library from vendored C reference implementation.
    // Uses x86-64 assembly on unix, C intrinsics on Windows, portable C on aarch64.
    {
        const blake3_mod = b.createModule(.{
            .target = target,
            .optimize = optimize,
        });

        const blake3_lib = b.addLibrary(.{
            .name = "blake3",
            .linkage = .dynamic,
            .root_module = blake3_mod,
        });

        blake3_mod.addIncludePath(b.path("third_party/blake3"));

        const blake3_os = target.result.os.tag;
        const blake3_arch = target.result.cpu.arch;
        const blake3_use_asm = blake3_arch == .x86_64 and blake3_os != .windows;

        // Core portable sources (always included).
        // Non-assembly builds define BLAKE3_NO_* so dispatch.c doesn't reference
        // SIMD functions that aren't linked in.
        // aarch64 uses NEON intrinsics via blake3_neon.c (added below).
        const blake3_portable_flags: []const []const u8 = if (blake3_use_asm)
            &.{"-O3"}
        else if (blake3_arch == .aarch64)
            &.{ "-O3", "-DBLAKE3_NO_SSE2", "-DBLAKE3_NO_SSE41", "-DBLAKE3_NO_AVX2", "-DBLAKE3_NO_AVX512" }
        else
            &.{ "-O3", "-DBLAKE3_NO_SSE2", "-DBLAKE3_NO_SSE41", "-DBLAKE3_NO_AVX2", "-DBLAKE3_NO_AVX512" };

        blake3_mod.addCSourceFiles(.{
            .root = b.path("third_party/blake3"),
            .files = &.{
                "blake3.c",
                "blake3_dispatch.c",
                "blake3_portable.c",
            },
            .flags = blake3_portable_flags,
        });

        if (blake3_use_asm) {
            // Unix x86_64: hand-written assembly (fastest path)
            blake3_mod.addAssemblyFile(b.path("third_party/blake3/blake3_sse2_x86-64_unix.S"));
            blake3_mod.addAssemblyFile(b.path("third_party/blake3/blake3_sse41_x86-64_unix.S"));
            blake3_mod.addAssemblyFile(b.path("third_party/blake3/blake3_avx2_x86-64_unix.S"));
            blake3_mod.addAssemblyFile(b.path("third_party/blake3/blake3_avx512_x86-64_unix.S"));
        } else if (blake3_arch == .aarch64) {
            // aarch64: ARM NEON intrinsics (4-way parallel hashing)
            blake3_mod.addCSourceFile(.{
                .file = b.path("third_party/blake3/blake3_neon.c"),
                .flags = &.{"-O3"},
            });
        }
        // Windows x86: portable C only. Still fast — the portable
        // implementation uses compiler auto-vectorization.

        blake3_lib.linkLibC();

        const blake3_install = b.addInstallArtifact(blake3_lib, .{});
        b.getInstallStep().dependOn(&blake3_install.step);

        const blake3_step = b.step("blake3", "Build libblake3 shared library (cross-compilable)");
        blake3_step.dependOn(&blake3_install.step);
        all_step.dependOn(&blake3_install.step);
    }

    // ── CartridgeOS init (x86_64-linux-musl, static) ─────────────────────
    // PID 1 for bare-metal CartridgeOS. Statically linked against musl so it
    // runs on Alpine without host glibc. Cross-compiled from any platform.
    {
        const musl_target = b.resolveTargetQuery(.{
            .cpu_arch = .x86_64,
            .os_tag = .linux,
            .abi = .musl,
        });

        const mod = b.createModule(.{
            .target = musl_target,
            .optimize = .ReleaseFast,
        });

        const exe = b.addExecutable(.{
            .name = "init",
            .root_module = mod,
        });

        mod.addCSourceFile(.{
            .file = b.path("experiments/cartridge-os/init.c"),
            .flags = &.{"-O2"},
        });
        mod.addCSourceFile(.{
            .file = b.path("experiments/cartridge-os/tweetnacl.c"),
            .flags = &.{"-O2"},
        });
        mod.addCSourceFile(.{
            .file = b.path("experiments/cartridge-os/sha512.c"),
            .flags = &.{"-O2"},
        });

        mod.addIncludePath(b.path("experiments/cartridge-os"));

        // musl target + linkLibC() = static musl link. No -static flag needed.
        exe.linkLibC();

        const install = b.addInstallArtifact(exe, .{
            .dest_dir = .{ .override = .{ .custom = "cartridge" } },
        });

        const step = b.step("cartridge", "Build CartridgeOS PID 1 (x86_64-linux-musl static)");
        step.dependOn(&install.step);
        all_step.dependOn(&install.step);
    }

    // ── overlay-hook (LD_PRELOAD .so for fullscreen game overlay) ───────────
    // Intercepts glXSwapBuffers to composite ReactJIT overlay onto any OpenGL
    // game. Reads overlay pixels from POSIX shared memory. Linux-only (X11/GL).
    // Output: zig-out/lib/liboverlay_hook.so
    {
        const hook_os = target.result.os.tag;
        if (hook_os == .linux) {
            const mod = b.createModule(.{
                .target = target,
                .optimize = optimize,
            });

            const lib = b.addLibrary(.{
                .name = "overlay_hook",
                .linkage = .dynamic,
                .root_module = mod,
            });

            mod.addCSourceFile(.{
                .file = b.path("love2d/native/overlay-hook/overlay_hook.c"),
                .flags = &.{ "-O2", "-D_GNU_SOURCE" },
            });

            lib.linkLibC();
            lib.linkSystemLibrary("dl");  // dlsym(RTLD_NEXT)
            lib.linkSystemLibrary("rt");  // shm_open
            lib.linkSystemLibrary("GL");  // OpenGL

            const install = b.addInstallArtifact(lib, .{});

            const step = b.step("overlay-hook", "Build LD_PRELOAD overlay hook (.so, Linux only)");
            step.dependOn(&install.step);
            all_step.dependOn(&install.step);
        }
    }

    // ── Shared helper: link SDL2 + OpenGL + FreeType for tsz targets ────────
    // Platform-conditional: macOS uses frameworks + Homebrew paths,
    // Linux uses system libraries + /usr/include paths.
    const tsz_os = target.result.os.tag;

    // ── engine (Phase 0 — SDL2 + OpenGL native runtime) ─────────────────────
    // The beginning of the native TypeScript runtime. SDL2 window, OpenGL 3.3
    // core context, direct GPU painting. No Love2D, no LuaJIT, no QuickJS.
    // This is what replaces all of them.
    //
    // Usage: zig build engine && ./zig-out/bin/rjit-engine
    {
        const engine_exe = b.addExecutable(.{
            .name = "rjit-engine",
            .root_module = b.createModule(.{
                .root_source_file = b.path("tsz/runtime/framework/main.zig"),
                .target = target,
                .optimize = optimize,
            }),
        });

        engine_exe.linkLibC();
        engine_exe.linkSystemLibrary("SDL2");
        engine_exe.linkSystemLibrary("freetype");
        engine_exe.linkSystemLibrary("curl");
        if (tsz_os != .windows) engine_exe.linkSystemLibrary("vterm");
        engine_exe.root_module.addImport("wgpu", wgpu_mod);
        if (tsz_os == .macos) {
            engine_exe.root_module.addLibraryPath(.{ .cwd_relative = "/opt/homebrew/lib" });
            engine_exe.root_module.addIncludePath(.{ .cwd_relative = "/opt/homebrew/include" });
            engine_exe.root_module.addIncludePath(.{ .cwd_relative = "/opt/homebrew/include/freetype2" });
        } else if (tsz_os == .windows) {
            engine_exe.root_module.addLibraryPath(.{ .cwd_relative = "deps/windows/SDL2-2.30.12/lib/x64" });
            engine_exe.root_module.addIncludePath(.{ .cwd_relative = "deps/windows/SDL2-2.30.12/include" });
            engine_exe.root_module.addLibraryPath(.{ .cwd_relative = "deps/windows/freetype-windows-binaries-2.13.3/release dll/win64" });
            engine_exe.root_module.addIncludePath(.{ .cwd_relative = "deps/windows/freetype-windows-binaries-2.13.3/include" });
            engine_exe.root_module.addIncludePath(.{ .cwd_relative = "deps/windows/freetype-windows-binaries-2.13.3/include/freetype" });
        } else {
            engine_exe.root_module.addIncludePath(.{ .cwd_relative = "/usr/include/freetype2" });
            engine_exe.root_module.addIncludePath(.{ .cwd_relative = "/usr/include/x86_64-linux-gnu" });
        }
        engine_exe.root_module.addIncludePath(b.path("tsz/runtime"));
        engine_exe.root_module.addCSourceFile(.{
            .file = b.path("tsz/runtime/stb/stb_image_impl.c"),
            .flags = &.{"-O2"},
        });
        engine_exe.root_module.addCSourceFile(.{
            .file = b.path("tsz/runtime/stb/stb_image_write_impl.c"),
            .flags = &.{"-O2"},
        });

        const engine_install = b.addInstallArtifact(engine_exe, .{});

        const engine_step = b.step("engine", "Build ReactJIT native engine (SDL2 + OpenGL)");
        engine_step.dependOn(&engine_install.step);
        all_step.dependOn(&engine_install.step);

        // Run step: zig build run-engine
        const run_cmd = b.addRunArtifact(engine_exe);
        run_cmd.step.dependOn(b.getInstallStep());
        const run_step = b.step("run-engine", "Build and run the ReactJIT engine");
        run_step.dependOn(&run_cmd.step);
    }

    // ── engine-app (tsz-compiled application) ─────────────────────────────
    // Built from generated_app.zig (output of the tsz compiler).
    // The tsz compiler writes this file, then invokes `zig build engine-app`.
    {
        const app_exe = b.addExecutable(.{
            .name = "tsz-app",
            .root_module = b.createModule(.{
                .root_source_file = b.path("tsz/runtime/generated_app.zig"),
                .target = target,
                .optimize = optimize,
            }),
        });

        app_exe.linkLibC();
        app_exe.linkSystemLibrary("SDL2");
        app_exe.linkSystemLibrary("freetype");
        if (tsz_os != .windows) app_exe.linkSystemLibrary("mpv");
        app_exe.linkSystemLibrary("curl");
        if (tsz_os != .windows) app_exe.linkSystemLibrary("vterm");
        app_exe.root_module.addImport("wgpu", wgpu_mod);
        if (tsz_os == .macos) {
            app_exe.root_module.addLibraryPath(.{ .cwd_relative = "/opt/homebrew/lib" });
            app_exe.root_module.addIncludePath(.{ .cwd_relative = "/opt/homebrew/include" });
            app_exe.root_module.addIncludePath(.{ .cwd_relative = "/opt/homebrew/include/freetype2" });
        } else if (tsz_os == .windows) {
            app_exe.root_module.addLibraryPath(.{ .cwd_relative = "deps/windows/SDL2-2.30.12/lib/x64" });
            app_exe.root_module.addIncludePath(.{ .cwd_relative = "deps/windows/SDL2-2.30.12/include" });
            app_exe.root_module.addLibraryPath(.{ .cwd_relative = "deps/windows/freetype-windows-binaries-2.13.3/release dll/win64" });
            app_exe.root_module.addIncludePath(.{ .cwd_relative = "deps/windows/freetype-windows-binaries-2.13.3/include" });
            app_exe.root_module.addIncludePath(.{ .cwd_relative = "deps/windows/freetype-windows-binaries-2.13.3/include/freetype" });
        } else {
            app_exe.root_module.addIncludePath(.{ .cwd_relative = "/usr/include/freetype2" });
            app_exe.root_module.addIncludePath(.{ .cwd_relative = "/usr/include/x86_64-linux-gnu" });
        }
        app_exe.root_module.addIncludePath(b.path("tsz/runtime"));
        app_exe.root_module.addCSourceFile(.{
            .file = b.path("tsz/runtime/stb/stb_image_impl.c"),
            .flags = &.{"-O2"},
        });
        app_exe.root_module.addCSourceFile(.{
            .file = b.path("tsz/runtime/stb/stb_image_write_impl.c"),
            .flags = &.{"-O2"},
        });

        // ── FFI: link extra libraries from ffi_libs.txt ──────────────────
        // The tsz compiler writes one library name per line (e.g. "sqlite3").
        // If the file doesn't exist or is empty, no extra libs are linked.
        if (std.fs.cwd().openFile("tsz/runtime/ffi_libs.txt", .{})) |file| {
            defer file.close();
            var buf: [4096]u8 = undefined;
            const len = file.readAll(&buf) catch 0;
            const content = buf[0..len];
            var iter = std.mem.splitScalar(u8, content, '\n');
            while (iter.next()) |line| {
                const trimmed = std.mem.trim(u8, line, &[_]u8{ ' ', '\r', '\t' });
                if (trimmed.len > 0) {
                    app_exe.linkSystemLibrary(trimmed);
                }
            }
        } else |_| {}

        const app_install = b.addInstallArtifact(app_exe, .{});
        const app_step = b.step("engine-app", "Build a tsz-compiled application");
        app_step.dependOn(&app_install.step);
    }

    // ── tsz (compiler + project manager + GUI dashboard) ───────────────────
    // Compiler: reads .tsz files, parses, emits Zig, invokes zig build engine-app.
    // Manager: project registry, process lifecycle, status tracking.
    // GUI: SDL2 dashboard window using engine modules (layout, text, events).
    // One binary. No npm. No Node.js. No Lua.
    {
        const tsz_exe = b.addExecutable(.{
            .name = "tsz",
            .root_module = b.createModule(.{
                .root_source_file = b.path("tsz/compiler/main.zig"),
                .target = target,
                .optimize = optimize,
            }),
        });

        // GUI needs SDL2, FreeType, wgpu for rendering
        tsz_exe.linkLibC();
        tsz_exe.linkSystemLibrary("SDL2");
        tsz_exe.linkSystemLibrary("freetype");
        tsz_exe.root_module.addImport("wgpu", wgpu_mod);
        if (tsz_os == .macos) {
            tsz_exe.root_module.addLibraryPath(.{ .cwd_relative = "/opt/homebrew/lib" });
            tsz_exe.root_module.addIncludePath(.{ .cwd_relative = "/opt/homebrew/include" });
            tsz_exe.root_module.addIncludePath(.{ .cwd_relative = "/opt/homebrew/include/freetype2" });
        } else if (tsz_os == .windows) {
            tsz_exe.root_module.addLibraryPath(.{ .cwd_relative = "deps/windows/SDL2-2.30.12/lib/x64" });
            tsz_exe.root_module.addIncludePath(.{ .cwd_relative = "deps/windows/SDL2-2.30.12/include" });
            tsz_exe.root_module.addLibraryPath(.{ .cwd_relative = "deps/windows/freetype-windows-binaries-2.13.3/release dll/win64" });
            tsz_exe.root_module.addIncludePath(.{ .cwd_relative = "deps/windows/freetype-windows-binaries-2.13.3/include" });
            tsz_exe.root_module.addIncludePath(.{ .cwd_relative = "deps/windows/freetype-windows-binaries-2.13.3/include/freetype" });
        } else {
            tsz_exe.root_module.addIncludePath(.{ .cwd_relative = "/usr/include/freetype2" });
        }
        tsz_exe.root_module.addIncludePath(b.path("tsz/runtime"));
        tsz_exe.root_module.addCSourceFile(.{
            .file = b.path("tsz/runtime/stb/stb_image_impl.c"),
            .flags = &.{"-O2"},
        });
        tsz_exe.root_module.addCSourceFile(.{
            .file = b.path("tsz/runtime/stb/stb_image_write_impl.c"),
            .flags = &.{"-O2"},
        });

        // System tray needs GTK3 + libayatana-appindicator3 (Linux only)
        if (tsz_os == .linux) {
            tsz_exe.linkSystemLibrary("gtk-3");
            tsz_exe.linkSystemLibrary("gobject-2.0");
            tsz_exe.linkSystemLibrary("ayatana-appindicator3");
        }

        const tsz_install = b.addInstallArtifact(tsz_exe, .{});
        const tsz_step = b.step("tsz-compiler", "Build the native .tsz compiler");
        tsz_step.dependOn(&tsz_install.step);

        const tsz_run = b.addRunArtifact(tsz_exe);
        tsz_run.step.dependOn(b.getInstallStep());
        if (b.args) |a| { for (a) |arg| tsz_run.addArg(arg); }
        const run_tsz_step = b.step("run-tsz", "Run the native .tsz compiler");
        run_tsz_step.dependOn(&tsz_run.step);
    }

    // ── win-launcher ──────────────────────────────────────────────────────────
    // Self-extracting Windows launcher stub. Always targets x86_64-windows
    // regardless of the host -Dtarget flag. SUBSYSTEM:WINDOWS so no console.
    // Output: zig-out/bin/rjit-launcher.exe
    {
        const win_target = b.resolveTargetQuery(.{
            .cpu_arch = .x86_64,
            .os_tag = .windows,
            .abi = .gnu,
        });

        const mod = b.createModule(.{
            .target = win_target,
            .optimize = .ReleaseFast,
        });

        const exe = b.addExecutable(.{
            .name = "rjit-launcher",
            .root_module = mod,
        });

        exe.root_module.root_source_file = b.path("love2d/native/win-launcher/launcher.zig");
        exe.subsystem = .Windows; // no console window

        const install = b.addInstallArtifact(exe, .{});
        b.getInstallStep().dependOn(&install.step);

        const step = b.step("win-launcher", "Build Windows self-extracting launcher stub");
        step.dependOn(&install.step);
    }
}
