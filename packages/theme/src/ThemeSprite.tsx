import React from 'react';
import { Native } from '@reactjit/core';
import { useThemeSprites } from './useTheme';
import type { Style } from '@reactjit/core';

export interface ThemeSpriteProps {
  /** Name of the sprite atlas defined in the theme. */
  atlas: string;
  /** Frame index (number) or named frame (string) to render. */
  frame: number | string;
  /** Style props for sizing/positioning. */
  style?: Style;
}

/**
 * Renders a single frame from a theme-defined sprite atlas.
 *
 * @example
 * <ThemeSprite atlas="icons" frame="arrow-right" style={{ width: 24, height: 24 }} />
 * <ThemeSprite atlas="decorations" frame={3} />
 */
export function ThemeSprite({ atlas, frame, style }: ThemeSpriteProps) {
  const sprites = useThemeSprites();
  const config = sprites.atlases[atlas];
  if (!config) return null;

  const frameIndex = typeof frame === 'string'
    ? (config.frames?.[frame] ?? 0)
    : frame;

  return (
    <Native
      type="Sprite"
      src={config.src}
      cols={config.cols}
      rows={config.rows}
      frameWidth={config.frameWidth}
      frameHeight={config.frameHeight}
      frameIndex={frameIndex}
      style={style}
    />
  );
}
