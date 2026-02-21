import React from 'react';
import { Native } from '../Native';
import type { EffectProps } from './types';

export type TextEffectType =
  | 'terminal'
  | 'gradient-wave'
  | 'neon'
  | 'glitch'
  | 'burst-hover'
  | 'dancing-shadow'
  | 'melting'
  | 'text-mask'
  | 'spin-3d'
  | 'neon-glow'
  | 'wavy-text'
  | 'typewriter'
  | 'typewriter-text'
  | 'gradient-typing'
  | 'editor-illustration'
  | 'hover-transition';

export interface TextEffectProps extends EffectProps {
  /** Visual style variant rendered in Lua. */
  type?: TextEffectType;
  /** Text content to render. */
  text?: string;
  /** Font size in px. Defaults from canvas height. */
  fontSize?: number;
  /** Horizontal text alignment in the effect canvas. */
  align?: 'left' | 'center' | 'right';
  /** Additional spacing between glyphs. */
  letterSpacing?: number;
  /** Character reveal speed for typewriter variants. */
  typingSpeed?: number;
  /** Erase speed for looping typewriter variants. */
  eraseSpeed?: number;
}

/**
 * Lua-native animated typography surface.
 *
 * One-liner usage:
 *   <TextEffect type="terminal" text="boot_sequence::ok" />
 *   <TextEffect type="burst-hover" text="HOVER ME" />
 *   <TextEffect type="spin-3d" text="EAT SLEEP RAVE" />
 */
export function TextEffect({
  type = 'gradient-wave',
  style,
  ...props
}: TextEffectProps) {
  return (
    <Native
      type="TextEffect"
      effectType={type}
      style={{ width: '100%', height: 120, ...(style || {}) }}
      {...props}
    />
  );
}
