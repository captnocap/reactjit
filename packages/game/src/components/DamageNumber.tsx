import React, { useState, useEffect, useRef } from 'react';
import { Box, Text } from '@reactjit/core';

export interface DamageNumberProps {
  amount: number;
  x: number;
  y: number;
  color?: string;
  /** Duration in ms before fading */
  duration?: number;
  onComplete?: () => void;
}

export function DamageNumber({
  amount,
  x,
  y,
  color = '#ef4444',
  duration = 800,
  onComplete,
}: DamageNumberProps) {
  const [elapsed, setElapsed] = useState(0);
  const startRef = useRef(performance.now());

  useEffect(() => {
    const tick = () => {
      const now = performance.now();
      const e = now - startRef.current;
      setElapsed(e);
      if (e < duration) {
        setTimeout(tick, 16);
      } else {
        onComplete?.();
      }
    };
    const id = setTimeout(tick, 16);
    return () => clearTimeout(id);
  }, [duration, onComplete]);

  const progress = Math.min(1, elapsed / duration);
  const offsetY = -30 * progress;
  const opacity = 1 - progress * progress;

  if (opacity <= 0) return null;

  return React.createElement(
    Box,
    {
      style: {
        position: 'absolute',
        left: x - 10,
        top: y + offsetY,
        opacity,
      },
    },
    React.createElement(Text, {
      style: {
        fontSize: 14,
        fontWeight: 'bold',
        color,
      },
    }, `${amount > 0 ? '-' : '+'}${Math.abs(amount)}`),
  );
}
