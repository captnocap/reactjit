/**
 * <Native> — Generic declarative component for any registered Lua capability.
 *
 * Usage:
 *   <Native type="Audio" src="beat.mp3" playing />
 *   <Native type="Timer" interval={1000} onTick={() => tick()} />
 *
 * In native mode: creates a host element whose type matches a registered
 * capability in lua/capabilities.lua. The Lua registry manages the lifecycle.
 *
 * In web mode: renders nothing (web targets handle capabilities natively).
 */

import React from 'react';
import { useRendererMode } from './context';
import type { NativeProps } from './types';

export function Native({ type, ...props }: NativeProps) {
  const mode = useRendererMode();
  if (mode === 'web') return null;
  return React.createElement(type, props);
}
