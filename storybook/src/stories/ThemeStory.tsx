import React from 'react';
import { Box, Text, Pressable, ScrollView } from '../../../packages/shared/src';
import { ThemeSwitcher, useTheme, useThemeColors, themeNames, themes } from '../../../packages/theme/src';

function ColorSwatch({ color, label }: { color: string; label: string }) {
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
      borderColor: 'rgba(255,255,255,0.12)',
      backgroundColor: 'rgba(255,255,255,0.03)',
    }}>
      <Box style={{
        width: 14,
        height: 14,
        backgroundColor: color,
        borderRadius: 3,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.2)',
      }} />
      <Text style={{ color: '#aab0c5', fontSize: 9 }}>{label}</Text>
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
      flexGrow: 1,
      flexBasis: 360,
      minWidth: 320,
      maxWidth: 560,
      minHeight: 116,
      padding: 12,
      borderRadius: 8,
      borderWidth: isActive ? 2 : 1,
      borderColor: isActive ? tc.primary : tc.border,
      backgroundColor: tc.bg,
      flexDirection: 'row',
      gap: 12,
      alignItems: 'stretch',
      flexShrink: 0,
    }}>
      <Box style={{ flexGrow: 1, minWidth: 0, gap: 3 }}>
        <Text style={{ color: tc.text, fontSize: 12, fontWeight: 'bold' }}>
          {theme.displayName}
        </Text>
        <Text style={{ color: tc.textDim, fontSize: 9 }}>{id}</Text>
        <Box style={{
          paddingLeft: 8, paddingRight: 8, paddingTop: 3, paddingBottom: 3,
          backgroundColor: tc.primary,
          borderRadius: 4,
          alignSelf: 'flex-start',
        }}>
          <Text style={{ color: tc.bg, fontSize: 9 }}>Button</Text>
        </Box>
        <Text style={{ color: tc.textSecondary, fontSize: 9 }}>Secondary text</Text>
      </Box>

      <Box style={{
        width: 144,
        flexShrink: 0,
        borderRadius: 6,
        borderWidth: 1,
        borderColor: isActive ? tc.primary : tc.border,
        backgroundColor: tc.surface,
        padding: 6,
        gap: 5,
      }}>
        <Text style={{ color: tc.textDim, fontSize: 8 }}>Colors</Text>
        <Box style={{
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: 4,
          justifyContent: 'center',
        }}>
          {swatches.map((color, i) => (
            <Box key={i} style={{
              width: 14,
              height: 14,
              backgroundColor: color,
              borderRadius: 3,
              borderWidth: 1,
              borderColor: 'rgba(255,255,255,0.16)',
            }} />
          ))}
        </Box>
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

  const gridGap = 10;

  return (
    <ScrollView style={{ width: '100%', height: '100%' }}>
      <Box style={{ padding: 16, gap: 12, width: '100%' }}>
        <Text style={{ color: c.text, fontSize: 16, fontWeight: 'bold' }}>Theme System</Text>
        <Text style={{ color: c.textSecondary, fontSize: 11 }}>{`${themeNames.length} themes across ${families.size} families. Click a card to switch.`}</Text>

        <Box style={{
          flexDirection: 'row',
          gap: 10,
          padding: 10,
          backgroundColor: c.bgElevated,
          borderRadius: 8,
          borderWidth: 1,
          borderColor: c.border,
          alignItems: 'center',
          width: '100%',
        }}>
          <Box style={{ gap: 2 }}>
            <Text style={{ color: c.textDim, fontSize: 10 }}>Active theme</Text>
            <Text style={{ color: c.primary, fontSize: 13, fontWeight: 'bold' }}>{themeId}</Text>
          </Box>
          <Box style={{ flexGrow: 1 }} />
          <ThemeSwitcher />
        </Box>

        <Box style={{
          gap: 8,
          width: '100%',
          padding: 10,
          borderRadius: 8,
          borderWidth: 1,
          borderColor: c.border,
          backgroundColor: c.surface,
        }}>
          <Text style={{ color: c.textSecondary, fontSize: 10 }}>Semantic Tokens</Text>
          <Box style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap', width: '100%' }}>
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
        </Box>

        <Box style={{ flexDirection: 'row', gap: gridGap, flexWrap: 'wrap', width: '100%', paddingBottom: 16 }}>
          {themeNames.map(id => (
            <ThemeCard
              key={id}
              id={id}
              isActive={id === themeId}
              onPress={() => setTheme(id)}
            />
          ))}
        </Box>
      </Box>
    </ScrollView>
  );
}
