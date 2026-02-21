import React from 'react';
import { createLove2DApp } from '../reactjit/native/src/Love2DApp';
import { App } from './App';

const app = createLove2DApp();
app.render(<App />);
