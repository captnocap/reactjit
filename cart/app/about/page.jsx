import { Box } from '../../../runtime/primitives';
import { classifiers as S } from '@reactjit/core';

export default function AboutPage() {
  return (
    <S.Page>
      <Box style={{ flexGrow: 1, alignItems: 'center', justifyContent: 'center' }}>
        <S.Card>
          <S.Title>About</S.Title>
          <S.Body>cart/app/about/page.jsx</S.Body>
        </S.Card>
      </Box>
    </S.Page>
  );
}
