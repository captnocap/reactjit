today is: 7 march 2026
yesterday was: 6 march 2026
last time i fucked up: 7 march 2026
days past since i have fucked up by writing typescript logic that isnt just diffing a tree and declaring a layout position: 0
total fuck ups to date: 3 + a lot of days before this log was made
Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>

## audit log

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
