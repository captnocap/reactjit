/**
 * SearchResults — flat list of search result items.
 *
 * Headless but opinionated: each item has a label, optional description,
 * optional icon/badge, and an active/selected state. Keyboard navigation
 * (active index) is controlled externally via the activeIndex prop.
 *
 * @example
 * <SearchResults
 *   items={results}
 *   activeIndex={activeIndex}
 *   onSelect={(item) => navigate(item.href)}
 * />
 */

import React from 'react';
import { Box, Text, Pressable, ScrollView } from '../primitives';
import type { Style } from '../types';

export interface SearchResultItem {
  /** Unique key. */
  id: string | number;
  /** Primary label. */
  label: string;
  /** Secondary description shown below the label. */
  description?: string;
  /** Small text shown on the right (e.g. category, shortcut, score). */
  meta?: string;
  /** Leading icon/badge slot. */
  icon?: React.ReactNode;
  /** Arbitrary data passed back to onSelect. */
  data?: unknown;
  /** Disable this item (shows dimmed, not clickable). */
  disabled?: boolean;
}

export interface SearchResultsProps<T extends SearchResultItem = SearchResultItem> {
  items: T[];
  /** Index of the keyboard-active item. -1 means none. */
  activeIndex?: number;
  onSelect?: (item: T, index: number) => void;
  onActiveChange?: (index: number) => void;
  /** Max height before scroll kicks in. Default: 320. */
  maxHeight?: number;
  /** Show when items is empty. */
  emptyMessage?: string;
  /** Loading state — shows skeleton rows. */
  loading?: boolean;
  style?: Style;
  itemStyle?: Style;
  activeColor?: string;
  textColor?: string;
  mutedColor?: string;
  backgroundColor?: string;
  borderColor?: string;
  borderRadius?: number;
}

export function SearchResults<T extends SearchResultItem = SearchResultItem>({
  items,
  activeIndex = -1,
  onSelect,
  maxHeight = 320,
  emptyMessage = 'No results',
  loading,
  style,
  itemStyle,
  activeColor = '#3b82f6',
  textColor = 'rgba(255,255,255,0.9)',
  mutedColor = 'rgba(255,255,255,0.45)',
  backgroundColor = 'rgba(20,20,28,0.97)',
  borderColor = 'rgba(255,255,255,0.1)',
  borderRadius = 8,
}: SearchResultsProps<T>) {
  if (loading) {
    return (
      <Box
        style={{
          backgroundColor,
          borderRadius,
          borderWidth: 1,
          borderColor,
          padding: 8,
          gap: 6,
          ...(style as any),
        }}
      >
        {[0, 1, 2].map((i) => (
          <Box
            key={i}
            style={{
              height: 36,
              borderRadius: 5,
              backgroundColor: 'rgba(255,255,255,0.06)',
              opacity: 1 - i * 0.25,
            }}
          />
        ))}
      </Box>
    );
  }

  if (items.length === 0) {
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

  return (
    <ScrollView
      style={{
        backgroundColor,
        borderRadius,
        borderWidth: 1,
        borderColor,
        height: Math.min(maxHeight, items.length * 44 + 8),
        ...(style as any),
      }}
    >
      <Box style={{ padding: 4, gap: 2 }}>
        {items.map((item, index) => {
          const isActive = index === activeIndex;
          return (
            <Pressable
              key={item.id}
              onPress={() => !item.disabled && onSelect?.(item, index)}
              style={({ hovered }) => ({
                flexDirection: 'row',
                alignItems: 'center',
                paddingLeft: 10,
                paddingRight: 10,
                paddingTop: 8,
                paddingBottom: 8,
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
              {/* Icon slot */}
              {item.icon && (
                <Box style={{ width: 16, height: 16, alignItems: 'center', justifyContent: 'center' }}>
                  {item.icon}
                </Box>
              )}

              {/* Label + description */}
              <Box style={{ flexGrow: 1, gap: 1 }}>
                <Text style={{ fontSize: 13, color: isActive ? activeColor : textColor }}>
                  {item.label}
                </Text>
                {item.description && (
                  <Text style={{ fontSize: 11, color: mutedColor }}>{item.description}</Text>
                )}
              </Box>

              {/* Meta */}
              {item.meta && (
                <Text style={{ fontSize: 10, color: mutedColor }}>{item.meta}</Text>
              )}
            </Pressable>
          );
        })}
      </Box>
    </ScrollView>
  );
}
