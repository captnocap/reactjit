# TSZ Platform Build Guide

This document is for Claude sessions on other machines. It contains everything needed to get tsz building on each target platform.

## What TSZ Is

A compiler + runtime that takes `.tsz` files (React-like syntax) and compiles them to native binaries via Zig. The compiler is pure Zig. The runtime links SDL2, OpenGL, and FreeType. stb_image is vendored (single header, no system dep).

## Current State

- **Linux x86_64**: fully working, daily driver
- **macOS ARM (M-series)**: fully working — engine, compiler, app pipeline all pass
- **Windows x86_64**: not yet attempted
- **Linux ARM (RPi 3/4/5)**: not yet attempted

## Architecture

```
build.zig          — root build file, defines all targets
tsz/compiler/      — the tsz compiler (lexer, parser, codegen, GUI, tray)
tsz/runtime/       — the rendering engine (layout, text, events, painter)
tsz/runtime/c.zig  — shared @cImport (SDL2, GL, FreeType, stb_image)
tsz/examples/      — .tsz demo apps
```

Three build targets matter:
- `zig build engine` — standalone runtime binary
- `zig build engine-app` — compiled .tsz app binary
- `zig build tsz-compiler` — the compiler itself (includes GUI dashboard + system tray)

## Runtime Dependencies

| Library | Purpose | System dep? |
|---------|---------|-------------|
| SDL2 | Windowing, input, rendering context | Yes |
| OpenGL | GPU rendering | Yes (driver) |
| FreeType | Font rasterization | Yes |
| stb_image | Image decoding (PNG/JPG/etc) | No — vendored in `tsz/runtime/stb/` |
| libmpv | Video playback | Optional, only in engine-app target |

## Compiler-only Dependencies (for GUI/tray)

| Library | Purpose | Platform |
|---------|---------|----------|
| GTK3 + GLib | System tray menu | Linux only |
| libayatana-appindicator3 | Tray icon | Linux only |

The tray is Linux-specific. On macOS, this needs to be stubbed out or replaced with NSStatusItem. On Windows, it needs the Win32 shell notification API. **For the initial build, just stub the tray out with `#ifdef`-style conditional compilation.**

---

## macOS ARM (M4) — Setup Guide

### Prerequisites

```bash
# Install Zig 0.15.x (match the version on Linux — check with `zig version`)
# Download from https://ziglang.org/download/ — pick aarch64-macos

# Install deps
brew install sdl2 freetype
# libmpv is optional: brew install mpv
```

### Known Issues to Fix

#### 1. OpenGL header path
`tsz/runtime/c.zig` currently includes:
```zig
@cInclude("GL/gl.h");
```
macOS uses:
```zig
@cInclude("OpenGL/gl.h");
```
This needs a platform conditional. Zig can do this:
```zig
const builtin = @import("builtin");
pub const imports = @cImport({
    @cInclude("SDL2/SDL.h");
    if (builtin.os.tag == .macos) {
        @cInclude("OpenGL/gl.h");
    } else {
        @cInclude("GL/gl.h");
    }
    @cInclude("ft2build.h");
    @cInclude("freetype/freetype.h");
    @cInclude("stb/stb_image.h");
});
```

#### 2. FreeType include path
`build.zig` hardcodes:
```zig
.addIncludePath(.{ .cwd_relative = "/usr/include/freetype2" });
```
On macOS with Homebrew this would be something like:
```
/opt/homebrew/include/freetype2
```
Use `pkg-config` or detect the OS in build.zig and set the right path. Better yet, use Zig's build system to query pkg-config:
```zig
// In build.zig, replace the hardcoded path with:
const os = target.result.os.tag;
if (os == .macos) {
    exe.root_module.addIncludePath(.{ .cwd_relative = "/opt/homebrew/include/freetype2" });
    exe.root_module.addIncludePath(.{ .cwd_relative = "/opt/homebrew/include" });
} else {
    exe.root_module.addIncludePath(.{ .cwd_relative = "/usr/include/freetype2" });
}
```

#### 3. OpenGL link name
`build.zig` links `GL`:
```zig
exe.linkSystemLibrary("GL");
```
macOS uses frameworks:
```zig
if (os == .macos) {
    exe.linkFramework("OpenGL");
} else {
    exe.linkSystemLibrary("GL");
}
```

#### 4. Homebrew library path
macOS ARM Homebrew installs to `/opt/homebrew`. Zig may not find SDL2/FreeType without:
```zig
if (os == .macos) {
    exe.root_module.addLibraryPath(.{ .cwd_relative = "/opt/homebrew/lib" });
    exe.root_module.addIncludePath(.{ .cwd_relative = "/opt/homebrew/include" });
}
```

#### 5. System tray (GTK3 + libayatana)
These don't exist on macOS. The compiler's tray functionality (`tsz/compiler/tray.zig`) needs to be conditionally compiled out on macOS:
- In `build.zig`: only link gtk-3, gobject-2.0, ayatana-appindicator3 on Linux
- In `compiler/main.zig` or wherever tray.zig is imported: gate the import and calls behind `builtin.os.tag == .linux`

The macOS equivalent would be NSStatusItem via Objective-C, but that's a future task. For now, just disable the tray on macOS.

#### 6. SDL2 header path
Homebrew SDL2 headers might be at `/opt/homebrew/include/SDL2/` — check if `@cInclude("SDL2/SDL.h")` resolves. If not, add the include path.

### Build test sequence

```bash
# From repo root:
zig build engine                    # Test 1: standalone runtime
zig build tsz-compiler              # Test 2: compiler (with tray stubbed)
./zig-out/bin/tsz build tsz/examples/counter.tsz   # Test 3: compile a .tsz app
./zig-out/bin/tsz-counter           # Test 4: run the compiled app
```

If all four pass, macOS is established.

### SDL2 header include style
macOS Homebrew SDL2 may expect `#include "SDL.h"` instead of `#include "SDL2/SDL.h"` depending on how pkg-config is set up. If `SDL2/SDL.h` doesn't resolve, try adding `/opt/homebrew/include/SDL2` as an include path so the `SDL2/SDL.h` include still works (it finds `SDL.h` inside the `SDL2/` directory within that path — but actually you'd need the parent). Check what Homebrew provides:
```bash
ls /opt/homebrew/include/SDL2/
pkg-config --cflags sdl2
```

---

## Windows x86_64 — Setup Guide

### Prerequisites

```
# Install Zig 0.15.x for Windows (x86_64)
# Download from https://ziglang.org/download/

# SDL2: download SDL2-devel-2.x.x-VC.zip from https://github.com/libsdl-org/SDL/releases
# FreeType: download from https://github.com/ubawurinna/freetype-windows-binaries or build with vcpkg
# Extract and note paths — will need to set include/lib paths in build.zig
```

### Known Issues to Fix

#### 1. OpenGL header
Windows uses:
```zig
@cInclude("GL/gl.h");  // same as Linux, but needs Windows SDK
```
This should actually just work if the Windows SDK is installed. OpenGL headers ship with it.

#### 2. Library linking
Windows SDL2 dev package provides `.lib` files. Zig can link against these:
```zig
if (os == .windows) {
    exe.addLibraryPath(.{ .cwd_relative = "deps/windows/SDL2/lib/x64" });
    exe.addIncludePath(.{ .cwd_relative = "deps/windows/SDL2/include" });
    exe.linkSystemLibrary("SDL2");
    exe.linkSystemLibrary("opengl32");  // not "GL"
    // FreeType similar — provide path to .lib
}
```

#### 3. System tray
Windows has its own tray API (Shell_NotifyIcon). Stub it out like macOS for now.

#### 4. OpenGL library name
Windows uses `opengl32`, not `GL`:
```zig
if (os == .windows) {
    exe.linkSystemLibrary("opengl32");
}
```

#### 5. No libmpv required
Make mpv linking conditional (it already sort of is, but make it explicit for Windows — skip it unless the user has it).

### Build test sequence

Same as macOS:
```
zig build engine
zig build tsz-compiler
.\zig-out\bin\tsz.exe build tsz\examples\counter.tsz
.\zig-out\bin\tsz-counter.exe
```

---

## Raspberry Pi (aarch64-linux) — Setup Guide

### Prerequisites

```bash
# Use 64-bit Raspberry Pi OS (aarch64)
# Install Zig 0.15.x for aarch64-linux

sudo apt install libsdl2-dev libfreetype-dev libmpv-dev  # optional: libmpv-dev
sudo apt install libgtk-3-dev libayatana-appindicator3-dev  # for tray
```

### Known Issues

This is the easiest port — it's still Linux, same headers, same library names. The only difference:

#### 1. FreeType include path
Should be `/usr/include/freetype2` same as x86_64 Linux. Verify with:
```bash
pkg-config --cflags freetype2
```

#### 2. OpenGL
RPi may use GLES instead of desktop GL. Check what SDL2 provides:
```bash
dpkg -l | grep libgl
```
If only GLES is available, the GL header include and some GL calls may need adjustment. Modern RPi OS on Pi 4/5 should have desktop GL via Mesa though.

#### 3. Performance
Pi 3 is aarch64 but weak. The Zig compiler itself runs on the Pi, and compilation takes longer. The runtime should be fine — it's 2D boxes and text.

### Build test sequence

Same as Linux x86_64:
```bash
zig build engine
zig build tsz-compiler
./zig-out/bin/tsz build tsz/examples/counter.tsz
./zig-out/bin/tsz-counter
```

---

## General Strategy

The changes needed are almost entirely in two files:
1. **`build.zig`** — platform-conditional library linking and include paths
2. **`tsz/runtime/c.zig`** — platform-conditional GL header include

The runtime Zig code (`layout.zig`, `text.zig`, `events.zig`, etc.) should not need any changes — it talks to SDL2/GL/FreeType through the `c.zig` abstraction, and those APIs are cross-platform.

The compiler code (`compiler/*.zig`) needs the tray stubbed out on non-Linux, but the core compiler (lexer, codegen) is pure Zig with zero platform dependencies.

**After each platform is established, commit the build.zig and c.zig changes back and push.** The platform conditionals accumulate — by the time all four are done, build.zig handles everything.

## Zig Version

**Pin to Zig 0.15.x across all platforms.** Download the same minor version everywhere. Zig pre-1.0 breaks between minor versions. The build.zig API, std library, and @cImport behavior can all change. Don't mix versions.

Current version on Linux: check with `zig version` (0.15.2 as of writing).
