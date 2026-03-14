import React from 'react';
import { createWasmApp } from '@reactjit/renderer';
import { App } from './App';

const app = createWasmApp();
app.render(<App />);
