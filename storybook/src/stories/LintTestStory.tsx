import React from 'react';
import { Box, Text } from '../../../packages/core/src';
import { useThemeColors } from '../../../packages/theme/src';
import { StoryPage, StorySection } from './_shared/StoryScaffold';

export function LintTestStory() {
  const c = useThemeColors();

  return (
    <StoryPage>
      <StorySection index={1} title="Some boxes in a row">
        <Box style={{ flexDirection: 'row', gap: 8, width: '100%' }}>
          <Box style={{ width: 60, height: 60, backgroundColor: '#3b82f6', borderRadius: 8 }}>
            <Text style={{ color: '#fff', fontSize: 10 }}>A</Text>
          </Box>
          <Box style={{ width: 60, height: 60, backgroundColor: '#22c55e', borderRadius: 8 }}>
            <Text style={{ color: '#fff', fontSize: 10 }}>B</Text>
          </Box>
          <Box style={{ width: 60, height: 60, backgroundColor: '#ef4444', borderRadius: 8 }}>
            <Text style={{ color: '#fff', fontSize: 10 }}>C</Text>
          </Box>
        </Box>
      </StorySection>

      <StorySection index={2} title="Text content">
        <Text style={{ color: c.text, fontSize: 14 }}>Here is some text content</Text>
        <Text style={{ color: c.muted, fontSize: 11 }}>A subtitle underneath it</Text>
        {/* rjit-ignore-next-line */}
        <Text style={{ color: c.text, fontSize: 12, width: '100%' }}>Full width text that should center</Text>
      </StorySection>

      <StorySection index={3} title="Mixed layout">
        <Box style={{ width: '100%', gap: 8 }}>
          <Text style={{ color: c.text, fontSize: 12 }}>Label above boxes</Text>
          <Box style={{ flexDirection: 'row', gap: 6, width: '100%' }}>
            <Box style={{ flexGrow: 1, height: 40, backgroundColor: '#8b5cf6', borderRadius: 6 }}>
              <Text style={{ color: '#fff', fontSize: 10 }}>Left</Text>
            </Box>
            <Box style={{ flexGrow: 1, height: 40, backgroundColor: '#f97316', borderRadius: 6 }}>
              <Text style={{ color: '#fff', fontSize: 10 }}>Right</Text>
            </Box>
          </Box>
        </Box>
      </StorySection>
    </StoryPage>
  );
}
