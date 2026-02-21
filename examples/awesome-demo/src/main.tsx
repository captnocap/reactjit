/**
 * AwesomeWM Demo entry point.
 *
 * Outputs newline-delimited JSON draw commands to stdout.
 * AwesomeWM reads these via awful.spawn.with_line_callback.
 */

import React from 'react';
import { createAwesomeServer } from '@reactjit/awesome';
import App from './App';

const server = createAwesomeServer({
  width: 400,
  height: 30,
});

// Diagnostic output goes to stderr (AwesomeWM shows via naughty.notify)
console.error('ReactJIT AwesomeWM demo started (400x30)');

server.render(<App />);
