import React, { useCallback, useState } from 'react';
import { Box, MonacoMirror, Text, classifiers as S} from '../../../packages/core/src';
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

const EXPLORER_FILES = [
  'src/playground/CounterCard.tsx',
  'src/playground/PreviewPane.tsx',
  'src/playground/index.ts',
  'src/components/EditorShell.tsx',
  'src/components/FileTree.tsx',
  'src/hooks/useEditorState.ts',
  'src/styles/tokens.ts',
  'package.json',
  'tsconfig.json',
];

export function MonacoMirrorStory() {
  const c = useThemeColors();
  const [code, setCode] = useState(STARTER_CODE);
  const [lastSubmitChars, setLastSubmitChars] = useState(STARTER_CODE.length);
  const [selectedFile, setSelectedFile] = useState('src/playground/CounterCard.tsx');

  const handleChange = useCallback((next: string) => {
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
        <S.StoryHeadline>{'Monaco Mirror'}</S.StoryHeadline>
        <S.StoryMuted>{`Last submit: ${lastSubmitChars} chars`}</S.StoryMuted>
      </Box>
      <S.StoryCap>{`Selected: ${selectedFile}`}</S.StoryCap>

      <Box style={{ flexGrow: 1, minHeight: 0, gap: 10 }}>
        <MonacoMirror
          value={code}
          onChange={handleChange}
          onSubmit={handleSubmit}
          changeDelay={0.08}
          placeholder="Write TypeScript here..."
          filePath="src/playground/CounterCard.tsx"
          selectedFilePath={selectedFile}
          onFileSelect={setSelectedFile}
          workspaceLabel="reactjit-playground"
          branch="feature/monaco-mirror"
          language="typescript"
          explorerFiles={EXPLORER_FILES}
          spellCheck={false}
          wordWrap={false}
        />

        <Box style={{ flexShrink: 0, alignItems: 'center', gap: 6 }}>
          <S.StoryMuted>{'Constrained sample (620x260, explorer + minimap still fit)'}</S.StoryMuted>
          <MonacoMirror
            defaultValue={STARTER_CODE}
            style={{ width: 620, height: 260 }}
            filePath="src/playground/CounterCard.tsx"
            workspaceLabel="constrained-panel"
            branch="fit-check"
            language="typescript"
            explorerFiles={EXPLORER_FILES}
          />

          <S.StoryMuted>{'Auto-compact sample (400x200)'}</S.StoryMuted>
          <MonacoMirror
            defaultValue={STARTER_CODE}
            style={{ width: 400, height: 200 }}
            filePath="src/small/Widget.tsx"
            workspaceLabel="small-panel"
            branch="compact"
            language="typescript"
            explorerFiles={EXPLORER_FILES}
          />
        </Box>
      </Box>
    </Box>
  );
}
