import React, { useState } from 'react';
import { Box, Text, Slider } from '../../../../packages/shared/src';

export function SliderStory() {
  const [value1, setValue1] = useState(0.5);
  const [value2, setValue2] = useState(30);

  return (
    <Box style={{ gap: 16, padding: 16 }}>
      {/* Default slider */}
      <Box style={{ gap: 4 }}>
        <Text style={{ color: '#888', fontSize: 10 }}>Default (0-1)</Text>
        <Slider
          value={value1}
          onValueChange={setValue1}
          activeTrackColor="#3b82f6"
        />
        <Text style={{ color: '#e2e8f0', fontSize: 12 }}>
          {`Value: ${value1.toFixed(2)}`}
        </Text>
      </Box>

      {/* Custom range with step */}
      <Box style={{ gap: 4 }}>
        <Text style={{ color: '#888', fontSize: 10 }}>Range 0-100, step 10</Text>
        <Slider
          value={value2}
          minimumValue={0}
          maximumValue={100}
          step={10}
          onValueChange={setValue2}
          activeTrackColor="#22c55e"
          thumbColor="#22c55e"
        />
        <Text style={{ color: '#e2e8f0', fontSize: 12 }}>
          {`Value: ${value2}`}
        </Text>
      </Box>

      {/* Disabled slider */}
      <Box style={{ gap: 4 }}>
        <Text style={{ color: '#888', fontSize: 10 }}>Disabled</Text>
        <Slider
          value={0.7}
          disabled
          trackColor="#374151"
          activeTrackColor="#6b7280"
        />
      </Box>
    </Box>
  );
}
