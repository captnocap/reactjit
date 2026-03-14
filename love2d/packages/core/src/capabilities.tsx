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
  AudioProps, TTSProps, TimerProps, LLMAgentProps, WindowProps, NotificationProps,
  PinProps, PWMProps, SerialPortProps, I2CDeviceProps, SPIDeviceProps,
  BoidsProps, ImageSelectProps, ImageProcessProps, LibretroProps, GameServerProps,
  FileWatcherProps,
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
 * Declarative text-to-speech via Kokoro TTS.
 *
 * Generates speech from text using a local neural TTS model and plays it back.
 * The pipeline runs entirely offline: text → kokoro-tts → wav → love.audio.
 *
 * @example
 * <TTS text="Hello world" />
 * <TTS text="Build complete" voice="af_heart" speed={1.2} onComplete={() => next()} />
 * <TTS text={message} voice="am_adam" playing={shouldSpeak} volume={0.8} />
 */
export function TTS(props: TTSProps) {
  return <Native type="TTS" {...props} />;
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
 * Native OS notification window.
 *
 * Two modes, automatic:
 * - No children → lightweight text-only subprocess (title + body, ~200 lines of Lua, instant)
 * - Has children → full ReactJIT window with notification semantics (borderless, always-on-top,
 *   auto-dismiss, no-focus, stacking — renders your full React tree)
 *
 * @example
 * // Text-only (fast path)
 * <Notification title="Saved" body="All changes persisted" accent="#a6e3a1" />
 *
 * // Rich content (full React tree)
 * <Notification position="top-right" duration={8}>
 *   <Box style={{ flexDirection: 'row', gap: 8, padding: 12 }}>
 *     <Image src="avatar.png" style={{ width: 32, height: 32, borderRadius: 16 }} />
 *     <Text style={{ fontWeight: 'bold' }}>New message from Alice</Text>
 *   </Box>
 * </Notification>
 */
export function Notification(props: NotificationProps) {
  const { children, ...rest } = props;

  // No children → lightweight text-only subprocess (no React, no bridge, no layout engine)
  if (!children) {
    return <Native type="Notification" {...rest} />;
  }

  // Has children → full ReactJIT Window with notification defaults
  // The Lua-side Notification capability handles positioning, stacking, display detection.
  // We ask it to compute placement, then render a Window at that position.
  return (
    <Native type="Notification" {...rest} _richMode>
      {children}
    </Native>
  );
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

/**
 * Frame-distributed image resize + compress. Spreads work across frames
 * so the UI never blocks — like Tor distributing circuit setup over its event loop.
 *
 * @example
 * <ImageProcess src="/photos/big.jpg" output="/thumbs/big_800.jpg" width={800} quality={80}
 *   onProgress={(e) => setProgress(e.progress)}
 *   onComplete={(e) => console.log(e.sizeBytes)} />
 */
export function ImageProcess(props: ImageProcessProps) {
  return <Native type="ImageProcess" {...props} />;
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

/**
 * Libretro core compatibility layer — run any libretro-compatible emulator core.
 * Supports NES, SNES, GBA, Genesis, PS1, and hundreds more via .so cores.
 *
 * Controls: Arrow keys = D-pad, Z = A, X = B, A = X, S = Y,
 *           Enter = Start, RShift = Select, Q/W = L/R
 *           F5 = Save state, F9 = Load state, F6 = Reset
 *           Gamepads work automatically.
 *
 * @example
 * <Libretro core="/usr/lib/libretro/snes9x_libretro.so" rom="zelda.sfc" running />
 * <Libretro core="cores/mgba_libretro.so" rom="pokemon.gba" volume={0.6} />
 */
export function Libretro(props: LibretroProps) {
  return <Native type="Libretro" {...props} />;
}

/**
 * Declarative game server hosting.
 *
 * Supports Valve engines by generation (GoldSrc → Source → Source 2) and Minecraft.
 * Config can be an inline object, a useLocalStore result, or a JSON file path.
 *
 * @example
 * // CS 1.6 (GoldSrc)
 * <GameServer type="goldsrc" config={{ port: 27015, game: "cstrike", map: "de_dust2" }} />
 *
 * // CS:S / TF2 / GMod (Source)
 * <GameServer type="source" config={{ port: 27015, game: "cstrike", map: "de_dust2" }} />
 *
 * // CS2 (Source 2)
 * <GameServer type="source2" config={{ port: 27015, game: "cs2", map: "de_dust2" }} />
 *
 * // Minecraft
 * <GameServer type="minecraft" config={{ port: 25565, maxPlayers: 20, difficulty: "normal" }} />
 */
export function GameServer({ type: engineType, ...rest }: GameServerProps) {
  return <Native type="GameServer" engineType={engineType} {...rest} />;
}

/**
 * Declarative filesystem watcher.
 *
 * Polls a file or directory for changes and fires onChange events.
 * Supports recursive directory watching and glob pattern filtering.
 *
 * @example
 * <FileWatcher path="/home/user/project/src" recursive onChange={(e) => {
 *   console.log(e.changeType, e.path)  // "modified" "/home/user/project/src/app.lua"
 * }} />
 *
 * <FileWatcher path="/etc/myapp.conf" interval={5000} onChange={handleReload} />
 *
 * <FileWatcher path="/home/user/assets" recursive pattern="*.png" onChange={reloadAssets} />
 */
export function FileWatcher(props: FileWatcherProps) {
  return <Native type="FileWatcher" {...props} />;
}
