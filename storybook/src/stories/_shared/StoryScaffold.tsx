import React from 'react';
import { Box, ScrollView, Text } from '../../../../packages/core/src';
import { useThemeColors } from '../../../../packages/theme/src';

export const STORY_MAX_WIDTH = 760;

export function StoryPage({ children }: { children: React.ReactNode }) {
  return (
    <ScrollView style={{ width: '100%', height: '100%' }}>
      <Box style={{
        width: '100%',
        padding: 16,
        alignItems: 'center',
        paddingBottom: 32,
      }}>
        <Box style={{ width: '100%', maxWidth: STORY_MAX_WIDTH, gap: 14 }}>
          {children}
        </Box>
      </Box>
    </ScrollView>
  );
}

export function StorySection({
  id,
  index,
  title,
  children,
}: {
  id?: string;
  index: number;
  title: string;
  children: React.ReactNode;
}) {
  const c = useThemeColors();
  return (
    <Box style={{ position: 'relative', zIndex: 1000 - index }}>
      {/* rjit-ignore-next-line */}
      <Text style={{
        width: '100%',
        color: c.text,
        fontSize: 12,
        textAlign: 'left',
        marginBottom: 4,
      }}>
        {`${index}. ${title}`}
      </Text>
      <Box style={{
        width: '100%',
        backgroundColor: c.bgElevated,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: c.border,
        padding: 12,
        gap: 8,
        alignItems: 'center',
      }}>
        {children}
      </Box>
    </Box>
  );
}
