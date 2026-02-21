/**
 * Neovim Demo entry point.
 *
 * Outputs newline-delimited JSON draw commands to stdout.
 * Neovim reads these via vim.fn.jobstart's on_stdout callback.
 */

import React from 'react';
import { createNvimServer } from '@reactjit/nvim';
import App from './App';

const server = createNvimServer({
  cols: 60,
  rows: 20,
});

// Diagnostic output goes to stderr (Neovim shows via on_stderr)
console.error('ReactJIT Neovim demo started (60x20)');

server.render(<App />);
