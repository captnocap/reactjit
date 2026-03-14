import React from 'react';
import { Box } from '@reactjit/core';
import { ThemeProvider } from '@reactjit/theme';
import { GradioApp } from '@reactjit/gradio';

const GRADIO_URL = 'http://localhost:7861';

export default function App() {
  return (
    <ThemeProvider>
      <Box style={{ width: '100%', height: '100%', backgroundColor: '#0f0f1a' }}>
        <GradioApp url={GRADIO_URL} />
      </Box>
    </ThemeProvider>
  );
}
