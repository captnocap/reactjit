# tsz/ — Native Stack

Zero-dependency native rendering. `.tsz` source → Zig compiler → SDL2 + wgpu + FreeType binary.
No Node, no npm, no Lua, no QuickJS. The entire toolchain is two binaries.

## The Rule

**If it's not generating code, it should be generated code.**

The runtime is written in `.tsz`. The compiler turns `.tsz` into `.zig`. Hand-written `.zig` in the runtime is a temporary state — it means the compiler hasn't caught up yet. When you encounter hand-written `.zig`, the correct response is to extend the compiler, not to write more `.zig`.

## Directory Structure

```
compiler/             — The compiler itself (pure Zig — the ONE exception)
  main.zig            — Entry point, CLI
  lexer.zig           — Tokenizer
  codegen.zig         — JSX mode → Zig emitter
  modulegen.zig       — Imperative mode → Zig emitter
  stmtgen.zig         — Statement codegen
  exprgen.zig         — Expression codegen
  typegen.zig         — Type declarations

runtime/
  tsz/                — SOURCE OF TRUTH. All runtime code lives here as .tsz
    state.tsz         — Reactive state slots
    events.tsz        — Hit testing + event dispatch
    layout.tsz        — Flexbox engine
    compositor.tsz    — Retained-mode compositor (wgpu)
    gpu.tsz           — wgpu GPU backend
    ...
  compiled/           — BUILD OUTPUT. Generated .zig from tsz/. Never hand-edit.
    state.zig         — Generated from tsz/state.tsz
    events.zig        — Generated from tsz/events.tsz
    layout.zig        — Generated from tsz/layout.tsz
    ...

examples/             — .tsz demo apps
```

### What goes where

| Question | Answer |
|----------|--------|
| Writing new runtime code? | Write `.tsz` in `runtime/tsz/` |
| Compiler can't handle a pattern? | Fix the compiler, then write `.tsz` |
| Need to read runtime source? | Read from `runtime/tsz/` |
| Need to debug generated output? | Read from `runtime/compiled/` |
| Editing a `.zig` in `compiled/`? | **No. Edit the `.tsz` and recompile.** |
| Found a bug in generated code? | Fix the compiler or the `.tsz` source |

### The compiler is the only hand-written Zig

The `compiler/` directory is pure Zig because the compiler can't compile itself (yet). Everything else — the entire runtime — is `.tsz` source that compiles to `.zig`.

## .tsz Syntax

`.tsz` files look like TypeScript but compile directly to native Zig:

```tsx
// @ffi <time.h>
declare function time(t: pointer): number;

function App() {
  const [ts, setTs] = useState(0);
  return (
    <Box style={{ padding: 32, backgroundColor: '#1e1e2a' }}>
      <Text fontSize={24} color="#ffffff">{`Time: ${ts}`}</Text>
      <Pressable onPress={() => setTs(time(0))} style={{ padding: 16, backgroundColor: '#4ec9b0' }}>
        <Text fontSize={16} color="#ffffff">Get Time</Text>
      </Pressable>
    </Box>
  );
}
```

Imperative `.tsz` (runtime modules) uses the same syntax without JSX:

```tsx
union Value { int: i64; float: f64; boolean: boolean; }

export function getSlot(id: usize): i64 {
  switch (slots[id].value) {
    case .int: |v| return v;
    case .float: |v| return @intFromFloat(v);
    case .boolean: |v| return v ? @as(i64, 1) : 0;
    case .string: return 0;
  }
}
```

## Build Commands

All builds run from the **repo root** (where `build.zig` lives):

```bash
zig build tsz-compiler                         # Build the compiler
zig build engine-app                           # Build the runtime + app
./zig-out/bin/tsz build app.tsz                # Compile .tsz → native binary
./zig-out/bin/tsz run app.tsz                  # Compile and run
./zig-out/bin/tsz compile-runtime src.tsz -o dir/  # Compile to .gen.zig fragment
```

## Compiler Capabilities

The compiler handles systems-level code. Supported patterns:

- **Types:** enums, structs (interface), tagged unions (union), function pointers, optionals (?T), pointers (*T, *const T), fixed arrays ([N]T), slices
- **Control flow:** if/else, if-expression, if-capture (|val|), while, for-of, range-for (0..N), switch statement + switch expression, break, continue, return, defer
- **Error handling:** try, catch (return/break/continue/{}), orelse (return/break/continue)
- **Expressions:** ternary, null coalescing (??), @builtin() passthrough, &address-of, .*deref, a..b range, [x..y] slices, .{} tuple/struct init, TypeName{} named init
- **Naming:** camelCase → snake_case for struct fields. Preserved for: std.*, c.*, ALL_CAPS, method calls

## System Dependencies

SDL2 (windowing/events only), wgpu-native (GPU rendering via Vulkan/Metal/DX12), FreeType, libmpv (optional). GTK3 + libayatana-appindicator3 (system tray).
