/**
 * HammerspoonServer — WebSocket-based render server for Hammerspoon.
 *
 * Hammerspoon connects via hs.http.websocket and receives JSON frames
 * containing draw commands with 0-based pixel coordinates and CSS colors.
 */

import type { ReactNode } from 'react';
import {
  createRenderServer,
  createWebSocketTransport,
  type RenderServerHandle,
} from '@reactjit/grid';

export interface HammerspoonServerOptions {
  port?: number;    // default 8080
  width?: number;   // default 400 (pixels)
  height?: number;  // default 300 (pixels)
}

export function createHammerspoonServer(options: HammerspoonServerOptions = {}): RenderServerHandle {
  const port = options.port ?? 8080;
  const width = options.width ?? 400;
  const height = options.height ?? 300;

  const transport = createWebSocketTransport(port);

  return createRenderServer({
    width,
    height,
    transport,
    coordBase: 0,
    // No color mapping — pass CSS strings through; Hammerspoon client parses to color tables
  });
}
