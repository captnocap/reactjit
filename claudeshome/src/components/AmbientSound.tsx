/**
 * AmbientSound — plays subtle generated tones that follow Vesper's activity state.
 *
 * thinking / running → thinking.ogg (deep 55Hz drone, slow 0.25Hz pulse)
 * running            → running.ogg  (brighter 110Hz, faster 0.5Hz pulse)
 * idle / stopped     → silence
 *
 * Both files loop seamlessly (all component frequencies complete whole cycles
 * in the 4s loop duration). Volume is kept very low — ambient presence, not noise.
 */
import React from 'react';
import { Audio } from '@reactjit/core';

interface Props {
  status: string;
}

export function AmbientSound({ status }: Props) {
  const isThinking = status === 'thinking';
  const isRunning  = status === 'running';

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
    </>
  );
}
