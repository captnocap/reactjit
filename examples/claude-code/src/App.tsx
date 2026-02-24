import React from 'react';
import { Box, Native, PortalHost } from '@reactjit/core';
import { C } from './theme';
import { useClaude } from './hooks/useClaude';
import { PermissionModal } from './components/PermissionModal';
import { QuestionModal } from './components/QuestionModal';

export function App() {
  const claude = useClaude();

  return (
    <PortalHost>
      <Box style={{ width: '100%', height: '100%', backgroundColor: C.bg }}>
        <Native
          type="ClaudeCode"
          workingDir="/home/siah/creative/reactjit"
          model="sonnet"
          sessionId="default"
          onPermissionRequest={claude.onPerm}
          onPermissionResolved={claude.onPermResolved}
          onQuestionPrompt={claude.onQuestion}
        />

        <Native
          type="ClaudeCanvas"
          sessionId="default"
          style={{ flexGrow: 1 }}
        />

        <PermissionModal perm={claude.perm} onRespond={claude.respond} />
        <QuestionModal question={claude.question} onRespond={claude.respondQuestion} />
      </Box>
    </PortalHost>
  );
}
