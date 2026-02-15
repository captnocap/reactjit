# Context Menu — In Progress

## Status: Debug prints added, waiting for right-click test

## What was built
- `lua/contextmenu.lua` — Lua-owned context menu (inverse pattern like TextEditor)
- `packages/shared/src/ContextMenu.tsx` — React component (web + native modes)
- Types in `packages/shared/src/types.ts` (ContextMenuItem, ContextMenuEvent, ContextMenuProps)
- Wired into: `init.lua`, `events.lua`, `eventDispatcher.ts`, `index.ts`

## How it works
1. Right-click (button 2) → `init.lua` intercepts → calls `contextmenu.open()`
2. Lua detects text nodes under cursor, checks for active text selection
3. Shows "Copy" item (disabled if no selection, enabled if text selected)
4. Apps can extend via `<ContextMenu items={[...]} onSelect={...}>` wrapper
5. Boundary events only: `contextmenu:select`, `contextmenu:open`, `contextmenu:close`

## Current issue
Right-clicking shows nothing. No visible error, just no menu.

## Debug prints are in place
Rebuild with `make cli-setup && cd storybook && ilovereact update && ilovereact build`
then run `love love/` and right-click. Check terminal for:
- `[init] right-click button=2, calling contextmenu.open` — confirms init.lua receives the event
- `[contextmenu] open() called at X, Y` — confirms contextmenu.open is called
- `[contextmenu] hitNode=... textNode=...` — shows what was found under cursor
- `[contextmenu] items=N cmNode=...` — shows how many items were built

If `[init]` line doesn't appear → the right-click never reaches `ReactLove.mousepressed` with button=2
If `[contextmenu] items=0` → no text node found under cursor (hitTest issue)
If items > 0 but still no menu → rendering issue in `contextmenu.draw()`

## Files with debug prints (remove when done)
- `lua/contextmenu.lua` — 3 `io.write` lines in `open()`
- `lua/init.lua` — 1 `io.write` line before `contextmenu.open()` call

## Commits
- `252ea7a` feat: Add right-click context menu (Lua-owned inverse pattern)
- `10b9709` fix: Show Copy item on text node right-click even without selection
