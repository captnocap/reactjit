import '../component-gallery/components.cls';
import { APP_BOTTOM_BAR_H } from '../component-gallery/components.cls';
import { useEffect, useRef, useState } from 'react';
import { EASINGS } from '@reactjit/runtime/easing';
import { Box, Pressable, Text } from '@reactjit/runtime/primitives';
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
import SettingsPage from './settings/page';
import { OnboardingProvider, useOnboarding } from './onboarding/state';
import { useAnimationTimeline } from './anim';
import { InputStrip } from './InputStrip';

applyGalleryTheme(getActiveGalleryThemeId());
installBrowserShims();

const ROUTES = [
  { path: '/', label: 'Home', icon: Home },
  { path: '/settings', label: 'Settings', icon: Settings },
  { path: '/about', label: 'About', icon: Info },
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

export default function App() {
  // Layout variant lives in the global theme store. AppBottomInputBar
  // and AppSideMenuInput's classifier variants (`side`) flip their
  // visibility based on this. We DON'T flip variant at click time —
  // we flip it at the END of the morph (or BEGINNING of the reverse
  // morph) so the visible container always matches the morphed shape.
  const variant = useActiveVariant();
  const isSide = variant === 'side';

  // `headingTo` is the user's intent — what we're morphing toward.
  // Stays in sync with variant most of the time, but can lead it
  // mid-tween (full→side: heading is 'side', variant is still null
  // until the shrink finishes; side→full: heading is 'full', variant
  // flips to null immediately so AppBottomInputBar appears narrow at
  // current paddingRight, then expands).
  const [headingTo, setHeadingTo] = useState<'full' | 'side'>('full');
  const toggleStrip = () => setHeadingTo((p) => (p === 'side' ? 'full' : 'side'));

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

    if (headingTo === 'side') {
      // Phase 1 (parallel): input shrinks AND side menu grows. Same
      // duration so they finish together; attach the variant flip to
      // the input's tween.
      startTween(sideTweenRef, sideRafRef, 1);
      startTween(inputTweenRef, inputRafRef, 1, () => {
        setVariant('side');
        // Phase 2: page extends downward (paddingBottom shrinks).
        startTween(bottomTweenRef, bottomRafRef, 1);
      });
    } else {
      // Phase 1: page retracts vertically (paddingBottom grows back).
      startTween(bottomTweenRef, bottomRafRef, 0, () => {
        setVariant(null);
        // Phase 2 (parallel): input expands AND side menu shrinks.
        startTween(sideTweenRef, sideRafRef, 0);
        startTween(inputTweenRef, inputRafRef, 0);
      });
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
  return (
    <TooltipRoot>
      <OnboardingProvider>
        <Router initialPath="/">
          <NavigationBus />
          <Box style={{
            width: '100%', height: '100%',
            flexDirection: 'column', position: 'relative',
            // Match the page bg so the area BottomInputBar vacates
            // (between variant flip and the page's paddingBottom
            // animation catching up) doesn't reveal a different bg
            // underneath. Without this the empty bottom strip flashes
            // the app's default bg color during phase 2 of shrink.
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
              <Box style={{
                flexGrow: 1,
                paddingLeft: sideWidth,
                paddingBottom: paddingBottom,
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
              </Box>
              {/* SideMenuInput — absolute overlay on the left.
                  Rendered FIRST so BottomInputBar overlays it in
                  z-order during phase 1 of shrink (input still in
                  BottomInputBar). */}
              <S.AppSideMenuInput style={{
                position: 'absolute', left: 0, top: 0, bottom: 0, width: sideWidth,
              }}>
                {isSide ? <ConditionalInputStrip /> : null}
              </S.AppSideMenuInput>
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
                }}>
                  <ConditionalInputStrip />
                </S.AppBottomInputBar>
              )}
            </Box>
            {/* Toggle overlay — temporary affordance until the real
                trigger lands (clicking into an app, sending a message,
                etc.). Anchored to the App's outer Box via
                position:relative + position:absolute. */}
            <Box style={{ position: 'absolute', top: 60, left: 60, zIndex: 100 }}>
              <Pressable onPress={toggleStrip}>
                <Box style={{
                  paddingLeft: 18, paddingRight: 18, paddingTop: 10, paddingBottom: 10,
                  borderRadius: 8,
                  backgroundColor: 'theme:accentHot',
                  borderWidth: 2, borderColor: 'theme:accentHot',
                }}>
                  <Text style={{ fontSize: 14, fontWeight: 700, color: 'theme:bg' }}>
                    {isSide ? 'BACK → BOTTOM' : 'SWAP → SIDE'}
                  </Text>
                </Box>
              </Pressable>
            </Box>
          </Box>
        </Router>
      </OnboardingProvider>
    </TooltipRoot>
  );
}
