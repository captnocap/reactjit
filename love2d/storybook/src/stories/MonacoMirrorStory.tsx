import React, { useState } from 'react';
import { Box, MonacoMirror, classifiers as S} from '../../../packages/core/src';
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

const FILE_CONTENTS: Record<string, string> = {
  'src/playground/CounterCard.tsx': STARTER_CODE,
  'src/playground/PreviewPane.tsx': `import React from 'react';
import { Box, Text } from '@reactjit/core';

export function PreviewPane({ fileName }: { fileName: string }) {
  return (
    <Box style={{
      width: '100%',
      backgroundColor: '#0f172a',
      borderWidth: 1,
      borderColor: '#1e293b',
      borderRadius: 8,
      paddingLeft: 12,
      paddingRight: 12,
      paddingTop: 10,
      paddingBottom: 10,
      gap: 6,
    }}>
      <Text style={{ color: '#e2e8f0', fontSize: 12 }}>
        {'Live preview'}
      </Text>
      <Text style={{ color: '#94a3b8', fontSize: 10 }}>
        {fileName}
      </Text>
    </Box>
  );
}`,
  'src/components/EditorShell.tsx': `import React from 'react';
import { Box, MonacoMirror } from '@reactjit/core';

export function EditorShell({ code, selectedFile }: {
  code: string;
  selectedFile: string;
}) {
  return (
    <Box style={{ width: '100%', height: '100%' }}>
      <MonacoMirror
        value={code}
        filePath={selectedFile}
        workspaceLabel="reactjit-playground"
      />
    </Box>
  );
}`,
  'src/hooks/useEditorState.ts': `import { useState } from 'react';

export function useEditorState(initialFile: string) {
  const [selectedFile, setSelectedFile] = useState(initialFile);
  const [dirtyFiles, setDirtyFiles] = useState<string[]>([]);

  function markDirty(path: string) {
    setDirtyFiles((current) => current.includes(path) ? current : [...current, path]);
  }

  return {
    selectedFile,
    setSelectedFile,
    dirtyFiles,
    markDirty,
  };
}`,
};

const OPEN_FILES = Object.keys(FILE_CONTENTS);

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
  const [fileContents, setFileContents] = useState<Record<string, string>>(FILE_CONTENTS);
  const [lastSubmitChars, setLastSubmitChars] = useState(STARTER_CODE.length);
  const [selectedFile, setSelectedFile] = useState(OPEN_FILES[0]);
  const activeCode = fileContents[selectedFile] ?? STARTER_CODE;

  const handleChange = (next: string) => {
    setFileContents((current) => ({
      ...current,
      [selectedFile]: next,
    }));
  };

  const handleSubmit = (next: string) => {
    setFileContents((current) => ({
      ...current,
      [selectedFile]: next,
    }));
    setLastSubmitChars(next.length);
  };

  return (
    <S.StoryRoot style={{ paddingLeft: 12, paddingRight: 12, paddingTop: 12, paddingBottom: 12, gap: 8 }}>
      <S.RowCenter style={{ flexShrink: 0, justifyContent: 'space-between' }}>
        <S.StoryHeadline>{'Monaco Mirror'}</S.StoryHeadline>
        <S.StoryMuted>{`Last submit: ${lastSubmitChars} chars`}</S.StoryMuted>
      </S.RowCenter>
      <S.StoryCap>{`Selected: ${selectedFile}`}</S.StoryCap>

      <Box style={{ flexGrow: 1, minHeight: 0, gap: 10 }}>
        <MonacoMirror
          value={activeCode}
          onChange={handleChange}
          onSubmit={handleSubmit}
          changeDelay={0.08}
          placeholder="Write TypeScript here..."
          filePath="src/playground/CounterCard.tsx"
          selectedFilePath={selectedFile}
          onFileSelect={setSelectedFile}
          openFiles={OPEN_FILES}
          workspaceLabel="reactjit-playground"
          branch="feature/monaco-navigation"
          language="typescript"
          activityItems={['TAB', 'EX', 'CODE', 'MAP']}
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
            openFiles={OPEN_FILES}
            workspaceLabel="constrained-panel"
            branch="fit-check"
            language="typescript"
            activityItems={['TAB', 'EX', 'CODE', 'MAP']}
            explorerFiles={EXPLORER_FILES}
          />

          <S.StoryMuted>{'Auto-compact sample (400x200)'}</S.StoryMuted>
          <MonacoMirror
            defaultValue={STARTER_CODE}
            style={{ width: 400, height: 200 }}
            filePath="src/small/Widget.tsx"
            openFiles={OPEN_FILES.slice(0, 3)}
            workspaceLabel="small-panel"
            branch="compact"
            language="typescript"
            activityItems={['TAB', 'EX', 'CODE', 'MAP']}
            explorerFiles={EXPLORER_FILES}
          />
        </Box>
      </Box>
    </S.StoryRoot>
  );
}
