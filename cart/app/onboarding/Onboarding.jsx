import { Box } from '../../../runtime/primitives';
import { classifiers as S } from '@reactjit/core';
import FirstStep from './FirstStep';
import Step2 from './Step2';
import Step3 from './Step3';

const GENERIC_STEPS = [
  null, // step 0 = FirstStep
  null, // step 1 = Step2
  null, // step 2 = Step3
  { title: 'Step 4', body: 'Step 4 placeholder.' },
  { title: 'Step 5', body: 'Step 5 placeholder.' },
];

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

  const cur = GENERIC_STEPS[step] ?? { title: '', body: '' };
  return (
    <S.Page>
      <Box style={{ flexGrow: 1, alignItems: 'center', justifyContent: 'center' }}>
        <S.Card>
          <S.Caption>{`Step ${step + 1} of ${GENERIC_STEPS.length}`}</S.Caption>
          <S.Title>{cur.title}</S.Title>
          <S.Body>{cur.body}</S.Body>
        </S.Card>
      </Box>
    </S.Page>
  );
}
