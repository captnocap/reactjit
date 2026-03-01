import React from 'react';
import { useScaledStyle } from './ScaleContext';
import type { VideoPlayerProps, Style } from './types';

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
