import React from 'react';
import { Box, Text } from '../../../packages/core/src';
import { useThemeColors } from '../../../packages/theme/src';
import { StoryPage, StorySection } from './_shared/StoryScaffold';

export function BoxBasicStory() {
  const c = useThemeColors();

  return (
    <StoryPage>
        <StorySection index={1} title="Unstyled boxes (hover to inspect nesting)">
          <Box
            tooltip={{ content: "Outer Box\nThe outermost container, 300x170", type: 'cursor', layout: 'descriptive' }}
            style={{
              width: 300,
              height: 170,
              borderWidth: 1,
              borderColor: c.border,
              justifyContent: 'center',
              alignItems: 'center',
            }}
          >
            <Box
              tooltip={{ content: "Middle Box\nNested inside Outer, 220x120", type: 'cursor', layout: 'descriptive' }}
              style={{
                width: 220,
                height: 120,
                borderWidth: 1,
                borderColor: c.border,
                justifyContent: 'center',
                alignItems: 'center',
              }}
            >
              <Box
                tooltip={{ content: "Inner Box\nInnermost layer, 140x75", type: 'cursor', layout: 'descriptive' }}
                style={{
                  width: 140,
                  height: 75,
                  borderWidth: 1,
                  borderColor: c.border,
                  justifyContent: 'center',
                  alignItems: 'center',
                }}
              />
            </Box>
          </Box>
        </StorySection>

        <StorySection index={2} title="Styled + nested boxes (centered)">
          <Box style={{
            width: 300,
            height: 170,
            backgroundColor: c.surface,
            borderRadius: 14,
            justifyContent: 'center',
            alignItems: 'center',
          }}>
            <Box style={{
              width: 220,
              height: 120,
              backgroundColor: c.primary,
              borderRadius: 12,
              justifyContent: 'center',
              alignItems: 'center',
            }}>
              <Box style={{
                width: 140,
                height: 75,
                backgroundColor: c.accent,
                borderRadius: 10,
                justifyContent: 'center',
                alignItems: 'center',
              }}>
                <Text style={{ color: '#ffffff', fontSize: 12 }}>Centered</Text>
              </Box>
            </Box>
          </Box>
        </StorySection>
    </StoryPage>
  );
}
