import React from 'react';
import { Box, Text } from './primitives';
import { Pressable } from './Pressable';
import type { Style } from './types';

export interface Tab {
  id: string;
  label: string;
}

export interface TabsProps {
  tabs: Tab[];
  activeId: string;
  onSelect?: (id: string) => void;
  variant?: 'underline' | 'pill';
  style?: Style;
}

export function Tabs({
  tabs,
  activeId,
  onSelect,
  variant = 'underline',
  style,
}: TabsProps) {
  if (variant === 'pill') {
    return (
      <Box style={{
        flexDirection: 'row',
        width: '100%',
        gap: 4,
        backgroundColor: '#0f172a',
        borderRadius: 8,
        padding: 4,
        ...style,
      }}>
        {tabs.map((tab) => {
          const isActive = tab.id === activeId;
          return (
            <Pressable
              key={tab.id}
              onPress={() => onSelect?.(tab.id)}
              style={(state) => ({
                paddingLeft: 12,
                paddingRight: 12,
                paddingTop: 6,
                paddingBottom: 6,
                borderRadius: 6,
                backgroundColor: isActive
                  ? '#334155'
                  : state.hovered
                    ? '#1e293b'
                    : 'transparent',
              })}
            >
              <Text style={{
                color: isActive ? '#e2e8f0' : '#64748b',
                fontSize: 11,
                fontWeight: isActive ? 'bold' : 'normal',
              }}>
                {tab.label}
              </Text>
            </Pressable>
          );
        })}
      </Box>
    );
  }

  // underline variant
  return (
    <Box style={{
      flexDirection: 'row',
      width: '100%',
      borderBottomWidth: 1,
      borderColor: '#1e293b',
      ...style,
    }}>
      {tabs.map((tab) => {
        const isActive = tab.id === activeId;
        return (
          <Pressable
            key={tab.id}
            onPress={() => onSelect?.(tab.id)}
            style={(state) => ({
              paddingLeft: 12,
              paddingRight: 12,
              paddingTop: 8,
              paddingBottom: 8,
              borderBottomWidth: 2,
              borderColor: isActive
                ? '#3b82f6'
                : state.hovered
                  ? '#475569'
                  : 'transparent',
            })}
          >
            <Text style={{
              color: isActive ? '#e2e8f0' : '#64748b',
              fontSize: 11,
              fontWeight: isActive ? 'bold' : 'normal',
            }}>
              {tab.label}
            </Text>
          </Pressable>
        );
      })}
    </Box>
  );
}
