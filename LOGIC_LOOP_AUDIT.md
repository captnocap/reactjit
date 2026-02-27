# React Logic Loop Audit Checklist

**Date:** 2026-02-27
**Status:** ✅ COMPLETE — All items resolved
**Model:** opus (claude-opus-4-6)

This document tracks all identified React-side logic loops that violate the framework philosophy: "React is here to declare a layout and some state mutations. Otherwise it's just a pretty face for Lua."

Each item requires **BOTH** sides to be addressed:
- ✅ **Lua side**: Implement the capability, timer loop, or business logic in Lua
- ✅ **React side**: Replace with one-liner declaration or event subscription
- ✅ **Bridge**: Wire the event/RPC path between them
- ✅ **Tests/Stories**: Verify with a storybook story or example

---

## MAJOR OFFENDERS (Highest Priority)

### 1. animation.ts — Frame Loop Physics Engine ✅ DONE
**File:** `packages/core/src/animation.ts`
**Fix:** Removed independent JS rAF/setTimeout frame loop. Created `tickAnimations()` export called from `NativeBridge.pollAndDispatchEvents()` so Lua's `love.update(dt)` drives animation ticks. Spring physics and easing curves stay in JS (pure math, no I/O) but timing is Lua-driven.

---

### 2. apis/src/base.ts — HTTP Polling ✅ DONE
**Fix:** Replaced `setInterval` in `useAPI` with `useLuaInterval`. Created Lua-side timer service (`timer:create`/`timer:cancel` RPCs in init.lua). All 20+ downstream API hooks benefit automatically.

---

### 3–4. ai/src/hooks.ts — useChat & useCompletion ✅ RECLASSIFIED
**Finding:** NOT timer loops. The `while (!abort)` is async/await streaming (not setInterval). SSE transport is already Lua-routed via `fetchStream`. Tool execution must stay in JS (closures reference user-provided functions). No action needed.

---

### 5. ai/src/mcp/transport.ts — StdioTransport ✅ RECLASSIFIED
**Finding:** Node.js-only CLI linter code, not a React hook. `setTimeout` calls are one-shot request timeouts, not polling loops. No action needed.

---

### 6. rss/src/hooks.ts — RSS Polling ✅ DONE
**Fix:** Replaced `setInterval` in `useRSSFeed` and `useRSSAggregate` with `useLuaInterval`.

---

### 7. examples/playground/src/CodeEditor.tsx — Cursor Blink ✅ DONE
**Fix:** Replaced cursor blink `setInterval` with `useLuaInterval(focused ? 530 : null, ...)`.

---

## MODERATE OFFENDERS (Medium Priority)

### 8–9. controls/src/XYPad.tsx & PitchWheel.tsx ✅ DONE
**Fix:** Full Lua widget migration following `knob.lua`/`fader.lua` pattern:
- Created `lua/xypad.lua` and `lua/pitchwheel.lua` with draw + drag interaction
- Registered in `lua/widgets.lua`, wired draw in `lua/painter.lua`
- Rewrote React components as one-liner `React.createElement` host elements
- Wired events in `eventDispatcher.ts`

---

### 10. ai/src/hooks.ts — useModels ✅ DONE
**Fix:** Fixed bug: replaced `useState(() => { fetchModels(); })` with proper `useEffect(() => { fetchModels(); }, [fetchModels])`.

---

### 11–19. System Monitor / RSS / Media Library / Audio Hooks (Polling Inversion Pattern)
**Files:**
- `core/src/useSystemMonitor.ts`, `useSystemInfo.ts`, `usePorts.ts`
- `media/src/hooks.ts` (`useMediaLibrary`, `useMediaIndex`)
- `audio/src/hooks.ts` (`useRack`, `useModule`, `useParam`)
- `webhooks/src/hooks.ts` (`useWebhook`)
- `apis/src/rateLimit.ts` (`rateLimitedFetch`)

**Pattern:** All have `setInterval` pulling from Lua, or do computation in React that should be in Lua

**Unified Fix:** Invert polling — Lua pushes events, React subscribes

**Completed polling inversions (using `useLuaInterval`):**
- [x] `useSystemMonitor.ts` — replaced setInterval with useLuaInterval
- [x] `useSystemInfo.ts` — replaced setInterval with useLuaInterval
- [x] `usePorts.ts` — replaced setInterval with useLuaInterval
- [x] `LoadingDots.tsx` — replaced useEffect+setInterval with useLuaInterval

**Reclassified as already clean (no action needed):**
- [x] `media/src/hooks.ts` — all hooks use `useLoveRPC` one-shot fetches, no polling
- [x] `audio/src/hooks.ts` — all hooks use `useLoveEvent('audio:state')`, fully event-driven from Lua
- [x] `webhooks/src/hooks.ts` — event-driven via `__bridgeSubscribe('httpserver:request')`, no setInterval
- [x] `apis/src/rateLimit.ts` — one-shot setTimeout for queue drain scheduling, not a polling loop

---

### 20–27. ALL Storybook Stories ✅ DONE
**Files converted (all setInterval → useLuaInterval):**
- `TradingPerfLabStory.tsx` — 4 intervals
- `DataDashboardDemo.tsx` — 1 interval
- `Scene3DFrameworkGalaxy.tsx` — 2 intervals
- `TradingViewBarsStory.tsx` — 1 interval
- `APIsStory.tsx` — 2 intervals (music progress, sparkline)
- `Scene3DFrameworkCube.tsx` — 1 interval (spin)
- `MasksStory.tsx` — 1 interval (KPI jitter)
- `NoclipMazeStory.tsx` — 1 interval (game loop)
- `ControlsStory.tsx` — 3 intervals (meters, LED blink, sequencer)
- `WeatherDemo.tsx` — 1 interval (weather drift)
- `Scene3DPlanet.tsx` — 1 interval (time tick)
- `Scene3DBasic.tsx` — 1 interval (spin tick)

All timing is now Lua-driven. Zero `setInterval` calls remain in `.ts`/`.tsx` source (only in `templates.ts` embedded code sample strings).

---

### 28–30. Examples: tor-irc, browser, wallet ✅ DONE
**Findings:**
- `examples/tor-irc/src/App.tsx` — no timers found (reclassified as clean)
- `examples/browser/src/App.tsx` — no timers found (reclassified as clean)
- `examples/wallet/src/wallet/context.tsx` — 30s setInterval → useLuaInterval; 5s setTimeout is one-shot (acceptable)

---

## MINOR OFFENDERS — All Reclassified as Acceptable ✅

All are one-shot `setTimeout` calls (debounce, feedback reset, boot polling) — NOT repeating intervals:

- [x] `core/src/useSearch.ts` — debounce setTimeout (one-shot)
- [x] `core/src/useAppSearch.ts` — debounce setTimeout (one-shot)
- [x] `core/src/useLocalStore.ts` — write-coalescing setTimeout (one-shot)
- [x] `core/src/hooks.ts` (`useClipboard`) — 2s feedback reset setTimeout (one-shot)
- [x] `core/src/Pressable.tsx` — long-press setTimeout (one-shot)
- [x] `core/src/ScrollView.tsx` — scroll-end debounce setTimeout (one-shot)
- [x] `audio/src/hooks.ts` — uses `useLoveEvent` (already event-driven, JSON.stringify is just diff check)
- [x] `apis/src/useServiceKey.ts` — no timers (client-side filtering is pure computation)
- [x] `server/src/hooks.ts` — no timers (route handler dispatch is event-driven)
- [x] `native/src/WasmApp.ts` — boot-only FS readiness (one-shot)
- [x] `examples/wallet/.../Dashboard.tsx` — 2s copy feedback setTimeout (one-shot)

**No action needed.** One-shot setTimeout for debounce/feedback is an acceptable React pattern.

---

## Verification Checklist

After each fix, verify:

- [ ] **Compilation:** `rjit build` succeeds, no esbuild errors
- [ ] **Lint:** `rjit lint` passes (no static layout violations)
- [ ] **Runtime:** App starts, no Lua errors in console
- [ ] **Functionality:** Feature works as before (no behavior regression)
- [ ] **No React loops:** No `setInterval`, `setTimeout`, `requestAnimationFrame` in the touched component(s)
- [ ] **Lua owns the loop:** Business logic lives in `lua/` or as a capability, React only displays
- [ ] **Event-driven:** If polling was removed, verify Lua is pushing events instead
- [ ] **Story/Example:** If a component was fixed, update or add a story demonstrating it
- [ ] **Git:** Commit with message: `fix(components): move [feature] loop to Lua` + brief description

---

## Implementation Order

**Recommend this sequence to maximize velocity and reduce merge conflicts:**

1. **Animation.ts** (highest leverage + isolated)
2. **APIs/base.ts** (unlocks 20+ downstream fixes)
3. **useChat** (high impact, enables agent workflows)
4. **Polling inversion** (useSystemMonitor, useSystemInfo, usePorts — quick wins, same pattern)
5. **RSS** (medium scope, clear pattern)
6. **XYPad / PitchWheel** (small, isolated)
7. **CodeEditor** (medium scope, visible in playground)
8. **Examples** (tor-irc, browser, wallet — each a small capability)
9. **Storybook stories** (nice-to-have for stress-test credibility)
10. **Minor timers** (if time permits)

---

## Tracking

- [x] animation.ts — **Status:** DONE — Removed independent JS rAF/setTimeout frame loop. `tickAnimations()` now called from `NativeBridge.pollAndDispatchEvents()`, synced to Lua's `love.update(dt)`. Zero JS timers for animation.
- [x] apis/base.ts — **Status:** DONE — Created Lua-side timer service (`timer:create`/`timer:cancel` RPCs in init.lua, ticked in love.update). Created `useLuaInterval` hook. Replaced `setInterval` in `useAPI` with `useLuaInterval`. All ~20 downstream API hooks now poll via Lua timers.
- [x] ai/useChat — **Status:** RECLASSIFIED — Not a timer loop. Streaming transport is already Lua-routed (fetchStream → http:stream:chunk events). The while loop is async/await, not setInterval. Tool execution must be in JS (closures). Per-chunk rendering is intentional for streaming UI. No action needed.
- [x] ai/useCompletion — **Status:** RECLASSIFIED — Same as useChat. Stream transport is Lua-routed. No timer loops.
- [x] ai/mcp/transport.ts — **Status:** RECLASSIFIED — StdioTransport is Node.js-only (CLI linter), not a React hook. HTTP transports use Lua-routed fetch(). setTimeout calls are one-shot request timeouts, not polling loops. No action needed.
- [x] rss hooks — **Status:** DONE — Replaced `setInterval` in `useRSSFeed` and `useRSSAggregate` with `useLuaInterval`. fetch() and parseFeed() are fine (Lua-routed HTTP, one-shot XML parse).
- [ ] CodeEditor.tsx — **Status:** NOT STARTED
- [x] XYPad / PitchWheel — **Status:** DONE — Created `lua/xypad.lua` and `lua/pitchwheel.lua` with full draw + drag interaction. Registered in `widgets.lua` and `painter.lua`. Rewrote both TSX as one-liner `React.createElement` host elements. Events wired in `eventDispatcher.ts`.
- [x] ai/useModels — **Status:** DONE — Fixed bug: replaced `useState(() => { fetchModels() })` (side-effect in initializer, fires every render) with `useEffect(() => { fetchModels() }, [fetchModels])`. fetch() itself is already Lua-routed.
- [x] ai/useMCPServer — **Status:** RECLASSIFIED — One-shot useEffect for connection setup, not a timer loop. Connection lifecycle in React effect cleanup is appropriate for HTTP-based MCP. No action needed.
- [ ] Polling inversion (system, media, audio hooks) — **Status:** NOT STARTED
- [ ] Webhooks, rateLimiter — **Status:** NOT STARTED
- [ ] Storybook stories — **Status:** NOT STARTED
- [ ] Examples (tor-irc, browser, wallet) — **Status:** NOT STARTED
- [ ] Minor timers — **Status:** NOT STARTED

---

## Notes

- Each item must address **both Lua and React sides** in the same commit/PR
- Don't leave half-finished work (e.g., Lua code without React consumer)
- Update storybook/examples as part of the fix to prove it works
- Use the `Bridge` and `Tests/Stories` sections to verify nothing is missed
