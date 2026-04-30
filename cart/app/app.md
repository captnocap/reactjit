# App

Living index of every file under `cart/app/` — what each one is, how it's wired, and what's still pending. Format is per-file: a status word (Stub / WIP / Complete) + a checklist. "Complete" means *complete for what it is meant to do today*, not "feature-complete forever". Line numbers are accurate to the file at the time of writing.

The app is a router-driven cart with custom window chrome, an `OnboardingProvider` context wrapping the route tree, and routes mounted at `/` and `/about`. **All theme-touching styling lives in `cart/component-gallery/components.cls.ts`** — every surface in cart/app is a classifier (`<S.AppChrome>`, `<S.AppHello>`, `<S.AppProviderTile>` etc.). There is no `theme.js` shim; if you find yourself reaching for `tokenColor` or hex literals, add a classifier in `components.cls.ts` instead. Active/inactive variants are separate classifiers (e.g. `AppNavLink` / `AppNavLinkActive`); the JSX picks one. Dynamic per-render values (animation opacity, slide marginTop) flow as inline `style={{...}}` overrides — `mergeUserProps` in `runtime/classifier.tsx` merges user style over the classifier's resolved style.

---

## Routes & screens

### App shell — `index.tsx` — Complete

CHECKLIST:
- Purpose: Cart entry. Boots the gallery theme, mounts the custom window chrome (titlebar + drag region + onboarding step cubes / route nav swap + tour banner + window controls), wraps the route tree in `<TooltipRoot>` and `<OnboardingProvider>`, and registers the `/` and `/about` routes.
- isRoute: FALSE
- Route: N/A (registers `/` and `/about` inside the `<Router>`)
- hasDatashape: FALSE
- Datashape: consumes `onboarding/state.jsx` (`useOnboarding`)
- exposedDatashapes: `onb.step`, `onb.totalSteps`, `onb.setStep`, `onb.complete`, `onb.loading`, `onb.tourStatus`, `onb.acceptTour`, `onb.declineTour`
- Hooks: `useOnboarding`, `useNavigate`, `useRoute`, `useAnimationTimeline` (inside `TourBanner`)
- Conditions:
  - `onboardingActive = !onb.loading && !onb.complete` swaps step cubes for route nav links on the right side of the chrome
  - `showTour = !onboardingActive && onb.tourStatus === 'pending'` — drops the tour banner into the right cluster (BEFORE the nav row, after the brand) once Step5 has called `markComplete()`. Banner unmounts on accept / decline (`tourStatus` flips to `'accepted'` or `'declined'`).
- Components: `TooltipRoot`, `OnboardingProvider`, `Router`, `Route`, `IndexPage`, `AboutPage`, `Chrome`, `NavLink`, `StepCubes`, `TourBanner`
- Atoms: `Box`, `S.AppChrome`, `S.AppChromeBrandRow`, `S.AppChromeNavRow`, `S.AppChromeRightCluster`, `S.AppBrandSwatch`, `S.AppBrandTitle`, `S.AppBrandSub`, `S.AppNavLink` / `S.AppNavLinkActive`, `S.AppNavIcon` / `S.AppNavIconActive`, `S.AppNavLabel` / `S.AppNavLabelActive`, `S.AppStepCubeRow`, `S.AppStepCubePast` / `S.AppStepCubeCurrent` / `S.AppStepCubeFuture`, `S.AppChromeDivider`, `S.AppChromeTourBanner`, `S.AppChromeTourText`, `S.AppChromeTourActions`, `S.AppChromeTourYes` / `S.AppChromeTourNo`, `S.AppChromeTourYesLabel` / `S.AppChromeTourNoLabel`, `S.AppWindowBtn`, `S.AppWindowBtnIcon` / `S.AppWindowBtnIconClose`
- isUsingTheme: TRUE — every surface goes through a classifier in `components.cls.ts`
- hasIcons: TRUE
- Icons: `Home`, `Info`, `Minimize`, `Maximize`, `X`
- hasAnimation: TRUE (only the tour banner; the chrome itself is static)
- Animations: `TourBanner` mounts at `markComplete()` time, holds invisible until `TOUR_BANNER_FADE_DELAY_MS = 1400ms` (so the home-page carryover dominates first), then fades in over `TOUR_BANNER_FADE_MS = 500ms`. Yes / No has no exit animation — the answer **is** the action, banner unmounts immediately.
- TODO: when persistence is restored, the banner shouldn't re-arm on every fresh boot — `tourStatus === 'pending'` must persist its `'declined'` / `'accepted'` resolution. Once a real tour is wired, `acceptTour()` should additionally start the tour overlay (today it just hides the banner).
- PROBLEMS: none known

---

### Index page — `page.jsx` — WIP

CHECKLIST:
- Purpose: `/` route. Three-way gate: while `onb.complete` is false → `<Onboarding>`; on the first render after `markComplete()` (`!onb.homeEntryPlayed`) → `<HomeEntry>` which carries Step5's exit final frame ("Welcome aboard." + spinner) and dissolves it into the home card; otherwise → `<HomeStatic>` direct.
- isRoute: TRUE
- Route: `/`
- hasDatashape: FALSE
- Datashape: consumes `onboarding/state.jsx`
- exposedDatashapes: `onb.loading`, `onb.complete`, `onb.step`, `onb.shouldPlayFirstStartAnimation`, `onb.markFirstStartAnimationPlayed`, `onb.homeEntryPlayed`, `onb.markHomeEntryPlayed`
- Hooks: `useOnboarding`, `useAnimationTimeline` (inside `HomeEntry`), `useEffect`, `useRef`
- Conditions:
  - `if (onb.loading) return null;`
  - `if (!onb.complete) return <Onboarding ...>;`
  - `if (!onb.homeEntryPlayed) return <HomeEntry />;`
  - else `return <HomeStatic />;`
  - `HomeEntry` schedules `markHomeEntryPlayed()` at `ENTRY_DONE_MS = T_HOME_IN_END + 80 = 2030 ms` so the next render flips to `<HomeStatic />` cleanly.
- Components: `Onboarding`, `HomeEntry`, `HomeStatic`, `SnakeSpinner`
- Atoms: `Box`, `S.Page`, `S.Card`, `S.Title`, `S.Body`, `S.AppStepFrame`, `S.AppStepCenter`, `S.AppStepBottomRight`, `S.AppGreet`
- isUsingTheme: TRUE (via classifiers)
- hasIcons: FALSE
- Icons: —
- hasAnimation: TRUE (HomeEntry only — HomeStatic is a no-animation render)
- Animations (HomeEntry, single shared `useAnimationTimeline`):
  - Carryover hold 0→500 ms ("Welcome aboard." + spinner at full opacity, picking up exactly where Step5 left off)
  - Carryover fade-out 500→1400 ms (`fadeOut`)
  - Home content fade-in + slide-up 1400→1950 ms (40 px slide)
  - `markHomeEntryPlayed()` at 2030 ms
- TODO: replace the placeholder Home card with the real product surface once onboarding is locked in. Add a separate "skipped-mode" branch that runs in degraded UX when `user.onboarding.status === 'skipped'`.
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
- PROBLEMS:
  - Toggling traits writes to localstore on every click via `onb.setTraits` — the read-modify-write race documented on `state.jsx` could in theory clobber rapid sequential toggles. Hasn't been observed yet, but watch for it once we add adjacent steps that also write.

---

### Step 3 — Config path — `onboarding/Step4.jsx` — Complete

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
  - Validate / normalize the path (resolve `~` to `$HOME`, ensure absolute) before persisting once the lock-in pass restores `useCRUD`.
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
- Components: `Tooltip` (`cart/shared/tooltip/Tooltip`), `SnakeSpinner`, `S.Button`, `S.ButtonLabel`, `S.ButtonOutline`, `S.ButtonOutlineLabel`
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
  - Once persistence is restored, the popover copy should live in a content file (i18n + edit-without-cart-rebuild).
  - Optional: secondary tooltip / micro-help on the input itself if the goal vocabulary needs more handholding.
- PROBLEMS: none known.

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
  - in-memory only right now: `step`, `complete`, `name`, `providerKind`, `traits`, `configPath`, `goal`, `tourStatus`, plus session-only `animationPlayedThisSession` and `homeEntryPlayed`
  - eventual home: `cart/component-gallery/data/user.ts` → `User.onboarding` (`UserOnboarding` type) — fields and statuses already defined there as the migration target
- exposedDatashapes: `step`, `totalSteps`, `complete`, `loading`, `setStep`, `markComplete`, `shouldPlayFirstStartAnimation`, `markFirstStartAnimationPlayed`, `homeEntryPlayed`, `markHomeEntryPlayed`, `tourStatus`, `acceptTour`, `declineTour`, `name`, `setName`, `providerKind`, `setProviderKind`, `traits`, `setTraits`, `configPath`, `setConfigPath`, `goal`, `setGoal`
- Hooks: `useState`, `createContext`, `useContext`
- Conditions:
  - `setStep` clamps to `[0, TOTAL_STEPS-1]` and flips `animationPlayedThisSession` when advancing forward
  - `markComplete` sets `complete=true` AND offers the tour by flipping `tourStatus: null → 'pending'` (only on the first call, via a functional setter — protects the value if persistence later restores `'accepted'` / `'declined'`)
  - `acceptTour` / `declineTour` set `tourStatus` to the corresponding terminal — banner unmounts immediately
  - `markHomeEntryPlayed` flips the session-only `homeEntryPlayed` gate so subsequent IndexPage mounts skip the carryover animation
  - `shouldPlayFirstStartAnimation` derived gate: `!complete && step === 0 && !animationPlayedThisSession`
  - `loading` is hardcoded `false` — `page.jsx` `if (onb.loading) return null;` becomes a dead branch but is left in place for the lock-in flip
- Components: `Ctx.Provider`
- Atoms: —
- isUsingTheme: FALSE
- hasIcons: FALSE
- Icons: —
- hasAnimation: FALSE
- Animations: —
- TODO:
  - **Lock-in flip:** restore `useCRUD('onboarding', ..., { namespace: 'app' })` + the bootstrap effect, AND simultaneously migrate the persisted record into `User.onboarding`. Don't restore the cart-local record only to migrate later — do both in one pass. Map `configPath` and `goal` into the persisted record at the same time.
  - Add `markSkipped()` (sets `complete=true` + `skipped=true` + timestamp) for the FirstStep `Skip` path. (`markComplete()` is wired now via Step5.)
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

## Deferred clarification flow (planned)

The current shape of `onboarding-first-impression` (see `cart/app/recipes/onboarding-first-impression.tsx`) is a **synchronous** 2-turn flow that would block the user at the end of Step 5 while the model asks 3 clarifying questions, waits for answers, then writes the profile. That's friction on the most fragile boundary in the app — the moment the user finally crosses out of onboarding. The plan is to **defer the clarifying turn** so onboarding completes immediately and the clarification surfaces opportunistically once the user is settled.

### Planned shape — Deferred clarification — Stub

CHECKLIST:
- Purpose: After Step 5 finishes, the user transitions into the home menu as today (no extra wait). Once they're settled in `HomeStatic`, at the next quiet moment — defined as *the model finished its current response AND the user hasn't typed for N seconds* — a small notification slides in from the side with copy like "Care to clarify?". Two responses: **No** dismisses and triggers a one-shot V1-style raw write of `first_impression.md` from the onboarding signal alone (no questions, no waiting). **Yes** expands the notification into an inline quick-respond surface: the model's 3 clarifying questions appear, the user types answers (compact, not full chat), then the V3 clarify-loop write fires and the notification collapses with a "saved" beat. Either path produces the same `first_impression.md` artifact; the path differs only in how much signal it carries.
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
  - **Re-arming:** the notification fires at most once per onboarding completion. After dismiss/answered, it does not return on subsequent boots.
- Components: `ClarifyNotification` (the slide-in card), `ClarifyExpanded` (the inline Q&A surface that grows from the notification), reuse `S.Button` / `S.ButtonOutline` for the actions, reuse `SnakeSpinner` while the writing turn runs
- Atoms: `Box`, `TextInput` (for the answer fields), classifiers TBD (likely `AppClarifyCard`, `AppClarifyCardExpanded`, `AppClarifyQuestion`, `AppClarifyAnswerInput`, `AppClarifyActions` — add to `components.cls.ts` when the surface lands)
- isUsingTheme: TRUE (every surface a classifier — same rule as the rest of cart/app)
- hasIcons: TBD — probably a small bell / sparkle in the notification chrome
- Icons: —
- hasAnimation: TRUE
- Animations:
  - Slide-in (notification appears): ~400 ms ease-out, from off-screen-right to the corner
  - Expand (Yes click): the card height + width grow to fit the Q&A surface, ~500 ms with the questions fading in 200 ms after the size change starts
  - Collapse on dismiss (No click): card slides back out as the V1 write fires in the background; spinner momentarily replaces the card body if the write is slow
  - Collapse on answered: card shows a one-line "saved" beat (~700 ms), then slides out
  - Re-fire suppression: the notification never animates in again once `clarificationStatus !== null`
- TODO:
  - Define the activity gate (`system:claude:idle` event, plus a userActivity ref or a `useIdle(QUIET_MS)` hook against keystrokes / mouse / scroll). Likely needs a new tiny hook: `useQuietWindow(quietMs, deps)` returning a boolean.
  - Wire the recipe two ways from the cart-side gate: the existing `onboarding-first-impression.tsx` recipe owns the prompt fragments and source kind; the cart-side gate decides whether to fire turn 1 (question turn) or skip directly to a write turn that uses the onboarding signal alone. **No changes needed to the recipe stamp itself** — only the cart-side firing logic.
  - Decide the writing path for the **dismiss** branch: either reuse the same recipe with a third "raw" prompt fragment (cleanest), or fire `system_prompt_only(write_after_clarify)` with no answers and let the model handle it. Cleanest is to add a `frag_onboarding_write_raw` to the recipe — same shape, no "given the answers" framing — and select via the prompt composition's first-match.
  - Persist `clarificationStatus` alongside the rest of the onboarding record in `User.onboarding`, in the same lock-in pass that restores `useCRUD`.
  - Decide notification copy ("Care to clarify?" was the user's phrasing — likely keeps it, but worth A/B'ing once we have telemetry).
- PROBLEMS:
  - **Cross-cuts the lock-in pass.** The activity gate is meaningless without persistence, because every reload would refire the notification. Land this *after* the onboarding lock-in.
  - **Activity-gate definition is the hard part.** "User has settled" is not a bright line — typing-quiet-for-N-seconds is the cheap version, but a user reading something on screen looks identical to an idle user. First version stays cheap; consider scroll/mouse signals later if false-fires are common.
  - **Notification interrupts.** Even a soft slide-in is an interrupt. If the user is mid-thought when it appears, dismissing feels worse than not seeing it. The QUIET_MS default needs to be generous; a click anywhere outside the notification while it's animating in could pre-emptively defer it (re-arm 30s out).
  - **Recipe changes are minimal but real.** Adding `frag_onboarding_write_raw` to the recipe stamp + a third source on the prompt composition's first-match list is a small change; do it as part of this work, not as part of the recipe authoring.

---

## Open threads (cross-file)

These need a coordinated touch — not localized to a single file.

- **Onboarding "lock-in" pass** — `state.jsx` is currently in-memory only (no `useCRUD`, no localstore record). Nothing about the onboarding flow persists across reloads on purpose, so iteration doesn't trap us in mid-flow carryover animations. When iteration is done: restore `useCRUD('onboarding', ..., { namespace: 'app' })` + the bootstrap effect, AND in the same pass migrate the shape directly into `User.onboarding` (`cart/component-gallery/data/user.ts`). At that point also flip `firstStartAnimationSeen`, `complete`, and the future `skipped` flag to actually persist. Don't restore the cart-local record only to migrate later — single coordinated change.
- **Real probes for API-key + Local providers** — both `ApiKeyForm` and `LocalForm` return canned model lists. Wire `runtime/hooks/http.ts` for HTTP-shaped endpoints; keep the `.gguf`-on-disk path as a single-entry list until we have a probe that reads gguf header metadata.
- **Onboarding completion runtime** — Step5 calls `onb.markComplete()` which only flips an in-memory flag. When the lock-in pass restores persistence, ensure `complete` (plus `name`, `providerKind`, `traits`, `configPath`, `goal`, `tourStatus`) survive a reload so the home placeholder isn't regressed back to step 0 on the next boot, and so a previously-declined tour stays declined.
- **Tour overlay** — `Chrome.TourBanner` calls `onb.acceptTour()` on Yes, but there is no actual tour overlay yet. When the tour is built, `acceptTour()` should additionally arm the overlay; the banner unmount is already handled by the `tourStatus !== 'pending'` flip. Decline path is fully wired (just hides).
- **Skipped-mode runtime branch** — when `user.onboarding.status === 'skipped'`, the app must run in a degraded mode. Today there's no consumer of that state; once it's persisted, IndexPage will need a third branch alongside the onboarding / complete-home split. The skipped path should also bypass `tourStatus = 'pending'` (no point offering a tour to a user who chose to skip onboarding).
- **Goal popover copy** — Step5's tooltip text lives inline in `Step5.jsx` (`GOAL_TOOLTIP`). Move to a content / i18n layer once one exists; today there's no other natural home for it.
