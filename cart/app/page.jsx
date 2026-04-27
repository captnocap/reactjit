import { Box } from '@reactjit/runtime/primitives';
import { classifiers as S } from '@reactjit/core';
import Onboarding from './onboarding/Onboarding';
import { useOnboarding } from './onboarding/state';

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
