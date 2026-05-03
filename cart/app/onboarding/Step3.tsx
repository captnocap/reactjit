import { useEffect, useRef, useState } from 'react';
import { classifiers as S } from '@reactjit/core';
import { SnakeSpinner } from '../gallery/components/grid-spinners/GridSpinners';
import { useAnimationTimeline } from '../anim';
import { useOnboarding } from './state.tsx';
import { TRAITS } from './traits';

// Carryover timeline (when user just came from step 2's exit transition).
const T_HOLD_END        = 500;
const T_THANKS_FADE_END = 1400;
const T_MAIN_IN_END     = 1950;
const T_MAIN_SLIDE_END  = 2450;
const T_TRAITS_IN_END   = 3050;
const T_BTN_IN_END      = 3450;

const SKIP_OFFSET = T_THANKS_FADE_END;
const SLIDE_UP_PX = 60;

// Exit timeline (forward-button click → step 4). Mirrors Step2's exit shape:
// fade everything out, fade in spinner + a branching "carryover" message.
// The message is picked at click time based on whether the user toggled
// any traits — opinionated copy on each branch.
const EXIT_TOTAL_MS    = 1900;
const EXIT_MENU_OUT    = [0,    380];
const EXIT_SPINNER_IN  = [190,  665];
const EXIT_MESSAGE_IN  = [570, 1235];

const EXIT_MSG_NO_SELECTION = "We get it, onboardings suck.";
const EXIT_MSG_HAS_SELECTION = "Somehow we already knew that about you...";

export default function Step3() {
  const onb = useOnboarding();
  // Carryover gate: if a provider was locked in last step, we're arriving
  // mid-transition with "Thanks for that" + spinner already visible. If the
  // user navigated here directly (via chrome cubes), skip the carryover.
  const hasThanks = !!onb.providerKind;

  const tl = useAnimationTimeline({ skip: !hasThanks, skipOffsetMs: SKIP_OFFSET });

  const thanksOp  = hasThanks ? tl.fadeOut(T_HOLD_END, T_THANKS_FADE_END) : 0;
  const mainOp    = tl.range(T_THANKS_FADE_END, T_MAIN_IN_END);
  const slideP    = tl.range(T_MAIN_IN_END, T_MAIN_SLIDE_END);
  const traitsOp  = tl.range(T_MAIN_SLIDE_END, T_TRAITS_IN_END);
  const btnOp     = tl.range(T_TRAITS_IN_END, T_BTN_IN_END);

  const traits = Array.isArray(onb.traits) ? onb.traits : [];
  const traitsRef = useRef(traits);
  traitsRef.current = traits;
  const onbRef = useRef(onb);
  onbRef.current = onb;

  const [exitStartT, setExitStartT] = useState(null);
  const [exitMessage, setExitMessage] = useState('');
  const exitStartTRef = useRef(null);
  exitStartTRef.current = exitStartT;

  useEffect(() => {
    if (exitStartT == null) return;
    const id = setTimeout(() => {
      try { onbRef.current.setStep(3); } catch {}
    }, EXIT_TOTAL_MS);
    return () => clearTimeout(id);
  }, [exitStartT]);

  function toggleTrait(id) {
    if (exitStartTRef.current != null) return;
    const cur = traitsRef.current;
    const next = cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id];
    try { onbRef.current.setTraits(next); } catch {}
  }

  function forward() {
    if (exitStartTRef.current != null) return;
    const liveTraits = traitsRef.current;
    const msg = liveTraits.length > 0 ? EXIT_MSG_HAS_SELECTION : EXIT_MSG_NO_SELECTION;
    setExitMessage(msg);
    setExitStartT(tl.tRef.current);
  }

  function takeMeBack() {
    if (exitStartTRef.current != null) return;
    try { onbRef.current.setStep(1); } catch {}
  }

  const hasSelection = traits.length > 0;
  const forwardLabel = hasSelection ? 'Next' : "I'd rather not say";

  const exitMenuOut    = exitStartT != null ? tl.range(exitStartT + EXIT_MENU_OUT[0],   exitStartT + EXIT_MENU_OUT[1])   : 0;
  const exitSpinnerIn  = exitStartT != null ? tl.range(exitStartT + EXIT_SPINNER_IN[0], exitStartT + EXIT_SPINNER_IN[1]) : 0;
  const exitMessageIn  = exitStartT != null ? tl.range(exitStartT + EXIT_MESSAGE_IN[0], exitStartT + EXIT_MESSAGE_IN[1]) : 0;
  const menuOpacityMul = 1 - exitMenuOut;

  return (
    <S.AppStepFrame>
      {/* Carryover "Thanks for that" (centered) */}
      {hasThanks && thanksOp > 0.001 && (
        <S.AppStepCenter style={{ opacity: thanksOp }}>
          <S.AppGreet>Thanks for that</S.AppGreet>
        </S.AppStepCenter>
      )}

      {/* Carryover spinner (bottom-right) */}
      {hasThanks && thanksOp > 0.001 && (
        <S.AppStepBottomRight style={{ opacity: thanksOp }}>
          <SnakeSpinner />
        </S.AppStepBottomRight>
      )}

      {/* Main: prompt + trait grid */}
      <S.AppStepCenterCol
        style={{
          gap: 28,
          paddingLeft: 24, paddingRight: 24,
          opacity: mainOp * menuOpacityMul,
          marginTop: -slideP * SLIDE_UP_PX,
        }}
      >
        <S.AppPromptText>Let's get to know you a bit more</S.AppPromptText>

        <S.AppStepDimmable style={{ opacity: traitsOp, marginTop: (1 - traitsOp) * 12, maxWidth: 720 }}>
          <S.AppTraitGrid>
            {TRAITS.map((t) => {
              const active = traits.includes(t.id);
              const Chip = active ? S.AppTraitChipActive : S.AppTraitChip;
              const ChipText = active ? S.AppTraitChipTextActive : S.AppTraitChipText;
              return (
                <Chip key={t.id} onPress={() => toggleTrait(t.id)}>
                  <ChipText>{t.label}</ChipText>
                </Chip>
              );
            })}
          </S.AppTraitGrid>
        </S.AppStepDimmable>
      </S.AppStepCenterCol>

      {/* Take me back (bottom-left) */}
      <S.AppStepBottomLeft style={{ opacity: btnOp * menuOpacityMul }}>
        <S.ButtonOutline onPress={takeMeBack}>
          <S.ButtonOutlineLabel>Take me back!</S.ButtonOutlineLabel>
        </S.ButtonOutline>
      </S.AppStepBottomLeft>

      {/* Forward (bottom-right) — label flips on first selection.
          "I'd rather not say" → "Next" once any trait is toggled on. */}
      <S.AppStepBottomRight style={{ opacity: btnOp * menuOpacityMul }}>
        {hasSelection ? (
          <S.Button onPress={forward}>
            <S.ButtonLabel>{forwardLabel}</S.ButtonLabel>
          </S.Button>
        ) : (
          <S.ButtonOutline onPress={forward}>
            <S.ButtonOutlineLabel>{forwardLabel}</S.ButtonOutlineLabel>
          </S.ButtonOutline>
        )}
      </S.AppStepBottomRight>

      {/* Exit message (centered) — branches by `exitMessage` captured at
          the click moment. "We get it…" if no traits, "Somehow we already
          knew…" if any. Carries through to step 4 mount. */}
      {exitStartT != null ? (
        <S.AppStepCenter
          style={{
            paddingLeft: 24, paddingRight: 24,
            opacity: exitMessageIn,
            marginTop: (1 - exitMessageIn) * 8,
          }}
        >
          <S.AppExitMessage>{exitMessage}</S.AppExitMessage>
        </S.AppStepCenter>
      ) : null}

      {/* Exit spinner (bottom-right) — fades in alongside the message. */}
      {exitStartT != null ? (
        <S.AppStepBottomRight style={{ opacity: exitSpinnerIn }}>
          {exitSpinnerIn > 0.001 ? <SnakeSpinner /> : null}
        </S.AppStepBottomRight>
      ) : null}
    </S.AppStepFrame>
  );
}
