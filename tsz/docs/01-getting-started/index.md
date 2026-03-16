---
title: Getting Started
description: Install tsz, write your first app, and run it as a native binary in under five minutes.
category: Getting Started
keywords: install, setup, first app, counter, tsz build, tsz run, zig build
difficulty: beginner
---

## Overview

tsz is a code generator: it reads `.tsz` files — React-style components — and emits Zig source code. The Zig compiler then compiles that source into a native binary. There is no runtime, no interpreter, no virtual DOM. Every `<Box>`, every `useState`, every `onPress` is resolved at compile time into flat Zig. The `.tsz` file ceases to exist at runtime.

The pipeline is:

```
.tsz source → [tsz codegen] → generated_app.zig → [zig compiler] → native binary
```

Two binaries drive the whole system: `tsz` (the code generator) and `zig` (the compiler). That's it. No Node, no npm, no Lua, no QuickJS.

## System Dependencies

Install these before building anything:

| Dependency | Version | Purpose |
|------------|---------|---------|
| Zig | 0.15.2 | Compiler — must be exactly this version |
| SDL2 | any recent | Windowing and input events |
| FreeType | any recent | Font rasterization |
| wgpu-native | vendored | GPU rendering via Vulkan/Metal/DX12 |
| libmpv | optional | Video playback only |

On Ubuntu/Debian:

```bash
sudo apt install libsdl2-dev libfreetype-dev
```

On macOS (Homebrew):

```bash
brew install sdl2 freetype
```

Zig 0.15.2 must be installed from [ziglang.org/download](https://ziglang.org/download/) or your package manager. Earlier versions will not work — the build system uses 0.15.2 APIs.

wgpu-native is vendored as a build dependency and fetched automatically by `zig build`.

## Building the Compiler

All build commands run from the **repo root** (the directory containing `build.zig`):

```bash
zig build tsz-compiler
```

This produces `zig-out/bin/tsz`. On first run, the compiler will offer to symlink itself into `~/.local/bin/tsz` so you can call it from anywhere. Accept with Enter.

To build an optimized compiler (faster compilation, smaller binary):

```bash
zig build tsz-compiler -Doptimize=ReleaseSmall
```

Verify it works:

```bash
./zig-out/bin/tsz
```

You should see the command list. If you accepted the PATH install, `tsz` alone works from any directory.

## Your First App

Save this as `counter.tsz`:

```tsz
function App() {
  const [count, setCount] = useState(0);

  return (
    <Box style={{ width: 400, padding: 32, flexDirection: 'column', gap: 16, backgroundColor: '#1e1e2a' }}>
      <Text fontSize={28} color="#ffffff">Counter</Text>
      <Text fontSize={48} color="#ff79c6">{`${count}`}</Text>
      <Box style={{ flexDirection: 'row', gap: 10 }}>
        <Pressable onPress={() => setCount(count + 1)} style={{ flexGrow: 1, padding: 16, backgroundColor: '#4ec9b0' }}>
          <Text fontSize={16} color="#ffffff">+ Increment</Text>
        </Pressable>
        <Pressable onPress={() => setCount(count - 1)} style={{ flexGrow: 1, padding: 16, backgroundColor: '#eb5757' }}>
          <Text fontSize={16} color="#ffffff">- Decrement</Text>
        </Pressable>
      </Box>
      <Pressable onPress={() => setCount(0)} style={{ padding: 12, backgroundColor: '#282838' }}>
        <Text fontSize={14} color="#78788c">Reset to 0</Text>
      </Pressable>
    </Box>
  );
}
```

This is the complete app. No imports, no boilerplate — the primitives (`Box`, `Text`, `Pressable`) and `useState` are available globally. The entry point is always the `App` function.

## Running It

```bash
tsz run counter.tsz
```

This compiles the app to `generated_app.zig`, runs `zig build engine-app`, copies the binary to `zig-out/bin/tsz-counter`, and launches it. A window opens with the counter. Click the buttons — state updates and the display re-renders immediately.

`tsz run` kills any existing instance of the same app before relaunching. It's safe to run repeatedly.

## Watch Mode

During development, `tsz dev` watches for file saves and relaunches automatically:

```bash
tsz dev counter.tsz
```

Save the file — the running app is killed, recompiled, and relaunched. Compile errors are printed to the terminal without touching the running app.

## Building a Release Binary

`tsz run` builds in release mode by default (ReleaseSmall). The binary is already at `zig-out/bin/tsz-counter` after any `tsz run` or `tsz build`.

To build without running:

```bash
tsz build counter.tsz
```

To build manually at a specific optimization level, you can invoke the Zig step directly after the tsz codegen step has run:

```bash
tsz build counter.tsz                              # generates zig source + builds
zig build engine-app -Doptimize=ReleaseSmall       # rebuild at specific level
```

The resulting binary at `zig-out/bin/tsz-counter` has no runtime dependencies beyond the system libraries (SDL2, FreeType). Ship it as a single file.

To build in debug mode (larger binary, better error messages):

```bash
tsz build counter.tsz --debug
```

## Scaffolding a New Project

`tsz init` creates a directory with a starter `app.tsz` and registers the project:

```bash
tsz init myapp
```

This writes `myapp/app.tsz` with an increment/decrement counter template and registers the project so `tsz ls` picks it up. Then:

```bash
tsz run myapp/app.tsz
```

## What Gets Generated

When you run `tsz build counter.tsz`, the compiler writes two files:

- `tsz/runtime/generated_app.zig` — the Zig source for your app (a `pub fn main()` with SDL window creation, event loop, layout engine calls, and your component tree as Zig struct literals)
- `tsz/runtime/ffi_libs.txt` — extra system libraries to link, if your app uses `@ffi` directives

The Zig compiler then builds `generated_app.zig` as the `engine-app` target. The `.tsz` source is not needed after this point — the binary is entirely self-contained Zig.

## Internals

The `tsz build` pipeline in detail:

1. `tsz` reads `counter.tsz` and any imported `.tsz` files, merging them into one source string
2. The lexer tokenizes the merged source
3. The codegen emitter walks the AST and emits Zig: JSX elements become `Node` struct literals, `useState` becomes compile-time state slot indices, `onPress` becomes a function pointer passed to the event system
4. The emitted source is written to `tsz/runtime/generated_app.zig`
5. `tsz` invokes `zig build engine-app` as a child process
6. Zig compiles `generated_app.zig` against the runtime (layout engine, text renderer, event system, GPU painter) into a single binary
7. The binary is copied from `zig-out/bin/tsz-app` to `zig-out/bin/tsz-counter`

## Gotchas

- The binary name is derived from the input filename: `counter.tsz` → `tsz-counter`. If you rename the file, a new binary is produced at the new name; the old binary stays until you delete it.
- `tsz run` changes directory to the repo root internally. All paths in `.tsz` source (e.g. image paths) are resolved relative to the repo root.
- `tsz build counter.tsz --debug` passes `-Doptimize=Debug` to Zig. Debug binaries are significantly larger and slower but print structured error output on crash.
- If `zig` is not in your PATH, the build step will fail with a spawn error. Verify with `zig version` — it should print `0.15.2`.
- Do not edit `tsz/runtime/generated_app.zig` by hand. It is overwritten on every `tsz build` or `tsz run`.

## See Also

- [CLI Reference](../09-cli/index.md)
- [Architecture](../02-architecture/index.md)
- [Box](../03-primitives/box.md)
- [useState](../05-state/use-state.md)
