import React from 'react';
import { Box, Text } from '../../../../packages/shared/src';

function Chip({ label, color }: { label: string; color: string }) {
  return (
    <Box style={{
      width: 50, height: 50,
      backgroundColor: color,
      borderRadius: 4,
      justifyContent: 'center',
      alignItems: 'center',
    }}>
      <Text style={{ color: '#fff', fontSize: 10 }}>{label}</Text>
    </Box>
  );
}

export function FlexRowStory() {
  return (
    <Box style={{ gap: 16, padding: 16 }}>
      {/* justify: start */}
      <Box style={{ backgroundColor: '#1e293b', padding: 8, borderRadius: 4, gap: 4 }}>
        <Text style={{ color: '#888', fontSize: 10 }}>justify: start</Text>
        <Box style={{ flexDirection: 'row', justifyContent: 'start', gap: 6, width: '100%' }}>
          <Chip label="A" color="#ef4444" />
          <Chip label="B" color="#f97316" />
          <Chip label="C" color="#eab308" />
        </Box>
      </Box>

      {/* justify: center */}
      <Box style={{ backgroundColor: '#1e293b', padding: 8, borderRadius: 4, gap: 4 }}>
        <Text style={{ color: '#888', fontSize: 10 }}>justify: center</Text>
        <Box style={{ flexDirection: 'row', justifyContent: 'center', gap: 6, width: '100%' }}>
          <Chip label="A" color="#22c55e" />
          <Chip label="B" color="#14b8a6" />
          <Chip label="C" color="#06b6d4" />
        </Box>
      </Box>

      {/* justify: end */}
      <Box style={{ backgroundColor: '#1e293b', padding: 8, borderRadius: 4, gap: 4 }}>
        <Text style={{ color: '#888', fontSize: 10 }}>justify: end</Text>
        <Box style={{ flexDirection: 'row', justifyContent: 'end', gap: 6, width: '100%' }}>
          <Chip label="A" color="#3b82f6" />
          <Chip label="B" color="#6366f1" />
          <Chip label="C" color="#8b5cf6" />
        </Box>
      </Box>

      {/* justify: space-between */}
      <Box style={{ backgroundColor: '#1e293b', padding: 8, borderRadius: 4, gap: 4 }}>
        <Text style={{ color: '#888', fontSize: 10 }}>justify: space-between</Text>
        <Box style={{ flexDirection: 'row', justifyContent: 'space-between', width: '100%' }}>
          <Chip label="A" color="#ec4899" />
          <Chip label="B" color="#f43f5e" />
          <Chip label="C" color="#e11d48" />
        </Box>
      </Box>

      {/* justify: space-around */}
      <Box style={{ backgroundColor: '#1e293b', padding: 8, borderRadius: 4, gap: 4 }}>
        <Text style={{ color: '#888', fontSize: 10 }}>justify: space-around</Text>
        <Box style={{ flexDirection: 'row', justifyContent: 'space-around', width: '100%' }}>
          <Chip label="A" color="#a855f7" />
          <Chip label="B" color="#d946ef" />
          <Chip label="C" color="#f0abfc" />
        </Box>
      </Box>
    </Box>
  );
}
