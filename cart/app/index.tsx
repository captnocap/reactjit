import '../component-gallery/components.cls';
import { Box } from '@reactjit/runtime/primitives';
import { Route, Router, useNavigate, useRoute } from '@reactjit/runtime/router';
import { installBrowserShims } from '@reactjit/runtime/hooks';
import { TooltipRoot } from '../shared/tooltip/Tooltip';
import { Home, Info, Maximize, Minimize, X } from '@reactjit/runtime/icons/icons';
import { callHost } from '@reactjit/runtime/ffi';
import { applyGalleryTheme, getActiveGalleryThemeId } from '../component-gallery/gallery-theme';
import { classifiers as S } from '@reactjit/core';
import IndexPage from './page';
import AboutPage from './about/page';
import { OnboardingProvider, useOnboarding } from './onboarding/state';
import { useAnimationTimeline } from './anim';

applyGalleryTheme(getActiveGalleryThemeId());
installBrowserShims();

const ROUTES = [
  { path: '/', label: 'Home', icon: Home },
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
  const onboardingActive = !onb.loading && !onb.complete;
  const showTour = !onboardingActive && onb.tourStatus === 'pending';

  return (
    <S.AppChrome windowDrag={true}>
      <S.AppChromeBrandRow>
        <S.AppBrandSwatch />
        <S.AppBrandTitle>App</S.AppBrandTitle>
        <S.AppBrandSub>cart/app</S.AppBrandSub>
      </S.AppChromeBrandRow>

      <S.AppChromeRightCluster>
        {showTour ? (
          <TourBanner onAccept={onb.acceptTour} onDecline={onb.declineTour} />
        ) : null}
        {onboardingActive ? (
          <StepCubes step={onb.step} total={onb.totalSteps} onPress={onb.setStep} />
        ) : (
          <S.AppChromeNavRow>
            {ROUTES.map((r) => (
              <NavLink key={r.path} path={r.path} label={r.label} icon={r.icon} />
            ))}
          </S.AppChromeNavRow>
        )}
        <S.AppChromeDivider />
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

export default function App() {
  return (
    <TooltipRoot>
      <OnboardingProvider>
        <Router initialPath="/">
          <Box style={{ width: '100%', height: '100%', flexDirection: 'column' }}>
            <Chrome />
            <Box style={{ flexGrow: 1 }}>
              <Route path="/">
                <IndexPage />
              </Route>
              <Route path="/about">
                <AboutPage />
              </Route>
            </Box>
          </Box>
        </Router>
      </OnboardingProvider>
    </TooltipRoot>
  );
}
