import React from 'react';
import { Native } from './Native';
import type { Style } from './types';

export interface SVGAnimationElementTarget {
  fill?: string;
  opacity?: number;
  translateX?: number;
  translateY?: number;
  rotate?: number;
  scale?: number;
  duration?: number;
  delay?: number;
  easing?: string;
}

export interface SVGAnimationProps {
  /** SVG string or file path */
  src: string;
  /** Target SVG for morph effect */
  srcTo?: string;
  /** Animation effect type */
  effect?: 'reveal' | 'morph' | 'elements' | 'follow';
  /** Duration in milliseconds */
  duration?: number;
  /** Easing function name */
  easing?: string;
  /** Loop the animation */
  loop?: boolean;
  /** Play/pause control */
  playing?: boolean;
  /** Manual progress override 0-1 */
  progress?: number;
  /** Render scale factor */
  scale?: number;
  /** Override stroke color (reveal effect) */
  strokeColor?: string;
  /** Override stroke width (reveal effect) */
  strokeWidth?: number;
  /** Also reveal fills progressively (reveal effect) */
  fillReveal?: boolean;
  /** Per-element animation targets by ID (elements effect) */
  targets?: Record<string, SVGAnimationElementTarget>;
  /** Element ID to use as motion path (follow effect) */
  pathId?: string;
  /** Progress callback */
  onProgress?: (data: { progress: number; x?: number; y?: number; angle?: number }) => void;
  /** Animation complete callback */
  onComplete?: () => void;
  style?: Style;
}

export function SVGAnimation(props: SVGAnimationProps) {
  return <Native type="SVGAnimation" {...props} />;
}
