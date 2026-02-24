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
  const rpcRespond = useLoveRPC('claude:respond');

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

  return {
    perm,
    question,
    onPerm,
    onPermResolved,
    onQuestion,
    respond,
    respondQuestion,
  };
}
