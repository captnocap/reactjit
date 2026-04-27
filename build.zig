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
    // ── Native-library feature gates ───────────────────────────
    // These mirror sdk/dependency-registry.json. The resolver
    // (scripts/sdk-dependency-resolve.js) inspects each cart's metafile
    // and emits -Dhas-X=true only for features the cart's source actually
    // triggers. Every gate here defaults to false; scripts/dev uses the
    // resolver's --dev-zig-flags mode to force them all on for the fat
    // dev host. Each gate must guard both the library link/include and
    // any framework code site that references the library's symbols.
    const has_physics = b.option(bool, "has-physics", "Link box2d + physics2d module") orelse false;
    const has_sqlite = b.option(bool, "has-sqlite", "Link sqlite3 + real sqlite.zig (otherwise stub)") orelse false;
    const has_terminal = b.option(bool, "has-terminal", "Link libvterm + real vterm.zig (otherwise stub)") orelse false;

    // Bundle path override. When unset, v8_app.zig falls back to embedding
    // bundle-<app-name>.js relative to its own source directory (the
    // in-repo case). When set (e.g. by rjit-driven builds where the user's
    // cart lives outside the SDK install), this absolute path is used by
    // @embedFile so the bundle can sit in CART_ROOT while build.zig and
    // v8_app.zig live in RJIT_HOME.
    const bundle_path = b.option([]const u8, "bundle-path", "Absolute path to the cart bundle (overrides default bundle-<app-name>.js lookup)") orelse "";

    const options = b.addOptions();
    options.addOption(bool, "is_lib", false);
    options.addOption([]const u8, "app_name", app_name);
    options.addOption(bool, "dev_mode", dev_mode);
    options.addOption(bool, "custom_chrome", custom_chrome);
    options.addOption(bool, "has_quickjs", true);
    options.addOption(bool, "has_physics", has_physics);
    options.addOption(bool, "has_sqlite", has_sqlite);
    options.addOption(bool, "has_terminal", has_terminal);
    options.addOption([]const u8, "bundle_path", bundle_path);
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
    if (v8_dep_opt) |v8_dep| {
        root_mod.addImport("v8", v8_dep.module("v8"));
        // libc_v8.a is prebuilt and missing the SetStackLimit binding. We
        // need it to grow V8's per-isolate stack budget past the ~700KB
        // default (see framework/ffi/v8_stack_shim.cpp for the full why).
        // The shim calls V8's mangled symbol directly so it doesn't need V8
        // headers — those aren't checked into deps/zig-v8.
        root_mod.addCSourceFile(.{
            .file = b.path("framework/ffi/v8_stack_shim.cpp"),
            .flags = &.{ "-O2", "-std=c++17" },
        });
    }

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

    // ── stb image read + write ────────────────────────────────
    // stbi_load_from_memory powers image_cache.zig (the <Image> primitive).
    // stbi_write_png powers capture/witness screenshotting.
    root_mod.addCSourceFile(.{ .file = b.path("stb/stb_image_impl.c"), .flags = &.{"-O2"} });
    root_mod.addCSourceFile(.{ .file = b.path("stb/stb_image_write_impl.c"), .flags = &.{"-O2"} });

    // ── Framework FFI shims ────────────────────────────────────
    root_mod.addCSourceFile(.{ .file = b.path("framework/ffi/compute_shim.c"), .flags = &.{"-O2"} });
    if (has_physics) {
        root_mod.addCSourceFile(.{ .file = b.path("framework/ffi/physics_shim.cpp"), .flags = &.{"-O2"} });
    }

    // ── System libraries ──────────────────────────────────────
    if (has_physics) exe.linkSystemLibrary("box2d");
    if (has_sqlite) exe.linkSystemLibrary("sqlite3");
    if (has_terminal) exe.linkSystemLibrary("vterm");
    exe.linkSystemLibrary("curl");

    // ── Privacy / libsodium (opt-in per cart) ─────────────────
    // Source-driven: cart bundle that imports usePrivacy gets libsodium
    // linked + bundled. Cart that doesn't, doesn't pay for it. scripts/ship
    // greps the bundle and passes -Dhas-privacy.
    const has_privacy = b.option(bool, "has-privacy", "Link libsodium + privacy bindings") orelse false;
    options.addOption(bool, "has_privacy", has_privacy);
    if (has_privacy) {
        exe.linkSystemLibrary("sodium");
        if (os_tag == .linux) {
            const brew_sodium = "/home/linuxbrew/.linuxbrew/Cellar/libsodium/1.0.20/include";
            if (std.fs.cwd().access(brew_sodium, .{})) |_| {
                root_mod.addIncludePath(.{ .cwd_relative = brew_sodium });
                root_mod.addLibraryPath(.{ .cwd_relative = "/home/linuxbrew/.linuxbrew/Cellar/libsodium/1.0.20/lib" });
            } else |_| {}
        }
    }

    // ── useHost domain bindings (opt-in per cart) ─────────────
    // Source-driven: cart only pays for the V8 bindings it actually uses.
    // scripts/ship greps the bundle for `__proc_`, `__httpsrv_`, `__wssrv_`
    // and passes the matching flags. Without these gates, every cart eats
    // ~hundreds of host-fn registrations on startup whether it uses them
    // or not — and that load corrupted V8's Function::Call path on
    // 2026-04-25 (see "Function.call broken on every cart" debugging log).
    const has_process = b.option(bool, "has-process", "Register __proc_*/__env_* bindings") orelse false;
    const has_httpsrv = b.option(bool, "has-httpsrv", "Register __httpsrv_* bindings") orelse false;
    const has_wssrv = b.option(bool, "has-wssrv", "Register __wssrv_* bindings") orelse false;
    const has_net = b.option(bool, "has-net", "Register __tcp_*/__udp_*/__socks5_* bindings") orelse false;
    const has_tor = b.option(bool, "has-tor", "Register __tor_* bindings") orelse false;
    const has_fs = b.option(bool, "has-fs", "Register __fs_*/__window_* bindings") orelse false;
    const has_websocket = b.option(bool, "has-websocket", "Register __ws_* (client) bindings") orelse false;
    const has_telemetry = b.option(bool, "has-telemetry", "Register __tel_*/getFps/... bindings") orelse false;
    const has_zigcall = b.option(bool, "has-zigcall", "Register __zig_call/__zig_call_list bindings") orelse false;
    const has_sdk = b.option(bool, "has-sdk", "Register __http_request_*/__fetch/__claude_*/__kimi_*/__localai_*/__browser_*/__ipc_*/__play_*/__rec_* bindings") orelse false;
    options.addOption(bool, "has_process", has_process);
    options.addOption(bool, "has_httpsrv", has_httpsrv);
    options.addOption(bool, "has_wssrv", has_wssrv);
    options.addOption(bool, "has_net", has_net);
    options.addOption(bool, "has_tor", has_tor);
    options.addOption(bool, "has_fs", has_fs);
    options.addOption(bool, "has_websocket", has_websocket);
    options.addOption(bool, "has_telemetry", has_telemetry);
    options.addOption(bool, "has_zigcall", has_zigcall);
    options.addOption(bool, "has_sdk", has_sdk);

    // ── Allergen label: V8 binding manifest ───────────────────────────
    // Writes one file per opt-in domain to zig-out/manifest/<name>.flag
    // with content "1" or "0" depending on whether that ingredient was
    // compiled into the binary. scripts/ship reads these post-build and
    // diffs against the cart's pre-build declaration. Any mismatch and
    // the binary is deleted before it can ship — the kitchen cannot
    // contradict the label on the package.
    const manifest_wf = b.addWriteFiles();
    _ = manifest_wf.add("v8-ingredients/privacy.flag", if (has_privacy) "1\n" else "0\n");
    _ = manifest_wf.add("v8-ingredients/process.flag", if (has_process) "1\n" else "0\n");
    _ = manifest_wf.add("v8-ingredients/httpsrv.flag", if (has_httpsrv) "1\n" else "0\n");
    _ = manifest_wf.add("v8-ingredients/wssrv.flag", if (has_wssrv) "1\n" else "0\n");
    _ = manifest_wf.add("v8-ingredients/net.flag", if (has_net) "1\n" else "0\n");
    _ = manifest_wf.add("v8-ingredients/tor.flag", if (has_tor) "1\n" else "0\n");
    _ = manifest_wf.add("v8-ingredients/fs.flag", if (has_fs) "1\n" else "0\n");
    _ = manifest_wf.add("v8-ingredients/websocket.flag", if (has_websocket) "1\n" else "0\n");
    _ = manifest_wf.add("v8-ingredients/telemetry.flag", if (has_telemetry) "1\n" else "0\n");
    _ = manifest_wf.add("v8-ingredients/zigcall.flag", if (has_zigcall) "1\n" else "0\n");
    _ = manifest_wf.add("v8-ingredients/sdk.flag", if (has_sdk) "1\n" else "0\n");
    const install_manifest = b.addInstallDirectory(.{
        .source_dir = manifest_wf.getDirectory(),
        .install_dir = .prefix,
        .install_subdir = "manifest",
    });
    b.getInstallStep().dependOn(&install_manifest.step);

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
    app_step.dependOn(&install_manifest.step);

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

    // ── v8-cli: standalone V8 host that runs a JS file ─────────
    // No SDL / framework / UI. Used to replace `node scripts/X.mjs` calls so
    // the repo has zero npm/node dependencies. Reuses v8_runtime.zig and the
    // CLI-only bindings in framework/v8_bindings_cli.zig.
    const v8_cli_mod = b.createModule(.{
        .root_source_file = b.path("v8_cli.zig"),
        .target = target,
        .optimize = optimize,
    });
    v8_cli_mod.addImport("v8", v8_mod);

    const v8_cli_exe = b.addExecutable(.{
        .name = "v8cli",
        .root_module = v8_cli_mod,
    });
    v8_cli_exe.linkLibC();
    v8_cli_exe.linkLibCpp();

    const v8_cli_step = b.step("v8-cli", "Build standalone V8 script host (zig-out/bin/v8cli)");
    v8_cli_step.dependOn(&b.addInstallArtifact(v8_cli_exe, .{}).step);

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
    if (has_physics) {
        bridge_mod.addCSourceFile(.{ .file = b.path("framework/ffi/physics_shim.cpp"), .flags = &.{"-O2"} });
    }

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
    if (has_physics) luajit_runtime_test.linkSystemLibrary("box2d");
    if (has_sqlite) luajit_runtime_test.linkSystemLibrary("sqlite3");
    if (has_terminal) luajit_runtime_test.linkSystemLibrary("vterm");
    luajit_runtime_test.linkSystemLibrary("curl");
    luajit_runtime_test.linkLibCpp();

    const run_luajit_runtime_test = b.addRunArtifact(luajit_runtime_test);
    const luajit_runtime_test_step = b.step("test-luajit-runtime", "Run the LuaJIT runtime integration test");
    luajit_runtime_test_step.dependOn(&run_luajit_runtime_test.step);
}
