import React from 'react';
import { Box, Text } from './primitives';
import { Pressable } from './Pressable';
import { useThemeColorsOptional } from './context';
import type { Style } from './types';

export interface NavItem {
  id: string;
  label: string;
}

export interface NavSection {
  title: string;
  items: NavItem[];
}

export interface NavPanelProps {
  sections: NavSection[];
  activeId?: string;
  onSelect?: (id: string) => void;
  header?: React.ReactNode;
  width?: number;
  contentAlign?: 'start' | 'center';
  style?: Style;
}

export function NavPanel({
  sections,
  activeId,
  onSelect,
  header,
  width = 180,
  contentAlign = 'start',
  style,
}: NavPanelProps) {
  const centered = contentAlign === 'center';
  // Keep nav rows visually clear of the vertical scrollbar gutter.
  const itemInsetLeft = 8;
  const itemInsetRight = 12;
  const theme = useThemeColorsOptional();
  const colors = {
    panelBg: theme?.bgElevated ?? '#111827',
    panelBorder: theme?.border ?? '#334155',
    sectionTitle: theme?.textDim ?? '#64748b',
    itemText: theme?.textSecondary ?? '#94a3b8',
    itemTextActive: theme?.text ?? '#e2e8f0',
    itemBgHover: theme?.surface ?? '#1e293b',
    itemBgPressed: theme?.surfaceHover ?? '#2a3a52',
    itemBgActive: theme?.surfaceHover ?? '#2a3a52',
    itemBorderActive: theme?.borderFocus ?? '#4b5563',
  };

  return (
    <Box style={{
      width,
      backgroundColor: colors.panelBg,
      borderWidth: 1,
      borderColor: colors.panelBorder,
      borderRadius: 8,
      paddingTop: 6,
      paddingBottom: 6,
      gap: 2,
      overflow: 'scroll',
      ...style,
    }}>
      {/* Header slot */}
      {header && (
        <>
          <Box
            style={{
              paddingLeft: 12,
              paddingRight: 12,
              paddingTop: 4,
              paddingBottom: 8,
              alignItems: centered ? 'center' : 'start',
            }}
          >
            {header}
          </Box>
          <Box style={{ height: 1, backgroundColor: colors.panelBorder }} />
        </>
      )}

      {/* Sections */}
      {sections.map((section) => (
        <Box key={section.title} style={{ paddingBottom: 2 }}>
          <Box
            style={{
              paddingLeft: centered ? 10 : 12,
              paddingRight: 10,
              paddingTop: 8,
              paddingBottom: 4,
              alignItems: centered ? 'center' : 'start',
            }}
          >
            <Text style={{ color: colors.sectionTitle, fontSize: 9, textAlign: centered ? 'center' : 'left' }}>
              {section.title.toUpperCase()}
            </Text>
          </Box>
          <Box style={{ gap: 2 }}>
            {section.items.map((item) => {
              const isActive = item.id === activeId;
              return (
                <Pressable
                  key={item.id}
                  onPress={() => onSelect?.(item.id)}
                  style={(state) => ({
                    marginLeft: itemInsetLeft,
                    marginRight: itemInsetRight,
                    paddingLeft: centered ? 8 : 10,
                    paddingRight: 8,
                    paddingTop: 6,
                    paddingBottom: 6,
                    borderRadius: 6,
                    borderWidth: 1,
                    borderColor: isActive ? colors.itemBorderActive : 'transparent',
                    alignItems: centered ? 'center' : 'start',
                    backgroundColor: isActive
                      ? colors.itemBgActive
                      : state.pressed
                        ? colors.itemBgPressed
                        : state.hovered
                          ? colors.itemBgHover
                          : 'transparent',
                  })}
                >
                  <Text style={{
                    color: isActive ? colors.itemTextActive : colors.itemText,
                    fontSize: 11,
                    fontWeight: isActive ? 'bold' : 'normal',
                    textAlign: centered ? 'center' : 'left',
                  }}>
                    {item.label}
                  </Text>
                </Pressable>
              );
            })}
          </Box>
        </Box>
      ))}
    </Box>
  );
}
