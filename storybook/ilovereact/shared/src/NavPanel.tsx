import React from 'react';
import { Box, Text } from './primitives';
import { Pressable } from './Pressable';
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
  style?: Style;
}

export function NavPanel({
  sections,
  activeId,
  onSelect,
  header,
  width = 180,
  style,
}: NavPanelProps) {
  return (
    <Box style={{
      width,
      backgroundColor: '#0c0c14',
      borderWidth: 1,
      borderColor: '#1e293b',
      overflow: 'scroll',
      ...style,
    }}>
      {/* Header slot */}
      {header && (
        <>
          <Box style={{ padding: 12 }}>
            {header}
          </Box>
          <Box style={{ height: 1, backgroundColor: '#1e293b' }} />
        </>
      )}

      {/* Sections */}
      {sections.map((section) => (
        <Box key={section.title}>
          <Box style={{ paddingLeft: 12, paddingTop: 8, paddingBottom: 2 }}>
            <Text style={{ color: '#334155', fontSize: 9 }}>
              {section.title.toUpperCase()}
            </Text>
          </Box>
          {section.items.map((item) => {
            const isActive = item.id === activeId;
            return (
              <Pressable
                key={item.id}
                onPress={() => onSelect?.(item.id)}
                style={(state) => ({
                  paddingLeft: 16,
                  paddingRight: 8,
                  paddingTop: 4,
                  paddingBottom: 4,
                  backgroundColor: isActive
                    ? '#1e293b'
                    : state.hovered
                      ? '#111827'
                      : 'transparent',
                })}
              >
                <Text style={{
                  color: isActive ? '#e2e8f0' : '#64748b',
                  fontSize: 11,
                }}>
                  {item.label}
                </Text>
              </Pressable>
            );
          })}
        </Box>
      ))}
    </Box>
  );
}
