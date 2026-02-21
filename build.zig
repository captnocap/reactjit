//! ReactJIT — build.zig
//!
//! Compiles all native C artifacts via zig cc with full cross-compilation support.
//! Replaces the gcc-based Makefile targets for C code.
//!
//! Usage:
//!   zig build                          → libquickjs + ft_helper + blake3 for native host (debug)
//!   zig build -Doptimize=ReleaseFast   → optimized
//!   zig build libquickjs               → QuickJS shared library only
//!   zig build ft-helper                → FreeType bridge (FreeType compiled from source)
//!   zig build blake3                   → BLAKE3 hash library
//!   zig build cartridge                → CartridgeOS PID 1 (x86_64-linux-musl, static)
//!   zig build all                      → all of the above
//!
//! Cross-compilation (all steps respect -Dtarget):
//!   zig build all -Dtarget=x86_64-windows-gnu
//!   zig build all -Dtarget=aarch64-linux-gnu
//!   zig build all -Dtarget=x86_64-macos
//!   zig build all -Dtarget=aarch64-macos
//!   zig build win-launcher  → zig-out/bin/ilr-launcher.exe (always x86_64-windows)
//!
//! Outputs → zig-out/lib/ (shared libraries) and zig-out/cartridge/ (init binary).
//! The Makefile cli-setup target copies from zig-out/lib/ into cli/runtime/lib/.

const std = @import("std");

pub fn build(b: *std.Build) void {
    const optimize = b.standardOptimizeOption(.{});
    const target = b.standardTargetOptions(.{});

    const all_step = b.step("all", "Build all native artifacts");

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
        lib.addIncludePath(b.path("quickjs"));
        lib.addCSourceFiles(.{
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

        // Our FFI shim — canonical copy in native/quickjs-shim/ (tracked in
        // git). build.zig references it directly — no manual cp step needed.
        lib.addCSourceFile(.{
            .file = b.path("native/quickjs-shim/qjs_ffi_shim.c"),
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

    // ── ft_helper ─────────────────────────────────────────────────────────
    // Thin FreeType wrapper for LuaJIT FFI — glyph rasterization and text
    // measurement for the SDL2 rendering target.
    //
    // FreeType is compiled from source (fetched via build.zig.zon) so that
    // ft_helper cross-compiles to any target without a system FreeType install.
    {
        // FreeType 2.13.3 source fetched by zig fetch --save
        const ft_src = b.dependency("freetype", .{});
        const ft_root = ft_src.path(".");

        const mod = b.createModule(.{
            .target = target,
            .optimize = optimize,
        });

        const lib = b.addLibrary(.{
            .name = "ft_helper",
            .linkage = .dynamic,
            .root_module = mod,
        });

        // FreeType minimal build — only the modules ft_helper.c actually uses:
        //   FT_Init_FreeType, FT_New_Face, FT_Set_Pixel_Sizes,
        //   FT_Load_Char (FT_LOAD_RENDER / FT_LOAD_ADVANCE_ONLY), FT_Render_Glyph
        // Custom ftmodule.h must come BEFORE FreeType's own include dir so the
        // preprocessor finds our module list (only TTF/OTF drivers) first.
        // See vendor/freetype-config/freetype/config/ftmodule.h.
        lib.addIncludePath(b.path("vendor/freetype-config"));
        lib.addIncludePath(ft_root.path(b, "include"));
        // Stub hb.h: satisfies FreeType 2.13.3's unconditional #include <hb.h>
        // in autofit/ft-hb.h. HarfBuzz is disabled (not defined in ftoption.h).
        lib.addIncludePath(b.path("vendor/stubs"));
        lib.addCSourceFiles(.{
            .root = ft_root,
            .files = &.{
                // Base layer
                "src/base/ftsystem.c",
                "src/base/ftinit.c",
                "src/base/ftdebug.c",
                "src/base/ftbase.c",
                "src/base/ftbitmap.c",
                "src/base/ftglyph.c",
                "src/base/ftmm.c",       // FT_Set_Named_Instance (variable fonts)
                // Gzip support (many system fonts are gzip-compressed)
                "src/gzip/ftgzip.c",
                // Font drivers (TTF/OTF + PostScript)
                "src/truetype/truetype.c",
                "src/cff/cff.c",
                "src/type1/type1.c",
                "src/sfnt/sfnt.c",
                // Rasterizers
                "src/smooth/smooth.c",
                "src/raster/raster.c",
                // Hinting + PostScript support
                "src/autofit/autofit.c",
                "src/psaux/psaux.c",
                "src/psnames/psnames.c",
                "src/pshinter/pshinter.c",
            },
            .flags = &.{
                "-O2",
                // FT2_BUILD_LIBRARY: required when building FreeType from source
                // (as opposed to using it as a consumer).
                "-DFT2_BUILD_LIBRARY",
                // Optional deps (PNG, Bzip2, Brotli, HarfBuzz) are all commented
                // out in FreeType's default ftoption.h — do NOT define them at
                // all. -DX=0 would *define* the macro, making #ifdef X true.
            },
        });

        // ft_helper.c itself
        lib.addIncludePath(ft_root.path(b, "include"));
        lib.addCSourceFile(.{
            .file = b.path("lua/sdl2_ft_helper.c"),
            .flags = &.{"-O2"},
        });

        lib.linkLibC();

        const install = b.addInstallArtifact(lib, .{});
        b.getInstallStep().dependOn(&install.step);

        const step = b.step("ft-helper", "Build ft_helper + FreeType from source (fully cross-compilable)");
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

        blake3_lib.addIncludePath(b.path("third_party/blake3"));

        const blake3_os = target.result.os.tag;
        const blake3_arch = target.result.cpu.arch;
        const blake3_use_asm = blake3_arch == .x86_64 and blake3_os != .windows;

        // Core portable sources (always included).
        // Non-assembly builds define BLAKE3_NO_* so dispatch.c doesn't reference
        // SIMD functions that aren't linked in.
        const blake3_portable_flags: []const []const u8 = if (blake3_use_asm)
            &.{"-O3"}
        else
            &.{ "-O3", "-DBLAKE3_NO_SSE2", "-DBLAKE3_NO_SSE41", "-DBLAKE3_NO_AVX2", "-DBLAKE3_NO_AVX512" };

        blake3_lib.addCSourceFiles(.{
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
            blake3_lib.addAssemblyFile(b.path("third_party/blake3/blake3_sse2_x86-64_unix.S"));
            blake3_lib.addAssemblyFile(b.path("third_party/blake3/blake3_sse41_x86-64_unix.S"));
            blake3_lib.addAssemblyFile(b.path("third_party/blake3/blake3_avx2_x86-64_unix.S"));
            blake3_lib.addAssemblyFile(b.path("third_party/blake3/blake3_avx512_x86-64_unix.S"));
        }
        // Windows + aarch64: portable C only. Still fast — the portable
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

        exe.addCSourceFile(.{
            .file = b.path("experiments/cartridge-os/init.c"),
            .flags = &.{"-O2"},
        });
        exe.addCSourceFile(.{
            .file = b.path("experiments/cartridge-os/tweetnacl.c"),
            .flags = &.{"-O2"},
        });
        exe.addCSourceFile(.{
            .file = b.path("experiments/cartridge-os/sha512.c"),
            .flags = &.{"-O2"},
        });

        exe.addIncludePath(b.path("experiments/cartridge-os"));

        // musl target + linkLibC() = static musl link. No -static flag needed.
        exe.linkLibC();

        const install = b.addInstallArtifact(exe, .{
            .dest_dir = .{ .override = .{ .custom = "cartridge" } },
        });

        const step = b.step("cartridge", "Build CartridgeOS PID 1 (x86_64-linux-musl static)");
        step.dependOn(&install.step);
        all_step.dependOn(&install.step);
    }

    // ── win-launcher ──────────────────────────────────────────────────────────
    // Self-extracting Windows launcher stub. Always targets x86_64-windows
    // regardless of the host -Dtarget flag. SUBSYSTEM:WINDOWS so no console.
    // Output: zig-out/bin/ilr-launcher.exe
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
            .name = "ilr-launcher",
            .root_module = mod,
        });

        exe.root_module.root_source_file = b.path("native/win-launcher/launcher.zig");
        exe.subsystem = .Windows; // no console window

        const install = b.addInstallArtifact(exe, .{});
        b.getInstallStep().dependOn(&install.step);

        const step = b.step("win-launcher", "Build Windows self-extracting launcher stub");
        step.dependOn(&install.step);
    }
}
