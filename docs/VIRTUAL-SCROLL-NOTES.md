# Virtual Scroll — Implementation Notes

Reverted from `main.tsx` on 2026-02-18. The implementation worked
for individual ScrollView containers but failed at the full-storybook scale.

## What was built

- Binary-search-based virtualization (`findFirstVisible`, `findLastVisible`)
- Offset array precomputation from per-story height estimates
- Category-based default heights with `onLayout` measurement override
- Overscan window (±2 items beyond viewport)
- Top/bottom spacer boxes to preserve scroll position
- Forced scroll position (`scrollY` prop) for nav-click-to-scroll-jump
- One-shot controlled→uncontrolled transition (set `scrollY`, then null next frame)
- Fallback height locking for stories that collapse (%-based layouts)

## What went wrong (cascade)

1. **Nav→scroll sync**: clicking a sidebar item needed to jump the scroll
   position, but `scrollY` as a controlled prop fights with user scroll input
2. **Scroll lock after nav**: the one-shot `forcedScrollY → null` pattern
   didn't reliably release control, blocking manual scrolling
3. **Content vs page height**: stories with `height: '100%'` collapsed to 0
   inside the virtualized card wrapper (no explicit parent height). Fallback
   height heuristics were added but created visual jumps.
4. **Fast drag → scroll:null**: dragging the scrollbar fast outpaced the
   React render cycle. The `onScroll` handler received null/undefined events
   ~1/3 of the way through, causing the visible range to snap to [0, 5].
5. **Cross-mode bleed**: story components stayed mounted/rendering when
   switching to Docs mode, causing frame flickering from story content
   appearing on doc pages.

## What to do differently next time

- **Don't virtualize the entire page.** Virtualize individual long lists
  (e.g., a data table with 1000 rows) inside a single story, not the
  storybook shell itself.
- **The storybook is a paged viewer.** Each story renders one-at-a-time
  with `key={active.id}`. This is correct — it unmounts the previous story
  cleanly and gives the active story the full viewport.
- **If scroll mode is wanted**, consider a simpler approach: render only
  the active story + 1 above + 1 below (a 3-item window), not a full
  virtualized list of 30+ stories with heterogeneous heights.
- **ScrollView's `scrollY` prop as controlled input is fragile.** The
  Lua-side scroll position and React-side controlled value can desync,
  especially under fast input. A better pattern would be a bridge command
  (`scrollTo(nodeId, y)`) that imperatively sets the Lua scroll offset
  without going through the React prop reconciliation cycle.
- **Stories with `height: '100%'` don't work in a virtualized list.**
  They need an explicit parent height, but the virtualizer's item wrapper
  intentionally avoids fixed heights (to allow measurement). These two
  requirements are fundamentally incompatible without a two-pass layout.
