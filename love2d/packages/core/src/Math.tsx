/**
 * MathBlock -- LaTeX math typesetting (Lua-owned primitive)
 *
 * Emits a 'Math' host element. Lua parses the LaTeX string,
 * computes layout, and renders glyphs directly via Love2D.
 *
 * Usage:
 *   <Math tex="E = mc^2" />
 *   <Math tex="\frac{-b \pm \sqrt{b^2-4ac}}{2a}" fontSize={20} />
 */

import React from 'react';
import { useScaledStyle, useScale } from './ScaleContext';
import type { Style, Color } from './types';

export interface MathProps {
  tex: string;
  inline?: boolean;
  fontSize?: number;
  color?: Color;
  style?: Style;
}

// Named MathBlock internally to avoid shadowing globalThis.Math
function MathBlock({ tex, inline = false, fontSize = 16, color, style }: MathProps) {
  const scale = useScale();
  const scaledStyle = useScaledStyle(style);

  return React.createElement('Math', {
    tex,
    inline: inline ?? false,
    fontSize: Math.round(fontSize * scale),
    color,
    style: { padding: 4, ...scaledStyle },
  });
}

export { MathBlock as Math };
