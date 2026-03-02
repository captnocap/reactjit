/**
 * ScrollView -- scrollable container primitive
 *
 * Renders as a string-typed 'View' host element with overflow:'scroll'.
 * The Lua side handles scissor clipping, scroll translation, scrollbar
 * indicators, and wheel events.
 *
 * Supports both vertical (default) and horizontal scrolling.
 * Exposes an imperative scrollTo() method via React.forwardRef.
 */

import React, {
  forwardRef,
  useImperativeHandle,
  useRef,
} from 'react';
import type {
  ScrollViewProps,
  ScrollViewRef,
  Style,
} from './types';

export const ScrollView = forwardRef<ScrollViewRef, ScrollViewProps>(
  function ScrollView(
    {
      style,
      horizontal = false,
      showScrollIndicator = true,
      onScroll,
      onScrollBegin,
      onScrollEnd,
      children,
    },
    ref
  ) {
    const anyProps = arguments[0] as any;
    const playgroundLine = anyProps.__rjitPlaygroundLine;
    const playgroundTag = anyProps.__rjitPlaygroundTag;

    const scrollStateRef = useRef({ x: 0, y: 0 });

    useImperativeHandle(ref, () => ({
      scrollTo({ x, y }) {
        if (x !== undefined) scrollStateRef.current.x = x;
        if (y !== undefined) scrollStateRef.current.y = y;
      },
    }));

    const mergedStyle: Style = {
      ...(style || {}),
      overflow: 'scroll',
    };

    if (horizontal && !mergedStyle.flexDirection) {
      mergedStyle.flexDirection = 'row';
    }

    if (scrollStateRef.current.x !== 0) {
      mergedStyle.scrollX = scrollStateRef.current.x;
    }
    if (scrollStateRef.current.y !== 0) {
      mergedStyle.scrollY = scrollStateRef.current.y;
    }

    const hostProps: Record<string, any> = {
      style: mergedStyle,
      horizontal,
      showScrollIndicator,
      onScroll,
      onScrollBegin,
      onScrollEnd,
    };
    if (playgroundLine !== undefined) hostProps.__rjitPlaygroundLine = playgroundLine;
    if (playgroundTag !== undefined) hostProps.__rjitPlaygroundTag = playgroundTag;

    return React.createElement('View', hostProps, children);
  }
);
