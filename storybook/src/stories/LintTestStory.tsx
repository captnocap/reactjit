import React from 'react';
import { Box, Text, classifiers as S} from '../../../packages/core/src';
import { useThemeColors } from '../../../packages/theme/src';
import { StoryPage, StorySection } from './_shared/StoryScaffold';

export function LintTestStory() {
  const c = useThemeColors();

  return (
    <StoryPage>
      <StorySection index={1} title="Some boxes in a row">
        <S.RowG8 style={{ width: '100%' }}>
          <Box style={{ width: 60, height: 60, backgroundColor: '#3b82f6', borderRadius: 8 }}>
            <S.WhiteBody>A</S.WhiteBody>
          </Box>
          <Box style={{ width: 60, height: 60, backgroundColor: '#22c55e', borderRadius: 8 }}>
            <S.WhiteBody>B</S.WhiteBody>
          </Box>
          <Box style={{ width: 60, height: 60, backgroundColor: '#ef4444', borderRadius: 8 }}>
            <S.WhiteBody>C</S.WhiteBody>
          </Box>
        </S.RowG8>
      </StorySection>

      <StorySection index={2} title="Text content">
        <Text style={{ color: c.text, fontSize: 14 }}>Here is some text content</Text>
        <S.DimBody11>A subtitle underneath it</S.DimBody11>
        {/* rjit-ignore-next-line */}
        <Text style={{ color: c.text, fontSize: 12, width: '100%' }}>Full width text that should center</Text>
      </StorySection>

      <StorySection index={3} title="Mixed layout">
        <S.StackG8W100>
          <Text style={{ color: c.text, fontSize: 12 }}>Label above boxes</Text>
          <S.RowG6 style={{ width: '100%' }}>
            <Box style={{ flexGrow: 1, height: 40, backgroundColor: '#8b5cf6', borderRadius: 6 }}>
              <S.WhiteBody>Left</S.WhiteBody>
            </Box>
            <Box style={{ flexGrow: 1, height: 40, backgroundColor: '#f97316', borderRadius: 6 }}>
              <S.WhiteBody>Right</S.WhiteBody>
            </Box>
          </S.RowG6>
        </S.StackG8W100>
      </StorySection>
    </StoryPage>
  );
}
