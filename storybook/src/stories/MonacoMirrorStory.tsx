import React, { useCallback, useState } from 'react';
import { Box, MonacoMirror, Text } from '../../../packages/core/src';
import { useThemeColors } from '../../../packages/theme/src';

const STARTER_CODE = `import React from 'react';
import { Box, Text, Pressable } from '@reactjit/core';

export function App() {
  const [count, setCount] = React.useState(0);

  return (
    <Box style={{
      width: '100%',
      height: '100%',
      justifyContent: 'center',
      alignItems: 'center',
      gap: 8,
      backgroundColor: '#111827',
    }}>
      <Text style={{ color: '#e5e7eb', fontSize: 13 }}>
        {count}
      </Text>
      <Pressable
        onPress={() => setCount(v => v + 1)}
        style={{
          backgroundColor: '#2563eb',
          borderRadius: 6,
          paddingLeft: 12,
          paddingRight: 12,
          paddingTop: 8,
          paddingBottom: 8,
        }}
      >
        <Text style={{ color: '#ffffff', fontSize: 11 }}>
          Increment
        </Text>
      </Pressable>
    </Box>
  );
}`;

export function MonacoMirrorStory() {
  const c = useThemeColors();
  const [code, setCode] = useState(STARTER_CODE);
  const [lastSubmitChars, setLastSubmitChars] = useState(STARTER_CODE.length);

  const handleLiveChange = useCallback((next: string) => {
    setCode(next);
  }, []);

  const handleSubmit = useCallback((next: string) => {
    setCode(next);
    setLastSubmitChars(next.length);
  }, []);

  return (
    <Box
      style={{
        width: '100%',
        height: '100%',
        backgroundColor: c.bg,
        paddingLeft: 12,
        paddingRight: 12,
        paddingTop: 12,
        paddingBottom: 12,
        gap: 8,
      }}
    >
      <Box
        style={{
          flexShrink: 0,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <Text style={{ color: c.text, fontSize: 13, fontWeight: 'bold' }}>{'Monaco Mirror'}</Text>
        <Text style={{ color: c.textDim, fontSize: 10 }}>{`Last submit: ${lastSubmitChars} chars`}</Text>
      </Box>

      <Box style={{ flexGrow: 1, minHeight: 0 }}>
        <MonacoMirror
          value={code}
          onLiveChange={handleLiveChange}
          onSubmit={handleSubmit}
          placeholder="Write TypeScript here..."
          filePath="src/playground/CounterCard.tsx"
          workspaceLabel="reactjit-playground"
          branch="feature/monaco-mirror"
          language="typescript"
          spellCheck={false}
          wordWrap={false}
        />
      </Box>
    </Box>
  );
}
