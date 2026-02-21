import React from 'react';
import { Box, Text } from '../../../packages/core/src';
import { useThemeColors } from '../../../packages/theme/src';
import { CardStory } from '../../../packages/components/src/Card/Card.story';
import { BadgeStory } from '../../../packages/components/src/Badge/Badge.story';
import { DividerStory } from '../../../packages/components/src/Divider/Divider.story';

export function CompositionStory() {
  const c = useThemeColors();

  return (
    <Box style={{ width: '100%', padding: 16, alignItems: 'center' }}>
      <Box style={{ width: '100%', maxWidth: 760, gap: 14 }}>
        <Text style={{ color: c.text, fontSize: 12 }}>1. Card</Text>
        <Box style={{
          width: '100%',
          backgroundColor: c.bgElevated,
          borderRadius: 10,
          borderWidth: 1,
          borderColor: c.border,
          padding: 12,
          alignItems: 'center',
        }}>
          <Box style={{ width: '100%', maxWidth: 640 }}>
            <CardStory />
          </Box>
        </Box>

        <Text style={{ color: c.text, fontSize: 12 }}>2. Badge</Text>
        <Box style={{
          width: '100%',
          backgroundColor: c.bgElevated,
          borderRadius: 10,
          borderWidth: 1,
          borderColor: c.border,
          padding: 12,
          alignItems: 'center',
        }}>
          <Box style={{ width: '100%', maxWidth: 640 }}>
            <BadgeStory />
          </Box>
        </Box>

        <Text style={{ color: c.text, fontSize: 12 }}>3. Divider</Text>
        <Box style={{
          width: '100%',
          backgroundColor: c.bgElevated,
          borderRadius: 10,
          borderWidth: 1,
          borderColor: c.border,
          padding: 12,
          alignItems: 'center',
        }}>
          <Box style={{ width: '100%', maxWidth: 640 }}>
            <DividerStory />
          </Box>
        </Box>
      </Box>
    </Box>
  );
}
