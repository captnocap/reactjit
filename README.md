# ReactJIT

Write UI in TypeScript. Get a native binary.

```
app.tsz (TypeScript + JSX)
   |
   v
tsz compiler (95KB Zig binary)
   |
   v
Zig source (layout + text + events + paint)
   |
   v
LLVM backend
   |
   v
65KB native binary (SDL2 + FreeType + OpenGL)
```

No runtime. No interpreter. No garbage collector. No node_modules. Just structs and a GPU.

---

## Two Stacks

ReactJIT has two rendering paths. Both use the same primitives (`Box`, `Text`, `Image`, `Pressable`, `ScrollView`) and the same flex layout engine.

### The Native Engine (active development)

TypeScript compiles to native binaries via Zig. Zero dependencies.

```bash
zig build tsz-compiler                  # Build the compiler (95KB)
./zig-out/bin/tsz build app.tsz         # Compile app → native binary (65KB)
./zig-out/bin/tsz run app.tsz           # Compile and run
```

```tsx
// counter.tsz
function App() {
  const [count, setCount] = useState(0);
  return (
    <Box style={{ padding: 32, flexDirection: 'column', gap: 16, backgroundColor: '#1e1e2a' }}>
      <Text fontSize={28} color="#ffffff">Counter</Text>
      <Text fontSize={48} color="#ff79c6">{`${count}`}</Text>
      <Pressable onPress={() => setCount(count + 1)} style={{ padding: 16, backgroundColor: '#4ec9b0' }}>
        <Text fontSize={16} color="#ffffff">+ Increment</Text>
      </Pressable>
    </Box>
  );
}
```

That's the entire source. 65KB binary. Runs at 60fps.

**What it has:**
- Flexbox layout engine (600 lines of Zig, ported from the Lua version)
- FreeType text rendering with glyph cache
- Image loading via stb_image
- Reactive state (`useState` → compile-time state slots)
- Event system (onPress, hover, keyboard) with hit testing
- ScrollView with overflow clipping
- Component composition (multi-file imports, props, children forwarding)
- FFI — `// @ffi <header.h> -llib` calls any C library via `@cImport`
- Multi-window (same process, shared state, no IPC)
- Video playback (native libmpv, 85 lines replaces 1150 lines of Lua FFI)
- Watchdog (512MB hard limit, leak detection → BSOD crash screen)
- Self-hosting compiler (hand-written lexer + parser + codegen in pure Zig, 95KB)

**Binary sizes:**

| Build | Size |
|-------|------|
| Compiler (ReleaseSmall) | 95 KB |
| App (ReleaseSmall) | 65 KB |
| App (ReleaseFast) | 147 KB |
| App (Debug) | ~8 MB |

For comparison: Electron hello world is ~150MB. React Native is ~30MB. Flutter is ~15MB.

### The Love2D Stack (mature, full-featured)

The original rendering path. React reconciler → QuickJS bridge → Lua layout engine → Love2D painter.

```bash
reactjit init my-app && cd my-app
reactjit dev                            # Watch + HMR
reactjit build linux                    # Self-extracting binary
```

This stack has everything — 30+ packages, storybook, HMR, test runner, visual inspector, theme system, 3D, audio, maps, chemistry, finance, AI agents, terminal emulator, and more. It's the mature platform that proves every concept before the native engine absorbs it.

---

## Where We Started

```
React JSX → QuickJS bridge → Lua layout → Love2D painter → pixels
```

Five layers. Three languages. Two FFI bridges. A JS interpreter (QuickJS) running inside a Lua JIT (LuaJIT) running inside a game engine (Love2D). It worked — pixel-perfect flexbox, 60fps, hot reload. But every layer added latency, memory, and complexity.

The Lua codebase alone: 1150 lines for video playback. 500 lines of GL state save/restore. 200 lines of FFI cdef blocks duplicating C headers by hand. All fighting the abstraction boundary between JavaScript, Lua, and C.

## Where We're Headed

```
TypeScript → Zig → pixels
```

One step. TypeScript IS the compute. Zig IS the runtime. `@cImport` reads any C header at compile time. No bridge. No serialization. No interpreter. The layout engine that was 2544 lines of Lua is 600 lines of Zig. The video player that was 1150 lines of Lua FFI is 85 lines of Zig. The compiler that needed Node.js + TypeScript (145MB) is a 95KB Zig binary.

The entire toolchain — compiler + runtime — is **160KB**. That's smaller than most JPEGs.

---

## Primitives

Shared across both stacks:

`Box` `Text` `Image` `Pressable` `ScrollView` `TextInput`

Everything is composed from these. A dashboard is Boxes and Text. A periodic table is Boxes and Text. There are no special node types — same way every website is ultimately divs and spans.

## Layout

The flex layout engine is pixel-perfect and identical across Lua and Zig.

**Sizing tiers** (first match wins):
1. **Explicit** — `width`, `height`, `flexGrow`, `flexBasis`
2. **Content** — containers shrink-wrap children, text measures from font metrics
3. **Proportional** — empty surfaces get 1/4 of parent (cascades)

**Rules:**
- Root containers: `width: '100%', height: '100%'`
- Space-filling: `flexGrow: 1`, never hardcoded pixel heights
- ScrollView needs explicit height
- Template literals for dynamic text: `` {`Count: ${n}`} ``

## FFI (native engine)

Call any C library from TypeScript:

```tsx
// @ffi <sqlite3.h> -lsqlite3
declare function sqlite3_open(path: string, db: pointer): number;
```

Compiles to `@cImport(@cInclude("sqlite3.h"))`. Direct function calls. Zero overhead. Every C library ever written is one pragma away.

## Architecture

### Native Engine (`native/`)

```
native/tsz/             Compiler (lexer, parser, codegen)
  main.zig              CLI entry point
  lexer.zig             Tokenizer
  codegen.zig           Parser + Zig emitter

native/engine/          Runtime
  layout.zig            Flexbox engine
  text.zig              FreeType rasterizer + glyph cache
  image.zig             stb_image loader + texture cache
  events.zig            Hit testing + scroll detection
  state.zig             Reactive state slots
  windows.zig           Multi-window manager
  watchdog.zig          RSS leak guard
  bsod.zig              Crash screen
  mpv.zig               Video playback
  c.zig                 Shared @cImport

examples/hello-tsz/     Demo apps
  counter.tsz           useState + buttons
  ffi-demo.tsz          libc time() via FFI
  mpv-demo.tsz          Video player
  multi-window.tsz      Shared state across windows
  leak-test.tsz         Watchdog stress test
```

### Love2D Stack

```
lua/                    Runtime (layout, painter, bridge, tree, events, videos, inspector)
packages/               30+ npm packages (@reactjit/core, renderer, 3d, audio, ai, ...)
storybook/              Reference implementation + component catalog
cli/                    reactjit CLI + build pipeline
examples/               Consumer projects
```

## Build

```bash
# Native engine
zig build tsz-compiler                  # Build the .tsz compiler
zig build engine                        # Build the demo engine
zig build engine-app                    # Build from generated_app.zig

# Love2D stack
npm install
make setup                              # Build QuickJS
reactjit dev                            # Watch + HMR
reactjit build linux                    # Production binary
```

---

*Started with one pixel. Now it's a language.*
