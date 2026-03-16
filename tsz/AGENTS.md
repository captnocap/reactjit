# tsz/ — Native Stack

Zero-dependency native rendering. `.tsz` source → Zig compiler → SDL2 + wgpu + FreeType binary.
No Node, no npm, no Lua, no QuickJS. The entire toolchain is two binaries.

## The Rule

**If it's not generating code, it should be generated code.**

- `runtime/tsz/` — source of truth. All runtime code is `.tsz`.
- `runtime/compiled/` — build output. Generated `.zig`. Never hand-edit.
- `compiler/` — the only hand-written Zig (can't compile itself yet).
- Found hand-written `.zig` in the runtime? Fix the compiler, write `.tsz`.

## .tsz Syntax

`.tsz` files look like TypeScript but compile directly to native Zig:

```tsx
// JSX mode (apps)
function App() {
  const [count, setCount] = useState(0);
  return (
    <Box style={{ padding: 32, backgroundColor: '#1e1e2a' }}>
      <Text fontSize={24} color="#ffffff">{`Count: ${count}`}</Text>
      <Pressable onPress={() => setCount(count + 1)}>
        <Text>Increment</Text>
      </Pressable>
    </Box>
  );
}
```

```tsx
// Imperative mode (runtime modules)
union Value { int: i64; float: f64; boolean: boolean; }

export function getSlot(id: usize): i64 {
  return switch (slots[id].value) {
    case .int: |v| v; break;
    case .float: |v| @intFromFloat(v); break;
    default: 0; break;
  };
}
```

## Capabilities

- **Primitives:** Box, Text, Image, Pressable, ScrollView, TextInput, Window
- **State:** `useState(initial)` → compile-time state slots, reactive re-render
- **Events:** `onPress` handlers with hit testing and hover feedback
- **FFI:** `// @ffi <header.h> -llib` + `declare function` → `@cImport` any C library
- **Multi-window:** `<Window title="X">` → same-process SDL2 windows, shared state, no IPC
- **Video:** `playVideo("path")` → native libmpv integration
- **Images:** `<Image src="photo.png" />` → stb_image decode + wgpu texture cache
- **Scroll:** `<ScrollView>` → overflow clipping + mouse wheel
- **Watchdog:** 512MB hard limit + 50MB/s leak detection → BSOD crash screen
- **Component composition:** multi-file imports, prop substitution, children forwarding

## Compiler Features (imperative mode)

The compiler handles full systems-level code:

- **Types:** enums, structs, tagged unions, function pointers, ?T, *T, *const T, [N]T, slices
- **Control flow:** if/else, if-expression, if-capture |val|, while, for-of, range-for 0..N, switch statement + expression, break, continue, return, defer
- **Error handling:** try, catch (return/break/continue/{}), orelse (return/break)
- **Expressions:** ternary, ??, @builtin() passthrough, &addr, .*deref, a..b, [x..y], .{} init
- **Naming:** camelCase → snake_case for struct fields. Preserved for std.*, c.*, ALL_CAPS, methods

## Build Commands

All builds run from the **repo root** (where `build.zig` lives):

```bash
zig build tsz-compiler                         # Build the compiler
zig build engine-app                           # Build the runtime + app
./zig-out/bin/tsz build app.tsz                # Compile .tsz → native binary
./zig-out/bin/tsz run app.tsz                  # Compile and run
./zig-out/bin/tsz compile-runtime src.tsz -o dir/  # Compile to runtime fragment
```

## Directory Structure

```
compiler/             — The compiler (pure Zig — the one exception)
  main.zig            — Entry point, CLI
  lexer.zig           — Tokenizer
  codegen.zig         — JSX mode emitter
  modulegen.zig       — Imperative mode emitter
  stmtgen.zig         — Statement codegen
  exprgen.zig         — Expression codegen
  typegen.zig         — Type declarations

runtime/
  tsz/                — SOURCE OF TRUTH (.tsz files)
  compiled/           — BUILD OUTPUT (.zig files, never hand-edit)

examples/             — .tsz demo apps
```

## System Dependencies

SDL2 (windowing/events), wgpu-native (GPU via Vulkan/Metal/DX12), FreeType, libmpv (optional). GTK3 + libayatana-appindicator3 (system tray).
