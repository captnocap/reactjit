import { Box } from '@reactjit/runtime/primitives';
import { classifiers as S } from '@reactjit/core';
import { useHudInsets } from '../shell';
import TestsPanel from './tests';

export default function AboutPage() {
  const insets = useHudInsets();
  return (
    <S.Page>
      <Box style={{
        flexGrow: 1,
        paddingLeft: 32, paddingRight: 32,
        paddingTop: 24,
        paddingBottom: 24 + insets.bottom,
        gap: 24,
        flexDirection: 'column',
      }}>
        <S.Card>
          <S.Title>About</S.Title>
          <S.Body>cart/app/about/page.tsx</S.Body>
        </S.Card>

        <TestsPanel />
      </Box>
    </S.Page>
  );
}
