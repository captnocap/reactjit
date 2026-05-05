// About route — onboarding state, version, reset.
// Pass-1 scaffold: shows onboarding step. Reset buttons land pass-2.

import { classifiers as S } from '@reactjit/core';
import { Box } from '@reactjit/runtime/primitives';
import { Section } from '../shared';
import { useOnboarding } from '../../onboarding/state';

export default function AboutRoute() {
  const onb = useOnboarding();
  return (
    <Section caption="App" title="About">
      <S.Card>
        <Box style={{ flexDirection: 'column', gap: 6 }}>
          <S.Body>Onboarding step: {onb?.step ?? '—'}</S.Body>
          <S.Body>Onboarding complete: {onb?.complete ? 'yes' : 'no'}</S.Body>
        </Box>
      </S.Card>
    </Section>
  );
}
