import React from 'react';
import { Box, Text, Pressable } from '../../../packages/core/src';
import { useThemeColors } from '../../../packages/theme/src';
import { useDocsFontScale } from './DocsFontScale';

/** Human-readable section titles */
const SECTION_TITLES: Record<string, string> = {
  '01-getting-started': 'Getting Started',
  '02-architecture': 'Architecture',
  '03-cli-reference': 'CLI Reference',
  '04-layout-system': 'Layout System',
  '05-components': 'Components',
  '06-hooks': 'Hooks',
  '07-animation': 'Animation',
  '08-routing': 'Routing',
  '09-targets': 'Targets',
  '10-advanced': 'Advanced',
  '11-troubleshooting': 'Troubleshooting',
  '12-api-reference': 'API Reference',
  'examples': 'Examples',
};

interface DocsSidebarProps {
  sections: Record<string, Record<string, { metadata: { title: string } }>>;
  activeSectionId: string;
  activeFileKey: string;
  onSelect: (sectionId: string, fileKey: string) => void;
}

export function DocsSidebar({ sections, activeSectionId, activeFileKey, onSelect }: DocsSidebarProps) {
  const c = useThemeColors();
  const { scale } = useDocsFontScale();
  const sectionIds = Object.keys(sections).sort();

  const s = (base: number) => Math.round(base * scale);

  return (
    <Box style={{
      width: '100%',
      backgroundColor: c.bg,
      borderRightWidth: 1,
      borderColor: c.border,
    }}>
      {/* Header */}
      <Box style={{ paddingTop: 14, paddingLeft: 12, paddingRight: 12, paddingBottom: 5 }}>
        <Text style={{ color: c.textDim, fontSize: s(10), lineHeight: s(16), fontWeight: 'bold' }}>DOCUMENTATION</Text>
      </Box>
      <Box style={{ height: 1, backgroundColor: c.border }} />

      {/* Section list */}
      {sectionIds.map(sectionId => {
        const files = sections[sectionId];
        const fileKeys = Object.keys(files).sort();
        const ordered = fileKeys.filter(k => k === 'index').concat(fileKeys.filter(k => k !== 'index'));
        const sectionTitle = SECTION_TITLES[sectionId] || sectionId;

        return (
          <Box key={sectionId}>
            {/* Section header */}
            <Box style={{ paddingLeft: 12, paddingTop: 8, paddingBottom: 2 }}>
              <Text style={{ color: c.textDim, fontSize: s(9), lineHeight: s(14) }}>{sectionTitle.toUpperCase()}</Text>
            </Box>

            {/* File links */}
            {ordered.map(fileKey => {
              const file = files[fileKey];
              const isActive = sectionId === activeSectionId && fileKey === activeFileKey;
              const label = fileKey === 'index' ? 'Overview' : file.metadata.title;

              return (
                <Pressable
                  key={fileKey}
                  onPress={() => onSelect(sectionId, fileKey)}
                  style={{
                    width: '100%',
                    paddingLeft: 16,
                    paddingRight: 8,
                    paddingTop: 3,
                    paddingBottom: 3,
                    backgroundColor: isActive ? c.surface : 'transparent',
                  }}
                >
                  <Text style={{
                    color: isActive ? c.text : c.textSecondary,
                    fontSize: s(11),
                    lineHeight: s(16),
                  }}>
                    {label}
                  </Text>
                </Pressable>
              );
            })}
          </Box>
        );
      })}
    </Box>
  );
}
