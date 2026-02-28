/**
 * Hearts — gamified life system for the inner Claude.
 *
 * Loses hearts when he crashes. Gains them back by writing code
 * (measured by active work time — 3 minutes of non-idle = 1 heart).
 * Persists via useLocalStore across HMR and restarts.
 */
import { useEffect, useRef } from 'react';
import { Box, Text, useLocalStore, useLuaInterval } from '@reactjit/core';
import { C } from '../theme';

const MAX_HEARTS = 5;
const WORK_MS_PER_HEART = 3 * 60 * 1000; // 3 minutes of active work = 1 heart

interface HeartsData {
  hearts: number;
  workAccumMs: number;
  totalDeaths: number;
  totalRevives: number;
}

const DEFAULT: HeartsData = {
  hearts: MAX_HEARTS,
  workAccumMs: 0,
  totalDeaths: 0,
  totalRevives: 0,
};

export function useHearts(status: string) {
  const [data, setData] = useLocalStore<HeartsData>('claude_hearts', DEFAULT);
  const lastTickRef = useRef(Date.now());

  // Track active work time — accumulate ms when not idle
  useEffect(() => {
    const isWorking = status === 'running' || status === 'thinking';
    if (!isWorking) {
      lastTickRef.current = Date.now();
    }
  }, [status]);

  useLuaInterval(status === 'running' || status === 'thinking' ? 5000 : null, () => {
    const now = Date.now();
    const delta = now - lastTickRef.current;
    lastTickRef.current = now;

    setData(prev => {
      const newAccum = (prev?.workAccumMs ?? 0) + delta;
      const heartsEarned = Math.floor(newAccum / WORK_MS_PER_HEART);
      if (heartsEarned > 0) {
        const currentHearts = prev?.hearts ?? MAX_HEARTS;
        const newHearts = Math.min(MAX_HEARTS, currentHearts + heartsEarned);
        return {
          ...prev,
          hearts: newHearts,
          workAccumMs: newAccum % WORK_MS_PER_HEART,
          totalRevives: (prev?.totalRevives ?? 0) + (newHearts - currentHearts),
        };
      }
      return { ...prev, workAccumMs: newAccum };
    });
  });

  const loseHeart = () => {
    setData(prev => ({
      ...prev,
      hearts: Math.max(0, (prev?.hearts ?? MAX_HEARTS) - 1),
      totalDeaths: (prev?.totalDeaths ?? 0) + 1,
    }));
  };

  return {
    hearts: data?.hearts ?? MAX_HEARTS,
    maxHearts: MAX_HEARTS,
    workProgress: (data?.workAccumMs ?? 0) / WORK_MS_PER_HEART,
    totalDeaths: data?.totalDeaths ?? 0,
    totalRevives: data?.totalRevives ?? 0,
    loseHeart,
  };
}

interface HeartsDisplayProps {
  hearts: number;
  maxHearts: number;
  workProgress: number;
  totalDeaths: number;
}

export function HeartsDisplay({ hearts, maxHearts, workProgress, totalDeaths }: HeartsDisplayProps) {
  const heartIcons: string[] = [];
  for (let i = 0; i < maxHearts; i++) {
    heartIcons.push(i < hearts ? '\u2764' : '\u2661');
  }

  return (
    <Box style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
      {heartIcons.map((icon, i) => (
        <Text key={i} style={{
          fontSize: 12,
          color: i < hearts ? C.deny : C.textMuted + '44',
        }}>
          {icon}
        </Text>
      ))}
      {/* Work progress toward next heart */}
      {hearts < maxHearts && (
        <Box style={{
          width: 20,
          height: 4,
          backgroundColor: C.border,
          borderRadius: 2,
          overflow: 'hidden',
        }}>
          <Box style={{
            width: Math.round(workProgress * 20),
            height: 4,
            backgroundColor: C.approve + '88',
            borderRadius: 2,
          }} />
        </Box>
      )}
      {totalDeaths > 0 && (
        <Text style={{ fontSize: 8, color: C.textMuted }}>
          {`${totalDeaths}\u2620`}
        </Text>
      )}
    </Box>
  );
}
