import React from 'react';
import { Box, Text, Pressable } from '../../../packages/core/src';
import { ThemeSwitcher, useTheme, useThemeColors, themeNames, themes } from '../../../packages/theme/src';
import { StoryPage, StorySection } from './_shared/StoryScaffold';

function ColorSwatch({ color, label }: { color: string; label: string }) {
  const c = useThemeColors();
  return (
    <Box style={{
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingLeft: 8,
      paddingRight: 8,
      paddingTop: 5,
      paddingBottom: 5,
      borderRadius: 6,
      borderWidth: 1,
      borderColor: c.border,
      backgroundColor: c.surface,
    }}>
      <Box style={{
        width: 14,
        height: 14,
        backgroundColor: color,
        borderRadius: 3,
        borderWidth: 1,
        borderColor: c.border,
      }} />
      <Text style={{ color: c.textDim, fontSize: 9 }}>{label}</Text>
    </Box>
  );
}

function ThemeCard({
  id,
  isActive,
  onPress,
}: {
  id: string;
  isActive: boolean;
  onPress: () => void;
}) {
  const theme = themes[id];
  if (!theme) return null;
  const tc = theme.colors;
  const swatches = [
    tc.bg,
    tc.bgAlt,
    tc.bgElevated,
    tc.surface,
    tc.border,
    tc.text,
    tc.primary,
    tc.accent,
    tc.error,
    tc.warning,
    tc.success,
    tc.info,
  ];

  return (
    <Pressable onPress={onPress} style={{
      width: '100%',
      maxWidth: 360,
      minHeight: 80,
      padding: 10,
      borderRadius: 8,
      borderWidth: isActive ? 2 : 1,
      borderColor: isActive ? tc.primary : tc.border,
      backgroundColor: tc.bg,
      gap: 6,
    }}>
      <Box style={{ width: '100%', flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Box style={{ flexGrow: 1, minWidth: 0, gap: 2 }}>
          <Text style={{ color: tc.text, fontSize: 11, fontWeight: 'normal' }}>
            {theme.displayName}
          </Text>
          <Text style={{ color: tc.textDim, fontSize: 9 }}>{id}</Text>
        </Box>
        <Box style={{
          paddingLeft: 8, paddingRight: 8, paddingTop: 3, paddingBottom: 3,
          backgroundColor: tc.primary,
          borderRadius: 4,
        }}>
          <Text style={{ color: tc.bg, fontSize: 9 }}>Button</Text>
        </Box>
      </Box>
      <Box style={{
        width: '100%',
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 3,
      }}>
        {swatches.map((color, i) => (
          <Box key={i} style={{
            width: 12,
            height: 12,
            backgroundColor: color,
            borderRadius: 2,
            borderWidth: 1,
            borderColor: tc.border,
          }} />
        ))}
      </Box>
    </Pressable>
  );
}

export function ThemeStory() {
  const { themeId, setTheme } = useTheme();
  const c = useThemeColors();

  const families = new Map<string, string[]>();
  for (const name of themeNames) {
    const family = name.replace(/-(?:latte|frappe|macchiato|mocha|soft|light|dark|storm|dawn)$/, '');
    if (!families.has(family)) families.set(family, []);
    families.get(family)!.push(name);
  }

  return (
    <StoryPage>

      <StorySection index={1} title="Active Theme">
        <Box style={{ width: '100%', flexDirection: 'row', gap: 10, alignItems: 'center' }}>
          <Box style={{ gap: 2, flexGrow: 1 }}>
            <Text style={{ color: c.textDim, fontSize: 10 }}>Active theme</Text>
            <Text style={{ color: c.primary, fontSize: 13, fontWeight: 'normal' }}>{themeId}</Text>
          </Box>
          <ThemeSwitcher />
        </Box>
        <Text style={{ color: c.textSecondary, fontSize: 10, textAlign: 'center' }}>
          {`${themeNames.length} themes across ${families.size} families. Click a card below to switch.`}
        </Text>
      </StorySection>

      <StorySection index={2} title="Semantic Tokens">
        <Text style={{ color: c.textSecondary, fontSize: 10, textAlign: 'center' }}>
          All color tokens available via useThemeColors().
        </Text>
        <Box style={{ width: '100%', flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
          <ColorSwatch color={c.bg} label="bg" />
          <ColorSwatch color={c.bgAlt} label="bgAlt" />
          <ColorSwatch color={c.bgElevated} label="bgElevated" />
          <ColorSwatch color={c.text} label="text" />
          <ColorSwatch color={c.textSecondary} label="textSecondary" />
          <ColorSwatch color={c.textDim} label="textDim" />
          <ColorSwatch color={c.primary} label="primary" />
          <ColorSwatch color={c.accent} label="accent" />
          <ColorSwatch color={c.surface} label="surface" />
          <ColorSwatch color={c.border} label="border" />
          <ColorSwatch color={c.error} label="error" />
          <ColorSwatch color={c.warning} label="warning" />
          <ColorSwatch color={c.success} label="success" />
          <ColorSwatch color={c.info} label="info" />
        </Box>
      </StorySection>

      <StorySection index={3} title="Theme Gallery">
        <Text style={{ color: c.textSecondary, fontSize: 10, textAlign: 'center' }}>
          Click any card to switch themes.
        </Text>
        <Box style={{ width: '100%', flexDirection: 'row', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
          {themeNames.map(id => (
            <ThemeCard
              key={id}
              id={id}
              isActive={id === themeId}
              onPress={() => setTheme(id)}
            />
          ))}
        </Box>
      </StorySection>

    </StoryPage>
  );
}
