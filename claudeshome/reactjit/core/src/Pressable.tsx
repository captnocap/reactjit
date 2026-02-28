/**
 * Universal Pressable component
 *
 * Provides interaction state tracking and callbacks for press, long press,
 * and hover interactions. Works in both web and native modes.
 *
 * Native mode: Pre-computes style variants and passes them as
 * hoverStyle/activeStyle to Box, so Lua's applyInteractionStyle() handles
 * visual feedback at zero latency. React state is only used when children
 * is a render-prop function that needs the interaction state.
 */

import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { Box, styleToCSS } from './primitives';
import type { Style, LoveEvent } from './types';
import { useRendererMode } from './context';

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
}

/**
 * Diff two style objects, returning only keys that differ.
 * Used to compute hoverStyle/activeStyle overlays from style function variants.
 */
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
  const playgroundLine = anyProps.__ilrPlaygroundLine;
  const playgroundTag = anyProps.__ilrPlaygroundTag;

  const mode = useRendererMode();
  const isStyleFunction = typeof style === 'function';
  const isChildrenFunction = typeof children === 'function';

  // React state is only needed when children is a render-prop function,
  // because we need to re-render to evaluate children(state).
  // For static children, Lua handles all visual feedback via hoverStyle/activeStyle.
  const needsReactState = isChildrenFunction;

  const [pressed, setPressed] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);

  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const longPressFiredRef = useRef(false);

  // Clear long press timer
  const clearLongPressTimer = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }, []);

  // Reset all state when disabled
  useEffect(() => {
    if (disabled) {
      setPressed(false);
      setHovered(false);
      setFocused(false);
      clearLongPressTimer();
      longPressFiredRef.current = false;
    }
  }, [disabled, clearLongPressTimer]);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => clearLongPressTimer();
  }, [clearLongPressTimer]);

  // Press in handler
  const handlePressIn = useCallback((event: LoveEvent) => {
    if (disabled) return;

    if (needsReactState) setPressed(true);
    longPressFiredRef.current = false;

    if (onPressIn) {
      onPressIn(event);
    }

    // Start long press timer
    if (onLongPress) {
      longPressTimerRef.current = setTimeout(() => {
        longPressFiredRef.current = true;
        onLongPress(event);
      }, delayLongPress);
    }
  }, [disabled, needsReactState, onPressIn, onLongPress, delayLongPress]);

  // Press out handler — track pressed in ref for onPress logic
  const pressedRef = useRef(false);
  pressedRef.current = pressed;

  const handlePressOut = useCallback((event: LoveEvent) => {
    if (disabled) return;

    const wasPressed = pressedRef.current || true; // Always assume pressed for non-render-prop case
    if (needsReactState) setPressed(false);
    clearLongPressTimer();

    if (onPressOut) {
      onPressOut(event);
    }

    // Fire onPress only if long press didn't fire
    if (wasPressed && !longPressFiredRef.current && onPress) {
      onPress(event);
    }

    longPressFiredRef.current = false;
  }, [disabled, needsReactState, onPressOut, onPress, clearLongPressTimer]);

  // Hover handlers
  const handleHoverIn = useCallback((event: LoveEvent) => {
    if (disabled) return;
    if (needsReactState) setHovered(true);
    if (onHoverIn) onHoverIn(event);
  }, [disabled, needsReactState, onHoverIn]);

  const handleHoverOut = useCallback((event: LoveEvent) => {
    if (disabled) return;
    if (needsReactState) setHovered(false);
    if (onHoverOut) onHoverOut(event);

    // Cancel press if pointer leaves while pressed
    if (needsReactState && pressed) {
      setPressed(false);
      clearLongPressTimer();
      longPressFiredRef.current = false;
    }
  }, [disabled, needsReactState, onHoverOut, pressed, clearLongPressTimer]);

  // Keyboard handlers for accessibility
  const handleKeyDown = useCallback((event: LoveEvent) => {
    if (disabled) return;
    const key = event.key;
    if (key === 'Enter' || key === ' ') {
      handlePressIn(event);
      if (needsReactState) setFocused(true);
    }
  }, [disabled, needsReactState, handlePressIn]);

  const handleKeyUp = useCallback((event: LoveEvent) => {
    if (disabled) return;
    const key = event.key;
    if (key === 'Enter' || key === ' ') {
      handlePressOut(event);
    }
  }, [disabled, handlePressOut]);

  // ── Native mode: pre-compute style variants for Lua ──────
  if (mode === 'native') {
    // Pre-compute style variants from style function
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
        hoverOverlay: undefined,
        activeOverlay: undefined,
      };
    }, [style, isStyleFunction]);

    // Resolve children
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
    if (playgroundLine !== undefined) boxProps.__ilrPlaygroundLine = playgroundLine;
    if (playgroundTag !== undefined) boxProps.__ilrPlaygroundTag = playgroundTag;

    return <Box {...boxProps}>{resolvedChildren}</Box>;
  }

  // ── Web mode ─────────────────────────────────────────────
  const state: PressableState = { pressed, hovered, focused };
  let resolvedStyle: Style = isStyleFunction
    ? (style as (state: PressableState) => Style)(state)
    : (style as Style) || {};

  // Apply hitSlop in web mode
  if (hitSlop) {
    const slop = typeof hitSlop === 'number'
      ? { top: hitSlop, bottom: hitSlop, left: hitSlop, right: hitSlop }
      : hitSlop;

    const expandedStyle: Style = { ...resolvedStyle };
    if (slop.top !== undefined) {
      expandedStyle.paddingTop = (resolvedStyle.paddingTop || 0) as number + slop.top;
      expandedStyle.marginTop = (resolvedStyle.marginTop || 0) as number - slop.top;
    }
    if (slop.bottom !== undefined) {
      expandedStyle.paddingBottom = (resolvedStyle.paddingBottom || 0) as number + slop.bottom;
      expandedStyle.marginBottom = (resolvedStyle.marginBottom || 0) as number - slop.bottom;
    }
    if (slop.left !== undefined) {
      expandedStyle.paddingLeft = (resolvedStyle.paddingLeft || 0) as number + slop.left;
      expandedStyle.marginLeft = (resolvedStyle.marginLeft || 0) as number - slop.left;
    }
    if (slop.right !== undefined) {
      expandedStyle.paddingRight = (resolvedStyle.paddingRight || 0) as number + slop.right;
      expandedStyle.marginRight = (resolvedStyle.marginRight || 0) as number - slop.right;
    }
    resolvedStyle = expandedStyle;
  }

  const css = styleToCSS(resolvedStyle);
  if (!disabled) {
    css.cursor = 'pointer';
  } else {
    css.cursor = 'not-allowed';
    css.opacity = css.opacity ?? 0.5;
  }
  css.userSelect = 'none';

  const resolvedChildren = isChildrenFunction
    ? (children as (state: PressableState) => React.ReactNode)(state)
    : children;

  return (
    <div
      style={css}
      onClick={handlePressIn as any}
      onMouseUp={handlePressOut as any}
      onPointerEnter={handleHoverIn as any}
      onPointerLeave={handleHoverOut as any}
      onKeyDown={handleKeyDown as any}
      onKeyUp={handleKeyUp as any}
      tabIndex={disabled ? -1 : 0}
      role={accessibilityRole || 'button'}
      aria-disabled={disabled}
    >
      {resolvedChildren}
    </div>
  );
}
