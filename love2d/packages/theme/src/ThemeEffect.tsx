import React from 'react';
import { Box, Native } from '@reactjit/core';
import { useThemeEffects } from './useTheme';
import type { ThemeEffectConfig } from './types';

export interface ThemeEffectProps {
  children: React.ReactNode;
  style?: Record<string, unknown>;
}

function renderEffect(config: ThemeEffectConfig, mode: 'background' | 'mask') {
  const modeProps = mode === 'background' ? { background: true } : { mask: true };
  return React.createElement(Native, { type: config.type, ...modeProps, ...(config.props ?? {}) });
}

/**
 * Wraps children with the active theme's background effect and post-processing mask.
 *
 * @example
 * <ThemeEffect>
 *   <Text>Content with themed visual effects</Text>
 * </ThemeEffect>
 */
export function ThemeEffect({ children, style }: ThemeEffectProps) {
  const effects = useThemeEffects();

  return (
    <Box style={style}>
      {effects.background ? renderEffect(effects.background, 'background') : null}
      {children}
      {effects.mask ? renderEffect(effects.mask, 'mask') : null}
    </Box>
  );
}
