/**
 * AwesomeServer — stdio-based render server for AwesomeWM.
 *
 * AwesomeWM spawns this Node.js process via awful.spawn.with_line_callback
 * and reads newline-delimited JSON frames from stdout. Each frame is an array
 * of draw commands with 0-based pixel coordinates and CSS colors.
 */

import type { ReactNode } from 'react';
import {
  createRenderServer,
  createStdioTransport,
  type RenderServerHandle,
} from '@reactjit/grid';

export interface AwesomeServerOptions {
  width?: number;   // default 400 (pixels)
  height?: number;  // default 30 (pixels, typical status bar height)
}

export function createAwesomeServer(options: AwesomeServerOptions = {}): RenderServerHandle {
  const width = options.width ?? 400;
  const height = options.height ?? 30;

  const transport = createStdioTransport();

  return createRenderServer({
    width,
    height,
    transport,
    coordBase: 0,
    // No color mapping — pass CSS strings through; AwesomeWM client parses to Cairo RGBA
  });
}
