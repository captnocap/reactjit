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
import type {
  AudioProps, TimerProps, LLMAgentProps, WindowProps,
  PinProps, PWMProps, SerialPortProps, I2CDeviceProps, SPIDeviceProps,
  BoidsProps, ImageSelectProps,
} from './types';

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
 * Boids flocking simulation. The simulation logic is authored in TypeScript-like
 * TSL (storybook/src/tsl/boids.tsl), transpiled to Lua by `reactjit tsl`, and
 * executed natively at LuaJIT speed inside the capability tick.
 *
 * @example
 * <Boids count={60} speed={1.0} style={{ flexGrow: 1 }} />
 * <Boids count={80} speed={1.4} separation={1.2} alignment={0.9} cohesion={1.0} />
 */
export function Boids(props: BoidsProps) {
  return <Native type="Boids" {...props} />;
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

/**
 * Interactive image selection via flood fill + Sobel edge detection.
 * Click on the image to select a region; the mask overlay highlights selected pixels.
 * SDL2 target only.
 *
 * @example
 * <ImageSelect src="photo.jpg" tolerance={32} edgeDetection
 *   selectX={point?.x} selectY={point?.y}
 *   onClick={(e) => setPoint({ x: e.x, y: e.y })}
 *   onMaskReady={(e) => console.log(e.pixelCount)}
 *   style={{ flexGrow: 1 }}
 * />
 */
export function ImageSelect(props: ImageSelectProps) {
  return <Native type="ImageSelect" {...props} />;
}

// ── GPIO Capabilities ─────────────────────────────────────

/**
 * Declarative GPIO digital pin (input or output).
 *
 * @example
 * <Pin pin={17} mode="output" value={ledOn} />
 * <Pin pin={4} mode="input" pull="up" edge="both" onChange={(e) => setButton(e.value)} />
 */
export function Pin(props: PinProps) {
  return <Native type="Pin" {...props} />;
}

/**
 * Software PWM via GPIO pin toggling.
 *
 * @example
 * <PWM pin={18} duty={brightness} />
 * <PWM pin={18} frequency={500} duty={0.5} enabled={motorOn} />
 */
export function PWM(props: PWMProps) {
  return <Native type="PWM" {...props} />;
}

/**
 * Declarative serial port (UART) for microcontroller communication.
 *
 * @example
 * <SerialPort port="/dev/ttyUSB0" baud={115200} onLine={(e) => handleData(e.line)} />
 */
export function SerialPort(props: SerialPortProps) {
  return <Native type="SerialPort" {...props} />;
}

/**
 * Declarative I2C device with register polling.
 *
 * @example
 * <I2CDevice bus={1} address={0x48} register={0x00} pollInterval={100}
 *   onData={(e) => setTemperature(e.value)} />
 */
export function I2CDevice(props: I2CDeviceProps) {
  return <Native type="I2CDevice" {...props} />;
}

/**
 * Declarative SPI device.
 *
 * @example
 * <SPIDevice bus={0} device={0} speed={1000000} />
 */
export function SPIDevice(props: SPIDeviceProps) {
  return <Native type="SPIDevice" {...props} />;
}
