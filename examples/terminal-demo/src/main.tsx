/**
 * Terminal Demo entry point.
 *
 * Renders a React dashboard directly in the terminal using ANSI escape codes.
 * No Lua, no WebSocket — pure JavaScript rendering.
 */

import React from 'react';
import { createTerminalApp } from '@reactjit/terminal';
import App from './App';

const app = createTerminalApp({
  fps: 30,
  fullscreen: true,
});

app.render(<App />);
