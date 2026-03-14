import React from 'react';
import { render, Box, Text } from '@reactjit/core';

function App() {
  // Create 50 navigation items to force scrolling
  const items = Array.from({ length: 50 }, (_, i) => `Nav Item ${i + 1}`);

  return (
    <Box
      width="100%"
      height="100%"
      backgroundColor="#1a1a1e"
    >
      {/* Navigation Panel */}
      <Box
        width={200}
        height="100%"
        backgroundColor="#252529"
        overflow="scroll"
        padding={8}
      >
        {items.map((item, index) => (
          <Box
            key={index}
            padding={8}
            marginBottom={4}
            backgroundColor="#2d2d32"
            borderRadius={4}
          >
            <Text fontSize={14} color="#e0e0e0">
              {item}
            </Text>
          </Box>
        ))}
      </Box>

      {/* Main Content */}
      <Box
        flexGrow={1}
        padding={20}
        justifyContent="center"
        alignItems="center"
      >
        <Text fontSize={24} color="#ffffff">
          Inspector Scroll Test
        </Text>
        <Text fontSize={16} color="#888888" marginTop={16}>
          Press F12 to open inspector
        </Text>
        <Text fontSize={14} color="#666666" marginTop={8}>
          Scroll the nav panel and hover over items
        </Text>
      </Box>
    </Box>
  );
}

render(<App />);
