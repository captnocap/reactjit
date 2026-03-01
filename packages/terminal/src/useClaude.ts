import { useState, useCallback } from 'react';
import { useLoveRPC } from '@reactjit/core';
import type { PermissionInfo, QuestionInfo, ClaudeState } from './types';

/**
 * useClaude — manage a Claude Code session's permission/question/status state.
 *
 * Wire the returned event handlers onto <Native type="ClaudeCode" .../>
 * and use `respond`/`respondQuestion` from your modal buttons.
 *
 * @example
 * const claude = useClaude();
 * <Native type="ClaudeCode" workingDir="." model="sonnet"
 *   onStatusChange={claude.onStatusChange}
 *   onPermissionRequest={claude.onPerm}
 *   onPermissionResolved={claude.onPermResolved}
 *   onQuestionPrompt={claude.onQuestion}
 * />
 * <PermissionModal perm={claude.perm} onRespond={claude.respond} />
 */
export function useClaude(): ClaudeState {
  const [perm, setPerm] = useState<PermissionInfo | null>(null);
  const [question, setQuestion] = useState<QuestionInfo | null>(null);
  const [status, setStatus] = useState<string>('idle');
  const [autoAccept, setAutoAccept] = useState(false);
  const rpcRespond = useLoveRPC('claude:respond');
  const rpcAutoAccept = useLoveRPC('claude:autoaccept');

  const toggleAutoAccept = useCallback(async () => {
    const res = await rpcAutoAccept({ toggle: true }) as any;
    setAutoAccept(!!res?.autoAccept);
  }, [rpcAutoAccept]);

  // Sync from Lua on mount (survives HMR)
  const syncAutoAccept = useCallback(async () => {
    const res = await rpcAutoAccept({}) as any;
    setAutoAccept(!!res?.autoAccept);
  }, [rpcAutoAccept]);
  useState(() => { syncAutoAccept(); });

  const onPerm = useCallback((e: any) => {
    setPerm({
      action: e.action || 'Tool',
      target: e.target || '',
      question: e.question || '',
    });
  }, []);

  const onPermResolved = useCallback(() => {
    setPerm(null);
  }, []);

  const respond = useCallback((choice: number) => {
    rpcRespond({ choice });
    setPerm(null);
  }, [rpcRespond]);

  const onQuestion = useCallback((e: any) => {
    setQuestion({
      question: e.question || '',
      options: e.options || [],
    });
  }, []);

  const respondQuestion = useCallback((optionIndex: number) => {
    rpcRespond({ choice: optionIndex });
    setQuestion(null);
  }, [rpcRespond]);

  const onStatusChange = useCallback((e: any) => {
    const s = e.status || e.state || 'idle';
    setStatus(s);
  }, []);

  return {
    perm, question, status, autoAccept,
    toggleAutoAccept,
    onPerm, onPermResolved, onQuestion, onStatusChange,
    respond, respondQuestion,
  };
}
