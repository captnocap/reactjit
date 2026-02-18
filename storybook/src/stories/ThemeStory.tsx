import React from 'react';
import { Box, Text, Pressable, ScrollView } from '../../../packages/shared/src';
import { useTheme, useThemeColors, themeNames, themes } from '../../../packages/theme/src';

function ColorSwatch({ color, label }: { color: string; label: string }) {
  return (
    <Box style={{ alignItems: 'center', gap: 2 }}>
      <Box style={{
        width: 28,
        height: 28,
        backgroundColor: color,
        borderRadius: 4,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
      }} />
      <Text style={{ color: '#888', fontSize: 7 }}>{label}</Text>
    </Box>
  );
}

function ThemeCard({ id, isActive, onPress }: { id: string; isActive: boolean; onPress: () => void }) {
  const theme = themes[id];
  if (!theme) return null;
  const tc = theme.colors;

  return (
    <Pressable onPress={onPress} style={{
      width: 200,
      padding: 10,
      borderRadius: 8,
      borderWidth: isActive ? 2 : 1,
      borderColor: isActive ? tc.primary : tc.border,
      backgroundColor: tc.bg,
    }}>
      {/* Theme name */}
      <Text style={{ color: tc.text, fontSize: 11, fontWeight: 'bold' }}>
        {theme.displayName}
      </Text>
      <Text style={{ color: tc.textDim, fontSize: 8 }}>{id}</Text>

      {/* Color swatches */}
      <Box style={{ flexDirection: 'row', gap: 4, paddingTop: 8, flexWrap: 'wrap' }}>
        <ColorSwatch color={tc.bg} label="bg" />
        <ColorSwatch color={tc.surface} label="srf" />
        <ColorSwatch color={tc.primary} label="pri" />
        <ColorSwatch color={tc.accent} label="acc" />
        <ColorSwatch color={tc.error} label="err" />
        <ColorSwatch color={tc.success} label="ok" />
      </Box>

      {/* Preview bar */}
      <Box style={{
        flexDirection: 'row',
        gap: 4,
        paddingTop: 8,
        alignItems: 'center',
      }}>
        <Box style={{
          paddingLeft: 6, paddingRight: 6, paddingTop: 2, paddingBottom: 2,
          backgroundColor: tc.primary,
          borderRadius: 3,
        }}>
          <Text style={{ color: tc.bg, fontSize: 8 }}>Button</Text>
        </Box>
        <Text style={{ color: tc.textSecondary, fontSize: 8 }}>Secondary text</Text>
      </Box>
    </Pressable>
  );
}

export function ThemeStory() {
  const { themeId, setTheme } = useTheme();
  const c = useThemeColors();

  // Group themes by family
  const families = new Map<string, string[]>();
  for (const name of themeNames) {
    const family = name.replace(/-(?:latte|frappe|macchiato|mocha|soft|light|dark|storm|dawn)$/, '');
    if (!families.has(family)) families.set(family, []);
    families.get(family)!.push(name);
  }

  return (
    <Box style={{ padding: 16, gap: 16, width: '100%', height: '100%' }}>
      <Text style={{ color: c.text, fontSize: 16, fontWeight: 'bold' }}>Theme System</Text>
      <Text style={{ color: c.textSecondary, fontSize: 11 }}>{`${themeNames.length} themes across ${families.size} families. Click a card to switch.`}</Text>

      {/* Current theme info */}
      <Box style={{
        flexDirection: 'row',
        gap: 8,
        padding: 10,
        backgroundColor: c.bgElevated,
        borderRadius: 6,
        alignItems: 'center',
        width: '100%',
      }}>
        <Text style={{ color: c.textDim, fontSize: 10 }}>Active:</Text>
        <Text style={{ color: c.primary, fontSize: 12, fontWeight: 'bold' }}>{themeId}</Text>
      </Box>

      {/* Semantic tokens preview */}
      <Box style={{ flexDirection: 'row', gap: 4, flexWrap: 'wrap', width: '100%' }}>
        <ColorSwatch color={c.bg} label="bg" />
        <ColorSwatch color={c.bgAlt} label="bgAlt" />
        <ColorSwatch color={c.bgElevated} label="bgElev" />
        <ColorSwatch color={c.text} label="text" />
        <ColorSwatch color={c.textSecondary} label="text2" />
        <ColorSwatch color={c.textDim} label="dim" />
        <ColorSwatch color={c.primary} label="primary" />
        <ColorSwatch color={c.accent} label="accent" />
        <ColorSwatch color={c.surface} label="surface" />
        <ColorSwatch color={c.border} label="border" />
        <ColorSwatch color={c.error} label="error" />
        <ColorSwatch color={c.warning} label="warning" />
        <ColorSwatch color={c.success} label="success" />
        <ColorSwatch color={c.info} label="info" />
      </Box>

      {/* Theme cards grid */}
      <Box style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap', width: '100%' }}>
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
  );
}
