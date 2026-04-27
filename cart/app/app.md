# App

Living index of every file under `cart/app/` — what each one is, how it's wired, and what's still pending. Format is per-file: a status word (Stub / WIP / Complete) + a checklist. "Complete" means *complete for what it is meant to do today*, not "feature-complete forever". Line numbers are accurate to the file at the time of writing.

The app is a router-driven cart with custom window chrome, an `OnboardingProvider` context wrapping the route tree, and routes mounted at `/` and `/about`. **All theme-touching styling lives in `cart/component-gallery/components.cls.ts`** — every surface in cart/app is a classifier (`<S.AppChrome>`, `<S.AppHello>`, `<S.AppProviderTile>` etc.). There is no `theme.js` shim; if you find yourself reaching for `tokenColor` or hex literals, add a classifier in `components.cls.ts` instead. Active/inactive variants are separate classifiers (e.g. `AppNavLink` / `AppNavLinkActive`); the JSX picks one. Dynamic per-render values (animation opacity, slide marginTop) flow as inline `style={{...}}` overrides — `mergeUserProps` in `runtime/classifier.tsx` merges user style over the classifier's resolved style.

---

## Routes & screens

### App shell — `index.tsx` — Complete

CHECKLIST:
- Purpose: Cart entry. Boots the gallery theme, mounts the custom window chrome (titlebar + drag region + onboarding step cubes / route nav swap + window controls), wraps the route tree in `<TooltipRoot>` and `<OnboardingProvider>`, and registers the `/` and `/about` routes.
- isRoute: FALSE
- Route: N/A (registers `/` line 168 and `/about` line 171)
- hasDatashape: FALSE
- Datashape: consumes `onboarding/state.jsx` (`useOnboarding`)
- exposedDatashapes: `onb.step`, `onb.totalSteps`, `onb.setStep`, `onb.complete`, `onb.loading` — read at lines 110, 143
- Hooks: `useOnboarding` (line 109), `useNavigate` (line 28), `useRoute` (line 27)
- Conditions: `onboardingActive = !onb.loading && !onb.complete` (line 110) → swaps step cubes (line 143) for route nav links (lines 145–148) on the right side of the chrome
- Components: `TooltipRoot`, `OnboardingProvider`, `Router`, `Route`, `IndexPage`, `AboutPage`, `Chrome`, `NavLink`, `StepCubes`
- Atoms: `Box`, `S.AppChrome`, `S.AppChromeBrandRow`, `S.AppChromeNavRow`, `S.AppChromeRightCluster`, `S.AppBrandSwatch`, `S.AppBrandTitle`, `S.AppBrandSub`, `S.AppNavLink` / `S.AppNavLinkActive`, `S.AppNavIcon` / `S.AppNavIconActive`, `S.AppNavLabel` / `S.AppNavLabelActive`, `S.AppStepCubeRow`, `S.AppStepCubePast` / `S.AppStepCubeCurrent` / `S.AppStepCubeFuture`, `S.AppChromeDivider`, `S.AppWindowBtn`, `S.AppWindowBtnIcon` / `S.AppWindowBtnIconClose`
- isUsingTheme: TRUE — every surface goes through a classifier in `components.cls.ts`
- hasIcons: TRUE
- Icons: `Home` (line 17 → 147), `Info` (line 18 → 147), `Minimize` (line 152), `Maximize` (line 153), `X` (line 154)
- hasAnimation: FALSE
- Animations: —
- TODO: nothing pending here
- PROBLEMS: none known

---

### Index page — `page.jsx` — WIP

CHECKLIST:
- Purpose: `/` route. Gates onboarding vs the eventual real home. While `onb.complete` is false, renders `<Onboarding>`; otherwise renders a placeholder home card.
- isRoute: TRUE
- Route: `/`
- hasDatashape: FALSE
- Datashape: consumes `onboarding/state.jsx`
- exposedDatashapes: `onb.loading` (line 8), `onb.complete` (line 10), `onb.step` (line 13), `onb.shouldPlayFirstStartAnimation` (line 14), `onb.markFirstStartAnimationPlayed` (line 15)
- Hooks: `useOnboarding` (line 7)
- Conditions: loading guard `if (onb.loading) return null;` (line 8); `if (!onb.complete) → <Onboarding>` (line 10)
- Components: `Onboarding` (line 11)
- Atoms: `Box`, `S.Page`, `S.Card`, `S.Title`, `S.Body`
- isUsingTheme: TRUE (via classifiers)
- hasIcons: FALSE
- Icons: —
- hasAnimation: FALSE
- Animations: —
- TODO: replace the placeholder Home card (lines 20–28) with the real product surface once onboarding is locked in. Add a separate "skipped-mode" branch that runs in degraded UX when `user.onboarding.status === 'skipped'`.
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

### Onboarding step router — `onboarding/Onboarding.jsx` — WIP

CHECKLIST:
- Purpose: Routes by `step` to the right onboarding screen. Step 0 → `<FirstStep>`, step 1 → `<Step2>`, step 2 → `<Step3>`, steps 3–4 fall back to a generic placeholder card.
- isRoute: FALSE (mounted inside `IndexPage` which owns the `/` route)
- Route: —
- hasDatashape: FALSE
- Datashape: receives props from page.jsx (sourced from `onboarding/state.jsx`)
- exposedDatashapes: `step`, `animate`, `onAnimationDone` (props)
- Hooks: —
- Conditions: `step === 0` → FirstStep; `step === 1` → Step2; `step === 2` → Step3; else placeholder
- Components: `FirstStep`, `Step2`, `Step3`
- Atoms: `Box`, `S.Page`, `S.Card`, `S.Caption`, `S.Title`, `S.Body`
- isUsingTheme: TRUE (via classifiers)
- hasIcons: FALSE
- Icons: —
- hasAnimation: FALSE (step components own their own animations)
- Animations: —
- TODO: design + implement steps 4 and 5 (currently the placeholder card with `'Step N placeholder.'` body)
- PROBLEMS: none

---

### Step 0 — Hello / name capture — `onboarding/FirstStep.jsx` — Complete

CHECKLIST:
- Purpose: Onboarding step 0. Plays a staggered "Hello" → "what is your name?" → text input entry, then reveals Skip + Next in the bottom-right. On click, runs an exit transition (buttons fade out, spinner fades in, center text fades out, "Nice to meet you {name}" fades in centered) and advances to Step2 with a best-effort ordered write (`setName` first, then `setStep(1)`).
- isRoute: FALSE
- Route: —
- hasDatashape: FALSE
- Datashape: writes to `onboarding/state.jsx` record on dispatch (`setName`, `setStep`)
- exposedDatashapes: `onb.step`, `onb.setName`, `onb.setStep`
- Hooks: `useState`, `useRef`, `useEffect`, `useAnimationTimeline`, `useOnboarding`
- Conditions: `animate` gate folds entry progress to 1 when false; name-coercion typeguard; `hasName` gates Skip/Next; exit dispatch `useEffect` only arms when both `exiting` and `exitStartT` are set; `setName` is bounded via timeout so `setStep` cannot stall indefinitely.
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
- TODO: when skipped-mode is locked in, branch the dispatch (lines 120–127) so `Skip` writes `user.onboarding.status='skipped'` instead of advancing the step
- PROBLEMS:
  - `firstStartAnimationSeen` is intentionally NOT persisted yet (state.jsx line 72–77) — animation replays on every fresh boot until that flip is wired.
  - `console.log` on skip dispatch is intentional iteration scaffolding; remove when locking in.

---

### Step 1 — Provider selection — `onboarding/Step2.jsx` — WIP

CHECKLIST:
- Purpose: Onboarding step 1. Carries over the FirstStep exit-final frame (greet + spinner) when name is persisted, eases everything out, fades in "This application requires a connection to a provider", slides it up, staggers in 3 provider tiles. Click a tile → that tile gains the active border + an inline form expands below the row. Each form has a Probe button that gates on any-input-non-empty. When the probe succeeds (and a model is picked, for API/Local) the screen-level Next button fades in bottom-right. Click Next → exit transition (menu/form fade out, spinner fades in bottom-right, "Thanks for that" fades in centered) → `setStep(2)` advances to Step3. Bottom-left "Take me back!" returns to step 0.
- isRoute: FALSE
- Route: —
- hasDatashape: FALSE
- Datashape: reads/writes `onboarding/state.jsx` (`name`, `providerKind`)
- exposedDatashapes: `onb.name`, `onb.setProviderKind`, `onb.setStep`
- Hooks: `useAnimationTimeline`, `useOnboarding`, `useState`, `useRef`, `useEffect`, `processHook.execAsync`
- Conditions:
  - `hasGreet = persistedName.length > 0` drives the carryover branch and the timeline `skip` flag
  - greet/spinner conditional render gated on `greetOp > 0.001`
  - `pickProvider` early-return when same tile reclicked; fades the form in only on first selection
  - `pickProvider` resets `lockedIn=false` on tile switch so the new form re-arms it from scratch
  - inline form rendered only when `selected` is non-null
  - `hasAnyInput` gates each Probe button
  - `lockedIn` lifted out of the forms (each form's `useEffect` calls `setLockedIn(...)` based on its internal probe + chosen-model state) → gates the Next button render
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
  - Decide what the Claude `home` field actually does. Currently it gets baked into `HOME=…` for the probe.
  - Persist the chosen model (currently local `chosen` state is dropped when Step2 unmounts).
- PROBLEMS:
  - API-key probe still returns a canned model list; local probe now does live HTTP probing (`/models`, `/v1/models`, `/api/tags`) and parses model IDs.
  - The Claude probe relies on `claude` being on `$PATH` of the cart's process — no fallback if it isn't.

---

### Step 2 — Trait survey — `onboarding/Step3.jsx` — WIP

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
  - Replace the hardcoded `TRAITS` list with a configurable / persisted catalog when the survey grows past iteration.
  - Wire Step4's carryover so the exit message + spinner stay visible during the Step3→Step4 hand-off (today Step4 is still a placeholder card, so the exit just snaps to that).
- PROBLEMS:
  - Toggling traits writes to localstore on every click via `onb.setTraits` — the read-modify-write race documented on `state.jsx` could in theory clobber rapid sequential toggles. Hasn't been observed yet, but watch for it once we add adjacent steps that also write.

---

## State, library, manifest

### Onboarding state provider — `onboarding/state.jsx` — WIP

**!! ITERATION MODE — NOTHING PERSISTS !!** Every fresh boot starts at step 0 with empty `name` / `providerKind` / `traits` and `complete=false`. This is intentional: while the onboarding flow is being designed, persistence would force a manual reset between dev runs and trap us re-entering at Step 2/3 with carryover animations firing. This file used to be `useCRUD`-backed (localstore at `app/onboarding/state`) and will return to that shape — at the same time it migrates into `User.onboarding` — once every step is locked in. If you find yourself debugging "why doesn't onboarding state survive a reload", the answer is "by design, until lock-in" — re-add `useCRUD` + the bootstrap effect (see git history for the prior shape) only as part of the lock-in pass.

CHECKLIST:
- Purpose: React context provider holding the onboarding record entirely in `useState`. Exposes typed selectors / setters with a stable surface so consumers don't change when persistence is restored.
- isRoute: FALSE
- Route: —
- hasDatashape: FALSE (in-memory only — no datashape until lock-in)
- Datashape:
  - in-memory only right now: `step`, `complete`, `name`, `providerKind`, `traits`, plus session-only `animationPlayedThisSession`
  - eventual home: `cart/component-gallery/data/user.ts` → `User.onboarding` (`UserOnboarding` type) — fields and statuses already defined there as the migration target
- exposedDatashapes: `step`, `totalSteps`, `complete`, `loading`, `setStep`, `shouldPlayFirstStartAnimation`, `markFirstStartAnimationPlayed`, `name`, `setName`, `providerKind`, `setProviderKind`, `traits`, `setTraits`
- Hooks: `useState` (lines 27–32), `createContext` (line 5), `useContext` (line 73)
- Conditions:
  - `setStep` clamps to `[0, TOTAL_STEPS-1]` and flips `animationPlayedThisSession` when advancing forward (lines 34–38)
  - `shouldPlayFirstStartAnimation` derived gate: `!complete && step === 0 && !animationPlayedThisSession` (line 61)
  - `loading` is hardcoded `false` (line 60) — `page.jsx:8` `if (onb.loading) return null;` becomes a dead branch but is left in place for the lock-in flip
- Components: `Ctx.Provider` (line 70)
- Atoms: —
- isUsingTheme: FALSE
- hasIcons: FALSE
- Icons: —
- hasAnimation: FALSE
- Animations: —
- TODO:
  - **Lock-in flip:** restore `useCRUD('onboarding', ..., { namespace: 'app' })` + the bootstrap effect, AND simultaneously migrate the persisted record into `User.onboarding`. Don't restore the cart-local record only to migrate later — do both in one pass.
  - Add `markComplete()` (sets `complete=true`) and `markSkipped()` (sets `complete=true` + `skipped=true` + timestamp) for the FirstStep `Skip` and Step2 `Probe → forward` paths.
  - Re-wire `markFirstStartAnimationPlayed` to persist `firstStartAnimationSeen=true` (currently a no-op beyond the session flag) when persistence returns.
- PROBLEMS:
  - State is wiped on every reload. This is the iteration-mode tradeoff, not a bug — see the banner above. If you want to test mid-flow without re-clicking, temporarily seed `useState` defaults at the top of the provider (e.g. `useState(2)` for step) and revert before committing.
  - All setters are synchronous now. FirstStep's "bounded wait before step advance" was guarding the old CRUD round-trip; safe to keep as-is until persistence returns.

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

## Open threads (cross-file)

These need a coordinated touch — not localized to a single file.

- **Onboarding "lock-in" pass** — `state.jsx` is currently in-memory only (no `useCRUD`, no localstore record). Nothing about the onboarding flow persists across reloads on purpose, so iteration doesn't trap us in mid-flow carryover animations. When iteration is done: restore `useCRUD('onboarding', ..., { namespace: 'app' })` + the bootstrap effect, AND in the same pass migrate the shape directly into `User.onboarding` (`cart/component-gallery/data/user.ts`). At that point also flip `firstStartAnimationSeen`, `complete`, and the future `skipped` flag to actually persist. Don't restore the cart-local record only to migrate later — single coordinated change.
- **Real probes for API-key + Local providers** — both `ApiKeyForm` and `LocalForm` return canned model lists. Wire `runtime/hooks/http.ts` for HTTP-shaped endpoints; keep the `.gguf`-on-disk path as a single-entry list until we have a probe that reads gguf header metadata.
- **Step4 / Step5** — currently just generic placeholder cards in `Onboarding.jsx`. Need design + implementation, plus carryover continuity from Step3's outbound transition into Step4.
- **Skipped-mode runtime branch** — when `user.onboarding.status === 'skipped'`, the app must run in a degraded mode. Today there's no consumer of that state; once it's persisted, IndexPage will need a third branch alongside the onboarding / complete-home split.
