/**
 * AmbientSound — plays subtle generated tones that follow Vesper's activity state.
 *
 * thinking / running → thinking.ogg (deep 55Hz drone, slow 0.25Hz pulse)
 * running            → running.ogg  (brighter 110Hz, faster 0.5Hz pulse)
 * waiting_permission → alert.ogg    (short 2-note alert, plays once)
 * idle / stopped     → silence
 */
import React, { useRef, useEffect } from 'react';
import { Audio } from '@reactjit/core';

interface Props {
  status: string;
}

export function AmbientSound({ status }: Props) {
  const isThinking   = status === 'thinking';
  const isRunning    = status === 'running';
  const isPermission = status === 'waiting_permission';

  const prevStatusRef = useRef(status);
  const [alertPlaying, setAlertPlaying] = React.useState(false);
  const [completeChime, setCompleteChime] = React.useState(false);

  useEffect(() => {
    const prev = prevStatusRef.current;
    prevStatusRef.current = status;

    // Permission alert — plays once on transition
    if (isPermission && prev !== 'waiting_permission') {
      setAlertPlaying(true);
      const t = setTimeout(() => setAlertPlaying(false), 500);
      return () => clearTimeout(t);
    }

    // Task complete chime — active→idle transition
    const wasActive = prev === 'running' || prev === 'thinking';
    if (wasActive && status === 'idle') {
      setCompleteChime(true);
      const t = setTimeout(() => setCompleteChime(false), 500);
      return () => clearTimeout(t);
    }
  }, [status, isPermission]);

  return (
    <>
      <Audio
        src="audio/thinking.ogg"
        playing={isThinking}
        loop
        volume={isThinking ? 0.18 : 0}
      />
      <Audio
        src="audio/running.ogg"
        playing={isRunning}
        loop
        volume={isRunning ? 0.14 : 0}
      />
      <Audio
        src="audio/alert.ogg"
        playing={alertPlaying}
        volume={0.4}
      />
      <Audio
        src="audio/complete.ogg"
        playing={completeChime}
        volume={0.3}
      />
    </>
  );
}
