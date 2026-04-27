import { useEffect, useRef, useState } from 'react';
import { classifiers as S } from '@reactjit/core';
import { SnakeSpinner } from '../../component-gallery/components/grid-spinners/GridSpinners';
import { useAnimationTimeline } from '../anim';
import { useOnboarding } from './state';

const FADE_MS = 500;
const STAGGER_MS = 700;
const ENTRY_DELAY_MS = 80;
const HELLO_IN    = [ENTRY_DELAY_MS,                   ENTRY_DELAY_MS                   + FADE_MS];
const QUESTION_IN = [ENTRY_DELAY_MS + STAGGER_MS,      ENTRY_DELAY_MS + STAGGER_MS      + FADE_MS];
const INPUT_IN    = [ENTRY_DELAY_MS + 2 * STAGGER_MS,  ENTRY_DELAY_MS + 2 * STAGGER_MS  + FADE_MS];
const BUTTONS_IN  = [INPUT_IN[1],                       INPUT_IN[1]                       + FADE_MS];
const TOTAL_ANIMATION_MS = BUTTONS_IN[1] + 80;

// Exit-transition timeline (Next / Skip click). Uses absolute ms ranges
// against the same timeline clock as the other onboarding steps.
const EXIT_TOTAL_MS = 1900;
const EXIT_BUTTONS_OUT = [0, 342];      // buttons fade out
const EXIT_SPINNER_IN  = [190, 608];    // spinner fades in
const EXIT_CENTER_OUT  = [380, 912];    // center text + input fade out
const EXIT_GREET_IN    = [1045, 1482];  // "Nice to meet you {name}" fades in

const COL_SHIFT_PHASE_0 = 94;
const COL_SHIFT_PHASE_1 = 54;
const COL_SHIFT_PHASE_2 = 0;

export default function FirstStep({ animate, onAnimationDone }) {
  const onb = useOnboarding();
  const [name, setName] = useState('');
  const handleNameChange = (...args) => {
    const first = args[0];
    if (typeof first === 'string') {
      setName(first);
    } else if (first && typeof first === 'object' && typeof first.text === 'string') {
      setName(first.text);
    }
  };
  const safeName = typeof name === 'string' ? name : '';
  const trimmedName = safeName.trim();
  const hasName = trimmedName.length > 0;

  // Refs to dodge the renderer's stale-closure trap on Pressable.onPress.
  const nameRef = useRef(safeName);
  nameRef.current = safeName;
  const exitingRef = useRef(null);
  const onbRef = useRef(onb);
  onbRef.current = onb;

  // Entry timeline — one master clock for hello → question → input → buttons.
  const entry = useAnimationTimeline();
  const helloP    = entry.range(HELLO_IN[0],    HELLO_IN[1]);
  const questionP = entry.range(QUESTION_IN[0], QUESTION_IN[1]);
  const inputP    = entry.range(INPUT_IN[0],    INPUT_IN[1]);
  const buttonsP  = entry.range(BUTTONS_IN[0],  BUTTONS_IN[1]);

  const hOp = animate ? helloP : 1;
  const qOp = animate ? questionP : 1;
  const iOp = animate ? inputP : 1;
  const bOp = animate ? buttonsP : 1;

  useEffect(() => {
    if (!animate) return;
    const id = setTimeout(() => onAnimationDone?.(), TOTAL_ANIMATION_MS);
    return () => clearTimeout(id);
  }, [animate]);

  // Exit transition dispatch. A click stores exitStartT; this timer advances
  // step after EXIT_TOTAL_MS while rendered opacities come from entry.range().
  const [exiting, setExiting] = useState(null); // null | 'next' | 'skip'
  const [exitStartT, setExitStartT] = useState(null);

  useEffect(() => {
    if (!exiting || exitStartT == null) return;
    const id = setTimeout(() => {
      const liveName = typeof nameRef.current === 'string' ? nameRef.current.trim() : '';
      const advanceTo = onbRef.current.step + 1;
      (async () => {
        // Keep write ordering (name before step), but never let a slow write
        // stall the step transition indefinitely.
        if (liveName.length > 0) {
          try {
            await Promise.race([
              onbRef.current.setName(liveName),
              new Promise((resolve) => setTimeout(resolve, 400)),
            ]);
          } catch {}
        }
        try {
          if (exiting === 'next' || exiting === 'skip') await onbRef.current.setStep(advanceTo);
        } catch (e) {
          console.log('[fs] setStep threw: ' + (e && e.message ? e.message : String(e)));
        }
      })();
      if (exiting === 'skip') {
        console.log('[onboarding] skip dispatched — flip to skipped mode when locked in');
      }
    }, EXIT_TOTAL_MS);
    return () => clearTimeout(id);
  }, [exiting, exitStartT]);

  const colShift = animate
    ? Math.max(0, COL_SHIFT_PHASE_0
        - (COL_SHIFT_PHASE_0 - COL_SHIFT_PHASE_1) * qOp
        - (COL_SHIFT_PHASE_1 - COL_SHIFT_PHASE_2) * iOp)
    : 0;

  const exitButtonsOut = exitStartT != null ? entry.range(exitStartT + EXIT_BUTTONS_OUT[0], exitStartT + EXIT_BUTTONS_OUT[1]) : 0;
  const exitSpinnerIn  = exitStartT != null ? entry.range(exitStartT + EXIT_SPINNER_IN[0],  exitStartT + EXIT_SPINNER_IN[1])  : 0;
  const exitCenterOut  = exitStartT != null ? entry.range(exitStartT + EXIT_CENTER_OUT[0],  exitStartT + EXIT_CENTER_OUT[1])  : 0;
  const exitGreetIn    = exitStartT != null ? entry.range(exitStartT + EXIT_GREET_IN[0],    exitStartT + EXIT_GREET_IN[1])    : 0;

  const centerOpacityMul = 1 - exitCenterOut;
  const buttonOpacityMul = 1 - exitButtonsOut;

  function onNext() {
    const liveName = typeof nameRef.current === 'string' ? nameRef.current.trim() : '';
    if (!liveName.length || exitingRef.current) return;
    exitingRef.current = 'next';
    setExiting('next');
    setExitStartT(entry.tRef.current);
  }

  function onSkip() {
    const liveName = typeof nameRef.current === 'string' ? nameRef.current.trim() : '';
    if (!liveName.length || exitingRef.current) return;
    exitingRef.current = 'skip';
    setExiting('skip');
    setExitStartT(entry.tRef.current);
  }

  return (
    <S.AppStepFrame>
      {/* Centered Hello / question / input — fades out on exit. */}
      <S.AppStepCenterCol style={{ marginTop: colShift, gap: 18 }}>
        <S.AppHello style={{ opacity: hOp * centerOpacityMul, marginTop: (1 - hOp) * 8 }}>
          Hello
        </S.AppHello>
        <S.AppQuestion style={{ opacity: qOp * centerOpacityMul, marginTop: (1 - qOp) * 8 }}>
          what is your name?
        </S.AppQuestion>
        <S.AppNameInput
          value={safeName}
          onChange={handleNameChange}
          onSubmit={onNext}
          placeholder=""
          style={{ opacity: iOp * centerOpacityMul, marginTop: (1 - iOp) * 8 }}
        />
      </S.AppStepCenterCol>

      {/* "Nice to meet you {name}" — fades in over the cleared center on exit. */}
      <S.AppStepCenter style={{ opacity: exitGreetIn, marginTop: (1 - exitGreetIn) * 8 }}>
        <S.AppGreet>{`Nice to meet you ${trimmedName}`}</S.AppGreet>
      </S.AppStepCenter>

      {/* Buttons — bottom-right corner, independent absolute anchor so a
          sibling spinner with its own anchor can't shift them. */}
      <S.AppStepBottomRightRow style={{ opacity: bOp * buttonOpacityMul, marginTop: (1 - bOp) * 8 }}>
        <S.AppStepDimmable style={{ opacity: hasName ? 1 : 0.35 }}>
          <S.ButtonOutline onPress={onSkip}>
            <S.ButtonOutlineLabel>Skip onboarding</S.ButtonOutlineLabel>
          </S.ButtonOutline>
        </S.AppStepDimmable>
        <S.AppStepDimmable style={{ opacity: hasName ? 1 : 0.35 }}>
          <S.Button onPress={onNext}>
            <S.ButtonLabel>Next</S.ButtonLabel>
          </S.Button>
        </S.AppStepDimmable>
      </S.AppStepBottomRightRow>

      {/* Spinner — bare 3×3 grid, same bottom-right slot. Cross-fades with the
          buttons during the exit transition. */}
      <S.AppStepBottomRight style={{ opacity: exitSpinnerIn }}>
        {exitSpinnerIn > 0.001 ? <SnakeSpinner /> : null}
      </S.AppStepBottomRight>
    </S.AppStepFrame>
  );
}
