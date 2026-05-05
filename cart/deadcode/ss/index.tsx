import { useEffect, useState } from 'react';
import { Box, Text } from '@reactjit/runtime/primitives';

export default function SS() {
  return (
    <Box style={{ width: '100%', height: '100%', backgroundColor: 'black' }}>
      <Text style={{ color: 'white' }}>Hello, world!</Text>
    </Box>
  );
}