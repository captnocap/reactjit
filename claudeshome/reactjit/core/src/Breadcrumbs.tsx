import React from 'react';
import { Box, Text } from './primitives';
import { Pressable } from './Pressable';
import type { Style } from './types';

export interface BreadcrumbItem {
  id: string;
  label: string;
}

export interface BreadcrumbsProps {
  items: BreadcrumbItem[];
  onSelect?: (id: string) => void;
  separator?: string;
  style?: Style;
}

export function Breadcrumbs({
  items,
  onSelect,
  separator = '/',
  style,
}: BreadcrumbsProps) {
  return (
    <Box style={{
      flexDirection: 'row',
      width: '100%',
      alignItems: 'center',
      gap: 6,
      ...style,
    }}>
      {items.map((item, i) => {
        const isLast = i === items.length - 1;

        return (
          <React.Fragment key={item.id}>
            {isLast ? (
              <Text style={{ color: '#e2e8f0', fontSize: 11, fontWeight: 'bold' }}>
                {item.label}
              </Text>
            ) : (
              <Pressable
                onPress={() => onSelect?.(item.id)}
                style={(state) => ({
                  opacity: state.hovered ? 1 : 0.7,
                })}
              >
                <Text style={{ color: '#64748b', fontSize: 11 }}>
                  {item.label}
                </Text>
              </Pressable>
            )}
            {!isLast && (
              <Text style={{ color: '#334155', fontSize: 11 }}>
                {separator}
              </Text>
            )}
          </React.Fragment>
        );
      })}
    </Box>
  );
}
