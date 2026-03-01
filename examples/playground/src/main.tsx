import React from 'react';
import { createLove2DApp } from '@reactjit/native';
import { App } from './App';

(globalThis as any).__getDevState = () => ({
  code: (globalThis as any).__currentPlaygroundCode,
});

const app = createLove2DApp();
app.render(<App />);
