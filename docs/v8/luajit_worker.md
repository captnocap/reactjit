# LuaJIT Worker Pipeline (V8 Runtime)

The LuaJIT worker is an off-thread compute bridge implemented in
`framework/luajit_worker.zig`. It is not the browser `Worker` API, not a React
hook, and not a V8 host global. In the current tree it is a low-level exported C
symbol surface that the engine force-links into the binary.

The worker owns a separate LuaJIT VM on a background Zig thread. It communicates
with the main thread through atomics and fixed-size ring buffers. It must not
touch rendering, layout, React state, V8 handles, the node tree, or any UI-thread
owned subsystem.

There are two worker data paths:

- Counter mode: atomic counters for stress tests and bridge throughput.
- Message mode: fixed-size string queues for small request/result payloads.

There is also an older C shim in `framework/ffi/lua_worker_shim.c`. The active
V8 app path force-references the Zig worker module instead.

## Public API

The exported C ABI surface is:

```c
long lua_worker_start(void);
long lua_worker_stop(void);

long lua_worker_send(long count);
long lua_worker_recv_count(void);
long lua_worker_bridge_n(void);
long lua_worker_set_n(long n);
long lua_worker_elapsed_us(void);

long lua_worker_send_msg(const char *msg, long len);
long lua_worker_recv_msg(char *buf, long buf_len);

long lua_worker_eval(const char *code, long len);
```

There is no current `runtime/hooks/luaWorker.ts`, no `__lua_worker_*` V8 global,
and no React-facing API. Cart JS cannot call these functions directly unless a
separate binding layer is added.

### Counter Mode

Counter mode is zero-copy. It tracks only totals:

```text
g_inbox   = total work units sent to worker
g_outbox  = total work units acknowledged by worker
```

Calls:

```c
lua_worker_start();       // spawn the worker thread
lua_worker_set_n(1000);   // default batch size when send count <= 0
lua_worker_send(0);       // add bridge_n units to inbox
lua_worker_send(50);      // add exactly 50 units
lua_worker_recv_count();  // read total acknowledged units
lua_worker_elapsed_us();  // latency between last send and last ack
lua_worker_stop();        // flip running false and join the thread
```

Return behavior:

- `lua_worker_start`: `1` when a worker was spawned, `0` if already running,
  `-1` on spawn failure.
- `lua_worker_stop`: `1` when a running worker stopped, `0` if it was not
  running.
- `lua_worker_send`: total inbox count after adding work.
- `lua_worker_recv_count`: total processed count.
- `lua_worker_bridge_n`: current default send size.
- `lua_worker_set_n`: the value written.
- `lua_worker_elapsed_us`: `0` until the worker has acknowledged work newer than
  the last send timestamp.

### Message Mode

Message mode is a pair of fixed-size ring buffers:

```text
main thread -> g_msg_inbox  -> Lua host_recv_msg()
Lua host_send_msg() -> g_msg_outbox -> main thread
```

Calls:

```c
lua_worker_send_msg("hello", 5);

char buf[512];
long n = lua_worker_recv_msg(buf, sizeof(buf));
```

Return behavior:

- `lua_worker_send_msg`: copied byte length on success, `0` if the inbox queue is
  full, `-1` for a null input pointer.
- `lua_worker_recv_msg`: copied byte length when a result is available, `0` when
  the outbox is empty, `-1` for an invalid output buffer.

Limits:

```text
MAX_MSG_LEN     = 512 bytes
MSG_QUEUE_SIZE  = 1024 slots
```

Messages longer than `MAX_MSG_LEN` are truncated when pushed.

### Script Install

`lua_worker_eval(code, len)` copies a script into a static buffer:

```text
script buffer = 16384 bytes
```

The worker selects the script when `workerMain` starts:

- If `g_script_len > 0`, it runs the installed script.
- Otherwise, it runs the built-in counter-mode script.

Changing the script after the worker has already started does not affect the
currently running Lua VM. Stop and start the worker to run a newly installed
script.

## Build And Link Path

`build.zig` wires LuaJIT in as foundational runtime infrastructure:

1. Adds the `zluajit` Zig dependency with `.system = false`.
2. Adds `zluajit` as a root module import.
3. Links `luajit-5.1`.
4. Adds platform include/library paths for LuaJIT headers and libs.

The dependency registry also contains a `lua-worker` feature marker:

```text
runtime/features/lua-worker.ts -> has-lua-worker
```

In the current build file there is no corresponding `has-lua-worker` option that
gates the active worker module. The engine force-references
`framework/luajit_worker.zig` unconditionally, and LuaJIT itself is linked as a
foundational library.

## Engine Integration

`framework/engine.zig` force-references the worker module at comptime:

```zig
comptime {
    _ = @import("luajit_worker.zig");
}
```

That keeps the exported `lua_worker_*` symbols available to the linker even when
no Zig code calls them directly.

The engine telemetry loop also calls:

```zig
@import("luajit_worker.zig").logTelemetry();
```

`logTelemetry` prints once per engine telemetry interval only while the worker is
running:

```text
[lua-worker] N=<bridge_n> | processed: <per_sec>/s | total: <outbox> |
  pending: <inbox - outbox> | latency: <elapsed_us>us
```

## End-to-End Flow: Counter Mode

### 1. Caller starts the worker

```c
lua_worker_start();
```

The Zig export checks `g_running`. If a worker is already running, it returns
`0`. Otherwise it:

1. Stores `true` into `g_running`.
2. Resets `g_inbox` and `g_outbox` to `0`.
3. Spawns a Zig thread running `workerMain`.

If thread spawn fails, it logs an error, resets `g_running` to false, and returns
`-1`.

### 2. Worker creates its LuaJIT VM

`workerMain` creates a `zluajit.State`, opens standard Lua libraries, and
registers host functions into the Lua global table.

Counter globals:

```lua
host_recv()     -- pending count: g_inbox - g_outbox
host_ack(n)     -- add n to g_outbox, stamp recv time
host_running()  -- boolean running flag
```

Message globals:

```lua
host_recv_msg()     -- string or nil
host_send_msg(text) -- enqueue result string
```

Then `workerMain` runs the installed script or the default script with
`state.doString`.

### 3. Default script polls atomics

The default script is:

```lua
while host_running() do
  local avail = host_recv()
  if avail > 0 then
    for i = 1, avail do
      local sum = 0
      for j = 1, 100 do
        sum = sum + j * j
      end
    end
    host_ack(avail)
  end
end
```

This is a compute/bridge stress script. When no work is available it keeps
looping; there is no sleep or condition wait in the Lua script.

### 4. Caller sends work

```c
lua_worker_send(count);
```

If `count > 0`, that exact count is used. Otherwise the current `g_bridge_n`
value is used.

The send path:

1. Atomically adds `n` to `g_inbox`.
2. Stores the send timestamp in `g_send_time_ns`.
3. Returns the new total inbox count.

No queue allocation, mutex, string copy, or Lua call happens on the sender side.

### 5. Lua acknowledges work

The Lua script calls:

```lua
host_ack(avail)
```

The Zig host function reads the numeric Lua argument, atomically adds it to
`g_outbox`, and stores `g_recv_time_ns`.

The main thread reads progress with:

```c
lua_worker_recv_count();
lua_worker_elapsed_us();
```

### 6. Caller stops the worker

```c
lua_worker_stop();
```

The stop path:

1. Stores `false` in `g_running`.
2. Joins the worker thread.
3. Clears `g_thread`.

The default script observes `host_running() == false` and returns, allowing
`workerMain` to deinitialize the Lua state.

Custom scripts must also return when `host_running()` becomes false. If a custom
script ignores the running flag or blocks forever, `lua_worker_stop` can block
while joining the thread.

## End-to-End Flow: Message Mode

### 1. Caller enqueues an input string

```c
lua_worker_send_msg(ptr, len);
```

The Zig export copies up to `MAX_MSG_LEN` bytes into the current inbox tail slot
and advances the atomic tail index. If advancing would collide with the head, the
queue is full and the call returns `0`.

The queue is single-producer/single-consumer in spirit: main thread pushes to
the inbox, worker pops from it.

### 2. Lua script polls for input

A custom script can read messages:

```lua
while host_running() do
  local msg = host_recv_msg()
  if msg ~= nil then
    host_send_msg("echo:" .. msg)
  end
end
```

`host_recv_msg` pops one inbox slot. If no message is available, it returns nil
to Lua.

### 3. Lua script enqueues output

`host_send_msg(text)` converts the first Lua argument to a string and pushes it
into the outbox ring. If the outbox is full, the result is dropped; the Lua host
function currently does not report failure back to Lua.

### 4. Caller polls output

```c
char out[512];
long n = lua_worker_recv_msg(out, sizeof(out));
```

The Zig export pops one outbox slot, copies up to `buf_len` bytes, and returns
the copied length. It does not append a null terminator; callers should use the
returned length.

## Threading Model

Shared state:

- Counter path: `std.atomic.Value(i64)` and `std.atomic.Value(bool)`.
- Message path: two ring buffers with atomic `head` and `tail` indices.
- Script storage: a static byte buffer read by the worker when it starts.

The worker thread owns:

- Its LuaJIT state.
- Lua stack and Lua globals.
- Script execution.

The main thread owns:

- Calls to exported `lua_worker_*` functions.
- Engine telemetry.
- Any future V8 binding that might wrap these exports.

The worker has no allocator handoff or object ownership bridge to React/V8. Data
crosses the boundary only as counters or copied byte strings.

## Relationship To `luajit_runtime.zig`

`framework/luajit_runtime.zig` is a separate main-thread Lua runtime/JSRT path.
It mirrors parts of the old QuickJS logic runtime and can touch runtime state
through host callbacks.

`framework/luajit_worker.zig` is different:

- It runs on a background thread.
- It is compute-only.
- It does not own app logic, event handlers, React reconciliation, layout, or
  node mutation.
- It only exposes counter/message bridge primitives.

Do not use the worker as a back door into UI state. Any UI effect must be
reported back to the main thread through a future binding or queue and then
applied by the normal V8/Zig runtime path.

## Old C Shim

`framework/ffi/lua_worker_shim.c` is the older pthread + Lua C API
implementation. It has the same counter-mode shape:

```c
lua_worker_start
lua_worker_send
lua_worker_recv_count
lua_worker_bridge_n
lua_worker_set_n
lua_worker_elapsed_us
```

It does not include the Zig worker's stop, script install, or string message
mode exports. The active build does not add this C file as a source file in the
main executable; `framework/luajit_worker.zig` is the implementation to trace for
the current V8 app.

## Limits And Caveats

- There is no active JS/React API for this worker.
- The `lua-worker` dependency-registry entry is not wired to a build option in
  `build.zig` today.
- LuaJIT is linked foundationally, even though the worker API itself is low
  level.
- The default Lua script busy-spins when no work is pending.
- `lua_worker_eval` affects the next worker start, not an already-running worker.
- Installed scripts are truncated to 16 KB.
- Message payloads are truncated to 512 bytes.
- Message queues hold 1024 slots and return/drop on full queues.
- `host_send_msg` ignores outbox push failure.
- `lua_worker_recv_msg` does not null-terminate output buffers.
- A Lua script error logs and exits `workerMain`; the current code does not reset
  `g_running` on that error path.
- Custom scripts must cooperate with `host_running()` or `lua_worker_stop` can
  block while joining.

## Source Map

- `framework/luajit_worker.zig`: active Zig LuaJIT worker implementation.
- `framework/ffi/lua_worker_shim.c`: older C shim with counter mode only.
- `framework/ffi/lua_worker_shim.h`: older C shim declarations.
- `framework/engine.zig`: force-link import and telemetry call.
- `build.zig`: `zluajit` dependency, LuaJIT link/include setup.
- `sdk/dependency-registry.json`: stale or future-facing `lua-worker` feature
  marker and foundational `luajit` library metadata.
- `framework/luajit_runtime.zig`: separate main-thread Lua runtime/JSRT path,
  not the worker.
