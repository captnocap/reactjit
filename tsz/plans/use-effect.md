# useEffect for tsz — Compile-Time Effect System

## Goal

Users write `useEffect` with the same syntax they know from React. Under the hood, the compiler emits frame-loop checks — per-slot dirty flags, SDL_GetTicks timers, init blocks, cleanup blocks. No runtime effect queue, no dependency reconciliation, no closure semantics. Just the API people expect, backed by the architecture that works.

## What the user writes

```tsx
// Run once at startup
useEffect(() => {
  console.log("mounted");
}, []);

// Run when count changes
useEffect(() => {
  console.log("count changed");
}, [count]);

// Run on interval (every 1000ms)
useEffect(() => {
  setSeconds(seconds + 1);
}, 1000);

// Run every frame (no deps)
useEffect(() => {
  // animation tick
});

// Cleanup on shutdown
useEffect(() => {
  return () => {
    console.log("shutting down");
  };
}, []);
```

## Reference: How Lua Does It

The Love2D stack solved this with a two-layer system. The tsz compiler replaces both layers with compile-time codegen.

### Layer 1: `managed_effects.lua` (runtime effect manager)

**File:** `love2d/lua/managed_effects.lua`

Four effect types, all running in `love.update(dt)`:
- **timer** — accumulates `dt`, fires callback at interval (lines 37-52)
- **poll** — same as timer but signals "re-fetch" (lines 55-69)
- **tick** — fires every N frames with dt payload (lines 72-84)
- **mount** — fires once on register, no per-frame work (lines 86-95)

Key function: `ManagedEffects.tick(dt, pushEvent)` (line 159) — iterates all active effects every frame, calls their `tick()` function. This is the "check stuff every frame" loop.

### Layer 2: `useLuaEffect.ts` (React hook interface)

**File:** `love2d/packages/core/src/useLuaEffect.ts`

- Generates stable IDs (lines 25-31)
- Registers effects via bridge RPC to Lua (lines 103-111)
- Subscribes to effect events back from Lua (lines 99-101)
- Cleanup unregisters on unmount (lines 113-116)
- Dependency array triggers re-registration (line 118)

### Layer 3: `timer_cap.lua` (Timer as a node)

**File:** `love2d/lua/capabilities/timer_cap.lua`

Alternative pattern — timer as a JSX element instead of a hook:
```tsx
<Timer interval={1000} onTick={() => setCount(c => c + 1)} />
```
Accumulates dt in `tick()` function (lines 42-66), fires `onTick` event via capability system. Supports `running` prop, `repeat` prop, `fireOnMount`.

## tsz Architecture: No Runtime Effect System

tsz doesn't need `managed_effects.lua` or `useLuaEffect.ts`. The compiler sees `useEffect(...)` and emits the equivalent Zig code directly. There's no runtime effect registry — effects are static, known at compile time.

### The mapping

| useEffect pattern | What compiler emits |
|-------------------|-------------------|
| `useEffect(fn, [])` | Call `fn` once in init section |
| `useEffect(fn, [count])` | In loop: `if (state.slotDirty(0)) fn();` |
| `useEffect(fn, [a, b])` | In loop: `if (state.slotDirty(0) or state.slotDirty(1)) fn();` |
| `useEffect(fn)` (no deps) | In loop: call `fn` every frame |
| `useEffect(fn, 1000)` | In loop: SDL_GetTicks timer check, call `fn` at interval |
| `return () => cleanup()` | Call `cleanup` before exit |

### The `1000` shorthand (interval)

React doesn't support `useEffect(fn, 1000)` — that's a tsz extension. It replaces `setInterval` which doesn't exist here. The Lua stack needed `useLuaEffect({ type: 'timer', interval: 1000 }, ...)` for this — tsz makes it simpler by accepting a number as the second arg.

Detection: if the second argument is a number (not an array), it's an interval in ms.

## Implementation

### Step 1: Runtime — Expose per-slot dirty check

**File:** `tsz/runtime/state.zig`

Add one function (the per-slot dirty flag already exists):

```zig
/// Check if a specific slot has changed since last clearDirty().
pub fn slotDirty(id: usize) bool {
    if (id >= slot_count) return false;
    return slots[id].dirty;
}
```

That's it. One line. The infrastructure is already there.

### Step 2: Compiler — Collect useEffect calls

**File:** `tsz/compiler/codegen.zig`

#### Data structures

Add to Generator struct:

```zig
const MAX_EFFECTS = 32;

const EffectKind = enum {
    mount,        // useEffect(fn, [])       — run once at init
    watch,        // useEffect(fn, [deps])   — run when deps change
    every_frame,  // useEffect(fn)           — run every frame
    interval,     // useEffect(fn, 1000)     — run at ms interval
};

const EffectInfo = struct {
    kind: EffectKind,
    body_start: u32,      // token range for the callback body
    body_end: u32,
    dep_slots: [8]u32,    // state slot IDs for watched deps
    dep_count: u32,
    interval_ms: u32,     // for interval kind
    has_cleanup: bool,     // whether callback has `return () => ...`
    cleanup_start: u32,    // token range for cleanup body
    cleanup_end: u32,
};

// In Generator struct fields:
effects: [MAX_EFFECTS]EffectInfo,
effect_count: u32,
```

Initialize in `Generator.init`:
```zig
.effects = undefined,
.effect_count = 0,
```

#### Collection phase

In `collectStateHooks` (or a new `collectEffects` function called after state hooks are collected), scan for `useEffect(` calls.

The pattern to detect:
```
useEffect ( <arrow-function> )                    → every_frame
useEffect ( <arrow-function> , [ ] )              → mount
useEffect ( <arrow-function> , [ ident, ... ] )   → watch
useEffect ( <arrow-function> , <number> )         → interval
```

**Parsing approach:**
1. Find `useEffect` identifier followed by `(`
2. Record the arrow function body token range (save start, skip balanced `{}` or single expression, save end)
3. Check for `,` after the function body
4. If no `,` before `)` → `every_frame`
5. If `,` then:
   - If `[` → parse dependency array:
     - If `]` immediately → `mount` (empty deps)
     - Otherwise, read identifiers, map each to state slot ID via `isState()`, store in `dep_slots`
   - If number → `interval`, parse ms value
6. Check if the arrow function body contains `return () =>` — if so, record cleanup body range

**Where to add this:** After `collectStateHooks` in the `generate()` function (line 197-221). Add a new phase:

```zig
// Phase 5: Collect useEffect calls
self.pos = app_start;
self.collectEffects(app_start);
```

### Step 3: Emit effect functions

In `emitZigSource`, after handler function emission (around line 1805):

For each effect, emit a Zig function:
```zig
fn _effect_0() void {
    // ... effect body (parsed same way as handler bodies via emitHandlerBody) ...
}
```

For effects with cleanup:
```zig
fn _effect_cleanup_0() void {
    // ... cleanup body ...
}
```

### Step 4: Emit init/loop/cleanup code

#### Init section (after state init, around line 1942):

```zig
// Mount effects — run once
for each effect where kind == .mount:
    _effect_0();

// Interval effects — init timers
for each effect where kind == .interval:
    var _timer_0: u32 = c.SDL_GetTicks();
```

Timer variables need to be module-level (emitted with the node arrays):
```zig
var _timer_0: u32 = 0;  // initialized in main()
```

#### Loop section (after state dirty check, around line 1952):

```zig
// Watch effects — per-slot dirty check
for each effect where kind == .watch:
    if (state.slotDirty(dep_slots[0]) or state.slotDirty(dep_slots[1])) {
        _effect_N();
    }

// Every-frame effects
for each effect where kind == .every_frame:
    _effect_N();

// Interval effects — SDL_GetTicks timer
for each effect where kind == .interval:
    const _now = c.SDL_GetTicks();
    if (_now - _timer_N >= interval_ms) {
        _timer_N = _now;
        _effect_N();
    }
```

**Important ordering:** Effect checks run AFTER `updateDynamicTexts()` and `updateConditionals()` but BEFORE `state.clearDirty()`. This ensures effects see the dirty flags before they're cleared.

The existing dirty check block:
```zig
if (state.isDirty()) { updateDynamicTexts(); updateConditionals(); state.clearDirty(); }
```

Becomes:
```zig
if (state.isDirty()) {
    updateDynamicTexts();
    updateConditionals();
    // Watch effects check per-slot dirty BEFORE clearDirty
    if (state.slotDirty(0)) { _effect_0(); }
    state.clearDirty();
}
// Every-frame effects run outside dirty check
_effect_1();
// Interval effects run outside dirty check
if (SDL_GetTicks() - _timer_2 >= 1000) { _timer_2 = SDL_GetTicks(); _effect_2(); }
```

#### Cleanup section (before exit, end of main):

```zig
// Cleanup effects
for each effect where has_cleanup:
    _effect_cleanup_N();
```

### Step 5: Effect body parsing

Effect bodies are parsed the same way as handler bodies — `emitHandlerBody()` already handles arrow functions. The only difference:

1. **Multi-statement bodies** are needed here. The plan for Agent 4 deferred multi-statement handlers, but effects are where multi-statement bodies matter most. Parse `{ stmt; stmt; }` in effect bodies specifically.

2. **Return cleanup** — detect `return () =>` or `return () => { ... }` inside the effect body. Split into two separate function emissions.

If multi-statement parsing isn't ready yet, effects with single-expression bodies still work for the most common cases:
```tsx
useEffect(() => setCount(count + 1), 1000);        // single expression, interval
useEffect(() => console.log("mounted"), []);         // single expression, mount
```

## Example .tsz File

```tsx
function App() {
  const [count, setCount] = useState(0);
  const [seconds, setSeconds] = useState(0);

  // Mount effect — runs once
  useEffect(() => console.log("App started"), []);

  // Watch effect — runs when count changes
  useEffect(() => console.log("count is now updated"), [count]);

  // Interval effect — increment seconds every 1000ms
  useEffect(() => setSeconds(seconds + 1), 1000);

  return (
    <Box style={{ padding: 32, backgroundColor: '#1e1e2a', width: '100%', height: '100%' }}>
      <Text fontSize={24} color="#ffffff">{`Count: ${count}`}</Text>
      <Text fontSize={18} color="#888888">{`Seconds: ${seconds}`}</Text>
      <Pressable onPress={() => setCount(count + 1)} style={{ padding: 16, backgroundColor: '#4ec9b0', marginTop: 8 }}>
        <Text fontSize={16} color="#ffffff">Increment</Text>
      </Pressable>
    </Box>
  );
}
```

Expected generated Zig (simplified):
```zig
var _timer_0: u32 = 0;

fn _effect_mount_0() void {
    std.debug.print("App started\n", .{});
}

fn _effect_watch_0() void {
    std.debug.print("count is now updated\n", .{});
}

fn _effect_interval_0() void {
    state.setSlot(1, state.getSlot(1) + 1);
}

// In main() init:
_effect_mount_0();
_timer_0 = c.SDL_GetTicks();

// In main loop:
if (state.isDirty()) {
    updateDynamicTexts();
    if (state.slotDirty(0)) { _effect_watch_0(); }
    state.clearDirty();
}
{
    const now = c.SDL_GetTicks();
    if (now - _timer_0 >= 1000) {
        _timer_0 = now;
        _effect_interval_0();
    }
}
```

## Files Changed

| File | Change |
|------|--------|
| `tsz/runtime/state.zig` | Add `slotDirty(id)` — one function, one line |
| `tsz/compiler/codegen.zig` | Add `EffectInfo` struct, `collectEffects()`, effect function emission, init/loop/cleanup wiring |
| `tsz/examples/effect-test.tsz` | Test with mount, watch, and interval effects |

## Implementation Order

1. **`slotDirty` in state.zig** — one line, instant
2. **`collectEffects` parser** — detect useEffect calls, classify kind, record token ranges and dep slots
3. **Mount effects** — emit init-time function calls. Verify with `useEffect(() => console.log("hi"), [])`
4. **Watch effects** — emit per-slot dirty checks in loop. Verify with `useEffect(() => console.log("changed"), [count])`
5. **Interval effects** — emit SDL_GetTicks timer checks. Verify with `useEffect(() => setSeconds(seconds + 1), 1000)`
6. **Every-frame effects** — emit unconditional call in loop
7. **Cleanup** — detect `return () =>`, emit shutdown functions

Work incrementally. Each kind independently testable.

## What This Does NOT Cover

- **Cleanup between re-runs** — React's useEffect runs cleanup before re-running when deps change. In tsz, watch effects just fire when dirty — there's no "previous run cleanup." This matches the Lua behavior (managed_effects doesn't have per-run cleanup either, only register/unregister cleanup).
- **Effect ordering guarantees** — effects fire in declaration order, same as function emission order. No priority system.
- **Async effects** — no `async () => {}` support. Effects are synchronous. Use FFI for blocking I/O (same as Lua stack — see `love2d/lua/http.lua` for the thread pool pattern if non-blocking is needed later).
- **useLayoutEffect** — no distinction from useEffect in tsz. There's one loop, one phase. Everything is synchronous.

## Verification

```bash
zig build tsz-compiler && ./zig-out/bin/tsz build tsz/examples/effect-test.tsz
```

Run the binary:
- "App started" should print once at launch
- Pressing the button should print "count is now updated"
- Seconds counter should increment every second automatically
