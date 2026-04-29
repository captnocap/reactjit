import { useEffect, useRef, useState } from 'react';
import { Box } from '@reactjit/runtime/primitives';
import { classifiers as S } from '@reactjit/core';
import Onboarding from './onboarding/Onboarding';
import { useOnboarding } from './onboarding/state';
import { SnakeSpinner } from '../component-gallery/components/grid-spinners/GridSpinners';
import { useAnimationTimeline } from './anim';

// Carryover entry timeline (when home mounts immediately after Step5 hits
// markComplete()). Picks up exactly where Step5's exit left off — "Welcome
// aboard." centered + spinner bottom-right at full opacity — then crossfades
// into the home content.
const T_HOLD_END    = 500;
const T_FADE_END    = 1400;
const T_HOME_IN_END = 1950;

const SLIDE_UP_PX = 40;

const ENTRY_DONE_MS = T_HOME_IN_END + 80;

export default function IndexPage() {
  const onb = useOnboarding();
  if (onb.loading) return null;

  if (!onb.complete) {
    return (
      <Onboarding
        step={onb.step}
        animate={onb.shouldPlayFirstStartAnimation}
        onAnimationDone={onb.markFirstStartAnimationPlayed}
      />
    );
  }

  if (!onb.homeEntryPlayed) return <HomeEntry />;
  return <HomeStatic />;
}

// First-mount-after-onboarding render. Carries the Step5 exit final frame in
// (welcome message + spinner) and dissolves it into the home card. After the
// timeline finishes we flip `homeEntryPlayed` so re-mounts (route revisits)
// render <HomeStatic /> directly.
function HomeEntry() {
  const onb = useOnboarding();
  const tl = useAnimationTimeline();

  const carryOp  = tl.fadeOut(T_HOLD_END, T_FADE_END);
  const homeOp   = tl.range(T_FADE_END, T_HOME_IN_END);
  const homeSlide = tl.range(T_FADE_END, T_HOME_IN_END);

  const onbRef = useRef(onb);
  onbRef.current = onb;

  useEffect(() => {
    const id = setTimeout(() => {
      try { onbRef.current.markHomeEntryPlayed(); } catch {}
    }, ENTRY_DONE_MS);
    return () => clearTimeout(id);
  }, []);

  return (
    <S.Page>
      <S.AppStepFrame>
        {/* Carryover "Welcome aboard." */}
        {carryOp > 0.001 ? (
          <S.AppStepCenter style={{ opacity: carryOp }}>
            <S.AppGreet>Welcome aboard.</S.AppGreet>
          </S.AppStepCenter>
        ) : null}

        {/* Carryover spinner — same anchor Step5 used. */}
        {carryOp > 0.001 ? (
          <S.AppStepBottomRight style={{ opacity: carryOp }}>
            <SnakeSpinner />
          </S.AppStepBottomRight>
        ) : null}

        {/* Home content fades in over the cleared frame. */}
        <Box
          style={{
            flexGrow: 1,
            alignItems: 'center', justifyContent: 'center',
            opacity: homeOp,
            marginTop: (1 - homeSlide) * SLIDE_UP_PX,
          }}
        >
          <S.Card>
            <S.Title>Home</S.Title>
            <S.Body>cart/app/page.jsx</S.Body>
          </S.Card>
        </Box>
      </S.AppStepFrame>
    </S.Page>
  );
}

function HomeStatic() {
  return (
    <S.Page>
      <Box style={{ flexGrow: 1, alignItems: 'center', justifyContent: 'center' }}>
        <S.Card>
          <S.Title>Home</S.Title>
          <S.Body>cart/app/page.jsx</S.Body>
        </S.Card>
      </Box>
    </S.Page>
  );
}
