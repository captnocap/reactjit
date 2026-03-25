# FFI System

C foreign function interface for calling native libraries from .tsz.

## Overview

The FFI system lets tsz apps call C functions directly. You declare C headers and function signatures in your `.tsz` file, and the compiler generates Zig `@cImport`/`@cInclude` wrappers. Combined with `useFFI`, you can poll native functions on a timer and bind results to state slots.

## Declaring FFI

### Step 1: Header pragma

```tsx
// @ffi <time.h> -lrt
// @ffi <sys/sysinfo.h> -lc
```

The `// @ffi` comment is a compiler pragma (collected in Phase 1). Format:
- `<header.h>` — C header to include via `@cInclude`
- `-llib` — library to link (optional, maps to Zig build `-l` flag)

### Step 2: Function declarations

```tsx
declare function getUptime(): number
declare function getHostname(buf: string, len: number): number
declare function getCurrentTemp(): number
```

Collected in Phase 2. The compiler records:
- Function name → emitted as `@cImport` extern call
- Return type (`number` → `i64`, `string` → `[]const u8`, `boolean` → `bool`)
- Argument count (from comma counting in the param list)

## useFFI — Polling Hook

Bind an FFI function to a state slot with automatic periodic polling:

```tsx
const [uptime] = useFFI(getUptime, 1000);  // poll every 1000ms
```

This creates:
- A read-only state slot (no setter — the FFI poll writes it)
- A polling call in `_appTick` that runs every N milliseconds
- The return type is inferred from the `declare function` annotation

### Generated code

```zig
// In _appTick:
{
    const now = std.time.milliTimestamp();
    if (now - _ffi_last_0 >= 1000) {
        _ffi_last_0 = now;
        state.setSlot(0, _ffi_getUptime());
    }
}
```

## FFI in Event Handlers

You can also call FFI functions directly in handlers:

```tsx
<Pressable onPress={() => { resetCounter() }}>
```

If `resetCounter` is a declared FFI function, the handler emits a direct call to the generated wrapper.

## Generated Wrappers

For each declared function, the compiler emits a Zig wrapper:

```zig
const c = @cImport({
    @cInclude("time.h");
    @cInclude("sys/sysinfo.h");
});

fn _ffi_getUptime() i64 {
    return c.getUptime();
}
```

## Complete Example

```tsx
// @ffi <sys/sysinfo.h> -lc
declare function get_uptime(): number

function App() {
  const [uptime] = useFFI(get_uptime, 5000);
  return (
    <Box style={{ width: '100%', height: '100%', padding: 20 }}>
      <Text style={{ fontSize: 24 }}>{`System uptime: ${uptime}s`}</Text>
    </Box>
  );
}
```

## Known Limitations

- Max 32 FFI headers, 32 FFI libraries, 128 FFI functions per app
- Max 16 useFFI hooks per app
- Return types limited to `number` (i64), `string`, `boolean`
- No struct passing — only scalar types cross the FFI boundary
- No async FFI — all calls are synchronous and block the frame
- FFI functions must have C linkage (no C++ name mangling)
- The linked library must be available at build time on the system
