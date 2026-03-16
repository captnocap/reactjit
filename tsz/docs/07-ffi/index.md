---
title: Foreign Function Interface (FFI)
description: Call any C library directly from .tsz using @ffi directives and declare function
category: FFI
keywords: ffi, c interop, cImport, declare function, native libraries, linking
related: State, Events, Primitives
difficulty: intermediate
---

## Overview

FFI lets you call C functions directly from `.tsz` source. There is no bridge, no marshaling, and no wrapper layer — the compiler emits a Zig `@cImport` block and routes calls through it. The result is a native function call with zero overhead. Any header-based C library works: libc, SDL2, custom DSPs, hardware drivers, anything.

## Syntax

Two declarations are required at the top of your `.tsz` file: an `@ffi` pragma that names the header, and a `declare function` statement that tells the compiler the function's signature.

```tsz
// @ffi <header.h>
declare function functionName(param: type): returnType;
```

Multiple headers and functions can be declared:

```tsz
// @ffi <math.h>
// @ffi <string.h>
declare function sqrt(x: number): number;
declare function strlen(s: pointer): number;
```

To link an external library, add a `-l` flag after the header:

```tsz
// @ffi <sqlite3.h> -lsqlite3
declare function sqlite3_open(filename: pointer, db: pointer): number;
```

## Props / API

### @ffi directive

```
// @ffi <header.h> [-llib]
```

| Part | Required | Description |
|------|----------|-------------|
| `<header.h>` | Yes | C header file name, passed to `@cInclude` |
| `-llib` | No | Library name to link (written to `ffi_libs.txt`) |

### declare function

```
declare function name(param: type, ...): returnType;
```

| Type in .tsz | Meaning |
|--------------|---------|
| `number` | Numeric value — maps to the C function's declared type (int, long, double, etc.) |
| `pointer` | Pointer argument — passed as `null` for NULL, or a numeric address |
| (return) `number` | Numeric return value |
| (return) `void` | No return value |

The `declare function` statement registers the name so the compiler knows to route calls through `ffi.name(...)` rather than treating it as a local function. The actual C type signatures come from the header — the `.tsz` types are only used to determine how to emit call sites.

## Examples

### Basic: calling libc time()

```tsz
// @ffi <time.h>
declare function time(t: pointer): number;

function App() {
  const [timestamp, setTimestamp] = useState(0);

  return (
    <Box style={{ padding: 32, backgroundColor: '#1e1e2a', flexDirection: 'column', gap: 16 }}>
      <Text fontSize={28} color="#ffffff">FFI Demo</Text>
      <Box style={{ padding: 20, backgroundColor: '#282838' }}>
        <Text fontSize={42} color="#ff79c6">{`${timestamp}`}</Text>
        <Text fontSize={12} color="#666688">Unix timestamp</Text>
      </Box>
      <Pressable onPress={() => setTimestamp(time(0))} style={{ padding: 16, backgroundColor: '#4ec9b0' }}>
        <Text fontSize={16} color="#ffffff">Get Time</Text>
      </Pressable>
    </Box>
  );
}
```

`time(0)` passes `null` (the C NULL pointer) because the argument type is `pointer`. The return value is the Unix timestamp as a number.

### Math functions

```tsz
// @ffi <math.h>
declare function sqrt(x: number): number;
declare function floor(x: number): number;
declare function ceil(x: number): number;
declare function fabs(x: number): number;

function App() {
  const [value, setValue] = useState(144);

  return (
    <Box style={{ padding: 32, flexDirection: 'column', gap: 12, backgroundColor: '#1e1e2a' }}>
      <Text fontSize={18} color="#ffffff">{`sqrt(${value}) = ${sqrt(value)}`}</Text>
      <Pressable onPress={() => setValue(value + 100)} style={{ padding: 12, backgroundColor: '#4ec9b0' }}>
        <Text fontSize={14} color="#ffffff">+100</Text>
      </Pressable>
    </Box>
  );
}
```

### Linking an external library

```tsz
// @ffi <zlib.h> -lz
declare function zlibVersion(unused: pointer): number;
declare function compress(dest: pointer, destLen: pointer, source: pointer, sourceLen: number): number;

function App() {
  return (
    <Box style={{ padding: 32, backgroundColor: '#1e1e2a' }}>
      <Text fontSize={16} color="#ffffff">zlib linked via FFI</Text>
    </Box>
  );
}
```

The `-lz` flag causes the compiler to write `z` into `tsz/runtime/ffi_libs.txt`. The Zig build system reads this file and passes `-lz` to the linker.

### Multiple headers

```tsz
// @ffi <stdio.h>
// @ffi <stdlib.h>
declare function rand(): number;
declare function srand(seed: number): void;

function App() {
  const [roll, setRoll] = useState(0);

  return (
    <Box style={{ padding: 32, flexDirection: 'column', gap: 16, backgroundColor: '#1e1e2a' }}>
      <Text fontSize={48} color="#ff79c6">{`${roll}`}</Text>
      <Pressable onPress={() => setRoll(rand())} style={{ padding: 16, backgroundColor: '#4ec9b0' }}>
        <Text fontSize={16} color="#ffffff">Roll</Text>
      </Pressable>
    </Box>
  );
}
```

## Internals

The compiler makes two passes relevant to FFI:

**Pass 1 — collect pragmas (`collectFFIPragmas`):** Scans all tokens for `ffi_pragma` tokens. Each `// @ffi <header.h> [-llib]` comment is parsed to extract the header name and optional library name. Headers are stored in `ffi_headers`, library names in `ffi_libs`.

**Pass 2 — collect declared functions (`collectDeclaredFunctions`):** Scans for `declare function name(...)` declarations and stores each function name in `ffi_funcs`.

**Emit:** At code generation time, if any FFI headers were collected, the compiler emits:

```zig
const ffi = @cImport({
    @cInclude("time.h");
});
```

Every call site where `isFFIFunc(name)` returns true is emitted as `ffi.name(args)` instead of a local function call. A `pointer`-typed argument with value `0` is emitted as `null`.

**Library linking:** After code generation, the compiler writes `tsz/runtime/ffi_libs.txt` with one library name per line. The build system (`build.zig`) reads this file and passes each entry as a `-l` linker flag.

## Gotchas

- The `// @ffi` comment must use exactly that syntax with angle brackets: `<header.h>`. Quotes are not supported.
- `declare function` only registers the name for call-site routing. The actual parameter types (int vs long vs double) are determined by the C header — be sure the header is correct for the target platform.
- A `pointer` argument in `.tsz` passes `null` when the value is `0`. Pass actual pointer values only via numeric state that holds a valid address — this is an advanced pattern.
- Library names in `-l` flags must not include the `lib` prefix or file extension: `-lz` links `libz.so`, not `-lzlib`.
- `ffi_libs.txt` is overwritten on every compile. If your app has no FFI, the file is cleared.
- `declare function` with no corresponding `// @ffi` pragma will cause a linker error — the function symbol will be missing.

## See Also

- [State](../05-state/index.md)
- [Events](../06-events/index.md)
- [CLI](../09-cli/index.md)
