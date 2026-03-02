import React from 'react';
import { useScaledStyle } from './ScaleContext';
import type { EmulatorProps, Style } from './types';

function resolveEmulatorStyle(props: EmulatorProps): Style | undefined {
  const { w, h, style } = props;

  if (w === undefined && h === undefined) {
    return style;
  }

  const base: Style = {};
  if (w !== undefined) base.width = w;
  if (h !== undefined) base.height = h;

  return style ? { ...base, ...style } : base;
}

export function Emulator(props: EmulatorProps) {
  const { src, playing = true, onROMLoaded } = props;
  const resolvedStyle = resolveEmulatorStyle(props);
  const scaledStyle = useScaledStyle(resolvedStyle);

  const hostProps: any = {
    src,
    playing,
    style: scaledStyle,
    onROMLoaded,
  };

  return React.createElement('Emulator', hostProps);
}
