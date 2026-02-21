# BUG: FlatList stuck on initialNumToRender in native mode (Love2D)

## Symptom

FlatList renders the first 10 items (`initialNumToRender` default) and never updates the visible window when scrolling. The bottom spacer is present (scroll height is correct), scrolling works mechanically, but new items never appear.

## Root cause (suspected)

FlatList's `handleScroll` callback updates `visibleRange` based on `ScrollEvent` data from the ScrollView. In native mode, the ScrollView passes `onScroll` as a prop to the Lua-side View element. The issue is likely one of:

1. **Scroll events never fire from Lua to JS** — the Lua scroll handler updates `scrollState` for rendering (scrollbar, scissor offset) but may not push an event back through the bridge that triggers the React `onScroll` callback. If `handleScroll` never runs, `visibleRange` stays at `[0, 9]`.

2. **ScrollEvent shape mismatch** — if the event does fire but `scrollY` or `contentHeight` are missing/wrong, `computeVisibleRange` returns bad values. The function uses `containerSize` from `event.contentHeight` — but this should be the **viewport** height, not the total content height. If contentHeight is the full scroll content (e.g., 260,256px for 21K lines), then `viewportItems` = 21,688 and the range would be all items, which would also break (mounting 21K items defeats the purpose).

3. **onScroll prop not wired in hostConfig** — the NativeScrollView passes `onScroll` to `createElement('View', { onScroll, ... })`. If the reconciler's hostConfig doesn't extract `onScroll` as a handler, it never reaches the Lua node's handler table, and the Lua side never knows to fire it.

## Debugging steps

1. **Check if onScroll fires at all** — add `console.log` to FlatList's `handleScroll`:
   ```tsx
   // In FlatList.tsx handleScroll
   console.log('[FlatList] scroll event:', event.scrollY, event.contentHeight);
   ```

2. **Check Lua scroll event dispatch** — search for where scroll state changes push events. Look in `lua/init.lua` or `lua/layout.lua` for scroll-related event pushing.

3. **Check hostConfig handler extraction** — verify `onScroll` is in the handler whitelist in `packages/native/src/hostConfig.ts` or equivalent.

4. **Check ScrollEvent shape** — the FlatList expects `{ scrollX, scrollY, contentWidth, contentHeight }`. Verify Lua sends all four fields and that `contentHeight` means viewport height (not total scroll content).

## Files involved

| File | Role |
|------|------|
| `packages/shared/src/FlatList.tsx` | Virtualized list — `handleScroll` + `computeVisibleRange` |
| `packages/shared/src/ScrollView.tsx` | NativeScrollView passes `onScroll` prop to View |
| `packages/native/src/hostConfig.ts` | Reconciler — extracts event handlers from props |
| `lua/init.lua` | Scroll state management, event dispatch |
| `lua/layout.lua` | Scroll container layout + scrollState |

## Observed in

`storybook/src/stories/LlmsTxtReader.tsx` — "virtual" mode using FlatList with 21,689 lines. Shows first 10 lines (initialNumToRender), bottom spacer creates correct scroll height, but scrolling never reveals more items.

## Impact

FlatList is exported as a public component but is non-functional in native mode. The virtual scrolling story for the stress test is blocked on this.
