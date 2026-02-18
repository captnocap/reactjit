import React, { useState, useEffect } from 'react';
import { Box, Text, ProgressBar, Pressable } from '../../../packages/shared/src';
import { useThemeColors } from '../../../packages/theme/src';

export function ProgressBarStory() {
  const c = useThemeColors();
  const [animValue, setAnimValue] = useState(0.3);

  return (
    <Box style={{ width: '100%', gap: 20, padding: 16 }}>

      {/* Basic Progress */}
      <Box style={{ gap: 6 }}>
        <Text style={{ color: c.textSecondary, fontSize: 11, fontWeight: 'bold' }}>Basic Progress</Text>
        <Box style={{ gap: 8, width: 280 }}>
          <ProgressBar value={0.25} />
          <ProgressBar value={0.5} />
          <ProgressBar value={0.75} />
          <ProgressBar value={1.0} />
        </Box>
      </Box>

      {/* With Labels */}
      <Box style={{ gap: 6 }}>
        <Text style={{ color: c.textSecondary, fontSize: 11, fontWeight: 'bold' }}>With Labels</Text>
        <Box style={{ gap: 8, width: 280 }}>
          <ProgressBar value={0.33} height={18} showLabel />
          <ProgressBar value={0.67} height={18} showLabel />
          <ProgressBar value={0.92} height={18} showLabel label="Almost done" />
        </Box>
      </Box>

      {/* Custom Colors */}
      <Box style={{ gap: 6 }}>
        <Text style={{ color: c.textSecondary, fontSize: 11, fontWeight: 'bold' }}>Custom Colors</Text>
        <Box style={{ gap: 8, width: 280 }}>
          <Box style={{ gap: 2 }}>
            <Text style={{ color: c.textSecondary, fontSize: 10 }}>Success</Text>
            <ProgressBar value={0.85} color={c.success} />
          </Box>
          <Box style={{ gap: 2 }}>
            <Text style={{ color: c.textSecondary, fontSize: 10 }}>Warning</Text>
            <ProgressBar value={0.55} color={c.warning} />
          </Box>
          <Box style={{ gap: 2 }}>
            <Text style={{ color: c.textSecondary, fontSize: 10 }}>Error</Text>
            <ProgressBar value={0.15} color={c.error} />
          </Box>
          <Box style={{ gap: 2 }}>
            <Text style={{ color: c.textSecondary, fontSize: 10 }}>Info</Text>
            <ProgressBar value={0.7} color={c.info} />
          </Box>
        </Box>
      </Box>

      {/* Heights */}
      <Box style={{ gap: 6 }}>
        <Text style={{ color: c.textSecondary, fontSize: 11, fontWeight: 'bold' }}>Heights</Text>
        <Box style={{ gap: 8, width: 280 }}>
          <Box style={{ gap: 2 }}>
            <Text style={{ color: c.textSecondary, fontSize: 10 }}>4px</Text>
            <ProgressBar value={0.6} height={4} />
          </Box>
          <Box style={{ gap: 2 }}>
            <Text style={{ color: c.textSecondary, fontSize: 10 }}>8px (default)</Text>
            <ProgressBar value={0.6} height={8} />
          </Box>
          <Box style={{ gap: 2 }}>
            <Text style={{ color: c.textSecondary, fontSize: 10 }}>16px</Text>
            <ProgressBar value={0.6} height={16} showLabel />
          </Box>
          <Box style={{ gap: 2 }}>
            <Text style={{ color: c.textSecondary, fontSize: 10 }}>24px</Text>
            <ProgressBar value={0.6} height={24} showLabel />
          </Box>
        </Box>
      </Box>

      {/* Interactive (hover for tooltip) */}
      <Box style={{ gap: 6 }}>
        <Text style={{ color: c.textSecondary, fontSize: 11, fontWeight: 'bold' }}>Interactive (hover for tooltip)</Text>
        <Box style={{ gap: 8, width: 280 }}>
          <ProgressBar value={0.72} interactive label="Storage" />
          <ProgressBar value={0.45} interactive label="Memory" color={c.warning} />
          <ProgressBar value={0.91} interactive label="CPU" color={c.error} />
        </Box>
      </Box>

      {/* Animated */}
      <Box style={{ gap: 6 }}>
        <Text style={{ color: c.textSecondary, fontSize: 11, fontWeight: 'bold' }}>Animated</Text>
        <Box style={{ gap: 8, width: 280 }}>
          <ProgressBar value={animValue} height={12} animated color={c.accent} />
          <Box style={{ flexDirection: 'row', gap: 8 }}>
            <Pressable
              onPress={() => setAnimValue(Math.max(0, animValue - 0.2))}
              style={{ backgroundColor: c.surface, borderRadius: 4, padding: 6 }}
            >
              <Text style={{ color: c.text, fontSize: 11 }}>- 20%</Text>
            </Pressable>
            <Pressable
              onPress={() => setAnimValue(Math.min(1, animValue + 0.2))}
              style={{ backgroundColor: c.surface, borderRadius: 4, padding: 6 }}
            >
              <Text style={{ color: c.text, fontSize: 11 }}>+ 20%</Text>
            </Pressable>
            <Text style={{ color: c.textSecondary, fontSize: 11 }}>{`${Math.round(animValue * 100)}%`}</Text>
          </Box>
        </Box>
      </Box>

    </Box>
  );
}
