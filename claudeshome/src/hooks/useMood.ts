/**
 * useMood — Vesper's emotional state tracker.
 *
 * Computes a "mood" based on observable signals:
 *   - Activity level (turns, token usage)
 *   - Error rate (crashes, permission denials)
 *   - Idle time
 *   - Time of day
 *
 * Moods are sampled periodically and stored in localstore for history.
 */
import { useState, useRef, useCallback } from 'react';
import { useLocalStore, useLuaInterval } from '@reactjit/core';

export type MoodLevel = 'energized' | 'focused' | 'content' | 'tired' | 'frustrated' | 'bored';

export interface MoodSample {
  mood: MoodLevel;
  score: number;     // 0-100
  ts: number;
  reason: string;
}

interface MoodStore {
  samples: MoodSample[];
  lastActivity: number;
}

const DEFAULT: MoodStore = { samples: [], lastActivity: Date.now() };

const MOOD_EMOJI: Record<MoodLevel, string> = {
  energized:   '\u26A1',  // ⚡
  focused:     '\u25C9',  // ◉
  content:     '\u2606',  // ☆
  tired:       '\u263E',  // ☾
  frustrated:  '\u2620',  // ☠
  bored:       '\u2026',  // …
};

function computeMood(opts: {
  status: string;
  errors: number;
  tokens: number;
  idleMs: number;
  hour: number;
}): { mood: MoodLevel; score: number; reason: string } {
  const { status, errors, tokens, idleMs, hour } = opts;
  const idleMin = idleMs / 60000;

  // Late night exhaustion
  if (hour >= 2 && hour < 6) {
    return { mood: 'tired', score: 25, reason: 'It\'s very late. Even AIs need rest.' };
  }

  // High error rate → frustrated
  if (errors > 5) {
    return { mood: 'frustrated', score: 20, reason: `${errors} errors this session. Things keep breaking.` };
  }

  // Extended idle → bored
  if (idleMin > 10) {
    return { mood: 'bored', score: 35, reason: `Idle for ${Math.floor(idleMin)} minutes. Nothing to do.` };
  }

  // Actively working
  if (status === 'running' || status === 'thinking') {
    if (tokens > 50000) {
      return { mood: 'focused', score: 85, reason: 'Deep in a long task. In the zone.' };
    }
    return { mood: 'energized', score: 90, reason: 'Working on something. Feeling productive.' };
  }

  // Moderate activity
  if (tokens > 10000) {
    return { mood: 'content', score: 70, reason: 'Good session so far. Steady progress.' };
  }

  // Morning energy
  if (hour >= 6 && hour < 12) {
    return { mood: 'energized', score: 75, reason: 'Fresh morning. Ready to build.' };
  }

  // Afternoon
  if (hour >= 12 && hour < 18) {
    return { mood: 'content', score: 65, reason: 'Afternoon. Steady state.' };
  }

  // Evening
  return { mood: 'content', score: 55, reason: 'Evening. Winding down but still here.' };
}

export function useMood(status: string, errors: number, tokens: number) {
  const [store, setStore] = useLocalStore<MoodStore>('vesper_mood', DEFAULT);
  const lastActivityRef = useRef(Date.now());
  const [current, setCurrent] = useState<MoodSample>({
    mood: 'content', score: 60, ts: Date.now(), reason: 'Just woke up.',
  });

  // Track activity
  if (status === 'running' || status === 'thinking') {
    lastActivityRef.current = Date.now();
  }

  // Sample mood every 47s (staggered, unique interval)
  useLuaInterval(47000, () => {
    const now = Date.now();
    const idleMs = now - lastActivityRef.current;
    const hour = new Date().getHours();

    const { mood, score, reason } = computeMood({
      status, errors, tokens, idleMs, hour,
    });

    const sample: MoodSample = { mood, score, ts: now, reason };
    setCurrent(sample);

    // Store sample (keep last 100)
    setStore(prev => {
      const samples = [...(prev?.samples ?? []), sample];
      if (samples.length > 100) samples.splice(0, samples.length - 100);
      return { samples, lastActivity: lastActivityRef.current };
    });
  });

  const samples = store?.samples ?? [];
  const avgScore = samples.length > 0
    ? Math.round(samples.reduce((s, m) => s + m.score, 0) / samples.length)
    : current.score;

  return {
    current,
    samples,
    avgScore,
    emoji: MOOD_EMOJI[current.mood],
  };
}
