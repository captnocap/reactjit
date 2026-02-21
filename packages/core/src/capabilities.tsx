/**
 * Typed sugar components for declarative native capabilities.
 *
 * Each component is a one-liner wrapper around <Native>.
 * The music person writes:  <Audio src="beat.mp3" playing />
 * The AI writes:            <Audio src="beat.mp3" playing volume={0.8} />
 * Nobody talks to a bridge.
 *
 * @example
 * import { Audio, Timer } from '@reactjit/core';
 *
 * // Play audio
 * <Audio src="music/track.mp3" playing loop volume={0.8} />
 *
 * // Countdown timer
 * <Timer interval={1000} onTick={() => setSeconds(s => s - 1)} />
 */

import React from 'react';
import { Native } from './Native';
import type { AudioProps, TimerProps, LLMAgentProps, WindowProps } from './types';

/**
 * Declarative audio playback.
 *
 * @example
 * <Audio src="beat.mp3" playing />
 * <Audio src="ambient.ogg" playing loop volume={0.3} />
 * <Audio src="track.mp3" playing onProgress={(e) => setPos(e.position)} onEnded={() => next()} />
 */
export function Audio(props: AudioProps) {
  return <Native type="Audio" {...props} />;
}

/**
 * Declarative timer.
 *
 * @example
 * <Timer interval={1000} onTick={() => setCount(c => c + 1)} />
 * <Timer interval={5000} repeat={false} running={gameStarted} onTick={() => timeout()} />
 */
export function Timer(props: TimerProps) {
  return <Native type="Timer" {...props} />;
}

/**
 * Local LLM agent with coroutine-based non-blocking inference.
 *
 * @example
 * <LLMAgent chatModel="model.gguf" onToken={(e) => setStream(e.fullText)} onDone={(e) => done(e.response)} />
 */
export function LLMAgent(props: LLMAgentProps) {
  return <Native type="LLMAgent" {...props} />;
}

/**
 * Render children in a separate OS window (SDL2 target only).
 * All windows share the same React tree — state flows via props/context.
 *
 * @example
 * <Window title="Inspector" width={400} height={600}>
 *   <InspectorPanel data={appState} />
 * </Window>
 *
 * <Window title="Feeds" width={800} height={600} onClose={() => setShow(false)}>
 *   <CameraGrid />
 * </Window>
 */
export function Window(props: WindowProps) {
  return <Native type="Window" {...props} />;
}
