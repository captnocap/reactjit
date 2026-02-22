/**
 * Modal component for reactjit — native mode only.
 *
 * Displays content in a full-screen overlay with backdrop via the Portal system.
 *
 * Features:
 * - Backdrop with customizable color (tap/click to dismiss)
 * - Centered content via flexbox
 * - Escape key dismissal via onKeyDown broadcast
 * - onShow / onRequestClose lifecycle callbacks
 *
 * Native requirements:
 * - Wrap your root component with <PortalHost> (already done in native-main.tsx).
 *   Without it the portal registers with a null context and renders nothing.
 */

import React, { useCallback, useEffect, useRef } from 'react';
import { Portal } from './Portal';
import { Box } from './primitives';
import { Pressable } from './Pressable';
import type { Style, Color, LoveEvent } from './types';

export interface ModalProps {
  visible: boolean;
  onRequestClose?: () => void;
  onShow?: () => void;
  transparent?: boolean;
  backdropColor?: Color;
  /** Close when tapping/clicking outside the content. Default true. */
  backdropDismiss?: boolean;
  children: React.ReactNode;
  /** Applied to the content wrapper Box. */
  style?: Style;
}

export function Modal({
  visible,
  onRequestClose,
  onShow,
  transparent = false,
  backdropColor = [0, 0, 0, 0.5],
  backdropDismiss = true,
  children,
  style,
}: ModalProps) {
  // Fire onShow when modal becomes visible
  const prevVisibleRef = useRef(false);
  useEffect(() => {
    if (visible && !prevVisibleRef.current && onShow) {
      onShow();
    }
    prevVisibleRef.current = visible;
  }, [visible, onShow]);

  const handleBackdropPress = useCallback(() => {
    if (backdropDismiss && onRequestClose) onRequestClose();
  }, [backdropDismiss, onRequestClose]);

  // Native: Escape via onKeyDown broadcast (Love2D key names are lowercase)
  const handleNativeKeyDown = useCallback((event: LoveEvent) => {
    if (event.key === 'escape' && onRequestClose) onRequestClose();
  }, [onRequestClose]);

  if (!visible) return null;

  const finalBackdropColor = transparent ? [0, 0, 0, 0] as Color : backdropColor;

  // Layout:
  //   Outer Box (position:absolute, fills viewport, flex-center)
  //     Backdrop Pressable (position:absolute, fills viewport, zIndex:0)
  //     Content Pressable  (in flow, centered, zIndex:1, onPress={noop})
  //
  // The content Pressable has a no-op onPress so that clicks anywhere inside
  // the content area are consumed and do not fall through to the backdrop.

  return (
    <Portal>
      <Box
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          justifyContent: 'center',
          alignItems: 'center',
        }}
        onKeyDown={handleNativeKeyDown}
      >
        {/* Backdrop — position:absolute so it doesn't participate in flex flow */}
        <Pressable
          onPress={handleBackdropPress}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            backgroundColor: finalBackdropColor,
          }}
        >
          <Box style={{ width: '100%', height: '100%' }} />
        </Pressable>

        {/* Content — fills viewport, centers children, consumes clicks */}
        <Pressable
          onPress={() => {/* consume clicks so they don't reach the backdrop */}}
          style={{ width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center', zIndex: 1, ...style }}
        >
          {children}
        </Pressable>
      </Box>
    </Portal>
  );
}
