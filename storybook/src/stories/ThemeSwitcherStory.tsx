/**
 * ThemeSwitcherStory -- demonstrates the ThemeSwitcher dropdown component.
 *
 * Places the ThemeSwitcher on a themed background with some sample content
 * underneath to show how the dropdown overlays properly.
 */

import React from 'react';
import { Box, Text } from '../../../packages/shared/src';
import { useThemeColors } from '../../../packages/theme/src';
import { ThemeSwitcher } from '../../../packages/theme/src';

export function ThemeSwitcherStory() {
  const c = useThemeColors();

  return (
    <Box style={{ padding: 16, gap: 16, width: '100%', height: '100%' }}>
      {/* Title */}
      <Text style={{ color: c.text, fontSize: 16, fontWeight: 'bold' }}>
        Theme Switcher
      </Text>
      <Text style={{ color: c.textSecondary, fontSize: 11 }}>
        A dropdown picker that lists all themes grouped by family. Click the button to open.
      </Text>

      {/* ThemeSwitcher positioned at the top-right of a container */}
      <Box
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
          padding: 10,
          backgroundColor: c.bgAlt,
          borderRadius: 6,
          borderWidth: 1,
          borderColor: c.border,
          width: '100%',
        }}
      >
        <Text style={{ color: c.textDim, fontSize: 10 }}>Current theme:</Text>
        <Box style={{ flexGrow: 1 }} />
        <ThemeSwitcher />
      </Box>

      {/* Sample background content to verify overlay behavior */}
      <Box
        style={{
          padding: 12,
          backgroundColor: c.surface,
          borderRadius: 6,
          gap: 8,
          width: '100%',
        }}
      >
        <Text style={{ color: c.text, fontSize: 12, fontWeight: 'bold' }}>
          Sample Content
        </Text>
        <Text style={{ color: c.textSecondary, fontSize: 10 }}>
          This box sits below the theme switcher to demonstrate that the dropdown panel overlays on top of existing content when opened.
        </Text>

        {/* Color preview row */}
        <Box style={{ flexDirection: 'row', gap: 6, paddingTop: 4 }}>
          {[c.primary, c.accent, c.success, c.warning, c.error, c.info].map(
            (color, i) => (
              <Box
                key={i}
                style={{
                  width: 24,
                  height: 24,
                  backgroundColor: color,
                  borderRadius: 4,
                }}
              />
            ),
          )}
        </Box>
      </Box>
    </Box>
  );
}
