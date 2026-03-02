import React from 'react';
import { useScaledStyle } from './ScaleContext';
import type { VideoProps, Style } from './types';

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
