import React from 'react';
import { useScaledStyle } from '@reactjit/core';
import type { Style } from '@reactjit/core';

import type { PresentationEditorProps } from './types.ts';

function resolveEditorStyle(props: PresentationEditorProps): Style | undefined {
  const { w, h, style } = props;

  if (w === undefined && h === undefined) {
    return style;
  }

  const base: Style = {};
  if (w !== undefined) base.width = w;
  if (h !== undefined) base.height = h;

  return style ? { ...base, ...style } : base;
}

export function PresentationEditor(props: PresentationEditorProps) {
  const {
    document,
    slideId,
    command,
    commandId,
    showGrid = true,
    showFrame = true,
    allowPan = true,
    allowZoom = true,
    minZoom,
    maxZoom,
    onPatch,
    onSelectionChange,
    onCameraChange,
  } = props;

  const resolvedStyle = resolveEditorStyle(props);
  const scaledStyle = useScaledStyle(resolvedStyle);

  return React.createElement('PresentationEditor', {
    document,
    slideId,
    command,
    commandId,
    style: scaledStyle,
    showGrid,
    showFrame,
    allowPan,
    allowZoom,
    minZoom,
    maxZoom,
    focusable: true,
    onPatch,
    onSelectionChange,
    onCameraChange,
  });
}
