import React, { useState } from 'react';
import { Box, Text } from '../../../packages/shared/src';
import { RadioGroup, Radio } from '../../../packages/shared/src/Radio';
import { useThemeColors } from '../../../packages/theme/src';

export function RadioStory() {
  const c = useThemeColors();
  const [fruit, setFruit] = useState('apple');
  const [size, setSize] = useState('medium');

  return (
    <Box style={{ width: '100%', gap: 16, padding: 16 }}>
      {/* Basic radio group */}
      <Box style={{ gap: 8 }}>
        <Text style={{ color: c.textDim, fontSize: 10 }}>Favorite fruit</Text>
        <RadioGroup value={fruit} onValueChange={setFruit}>
          <Radio value="apple" label="Apple" />
          <Radio value="banana" label="Banana" />
          <Radio value="cherry" label="Cherry" />
          <Radio value="grape" label="Grape" />
        </RadioGroup>
        <Text style={{ color: c.textSecondary, fontSize: 12 }}>
          {`Selected: ${fruit}`}
        </Text>
      </Box>

      {/* Custom colors */}
      <Box style={{ gap: 8 }}>
        <Text style={{ color: c.textDim, fontSize: 10 }}>Custom colors</Text>
        <RadioGroup value={size} onValueChange={setSize}>
          <Radio value="small" label="Small" color={c.success} />
          <Radio value="medium" label="Medium" color={c.warning} />
          <Radio value="large" label="Large" color={c.error} />
        </RadioGroup>
      </Box>

      {/* Disabled group */}
      <Box style={{ gap: 8 }}>
        <Text style={{ color: c.textDim, fontSize: 10 }}>Disabled group</Text>
        <RadioGroup value="opt1" disabled>
          <Radio value="opt1" label="Option 1" />
          <Radio value="opt2" label="Option 2" />
        </RadioGroup>
      </Box>
    </Box>
  );
}
