import { Box } from '@reactjit/runtime/primitives';
import { classifiers as S } from '@reactjit/core';
import FirstStep from './FirstStep.tsx';
import Step2 from './Step2.tsx';
import Step3 from './Step3.tsx';
import Step4 from './Step4.tsx';
import Step5 from './Step5.tsx';

export default function Onboarding({ step, animate, onAnimationDone }) {
  if (step === 0) {
    return (
      <S.Page>
        <FirstStep animate={animate} onAnimationDone={onAnimationDone} />
      </S.Page>
    );
  }

  if (step === 1) {
    return (
      <S.Page>
        <Step2 />
      </S.Page>
    );
  }

  if (step === 2) {
    return (
      <S.Page>
        <Step3 />
      </S.Page>
    );
  }

  if (step === 3) {
    return (
      <S.Page>
        <Step4 />
      </S.Page>
    );
  }

  if (step === 4) {
    return (
      <S.Page>
        <Step5 />
      </S.Page>
    );
  }

  return (
    <S.Page>
      <Box style={{ flexGrow: 1, alignItems: 'center', justifyContent: 'center' }}>
        <S.Card>
          <S.Caption>{`Step ${step + 1}`}</S.Caption>
          <S.Title>Out of range</S.Title>
          <S.Body>No screen registered for this step index.</S.Body>
        </S.Card>
      </Box>
    </S.Page>
  );
}
