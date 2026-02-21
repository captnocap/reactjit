/**
 * CCServer — WebSocket server that bridges React rendering to ComputerCraft.
 *
 * Thin wrapper around @reactjit/grid's render server with CC-specific defaults:
 * 51x19 character grid, 1-based coordinates, 16-color palette quantization.
 */

import type { ReactNode } from 'react';
import {
  createRenderServer,
  createWebSocketTransport,
  type RenderServerHandle,
} from '@reactjit/grid';
import { nearestCCColor, CC_DEFAULT_FG } from './palette';

export interface CCServerOptions {
  port?: number;   // default 8080
  width?: number;  // default 51 (CC terminal width)
  height?: number; // default 19 (CC terminal height)
}

export interface CCServerHandle {
  render(element: ReactNode): void;
  stop(): void;
}

export function createCCServer(options: CCServerOptions = {}): CCServerHandle {
  const port = options.port ?? 8080;
  const width = options.width ?? 51;
  const height = options.height ?? 19;

  const transport = createWebSocketTransport(port);

  return createRenderServer({
    width,
    height,
    transport,
    coordBase: 1,
    flattenOptions: {
      mapColor: nearestCCColor,
      defaultFg: CC_DEFAULT_FG,
    },
  });
}
