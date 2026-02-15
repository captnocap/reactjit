import React from 'react';
import { Box, Text } from '../../../../packages/shared/src';

export function PaddingMarginStory() {
  return (
    <Box style={{ gap: 16, padding: 16 }}>
      {/* Uniform padding */}
      <Box style={{ backgroundColor: '#1e293b', padding: 4, borderRadius: 4, gap: 4 }}>
        <Text style={{ color: '#888', fontSize: 10 }}>padding: 20</Text>
        <Box style={{
          backgroundColor: '#334155',
          padding: 20,
          borderRadius: 4,
        }}>
          <Box style={{
            backgroundColor: '#3b82f6',
            height: 30,
            borderRadius: 3,
            justifyContent: 'center',
            alignItems: 'center',
          }}>
            <Text style={{ color: '#fff', fontSize: 11 }}>Content</Text>
          </Box>
        </Box>
      </Box>

      {/* Per-side padding */}
      <Box style={{ backgroundColor: '#1e293b', padding: 4, borderRadius: 4, gap: 4 }}>
        <Text style={{ color: '#888', fontSize: 10 }}>paddingLeft: 40, paddingTop: 8</Text>
        <Box style={{
          backgroundColor: '#334155',
          paddingLeft: 40,
          paddingTop: 8,
          paddingRight: 8,
          paddingBottom: 8,
          borderRadius: 4,
        }}>
          <Box style={{
            backgroundColor: '#22c55e',
            height: 30,
            borderRadius: 3,
            justifyContent: 'center',
            alignItems: 'center',
          }}>
            <Text style={{ color: '#fff', fontSize: 11 }}>Offset left</Text>
          </Box>
        </Box>
      </Box>

      {/* Margin between siblings */}
      <Box style={{ backgroundColor: '#1e293b', padding: 4, borderRadius: 4, gap: 4 }}>
        <Text style={{ color: '#888', fontSize: 10 }}>margin between items</Text>
        <Box style={{
          backgroundColor: '#334155',
          padding: 8,
          borderRadius: 4,
          flexDirection: 'row',
        }}>
          <Box style={{
            width: 50, height: 50,
            backgroundColor: '#ef4444',
            borderRadius: 3,
          }} />
          <Box style={{
            width: 50, height: 50,
            backgroundColor: '#f97316',
            borderRadius: 3,
            marginLeft: 20,
          }} />
          <Box style={{
            width: 50, height: 50,
            backgroundColor: '#eab308',
            borderRadius: 3,
            marginLeft: 8,
          }} />
        </Box>
      </Box>
    </Box>
  );
}
