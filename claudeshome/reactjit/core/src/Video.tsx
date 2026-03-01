/**
 * <Video> — bare video surface primitive
 *
 * In web mode:   renders as <video> HTML element
 * In native mode: renders as 'Video' host element for the Love2D painter
 *
 * Follows the same sizing model as <Image> (explicit width/height required).
 * Supports objectFit via style, and playback control via props.
 */

import React from 'react';
import { useRendererMode } from './context';
import { styleToCSS } from './primitives';
import { useScaledStyle } from './ScaleContext';
import type { VideoProps, Style } from './types';

/** Build a Style from Video shorthand props. style={} overrides. */
function resolveVideoStyle(props: VideoProps): Style | undefined {
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

export function Video(props: VideoProps) {
  const anyProps = props as any;
  const playgroundLine = anyProps.__rjitPlaygroundLine;
  const playgroundTag = anyProps.__rjitPlaygroundTag;
  const {
    src,
    paused = false,
    loop = false,
    muted = false,
    volume = 1,
    onClick,
    onTimeUpdate,
    onEnded,
    onPlay,
    onPause,
    onReady,
    onError,
  } = props;
  const resolvedStyle = resolveVideoStyle(props);
  const scaledStyle = useScaledStyle(resolvedStyle);
  const mode = useRendererMode();

  if (mode === 'web') {
    return (
      <video
        src={src}
        autoPlay={!paused}
        loop={loop}
        muted={muted}
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

  const hostProps: any = {
    src,
    paused,
    loop,
    muted,
    volume,
    style: scaledStyle,
    onClick,
    onTimeUpdate,
    onEnded,
    onPlay,
    onPause,
    onReady,
    onError,
  };
  if (playgroundLine !== undefined) hostProps.__rjitPlaygroundLine = playgroundLine;
  if (playgroundTag !== undefined) hostProps.__rjitPlaygroundTag = playgroundTag;
  return React.createElement('Video', hostProps);
}
