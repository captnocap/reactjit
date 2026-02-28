import { useState, useCallback } from 'react';
import { useLoveRPC } from '@reactjit/core';

export interface PermissionInfo {
  action: string;
  target: string;
  question: string;
}

export interface QuestionInfo {
  question: string;
  options: string[];
}

export function useClaude() {
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
  // Fire once on mount
  useState(() => { syncAutoAccept(); });

  const onPerm = useCallback((e: any) => {
    // Auto-accept is handled in Lua now — this only fires when auto-accept is off
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
    perm,
    question,
    status,
    autoAccept,
    toggleAutoAccept,
    onPerm,
    onPermResolved,
    onQuestion,
    onStatusChange,
    respond,
    respondQuestion,
  };
}
