# useEffect Audit - 2026-03-12

Scope:
- Executable TypeScript source only.
- Included: `packages/*/src`, `examples/*/src`, `storybook/src`.
- Excluded: generated mirrors (`cli/runtime`, `web/reactjit`, local `reactjit/` copies), docs/content snippets, compiled/generated output.

Rule used for this audit:
- Every raw `useEffect` call is treated as a violation.
- `// rjit-ignore-next-line` is recorded as a bandaid, not an exemption.

Current live-tree summary:

| Metric | Count |
| --- | ---: |
| Total raw `useEffect` calls | 89 |
| Unique files with violations | 49 |
| Calls carrying ignore comments | 86 |
| Unsuppressed calls | 3 |
| `useLayoutEffect` calls | 0 |

By area:

| Area | Calls | Files |
| --- | ---: | ---: |
| `packages/*/src` | 89 | 49 |
| `examples/*/src` | 0 | 0 |
| `storybook/src` | 0 | 0 |

What changed on recheck:
- The earlier snapshot was stale against the dirty worktree.
- Example and storybook violations were already migrated away in current source.
- The remaining debt is package-internal only.

Real current hotspots:

| File | Calls | Suppression status |
| --- | ---: | --- |
| `packages/core/src/hooks.ts` | 14 | all ignored |
| `packages/time/src/hooks.ts` | 4 | all ignored |
| `packages/core/src/useLuaEffect.ts` | 3 | unsuppressed |
| `packages/core/src/useBreakpoint.ts` | 3 | all ignored |
| `packages/finance/src/feeds.ts` | 3 | all ignored |
| `packages/finance/src/hooks.ts` | 3 | all ignored |
| `packages/geo/src/hooks.ts` | 3 | all ignored |

Unsuppressed problem areas:

| File | Calls | Why it stands out |
| --- | ---: | --- |
| `packages/core/src/useLuaEffect.ts` | 3 | framework hook still implemented on top of raw React effects |

Interpretation:
- The broad repo-wide cleanup mostly already happened in the current worktree.
- The remaining cleanup target is not app code; it is framework internals.
- `MonacoMirror` was reduced out of the unsuppressed set in this pass.
- The only remaining unsuppressed hotspot is `useLuaEffect`, which is foundational rather than incidental UI logic.

Full table:
- [docs/useeffect-audit-2026-03-12.csv](/home/siah/creative/reactjit/docs/useeffect-audit-2026-03-12.csv)
