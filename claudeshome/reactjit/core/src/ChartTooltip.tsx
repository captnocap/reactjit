import React from 'react';
import type { ReactNode } from 'react';
import { Box, Text } from './primitives';

export interface ChartTooltipProps {
  visible: boolean;
  anchor?: 'top' | 'right' | 'bottom' | 'left';
  children: ReactNode;
}

const anchorStyles = {
  top: {
    position: 'absolute' as const,
    bottom: '100%',
    alignSelf: 'center' as const,
    marginBottom: 4,
    zIndex: 10,
  },
  bottom: {
    position: 'absolute' as const,
    top: '100%',
    alignSelf: 'center' as const,
    marginTop: 4,
    zIndex: 10,
  },
  right: {
    position: 'absolute' as const,
    left: '100%',
    top: 0,
    marginLeft: 4,
    zIndex: 10,
  },
  left: {
    position: 'absolute' as const,
    right: '100%',
    top: 0,
    marginRight: 4,
    zIndex: 10,
  },
};

export function ChartTooltip({ visible, anchor = 'top', children }: ChartTooltipProps) {
  if (!visible) return null;
  return (
    <Box style={anchorStyles[anchor]}>
      <Box style={{
        backgroundColor: [0.03, 0.03, 0.05, 0.92],
        borderRadius: 4,
        paddingTop: 5,
        paddingBottom: 5,
        paddingLeft: 10,
        paddingRight: 10,
        borderWidth: 1,
        borderColor: '#40405a',
        alignItems: 'center',
        gap: 1,
      }}>
        {children}
      </Box>
    </Box>
  );
}

function TooltipLabel({ children }: { children: ReactNode }) {
  return (
    <Text style={{ color: '#61a6fa', fontSize: 10, fontWeight: 'bold' }}>
      {children}
    </Text>
  );
}

function TooltipValue({ children }: { children: ReactNode }) {
  return (
    <Text style={{ color: '#e1e4f0', fontSize: 12, fontWeight: 'bold' }}>
      {children}
    </Text>
  );
}

function TooltipDetail({ children }: { children: ReactNode }) {
  return (
    <Text style={{ color: '#8892a6', fontSize: 9 }}>
      {children}
    </Text>
  );
}

ChartTooltip.Label = TooltipLabel;
ChartTooltip.Value = TooltipValue;
ChartTooltip.Detail = TooltipDetail;
