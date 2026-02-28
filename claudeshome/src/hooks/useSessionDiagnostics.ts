/**
 * useSessionDiagnostics — tracks Claude status transitions over time.
 *
 * Accumulates time spent in each state, records recent transitions,
 * and counts permission requests. Pure React — no Lua required.
 */
import { useState, useEffect, useRef } from 'react';
import { useLuaInterval } from '@reactjit/core';

export interface StateSegment {
  state: string;
  startedAt: number;
  durationMs: number; // 0 while current, fills in when state ends
}

export interface DiagnosticData {
  currentState: string;
  sessionStartMs: number;
  uptimeMs: number;
  /** Accumulated milliseconds per state */
  stateDurations: Record<string, number>;
  /** Last 30 state transitions */
  history: StateSegment[];
  /** How many times we've been in waiting_permission */
  permissionCount: number;
  /** How many times we've exited waiting_permission (resolved) */
  permissionResolved: number;
}

export function useSessionDiagnostics(status: string): DiagnosticData {
  const sessionStartMs = useRef(Date.now()).current;

  // Mutable ref for accumulated state — not reactive (updated every tick)
  const durationsRef = useRef<Record<string, number>>({});
  const historyRef = useRef<StateSegment[]>([]);
  const permCountRef = useRef(0);
  const permResolvedRef = useRef(0);
  const currentSegmentRef = useRef<StateSegment>({
    state: status,
    startedAt: Date.now(),
    durationMs: 0,
  });

  // Reactive snapshot for renders
  const [snap, setSnap] = useState<DiagnosticData>(() => ({
    currentState: status,
    sessionStartMs,
    uptimeMs: 0,
    stateDurations: {},
    history: [],
    permissionCount: 0,
    permissionResolved: 0,
  }));

  // When status changes: close previous segment, open new one
  const prevStatusRef = useRef(status);
  useEffect(() => {
    if (status === prevStatusRef.current) return;
    const prev = prevStatusRef.current;
    const now = Date.now();

    // Close previous segment
    const closed: StateSegment = {
      state: prev,
      startedAt: currentSegmentRef.current.startedAt,
      durationMs: now - currentSegmentRef.current.startedAt,
    };
    const durations = durationsRef.current;
    durations[prev] = (durations[prev] ?? 0) + closed.durationMs;

    const history = historyRef.current;
    history.push(closed);
    if (history.length > 30) history.splice(0, history.length - 30);

    // Track permission transitions
    if (status === 'waiting_permission') {
      permCountRef.current += 1;
    }
    if (prev === 'waiting_permission') {
      permResolvedRef.current += 1;
    }

    // Open new segment
    currentSegmentRef.current = { state: status, startedAt: now, durationMs: 0 };
    prevStatusRef.current = status;
  }, [status]);

  // Tick every second to keep uptimeMs and current segment live
  useLuaInterval(1000, () => {
    const now = Date.now();
    setSnap({
      currentState: status,
      sessionStartMs,
      uptimeMs: now - sessionStartMs,
      stateDurations: { ...durationsRef.current },
      history: historyRef.current.slice(),
      permissionCount: permCountRef.current,
      permissionResolved: permResolvedRef.current,
    });
  });

  return snap;
}

export function formatMs(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const rs = s % 60;
  if (m < 60) return `${m}m ${rs}s`;
  const h = Math.floor(m / 60);
  const rm = m % 60;
  return `${h}h ${rm}m`;
}
