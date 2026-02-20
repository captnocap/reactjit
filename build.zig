//! iLoveReact — build.zig
//!
//! Compiles all native C artifacts via zig cc with full cross-compilation support.
//! Replaces the gcc-based Makefile targets for C code.
//!
//! Usage:
//!   zig build                          → libquickjs + ft_helper for native host (debug)
//!   zig build -Doptimize=ReleaseFast   → optimized
//!   zig build libquickjs               → QuickJS shared library only
//!   zig build ft-helper                → FreeType bridge (requires freetype2 on host)
//!   zig build cartridge                → CartridgeOS PID 1 (x86_64-linux-musl, static)
//!   zig build all                      → all of the above
//!
//! Cross-compilation:
//!   zig build libquickjs -Dtarget=x86_64-macos
//!   zig build libquickjs -Dtarget=aarch64-macos
//!   zig build libquickjs -Dtarget=x86_64-windows-gnu
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
            .optimize = .ReleaseSafe,
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
}
