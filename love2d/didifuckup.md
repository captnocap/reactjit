today is: 12 march 2026
yesterday was: 11 march 2026
last time i fucked up: 12 march 2026
days past since i have fucked up by writing typescript logic that isnt just diffing a tree and declaring a layout position: 0
total fuck ups to date: 3 + a lot of days before this log was made
Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>

## audit log

### 2026-03-12 (full scan of dirty tree + recent commits)

**All 7 major violations from 2026-03-07 update 3 are STILL PRESENT. None fixed.**
- packages/core/src/animation.ts (764 lines) — spring physics + easing runtime in TS
- packages/core/src/tw.ts (819 lines) — complete Tailwind CSS class parser in TS
- packages/core/src/useScrape.ts (590 lines) — HTML parser + CSS selector engine in TS
- packages/core/src/useSearch.ts (490 lines) — fuzzy scoring algorithm in TS
- packages/time/src/utils.ts (454 lines) — date formatting/parsing/arithmetic
- packages/finance/src/indicators.ts (371 lines) — full technical analysis math library
- packages/finance/src/format.ts + portfolio.ts (133 lines) — currency formatting + portfolio math

**All 3 scaling violations from 2026-03-07 update 2 are STILL PRESENT:**
- packages/core/src/scaleStyle.ts — full style-scaling engine duplicated from Lua
- packages/core/src/ScaleContext.tsx — applyCurve() + scale recomputation duplicated from Lua
- packages/core/src/useBreakpoint.ts — layout classification math in React

**NEW violations found in currently dirty files:**

1. **storybook/src/stories/CompatibilityStory.tsx** (~80 lines) — VIOLATION
   - `parseInlineCSS()` (lines 365-378) — full CSS declaration parser: split, indexOf, slice, regex camelCase conversion, parseFloat coercion
   - `parseHTMLToNodes()` (lines 380-434+) — complete recursive HTML parser in TypeScript: tag parsing, attribute parsing, quoted string handling, self-closing detection, void tag set
   - This is a full parser. Parsers are Lua. No exceptions.

2. **storybook/src/stories/TradingPerfLabStory.tsx** (~100 lines of compute) — VIOLATION
   - `seeded()` (line 64-67) — pseudo-random number generator using Math.sin hash
   - `percentile()` (lines 69-74) — statistical percentile calculation: sort + index math
   - `nextRand()` (lines 76-84) — xorshift32 PRNG implementation in TS
   - `formatCompact()` (lines 86-91) — number formatting with magnitude suffixes
   - `makeSymbolBook()` (lines 93+) — order book data generation with math
   - This is a market data simulation engine. All compute. All should be Lua.

3. **storybook/src/stories/RecordingStressStory.tsx** (~10 lines) — VIOLATION
   - `percentile()` (lines 36-41) — duplicate of TradingPerfLabStory's percentile function
   - setTimeout/setInterval/clearTimeout/clearInterval usage (lines 282-285) — timer-based cancellable delay, should use Lua-managed timers

4. **examples/llm-studio/src/App.tsx** (~60 lines of compute) — VIOLATION
   - Token estimation (lines 245-270): `Math.round(totalChars / 4)` repeated 4 times across multiple useMemo blocks — data transformation math
   - Stream stats computation (lines 211-218): tokensPerSec, elapsed rounding — math in onChunk callback
   - Chat search (lines 273-279): `.toLowerCase().includes()` filtering — string matching logic
   - Context window math (line 305): percentage calculation `Math.min(100, Math.round(...))`
   - `setInterval(checkHealth, 30000)` (line 159) with `// rjit-ignore-next-line` on useEffect — using escape hatch for what should be `useLuaEffect({ type: 'poll' })`
   - Multiple `setTimeout` calls (lines 661, 919, 1212, 1254, 1257, 1915, 2397) — JS timers instead of Lua timers

5. **storybook/src/stories/AIStory.tsx** (~20 lines) — VIOLATION
   - `setTimeout`-driven animation sequencer (lines 396-407, 466-475, 555-563) — recursive setTimeout chains to animate message appearance. This is animation/timer logic. Should be `useLuaEffect({ type: 'timer' })`.

6. **storybook/src/stories/AnimationStory.tsx** (~15 lines) — VIOLATION
   - Multiple `setTimeout` calls (lines 689, 809, 849, 854, 1062) — JS timers for UI state transitions
   - `useEffect` + `setTimeout` + `clearTimeout` patterns (lines 957-960, 1158-1161) — timer-based auto-dismiss, should be Lua-managed

7. **examples/hot-code/src/eval-component.ts** — BORDERLINE
   - `transformedCode.match(/function\s+.../)` regex parsing (lines 56-57) — parsing user code to extract component names
   - `new Function(...)` eval (line 62) — dynamic code evaluation
   - This is a playground eval sandbox. The regex is part of the eval pipeline, not app logic. Borderline acceptable given it's tooling, not UI.

8. **storybook/src/stories/ObjectDetectStory.tsx** (lines 279-285) — VIOLATION
   - Coordinate transform math: `Math.max(0, Math.min(...))`, `Math.round(...)` — converting click coordinates to image-space coordinates
   - This is input coordinate transformation. Should happen in Lua's event pipeline.

**NOT violations (correctly triaged as layout/state selection):**
- GalleryStory.tsx `.toLowerCase().includes()` in useMemo for search filtering — this is state selection for which JSX to render (rule #2: choose which JSX to return). Acceptable.
- GalleryComponents.tsx — pure JSX composition, no compute. Clean.
- LlmsTxtReader.tsx `raw.split('\n')` + chunking in useMemo — borderline but it's preparing data for ScrollView rendering. Splitting a string to decide how many Text nodes to render is closer to "choose which JSX" than parsing.
- eventDispatcher.ts normalizeList sort — this is framework plumbing in packages/renderer/, has escape hatch.
- packages/gradio/src/useGradioClient.ts `generateSessionHash()` — 4 lines of random char generation for a session ID. Trivial, but technically should be Lua. Not worth flagging.

**useEffect violations in storybook stories (BANNED in user code, no escape hatch):**
Still rampant. 30+ storybook files import and use useEffect. Notable offenders with multiple useEffect calls:
- MathStory.tsx — 8 useEffect calls
- ConversionsStory.tsx — 6 useEffect calls
- AudioStory.tsx — 5 useEffect calls
- CryptoStory.tsx — 5 useEffect calls

**Summary: ~4,600 lines of TS compute that should be Lua, unchanged from 2026-03-07. Zero violations fixed in 5 days. 8 new violations found in currently dirty files, adding ~300 more lines.**

---

### 2026-03-07 (update 2 — scaling in React fuckup)

**packages/core/src/scaleStyle.ts** (76 lines) — VIOLATION — STILL EXISTS
- Full style-scaling engine in TypeScript: iterates style objects, applies Math.round(val * scale) to pixel props
- Handles transform scaling, keyframe scaling — all duplicated from Lua's `scaleStyleTable()` in layout.lua
- Still exported from the barrel (`index.ts` line 41: `export { scaleStyle } from './scaleStyle'`)
- The Lua port made `useScaledStyle()` a passthrough but NEVER DELETED THIS FILE
- Why is this insane: we have a layout engine in Lua. Scaling pixel dimensions IS layout. This file literally reimplements what layout.lua:104-115 does.

**packages/core/src/ScaleContext.tsx** — VIOLATION — duplicated math after "port"
- `applyCurve()` (lines 47-58) — identical copy of lua/layout.lua:81-90. Math.sqrt, Math.min in TS.
- `useMemo` (lines 78-83) — recomputes `raw = Math.min(w/refW, h/refH)` then applies curve. Same computation Lua does every frame at layout.lua:93-98.
- The "port" sent config to Lua via RPC but then kept computing the same values in React anyway
- useScale() should read the scale factor FROM Lua, not recompute it in a parallel universe

**packages/core/src/useBreakpoint.ts** — VIOLATION — layout classification in React
- `resolveOrientation()` (lines 64-70) — aspect ratio math (width/height, threshold comparison)
- `resolveSpan()` (line 53-56) — clamping math (Math.max, Math.min, Math.round)
- `spanToFlexBasis()` (line 59-61) — percentage calculation ((span/12)*100)
- `useOrientation()` and `useLayout()` — layout classification hooks doing math in React
- All of this is layout engine territory. The layout engine lives in Lua. QED.

**Root cause:** Another Claude built the entire scaling system in React first (scaleStyle.ts + ScaleContext.tsx doing all the work). Then was told to port to Lua, and did — but left ALL the TS-side computation in place as "backup" / "for useScale() consumers." The port was additive, not a migration. The old code should have been gutted, not preserved alongside the new.

---

violations found in recent commits (eb3ba8e..HEAD):

**packages/chemistry/src/utils.ts** (200 lines) — VIOLATION
- `parseFormula()` — regex parsing in TypeScript
- `molarMass()` — math in TypeScript
- `atomCount()` — math in TypeScript
- `massComposition()` — math in TypeScript
All of this is formula parsing + molar mass arithmetic. Should be Lua.

**packages/data/src/formula.ts** — VIOLATION
- Inlined math helpers: `clamp`, `lerp`, `remap`, `smoothstep`, `vec2dist`, `vec2len`
- Full spreadsheet formula evaluator: cell ref parsing, tokenization, SUM/AVERAGE/etc in TS
- The file even has the comment "Inlined trivial math — the real math library lives in Lua now" — self-aware, still wrong.
Should be Lua. All of it.

clean this cycle:
- packages/convert/ — fully migrated to useLoveRPC one-liner
- packages/math/ — fully migrated to useLoveRPC one-liner
- packages/core/src/useLatch.ts — new bridge plumbing hook (Lua→React value pipe), acceptable

### 2026-03-07 (update 3 — full package scan, 170+ files, ~51k lines)

**7 NEW major violations found (never caught by previous audits):**

1. **packages/core/src/animation.ts** (764 lines) — entire spring physics + timing + easing + interpolation runtime in TS
2. **packages/core/src/tw.ts** (819 lines) — complete Tailwind CSS class parser in TS
3. **packages/core/src/useScrape.ts** (590 lines) — full HTML parser + CSS selector engine in TS
4. **packages/core/src/useSearch.ts** (490 lines) — fuzzy scoring algorithm in TS
5. **packages/time/src/utils.ts** (454 lines) — date formatting/parsing/arithmetic duplicated from Lua
6. **packages/finance/src/indicators.ts** (371 lines) — full technical analysis math library (SMA, EMA, RSI, MACD, Bollinger, etc.)
7. **packages/finance/src/format.ts** + **portfolio.ts** (133 lines combined) — currency formatting + portfolio math

**6 previously reported violations still present:** scaleStyle.ts, ScaleContext.tsx, useBreakpoint.ts, rss/parser.ts, storage/format.ts, storage/query.ts

**Fixed since last audit:** chemistry/ cleaned (2183→one-liners), data/formula.ts cleaned (spreadsheet evaluator→36-line RPC wrapper). 20+ packages confirmed clean.

**Total TS compute that should be in Lua: ~4,500 lines across 13 files.**

### 2026-03-06

(first audit log entry — violations present in chemistry package, 2183 lines pure TS god file)
