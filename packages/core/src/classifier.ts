/**
 * classifier — global registry of named primitives.
 *
 * Define once at app init. Access anywhere via `classifiers`. Each name maps to
 * exactly one primitive with default props. No per-file definitions, no duplicates,
 * no "my Banner vs your Banner." One name, one definition, project-wide.
 *
 * Supports:
 *   - Static defaults (padding, gap, radius, etc.)
 *   - Theme token references ('theme:bg', 'theme:text', 'theme:border', etc.)
 *   - Hook-powered behavior via `use` field (runs inside the FC at render time)
 *
 * @example
 * import { classifier } from '@reactjit/core'
 *
 * classifier({
 *   Banner:   { type: 'Box', style: { backgroundColor: 'theme:bgElevated', padding: 24 } },
 *   Card:     { type: 'Box', style: { borderRadius: 12, padding: 16, gap: 8, borderColor: 'theme:border' } },
 *   Heading:  { type: 'Text', size: 28, bold: true, color: 'theme:text' },
 *   Submit:   { type: 'Pressable', style: { backgroundColor: 'theme:primary' },
 *              use: () => { const f = useForm(); return { onPress: f.submit }; } },
 * })
 *
 * import { classifiers as C } from '@reactjit/core'
 *
 * <C.Banner>
 *   <C.Heading>Welcome</C.Heading>
 *   <C.Submit><C.Heading size={14}>Go</C.Heading></C.Submit>
 * </C.Banner>
 */

import React from 'react';
import { Box, Row, Col, Text, Image } from './primitives';
import { Pressable } from './Pressable';
import { ScrollView } from './ScrollView';
import { Input } from './Input';
import { Video } from './Video';
import { useThemeColorsOptional } from './context';
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

// ── Theme token resolution ──────────────────────────────

const THEME_PREFIX = 'theme:';

function isThemeToken(v: unknown): v is string {
  return typeof v === 'string' && v.startsWith(THEME_PREFIX);
}

function resolveTokens(
  obj: Record<string, any>,
  colors: Record<string, string>,
): Record<string, any> {
  const out: Record<string, any> = {};
  for (const k of Object.keys(obj)) {
    const v = obj[k];
    if (isThemeToken(v)) {
      out[k] = colors[v.slice(THEME_PREFIX.length)] ?? v;
    } else if (v && typeof v === 'object' && !Array.isArray(v) && !(v instanceof Function)) {
      out[k] = resolveTokens(v, colors);
    } else {
      out[k] = v;
    }
  }
  return out;
}

/** Scan an object tree for any 'theme:*' string values. */
function hasTokens(obj: Record<string, any>): boolean {
  for (const k of Object.keys(obj)) {
    const v = obj[k];
    if (isThemeToken(v)) return true;
    if (v && typeof v === 'object' && !Array.isArray(v) && !(v instanceof Function)) {
      if (hasTokens(v)) return true;
    }
  }
  return false;
}

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
  [K in keyof ClassifierMap]: { type: K; use?: () => Record<string, any> } & Partial<ClassifierMap[K]>
}[keyof ClassifierMap];

/**
 * Register classifiers globally. Call from any `.cls.ts` file.
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

    const { type, use, ...defaults } = defs[name] as {
      type: keyof ClassifierMap;
      use?: () => Record<string, any>;
      [k: string]: any;
    };
    const Primitive = PRIMITIVES[type];
    if (!Primitive) {
      throw new Error(
        `classifier: "${type}" is not a primitive. Valid: ${Object.keys(PRIMITIVES).join(', ')}`
      );
    }

    const hasDefaults = Object.keys(defaults).length > 0;
    const needsTheme = hasDefaults && hasTokens(defaults);
    const needsHook = typeof use === 'function';

    let C: React.FC<any>;

    if (!hasDefaults && !needsHook) {
      // Bare alias — just the primitive
      C = Primitive;
    } else if (!needsTheme && !needsHook) {
      // Static defaults only — no theme, no hook
      C = (props) => React.createElement(Primitive, mergeProps(defaults, props));
    } else {
      // Theme tokens and/or hook — resolve at render time
      C = (props) => {
        const colors = needsTheme ? useThemeColorsOptional() : null;
        const resolved = colors ? resolveTokens(defaults, colors) : defaults;
        const hookProps = needsHook ? use!() : null;
        const merged = hookProps
          ? mergeProps(resolved, mergeProps(hookProps, props))
          : mergeProps(resolved, props);
        return React.createElement(Primitive, merged);
      };
    }

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
