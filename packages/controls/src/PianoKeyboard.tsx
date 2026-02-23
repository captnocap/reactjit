/**
 * PianoKeyboard — Lua-owned interactive piano keyboard.
 *
 * All drawing, hit testing, hover, and glissando handled in lua/piano_keyboard.lua.
 * React is a declarative wrapper that passes props and receives boundary events
 * (onKeyDown, onKeyUp).
 */

import React from 'react';
import type { Style, Color } from '@reactjit/core';
import { useScaledStyle, useScale } from '@reactjit/core';

export interface PianoKeyDef {
  id: string;
  label: string;
  note?: number;
}

export interface PianoKeyboardPalette {
  whiteKey?: Color;
  whiteHover?: Color;
  whitePress?: Color;
  whiteActive?: Color;
  blackKey?: Color;
  blackHover?: Color;
  blackPress?: Color;
  blackActive?: Color;
  whiteText?: Color;
  blackText?: Color;
  activeText?: Color;
  whiteBorder?: Color;
  blackBorder?: Color;
  activeBorder?: Color;
}

export interface PianoKeyboardProps {
  whites: PianoKeyDef[];
  blacks?: PianoKeyDef[];
  blackAfter?: number[];
  activeKeys?: string[] | Record<string, boolean>;
  onKeyDown?: (keyId: string, key: PianoKeyDef) => void;
  onKeyUp?: (keyId: string, key: PianoKeyDef) => void;
  showNoteNames?: boolean;
  whiteKeyWidth?: number;
  whiteKeyHeight?: number;
  whiteGap?: number;
  blackKeyWidth?: number;
  blackKeyHeight?: number;
  palette?: PianoKeyboardPalette;
  style?: Style;
}

const DEFAULT_BLACK_AFTER = [0, 1, 3, 4, 5];

export function PianoKeyboard({
  whites,
  blacks = [],
  blackAfter = DEFAULT_BLACK_AFTER,
  activeKeys,
  onKeyDown,
  onKeyUp,
  showNoteNames = true,
  whiteKeyWidth = 44,
  whiteKeyHeight = 120,
  whiteGap = 2,
  blackKeyWidth = 28,
  blackKeyHeight = 72,
  palette = {},
  style,
}: PianoKeyboardProps) {
  const scale = useScale();
  const scaledStyle = useScaledStyle(style);

  const sWhiteKeyWidth = Math.round(whiteKeyWidth * scale);
  const sWhiteKeyHeight = Math.round(whiteKeyHeight * scale);
  const sWhiteGap = Math.max(0, Math.round(whiteGap * scale));
  const sBlackKeyWidth = Math.round(blackKeyWidth * scale);
  const sBlackKeyHeight = Math.round(blackKeyHeight * scale);

  const totalW = whites.length * sWhiteKeyWidth + Math.max(0, whites.length - 1) * sWhiteGap;

  // ── Native mode: Lua-owned host element ──────────────────
  // All drawing, hit testing, and glissando handled in lua/piano_keyboard.lua.
  // React only receives onKeyDown/onKeyUp via buffered events.
  return React.createElement('PianoKeyboard', {
    whites: JSON.stringify(whites),
    blacks: JSON.stringify(blacks),
    blackAfter: JSON.stringify(blackAfter),
    activeKeys: activeKeys ? JSON.stringify(activeKeys) : undefined,
    showNoteNames,
    whiteKeyWidth: sWhiteKeyWidth,
    whiteKeyHeight: sWhiteKeyHeight,
    whiteGap: sWhiteGap,
    blackKeyWidth: sBlackKeyWidth,
    blackKeyHeight: sBlackKeyHeight,
    palette: JSON.stringify(palette),
    onKeyDown: onKeyDown
      ? (e: any) => onKeyDown(e.value?.keyId ?? e.keyId, e.value?.key ?? e.key)
      : undefined,
    onKeyUp: onKeyUp
      ? (e: any) => onKeyUp(e.value?.keyId ?? e.keyId, e.value?.key ?? e.key)
      : undefined,
    style: {
      width: totalW,
      height: sWhiteKeyHeight,
      ...scaledStyle,
    },
  });
}
