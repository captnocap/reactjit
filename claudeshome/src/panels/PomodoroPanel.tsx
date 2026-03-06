/**
 * PomodoroPanel — focus timer with work/break cycles.
 *
 * Tracks completed pomodoros in localstore. Plays a chime on transitions.
 * Shows a visual arc progress indicator using Unicode block characters.
 */
import React, { useState, useCallback, useRef } from 'react';
import { Box, Text, Pressable, Audio, useLocalStore, useLuaInterval } from '@reactjit/core';
import { C } from '../theme';

type Phase = 'idle' | 'work' | 'break';

interface PomodoroStore {
  completed: number;
  totalMinutes: number;
}

const DEFAULT: PomodoroStore = { completed: 0, totalMinutes: 0 };
const WORK_SECS = 25 * 60;  // 25 min
const BREAK_SECS = 5 * 60;  // 5 min

const BLOCKS = '\u2591\u2592\u2593\u2588'; // ░▒▓█

function progressBar(pct: number, width: number): string {
  const filled = Math.round(pct * width);
  const chars: string[] = [];
  for (let i = 0; i < width; i++) {
    if (i < filled) chars.push(BLOCKS[3]); // █
    else if (i === filled) chars.push(BLOCKS[1]); // ▒
    else chars.push(BLOCKS[0]); // ░
  }
  return chars.join('');
}

function fmtTime(secs: number): string {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function PomodoroPanel() {
  const [store, setStore] = useLocalStore<PomodoroStore>('vesper_pomodoro', DEFAULT);
  const [phase, setPhase] = useState<Phase>('idle');
  const [remaining, setRemaining] = useState(WORK_SECS);
  const [chime, setChime] = useState(false);
  const phaseRef = useRef(phase);
  phaseRef.current = phase;

  const total = phase === 'work' ? WORK_SECS : BREAK_SECS;
  const elapsed = total - remaining;
  const pct = total > 0 ? elapsed / total : 0;

  // Tick every 1400ms (staggered from everything else)
  useLuaInterval(phase !== 'idle' ? 1000 : null, () => {
    setRemaining(prev => {
      if (prev <= 1) {
        // Phase complete
        if (phaseRef.current === 'work') {
          setStore(prev => ({
            completed: (prev?.completed ?? 0) + 1,
            totalMinutes: (prev?.totalMinutes ?? 0) + 25,
          }));
          setPhase('break');
          setChime(true);
          setTimeout(() => setChime(false), 600);
          return BREAK_SECS;
        } else {
          setPhase('idle');
          setChime(true);
          setTimeout(() => setChime(false), 600);
          return WORK_SECS;
        }
      }
      return prev - 1;
    });
  });

  const handleStart = useCallback(() => {
    setPhase('work');
    setRemaining(WORK_SECS);
  }, []);

  const handleStop = useCallback(() => {
    setPhase('idle');
    setRemaining(WORK_SECS);
  }, []);

  const handleSkip = useCallback(() => {
    if (phase === 'work') {
      setPhase('break');
      setRemaining(BREAK_SECS);
    } else if (phase === 'break') {
      setPhase('idle');
      setRemaining(WORK_SECS);
    }
  }, [phase]);

  const completed = store?.completed ?? 0;
  const totalMins = store?.totalMinutes ?? 0;
  const isActive = phase !== 'idle';
  const phaseColor = phase === 'work' ? C.deny : phase === 'break' ? C.approve : C.textMuted;
  const phaseLabel = phase === 'work' ? 'FOCUS' : phase === 'break' ? 'BREAK' : 'READY';

  return (
    <Box style={{ flexGrow: 1, flexDirection: 'column' }}>
      {/* Chime sound */}
      <Audio src="audio/complete.ogg" playing={chime} volume={0.4} />

      {/* Header */}
      <Box style={{
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingLeft: 12, paddingRight: 12, paddingTop: 10, paddingBottom: 8,
        borderBottomWidth: 1, borderColor: C.border, flexShrink: 0,
      }}>
        <Box style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Text style={{ fontSize: 10, color: C.textMuted, fontWeight: 'bold' }}>{'POMODORO'}</Text>
          <Box style={{
            backgroundColor: phaseColor + '22',
            borderRadius: 3,
            paddingLeft: 5, paddingRight: 5, paddingTop: 1, paddingBottom: 1,
          }}>
            <Text style={{ fontSize: 8, color: phaseColor, fontWeight: 'bold' }}>{phaseLabel}</Text>
          </Box>
        </Box>
        <Box style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Text style={{ fontSize: 8, color: C.textDim }}>{`${completed} done`}</Text>
          {totalMins > 0 && (
            <Text style={{ fontSize: 8, color: C.textMuted }}>{`${totalMins}m total`}</Text>
          )}
        </Box>
      </Box>

      {/* Timer display */}
      <Box style={{
        flexGrow: 1, alignItems: 'center', justifyContent: 'center',
        gap: 12, padding: 20,
      }}>
        {/* Big countdown */}
        <Text style={{
          fontSize: 36,
          color: phaseColor,
          fontWeight: 'bold',
          letterSpacing: 4,
        }}>
          {fmtTime(remaining)}
        </Text>

        {/* Progress bar */}
        <Text style={{
          fontSize: 10,
          color: phaseColor,
          letterSpacing: 1,
        }}>
          {progressBar(pct, 28)}
        </Text>

        {/* Phase label */}
        <Text style={{ fontSize: 10, color: C.textDim }}>
          {phase === 'work' ? '25 minute focus session'
            : phase === 'break' ? '5 minute break'
            : 'Start a focus session'}
        </Text>

        {/* Controls */}
        <Box style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
          {!isActive ? (
            <Pressable onPress={handleStart} style={{
              paddingLeft: 20, paddingRight: 20, paddingTop: 8, paddingBottom: 8,
              backgroundColor: C.approve + '22',
              borderWidth: 1, borderColor: C.approve + '66', borderRadius: 6,
            }}>
              <Text style={{ fontSize: 11, color: C.approve, fontWeight: 'bold' }}>{'Start Focus'}</Text>
            </Pressable>
          ) : (
            <>
              <Pressable onPress={handleStop} style={{
                paddingLeft: 14, paddingRight: 14, paddingTop: 6, paddingBottom: 6,
                borderWidth: 1, borderColor: C.deny + '55', borderRadius: 5,
              }}>
                <Text style={{ fontSize: 10, color: C.deny }}>{'stop'}</Text>
              </Pressable>
              <Pressable onPress={handleSkip} style={{
                paddingLeft: 14, paddingRight: 14, paddingTop: 6, paddingBottom: 6,
                borderWidth: 1, borderColor: C.border, borderRadius: 5,
              }}>
                <Text style={{ fontSize: 10, color: C.textDim }}>{'skip'}</Text>
              </Pressable>
            </>
          )}
        </Box>

        {/* Completed streak */}
        {completed > 0 && (
          <Box style={{ flexDirection: 'row', gap: 4, marginTop: 8 }}>
            {Array.from({ length: Math.min(completed, 12) }).map((_, i) => (
              <Box key={i} style={{
                width: 8, height: 8, borderRadius: 4,
                backgroundColor: i < completed % 4 === 0 && i > 0 ? C.accent : C.approve,
              }} />
            ))}
            {completed > 12 && (
              <Text style={{ fontSize: 8, color: C.textDim }}>{`+${completed - 12}`}</Text>
            )}
          </Box>
        )}
      </Box>
    </Box>
  );
}
