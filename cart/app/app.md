# App

Living index of every file under `cart/app/` — what each one is, how it's wired, and what's still pending. Format is per-file: a status word (Stub / WIP / Complete) + a checklist. "Complete" means *complete for what it is meant to do today*, not "feature-complete forever". Line numbers are accurate to the file at the time of writing.

The app is a router-driven cart with a **two-chrome shell** — top window chrome (titlebar + nav + window controls) and a bottom supervisor input strip (`CommandComposer`-shaped, persistent across routes) — wrapping a route slot mounted at `/`, `/settings`, and `/about`. The bottom strip dispatches navigation through the IFTTT bus (`app:navigate`) so every future input tier (@-token catalog, router model, supervisor session) fires the same event the router subscribes to. An `OnboardingProvider` context wraps the route tree. **All theme-touching styling lives in `cart/component-gallery/components.cls.ts`** — every surface in cart/app is a classifier (`<S.AppChrome>`, `<S.AppHello>`, gallery menu atoms, etc.). There is no `theme.js` shim; if you find yourself reaching for `tokenColor` or hex literals, add a classifier in `components.cls.ts` instead. Active/inactive variants are separate classifiers (e.g. `AppNavLink` / `AppNavLinkActive`); the JSX picks one. Dynamic per-render values (animation opacity, slide marginTop, fixed home-menu stage size) flow as inline `style={{...}}` overrides — `mergeUserProps` in `runtime/classifier.tsx` merges user style over the classifier's resolved style.

---

## Animation principles

Three transition shapes, picked by the *origin* of the element being animated. Validated 2026-05-01 across two labs: `cart/input_lab/` (tween / spring / fade on the persistent `<InputStrip>` moving between focal / side / docked layouts) and `cart/list_lab/` (list building, box wipe, border trace, SVG path trace).

- **Tween** — for elements **already rendered in view** moving to a new placement. `easeInOutCubic` lerp on position + size. Reads as "the same thing went over there." Use for: layout reflow, mode switches, the InputStrip migrating between focal / side / docked, anything where identity continuity matters.
- **Spring** — for elements **newly entering view**. `easeOutBack` overshoot. Reads as "this just arrived." Use for: notifications sliding in, popovers opening, a card mounting for the first time. Do NOT use for elements that were already on screen — the overshoot makes a moving element look unstable.
- **Fade** — for **nested / transitionary** content. Cross-dissolve, no translate. Reads as "the surface changed underneath you." Use for: startup splash → app, route content swaps inside a stable shell, body changes inside a card whose chrome stays put.

Rule of thumb when in doubt: was the element on screen one frame ago? Tween. Did it just appear from nowhere? Spring. Is it the *contents* of a container that itself isn't moving? Fade.

### List building (validated in `cart/list_lab/` "list" scene)

- **Adding items** — each new item SPRINGS in: opacity 0→1 + small `translateY` offset eased by `easeOutBack`. Stagger by index when adding multiple at once (default 60ms between items) so a batch reads as a *ripple*, not a pop. Per-item entry duration ~380ms.
- **Reordering** — items already on screen TWEEN to their new y. Snapshot each item's last rendered y on every render keyed by id; on the next render, if the target y differs, animate from the snapshot (FLIP-style). Same `easeInOutCubic` as everything else. Duration ~400ms.
- **Removing items** — opacity + scale shrink (`easeOutCubic`, 240ms), then GC the row from state. No spring on exit. Removing items must NOT shift the surviving items abruptly — the reorder tween handles the gap-close smoothly.
- **Layout strategy** — render items into an `overflow: hidden` container with `position: absolute` per row, computing each row's target `top` from its index in the alive set. Reorder tweening only works when items have stable ids that aren't reused across mount/unmount.

### Drawing an element outwards

Pick the technique by the *shape* of the thing being revealed:

- **Card / box borders (preferred — adopt this everywhere it fits)** — animated dashed border via `borderDashOn` / `borderDashOff` / `borderDashWidth` (any Box accepts these — `framework/border_dash.zig` walks a flattened rounded-rect perimeter). Two modes:
  - **One-shot border trace** — animate `borderDashOn` from 0 to the rect's perimeter and `borderDashOff` from perimeter to 0; a single dash extends around the corners. **Use this as the hover effect for list items, menu rows, and any pressable surface** — the trace fires on pointer-enter and reverses on leave. Cheap, doesn't re-render the element body, and reads as "this thing is now selectable."
  - **Continuous marching flow** — static dash pattern + `borderFlowSpeed: <px/sec>` (negative reverses). **Use this for activity / attention-grabbing states** — a card processing in the background, an unread item, a primary CTA waiting for input. This is the GenericCardShell pattern (`cart/component-gallery/components/generic-card/GenericCardShell.tsx`).
  - Both demoed in `cart/list_lab/` "border" scene.
- **SVG paths** (icons, signatures, diagrams, charts) — reactive `d` recomputation. Compute the path's total arc length, then per frame emit a `d` string truncated to `t * arcLength` and let `<Graph.Path d={...}>` re-render. Mount `<Graph>` with `originTopLeft` so coordinates anchor at the container's top-left rather than centered. Demoed in `cart/list_lab/` "trace" scene. The framework has `svg_path.zig:drawStrokePartial` implemented but not yet wired to a JS prop — when a `drawProgress: 0..1` prop lands on `<Canvas.Path>` / `<Graph.Path>` this collapses to a single-prop API.
- **Continuous stroke flow on a path** — `flowSpeed: <px/sec>` on `<Canvas.Path>`. Glow pulses slide along the stroke. Use for "this path is alive / signaling," not for one-shot reveals.
- **Block elements via width+height wipe** — `overflow: hidden` container animating from 0×0 to full size with the inner content laid out at full size from the start. Demoed in `cart/list_lab/` "wipe" scene but **avoid for now** — feels heavier than it looks on paper, and the border trace covers most of the cases this would have been used for. Revisit if a real need surfaces.

Picking between these: if the surface has a border, prefer the border-dash trace — cheaper and reads better than wiping the whole body. If it's a vector graphic, use the SVG path trace. `flowSpeed` and `borderFlowSpeed` continuous flows are for *state*, not entry — use them once the element has finished revealing.

### Slot-stable menu transition

When swapping the *content* of a fixed list (menu A → menu B), don't tear down the rows and rebuild — keep the slot positions stable and animate the *text inside each slot*. Per slot, erase the old label left-to-right while the new label scans in from the same direction; render a hybrid string per frame where character indices to the left of the scan head come from the new label and indices to the right come from the old. Stagger by row index so the wipe cascades top-to-bottom as a wave. Use `theme:fontMono` for the labels — proportional fonts make the row jiggle as letters with different widths flow through.

Count differences are handled at the trailing edge: if the new menu has more rows, the extras enter via the standard list-entry spring; if fewer, the trailing rows exit via the standard list shrink-and-fade. The middle (slots present in both menus) does the text-scan in lockstep. Mid-transition reversals snapshot each slot's currently-visible hybrid string as the new `from`. Demoed in `cart/list_lab/` "menu" scene.

### Input-strip shell morph (GOLDEN — `cart/app/index.tsx`, commits 3bad2f07d → present)

Three resolved shell states. The persistent `<InputStrip>` morphs between them via three coordinated tweens + a variant flip that swaps the input's React placement at the right moment.

| state | description | sideMorph | inputMorph | bottomMorph | input slot | variant |
|-------|-------------|-----------|------------|-------------|-----------|---------|
| **A** home | route=full | 0 | 0 | 0 | BottomInputBar | null |
| **B** activity-docked | route=side, focal=false | 1 | 1 | 1 | SideMenuInput | 'side' |
| **C** activity-focal | route=side, focal=true  | 1 | 0 | 0 | BottomInputBar | null |

**Two driver axes** — both feed `deriveHeadingTo(routeMode, focal)`:
- **Route** declares `mode: 'full' | 'side'` per entry in the `ROUTES` table. Same-mode navigations (e.g., between two activity routes) keep `headingTo` constant — the morph effect doesn't fire, only the page-area content swaps.
- **Focus** is a global flag in `cart/app/shell.tsx` (`useInputFocal()` / `setInputFocal()`). Activities call `setInputFocal(true)` to take the input into focal mode; `setInputFocal(false)` to release. Focal state PERSISTS across route changes — only the activity that took focus knows when it's done. Going home and back to the same activity preserves the focal state.

**Three independent morphs**, each a snapshot RAF tween that survives mid-flight reversals:
- `inputMorph` — paddingRight on `AppBottomInputBar`, shrinks/grows the input within the full-width bar.
- `sideMorph` — width on `AppSideMenuInput` (absolute overlay, left edge), grows/shrinks the docked panel.
- `bottomMorph` — paddingBottom on the routes wrapper, drives the smooth page-extends-down / page-retracts step.

**Pivoting on variant** — the useEffect on `[headingTo]` looks at whether the variant needs to flip and which direction:
- **TO PANEL** (variant `null` → `'side'`): morph "shrink" first (`inputMorph` + `sideMorph` in parallel), then variant flip on input completion, then `bottomMorph`. Input is visibly the dominant animation; sequencing matters because the user expects to see the input shrink before the page extends.
- **TO BAR** (variant `'side'` → `null`): variant flip + ALL morphs in PARALLEL. No sequencing — sequencing the bottom morph first (page retract) before the input expand introduced a perceived 600ms delay before the input animated, because the page-retract step is too subtle to register. BottomInputBar's `theme:bg` covers the bottom strip while the page content retracts behind it, so they overlap cleanly.
- **No variant change** (A↔C, where the input stays in the bar but the side panel grows/shrinks): just animate whichever morphs differ. `startTween` is a no-op when from===to.

**Single source of truth:** `APP_BOTTOM_BAR_H` is exported from `cart/component-gallery/components.cls.ts`. The `AppBottomInputBar` classifier owns its own `height: APP_BOTTOM_BAR_H`; the cart imports the same constant for routes' paddingBottom calc. Never inline a height fallback in cart code — the regression that bites is that the input strip's natural height changes (added/removed chip rows, etc.), the cart's local fallback drifts out of sync, and the page reflow stops aligning.

**Architectural invariant — useRoute placement.** Hooks that subscribe to `<Router>` (and the variant store, and the focal store) MUST run inside `<Router>`'s subtree. App is split into a thin shell (mounts `TooltipRoot > OnboardingProvider > Router > NavigationBus > ShellBody`) and `<ShellBody>` (everything route-aware). If you collapse them back into one component the route changes won't trigger re-renders and the morph will look like it never fires — only the page-area content will swap.

**Layout invariants** (do not break, in order of how badly each one bites if you do):
- Both slots are `position: absolute` inside a `position: relative` page area. SideMenuInput must NOT be a flex sibling — if it pushes BottomInputBar via flex, the `paddingRight = inputMorph * (vw - SIDE_W)` formula leaks `sideMorph` into the calc and the input collapses to 0 width by end of phase 1.
- `AppBottomInputBar`'s height comes from the classifier, not from the cart. The framework's layout engine treats absolute boxes without explicit dimensions as 0-tall.
- BottomInputBar leaves the React tree (outer conditional `{isSide ? null : (...)}`) on variant flip. Don't try to animate its height collapse instead — it covers SideMenuInput's input from the top down as it shrinks (the "rollout from the top" regression).
- Inside the conditional, `display: 'flex'` is set explicitly. The framework treated `display: undefined` as `display: none`, leaving the bar invisible.
- `App` outer Box, `AppBottomInputBar`, and `AppSideMenuInput` all carry `backgroundColor: 'theme:bg'`. The first matches the bg behind any vacated area; the second covers the gap above the input (over-allocated height vs strip natural); the third blends the side panel with the page so the empty rail doesn't show as a colored split.

**Named regressions** to grep for if anyone breaks this:
- "input invisible in full mode"
- "input shrinks to 0 then resets"
- "rollout from the top"
- "color split / mismatch"
- "morph never fires on route change" → check that ShellBody is INSIDE `<Router>`, not its parent.
- "B→C feels like a 1s delay before the input animates" → the TO BAR branch must be parallel; sequencing puts the visible animation behind the subtle one.

If you hit any of those, `git log --grep GOLDEN` finds the canonical reference.

---

## Routes & screens

### App shell — `index.tsx` — WIP

CHECKLIST:
- Purpose: Cart entry. Boots the gallery theme, mounts the top window chrome (titlebar + drag region + onboarding step cubes / route nav swap + tour banner + window controls) and the bottom supervisor `InputStrip` (post-onboarding only), wraps the route tree in `<TooltipRoot>` and `<OnboardingProvider>`, and registers the `/`, `/settings`, and `/about` routes. Also mounts a small `NavigationBus` component (no DOM output) that subscribes to `app:navigate` on the IFTTT bus and converts emitted paths into `nav.push(...)` calls — every input tier (today: `InputStrip` token resolver; future: router model, supervisor session) fires that same bus event.
- isRoute: FALSE
- Route: N/A (registers `/`, `/settings`, and `/about` inside the `<Router>`)
- hasDatashape: FALSE
- Datashape: consumes `onboarding/state.jsx` (`useOnboarding`); subscribes to the IFTTT bus event `app:navigate` (payload = path string) via `NavigationBus`
- exposedDatashapes: `onb.step`, `onb.totalSteps`, `onb.setStep`, `onb.complete`, `onb.loading`, `onb.tourStatus`, `onb.acceptTour`, `onb.declineTour`
- Hooks: `useOnboarding`, `useNavigate`, `useRoute`, `useAnimationTimeline` (inside `TourBanner`), `useIFTTT` (inside `NavigationBus`)
- Conditions:
  - `onboardingActive = !onb.loading && !onb.complete` swaps step cubes for route nav links on the right side of the chrome
  - `showTour = !onboardingActive && onb.tourStatus === 'pending'` — drops the tour banner into the right cluster (BEFORE the nav row, after the brand) once Step5 has called `markComplete()`. Banner unmounts on accept / decline (`tourStatus` flips to `'accepted'` or `'declined'`).
  - `ConditionalInputStrip` renders only when `!onb.loading && onb.complete` — the bottom supervisor strip stays hidden during onboarding so it doesn't fight the step-driven flow. Top chrome always renders, so the shell is asymmetric until step 5 lands.
  - `NavigationBus` subscribes once at mount; `useIFTTT('app:navigate', cb)` validates the payload is a string starting with `/` before calling `nav.push(payload)` (so non-route emits — future `app:open` etc. — won't accidentally route).
- Components: `TooltipRoot`, `OnboardingProvider`, `Router`, `Route`, `IndexPage`, `SettingsPage`, `AboutPage`, `Chrome`, `NavLink`, `StepCubes`, `TourBanner`, `NavigationBus`, `ConditionalInputStrip`, `InputStrip`
- Atoms: `Box`, `S.AppChrome`, `S.AppChromeBrandRow`, `S.AppChromeNavRow`, `S.AppChromeRightCluster`, `S.AppBrandSwatch`, `S.AppBrandTitle`, `S.AppBrandSub`, `S.AppNavLink` / `S.AppNavLinkActive`, `S.AppNavIcon` / `S.AppNavIconActive`, `S.AppNavLabel` / `S.AppNavLabelActive`, `S.AppStepCubeRow`, `S.AppStepCubePast` / `S.AppStepCubeCurrent` / `S.AppStepCubeFuture`, `S.AppChromeDivider`, `S.AppChromeTourBanner`, `S.AppChromeTourText`, `S.AppChromeTourActions`, `S.AppChromeTourYes` / `S.AppChromeTourNo`, `S.AppChromeTourYesLabel` / `S.AppChromeTourNoLabel`, `S.AppWindowBtn`, `S.AppWindowBtnIcon` / `S.AppWindowBtnIconClose`
- isUsingTheme: TRUE — every surface goes through a classifier in `components.cls.ts`
- hasIcons: TRUE
- Icons: `Home`, `Settings`, `Info`, `Minimize`, `Maximize`, `X`
- hasAnimation: TRUE (only the tour banner; the chrome itself is static)
- Animations: `TourBanner` mounts at `markComplete()` time, holds invisible until `TOUR_BANNER_FADE_DELAY_MS = 1400ms` (so the home-page carryover dominates first), then fades in over `TOUR_BANNER_FADE_MS = 500ms`. Yes / No has no exit animation — the answer **is** the action, banner unmounts immediately.
- TODO:
  - Once a real tour is wired, `acceptTour()` should additionally arm the overlay (today it just hides the banner). Banner re-arm is handled — `tourStatus` persists through `User.onboarding.tourStatus`, so a declined tour stays declined across reloads.
  - Decide whether `ConditionalInputStrip` should also render in onboarding's later steps (e.g. expose `/help` while the user is mid-flow). Today it's all-or-nothing on `complete`.
  - Route slot (`<Box style={{flexGrow: 1}}>` between Chrome and InputStrip) doesn't expose its own bottom-padding budget — anything inside a route that wants to clear the InputStrip needs to know `S.CommandComposerFrame.minHeight` (206 today). Lift that to a shared constant if multiple routes start consuming it.
- PROBLEMS:
  - **Shell vertical budget shrunk.** With InputStrip's `minHeight: 206`, route content has noticeably less room. Anything that hardcoded "fill the viewport" math (Canvas surfaces, full-bleed embeds) now over-flows or clips. Audit when next rebudgeting layout.

---

### Input strip — `InputStrip.tsx` — WIP

CHECKLIST:
- Purpose: The supervisor's persistent input surface — pinned to the bottom of the shell once onboarding completes. Visually a `CommandComposer` (gallery shape: routing/attached header up top, prompt area + action rail in the middle, branch chip + shortcut hints in the footer); the static `CommandComposerPromptLine` segments are swapped for a live `<TextInput>` so the surface is editable. Submit parses `@`-tokens against `tokens.ts` and fires `app:navigate` on the IFTTT bus per route token; anything else is dropped today (router-model and supervisor-session wiring lands in follow-up commits and plug into the same `submit()` path).
- isRoute: FALSE
- Route: —
- hasDatashape: FALSE
- Datashape: emits `app:navigate` events on the IFTTT bus (consumed by `index.tsx`'s `NavigationBus`); reads `useRoute().path` for the live branch chip; consumes `tokens.ts` (`resolveTokens`, `TokenMatch`, `Token`)
- exposedDatashapes: —
- Hooks: `useState`, `useRef`, `useRoute`
- Conditions:
  - Token preview row renders only when `resolveTokens(draft).length > 0` — chip strip sits above the live `<TextInput>` inside the same `<S.CommandComposerPromptRows>` container
  - `submit()` is a no-op on empty/whitespace input (`text.trim().length === 0`)
  - Per-keystroke `resolveTokens(draft)` drives the chip preview; on submit the token list is recomputed off the trimmed `draftRef.current` so the chips and the dispatched events agree even with mid-string edits
  - Submit fires one `busEmit('app:navigate', token.path)` per matched route token, in source order; `NavigationBus`'s subscriber (in `index.tsx`) is the single subscriber that converts each emit into a `nav.push(...)`
- Components: `CommandComposerHeader`, `CommandComposerFooter`, `CommandComposerChip` (all from `cart/component-gallery/components/command-composer/`), `TextInput`
- Atoms: `S.CommandComposerFrame`, `S.CommandComposerMain`, `S.CommandComposerPromptRows`, `S.CommandComposerPromptFlow`, `S.CommandComposerActionRow`, `S.CommandComposerShortcutGroup`, `S.CommandComposerIconButton`, `S.CommandComposerIconText`, `S.CommandComposerSend`, `S.CommandComposerActionText`
- isUsingTheme: TRUE — every surface is a gallery classifier; the embedded `<TextInput>` overrides only with `theme:` tokens (transparent background, `theme:ink` color, no hex literals)
- hasIcons: TRUE (via `CommandComposerChip` — the gallery component handles `iconForChip` based on chip prefix; `⌁` → `GitBranch` for the live branch chip, no icon for `@`-prefixed token chips)
- Icons: routed through `CommandComposerChip` based on chip prefix (`⌁` → `GitBranch`, `▣` / `☰` for file-shaped chips when those land)
- hasAnimation: FALSE
- Animations: —
- TODO:
  - Wire the router-model tier: parallel HTTP request from `submit()`, parse one-line response (`GOTO <path>` / `OPEN <app>` / `NONE`), fire `app:navigate` from the same code path. Read connection from `Settings.routerConnectionId` once that field exists.
  - Wire the supervisor session: long-lived Claude session via the cockpit poll-loop pattern (`__claude_init` / `__claude_send` / `__claude_poll`). Render the chat thread inside the route slot, not the strip itself.
  - Swap the static `ROUTE_CHIP` (label `tier-1 only`) for the live model name once a `Settings.routerConnectionId` (or supervisor connection) is wired. Same for `TARGET_CHIP` once "currently focused app" is a concept.
  - Token chips for resolved `@`-mentions currently sit on a separate row above the live input; explore inline replacement once the renderer can host mixed text + chip segments inside one `<TextInput>` analogue.
  - Add an `app:open` IFTTT subscriber and emit shape for app-typed tokens once cartridges mount inline (tokens.ts already has the union slot reserved).
- PROBLEMS:
  - The `LEFT_SHORTCUTS` (`@ tag file`, `{} variable`, `/ command`) advertise capabilities only the `@` shortcut delivers today. Either ship the other two or drop them from the static envelope.
  - `ROUTE_CHIP` (`@tier-1 only`) and `TARGET_CHIP` (`+nav`) are static placeholders. Until they're wired to live state they over-promise — the user sees a `+nav` target chip but no app actually owns "nav" as a target.
  - Send button and Icon button (`S.CommandComposerSend`, `S.CommandComposerIconButton`) inherit the gallery classifier's hover/press affordance; the icon-button currently has no `onPress` (mode toggle is a future feature) so it visually invites a click that does nothing. Either wire it or strip the affordance.

---

### Token registry — `tokens.ts` — WIP

CHECKLIST:
- Purpose: Source of truth for the cart's `@`-token catalog — the zero-latency tier of the dispatch hierarchy. Each `@<name>` token resolves to a route (today) or, eventually, an app/command/file/variable. `resolveTokens(text)` runs the regex `/@([A-Za-z][A-Za-z0-9_-]*)/g` against the input, looks up each match in the catalog, and returns `TokenMatch[]` with `{raw, start, end, token}` so a future renderer could highlight inline if it wanted to. Today only `InputStrip` consumes the result.
- isRoute: FALSE
- Route: —
- hasDatashape: FALSE (catalog is a hand-maintained `Record<string, Token>`, not a persisted gallery row — yet)
- Datashape: produces `TokenMatch` records (`{ raw, start, end, token: { type: 'route'; path; label } }`); the `Token` union has `RouteToken` only today, with an `{ type: 'app'; id; label }` variant reserved in a comment for when cartridges mount inline
- exposedDatashapes: `Token`, `RouteToken`, `TokenMatch`, `TOKENS` (catalog), `resolveTokens(text)`
- Hooks: —
- Conditions:
  - Lookup is case-insensitive — `@Home`, `@home`, `@HOME` all resolve to the same entry via `m[1].toLowerCase()`
  - Unknown tokens are silently dropped from the result (no error surface — the user sees the raw `@unknown` text in the input but no chip in the preview)
  - Regex anchors on a name-start letter (`[A-Za-z]`), so prose with embedded `@` (email addresses, mid-word `@`s) still matches when followed by a name; v1 leaves it permissive — refine the boundary if false positives show up
  - `TOKEN_RE.lastIndex = 0` reset every call — the `g` flag's stateful index would otherwise leak across calls and skip matches
- Components: —
- Atoms: —
- isUsingTheme: FALSE
- hasIcons: FALSE
- Icons: —
- hasAnimation: FALSE
- Animations: —
- TODO:
  - Add `@settings` now that the `/settings` route exists. `@sweatshop` / `@gallery` / `@chatbot` wait for the cartridge ABI to mount those inline.
  - Add the `{ type: 'app'; id: string }` variant when cartridges are mountable — `InputStrip.submit()` will branch on `token.type` to fire either `app:navigate` (route) or `app:open` (app).
  - Lift the catalog to a persisted gallery row when third-party cartridges can register their own tokens at install time. Until then, cart code is the authority.
- PROBLEMS:
  - Catalog can drift from the actual route list. If a token's `path` no longer matches a registered route, `nav.push(path)` silently lands on an empty Route slot. Add a build-time check against the routes registered in `index.tsx` once the route catalog is extracted to a shared constant.
  - `@-token` names share namespace across types (route / app / command). When the catalog grows, collision becomes a real concern — first-match-wins or explicit prefixes (`@route:home` vs `@app:sweatshop`) are the next decisions.

---

### Index page — `page.tsx` — WIP

CHECKLIST:
- Purpose: `/` route. Three-way gate: while `onb.complete` is false → `<Onboarding>`; on the first render after `markComplete()` (`!onb.homeEntryPlayed`) → `<HomeEntry>` which carries Step5's exit final frame ("Welcome aboard." + spinner) and dissolves it into the staggered home surface (greeting → goal card → shell-free gallery tile menu → profile facts); otherwise → `<HomeStatic>` direct. Both Home variants render through a shared `<HomeBody>` that takes phase opacities — `HomeEntry` drives them off `useAnimationTimeline`, `HomeStatic` passes `1` for everything.
- isRoute: TRUE
- Route: `/`
- hasDatashape: FALSE (consumes the onboarding-provider surface)
- Datashape: reads `onboarding/state.jsx` (`name`, `goal`, `configPath`, `traits`) + `onboarding/traits.js` (`TRAITS_BY_ID` for the accommodations chip-list)
- exposedDatashapes: `onb.loading`, `onb.complete`, `onb.step`, `onb.shouldPlayFirstStartAnimation`, `onb.markFirstStartAnimationPlayed`, `onb.homeEntryPlayed`, `onb.markHomeEntryPlayed`, `onb.name`, `onb.goal`, `onb.configPath`, `onb.traits`
- Hooks: `useOnboarding`, `useAnimationTimeline` (inside `HomeEntry`), `useEffect`, `useRef`
- Conditions:
  - `if (onb.loading) return null;`
  - `if (!onb.complete) return <Onboarding ...>;`
  - `if (!onb.homeEntryPlayed) return <HomeEntry />;`
  - else `return <HomeStatic />;`
  - `HomeEntry` schedules `markHomeEntryPlayed()` at `ENTRY_DONE_MS = T_PROFILE_END + 80 = 3280 ms` so the next render flips to `<HomeStatic />` cleanly.
  - Goal card body branches on `hasGoal = goal.trim().length > 0` — shows the goal statement when present, falls back to a "you can set one anytime" line when not. The `User.onboarding.status === 'skipped'` branch isn't wired here yet (open thread).
  - Home launcher uses `MenuGridSquareContent` from the component gallery, not `MenuGridSquare`, so the app gets the C1 tile menu body without the gallery demo chrome (`MenuTileShell`, id/title/kind header, outer bordered specimen frame).
  - Because the gallery shell previously provided the stage height, the app wraps `MenuGridSquareContent` in an explicit `720 x 360` stage (`maxWidth: '100%'`) so flex rows have a stable height and tile text does not collapse.
- Components: `Onboarding`, `HomeEntry`, `HomeStatic`, `HomeBody`, `MenuGridSquareContent`, `ProfileFact`, `SnakeSpinner`
- Atoms: `Box`, `S.Page`, `S.Card`, `S.Title`, `S.Body`, `S.Caption`, `S.AppStepFrame`, `S.AppStepCenter`, `S.AppStepBottomRight`, `S.AppGreet`, gallery menu atoms (`S.MenuGridBox`, `S.MenuGridRow`, `S.MenuGridTile` / `S.MenuGridTileActive`, `S.MenuNum`, `S.MenuLabel`, `S.MenuLabelStrong`, `S.MenuHint`)
- isUsingTheme: TRUE (via classifiers)
- hasIcons: FALSE
- Icons: —
- hasAnimation: TRUE (HomeEntry only — HomeStatic is a no-animation render)
- Animations (HomeEntry, single shared `useAnimationTimeline`):
  - Carryover "Welcome aboard." + spinner hold 0→500 ms (picks up where Step5's exit left off)
  - Carryover fade-out 500→1400 ms (`fadeOut`)
  - Greet fade-in 1400→1950 ms (24 px slide)
  - Goal card fade-in 1950→2300 ms
  - Home tile menu fade-in follows the old three-tile stagger envelope: tile opacities are averaged for the menu stage while the stage slide is keyed off tile 1.
  - Tile phase 1 2300→2650 ms
  - Tile phase 2 2550→2820 ms (overlap by ~100 ms for staggered feel)
  - Tile phase 3 2720→2990 ms
  - Profile fact row fade-in 2990→3200 ms
  - `markHomeEntryPlayed()` at 3280 ms
- TODO:
  - Wire home menu click handlers when the cartridge ABI lands in cart/app. Today the tile menu is a launcher-shaped visual surface only; hover/active state works, but no item routes or opens a cartridge yet.
  - Add the `User.onboarding.status === 'skipped'` runtime branch so skipped users see a degraded surface and can resume / restart onboarding inline. The plumbing is half-there (state.jsx persists `'skipped'`); IndexPage just doesn't read it yet.
  - Resolve `~` → `$HOME` in the `Config path` profile fact (currently shows the raw string).
  - Persist a "last-active cartridge" pointer once menu tiles can route/open, so reopening the app lands on the user's last surface instead of always the selector.
- PROBLEMS: none known.

---

### Settings page — `settings/page.jsx` — Stub

CHECKLIST:
- Purpose: `/settings` route. Placeholder settings surface attached to the same top chrome nav as Home and About. Shows the current onboarding-backed shell/profile facts that exist today: config path, tour status, and whether the bottom `InputStrip` is enabled.
- isRoute: TRUE
- Route: `/settings`
- hasDatashape: FALSE (consumes the onboarding-provider surface)
- Datashape: reads `onboarding/state.jsx` (`configPath`, `tourStatus`, `complete`)
- exposedDatashapes: `onb.configPath`, `onb.tourStatus`, `onb.complete`
- Hooks: `useOnboarding`
- Conditions:
  - `configPath` falls back to `Default config path` when unset/blank
  - `tourStatus` falls back to `pending` when not a string
  - Input strip row reports `Enabled` only once onboarding is complete; otherwise `Hidden during onboarding`
- Components: `SettingRow`
- Atoms: `Box`, `S.Page`, `S.Card`, `S.Caption`, `S.Title`, `S.Body`
- isUsingTheme: TRUE (via classifiers)
- hasIcons: FALSE (route nav icon comes from `index.tsx`, not the page body)
- Icons: —
- hasAnimation: FALSE
- Animations: —
- TODO:
  - Replace the stub facts with real editable Settings rows once the gallery `Settings` / `Connection` data shapes get editor components.
  - Add controls for default provider/model, router connection, privacy policy, budgets, and profile switching.
  - Decide whether Settings should be a full route or eventually an activity-mode panel once the two-mode shell lands.
- PROBLEMS: none

---

### About page — `about/page.jsx` — Stub

CHECKLIST:
- Purpose: `/about` route. Currently just a placeholder card that proves the second route works.
- isRoute: TRUE
- Route: `/about`
- hasDatashape: FALSE
- Datashape: —
- exposedDatashapes: —
- Hooks: —
- Conditions: —
- Components: —
- Atoms: `Box`, `S.Page`, `S.Card`, `S.Title`, `S.Body`
- isUsingTheme: TRUE (via classifiers)
- hasIcons: FALSE
- Icons: —
- hasAnimation: FALSE
- Animations: —
- TODO: decide what About actually shows (build/cart info, license, version, etc.)
- PROBLEMS: none

---

## Onboarding

### Onboarding step router — `onboarding/Onboarding.jsx` — Complete

CHECKLIST:
- Purpose: Routes by `step` to the right onboarding screen. Step 0 → `<FirstStep>`, step 1 → `<Step2>`, step 2 → `<Step3>`, step 3 → `<Step4>`, step 4 → `<Step5>`. An out-of-range card renders for any step index outside `[0, TOTAL_STEPS-1]`.
- isRoute: FALSE (mounted inside `IndexPage` which owns the `/` route)
- Route: —
- hasDatashape: FALSE
- Datashape: receives props from page.jsx (sourced from `onboarding/state.jsx`)
- exposedDatashapes: `step`, `animate`, `onAnimationDone` (props)
- Hooks: —
- Conditions: `step === 0` → FirstStep; `step === 1` → Step2; `step === 2` → Step3; `step === 3` → Step4; `step === 4` → Step5; else out-of-range card
- Components: `FirstStep`, `Step2`, `Step3`, `Step4`, `Step5`
- Atoms: `Box`, `S.Page`, `S.Card`, `S.Caption`, `S.Title`, `S.Body`
- isUsingTheme: TRUE (via classifiers)
- hasIcons: FALSE
- Icons: —
- hasAnimation: FALSE (step components own their own animations)
- Animations: —
- TODO: nothing pending here
- PROBLEMS: none

---

### Step 0 — Hello / name capture — `onboarding/FirstStep.jsx` — Complete

CHECKLIST:
- Purpose: Onboarding step 0. Plays a staggered "Hello" → "what is your name?" → text input entry, then reveals Skip + Next in the bottom-right. On click, runs an exit transition (buttons fade out, spinner fades in, center text fades out, "Nice to meet you {name}" fades in centered) and advances to Step2 with a best-effort ordered write (`setName` first, then `setStep(1)`).
- isRoute: FALSE
- Route: —
- hasDatashape: FALSE
- Datashape: writes to `onboarding/state.jsx` setters on dispatch (`setName`, `setStep`, `markSkipped`)
- exposedDatashapes: `onb.step`, `onb.setName`, `onb.setStep`, `onb.markSkipped`
- Hooks: `useState`, `useRef`, `useEffect`, `useAnimationTimeline`, `useOnboarding`
- Conditions: `animate` gate folds entry progress to 1 when false; name-coercion typeguard; `hasName` gates Skip/Next; exit dispatch `useEffect` only arms when both `exiting` and `exitStartT` are set; `setName` is bounded via `Promise.race(setName(), 400ms)` so a slow disk write can't stall the step transition; the dispatch branches `exiting === 'skip'` → `onb.markSkipped()` (terminal `complete=true`, status `'skipped'`) vs `exiting === 'next'` → `onb.setStep(advanceTo)`.
- Components: `SnakeSpinner` (line 295), `S.Button`, `S.ButtonLabel`, `S.ButtonOutline`, `S.ButtonOutlineLabel`
- Atoms: `Box`, `Col`, `Row`, `Text`, `TextInput`
- isUsingTheme: TRUE — every surface goes through a classifier in `components.cls.ts` (`AppHello`, `AppQuestion`, `AppNameInput`, `AppGreet`, `AppStepFrame`, `AppStepCenterCol`, `AppStepCenter`, `AppStepBottomRight`, `AppStepBottomRightRow`, `AppStepDimmable`)
- hasIcons: FALSE
- Icons: —
- hasAnimation: TRUE
- Animations:
  - Entry timeline (`useAnimationTimeline`):
    - Hello fade-in 80→580 ms (line 198, range constants line 13)
    - Question fade-in 780→1280 ms (line 208, line 14)
    - Input fade-in 1480→1980 ms (line 229, line 15)
    - Buttons fade-in 1980→2480 ms (line 269, line 16)
    - Column "shift up" between phases via `colShift` (lines 149–153, 190)
  - Exit timeline (same timeline clock, relative to `exitStartT`; 1900 ms total):
    - Buttons fade-out 0→342 ms
    - Spinner fade-in 190→608 ms
    - Center text fade-out 380→912 ms
    - Greet fade-in 1045→1482 ms
    - Dispatch `setStep(1)` at 1900 ms after exit starts
- TODO: nothing pending here. Skipped-mode dispatch is wired; animation re-arm is suppressed via the User-row-existence proxy in state.jsx bootstrap.
- PROBLEMS: none known.

---

### Step 1 — Provider selection — `onboarding/Step2.jsx` — WIP

CHECKLIST:
- Purpose: Onboarding step 1. Carries over the FirstStep exit-final frame (greet + spinner) when name is persisted, eases everything out, fades in "This application requires a connection to a provider", slides it up, staggers in 3 provider tiles. Click a tile → that tile gains the active border + an inline form expands below the row. Each form has a Probe button that gates on any-input-non-empty. When the probe succeeds (and a model is picked, for API/Local) the screen-level Next button fades in bottom-right. Click Next → exit transition (menu/form fade out, spinner fades in bottom-right, "Thanks for that" fades in centered) → `setStep(2)` advances to Step3. Bottom-left "Take me back!" returns to step 0.
- isRoute: FALSE
- Route: —
- hasDatashape: FALSE
- Datashape: reads/writes `onboarding/state.jsx` (`name`, `providerKind`, `commitConnection`)
- exposedDatashapes: `onb.name`, `onb.setProviderKind`, `onb.commitConnection`, `onb.setStep`
- Hooks: `useAnimationTimeline`, `useOnboarding`, `useState`, `useRef`, `useEffect`, `processHook.execAsync`
- Conditions:
  - `hasGreet = persistedName.length > 0` drives the carryover branch and the timeline `skip` flag
  - greet/spinner conditional render gated on `greetOp > 0.001`
  - `pickProvider` early-return when same tile reclicked; fades the form in only on first selection
  - `pickProvider` resets `lockedIn=false` on tile switch so the new form re-arms it from scratch
  - inline form rendered only when `selected` is non-null
  - `hasAnyInput` gates each Probe button
  - `lockedIn` lifted out of the forms (each form's `useEffect` calls `setLockedIn(...)` based on its internal probe + chosen-model state) → gates the Next button render
  - `commitPayload` lifted out of the forms in lockstep with `lockedIn` — each form bubbles `{ kind, endpoint?, apiKey?, model?, home?, path? }` so step root can hand it to `onb.commitConnection(payload)` at `onNext` (fires the actual Connection-row write + Settings.defaultConnectionId/defaultModelId patch in the background while the exit transition plays). Cleared on tile switch and form unmount.
  - `exitStartT != null` gates the exit visuals + blocks Take-me-back / pickProvider mid-transition; `setTimeout(..., EXIT_TOTAL_MS)` dispatches `onb.setStep(2)`
- Components: `ProviderTile`, `FormShell`, `LabeledInput`, `ProbeButton`, `ProbeResult`, `ModelList`, `ApiKeyForm`, `ClaudeForm`, `LocalForm`, `SnakeSpinner`, `S.Button`, `S.ButtonLabel`, `S.ButtonOutline`, `S.ButtonOutlineLabel`
- Atoms: `Box`, `Col`, `Row`, `Pressable`, `Text`, `TextInput`
- isUsingTheme: TRUE — every surface goes through a classifier in `components.cls.ts` (`AppPromptText`, `AppGreet`, `AppProviderRow`, `AppProviderTile` / `AppProviderTileActive`, `AppProviderTileTitle` / `AppProviderTileTitleActive`, `AppProviderTileSubtitle`, `AppFormShell`, `AppFormFieldCol`, `AppFormButtonRow`, `AppFormLabel`, `AppFormInput` / `AppFormInputMono`, `AppProbeResult`, `AppProbeOk` / `AppProbeFail`, `AppProbeMessage`, `AppModelListLabel`, `AppModelListBox`, `AppModelChoice` / `AppModelChoiceActive`, `AppModelChoiceText` / `AppModelChoiceTextActive`)
- hasIcons: FALSE
- Icons: —
- hasAnimation: TRUE
- Animations (single shared `useAnimationTimeline`):
  - Entry timeline:
    - Carryover greet hold + fade 500→1400 ms
    - Carryover spinner fade 500→1400 ms
    - Main message fade-in 1400→1950 ms
    - Main message slide up 1950→2450 ms (80 px)
    - Tile 1 fade-in 2450→2750 ms
    - Tile 2 fade-in 2670→2970 ms
    - Tile 3 fade-in 2890→3190 ms
    - Inline form fade-in: starts at first tile click, 400 ms long
    - Next button fade-in: starts at the moment `lockedIn` flips true, 350 ms long (`NEXT_FADE_MS`)
    - Direct-nav fast-forward via `skip + skipOffsetMs = 1400 ms`
  - Exit timeline (relative to click; 1900 ms total):
    - Menu / form / Next / Take-me-back fade out 0→380 ms
    - Spinner fades in 190→665 ms (bottom-right)
    - "Thanks for that" fades in 570→1235 ms (centered)
    - Dispatch `setStep(2)` at 1900 ms
- TODO:
  - Replace stubbed model list in `ApiKeyForm.probe` with a real `http.getAsync` to `${endpoint}/models`.
  - Settings UI for adding additional Connections (so a user with multiple Claude installs can register the second one without re-running onboarding) — `Settings has-many Connections` is already in the gallery shape, just no editor.
- PROBLEMS:
  - API-key probe still returns a canned model list; local probe does live HTTP probing (`/models`, `/v1/models`, `/api/tags`) and parses model IDs. Until the API probe is real, `Settings.defaultModelId` ends up holding whichever stubbed name the user picks.
  - The Claude probe relies on `claude` being on `$PATH` of the cart's process — no fallback if it isn't.
  - **Runtime plumbing landed.** The `home` field captures which Claude install to use; `commitConnection` writes it to `Connection.credentialRef.locator`; the SDK now honors it via `claude_sdk.SessionOptions.config_dir` → `CLAUDE_CONFIG_DIR=<dir>` injected into the spawned subprocess's env (`framework/claude_sdk/session.zig`). `__claude_init` accepts an optional 4th arg (`config_dir`) — JS callers that want to pin a specific install pass the locator there. Existing 1–3 arg callers continue to inherit the parent's env (default behavior unchanged).

---

### Step 2 — Trait survey — `onboarding/Step3.jsx` — Complete

CHECKLIST:
- Purpose: Onboarding step 2. Carries over the Step2 exit-final frame ("Thanks for that" + spinner) when `providerKind` is set, eases everything out, fades in "Let's get to know you a bit more", slides it up, fades in a flat shuffled grid of personality / hobby / preference traits as toggleable chips. Bottom-right shows "I'd rather not say" — once any trait is selected, the same button label flips to "Next" (and the styling switches from outline to filled). Bottom-left "Take me back!" returns to step 1. Click the forward button → exit transition fades the interface out, fades in a spinner bottom-right and a centered branching message ("We get it, onboardings suck." if no traits, "Somehow we already knew that about you…" if any), then dispatches `setStep(3)`.
- isRoute: FALSE
- Route: —
- hasDatashape: FALSE
- Datashape: reads/writes `onboarding/state.jsx` (`providerKind`, `traits`)
- exposedDatashapes: `onb.providerKind` (carryover gate), `onb.traits`, `onb.setTraits`, `onb.setStep`
- Hooks: `useAnimationTimeline`, `useOnboarding`, `useState`, `useRef`, `useEffect`
- Conditions:
  - `hasThanks = !!onb.providerKind` drives the carryover branch and the timeline `skip` flag
  - thanks/spinner conditional render gated on `thanksOp > 0.001`
  - `hasSelection = traits.length > 0` flips the bottom-right button between "I'd rather not say" (outline) and "Next" (filled accent)
  - active-trait-chip styling: `traits.includes(t.id)` toggles accent fill / inverted ink
  - `exitStartT != null` gates the exit visuals + blocks toggleTrait / takeMeBack / forward mid-transition; `exitMessage` captured at click time picks the branching copy; a `setTimeout(..., EXIT_TOTAL_MS)` dispatches `onb.setStep(3)`
- Components: `SnakeSpinner`, `S.Button`, `S.ButtonLabel`, `S.ButtonOutline`, `S.ButtonOutlineLabel`
- Atoms: `Box`, `Col`, `Row`, `Pressable`, `Text`
- isUsingTheme: TRUE — every surface goes through a classifier in `components.cls.ts` (`AppPromptText`, `AppGreet`, `AppExitMessage`, `AppTraitGrid`, `AppTraitChip` / `AppTraitChipActive`, `AppTraitChipText` / `AppTraitChipTextActive`, `AppStepFrame`, `AppStepCenter`, `AppStepCenterCol`, `AppStepBottomLeft`, `AppStepBottomRight`, `AppStepDimmable`)
- hasIcons: FALSE
- Icons: —
- hasAnimation: TRUE
- Animations (single shared `useAnimationTimeline`):
  - Entry timeline:
    - Carryover thanks hold + fade 500→1400 ms
    - Carryover spinner fade 500→1400 ms
    - Main message fade-in 1400→1950 ms
    - Main message slide up 1950→2450 ms (60 px)
    - Trait grid fade-in 2450→3050 ms (single block, not staggered per chip)
    - Bottom buttons fade-in 3050→3450 ms
    - Direct-nav fast-forward via `skip + skipOffsetMs = 1400 ms` when `providerKind` is null
  - Exit timeline (relative to forward click; 1900 ms total):
    - Menu / trait-grid / buttons fade out 0→380 ms (via `menuOpacityMul = 1 - exitMenuOut` cascading on the centered Col)
    - Spinner fades in 190→665 ms (bottom-right, separate render gated on `exitStartT != null`)
    - Branching message fades in 570→1235 ms (centered): `EXIT_MSG_NO_SELECTION` "We get it, onboardings suck." vs `EXIT_MSG_HAS_SELECTION` "Somehow we already knew that about you…" — picked at click time and stored in `exitMessage` state so it's stable across the transition
    - Dispatch `setStep(3)` at 1900 ms
- TODO:
  - The chip catalog now lives in `cart/app/onboarding/traits.js` (extracted so `state.jsx` can map ids→accommodation notes without a circular import). When the survey grows past hand-curation, swap to a persisted catalog row in the gallery data graph.
- PROBLEMS:
  - Toggling traits fires an async `userStore.update(USER_ID, ...)` per click. Rapid taps theoretically race read-modify-write — the `useCRUD` write path is `get → merge → set`, and two writes back-to-back can clobber each other if the second reads before the first persists. Hasn't been observed in practice; watch for it if a user mass-toggles. Possible mitigations: debounce `setTraits`, or batch into a single in-flight write with a follow-up.

---

### Step 3 — Config path — `onboarding/Step4.jsx` — WIP

CHECKLIST:
- Purpose: Onboarding step 3. Carries over Step3's exit-final frame (the branching "We get it…" / "Somehow we already knew…" message + bottom-right spinner) when `providerKind` is set, eases everything out, fades in "Where would you like to store your config files?", slides it up, fades in a `TextInput` whose placeholder is `~/.app/config`. Bottom-right shows "Use default" (outline) until any character is typed — then the same anchor swaps to "Next" (filled accent). "Use default" commits the placeholder string `~/.app/config`; "Next" commits the trimmed input. Bottom-left "Take me back!" returns to step 2. Click forward → exit transition fades the interface out, fades in spinner bottom-right + centered "Got it." bridge message, then dispatches `setStep(4)`.
- isRoute: FALSE
- Route: —
- hasDatashape: FALSE
- Datashape: reads/writes `onboarding/state.jsx` (`providerKind`, `traits`, `configPath`)
- exposedDatashapes: `onb.providerKind` (carryover gate), `onb.traits` (carryover message picker), `onb.configPath`, `onb.setConfigPath`, `onb.setStep`
- Hooks: `useAnimationTimeline`, `useOnboarding`, `useState`, `useRef`, `useEffect`
- Conditions:
  - `hasCarry = !!onb.providerKind` drives the carryover branch and the timeline `skip` flag
  - `traits.length > 0` picks `CARRY_MSG_HAS_SELECTION` else `CARRY_MSG_NO_SELECTION` — keeps the Step3→Step4 message visually continuous
  - carry message + spinner conditional render gated on `carryOp > 0.001`
  - `hasInput = trimmedPath.length > 0` flips the bottom-right between "Use default" (outline) and "Next" (filled accent)
  - forward commits `DEFAULT_CONFIG_PATH = '~/.app/config'` when `hasInput` is false, else the trimmed live value (read off `pathRef.current` to dodge stale closures)
  - `exitStartT != null` gates the exit visuals + blocks forward / takeMeBack mid-transition; `setTimeout(..., EXIT_TOTAL_MS)` dispatches `onb.setStep(4)`
- Components: `SnakeSpinner`, `S.Button`, `S.ButtonLabel`, `S.ButtonOutline`, `S.ButtonOutlineLabel`
- Atoms: `Box`, `TextInput`
- isUsingTheme: TRUE — every surface goes through a classifier in `components.cls.ts` (`AppPromptText`, `AppGreet`, `AppExitMessage`, `AppNameInput` (reused for the path field), `AppStepFrame`, `AppStepCenter`, `AppStepCenterCol`, `AppStepBottomLeft`, `AppStepBottomRight`, `AppStepDimmable`)
- hasIcons: FALSE
- Icons: —
- hasAnimation: TRUE
- Animations (single shared `useAnimationTimeline`):
  - Entry timeline:
    - Carryover Step3 message hold + fade 500→1400 ms
    - Carryover spinner fade 500→1400 ms
    - Main prompt fade-in 1400→1950 ms
    - Main prompt slide up 1950→2450 ms (60 px)
    - Path input fade-in 2450→3050 ms
    - Bottom buttons fade-in 3050→3450 ms
    - Direct-nav fast-forward via `skip + skipOffsetMs = 1400 ms` when `providerKind` is null
  - Exit timeline (relative to forward click; 1900 ms total):
    - Menu / input / buttons fade out 0→380 ms (via `menuOpacityMul = 1 - exitMenuOut` cascading on the centered Col + the corner anchors)
    - Spinner fades in 190→665 ms (bottom-right, separate render gated on `exitStartT != null`)
    - "Got it." bridge message fades in 570→1235 ms (centered, `AppGreet`)
    - Dispatch `setStep(4)` at 1900 ms
- TODO:
  - Validate / normalize the path (resolve `~` to `$HOME`, ensure absolute) at homepage read-time. Today the raw string survives untouched into `User.configPath`.
  - Optionally surface a "directory exists / will be created" hint under the input.
- PROBLEMS: none known.

---

### Step 4 — First goal — `onboarding/Step5.jsx` — Complete

CHECKLIST:
- Purpose: Onboarding step 4 (the last step). Carries over Step4's "Got it." + spinner when a `configPath` is set, eases everything out, fades in "What is your first goal?" with the word **goal** rendered as a tooltip-bearing hyperlink (accent color + underline; hover surfaces a popover descriptor of what a goal is). Below the prompt is a wide `TextInput` for the open-ended goal. Bottom-left "Take me back!" returns to step 3. The bottom-right cluster ("I don't know" outline + "Finish" filled) is hidden until the user types their first character — at that moment both fade in together over `FORWARD_FADE_MS`. Either button starts the exit (Finish commits `goal = trimmedGoal`; "I don't know" commits an empty goal). Exit fades the interface out, fades in a spinner bottom-right + centered "Welcome aboard." bridge, then calls `onb.markComplete()` so `IndexPage` swaps over to the home placeholder.
- isRoute: FALSE
- Route: —
- hasDatashape: FALSE
- Datashape: reads/writes `onboarding/state.jsx` (`configPath`, `goal`, `complete`)
- exposedDatashapes: `onb.configPath` (carryover gate), `onb.goal`, `onb.setGoal`, `onb.markComplete`, `onb.setStep`
- Hooks: `useAnimationTimeline`, `useOnboarding`, `useState`, `useRef`, `useEffect`
- Conditions:
  - `hasCarry = configPath.length > 0` drives the carryover branch and the timeline `skip` flag
  - bridge message + spinner conditional render gated on `bridgeOp > 0.001`
  - `hasInput = trimmedGoal.length > 0` arms the forward cluster: an effect captures `forwardAtT = tl.tRef.current` on the rising edge and resets to `null` if the input goes empty again, so the Row genuinely re-fades when the user clears + retypes
  - finish path requires a non-empty goal; "I don't know" path explicitly persists `''` so downstream code can distinguish "user said nothing" from "user is mid-type"
  - `exitStartT != null` gates the exit visuals + blocks finish / dontKnow / takeMeBack mid-transition; `setTimeout(..., EXIT_TOTAL_MS)` calls `onb.markComplete()` (no `setStep` — `complete=true` is the terminal state)
  - `<Tooltip>` wraps the `goal` link with `side='top'`, `delayMs={200}`, copy in `GOAL_TOOLTIP`
- Components: `Tooltip` (`runtime/tooltip/Tooltip`), `SnakeSpinner`, `S.Button`, `S.ButtonLabel`, `S.ButtonOutline`, `S.ButtonOutlineLabel`
- Atoms: `Box`, `TextInput`
- isUsingTheme: TRUE — every surface goes through a classifier in `components.cls.ts` (`AppPromptText`, `AppPromptRow`, `AppPromptLink`, `AppPromptLinkText`, `AppGreet`, `AppNameInput` (reused for the goal field), `AppStepFrame`, `AppStepCenter`, `AppStepCenterCol`, `AppStepBottomLeft`, `AppStepBottomRight`, `AppStepBottomRightRow`, `AppStepDimmable`)
- hasIcons: FALSE
- Icons: —
- hasAnimation: TRUE
- Animations (single shared `useAnimationTimeline`):
  - Entry timeline:
    - Carryover bridge ("Got it.") hold + fade 500→1400 ms
    - Carryover spinner fade 500→1400 ms
    - Main prompt + hyperlink fade-in 1400→1950 ms
    - Main prompt slide up 1950→2450 ms (60 px)
    - Goal input fade-in 2450→3050 ms
    - "Take me back!" fade-in 2450→3050 ms (paired with the input phase)
    - Forward cluster ("I don't know" + "Finish") fade-in: starts at the moment `hasInput` first goes true, 350 ms long
    - Direct-nav fast-forward via `skip + skipOffsetMs = 1400 ms` when `configPath` is empty
  - Exit timeline (relative to finish/dontKnow click; 1900 ms total):
    - Menu / input / buttons fade out 0→380 ms (via `menuOpacityMul = 1 - exitMenuOut`)
    - Spinner fades in 190→665 ms (bottom-right)
    - "Welcome aboard." bridge fades in 570→1235 ms (centered, `AppGreet`)
    - Dispatch `markComplete()` at 1900 ms
- TODO:
  - Move popover copy into a content file (i18n + edit-without-cart-rebuild) once one exists. Today it lives inline in `Step5.jsx` (`GOAL_TOOLTIP`).
  - Optional: secondary tooltip / micro-help on the input itself if the goal vocabulary needs more handholding.
- PROBLEMS: none known.

---

## State, library, manifest

### Onboarding state provider — `onboarding/state.jsx` — WIP

**Persistence is live.** State.jsx now writes to the gallery data graph through `useCRUD` (namespace `app`). The captured fields don't sit on `User.onboarding` as a blob — each one lands in its proper home: `name → User.displayName`, `traits → User.preferences.accommodations[]` (catalog notes from `traits.js`), `configPath → User.configPath`, `goal → Goal row`, provider pick + form values → a `Connection` row + `Settings.defaultConnectionId/defaultModelId`. `User.onboarding` keeps just the meta (status / step / timestamps / tourStatus). On bootstrap the provider follows User → Settings → Connection to recover `providerKind`, and lists Goals (workspaceId='ws_local', originActor='user') for goal text. Set `SEED_COMPLETED_USER = true` at the top of state.jsx to short-circuit a fresh boot straight into the homepage for dev iteration.

The previous in-memory shape lives at `state_old.jsx` as a breadcrumb; safe to delete after the next homepage pass lands.

CHECKLIST:
- Purpose: React context provider holding the onboarding record. In-memory `useState` slots act as the optimistic cache; setters write through to per-collection `useCRUD` instances. Single namespace `app` so a localstore wipe clears everything cleanly.
- isRoute: FALSE
- Route: —
- hasDatashape: TRUE (multi-collection)
- Datashape:
  - **User** (`cart/component-gallery/data/user.ts`) — id `user_local`, holds `displayName`, `bio`, `configPath`, `preferences.accommodations[]`, `onboarding.{status,step,startedAt,completedAt,skippedAt,tourStatus}`
  - **Settings** (`settings.ts`) — id `settings_default`, holds `defaultConnectionId` + `defaultModelId` once `commitConnection` runs
  - **Privacy** (`privacy.ts`) — id `privacy_default`, seeded with sane defaults on first user creation
  - **Workspace** (`workspace.ts`) — id `ws_local`, `rootPath` from `__cwd` host fn, parent of every Goal row
  - **Connection** (`connection.ts`) — id auto-generated, kind/credentialRef derived from the Step2 form (api/claude/local pick + endpoint heuristic)
  - **Goal** (`goal.ts`) — id auto-generated, written at Step5 finish with `originActor='user'`, `userTurnText`/`statement` set from the typed text, `scopeDuration='long-term'`, `status='open'`
  - session-only (not persisted): `animationPlayedThisSession`, `homeEntryPlayed`
- exposedDatashapes: `step`, `totalSteps`, `complete`, `loading`, `setStep`, `markComplete`, `markSkipped`, `shouldPlayFirstStartAnimation`, `markFirstStartAnimationPlayed`, `homeEntryPlayed`, `markHomeEntryPlayed`, `tourStatus`, `acceptTour`, `declineTour`, `name`, `setName`, `providerKind`, `setProviderKind`, `commitConnection`, `traits`, `setTraits`, `configPath`, `setConfigPath`, `goal`, `setGoal`
- Hooks: `useCRUD` ×6, `useState`, `useEffect`, `createContext`, `useContext`, `useRef`
- Conditions:
  - Bootstrap effect on mount: `userStore.get('user_local')` → if null and `SEED_COMPLETED_USER` is true, seed a fully-onboarded record; if null otherwise, hold defaults and let the first setter create the user via `ensureUser`. If non-null, hydrate every slot (displayName, accommodations→traits, configPath, onboarding.{step,status,tourStatus}) and chase the User→Settings→Connection chain to recover `providerKind`, then list latest Goal for `goal`.
  - `loading=true` until bootstrap resolves (or fails); `page.jsx`'s `if (onb.loading) return null;` becomes load-bearing again
  - `setStep` clamps to `[0, TOTAL_STEPS-1]`, flips `animationPlayedThisSession` on forward advance, and patches `User.onboarding.step`
  - `setName` / `setConfigPath` / `setTraits` patch their respective User fields; setters return promises so FirstStep's `Promise.race(setName, 400ms)` ordering still holds
  - `setProviderKind` is in-memory only — the Connection row is created at Step2's `onNext` via `commitConnection({kind, endpoint?, apiKey?, model?, home?, path?})` so re-trying tiles doesn't churn rows
  - `commitConnection` reuses an existing Connection row when the kind matches; deletes + recreates on kind mismatch; updates `Settings.defaultConnectionId` + `defaultModelId` to point at it
  - `setGoal('')` is "I don't know" path — no Goal row is written; `setGoal(<text>)` updates the most recent user-origin Goal for `ws_local`, or creates one if missing (idempotent across edits)
  - `markComplete` writes `User.onboarding.status='completed'` + `completedAt` + flips `tourStatus: null→'pending'`
  - `markSkipped` writes `User.onboarding.status='skipped'` + `skippedAt`, leaves `tourStatus=null` (skipped users don't get a tour offer)
  - `acceptTour` / `declineTour` patch `User.onboarding.tourStatus`
  - `shouldPlayFirstStartAnimation` derived gate: `!complete && step === 0 && !animationPlayedThisSession`
- Components: `Ctx.Provider`
- Atoms: —
- isUsingTheme: FALSE
- hasIcons: FALSE
- Icons: —
- hasAnimation: FALSE
- Animations: —
- TODO:
  - Resolve `~` in `configPath` to `$HOME` at read-time when the homepage actually consumes it; today the raw string survives untouched
  - Replace canned model lists in `ApiKeyForm.probe` with a real HTTP call so `commitConnection` doesn't write a placeholder model id
  - When the homepage adds a "skipped mode" branch, stop hiding the tour banner via `tourStatus=null` and instead skip the offer purely via the `User.onboarding.status === 'skipped'` check
- PROBLEMS:
  - Schemas in `cart/component-gallery/data/*.ts` are JSON Schema documents, not runtime parsers — `useCRUD`'s `Schema<T>` contract is satisfied with identity passthrough today. Validation is the writer's responsibility. Lift to ajv-backed parsers when drift becomes a problem.
  - Bootstrap reads four to five collections in sequence (User, Settings, Connection, Goal list, plus Workspace/Privacy on first-create). Cold-boot adds a few ms before the loading flag flips; tolerable for now but worth re-examining if it ever feels sluggish.

---

### Trait catalog — `onboarding/traits.js` — Complete

CHECKLIST:
- Purpose: Single source of truth for the Step3 chip catalog. Each entry is `{ id, label, note }` — `label` is the chip text the user clicks, `note` is the worker-facing accommodation hint that lands in `User.preferences.accommodations[]` on lock-in. Also exports the helpers `traitsToAccommodations(ids)` and `accommodationsToTraits(accommodations)` that state.jsx uses to round-trip selections through disk. Extracted so Step3 (chip render) and state.jsx (id → accommodation row mapping) can both import without a circular dep.
- isRoute: FALSE
- Route: —
- hasDatashape: TRUE (companion to `User.preferences.accommodations[]` in `cart/component-gallery/data/user.ts`)
- Datashape: produces `UserAccommodation` rows (`{ id: 'acc_<traitId>', label, note }`) — round-trippable via the `acc_` prefix scheme.
- exposedDatashapes: `TRAITS` (the chip array), `TRAITS_BY_ID` (lookup map), `traitsToAccommodations(ids)`, `accommodationsToTraits(accommodations)`
- Hooks: —
- Conditions: `accommodationsToTraits` drops entries whose `id` doesn't begin with `acc_` or whose underlying trait id isn't in the catalog — older saves where the catalog has changed degrade silently rather than crashing hydration.
- Components: —
- Atoms: —
- isUsingTheme: FALSE
- hasIcons: FALSE
- Icons: —
- hasAnimation: FALSE
- Animations: —
- TODO: when the survey grows past hand-curation, lift the catalog to a persisted gallery row (`accommodation-catalog.ts`?) so users / future profiles can extend it without code changes.
- PROBLEMS: none.

---

### Animation timeline hook — `anim.js` — Complete

CHECKLIST:
- Purpose: Shared `useAnimationTimeline({ skip?, skipOffsetMs? })` hook. One frame-driven master clock per consumer with `range(a, b, easing?)` + `fadeOut(a, b, easing?)` helpers. The `skip` + `skipOffsetMs` pair fast-forwards the timeline so a screen can reuse the same phase constants whether or not a carryover stage is needed. Returns `tRef` to dodge the renderer's stale-closure trap on click handlers.
- isRoute: FALSE
- Route: —
- hasDatashape: FALSE
- Datashape: —
- exposedDatashapes: hook return = `{ t, elapsed, tRef, range, fadeOut }`
- Hooks: `useState`, `useEffect`, `useRef` (internally, lines 50–71)
- Conditions: `skip + skipOffsetMs` gate (lines 39–40, 64, 73)
- Components: —
- Atoms: —
- isUsingTheme: FALSE
- hasIcons: FALSE
- Icons: —
- hasAnimation: TRUE — this IS the animation primitive; consumers compose ranges off it
- Animations: provides the timeline; doesn't render anything itself
- TODO: optional spring variant for organic motion; opt-in pause-on-blur
- PROBLEMS: each consumer spawns its own frame loop. Multiple sibling animations can't share a single loop without manually lifting the timeline.

---

### Cart manifest — `cart.json` — Complete

CHECKLIST:
- Purpose: Cart metadata read by `scripts/ship` and `scripts/dev`. Sets the window dimensions and enables `customChrome: true` so the cart owns its own titlebar (rendered by `index.tsx` `Chrome`).
- isRoute: FALSE
- Route: —
- hasDatashape: FALSE
- Datashape: —
- exposedDatashapes: `name`, `description`, `customChrome`, `width`, `height`
- Hooks: —
- Conditions: —
- Components: —
- Atoms: —
- isUsingTheme: FALSE
- hasIcons: FALSE
- Icons: —
- hasAnimation: FALSE
- Animations: —
- TODO: add an icon path once we have one
- PROBLEMS: none

---

## Chat → Activity transition (WIP)

The cart/app shell today is "chat is everything" — onboarding flows are full-screen, the home page centers around the persistent `<InputStrip>`, every route is a page-sized surface. The next architectural shift is a **two-mode shell**: focal mode (today's shape, generalized — chat IS the screen) versus activity mode (chat docks to a sidebar in the bottom-left, a side menu sits above it, an actual app activity occupies the main view). The chat is the *same instance* throughout — typed text, scroll position, message history all carry through. The `<InputStrip>` never unmounts; the surrounding chrome rearranges around it.

Prototyped end-to-end in `cart/input_lab/` (2026-05-01) — that lab was the canonical source for the layout rects, the timing, and the animation roles.

**Implementation status (2026-05-01):**
- ✅ **Input side-dock morph (A↔B)** — landed in `cart/app/index.tsx` (commit `3bad2f07d`). Documented in the **Animation principles → Input-strip shell morph (GOLDEN)** section above.
- ✅ **Three-state shell** — A (home) / B (activity-docked) / C (activity-focal). `headingTo` derived from `(routeMode, focal)`; same-mode route navigations don't fire the morph. All six transitions (A↔B, A↔C, B↔C) handled by the same useEffect via the `TARGETS` table + variant-flip pivot logic.
- ✅ **Route trigger** — routes carry `mode: 'full' | 'side'` metadata in the `ROUTES` table. `nav.push('/activity/sweatshop')` triggers A→B; `nav.push('/')` triggers B→A or C→A. Same-mode navigations between `/` ↔ `/about` ↔ `/settings` (all mode='full') stay in state A — no morph fires, just route content swaps.
- ✅ **Focus trigger** — `cart/app/shell.tsx` exports `useInputFocal()` + `setInputFocal()`. Activities call `setInputFocal(true)` to take the input into focal mode (B→C); `setInputFocal(false)` to release (C→B). State PERSISTS across route changes — going home from C and back to the same activity preserves focal=true → arrives in C directly via A→C.
- ✅ **Activity host (initial)** — activity routes render their pages in the same routes Box as `/`, `/about`, `/settings`. The page-area layout reflows around the slots via `paddingLeft: sideWidth, paddingBottom`; activities don't need to know about the shell. `cart/app/sweatshop/page.tsx` is the placeholder demo, with worker tiles that exercise B↔C.
- ⬜ **Side menu content** — `AppSideMenuInput` is empty (just the input when in B; nothing when in C). Needs menu items (Home / Files / Memory / Settings shape from input_lab) and chat-history list.
- ⬜ **Real trigger surfaces** — currently the debug toggle at top-left (top:60, left:60) navigates between `/` and `/activity/sweatshop`, plus a FOCUS/UNFOCUS button when in side mode. Real triggers (chat-message-sent, grid-tile click, @-token) replace those.
- ⬜ **Persistence** — `inputFocal` lives in a module-level store; doesn't survive Zig hot-reloads. Wire into `state.jsx`'s `useCRUD` namespace alongside `User.onboarding` once the activity registry exists.

### Planned shape — Chat → Activity transition — WIP

CHECKLIST:
- Purpose: A shell-level mode toggle one level above the router. **Focal mode**: a centered chat panel (~640w) with mock convo + InputStrip is the entire UI. **Activity mode**: chat panel tweens to a docked sidebar (~360w, bottom-left), a side menu (Home / Files / Memory / Settings shape) springs in above it, and an `ActivityHost` springs in to fill the main view. Trigger surface is the open question — @-token (`@activity:foo`), explicit button on a chat suggestion, IFTTT bus event from the supervisor, or some combination. The mode swap is *not* a route change; routes (if any survive) live inside the ActivityHost.
- isRoute: FALSE — shell-level mode that wraps the router, not a route itself
- Route: —
- hasDatashape: TRUE — needs `User.shell.{mode: 'focal' | 'activity', activeActivityId?: string, lastActivityId?: string}`. Persist alongside onboarding so reload restores the user where they left off.
- Datashape: reads `OnboardingProvider` (gated on completion — focal stays the only mode during onboarding); writes shell mode on every transition; writes `activeActivityId` when the user picks one
- exposedDatashapes: `shellMode`, `activeActivityId`, `setShellMode(mode)`, `openActivity(id)`, `closeActivity()`
- Hooks: `usePhaseTimeline` (lift from `cart/input_lab/index.tsx:71`), a new `useShellMode` context provider mounted alongside `OnboardingProvider`, `useActivity(id)` once the activity registry exists, `useIFTTT('app:openActivity', ...)` to receive triggers from the bus
- Conditions:
  - **Trigger to activity:** `setShellMode('activity')` fires on (a) IFTTT `app:openActivity` event with a valid id, (b) sidebar menu item click in activity mode (switches `activeActivityId` without leaving activity mode), (c) — TBD — an @-token resolved by `tokens.ts`. Onboarding gate: while `!onb.complete`, all triggers no-op.
  - **Trigger to focal:** explicit "Back to chat" affordance (top-right in lab); also fires when `activeActivityId` becomes null with no fallback. Closing an activity defaults to focal.
  - **Mid-transition reversal:** snapshot the chat panel's current visual rect as the new `from` so a fast back-click glides instead of snapping. Already handled by `usePhaseTimeline` in the lab.
  - **Hot-reload:** mode + activity id should round-trip through `state.jsx` persistence so a Zig-side rebuild doesn't dump the user into focal mode mid-task.
- Components: `AppShell` (top-level mode container, replaces today's `<Box>` wrap in `index.tsx:176`), `ChatPanel` (lifts the persistent `<InputStrip>` plus the home/onboarding message history), `SideMenu` (NEW — vertical nav, lab uses Home / Files / Memory / Settings as placeholder), `ActivityHost` (NEW — mounts the activity referenced by `activeActivityId`, with an empty / not-found fallback), `ActivityChrome` (the titlebar over the activity content — see lab's AppWindow header)
- Atoms: `Box`, `Pressable`, `Text` for the shell scaffolding. Classifiers TBD — add `AppShellRoot`, `AppShellChatPanel`, `AppShellSideMenu`, `AppShellSideMenuItem`, `AppShellSideMenuItemActive`, `AppShellActivityHost`, `AppShellActivityChrome` to `components.cls.ts`. The lab uses inline theme tokens (`theme:bg1`, `theme:rule`, `theme:accent`, etc.) — keep classifier-only theming when porting per the cart's no-color-drift rule.
- isUsingTheme: TRUE
- hasIcons: TBD — side menu items likely need icons (the cart's existing `runtime/icons/icons` set has Home / Info; Files / Memory / Settings need adding or substituting)
- Icons: TBD
- hasAnimation: TRUE
- Animations: follow the **Animation principles** section above.
  - **Chat panel: TWEEN.** `easeInOutCubic` lerp on `{ left, top, width, height }` between focal and docked rects. The chat is on screen one frame ago — same identity across the move.
  - **Side menu: SPRING in / smooth out.** Opacity tracks the same eased phase progress (`t` 0→1) as the chat. Scale `0.94 + 0.06 * easeOutBack(t)` on entry (overshoots toward 1 then settles); on exit, scale uses `easeInOutCubic` (no overshoot — overshoot on disappearing things reads as broken). New element entering view.
  - **App window (ActivityHost): SPRING in / smooth out.** Same shape as side menu. New element entering view.
  - **Duration:** 700ms in the lab. Probably tune down to ~500ms in the real app once content is real, since every activity-launch eats this.
  - **Direction detection:** computed from this transition's `from→to` — `isEntering = toPhase >= fromPhase`. Picks spring on the way in, smooth on the way out, and survives mid-transition reversals.
- TODO:
  - **Define what an "activity" actually is.** Manifest format? Component + lifecycle hooks (`onOpen`, `onClose`, `onResize`)? Title source? Co-located with the cart or registered globally? Until this is decided, ActivityHost is just a placeholder.
  - **Decide trigger surface(s).** @-token (`@activity:embed-pipeline`) is the most consistent with how nav already works (`tokens.ts` route entries fire `app:navigate`). Add an `activity` token type and have `InputStrip.submit()` fire `app:openActivity` for those. Direct buttons in chat suggestions are also fine. Don't ship multiple competing triggers.
  - **Promote `usePhaseTimeline` to shared.** Today it lives in `cart/input_lab/index.tsx:71`. Move to `cart/app/anim.js` (or a new `cart/app/shell.tsx`) so the real shell can consume it. Keep the snapshot-on-change behavior — it's load-bearing.
  - **Side menu items:** lab hardcodes `['Home', 'Files', 'Memory', 'Settings']`. Real list comes from a registered set per activity? A static app-wide nav? Could be both (app-wide affordances above an activity-specific section).
  - **Persistence:** mode + active activity id should survive reloads. Wire through `state.jsx`'s `useCRUD` namespace alongside `User.onboarding`.
  - **Top chrome reconciliation:** today's `Chrome` component (`index.tsx:100`) carries brand row + nav row + window controls. In activity mode the side menu replaces the nav row; the top chrome should reduce to brand + window controls. Decide whether the brand row stays at top or moves into the side menu's header.
  - **Routing:** today's `/` and `/about` routes are full-page. In activity mode do they live inside the ActivityHost, or does routing become per-activity? Likely the latter — global routes feel wrong inside a focused activity surface.
- PROBLEMS:
  - **InputStrip sizing in a 360w sidebar.** `CommandComposerFrame` has `minHeight: 206`, `CommandComposerMain` has `paddingLeft: 32, paddingRight: 24` (`components.cls.ts:708, 735`). At sidebar width the strip looks chunky and the asymmetric left padding is more visible. The `sm` breakpoint variant drops minHeight to 80 — but `useBreakpoint` reads the *window* size, not the container size, so docking the strip into a sidebar inside a 1280-wide window won't trigger compact mode. Two paths: (a) add a `compact` prop to InputStrip that the shell sets explicitly when docked, (b) introduce a container-query-style hook for local sizing. (a) is the smaller change.
  - **`useBreakpoint` is window-scoped.** Same root cause as above; affects any future "this widget is in a small slot" decision. Container-query-shaped solution is the real fix; not blocking for the first activity.
  - **No activities exist yet.** This is a transition with nothing to transition to. Build at least one real activity (embed-pipeline is the natural first one — `cart/embed_lab/` is already shaped like an activity) before shipping the shell change, or the activity mode will be empty placeholder all the way down.
  - **Hot-reload state preservation.** `useHotState` + `framework/hotstate.zig` are wired but state resets on reload (per top-level CLAUDE.md). Until that's fixed, every Zig rebuild snaps the user back to focal mode and clears `activeActivityId`.
  - **Onboarding interaction.** The lab gates on no onboarding. The real shell needs to: stay focal during onboarding (no activity triggers fire), allow the deferred-clarification notification (see next section) to work in either mode, decide whether tour mode lives in focal or its own thing.
  - **No activity registry / no activity loader.** ActivityHost can't be written without knowing what it loads. The "activity = component + manifest" decision is gating.

---

## Deferred clarification flow (planned)

The current shape of `onboarding-first-impression` (see `cart/app/recipes/onboarding-first-impression.tsx`) is a **synchronous** 2-turn flow that would block the user at the end of Step 5 while the model asks 3 clarifying questions, waits for answers, then writes the profile. That's friction on the most fragile boundary in the app — the moment the user finally crosses out of onboarding. The plan is to **defer the clarifying turn** so onboarding completes immediately and the clarification surfaces opportunistically once the user is settled.

### Planned shape — Deferred clarification — Stub

CHECKLIST:
- Purpose: After Step 5 finishes, the user transitions into the home menu as today (no extra wait). Once they're settled in `HomeStatic`, at the next quiet moment — defined as *the model finished its current response AND the user hasn't typed for N seconds* — a small notification slides in from the side with copy like "Care to clarify?". Two responses: **No** dismisses and triggers a one-shot V1-style raw write of `first_impression.md` from the onboarding signal alone (no questions, no waiting). **Yes** expands the notification into an inline quick-respond surface — but we don't author that surface ourselves: the recipe's turn-1 fragment already asks the model to emit the questions as a chat-loom `<Form>` tree (see `cart/chat-loom.tsx`), so the cart parses the response with `runtime/intent/parser.parseIntent` and renders it directly via `runtime/intent/render.RenderIntent`. Each user gets a tailored questionnaire — labels, placeholders, even the framing `<Title>` — generated by the model rather than hardcoded by us. On submit, the chat-loom `<Submit reply>` template (`"A1: {q1}\nA2: {q2}\nA3: {q3}"`) interpolates the answers into the user-turn message of turn 2, which fires the write. Either path produces the same `first_impression.md` artifact; the path differs only in how much signal it carries.
- isRoute: FALSE (lives inside the home shell, not a route)
- Route: —
- hasDatashape: TBD — likely a `clarification` substate in `User.onboarding` carrying `{ status: 'pending' | 'dismissed' | 'answered' | 'skipped', firedAt?, answeredAt?, answers?: string[] }`. Lock in alongside the onboarding lock-in pass (see Open threads).
- Datashape: reads `OnboardingProvider` (name / traits / goal / configPath / providerKind) at fire time; writes the chosen-path artifact to `<configPath>/first_impression.md`.
- exposedDatashapes: `clarificationStatus`, `markClarificationFired`, `markClarificationDismissed`, `markClarificationAnswered(answers[])`
- Hooks: `useOnboarding`, `useIFTTT('system:claude:idle', ...)`, `useIFTTT('user:settled', ...)` or equivalent activity gate, a small dedicated animation timeline for the slide-in/expand notification
- Conditions:
  - **Fire gate:** `onb.complete && onb.homeEntryPlayed && clarificationStatus === null && claudeIsIdle && userIdleFor >= QUIET_MS` — all four must hold simultaneously. Default `QUIET_MS = ~6000` (long enough that we're not interrupting), tuned later.
  - **Dismiss path:** No → spawn the writing model with the V1 fragment + onboarding signal alone (no question turn). Persist `clarificationStatus = 'dismissed'` so we don't refire.
  - **Expand path:** Yes → expand the notification into the quick-respond surface, fire turn 1 of the recipe (3 clarifying questions), wait for the user's answers, fire turn 2 (write). Persist `clarificationStatus = 'answered'`.
  - **Skipped onboarding path:** if `user.onboarding.status === 'skipped'`, the recipe never fires (no signal to clarify against). Persist `clarificationStatus = 'skipped'`.
  - **Conflict / upset path:** if the user's submitted answers (or any later message that triggers a recipe-driven write) read as upset / conflict-shaped — by tone heuristic in v1, by a small classifier later — fire `comp_concern_structurer` from the recipe as a SEPARATE upstream Claude turn first. Prepend its output to the writing turn's user-message, then fire the writer. The structurer is the recipe's default enhancer for upset-shaped input; reproducible across three probes (first-impression / external-upset / profile-recovery). Do NOT use the alternative quantifier shape — it reproducibly cools the prose and narrows the scope of correction.
  - **Re-arming:** the notification fires at most once per onboarding completion. After dismiss/answered, it does not return on subsequent boots.
- Components: `ClarifyNotification` (the slide-in chrome card), `RenderIntent` from `runtime/intent/render` (renders the model's chat-loom tree as the expanded body — no custom Q&A surface to author), reuse `S.Button` / `S.ButtonOutline` for the Yes/No actions on the unexpanded card, reuse `SnakeSpinner` while the writing turn runs
- Atoms: `Box` for the notification chrome; the inner form is whatever the model emitted, rendered through `RenderIntent` (`<Form>` / `<Field>` / `<Submit>` already handled by `runtime/intent/render`). Cart-side classifiers TBD for the OUTER chrome only — likely `AppClarifyCard`, `AppClarifyCardExpanded`, `AppClarifyActions` (Yes/No row), `AppClarifyChrome` (the wrapping border / shadow that frames the rendered chat-loom body). No per-field classifiers — those live in `runtime/intent/render`.
- isUsingTheme: TRUE for the chrome (classifiers in `components.cls.ts`); the inner chat-loom render currently has its own inline styling — see PROBLEMS below.
- hasIcons: TBD — probably a small bell / sparkle in the notification chrome
- Icons: —
- hasAnimation: TRUE
- Animations:
  - Slide-in (notification appears): ~400 ms ease-out, from off-screen-right to the corner
  - Expand (Yes click): the card height + width grow to fit the rendered chat-loom tree, ~500 ms; the parsed `<RenderIntent>` content fades in 200 ms after the size change starts
  - Collapse on dismiss (No click): card slides back out as the raw V1 write fires in the background; spinner momentarily replaces the card body if the write is slow
  - Collapse on answered (chat-loom `<Submit>` clicked): card shows a one-line "saved" beat (~700 ms), then slides out — the writing turn (turn 2) fires concurrently, fed the interpolated `"A1: ... / A2: ... / A3: ..."` reply string
  - Re-fire suppression: the notification never animates in again once `clarificationStatus !== null`
- TODO:
  - Define the activity gate (`system:claude:idle` event, plus a userActivity ref or a `useIdle(QUIET_MS)` hook against keystrokes / mouse / scroll). Likely needs a new tiny hook: `useQuietWindow(quietMs, deps)` returning a boolean.
  - Wire the recipe two ways from the cart-side gate: the existing `onboarding-first-impression.tsx` recipe owns the prompt fragments and source kind; the cart-side gate decides whether to fire turn 1 (chat-loom Form turn) or skip directly to a raw write. **The chat-loom shape on turn 1 is already wired into the recipe's CLARIFY_INSTRUCTION** — the cart side only needs to call `parseIntent(text)` on the model's response and hand the resulting nodes to `<RenderIntent onAction={onSubmit}>`.
  - Decide the writing path for the **dismiss** branch: either reuse the same recipe with a third "raw" prompt fragment (cleanest), or fire `system_prompt_only(write_after_clarify)` with no answers and let the model handle it. Cleanest is to add a `frag_onboarding_write_raw` to the recipe — same shape, no "given the answers" framing — and select via the prompt composition's first-match.
  - Persist `clarificationStatus` alongside the rest of the onboarding record in `User.onboarding`, in the same lock-in pass that restores `useCRUD`.
  - Decide notification copy ("Care to clarify?" was the user's phrasing — likely keeps it, but worth A/B'ing once we have telemetry).
  - Wire `comp_concern_structurer` into the upset path. The composition is already in the recipe stamp (`frag_concern_structurer` + `comp_concern_structurer`). Cart side: spawn a separate single-turn `claude_runner` session against that composition's system prompt, hand it the user's last message as the user-turn, capture the structured-concerns table, prepend to the writing turn's user-message, then fire the writer.
  - Decide the upset-detection heuristic. v1 can be cheap and blunt — token-based (presence of "??", ALL CAPS bursts, "this is exactly what I was worried about", explicit profanity) plus a length floor. v2 could be a small classifier turn against a frozen prompt. Don't over-engineer this; false positives on the structurer just cost an extra short turn (~$0.03) and never make the output worse — false negatives mean the writer doesn't get the structured-concerns prepend.
  - Theme-bridge for the embedded chat-loom render. Today `runtime/intent/render` (and `cart/chat-loom.tsx`) carry hardcoded hex literals (`#0b1020`, `#1e293b`, `#f1f5f9`, …). Inside the cart/app shell that's a `no-color-drift` violation. Either route the intent renderer through `cart/component-gallery/components.cls.ts` classifiers (preferred), or wrap the rendered tree in an override that swaps the inline backgroundColor/color/borderColor to `theme:NAME` tokens. Do this as part of the deferred-clarify pass; don't expand the surface area of inline hex first.
- PROBLEMS:
  - **Cross-cuts the lock-in pass.** The activity gate is meaningless without persistence, because every reload would refire the notification. Land this *after* the onboarding lock-in.
  - **Activity-gate definition is the hard part.** "User has settled" is not a bright line — typing-quiet-for-N-seconds is the cheap version, but a user reading something on screen looks identical to an idle user. First version stays cheap; consider scroll/mouse signals later if false-fires are common.
  - **Notification interrupts.** Even a soft slide-in is an interrupt. If the user is mid-thought when it appears, dismissing feels worse than not seeing it. The QUIET_MS default needs to be generous; a click anywhere outside the notification while it's animating in could pre-emptively defer it (re-arm 30s out).
  - **Recipe changes are minimal but real.** Adding `frag_onboarding_write_raw` to the recipe stamp + a third source on the prompt composition's first-match list is a small change; do it as part of this work, not as part of the recipe authoring.
  - **chat-loom render carries inline hex.** Pulling `RenderIntent` into cart/app inherits chat-loom's hardcoded color palette — incompatible with the cart's classifier-only theming rule. See the theme-bridge TODO above; this is the gating concern, not an afterthought.
  - **Model compliance with chat-loom tagset.** The recipe's CLARIFY_INSTRUCTION asks for a strict subset of tags. If the model emits markdown / prose / extra tags, `parseIntent` may degrade to the unparseable fallback (chat-loom shows yellow `[unparseable]` text in that case). Need a graceful fallback in the notification path: if parsing fails, drop back to either a plain three-input form rendered by the cart, or just fire the dismiss path automatically.

---

## Open threads (cross-file)

These need a coordinated touch — not localized to a single file.

- ~~**Onboarding "lock-in" pass**~~ — Done. `state.jsx` writes through `useCRUD` (namespace `app`) into the gallery data graph: User (id `user_local`), Settings (id `settings_default`), Privacy (id `privacy_default`), Workspace (id `ws_local`), plus per-completion Connection + Goal rows. `User.onboarding.{status,step,startedAt,completedAt,skippedAt,tourStatus}` all persist. `state_old.jsx` is the breadcrumb of the prior in-memory shape; safe to delete on the next homepage pass.
- **Real probes for API-key + Local providers** — both `ApiKeyForm` and `LocalForm` return canned model lists. Wire `runtime/hooks/http.ts` for HTTP-shaped endpoints; keep the `.gguf`-on-disk path as a single-entry list until we have a probe that reads gguf header metadata. Until this lands, the model id `commitConnection` writes to `Settings.defaultModelId` is whatever `chosen` happened to be from the canned list.
- **Tour overlay** — `Chrome.TourBanner` calls `onb.acceptTour()` on Yes, but there is no actual tour overlay yet. When the tour is built, `acceptTour()` should additionally arm the overlay; the banner unmount is already handled by the `tourStatus !== 'pending'` flip. Decline path is fully wired (just hides). `tourStatus` now persists so a declined tour stays declined across reloads.
- **Skipped-mode runtime branch** — when `User.onboarding.status === 'skipped'`, the app should run in a degraded mode. State.jsx persists the status correctly today, but IndexPage still treats `complete=true` as one homogenous render path. Add a third branch (alongside onboarding / completed-home) that prompts inline for missing onboarded data when skipped users hit features that need it.
- **Deferred clarification flow re-arm** — see the deferred-clarify section above. Now that persistence is live, a `clarification` substate on `User.onboarding` (or a sibling field) is a clean place to land `{status, firedAt, answers}` so the notification doesn't refire across reloads.
- **Goal popover copy** — Step5's tooltip text lives inline in `Step5.jsx` (`GOAL_TOOLTIP`). Move to a content / i18n layer once one exists; today there's no other natural home for it.
