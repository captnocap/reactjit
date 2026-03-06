/**
 * classifier — global registry of named primitives.
 *
 * Define once at app init. Access anywhere via `classifiers`. Each name maps to
 * exactly one primitive with default props. No per-file definitions, no duplicates,
 * no "my Banner vs your Banner." One name, one definition, project-wide.
 *
 * @example
 * // Register (once, at app entry)
 * import { classifier } from '@reactjit/core'
 *
 * classifier({
 *   Banner:   { type: 'Box', bg: '#1a1a2e', padding: 24, w: '100%' },
 *   Card:     { type: 'Box', borderRadius: 12, padding: 16, gap: 8 },
 *   Heading:  { type: 'Text', size: 28, bold: true },
 *   Subtitle: { type: 'Text', size: 16, color: '#888' },
 * })
 *
 * // Use (anywhere)
 * import { classifiers as C } from '@reactjit/core'
 *
 * function MyPage() {
 *   return (
 *     <C.Banner>
 *       <C.Heading color="#fff">Welcome</C.Heading>
 *     </C.Banner>
 *   )
 * }
 */

import React from 'react';
import { Box, Row, Col, Text, Image } from './primitives';
import { Pressable } from './Pressable';
import { ScrollView } from './ScrollView';
import { Input } from './Input';
import { Video } from './Video';
import type {
  BoxProps, ColProps, TextProps, ImageProps,
  ScrollViewProps, InputProps, VideoProps,
} from './types';
import type { PressableProps } from './Pressable';

// ── Primitive type map ────────────────────────────────────

export interface ClassifierMap {
  Box: BoxProps;
  Row: BoxProps;
  Col: ColProps;
  Text: TextProps;
  Image: ImageProps;
  Pressable: PressableProps;
  ScrollView: ScrollViewProps;
  Input: InputProps;
  Video: VideoProps;
}

const PRIMITIVES: Record<string, React.FC<any>> = {
  Box, Row, Col, Text, Image, Pressable, ScrollView, Input, Video,
};

// ── Style-object merge ────────────────────────────────────

const STYLE_KEYS = [
  'style', 'hoverStyle', 'activeStyle', 'focusStyle',
  'textStyle', 'contentContainerStyle',
];

function mergeProps(
  defaults: Record<string, any>,
  user: Record<string, any>,
): Record<string, any> {
  const merged: Record<string, any> = { ...defaults, ...user };
  for (let i = 0; i < STYLE_KEYS.length; i++) {
    const key = STYLE_KEYS[i];
    if (defaults[key] && user[key]) {
      merged[key] = { ...defaults[key], ...user[key] };
    }
  }
  return merged;
}

// ── Global registry ───────────────────────────────────────

const _registry: Record<string, React.FC<any>> = {};

type SheetEntry = {
  [K in keyof ClassifierMap]: { type: K } & Partial<ClassifierMap[K]>
}[keyof ClassifierMap];

/**
 * Register classifiers globally. Call once at app init.
 * Throws on duplicate names — each classifier can only be defined once.
 */
export function classifier(defs: Record<string, SheetEntry>): void {
  for (const name of Object.keys(defs)) {
    if (_registry[name]) {
      throw new Error(
        `classifier: "${name}" is already registered. ` +
        `Classifiers are global — each name can only be defined once.`
      );
    }

    const { type, ...defaults } = defs[name] as { type: keyof ClassifierMap; [k: string]: any };
    const Primitive = PRIMITIVES[type];
    if (!Primitive) {
      throw new Error(
        `classifier: "${type}" is not a primitive. Valid: ${Object.keys(PRIMITIVES).join(', ')}`
      );
    }

    const hasDefaults = Object.keys(defaults).length > 0;
    const C: React.FC<any> = hasDefaults
      ? (props) => React.createElement(Primitive, mergeProps(defaults, props))
      : Primitive;

    C.displayName = name;
    _registry[name] = C;
  }
}

/**
 * The global classifier registry. Access registered classifiers as properties.
 *
 * @example
 * import { classifiers as C } from '@reactjit/core'
 * <C.Banner><C.Heading>Hello</C.Heading></C.Banner>
 */
export const classifiers: Readonly<Record<string, React.FC<any>>> = _registry;
