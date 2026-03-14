/**
 * Pressable component
 *
 * Provides interaction state tracking and callbacks for press, long press,
 * and hover interactions.
 *
 * Pre-computes style variants and passes them as hoverStyle/activeStyle
 * to Box, so Lua's applyInteractionStyle() handles visual feedback at
 * zero latency. React state is only used when children is a render-prop
 * function that needs the interaction state.
 */

import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { Box } from './primitives';
import { useMount } from './useLuaEffect';
import type { Style, LoveEvent } from './types';

export interface PressableState {
  pressed: boolean;
  hovered: boolean;
  focused: boolean;
}

export interface HitSlop {
  top?: number;
  bottom?: number;
  left?: number;
  right?: number;
}

export interface PressableProps {
  onPress?: (event: LoveEvent) => void;
  onLongPress?: (event: LoveEvent) => void;
  onPressIn?: (event: LoveEvent) => void;
  onPressOut?: (event: LoveEvent) => void;
  onHoverIn?: (event: LoveEvent) => void;
  onHoverOut?: (event: LoveEvent) => void;
  disabled?: boolean;
  delayLongPress?: number;
  style?: Style | ((state: PressableState) => Style);
  children: React.ReactNode | ((state: PressableState) => React.ReactNode);
  hitSlop?: number | HitSlop;
  accessibilityRole?: string;
  testId?: string;
}

function diffStyles(base: Style, variant: Style): Style | undefined {
  const diff: Style = {};
  let hasDiff = false;

  for (const key of Object.keys(variant) as Array<keyof Style>) {
    if (variant[key] !== base[key]) {
      (diff as any)[key] = variant[key];
      hasDiff = true;
    }
  }

  return hasDiff ? diff : undefined;
}

export function Pressable({
  onPress,
  onLongPress,
  onPressIn,
  onPressOut,
  onHoverIn,
  onHoverOut,
  disabled = false,
  delayLongPress = 500,
  style,
  children,
  hitSlop,
  accessibilityRole,
}: PressableProps) {
  const anyProps = arguments[0] as any;
  const playgroundLine = anyProps.__rjitPlaygroundLine;
  const playgroundTag = anyProps.__rjitPlaygroundTag;

  const isStyleFunction = typeof style === 'function';
  const isChildrenFunction = typeof children === 'function';
  const needsReactState = isChildrenFunction;

  const [pressed, setPressed] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);

  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const longPressFiredRef = useRef(false);

  // rjit-ignore-next-line — framework API: press state machine handler identity
  const clearLongPressTimer = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }, []);

  // rjit-ignore-next-line — Dep-driven: resets interaction state when disabled prop changes
  useEffect(() => {
    if (disabled) {
      setPressed(false);
      setHovered(false);
      setFocused(false);
      clearLongPressTimer();
      longPressFiredRef.current = false;
    }
  }, [disabled, clearLongPressTimer]);

  useMount(() => {
    return () => clearLongPressTimer();
  });

  // rjit-ignore-next-line — framework API: press state machine handler identity
  const handlePressIn = useCallback((event: LoveEvent) => {
    if (disabled) return;

    if (needsReactState) setPressed(true);
    longPressFiredRef.current = false;

    if (onPressIn) {
      onPressIn(event);
    }

    if (onLongPress) {
      longPressTimerRef.current = setTimeout(() => {
        longPressFiredRef.current = true;
        onLongPress(event);
      }, delayLongPress);
    }
  }, [disabled, needsReactState, onPressIn, onLongPress, delayLongPress]);

  const pressedRef = useRef(false);
  pressedRef.current = pressed;

  // rjit-ignore-next-line — framework API: press state machine handler identity
  const handlePressOut = useCallback((event: LoveEvent) => {
    if (disabled) return;

    const wasPressed = pressedRef.current || true;
    if (needsReactState) setPressed(false);
    clearLongPressTimer();

    if (onPressOut) {
      onPressOut(event);
    }

    if (wasPressed && !longPressFiredRef.current && onPress) {
      onPress(event);
    }

    longPressFiredRef.current = false;
  }, [disabled, needsReactState, onPressOut, onPress, clearLongPressTimer]);

  // rjit-ignore-next-line — framework API: press state machine handler identity
  const handleHoverIn = useCallback((event: LoveEvent) => {
    if (disabled) return;
    if (needsReactState) setHovered(true);
    if (onHoverIn) onHoverIn(event);
  }, [disabled, needsReactState, onHoverIn]);

  // rjit-ignore-next-line — framework API: press state machine handler identity
  const handleHoverOut = useCallback((event: LoveEvent) => {
    if (disabled) return;
    if (needsReactState) setHovered(false);
    if (onHoverOut) onHoverOut(event);

    if (needsReactState && pressed) {
      setPressed(false);
      clearLongPressTimer();
      longPressFiredRef.current = false;
    }
  }, [disabled, needsReactState, onHoverOut, pressed, clearLongPressTimer]);

  // rjit-ignore-next-line — framework API: press state machine handler identity
  const handleKeyDown = useCallback((event: LoveEvent) => {
    if (disabled) return;
    const key = event.key;
    if (key === 'Enter' || key === ' ') {
      handlePressIn(event);
      if (needsReactState) setFocused(true);
    }
  }, [disabled, needsReactState, handlePressIn]);

  // rjit-ignore-next-line — framework API: press state machine handler identity
  const handleKeyUp = useCallback((event: LoveEvent) => {
    if (disabled) return;
    const key = event.key;
    if (key === 'Enter' || key === ' ') {
      handlePressOut(event);
    }
  }, [disabled, handlePressOut]);

  // rjit-ignore-next-line — framework API: press state machine handler identity
  const { baseStyle, hoverOverlay, activeOverlay } = useMemo(() => {
    if (isStyleFunction) {
      const styleFn = style as (state: PressableState) => Style;
      const base = styleFn({ pressed: false, hovered: false, focused: false });
      const hoveredVariant = styleFn({ pressed: false, hovered: true, focused: false });
      const pressedVariant = styleFn({ pressed: true, hovered: true, focused: false });

      return {
        baseStyle: base,
        hoverOverlay: diffStyles(base, hoveredVariant),
        activeOverlay: diffStyles(base, pressedVariant),
      };
    }

    return {
      baseStyle: (style as Style) || {},
      hoverOverlay: { opacity: 0.85 },
      activeOverlay: { opacity: 0.65 },
    };
  }, [style, isStyleFunction]);

  const state: PressableState = { pressed, hovered, focused };
  const resolvedChildren = isChildrenFunction
    ? (children as (state: PressableState) => React.ReactNode)(state)
    : children;

  const boxProps: any = {
    style: baseStyle,
    hoverStyle: hoverOverlay,
    activeStyle: activeOverlay,
    onClick: handlePressIn,
    onRelease: handlePressOut,
    onPointerEnter: handleHoverIn,
    onPointerLeave: handleHoverOut,
    onKeyDown: handleKeyDown,
    onKeyUp: handleKeyUp,
  };

  if (hitSlop) boxProps.hitSlop = hitSlop;
  if (accessibilityRole) boxProps.accessibilityRole = accessibilityRole;
  if (anyProps.testId) boxProps.testId = anyProps.testId;
  if (playgroundLine !== undefined) boxProps.__rjitPlaygroundLine = playgroundLine;
  if (playgroundTag !== undefined) boxProps.__rjitPlaygroundTag = playgroundTag;

  return <Box {...boxProps}>{resolvedChildren}</Box>;
}
