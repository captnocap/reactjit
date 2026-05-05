import { Box } from '@reactjit/runtime/primitives';
import { classifiers as S } from '@reactjit/core';
import { useHudInsets } from '../shell';

export default function AboutPage() {
  const insets = useHudInsets();
  return (
    <S.Page>
      <Box style={{
        flexGrow: 1, alignItems: 'center', justifyContent: 'center',
        paddingBottom: insets.bottom,
      }}>
        <S.Card>
          <S.Title>About</S.Title>
          <S.Body>cart/app/about/page.jsx</S.Body>
        </S.Card>
      </Box>
    </S.Page>
  );
}
