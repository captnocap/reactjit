/**
 * Modal component for reactjit
 *
 * Displays content in a full-screen overlay with backdrop. Works in both web
 * and native mode via the Portal / PortalHost system.
 *
 * Features:
 * - Backdrop with customizable color (tap/click to dismiss)
 * - Centered content via flexbox
 * - Escape key dismissal
 * - Fade / slide animations (web only — native always uses instant show/hide)
 * - onShow / onRequestClose lifecycle callbacks
 *
 * Native requirements:
 * - Wrap your root component with <PortalHost> (already done in native-main.tsx).
 *   Without it the portal registers with a null context and renders nothing.
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Portal } from './Portal';
import { Box } from './primitives';
import { Pressable } from './Pressable';
import { useRendererMode } from './context';
import type { Style, Color, LoveEvent } from './types';

export interface ModalProps {
  visible: boolean;
  onRequestClose?: () => void;
  onShow?: () => void;
  /** Animations only apply in web mode. Native always shows/hides instantly. */
  animationType?: 'none' | 'fade' | 'slide';
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
  animationType = 'none',
  transparent = false,
  backdropColor = [0, 0, 0, 0.5],
  backdropDismiss = true,
  children,
  style,
}: ModalProps) {
  const mode = useRendererMode();

  // Native: setInterval is unreliable in QuickJS — always instant show/hide.
  const effectiveAnimationType = mode === 'native' ? 'none' : animationType;

  const [animationState, setAnimationState] = useState<'entering' | 'entered' | 'exiting' | 'exited'>(
    visible ? 'entered' : 'exited'
  );
  const previousVisibleRef = useRef(visible);
  const onShowCalledRef = useRef(false);

  useEffect(() => {
    if (visible === previousVisibleRef.current) return;
    previousVisibleRef.current = visible;

    if (visible) {
      onShowCalledRef.current = false;
      if (effectiveAnimationType === 'none') {
        setAnimationState('entered');
      } else {
        setAnimationState('entering');
        const steps = 4;
        const stepDuration = 200 / steps;
        let currentStep = 0;
        const interval = setInterval(() => {
          currentStep++;
          if (currentStep >= steps) {
            clearInterval(interval);
            setAnimationState('entered');
          }
        }, stepDuration);
        return () => clearInterval(interval);
      }
    } else {
      if (effectiveAnimationType === 'none') {
        setAnimationState('exited');
      } else {
        setAnimationState('exiting');
        const steps = 4;
        const stepDuration = 200 / steps;
        let currentStep = 0;
        const interval = setInterval(() => {
          currentStep++;
          if (currentStep >= steps) {
            clearInterval(interval);
            setAnimationState('exited');
          }
        }, stepDuration);
        return () => clearInterval(interval);
      }
    }
  }, [visible, effectiveAnimationType]);

  useEffect(() => {
    if (animationState === 'entered' && !onShowCalledRef.current && onShow) {
      onShowCalledRef.current = true;
      onShow();
    }
  }, [animationState, onShow]);

  // Web: Escape via DOM listener
  useEffect(() => {
    if (mode !== 'web' || !visible || !onRequestClose) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onRequestClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [mode, visible, onRequestClose]);

  // Web: prevent body scroll while open
  useEffect(() => {
    if (mode !== 'web' || !visible) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [mode, visible]);

  const handleBackdropPress = useCallback(() => {
    if (backdropDismiss && onRequestClose) onRequestClose();
  }, [backdropDismiss, onRequestClose]);

  // Native: Escape via onKeyDown broadcast (Love2D key names are lowercase)
  const handleNativeKeyDown = useCallback((event: LoveEvent) => {
    if (event.key === 'escape' && onRequestClose) onRequestClose();
  }, [onRequestClose]);

  if (!visible && animationState === 'exited') return null;

  const finalBackdropColor = transparent ? [0, 0, 0, 0] as Color : backdropColor;

  // ── Web path (uses CSS transitions + div wrapper) ────────────────────────

  if (mode === 'web') {
    let contentOpacity = 1;
    let contentTranslateY = 0;
    let backdropOpacity = 1;

    if (effectiveAnimationType === 'fade' &&
        (animationState === 'entering' || animationState === 'exiting')) {
      contentOpacity = 0.25;
      backdropOpacity = 0.25;
    } else if (effectiveAnimationType === 'slide' &&
               (animationState === 'entering' || animationState === 'exiting')) {
      contentTranslateY = 100;
    }

    const webTransition = effectiveAnimationType !== 'none' ? 'all 0.2s ease-out' : undefined;

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
        >
          <Pressable
            onPress={handleBackdropPress}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              backgroundColor: finalBackdropColor,
              opacity: backdropOpacity,
            }}
          >
            <Box style={{ width: '100%', height: '100%' }} />
          </Pressable>

          <div
            style={{
              position: 'relative',
              zIndex: 1,
              opacity: contentOpacity,
              transition: webTransition,
              transform: contentTranslateY !== 0
                ? `translateY(${contentTranslateY}px)`
                : undefined,
              ...(style as React.CSSProperties),
            } as React.CSSProperties}
          >
            {children}
          </div>
        </Box>
      </Portal>
    );
  }

  // ── Native path ──────────────────────────────────────────────────────────
  //
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
