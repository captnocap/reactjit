import React, { useState } from 'react';
import { Box, Text } from '../../../packages/shared/src';
import { Select } from '../../../packages/shared/src/Select';
import { useThemeColors } from '../../../packages/theme/src';

const FRUIT_OPTIONS = [
  { label: 'Apple', value: 'apple' },
  { label: 'Banana', value: 'banana' },
  { label: 'Cherry', value: 'cherry' },
  { label: 'Dragon Fruit', value: 'dragon' },
  { label: 'Elderberry', value: 'elder' },
];

const DIFFICULTY_OPTIONS = [
  { label: 'Easy', value: 'easy' },
  { label: 'Normal', value: 'normal' },
  { label: 'Hard', value: 'hard' },
  { label: 'Nightmare', value: 'nightmare' },
];

export function SelectStory() {
  const c = useThemeColors();
  const [fruit, setFruit] = useState<string | undefined>(undefined);
  const [difficulty, setDifficulty] = useState('normal');

  return (
    <Box style={{ width: '100%', gap: 16, padding: 16 }}>
      {/* Basic select */}
      <Box style={{ gap: 4 }}>
        <Text style={{ color: c.textDim, fontSize: 10 }}>With placeholder</Text>
        <Select
          value={fruit}
          onValueChange={setFruit}
          options={FRUIT_OPTIONS}
          placeholder="Pick a fruit..."
        />
        <Text style={{ color: c.textSecondary, fontSize: 12 }}>
          {`Selected: ${fruit ?? 'none'}`}
        </Text>
      </Box>

      {/* Pre-selected */}
      <Box style={{ gap: 4 }}>
        <Text style={{ color: c.textDim, fontSize: 10 }}>Pre-selected</Text>
        <Select
          value={difficulty}
          onValueChange={setDifficulty}
          options={DIFFICULTY_OPTIONS}
          color={c.warning}
        />
      </Box>

      {/* Disabled */}
      <Box style={{ gap: 4 }}>
        <Text style={{ color: c.textDim, fontSize: 10 }}>Disabled</Text>
        <Select
          value="cherry"
          options={FRUIT_OPTIONS}
          disabled
        />
      </Box>
    </Box>
  );
}
