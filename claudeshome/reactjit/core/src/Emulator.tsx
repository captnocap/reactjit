/**
 * <Emulator> — NES emulation surface primitive
 *
 * Renders a NES ROM via the Agnes emulator core into a Canvas at layout position.
 * Native only — returns null in web mode.
 *
 * ROM loading: either via `src` prop (Love2D filesystem) or drag-and-drop
 * a .nes file onto the component. Lua handles file drops directly — no
 * bridge round-trip.
 *
 * Usage:
 *   <Emulator src="zelda.nes" playing />
 *   <Emulator style={{ width: 512, height: 480 }} onROMLoaded={e => console.log(e.filename)} />
 */

import React from 'react';
import { useRendererMode } from './context';
import { useScaledStyle } from './ScaleContext';
import type { EmulatorProps, Style } from './types';

/** Build a Style from Emulator shorthand props. style={} overrides. */
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
  const mode = useRendererMode();

  if (mode === 'web') return null;

  const hostProps: any = {
    src,
    playing,
    style: scaledStyle,
    onROMLoaded,
  };

  return React.createElement('Emulator', hostProps);
}
