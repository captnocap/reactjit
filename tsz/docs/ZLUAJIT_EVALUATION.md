# zluajit Evaluation — Zig Bindings for LuaJIT

**Repo:** https://github.com/negrel/zluajit
**License:** MIT
**Zig compat:** 0.14.1+ (0.15 runtime compat confirmed)
**LuaJIT:** Builds from source (pinned commit) or links system LuaJIT

## What zluajit provides

A full idiomatic Zig wrapper around the LuaJIT C API (~2450 lines):

- **Type-safe State struct** wrapping `*lua_State` with methods instead of free functions
- **Comptime function wrapping** via `wrapFn(zigFunc)` — auto-extracts Lua stack args, pushes results back. Eliminates manual `lua_toXxx`/`lua_pushXxx` boilerplate
- **Tagged union Value type** — `toAnyType`/`pushAnyType` for generic Zig<->Lua marshalling
- **TableRef/FunctionRef** — RAII-style handles with method syntax (`table.setField(...)`)
- **Panic recovery** — setjmp/longjmp wrapper for LuaJIT error handling (critical — LuaJIT uses longjmp for errors, which is UB if it crosses Zig frames without this)
- **Full API coverage** — stack ops, tables, metatables, userdata, coroutines, GC, debug, all standard libs
- **Build system integration** — `zig fetch` + `addImport`, builds LuaJIT from source or links system lib

## What we have today

### C shim (`ffi/lua_worker_shim.c`, 138 lines)
- Embeds a LuaJIT VM on a background pthread
- Atomic counters for message passing (inbox/outbox/bridge_n)
- Hardcoded Lua worker script (tight loop processing messages)
- 6 exported functions: `start`, `send`, `recv_count`, `bridge_n`, `set_n`, `elapsed_us`
- No Lua table access, no function calls, no coroutines — pure atomic counter bridge

### Zig benchmarks (`bench_lua_worker.zig`, `bench_lua_stress.zig`)
- Use `@cImport` of lua.h directly — raw C API calls
- Manual `lua_pushcclosure`/`lua_setglobal` for host functions
- Manual `lua_tolstring`/`lua_pushlstring` for message passing
- Thread-local `WorkerCtx` with mutex-protected message queues
- 5 test suites: bridge throughput, compute, JSON, multi-worker, main-thread impact

### Measured performance (current system, this session)
| Metric | Value |
|--------|-------|
| VM startup | 29us/lifecycle |
| Message throughput | 2.65M msgs/sec |
| Compute ops | 580K ops/sec (table serialize) |
| Multi-worker (4 threads) | 3.0M total ops/sec |
| Main-thread impact | ZERO (60fps maintained) |

## Comparison

| Aspect | Current (C shim + raw @cImport) | zluajit |
|--------|-------------------------------|---------|
| Safety | Manual — wrong stack index = UB | Type-checked, comptime-verified |
| Boilerplate | ~15 lines per host function | `wrapFn(zigFunc)` — zero boilerplate |
| Error handling | Manual pcall + error string extraction | `pCall` returns Zig error union |
| LuaJIT longjmp | Not handled — UB if Lua errors in Zig callbacks | `recover.zig` handles via setjmp |
| Threading | We own it (pthread in C shim) | Not provided — still need our own |
| Message queue | Atomic counters + mutex queue | Not provided — still need our own |
| Build | System libluajit-5.1 (`-lluajit-5.1`) | Builds from source or system lib |
| Dependencies | libluajit-5.1-dev package | None (fetches LuaJIT source) |
| Code size | 138 lines C + 530 lines Zig | 2450 lines (full API surface) |

## Would it replace or complement our C shim?

**Complement, not replace.** The C shim does one specific thing (atomic message bridge on a pthread) that zluajit doesn't address. But zluajit would replace:

1. **The raw `@cImport` usage** in bench_lua_worker.zig and bench_lua_stress.zig
2. **Manual host function registration** (`lua_pushcclosure` + `lua_setglobal`) — replaced by `wrapFn`
3. **Manual value marshalling** — replaced by type-safe `pushAnyType`/`toAnyType`
4. **The error handling gap** — LuaJIT uses longjmp for errors, which is UB when crossing Zig stack frames. zluajit's `recover.zig` handles this. Our current code is silently vulnerable.

The C shim could be rewritten in pure Zig using zluajit, eliminating the C dependency entirely. The pthread + atomic counters would stay (Zig std.Thread + std.atomic), but the Lua VM lifecycle and host function registration would use zluajit.

## Performance implications

**No regression expected.** zluajit is a thin wrapper — all methods are `inline` or direct C calls. The `wrapFn` comptime codegen produces the same machine code as hand-written `lua_toXxx`/`lua_pushXxx` sequences. The wrapper cost is zero at runtime.

**LuaJIT vs standard Lua:** We already use LuaJIT (OpenResty branch, 2.1.0). zluajit doesn't change this — it wraps the same LuaJIT C API. Our 2.65M msgs/sec and 29us VM startup numbers would be unchanged.

**Build-from-source option:** zluajit can build LuaJIT from source with Zig's C compiler, which means:
- No system dependency on `libluajit-5.1-dev`
- Reproducible builds across machines
- Potential to use optimized LuaJIT compile flags

## Integration path

### Phase 1: Zig package (low effort)
```bash
# In tsz/build.zig.zon, add dependency:
zig fetch --save https://github.com/negrel/zluajit/archive/<commit>.tar.gz
```
Then in build.zig, add `exe.root_module.addImport("zluajit", zluajit_mod)`.

### Phase 2: Rewrite benchmarks (medium effort)
Replace `@cImport` in bench_lua_worker.zig and bench_lua_stress.zig with zluajit:
```zig
const zluajit = @import("zluajit");
const L = try zluajit.State.init(.{ .allocator = alloc });
defer L.deinit();
L.openLibs();

// Host function — comptime wrapped, no manual stack manipulation
L.pushZFunction(zluajit.wrapFn(struct {
    fn hostRecv(state: *zluajit.State) !i64 {
        // ... read from inbox queue
    }
}.hostRecv));
L.setGlobal("host_recv");
```

### Phase 3: Replace C shim (larger effort)
Rewrite `ffi/lua_worker_shim.c` as pure Zig using zluajit + std.Thread:
- Eliminate C dependency
- Type-safe host function registration
- Proper error handling via recover.zig
- Same atomic counter bridge, but in Zig

### Phase 4: Framework integration (future)
If Lua workers become a first-class framework feature:
- zluajit State as part of the engine context
- Host functions registered via framework API, not manual shim
- Lua worker pool managed by the engine alongside QuickJS

## Risks and blockers

### 1. LLVM backend requirement
zluajit README recommends LLVM backend + LLD linker to avoid unwinding errors. Our project uses the default Zig backend. Need to verify:
- Does it work with Zig's self-hosted backend? (likely yes for the bindings, maybe not for building LuaJIT from source)
- System LuaJIT option (`-Dsystem=true`) avoids this entirely

### 2. Zig 0.15 compatibility
zluajit declares min Zig 0.14.1 with 0.15 runtime compat. We use 0.15.2. Should work but needs verification — API breakage between 0.14 and 0.15 is common.

### 3. Build system complexity
Adding a Zig package dependency to our build.zig means:
- `zig fetch` step in CI
- Network dependency at build time (or vendored tarball)
- Potential conflicts with our existing LuaJIT system library linking

### 4. Thread safety gap
zluajit doesn't provide thread safety — `lua_State` is not thread-safe. Our current approach (one State per worker thread) is correct and would remain unchanged. But zluajit's ergonomic API might tempt accidental shared-state usage.

### 5. Scope creep
zluajit exposes the full LuaJIT API surface (coroutines, metatables, userdata, FFI). Our Lua usage is intentionally minimal (compute workers). Adopting the full API might encourage building features that should stay in Zig or QuickJS.

## Recommendation

**Adopt for benchmarks and new Lua code, don't rush to replace the C shim.**

1. Add zluajit as a build dependency
2. Use it for new Lua benchmark code and any new worker features
3. The C shim works, is tested, and has known performance — rewrite it when we need features the shim can't provide (table passing, coroutines, error recovery)
4. The critical win is **error safety** — our current code is vulnerable to LuaJIT longjmp crossing Zig frames. zluajit's recover.zig fixes this properly.
