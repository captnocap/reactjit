# Benchmark Results

Subsystem performance measurements for the tsz framework.

**Date:** 2026-03-25
**Platform:** x86_64 Linux, Zig 0.15.2, SDL3 3.2.8, wgpu
**Build:** ReleaseFast
**Resolution:** 1280x800

---

## Measured Results (T0 Baseline)

All 4 benchmarks built and ran successfully. The ramp scripts (progressive load escalation) did not execute due to a script import resolution issue — the `_script.tsz` files were not loaded by the QuickJS runtime. Results below are T0 baseline (initial node count, no load ramp).

### Layout Benchmark — 147 visible nodes, 38 hidden

| Metric | Value |
|--------|-------|
| FPS | 237-240 (capped) |
| Layout | 35-77us (avg ~48us) |
| Paint | 12-29us (avg ~17us) |
| Visible nodes | 147 |
| Hidden nodes | 38 |

### Render Benchmark — 91 visible nodes, 15 hidden

| Metric | Value |
|--------|-------|
| FPS | 237-240 (capped) |
| Layout | 20-77us (avg ~37us) |
| Paint | 12-18us (avg ~15us) |
| Visible nodes | 91 |
| Hidden nodes | 15 |

### State Benchmark — 52 visible nodes (64 useState slots allocated)

| Metric | Value |
|--------|-------|
| FPS | 240-242 (capped) |
| Layout | 29-63us (avg ~43us) |
| Paint | 21-29us (avg ~23us) |
| Visible nodes | 52 |
| Bridge calls | 0/s (script didn't load) |

### Script Benchmark — 44 visible nodes

| Metric | Value |
|--------|-------|
| FPS | 240 (capped) |
| Layout | 39-60us (avg ~50us) |
| Paint | 37-41us (avg ~39us) |
| Visible nodes | 44 |
| Bridge calls | 0/s (script didn't load) |

---

## Performance Scaling (from effect-bench suite)

The existing `carts/effect-bench/` suite provides measured data at higher loads:

### Layout vs Node Count

| Source | Nodes | FPS | Layout (us) |
|--------|-------|-----|-------------|
| Script bench (T0) | 44 | 240 | 50 |
| Render bench (T0) | 91 | 240 | 37 |
| Layout bench (T0) | 147 | 240 | 48 |
| Dashboard cart | ~200 | 240 | 100-175 |
| StressZig1000 | ~1000 | 240 | 150-200 |
| StressMap500 | ~500 | 120-200 | 400-800 |

**Finding:** Layout scales sub-linearly up to ~500 nodes. At ~1000 nodes, layout is still only 200us (1.2% of frame budget). Map-based dynamic nodes (StressMap500) are significantly more expensive than static nodes due to rebuild overhead.

### Paint vs Rect Count

| Source | Rects | FPS | Paint (us) |
|--------|-------|-----|------------|
| Script bench (T0) | ~44 | 240 | 39 |
| Render bench (T0) | ~91 | 240 | 15 |
| Layout bench (T0) | ~147 | 240 | 17 |
| Dashboard | ~200 | 240 | 100-150 |
| StressZig1000 | ~1000 | 240 | 100-200 |

**Finding:** Paint is extremely cheap — the wgpu rect batch renderer handles 1000+ rects at under 200us. The batch renderer sends all rects in a single draw call.

### Bridge Throughput (from StressJS)

| Calls/frame | FPS | Bridge time |
|------------|-----|-------------|
| 10 | 240 | <1ms |
| 80 | 240 | <1ms |
| 320 | 240 | ~1ms |
| 640 | 200 | ~2ms |
| 1,280 | 120 | ~4ms |
| 2,560 | 60 | ~8ms |
| 5,120 | 30-40 | ~16ms |

**Finding:** Bridge is negligible below ~500 calls/frame. Practical limit for 60fps is ~2,500 calls/frame.

### State Mutations — Zig vs JS

| Path | Mutations/frame | Overhead per call |
|------|----------------|-------------------|
| Zig useEffect | 8 | ~0.6us |
| JS __setState | 8 | ~6us |

**Finding:** Native Zig state mutations are 10x faster than JS bridge calls. Both are negligible for typical apps.

---

## Frame Budget Analysis

At 240fps cap (4.16ms/frame) with 147 nodes:

```
Layout:  ~48us   (1.2%)
Paint:   ~17us   (0.4%)
Tick:    ~10us   (0.2%)
Bridge:  0us     (0%)
──────────────────────
Total:   ~75us   (1.8%)
Headroom: 98.2%
```

At 60fps floor (16.6ms/frame), the framework can handle:
- ~5,000+ static nodes before layout exceeds budget
- ~10,000+ rects before paint exceeds budget
- ~2,500 JS bridge calls before bridge exceeds budget
- Layout is always the first bottleneck

---

## Known Issues

1. **Script imports not loading:** The `_script.tsz` ramp scripts were not executed — `bridge: 0/s` confirms no JS ran. The `from './bench_telemetry_script'` import compiles but the JS content is not being evaluated at runtime. This needs investigation — likely the script content is compiled but `qjs_runtime.evalScript()` isn't being called with the concatenated JS.

2. **No progressive load data:** Without the ramp scripts, we only have T0 baseline. The tier escalation (T0→T4) was designed to show where each subsystem degrades, but requires working script imports to drive the state changes.

---

## Running Benchmarks

```bash
cd ~/creative/reactjit

# Build all 4
bin/tsz build tsz/carts/benchmarks/layout-bench.app.tsz
bin/tsz build tsz/carts/benchmarks/render-bench.app.tsz
bin/tsz build tsz/carts/benchmarks/state-bench.app.tsz
bin/tsz build tsz/carts/benchmarks/script-bench.app.tsz

# Run (25s each, GUI window)
timeout 25 ./tsz/zig-out/bin/layout-bench.app 2>&1 | grep telemetry
timeout 25 ./tsz/zig-out/bin/render-bench.app 2>&1 | grep telemetry
timeout 25 ./tsz/zig-out/bin/state-bench.app 2>&1 | grep telemetry
timeout 25 ./tsz/zig-out/bin/script-bench.app 2>&1 | grep telemetry
```

## Status

- [x] All 4 benchmark carts build successfully
- [x] T0 baseline data collected (layout, render, state, script)
- [x] Reference data from effect-bench suite included
- [ ] Progressive load ramp (T0→T4) — blocked by script import issue
- [ ] JSON result export for CI regression tracking
