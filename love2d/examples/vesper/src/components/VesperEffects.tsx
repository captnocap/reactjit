/**
 * VesperEffects — Ambient visual effects layer.
 *
 * FlowParticles behind the content area for an organic feel.
 * CRT mask over the viewport for phosphor terminal aesthetic.
 * Both are subtle — the app should feel alive, not distracting.
 */

import React from 'react';
import { FlowParticles, CRT } from '@reactjit/core';

// ── Background Particles ────────────────────────────────

export function VesperBackground() {
  return (
    <FlowParticles
      background
      speed={0.3}
      decay={0.015}
      reactive
    />
  );
}

// ── CRT Overlay ─────────────────────────────────────────

export function VesperCRT() {
  return (
    <CRT
      mask
      intensity={0.04}
      scanlineIntensity={0.08}
      curvature={0}
      rgbShift={0.5}
      vignette={0.15}
      flicker={0.01}
      shaderContrast={1.02}
      shaderSaturation={1.04}
      shaderTint="#8B5CF6"
      shaderTintMix={0.03}
    />
  );
}
