/**
 * useNotifications — fires showToast on meaningful status transitions.
 *
 * - running/thinking → idle  → "Task complete"
 * - → waiting_permission      → "Permission required"
 *
 * Accepts showToast from useToast so every notification is automatically
 * logged to the toast history.
 */
import { useEffect, useRef } from 'react';

const ACTIVE = new Set(['running', 'thinking', 'streaming']);

export function useNotifications(
  status:    string,
  showToast: (text: string, duration?: number) => void,
) {
  const showRef = useRef(showToast);
  showRef.current = showToast;

  const prevRef = useRef(status);

  useEffect(() => {
    const prev = prevRef.current;
    prevRef.current = status;

    if (ACTIVE.has(prev) && status === 'idle') {
      showRef.current('✓ Task complete', 3);
    } else if (status === 'waiting_permission' && prev !== 'waiting_permission') {
      showRef.current('⚠ Permission required', 5);
    }
  }, [status]);
}
