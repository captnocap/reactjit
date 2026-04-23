# Click latency plan

Target 13 needs a real measurement path for sweatshop scale clicks. The goal is
to measure one click end-to-end without adding heap allocations or extra
framework awareness to JSRT.

## Scope

Measure the wall-clock path from the SDL press that starts a click through the
JSRT dispatch, the React handler, the resulting state update/commit, the host
flush, and the final Zig-side node mutation apply.

This is a separate probe from the existing `framework/engine.zig` input-to-
present logger. That probe is frame coarse; this one must be per-click and must
split the chain into hop-level timestamps.

## Real hop map

The current codebase does not have `jsrt_app.zig` yet, so the exact plumbing is
split across the existing host and the future app binary. The measurement points
should be attached at these boundaries:

1. SDL mouse-down press edge
   - Current location: `framework/engine.zig` click branch after hit testing.
   - Future JSRT app location: the same SDL press callback in `jsrt_app.zig`.
   - Stamp: `press_ns`.

2. JSRT dispatch entry
   - Boundary: the host call that invokes `__dispatchEvent(...)` into JSRT.
   - Stamp: `dispatch_ns`.

3. React handler entry
   - Boundary: the user handler function entry inside JS execution.
   - Stamp: `handler_ns`.

4. State update / commit ready
   - Boundary: the point where the handler's update has become a committed
     update batch ready to flush.
   - Stamp: `state_update_ns`.

5. Host flush entry
   - Boundary: `__hostFlush(...)` receives the batch.
   - Stamp: `flush_ns`.

6. Zig node pool mutation complete
   - Boundary: the batch has been applied to the retained Zig node tree.
   - Stamp: `apply_done_ns`.

The sample is one click, one ring-buffer slot. Later phases can overwrite the
same slot as the click moves through the chain. That keeps the hot path free of
allocations and makes summary math simple.

## What gets timed

All stamps should use `std.time.nanoTimestamp()` and be stored as unsigned
nanosecond values. Treat them as monotonic host-clock timestamps, not civil
wall-clock time.

Per-click struct fields:

- `press_ns`
- `dispatch_ns`
- `handler_ns`
- `state_update_ns`
- `flush_ns`
- `apply_done_ns`

Derived durations:

- `press -> dispatch`
- `dispatch -> handler`
- `handler -> state_update`
- `state_update -> flush`
- `flush -> apply_done`
- `press -> apply_done` total

If a click causes multiple flush/apply cycles, keep the final `flush_ns` and
`apply_done_ns` for that click so the sample reflects the completed UI change.
If we later need sub-flush visibility, add extra fields, but do not change the
hot-path allocation model.

## Storage model

Use a bounded ring buffer with a fixed compile-time capacity.

Requirements:

- no heap allocations in the hot path
- one slot per click
- overwrite oldest samples on wrap
- skip incomplete samples when summarizing

Recommended shape:

- `ClickLatencySample` for the timestamps
- `ClickLatencyRing` for the fixed buffer and write cursor
- capacity around `4096` samples to keep a few seconds of burst traffic
  visible without growing unbounded

## Dump model

Provide a Zig-side dump function first.

Desired behavior:

- read the last `N` completed samples from the ring
- compute `p50`, `p95`, and `max` for each derived duration
- print a compact table to stderr/stdout
- ignore incomplete samples

This can live as something like:

```zig
pub fn dumpClickLatencySummary(store: *const ClickLatencyRing, last_n: usize) void
```

or a writer-based variant if we want to direct the output elsewhere later.
Lua is optional for the first pass; Zig is the simpler place to keep the timing
and percentile code because the final apply point lives on the host side.

## Non-goals

- Do not wire anything into `jsrt_app.zig` yet.
- Do not add heap-backed tracing or JSON logging in the hot path.
- Do not turn this into a per-frame telemetry system.
- Do not broaden JSRT scope beyond the event/flush boundary.

## Integration order

1. Land the ring-buffer struct and summary helper in JSRT-local Zig code.
2. Wire the future `jsrt_app.zig` press path to stamp `press_ns`.
3. Add JSRT dispatch/handler/flush stamps at the host bridge points.
4. Keep the summary dump callable from the host so we can print
   `p50/p95/max` over the last `N` completed clicks when debugging target 13.
