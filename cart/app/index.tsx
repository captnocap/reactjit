import '../component-gallery/components.cls';
import { APP_BOTTOM_BAR_H } from '../component-gallery/components.cls';
import { useEffect, useRef, useState } from 'react';
import { EASINGS } from '@reactjit/runtime/easing';
import { Box, Pressable } from '@reactjit/runtime/primitives';
import { Route, Router, useNavigate, useRoute } from '@reactjit/runtime/router';
import { installBrowserShims } from '@reactjit/runtime/hooks';
import { useBreakpoint, useActiveVariant, setVariant } from '@reactjit/runtime/theme';
import { TooltipRoot } from '@reactjit/runtime/tooltip/Tooltip';
import { Home, Info, Maximize, Minimize, Settings, X } from '@reactjit/runtime/icons/icons';
import { callHost } from '@reactjit/runtime/ffi';
import { applyGalleryTheme, getActiveGalleryThemeId, useGalleryTheme } from '../component-gallery/gallery-theme';
import { classifiers as S } from '@reactjit/core';
import { useIFTTT } from '@reactjit/runtime/hooks/useIFTTT';
import IndexPage from './page';
import AboutPage from './about/page';
import SettingsPage, { SettingsNav, SETTINGS_NAV_W } from './settings/page';
import SweatshopPage from './sweatshop/page';
import { OnboardingProvider, useOnboarding } from './onboarding/state';
import { useAnimationTimeline } from './anim';
import { InputStrip } from './InputStrip';
import { useInputFocal, setHudInsets } from './shell';
import { AssistantChat } from './chat/AssistantChat';
import type { ChatShape } from './chat/types';

applyGalleryTheme(getActiveGalleryThemeId());
installBrowserShims();

// Each route declares its shell layout mode. `full` means home-style
// layout (no side panel). `side` means activity-style layout (side
// panel visible, input docks unless an activity calls setInputFocal).
// The shell derives `headingTo` from (active-route.mode, inputFocal),
// so transitions only fire when the resolved state actually changes.
type RouteMode = 'full' | 'side';
const ROUTES: Array<{ path: string; label: string; icon: number[][]; mode: RouteMode }> = [
  { path: '/',                  label: 'Home',      icon: Home,     mode: 'full' },
  { path: '/settings',          label: 'Settings',  icon: Settings, mode: 'side' },
  { path: '/about',             label: 'About',     icon: Info,     mode: 'full' },
  { path: '/activity/sweatshop', label: 'Sweatshop', icon: Settings, mode: 'side' },
];

function NavLink({ path, label, icon }: { path: string; label: string; icon: number[][] }) {
  const route = useRoute();
  const nav = useNavigate();
  const active = route.path === path;
  const Link = active ? S.AppNavLinkActive : S.AppNavLink;
  const Glyph = active ? S.AppNavIconActive : S.AppNavIcon;
  const Label = active ? S.AppNavLabelActive : S.AppNavLabel;
  return (
    <Link onPress={() => nav.push(path)}>
      <Glyph icon={icon} />
      <Label>{label}</Label>
    </Link>
  );
}

function StepCubes({ step, total, onPress }: { step: number; total: number; onPress: (i: number) => void }) {
  const cubes: number[] = [];
  for (let i = 0; i < total; i++) cubes.push(i);
  return (
    <S.AppStepCubeRow>
      {cubes.map((i) => {
        const Cube = i === step ? S.AppStepCubeCurrent : i < step ? S.AppStepCubePast : S.AppStepCubeFuture;
        return <Cube key={i} onPress={() => onPress(i)} />;
      })}
    </S.AppStepCubeRow>
  );
}

// Brand swatch doubles as the theme cycler — same gesture the component
// gallery's titlebar uses (see `cart/component-gallery/index.tsx` TitleBar).
// Each click advances to the next gallery theme option; the swatch's own
// classifier picks up the new accent on render.
function ThemeSwatch() {
  const galleryTheme = useGalleryTheme();
  const cycle = () => {
    const opts = galleryTheme.options;
    if (opts.length <= 1) return;
    const idx = opts.findIndex((o) => o.id === galleryTheme.activeThemeId);
    const next = opts[((idx >= 0 ? idx : 0) + 1) % opts.length];
    if (next) galleryTheme.setTheme(next.id);
  };
  return (
    <Pressable onPress={cycle}>
      <S.AppBrandSwatch />
    </Pressable>
  );
}

// Tour banner — drops into the chrome's right cluster the moment onboarding
// completes (`tourStatus === 'pending'`). Coordinates with the home page's
// entry timeline: the banner waits until the carryover has cleared and the
// home content is settling in, then fades in. Yes/No flip `tourStatus` and
// the banner unmounts (no exit animation — the answer is the action).
const TOUR_BANNER_FADE_DELAY_MS = 1400; // matches HomeEntry T_FADE_END
const TOUR_BANNER_FADE_MS       = 500;

function TourBanner({ onAccept, onDecline }: { onAccept: () => void; onDecline: () => void }) {
  const tl = useAnimationTimeline();
  const op = tl.range(TOUR_BANNER_FADE_DELAY_MS, TOUR_BANNER_FADE_DELAY_MS + TOUR_BANNER_FADE_MS);
  return (
    <S.AppChromeTourBanner style={{ opacity: op, marginTop: (1 - op) * 4 }}>
      <S.AppChromeTourText>Would you like a tour around?</S.AppChromeTourText>
      <S.AppChromeTourActions>
        <S.AppChromeTourYes onPress={onAccept}>
          <S.AppChromeTourYesLabel>Yes</S.AppChromeTourYesLabel>
        </S.AppChromeTourYes>
        <S.AppChromeTourNo onPress={onDecline}>
          <S.AppChromeTourNoLabel>No</S.AppChromeTourNoLabel>
        </S.AppChromeTourNo>
      </S.AppChromeTourActions>
    </S.AppChromeTourBanner>
  );
}

function Chrome() {
  const onb = useOnboarding();
  const bp = useBreakpoint();
  const onboardingActive = !onb.loading && !onb.complete;
  const showTour = !onboardingActive && onb.tourStatus === 'pending';
  // At `sm` the chrome reduces & hides the secondary affordances. Brand
  // identity, step cubes (during onboarding), and window controls stay;
  // the cart/app sub-line, route nav row, and tour banner all tuck away
  // until a hamburger / bell sheet lands. Step cubes are kept because
  // they're load-bearing during onboarding — losing them mid-flow would
  // strand the user.
  const compact = bp === 'sm';

  return (
    <S.AppChrome windowDrag={true}>
      <S.AppChromeBrandRow>
        <ThemeSwatch />
        <S.AppBrandTitle>App</S.AppBrandTitle>
        {compact ? null : <S.AppBrandSub>cart/app</S.AppBrandSub>}
      </S.AppChromeBrandRow>

      <S.AppChromeRightCluster>
        {showTour && !compact ? (
          <TourBanner onAccept={onb.acceptTour} onDecline={onb.declineTour} />
        ) : null}
        {onboardingActive ? (
          <StepCubes step={onb.step} total={onb.totalSteps} onPress={onb.setStep} />
        ) : compact ? null : (
          <S.AppChromeNavRow>
            {ROUTES.map((r) => (
              <NavLink key={r.path} path={r.path} label={r.label} icon={r.icon} />
            ))}
          </S.AppChromeNavRow>
        )}
        {compact && !onboardingActive ? null : <S.AppChromeDivider />}
        <S.AppWindowBtn onPress={() => callHost<void>('__window_minimize', undefined as any)}>
          <S.AppWindowBtnIcon icon={Minimize} />
        </S.AppWindowBtn>
        <S.AppWindowBtn onPress={() => callHost<void>('__window_maximize', undefined as any)}>
          <S.AppWindowBtnIcon icon={Maximize} />
        </S.AppWindowBtn>
        <S.AppWindowBtn onPress={() => callHost<void>('__window_close', undefined as any)}>
          <S.AppWindowBtnIconClose icon={X} />
        </S.AppWindowBtn>
      </S.AppChromeRightCluster>
    </S.AppChrome>
  );
}

// Wires the IFTTT bus to the router. The InputStrip (and, eventually, the
// router model + supervisor session) all fire `app:navigate` on the bus —
// this is the single subscriber that converts those into actual route
// pushes. Mounted under <Router> so useNavigate() resolves.
function NavigationBus() {
  const nav = useNavigate();
  useIFTTT('app:navigate', (path: any) => {
    if (typeof path === 'string' && path.startsWith('/')) nav.push(path);
  });
  return null;
}

// Strip is gated on onboarding completion — surfacing it during the
// step-driven flow would fight the onboarding pages. When hidden, returns
// null so the slot containers render empty.
function ConditionalInputStrip() {
  const onb = useOnboarding();
  if (onb.loading || !onb.complete) return null;
  return <InputStrip />;
}

// Chat is gated on the same onboarding completion check, plus the shape
// derivation from `headingTo`. Hidden on home (state A); 'side' when
// docked above the side InputStrip (state B); 'full' when filling the
// activity content area (state C). Thread state survives the slot swap
// via the module-level store in `chat/store.ts`.
function ConditionalAssistantChat({
  shape,
  onToggleShape,
}: {
  shape: ChatShape;
  onToggleShape?: () => void;
}) {
  const onb = useOnboarding();
  if (onb.loading || !onb.complete) return null;
  if (shape === 'hidden') return null;
  return <AssistantChat shape={shape} onToggleShape={onToggleShape} />;
}

// ── Morph constants + helpers ────────────────────────────────────────
//
// Two morphs, sequenced to avoid a flicker at the variant flip:
//
//   shrink (full → side):
//     Phase 1 (parallel, T ms):
//       - inputMorph 0→1 (input shrinks within BottomInputBar)
//       - sideMorph  0→1 (SideMenuInput grows in from left edge)
//     Variant flip — input moves to SideMenuInput, which is already at
//     SIDE_W width, so the input renders without a flicker. Page area
//     also reflows (BottomInputBar leaves the tree, page area gains
//     vertical space). The reflow is a snap; we don't try to animate
//     it because that would require knowing the bar's natural height
//     up front, which is the kind of fallback constant that breaks
//     when the bar's content changes.
//
//   expand (side → full):
//     Variant flip — BottomInputBar reappears in the tree at narrow
//     width (inputMorph still at 1). Page area retracts vertically to
//     make room (also a snap).
//     Phase 2 (parallel, T ms):
//       - inputMorph 1→0 (input expands to full width)
//       - sideMorph  1→0 (SideMenuInput shrinks back to 0)
//
// SIDE_W is the shared dock width — both AppSideMenuInput's max width
// and AppBottomInputBar's narrow-state width converge here so the
// variant flip is invisible.

const SIDE_W = 360;
const STRIP_TWEEN_MS = 600;

function nowMs(): number {
  const g: any = globalThis;
  return g?.performance?.now ? g.performance.now() : Date.now();
}

function getViewportW(): number {
  const g: any = globalThis;
  try {
    if (typeof g.__viewport_width === 'function') {
      const v = Number(g.__viewport_width()) || 0;
      if (v > 0) return v;
    }
  } catch { /* ignore */ }
  if (typeof g.innerWidth === 'number' && g.innerWidth > 0) return g.innerWidth;
  return 1280;
}

const easeMorph = (p: number) => (EASINGS as any).easeInOutCubic(p);

// Three resolved shell states. Derived from (active route's mode,
// inputFocal) — see deriveHeadingTo below. Each maps to a target
// triple (sideMorph, inputMorph, bottomMorph) plus a variant value
// that determines which slot hosts the input.
//
//   home              (route=full, focal=*) — A
//   activity-docked   (route=side, focal=false) — B
//   activity-focal    (route=side, focal=true)  — C

type HeadingTo = 'home' | 'activity-docked' | 'activity-focal';

const TARGETS: Record<HeadingTo, {
  side: number; input: number; bottom: number; variant: string | null;
}> = {
  'home':            { side: 0, input: 0, bottom: 0, variant: null   },
  'activity-docked': { side: 1, input: 1, bottom: 1, variant: 'side' },
  'activity-focal':  { side: 1, input: 0, bottom: 0, variant: null   },
};

function deriveHeadingTo(routeMode: RouteMode, focal: boolean): HeadingTo {
  if (routeMode === 'full') return 'home';
  return focal ? 'activity-focal' : 'activity-docked';
}

// Chat shape rides the same axes as the InputStrip morph. Hidden on
// home; 'side' docks above the side InputStrip; 'full' fills the
// activity content area above the bottom InputStrip.
function deriveChatShape(headingTo: HeadingTo): ChatShape {
  if (headingTo === 'home') return 'hidden';
  if (headingTo === 'activity-docked') return 'side';
  return 'full';
}

// All the shell-level hooks (useRoute, useActiveVariant, useInputFocal,
// the morph effect) MUST run inside <Router>'s subtree — useRoute
// looks up RouterContext and would never see updates if called from
// App itself, since App is what mounts the Router. Splitting App into
// a thin shell + ShellBody (the actual UI + state) is the standard
// fix for "I'm a Provider's parent and I want the Provider's hook".
function ShellBody() {
  // The variant store still tracks WHERE the input is rendered (which
  // slot has it). It lags `headingTo` because we flip it at the right
  // moment in the morph (start of TO-bar, end of TO-panel) — that
  // timing is what makes the swap visually invisible.
  const variant = useActiveVariant();
  const isSide = variant === 'side';

  // Resolved state derives from route + inputFocal. `headingTo` is
  // what we're morphing toward; the morph machinery transitions only
  // when this value actually changes (same-mode route navigations
  // stay in the same `headingTo` and don't fire the morph).
  const route = useRoute();
  const routeMode: RouteMode = ROUTES.find((r) => r.path === route.path)?.mode ?? 'full';
  // Some routes have an in-page sub-nav that's been promoted to the HUD
  // (settings: Profile/Preferences/Providers/…). When active, it
  // occupies a fixed-width rail beside the assistant rail and the
  // iframe content slot shrinks accordingly.
  const isSettings = route.path === '/settings';
  const subnavWidth = isSettings ? SETTINGS_NAV_W : 0;
  const [focal, setFocal] = useInputFocal();
  const headingTo = deriveHeadingTo(routeMode, focal);
  const chatShape = deriveChatShape(headingTo);

  // Three independent morph timelines — see the constants comment for
  // the sequencing. Each is a snapshot RAF tween that survives
  // mid-flight reversals.
  const inputTweenRef  = useRef<{ from: number; to: number; start: number }>({ from: 0, to: 0, start: 0 });
  const sideTweenRef   = useRef<{ from: number; to: number; start: number }>({ from: 0, to: 0, start: 0 });
  const bottomTweenRef = useRef<{ from: number; to: number; start: number }>({ from: 0, to: 0, start: 0 });
  const inputRafRef    = useRef<any>(null);
  const sideRafRef     = useRef<any>(null);
  const bottomRafRef   = useRef<any>(null);
  const [, force] = useState(0);
  const skippedFirstRef = useRef(false);

  useEffect(() => {
    if (!skippedFirstRef.current) {
      skippedFirstRef.current = true;
      return;
    }

    const g: any = globalThis;
    const sched = g.requestAnimationFrame ? g.requestAnimationFrame.bind(g) : (fn: any) => setTimeout(fn, 16);
    const cancel = g.cancelAnimationFrame ? g.cancelAnimationFrame.bind(g) : clearTimeout;

    function readMorph(ref: typeof inputTweenRef): number {
      const s = ref.current;
      const e = s.start === 0 ? STRIP_TWEEN_MS : nowMs() - s.start;
      const p = Math.min(1, e / STRIP_TWEEN_MS);
      return s.from + (s.to - s.from) * easeMorph(p);
    }
    function startTween(
      ref: typeof inputTweenRef,
      rafRef: typeof inputRafRef,
      toValue: number,
      onComplete?: () => void,
    ) {
      const current = readMorph(ref);
      ref.current = { from: current, to: toValue, start: nowMs() };
      if (rafRef.current) cancel(rafRef.current);
      const tick = () => {
        force((n) => (n + 1) | 0);
        const e = nowMs() - ref.current.start;
        if (e < STRIP_TWEEN_MS) {
          rafRef.current = sched(tick);
        } else {
          rafRef.current = null;
          if (onComplete) onComplete();
        }
      };
      rafRef.current = sched(tick);
    }

    // Pivot on the variant target. The variant flip is the moment the
    // input's React placement actually swaps containers. To make the
    // swap visually invisible:
    //   - going TO panel ('side'): morph "shrink" first (input width
    //     reaches SIDE_W in BottomInputBar; side panel reaches its
    //     target width), THEN flip variant so SideMenuInput hosts the
    //     input at the matching narrow width, THEN morph "grow"
    //     (page extends down via bottomMorph).
    //   - going TO bar (null): flip variant FIRST so BottomInputBar
    //     reappears at the input's current narrow paddingRight, THEN
    //     morph "shrink" (page retracts), THEN morph "grow" (input
    //     expands; side panel collapses if leaving activity entirely).
    //   - no variant change: state transition stays inside one slot
    //     (A↔C: only sideMorph; B→B: no-op). Just animate the deltas.
    //
    // The startTween calls are no-ops when from===to, so it's safe to
    // call them for morphs that don't need to change.
    const target = TARGETS[headingTo];
    const variantNeedsToBecomeSide = target.variant === 'side' && variant !== 'side';
    const variantNeedsToBecomeNull = target.variant === null   && variant === 'side';

    if (variantNeedsToBecomeSide) {
      // TO PANEL — input + side panel animate first; bottom waits for flip.
      startTween(sideTweenRef, sideRafRef, target.side);
      startTween(inputTweenRef, inputRafRef, target.input, () => {
        setVariant('side');
        startTween(bottomTweenRef, bottomRafRef, target.bottom);
      });
    } else if (variantNeedsToBecomeNull) {
      // TO BAR — variant flip + all morphs in PARALLEL. Sequencing
      // the bottom morph first (page retract) before the input morph
      // (expand) gave a visible 600ms delay before the input animated,
      // because the page-retract step is subtle and easy to miss.
      // BottomInputBar's bg covers the bottom strip area cleanly while
      // the page content retracts behind it, so they can overlap.
      setVariant(null);
      startTween(sideTweenRef, sideRafRef, target.side);
      startTween(inputTweenRef, inputRafRef, target.input);
      startTween(bottomTweenRef, bottomRafRef, target.bottom);
    } else {
      // No variant change. Just move each morph to its target — most
      // of these will be no-ops (e.g., A↔C only animates sideMorph).
      startTween(sideTweenRef, sideRafRef, target.side);
      startTween(inputTweenRef, inputRafRef, target.input);
      startTween(bottomTweenRef, bottomRafRef, target.bottom);
    }

    return () => {
      if (inputRafRef.current)  cancel(inputRafRef.current);
      if (sideRafRef.current)   cancel(sideRafRef.current);
      if (bottomRafRef.current) cancel(bottomRafRef.current);
    };
  }, [headingTo]);

  // Read each morph from its tween state.
  function readTween(ref: typeof inputTweenRef): number {
    const s = ref.current;
    const e = s.start === 0 ? STRIP_TWEEN_MS : nowMs() - s.start;
    const p = Math.min(1, e / STRIP_TWEEN_MS);
    return s.from + (s.to - s.from) * easeMorph(p);
  }
  const inputMorph  = readTween(inputTweenRef);
  const sideMorph   = readTween(sideTweenRef);
  const bottomMorph = readTween(bottomTweenRef);

  // Map morphs to slot dimensions.
  const vw = getViewportW();
  // paddingRight on AppBottomInputBar — input width shrinks/grows.
  const paddingRight = Math.max(0, inputMorph * (vw - SIDE_W));
  // SideMenuInput width grows in / shrinks out from the left edge.
  const sideWidth = sideMorph * SIDE_W;
  // Page area's bottom padding — reserves space for AppBottomInputBar
  // (= APP_BOTTOM_BAR_H, the classifier's height) when in full mode,
  // collapses to 0 in side mode. Animates so the page-extends-down /
  // page-retracts step is smooth.
  const paddingBottom = (1 - bottomMorph) * APP_BOTTOM_BAR_H;

  // Publish HUD insets so pages can apply matching internal padding
  // while keeping their backgrounds full-bleed. The bar paints
  // transparent over whatever the page rendered beneath it (no shell-
  // level color in the strip area), and the page's own padding keeps
  // its content above the bar's footprint. paddingLeft stays on the
  // routes wrapper for now (rail is opaque chrome — its bg fully
  // covers whatever the page paints behind it, no visible difference).
  setHudInsets(paddingBottom, 0);

  return (
    <Box style={{
      width: '100%', height: '100%',
      flexDirection: 'column', position: 'relative',
      backgroundColor: 'theme:bg',
    }}>
            <Chrome />
            {/* Below the chrome — a flex row with the side menu slot on
                the left (visible only when variant='side') and the page
                area on the right. The page area is its own flex column
                with routes + bottom input bar slot. */}
            {/* Page area — flex column with routes flex-growing and
                BottomInputBar as the natural-height bottom sibling.
                position:relative so SideMenuInput (the only absolute
                slot now) anchors here. Routes paddingLeft = sideWidth
                keeps content visible right of SideMenuInput; no
                paddingBottom — flex layout handles the vertical reflow
                automatically when BottomInputBar enters/leaves the
                tree on variant flip. */}
            {/* Page area — position:relative anchors the absolute
                slots. Routes content gets paddingLeft (= sideWidth) and
                paddingBottom (= APP_BOTTOM_BAR_H * (1 - bottomMorph))
                so it reflows around the slots without the slots ever
                pushing BottomInputBar's left edge — keeps the input
                anchored at x=0 throughout the morph. */}
            <Box style={{ flexGrow: 1, position: 'relative', flexDirection: 'column' }}>
              {/* Iframe wrapper — full-bleed in the bottom axis so each
                  page's bg paints all the way to the viewport bottom.
                  The bar overlays this area with a transparent bg, and
                  pages apply their own internal paddingBottom via
                  useHudInsets() to keep content above the bar's
                  footprint. paddingLeft stays here for the side rail
                  (rail is opaque chrome). */}
              <Box style={{
                flexGrow: 1,
                paddingLeft: sideWidth + subnavWidth,
              }}>
                <Route path="/">
                  <IndexPage />
                </Route>
                <Route path="/about">
                  <AboutPage />
                </Route>
                <Route path="/settings">
                  <SettingsPage />
                </Route>
                <Route path="/activity/sweatshop">
                  <SweatshopPage />
                </Route>
              </Box>
              {/* Page-level sub-nav HUD rail — sits to the right of
                  the assistant rail and to the left of the iframe.
                  Currently only /settings populates it. The iframe
                  paddingLeft above already reserves SETTINGS_NAV_W so
                  the page content clears it. */}
              {isSettings ? (
                <Box style={{
                  position: 'absolute', left: sideWidth, top: 0, bottom: 0,
                  width: SETTINGS_NAV_W,
                }}>
                  <SettingsNav />
                </Box>
              ) : null}
              {/* SideMenuInput — absolute overlay on the left.
                  Rendered FIRST so BottomInputBar overlays it in
                  z-order during phase 1 of shrink (input still in
                  BottomInputBar). The chat panel sits ABOVE the
                  InputStrip via flexGrow:1 on AppChatPanel; the rail's
                  justifyContent:'flex-end' still keeps InputStrip
                  pinned to the bottom. */}
              <S.AppSideMenuInput style={{
                position: 'absolute', left: 0, top: 0, bottom: 0, width: sideWidth,
              }}>
                {chatShape === 'side' ? (
                  <ConditionalAssistantChat shape="side" onToggleShape={() => setFocal(true)} />
                ) : null}
                {isSide ? <ConditionalInputStrip /> : null}
              </S.AppSideMenuInput>
              {/* Full-mode chat overlay — fills the activity content
                  area, leaves space for the side rail (left: sideWidth)
                  and the bottom InputStrip (bottom: paddingBottom). The
                  activity stays mounted underneath; we just cover it.
                  When focal releases (state C → B), this unmounts and
                  the activity surfaces again. */}
              {chatShape === 'full' ? (
                <Box style={{
                  position: 'absolute',
                  left: sideWidth, top: 0, right: 0,
                  bottom: paddingBottom,
                  paddingLeft: 24, paddingRight: 24,
                  paddingTop: 24, paddingBottom: 16,
                  flexDirection: 'column',
                }}>
                  <ConditionalAssistantChat shape="full" onToggleShape={() => setFocal(false)} />
                </Box>
              ) : null}
              {/* BottomInputBar — outer conditional removes it from the
                  tree when isSide. Inner display:'flex' is explicit
                  (avoids any framework ambiguity). Height comes from
                  the classifier (APP_BOTTOM_BAR_H, single source of
                  truth alongside the strip's own classifier definition). */}
              {isSide ? null : (
                <S.AppBottomInputBar style={{
                  position: 'absolute', left: 0, right: 0, bottom: 0,
                  paddingRight,
                  display: 'flex',
                  // Transparent so the bar's vacated area (right side
                  // grows during phase 1 of shrink) reveals whatever
                  // page bg is rendered beneath it. The classifier's
                  // theme:bg default forced a single color across the
                  // strip and clashed with multi-bg pages (/settings).
                  backgroundColor: 'theme:transparent',
                }}>
                  <ConditionalInputStrip />
                </S.AppBottomInputBar>
              )}
            </Box>
          </Box>
  );
}

// Thin App — just mounts the providers. All shell-level UI + state
// lives in <ShellBody>, which is INSIDE <Router> so its useRoute()
// call resolves to the live router context (not undefined).
export default function App() {
  return (
    <TooltipRoot>
      <OnboardingProvider>
        <Router initialPath="/">
          <NavigationBus />
          <ShellBody />
        </Router>
      </OnboardingProvider>
    </TooltipRoot>
  );
}
