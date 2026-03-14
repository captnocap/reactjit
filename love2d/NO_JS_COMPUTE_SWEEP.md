# no-js-compute Sweep — Task List for Parallel Agents

**Rule:** `no-js-compute` (committed 93f4f7c)
**Policy:** useEffect is banned because it introduces commit-phase work in the wrong runtime. useMemo/useReducer/useCallback are banned because they legitimize render-phase compute in the wrong runtime. Inline compute (.sort/.filter/.reduce in component bodies) falls under the same architectural ban.

**Escape hatch:** `// rjit-ignore-next-line` — use ONLY in `packages/core/` framework internals that genuinely need it during transition. User code has no escape hatch excuse.

---

## How to fix each violation type

| Violation | Fix |
|-----------|-----|
| `useMemo(() => compute, [deps])` | Remove useMemo. If compute is trivial (clamp, ternary), inline it. If heavy (sort, filter, map, math), move to .tslx compute() block or .tsl module. |
| `useCallback(fn, [deps])` | Remove useCallback. Pass the function directly. The reconciler handles handler identity — useCallback adds nothing. For event handlers on Pressable/Box, just pass `onPress={() => doThing()}`. |
| `useReducer(reducer, init)` | Replace with `useState` + simple setter logic. If the reducer is complex, move the state machine to Lua. |
| `useState(() => heavyInit())` | Replace with `useState(literal)` + `useMount` if init needs async/compute, or move to `useHotState`/`useLocalStore`. |
| `.sort()/.filter()/.reduce()` in var decl | Move to .tslx compute() block. Or if truly trivial and render-only, add `// rjit-ignore-next-line` with justification. |

---

## Agent 1: Storybook — High-impact files (93 violations)

Priority: files with 5+ violations. These are the ones causing real perf problems.

| File | E | W | Primary violations |
|------|---|---|-------------------|
| `src/stories/PresentationStory.tsx` | 16 | 6 | 14 useCallback, 2 useMemo, 4 .filter() |
| `src/stories/AnimationStory.tsx` | 9 | 0 | 9 useCallback |
| `src/stories/FinanceStory.tsx` | 8 | 6 | 8 useMemo, 6 .filter() |
| `src/stories/AutomationStory.tsx` | 7 | 0 | 7 useCallback |
| `src/stories/GeoStory.tsx` | 7 | 0 | 4 useMemo, 3 useCallback |
| `src/stories/A11yMirrorStory.tsx` | 2 | 5 | 2 useCallback, 4 .filter() |
| `src/stories/MapBasicStory.tsx` | 6 | 2 | 4 useMemo, 2 useCallback |
| `src/stories/RecordingStressStory.tsx` | 6 | 1 | 5 useCallback, 1 useMemo |
| `src/stories/WindowsStory.tsx` | 6 | 0 | 6 useCallback |
| `src/stories/TradingPerfLabStory.tsx` | 4 | 2 | 4 useMemo, 2 .sort() |

**Instructions:** For `useCallback` — just remove the wrapper and pass the function directly. For `useMemo` — evaluate if the compute is trivial enough to inline without memoization, or if it needs to move to a .tslx compute block. For `.filter()`/`.sort()` — add `// rjit-ignore-next-line` if trivial one-liner, otherwise refactor.

---

## Agent 2: Storybook — Medium files (82 violations)

Files with 2-4 violations each.

| File | E | W | Primary violations |
|------|---|---|-------------------|
| `src/stories/ChemistryStory.tsx` | 5 | 0 | 2 useMemo, 3 useCallback |
| `src/stories/FilesStory.tsx` | 5 | 0 | 4 useCallback, 1 useMemo |
| `src/stories/MathStory.tsx` | 5 | 0 | 1 useCallback, 4 useMemo |
| `src/stories/RenderStory.tsx` | 5 | 0 | 5 useCallback |
| `src/playground/PlaygroundPanel.tsx` | 4 | 1 | 4 useCallback |
| `src/stories/CaptureStory.tsx` | 4 | 0 | 4 useCallback |
| `src/stories/DataSpreadsheetStory.tsx` | 3 | 3 | 2 useState(fn), 1 useMemo |
| `src/stories/NavigationStory.tsx` | 3 | 3 | 2 useCallback, 1 useMemo |
| `src/stories/ProcessesStory.tsx` | 3 | 2 | 3 useCallback |
| `src/stories/DataStory.tsx` | 3 | 1 | 2 useCallback, 1 useMemo |
| `src/stories/StyleStory.tsx` | 3 | 1 | 2 useCallback, 1 useMemo |
| `src/stories/AIStory.tsx` | 3 | 0 | 3 useCallback |
| `src/stories/GamepadStory.tsx` | 3 | 0 | 3 useCallback |
| `src/stories/ObjectDetectStory.tsx` | 3 | 0 | 3 useCallback |
| `src/playground/TemplatePicker.tsx` | 3 | 0 | 2 useCallback, 1 useMemo |
| `src/docs/DocsFontScale.tsx` | 3 | 0 | 3 useCallback |
| `src/main.tsx` | 3 | 4 | 3 useCallback, 2 .filter(), 1 .reduce() |
| `src/main-wasm.tsx` | 2 | 1 | 2 useCallback |

---

## Agent 3: Storybook — Small files + infra (64 violations)

Files with 1-2 violations each. Quick wins — most are single useCallback removals.

All remaining storybook files:
- `src/stories/BoxStory.tsx` (2+1), `src/stories/CompatibilityStory.tsx` (2), `src/stories/CryptoStory.tsx` (2), `src/stories/GalleryStory.tsx` (2+1), `src/stories/GeoScene3DStory.tsx` (2+1), `src/stories/ImageVideoStory.tsx` (2+1), `src/stories/InputStory.tsx` (2), `src/stories/Layout1Story.tsx` (2+1), `src/stories/LayoutStory.tsx` (2+1), `src/stories/LlmsTxtReader.tsx` (2), `src/stories/MonacoMirrorStory.tsx` (2), `src/stories/PhysicsStory.tsx` (2), `src/stories/TextStory.tsx` (2), `src/stories/TradingViewBarsStory.tsx` (2), `src/voice/VoiceProvider.tsx` (2), `src/stories/HookGalleryStory.tsx` (1+4)
- Single-hit files: `src/docs/DocsViewer.tsx`, `src/stories/AudioRackStory.tsx`, `src/stories/AudioStory.tsx`, `src/stories/CreativeConceptsStory.tsx`, `src/stories/DemoStory.tsx`, `src/stories/GalleryComponents.tsx`, `src/stories/IconStory.tsx`, `src/stories/ImageGalleryStory.tsx`, `src/stories/Layout3Story.tsx`, `src/stories/MasksStory.tsx`, `src/stories/Scene3DFrameworkGalaxy.tsx`, `src/stories/Scene3DPlanet.tsx`, `src/stories/Scene3DShowcaseStory.tsx`, `src/stories/StressTestStory.tsx`, `src/stories/ThreeDStory.tsx`, `src/stories/EffectsStory.tsx`, `src/stories/TextEffectsStory.tsx`, `src/docs/DocsSidebar.tsx` (4 warnings), `src/playground/StatusBar.tsx` (2 warnings)

---

## Agent 4: Examples (76 violations)

| File | E | W |
|------|---|---|
| `examples/llm-studio/src/App.tsx` | 38 | 29 |
| `examples/llm-studio/src/components/FormattedMessage.tsx` | 3 | 0 |
| `examples/llm-studio/src/components/shared.tsx` | 0 | 1 |
| `examples/llm-studio/src/html-preview.tsx` | 1 | 0 |
| `examples/hot-code/src/App.tsx` | 3 | 0 |
| `examples/ai-box/src/App.tsx` | 1 | 0 |

**Note:** `llm-studio/src/App.tsx` is the big one (67 violations). It's a large file with heavy compute — may need to be split into .tslx components.

---

## Agent 5: packages/core — Framework internals (115 violations)

**CRITICAL: These are framework internals. Use `// rjit-ignore-next-line` for genuinely necessary patterns.** Do NOT blindly remove useCallback from framework hooks — some are part of the public API contract.

### Strategy per file:

| File | E | W | Strategy |
|------|---|---|---------|
| `src/MonacoMirror.tsx` | 38 | 1 | **Biggest offender.** 38 violations — path parsing, tree building, minimap sampling. This is a .tslx migration candidate. Short-term: `rjit-ignore-next-line` each one. |
| `src/Pressable.tsx` | 8 | 0 | useCallback for press handlers — these ARE the component API. `rjit-ignore-next-line`. |
| `src/Input.tsx` | 6 | 0 | Same as Pressable — handler identity for input lifecycle. `rjit-ignore-next-line`. |
| `src/useGPIO.tsx` | 6 | 0 | useCallback for hardware control functions. `rjit-ignore-next-line`. |
| `src/search/*.tsx` | 15 | 5 | Mix of useMemo (filtering) and useCallback (handlers). Filtering should eventually be Lua. Short-term: `rjit-ignore-next-line`. |
| `src/RadarChart.tsx` | 3 | 1 | Trig compute — clear .tslx candidate. Short-term: `rjit-ignore-next-line`. |
| `src/ImageViewerModal.tsx` | 5 | 0 | useCallback for navigation. `rjit-ignore-next-line`. |
| `src/FlatList.tsx` | 2 | 0 | useMemo for rendered content. `rjit-ignore-next-line`. |
| All other core files | 32 | 0 | Mostly 1-2 useCallback each. `rjit-ignore-next-line` with comment. |

**Format for framework ignores:**
```typescript
// rjit-ignore-next-line — framework API: handler identity for public callback contract
const handlePress = useCallback(() => { ... }, [deps]);
```

---

## Verification

After all agents complete, run:
```bash
cd storybook && node ../cli/commands/lint.mjs 2>&1 | grep no-js-compute
```

Target: **0 errors, minimal warnings** (warnings for inline .sort/.filter are acceptable during transition if justified).

---

## Rules for all agents

1. **Do NOT add new compute to fix old compute.** If removing useMemo leaves repeated expensive work, that's the signal to write a .tslx — not to add a different caching mechanism.
2. **useCallback removal is mechanical.** `useCallback(fn, [deps])` → just `fn`. The reconciler doesn't care about handler identity — it re-extracts handlers on every commitUpdate anyway.
3. **useMemo removal requires judgment.** If the memoized value is trivial (`clampIndex`, `a ? b : c`), inline it. If it's heavy (sort, filter, map, reduce, trig), it needs a .tslx migration or `rjit-ignore-next-line` with explanation.
4. **Test after fixing.** Run `rjit lint` to verify 0 violations in your assigned files.
5. **Commit your own work.** Don't leave uncommitted changes.
