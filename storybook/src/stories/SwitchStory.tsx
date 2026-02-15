import React, { useState } from 'react';
import { Box, Text, Switch } from '../../../../packages/shared/src';

export function SwitchStory() {
  const [on1, setOn1] = useState(false);
  const [on2, setOn2] = useState(true);

  return (
    <Box style={{ gap: 16, padding: 16 }}>
      {/* Default switch */}
      <Box style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <Switch value={on1} onValueChange={setOn1} />
        <Text style={{ color: '#e2e8f0', fontSize: 13 }}>
          {on1 ? 'ON' : 'OFF'}
        </Text>
      </Box>

      {/* Custom colors */}
      <Box style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <Switch
          value={on2}
          onValueChange={setOn2}
          trackColor={{ true: '#22c55e', false: '#374151' }}
          thumbColor="#ffffff"
        />
        <Text style={{ color: '#e2e8f0', fontSize: 13 }}>
          {`Custom colors (${on2 ? 'ON' : 'OFF'})`}
        </Text>
      </Box>

      {/* Disabled */}
      <Box style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <Switch value={true} disabled />
        <Text style={{ color: '#6b7280', fontSize: 13 }}>Disabled (on)</Text>
      </Box>

      <Box style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <Switch value={false} disabled />
        <Text style={{ color: '#6b7280', fontSize: 13 }}>Disabled (off)</Text>
      </Box>
    </Box>
  );
}
