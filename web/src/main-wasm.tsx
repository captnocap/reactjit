import React from 'react';
import { createWasmApp } from '@reactjit/native';
import { App } from './App';

const app = createWasmApp();
app.render(<App />);
