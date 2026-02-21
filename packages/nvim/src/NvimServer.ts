/**
 * NvimServer — stdio-based render server for Neovim.
 *
 * Neovim spawns this Node.js process via vim.fn.jobstart and reads
 * newline-delimited JSON frames from stdout. Each frame is an array
 * of draw commands with 0-based character-grid coordinates and CSS colors.
 */

import type { ReactNode } from 'react';
import {
  createRenderServer,
  createStdioTransport,
  type RenderServerHandle,
} from '@reactjit/grid';

export interface NvimServerOptions {
  cols?: number;    // default 60
  rows?: number;    // default 20
}

export function createNvimServer(options: NvimServerOptions = {}): RenderServerHandle {
  const cols = options.cols ?? 60;
  const rows = options.rows ?? 20;

  const transport = createStdioTransport();

  return createRenderServer({
    width: cols,
    height: rows,
    transport,
    coordBase: 0,
    // No color mapping — pass CSS strings through; Neovim client creates highlight groups
  });
}
