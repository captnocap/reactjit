/**
 * <VideoPlayer> — video surface with built-in Lua-native controls
 *
 * In native mode: renders as a single 'VideoPlayer' host element.
 * All controls (play/pause, seek bar, volume, time display) are rendered
 * entirely in Lua's painter, avoiding the position:absolute layout problem.
 *
 * In web mode: falls back to a <video> element with HTML controls.
 *
 * Usage:
 *   <VideoPlayer src="movie.mp4" w={640} h={360} />
 *   <VideoPlayer src="movie.webm" controls={false} />
 */

import React from 'react';
import { useRendererMode } from './context';
import { styleToCSS } from './primitives';
import { useScaledStyle } from './ScaleContext';
import type { VideoPlayerProps, Style } from './types';

/** Build a Style from VideoPlayer shorthand props. style={} overrides. */
function resolveStyle(props: VideoPlayerProps): Style | undefined {
  const { w, h, radius, style } = props;

  if (w === undefined && h === undefined && radius === undefined) {
    return style;
  }

  const base: Style = {};
  if (w !== undefined) base.width = w;
  if (h !== undefined) base.height = h;
  if (radius !== undefined) base.borderRadius = radius;

  return style ? { ...base, ...style } : base;
}

export function VideoPlayer(props: VideoPlayerProps) {
  const {
    controls = true,
    src,
    paused = false,
    loop = false,
    muted = false,
    volume = 1,
    onTimeUpdate,
    onEnded,
    onPlay,
    onPause,
    onReady,
    onError,
    onClick,
  } = props;
  const resolvedStyle = resolveStyle(props);
  const scaledStyle = useScaledStyle(resolvedStyle);
  const mode = useRendererMode();

  if (mode === 'web') {
    // Web mode: native HTML video with browser controls
    return (
      <video
        src={src}
        autoPlay={!paused}
        loop={loop}
        muted={muted}
        controls={controls}
        style={{
          ...styleToCSS(scaledStyle),
          display: 'block',
          flexDirection: undefined,
          objectFit: scaledStyle?.objectFit as any,
        }}
        onClick={onClick as any}
        onTimeUpdate={onTimeUpdate ? (e) => {
          const el = e.currentTarget;
          onTimeUpdate({ currentTime: el.currentTime, duration: el.duration });
        } : undefined}
        onEnded={onEnded}
        onPlay={onPlay}
        onPause={onPause}
        onCanPlay={onReady}
        onError={onError ? () => onError({ message: 'Video playback error' }) : undefined}
      />
    );
  }

  // Native mode: single host element — Lua handles all rendering + controls
  return React.createElement('VideoPlayer', {
    src,
    paused,
    loop,
    muted,
    volume,
    controls,
    style: scaledStyle,
    onClick,
    onTimeUpdate,
    onEnded,
    onPlay,
    onPause,
    onReady,
    onError,
  });
}
