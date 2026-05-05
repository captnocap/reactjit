# V8 process runner pipeline

This is the end-to-end path for running subprocesses from a V8 cart.

There are three separate process runner surfaces:

```text
sync shell command:
  globalThis.__exec(cmd)
  -> framework/v8_bindings_fs.zig execCmd()
  -> libc popen(cmd, "r")
  -> blocking stdout capture
  -> string return

async shell command:
  execAsync(cmd)
  -> globalThis.__exec_async(cmd, requestId)
  -> framework/v8_bindings_core.zig hostExecAsync()
  -> framework/exec_async.zig detached thread + popen(cmd, "r")
  -> v8_app.zig per-frame tickDrain()
  -> __ffiEmit("exec:<requestId>", {"code":N,"stdout":"..."})
  -> Promise resolves

long-lived process:
  spawn(...) or useHost({kind:"process", ...})
  -> globalThis.__proc_spawn(JSON)
  -> framework/v8_bindings_process.zig hostSpawn()
  -> framework/process.zig spawnPiped()
  -> fork/execvp with stdin/stdout/stderr pipes
  -> v8_app.zig per-frame tickDrain()
  -> __ffiEmit("proc:stdout:<pid>", line)
  -> __ffiEmit("proc:stderr:<pid>", line)
  -> __ffiEmit("proc:exit:<pid>", {"code":N,"signal":null})
```

Use the shell exec APIs for one-shot commands. Use `spawn()` or
`useHost({kind:"process"})` for anything long-lived, interactive, or streaming.

## Source map

- `runtime/hooks/process.ts` is the direct JS API for child processes,
  `execAsync`, environment helpers, process stats, and process IFTTT sources.
- `runtime/hooks/useHost.ts` exposes the React hook wrapper for
  `useHost({kind:"process"})`.
- `runtime/ffi.ts` owns `callHost`, `callHostJson`, `hasHost`, `subscribe`,
  and `globalThis.__ffiEmit`.
- `runtime/hooks/useIFTTT.ts` imports `runtime/hooks/process.ts` for side
  effects so `proc:*` sources and actions register.
- `framework/v8_bindings_core.zig` registers `__exec_async` and drains finished
  async exec jobs.
- `framework/exec_async.zig` owns the detached-thread `popen()` worker queue.
- `framework/v8_bindings_fs.zig` registers `__exec`, `__env_get`, `__env_set`,
  `__exit`, and `__getpid`.
- `framework/v8_bindings_process.zig` registers the `__proc_*` host functions,
  owns child entries, drains pipes, emits process events, and samples `/proc`.
- `framework/process.zig` owns POSIX `fork`, `execvp`, pipe wiring, child
  registry cleanup, liveness checks, signals, and exit-code decode.
- `v8_app.zig` source-gates optional bindings and calls binding `tickDrain()`
  methods once per frame.
- `scripts/ship` and `scripts/ship-metafile-gate.js` decide which optional V8
  bindings are compiled into a shipped cart.

## Public JS API

Direct process helpers are exported from `@reactjit/runtime/hooks/process`:

```ts
import {
  spawn,
  kill,
  stdinWrite,
  stdinClose,
  onStdout,
  onStderr,
  onExit,
  run,
  execAsync,
  envGet,
  envSet,
  exit,
  procStat,
  watchProcess,
} from '@reactjit/runtime/hooks/process';
```

The long-running spawn shape:

```ts
interface SpawnOptions {
  cmd: string;
  args?: string[];
  cwd?: string;
  env?: Record<string, string>;
  stdin?: 'pipe' | 'inherit' | 'ignore';
}
```

The direct helpers:

| API | Host function | Behavior |
| --- | --- | --- |
| `spawn(opts)` | `__proc_spawn(JSON.stringify(opts))` | Starts a child and returns a pid, or `0` on failure. |
| `kill(pid, signal?)` | `__proc_kill(pid, signal)` | Sends `SIGTERM` by default; `SIGKILL` is also recognized. |
| `wait(pid)` | `__proc_wait(pid)` | Declared in JS, but the V8 process binding does not currently register `__proc_wait`. |
| `stdinWrite(pid, data)` | `__proc_stdin_write(pid, data)` | Writes to child stdin if the child was spawned with `stdin:"pipe"`. |
| `stdinClose(pid)` | `__proc_stdin_close(pid)` | Closes parent-side stdin fd. |
| `onStdout(pid, fn)` | `proc:stdout:<pid>` subscription | Receives line strings. |
| `onStderr(pid, fn)` | `proc:stderr:<pid>` subscription | Receives line strings. |
| `onExit(pid, fn)` | `proc:exit:<pid>` subscription | Receives `{ code, signal }`; V8 currently emits `signal:null`. |
| `run(cmd, args?)` | wrapper around `spawn` | Collects stdout/stderr lines until exit and resolves `{ code, stdout, stderr }`. |
| `execAsync(cmd)` | `__exec_async(cmd, rid)` | Runs a shell command on a detached thread and resolves `{ code, stdout }`. |
| `envGet(name)` | `__env_get(name)` | Reads the host process environment; returns string or null. |
| `envSet(name, value)` | `__env_set(name, value)` | Sets an environment variable in the host process. |
| `exit(code?)` | `__exit(code)` | Exits the host process. |
| `procStat(pid)` | `__proc_stat(pid)` | Reads one Linux `/proc` sample, or returns null. |
| `watchProcess(pid, intervalMs?)` | `__proc_watch_add/remove` | Refcounted sampler for `proc:ram` and `proc:cpu` events. |

The `useHost` process wrapper:

```ts
const child = useHost({
  kind: 'process',
  cmd: 'node',
  args: ['server.js'],
  cwd: '/path/to/project',
  stdin: 'pipe',
  onStdout(line) {},
  onStderr(line) {},
  onExit(result) {},
});

child.pid;
child.state;       // 'starting' | 'running' | 'stopped' | 'error'
child.stdin('x\n');
child.stdinClose();
child.kill('SIGTERM');
child.stop();
```

## Shell exec path

`__exec(cmd)` is the synchronous shell command primitive registered by
`framework/v8_bindings_fs.zig`.

```text
JS calls globalThis.__exec(cmd)
  -> v8_bindings_fs.execCmd()
  -> copy JS string into a nul-terminated command
  -> popen(command, "r")
  -> fread() stdout into a 65536-byte stack buffer
  -> pclose()
  -> return stdout string
```

Important behavior:

- It blocks the JS/UI frame for the whole command runtime.
- It captures stdout only. Stderr is not returned unless the command redirects
  it, for example `cmd 2>&1`.
- Output is capped at 64 KiB.
- The exit status is ignored. Empty output and command failure both return an
  empty string.
- Because it uses `popen`, the command is interpreted by the platform shell.

Use it only for tiny commands where blocking the frame is acceptable.

## Async exec path

`execAsync(cmd)` is the Promise wrapper around `__exec_async`.

```text
runtime/hooks/process.ts execAsync(cmd)
  -> allocate request id: x<N>:<Date.now()>
  -> subscribe("exec:<rid>", handler)
  -> callHost("__exec_async", cmd, rid)
  -> v8_bindings_core.hostExecAsync()
  -> exec_async.spawn(rid, cmd)
  -> detached Zig thread:
       popen(cmd, "r")
       fread() stdout into an ArrayList
       pclose()
       push completed result into mutex queue
  -> v8_bindings_core.tickDrain()
  -> exec_async.drain(emitExecResult)
  -> __ffiEmit("exec:<rid>", JSON)
  -> JS listener parses JSON and resolves
```

`__exec_async` lives in the always-on core binding, not the optional process
binding. That is why `execAsync()` can work even when `__proc_*` is not shipped.

Important behavior:

- It captures stdout only. Redirect stderr explicitly if needed.
- The worker uses `popen`, so the command is shell-interpreted.
- Output is accumulated in memory with no 64 KiB cap.
- The emitted `code` is the raw `pclose()` status, not the decoded process exit
  code used by `framework/process.zig`. A clean command reports `0`, but nonzero
  exits may be wait-status encoded.
- Listener dispatch still goes through `__ffiEmit` and `setTimeout(0)`, so the
  Promise resolves on a later JS tick after the native drain.

If `__exec_async` is missing, `execAsync()` falls back to `globalThis.__exec`
when present, then resolves `{ code:0, stdout }`; otherwise it resolves
`{ code:-1, stdout:'' }`.

## Piped process path

`spawn()` and `useHost({kind:"process"})` both serialize a `SpawnOptions` object
and call `__proc_spawn`.

```text
JS SpawnOptions
  -> JSON.stringify({cmd,args,cwd,env,stdin})
  -> v8_bindings_process.hostSpawn()
  -> hand-parse cmd/cwd/stdin and args array
  -> process.spawnPiped({
       exe,
       args,
       cwd,
       pipe_stdin: stdin == "pipe",
       pipe_stdout: true,
       pipe_stderr: true,
     })
```

In `framework/process.zig`, `spawnPiped()` does the POSIX work:

```text
pipe2(O_CLOEXEC) for stdin/stdout/stderr as requested
fork()

child:
  setsid() unless disabled
  chdir(cwd) when provided
  dup2(stdin read end, 0)
  dup2(stdout write end, 1)
  dup2(stderr write end, 2)
  setenv() for provided EnvVar entries
  execvp(exe, [exe, ...args, null])
  _exit(127) if exec fails

parent:
  register(pid) in the child registry
  close child-side pipe ends
  set stdout/stderr read fds O_NONBLOCK
  return PipedProcess { process, stdin_fd, stdout_fd, stderr_fd }
```

`v8_bindings_process.zig` stores each child in `g_entries`:

```zig
Entry {
  pid,
  piped: process.PipedProcess,
  out_buf: [65536]u8,
  out_len,
  err_buf: [65536]u8,
  err_len,
}
```

On every native frame, `tickDrain()`:

1. Reads each child's stdout fd without blocking.
2. Emits each complete newline-terminated line on `proc:stdout:<pid>`.
3. Reads and emits stderr the same way on `proc:stderr:<pid>`.
4. Flushes a full 64 KiB partial line as one event.
5. Checks `process.alive()`.
6. When the child exits, flushes trailing partial stdout/stderr text.
7. Emits `proc:exit:<pid>` with `{"code":N,"signal":null}`.
8. Removes the entry, closes fds, and closes/deregisters the process handle.

`framework/process.zig` decodes child exit code as `(status >> 8) & 0xFF` when
`waitpid(..., WNOHANG)` reports the child has exited.

## Event delivery

Process events use the same FFI event bus as other V8 host bindings:

```text
Zig:
  v8_runtime.callGlobal2Str("__ffiEmit", channel, payload)

JS:
  subscribe(channel, fn)
  __ffiEmit(channel, payload) {
    setTimeout(() => dispatchListeners(channel, payload), 0)
  }
```

That means process stdout/stderr/exit callbacks do not run synchronously inside
native `tickDrain()`. They run on a later JS timer turn.

Raw channels:

| Channel | Payload |
| --- | --- |
| `proc:stdout:<pid>` | stdout line string, without the newline |
| `proc:stderr:<pid>` | stderr line string, without the newline |
| `proc:exit:<pid>` | JSON string shaped like `{ "code": number, "signal": null }` |
| `proc:ram:<pid>` | JSON string shaped like `{ pid, id, rss, vsize, memTotal, percent }` |
| `proc:cpu:<pid>` | JSON string shaped like `{ pid, id, utime, stime, delta, intervalMs }` |
| `exec:<rid>` | JSON string shaped like `{ code, stdout }` |

## Process stats and watchers

`procStat(pid)` and `watchProcess(pid)` are Linux `/proc` features implemented
in `framework/v8_bindings_process.zig`.

One-shot stat path:

```text
procStat(pid)
  -> __proc_stat(pid)
  -> read /proc/<pid>/status for VmRSS and VmSize
  -> read /proc/<pid>/stat for utime and stime
  -> read /proc/meminfo for MemTotal
  -> return JSON or null
```

Watcher path:

```text
watchProcess(pid, intervalMs)
  -> JS refcount map
  -> __proc_watch_add(pid, max(100, intervalMs))
  -> v8_bindings_process tickWatches()
  -> readProcSample(pid)
  -> emit proc:ram and proc:cpu events when samples change
  -> release() calls __proc_watch_remove(pid) when refcount reaches zero
```

Watcher behavior:

- Watches can target arbitrary pids, not only children spawned by this binding.
- The JS API clamps intervals to at least 100 ms.
- The Zig watcher also clamps intervals to at least 100 ms.
- The first valid sample emits a RAM event.
- Later RAM events emit only on noticeable RSS change: at least 1 MiB or at
  least 0.5 percent of total memory.
- CPU events emit when user/system CPU ticks advance.
- If `/proc` is unavailable or the pid disappears, `procStat` returns null and
  watcher samples are skipped.

The `percent` field is RSS divided by total memory, emitted as a decimal
fraction. For example, `0.125` means 12.5 percent.

## Process IFTTT API

`runtime/hooks/process.ts` registers process sources and actions for
`useIFTTT`.

Sources:

| Source spec | Meaning |
| --- | --- |
| `proc:line:<pid>:<regex>` | Fires when a stdout line matches the regex. |
| `proc:ram:<pid>` | Fires on each emitted RAM sample. |
| `proc:ram:<pid>:>:<threshold>` | Fires when RSS or memory fraction is above a threshold. |
| `proc:ram:<pid>:<:<threshold>` | Fires when RSS or memory fraction is below a threshold. |
| `proc:cpu:<pid>` | Fires when CPU ticks advance. |
| `proc:idle:<pid>:<ms>` | Fires when there is no CPU/stdout/stderr activity for the requested time. |

RAM thresholds accept fractions, percentages, and byte units:

```text
0.80    fraction of system RAM
5%      percent of system RAM
50MB    absolute RSS threshold
2GB     absolute RSS threshold
512KB   absolute RSS threshold
```

Actions:

| Action spec | Meaning |
| --- | --- |
| `proc:spawn:<cmd>` | Spawns a child with no args and drops the resulting pid. |
| `proc:kill:<pid>` | Sends `SIGTERM`. |
| `proc:write:<pid>:<text>` | Writes text to child stdin. |

The idle source is JS-derived. It arms `watchProcess(pid)`, starts a timer,
and resets that timer whenever any of these events arrive:

```text
proc:cpu:<pid>
proc:stdout:<pid>
proc:stderr:<pid>
```

## Build and registration

`__exec_async` is registered by the always-on core binding:

```text
v8_bindings_core.registerCore()
  -> __exec_async
```

`__exec`, `__env_get`, `__env_set`, `__exit`, and `__getpid` are registered by
the optional fs binding:

```text
v8_bindings_fs.registerFs()
  -> __exec
  -> __env_get
  -> __env_set
  -> __exit
  -> __getpid
```

The long-running process binding is optional:

```text
v8_app.zig ingredient "process"
  -> -Dhas-process=true
  -> v8_bindings_process.registerProcess()
  -> __proc_spawn
  -> __proc_kill
  -> __proc_stdin_write
  -> __proc_stdin_close
  -> __proc_stat
  -> __proc_watch_add
  -> __proc_watch_remove
```

Current ship gate behavior:

- `scripts/ship-metafile-gate.js` reads the esbuild metafile and consults
  `sdk/dependency-registry.json`.
- The current registry maps `runtime/hooks/useHost.ts` to `has-process`,
  `has-httpsrv`, `has-wssrv`, and `has-net`.
- `scripts/ship` therefore enables `__proc_*` when `useHost.ts` is shipped.
- `runtime/hooks/process.ts` itself is marked side-effectful in
  `runtime/package.json` because it registers IFTTT sources.

Sharp edge: a cart that imports only `runtime/hooks/process.ts` may include the
JS process API without causing `has-process` or `has-fs` to be enabled by the
current dependency registry. `execAsync()` still works because it is core, but
`spawn()`, `procStat()`, `watchProcess()`, `envGet()`, `envSet()`, `exit()`, and
sync `__exec` depend on optional bindings.

## Child ownership and cleanup

`framework/process.zig` keeps a small child registry:

```text
/tmp/tsz_children_<parent_pid>
```

Every spawned child is registered. The registry supports cleanup on host exit
or crash watchdog cleanup.

`Process.closeProccess()` does:

```text
if still running:
  SIGTERM
  wait up to about 200 ms
  SIGKILL if still alive
  blocking waitpid final reap

deregister(pid)
```

The V8 process binding calls this when removing a child entry after exit and
also when tearing down an entry.

`useHost({kind:"process"})` also sends `SIGTERM` from its React cleanup when the
component unmounts or the process spec changes.

## Current implementation notes

- `wait(pid)` is present in the JS API, but V8 does not register
  `__proc_wait`.
- `SpawnOptions.env` is serialized by JS but currently ignored by
  `v8_bindings_process.hostSpawn()`. `framework/process.zig` can apply env
  entries, but the V8 JSON parser does not pass them through yet.
- `stdin:"inherit"` and `stdin:"ignore"` both mean "do not create a stdin pipe"
  in the current V8 process binding. The child then inherits whatever fd 0 is.
- Stdout and stderr are always piped for `__proc_spawn`.
- Args are parsed by a small hand-rolled JSON string-array parser, not a full
  JSON parser.
- The V8 process binding builds a fixed argv buffer for at most 32 args.
- Pipe line buffers are 64 KiB per stream per child. A longer line is emitted
  as a partial line when the buffer fills.
- Stdout/stderr events are text line events. Binary protocols should use a
  dedicated transport instead.
- `stdinWrite()` returns true when the `write()` syscall returns a nonnegative
  value; it does not currently verify that the full buffer was written.
- `kill(pid)` only searches the V8 process binding's child entries. Process
  watchers can sample arbitrary pids, but `__proc_kill` cannot kill arbitrary
  pids that were not spawned by the binding.
- `SIGKILL` maps to kill. Any other signal string maps to SIGTERM.
- `proc:exit` currently emits `signal:null` even if the process died from a
  signal.
- `__exec` and `__exec_async` are shell-command APIs. Do not pass unsanitized
  user text into them.

## Which API to use

Use `execAsync(cmd)` for one-shot UI actions such as:

- `git status --short`
- `ls`
- fingerprinting a file with a shell command

Use `run(cmd, args)` for short commands where you want separated stdout and
stderr but still want the direct child-process path.

Use `spawn(opts)` for manual long-lived process control.

Use `useHost({kind:"process"})` when process lifetime should follow React
component lifetime and stdout/stderr/exit should flow into component callbacks.

Use `watchProcess()` or `useIFTTT("proc:*", ...)` for RAM/CPU/idle watchdog
behavior.
