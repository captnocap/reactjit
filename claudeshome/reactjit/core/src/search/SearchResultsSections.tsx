/**
 * SearchResultsSections — search results grouped into labeled sections.
 *
 * @example
 * <SearchResultsSections
 *   sections={[
 *     { title: 'Files', items: fileResults },
 *     { title: 'Commands', items: cmdResults },
 *   ]}
 *   activeIndex={activeIndex}
 *   onSelect={handleSelect}
 * />
 */

import React from 'react';
import { Box, Text } from '../primitives';
import { Pressable, type PressableState } from '../Pressable';
import { ScrollView } from '../ScrollView';
import type { SearchResultItem } from './SearchResults';
import type { Style } from '../types';

export interface SearchSection<T extends SearchResultItem = SearchResultItem> {
  title: string;
  items: T[];
  /** Optional section-level action label (e.g. "See all"). */
  action?: { label: string; onPress: () => void };
}

export interface SearchResultsSectionsProps<T extends SearchResultItem = SearchResultItem> {
  sections: SearchSection<T>[];
  /**
   * Global active index — counts across ALL items in all sections
   * (section headers don't count). -1 means none.
   */
  activeIndex?: number;
  onSelect?: (item: T, flatIndex: number) => void;
  maxHeight?: number;
  emptyMessage?: string;
  loading?: boolean;
  style?: Style;
  itemStyle?: Style;
  activeColor?: string;
  textColor?: string;
  mutedColor?: string;
  sectionTitleColor?: string;
  backgroundColor?: string;
  borderColor?: string;
  borderRadius?: number;
}

export function SearchResultsSections<T extends SearchResultItem = SearchResultItem>({
  sections,
  activeIndex = -1,
  onSelect,
  maxHeight = 400,
  emptyMessage = 'No results',
  loading,
  style,
  itemStyle,
  activeColor = '#3b82f6',
  textColor = 'rgba(255,255,255,0.9)',
  mutedColor = 'rgba(255,255,255,0.45)',
  sectionTitleColor = 'rgba(255,255,255,0.35)',
  backgroundColor = 'rgba(20,20,28,0.97)',
  borderColor = 'rgba(255,255,255,0.1)',
  borderRadius = 8,
}: SearchResultsSectionsProps<T>) {
  const hasResults = sections.some((s) => s.items.length > 0);
  const totalItems = sections.reduce((sum, s) => sum + s.items.length, 0);

  if (loading) {
    return (
      <Box
        style={{
          backgroundColor,
          borderRadius,
          borderWidth: 1,
          borderColor,
          padding: 8,
          gap: 8,
          ...(style as any),
        }}
      >
        {[0, 1].map((si) => (
          <Box key={si} style={{ gap: 4 }}>
            <Box style={{ height: 10, width: 60, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.08)' }} />
            {[0, 1, 2].map((i) => (
              <Box
                key={i}
                style={{
                  height: 34,
                  borderRadius: 5,
                  backgroundColor: 'rgba(255,255,255,0.05)',
                  opacity: 1 - i * 0.25,
                }}
              />
            ))}
          </Box>
        ))}
      </Box>
    );
  }

  if (!hasResults) {
    return (
      <Box
        style={{
          backgroundColor,
          borderRadius,
          borderWidth: 1,
          borderColor,
          padding: 12,
          alignItems: 'center',
          ...(style as any),
        }}
      >
        <Text style={{ color: mutedColor, fontSize: 13 }}>{emptyMessage}</Text>
      </Box>
    );
  }

  // Compute approximate height for ScrollView
  const estimatedHeight = sections.reduce((h, s) => h + 24 + s.items.length * 40 + 8, 8);

  let flatIndex = 0;
  return (
    <ScrollView
      style={{
        backgroundColor,
        borderRadius,
        borderWidth: 1,
        borderColor,
        height: Math.min(maxHeight, estimatedHeight),
        ...(style as any),
      }}
    >
      <Box style={{ padding: 4, gap: 4 }}>
        {sections.map((section) => {
          if (section.items.length === 0) return null;

          return (
            <Box key={section.title} style={{ gap: 2 }}>
              {/* Section header */}
              <Box
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  paddingLeft: 8,
                  paddingRight: 8,
                  paddingTop: 4,
                  paddingBottom: 2,
                }}
              >
                <Text style={{ fontSize: 10, color: sectionTitleColor, fontWeight: 'bold' }}>
                  {section.title.toUpperCase()}
                </Text>
                {section.action && (
                  <Pressable onPress={section.action.onPress}>
                    <Text style={{ fontSize: 10, color: activeColor }}>{section.action.label}</Text>
                  </Pressable>
                )}
              </Box>

              {/* Items */}
              {section.items.map((item) => {
                const thisIndex = flatIndex++;
                const isActive = thisIndex === activeIndex;

                return (
                  <Pressable
                    key={item.id}
                    onPress={() => !item.disabled && onSelect?.(item, thisIndex)}
                    style={({ hovered }: PressableState) => ({
                      flexDirection: 'row',
                      alignItems: 'center',
                      paddingLeft: 10,
                      paddingRight: 10,
                      paddingTop: 7,
                      paddingBottom: 7,
                      borderRadius: 5,
                      gap: 8,
                      backgroundColor: isActive
                        ? `${activeColor}22`
                        : hovered
                          ? 'rgba(255,255,255,0.05)'
                          : 'transparent',
                      borderWidth: isActive ? 1 : 0,
                      borderColor: isActive ? `${activeColor}55` : 'transparent',
                      opacity: item.disabled ? 0.4 : 1,
                      ...(itemStyle as any),
                    })}
                  >
                    {item.icon && (
                      <Box style={{ width: 16, height: 16, alignItems: 'center', justifyContent: 'center' }}>
                        {item.icon}
                      </Box>
                    )}
                    <Box style={{ flexGrow: 1, gap: 1 }}>
                      <Text style={{ fontSize: 13, color: isActive ? activeColor : textColor }}>
                        {item.label}
                      </Text>
                      {item.description && (
                        <Text style={{ fontSize: 11, color: mutedColor }}>{item.description}</Text>
                      )}
                    </Box>
                    {item.meta && (
                      <Text style={{ fontSize: 10, color: mutedColor }}>{item.meta}</Text>
                    )}
                  </Pressable>
                );
              })}
            </Box>
          );
        })}
      </Box>
    </ScrollView>
  );
}
