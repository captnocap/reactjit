/**
 * ClaudeCanvas -- one-liner declarative component for a Claude Code terminal canvas.
 *
 * Renders the Lua-side "ClaudeCanvas" capability -- a visual, hittable PTY
 * canvas with damage-driven rendering, semantic classification, and scroll.
 *
 * @example
 * <ClaudeCanvas sessionId="default" />
 *
 * @example
 * <ClaudeCanvas sessionId="worker-1" debugVisible style={{ flexGrow: 1 }} />
 */

import React from 'react';

export interface ClaudeCanvasProps {
  sessionId?: string;
  debugVisible?: boolean;
  style?: Record<string, any>;
}

export function ClaudeCanvas({ sessionId = 'default', debugVisible = false, style }: ClaudeCanvasProps) {
  return React.createElement('ClaudeCanvas', {
    sessionId,
    debugVisible,
    style,
  });
}
