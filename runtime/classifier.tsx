/**
 * classifier — global registry of named primitives.
 *
 * Ported from love2d/packages/core/src/classifier.ts. Same shape:
 *
 *   classifier({
 *     Card:   { type: 'Box', style: { backgroundColor: '#222', padding: 16 } },
 *     Header: { type: 'Text', style: { fontSize: 24, color: 'theme:text' } },
 *   });
 *
 * Then:
 *
 *   import { classifiers as C } from './classifier';
 *   <C.Card><C.Header>Hello</C.Header></C.Card>
 *
 * Theme token resolution: `'theme:text'` → colors.text at render time when
 * wrapped in <ThemeProvider>. Without a provider, tokens pass through as-is.
 */

import { useThemeColorsOptional } from './theme';
import {
  Box, Row, Col, Text, Image, Pressable, ScrollView, TextInput,
  Canvas, Graph, Native,
} from './primitives';

const React: any = require('react');

const PRIMITIVES: Record<string, any> = {
  Box, Row, Col, Text, Image, Pressable, ScrollView, TextInput,
  Canvas, Graph, Native,
};

// ── Theme token resolution ──────────────────────────────────

const THEME_PREFIX = 'theme:';

function isThemeToken(v: unknown): v is string {
  return typeof v === 'string' && v.startsWith(THEME_PREFIX);
}

function resolveTokens(obj: Record<string, any>, colors: Record<string, string>): Record<string, any> {
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

// ── Style merge ─────────────────────────────────────────────

const STYLE_KEYS = ['style', 'hoverStyle', 'activeStyle', 'focusStyle', 'textStyle', 'contentContainerStyle'];

function mergeProps(defaults: Record<string, any>, user: Record<string, any>): Record<string, any> {
  const merged: Record<string, any> = { ...defaults, ...user };
  for (const key of STYLE_KEYS) {
    if (defaults[key] && user[key]) {
      merged[key] = { ...defaults[key], ...user[key] };
    }
  }
  return merged;
}

// ── Global registry ─────────────────────────────────────────

const _registry: Record<string, any> = {};

type ClassifierDef = {
  type: string;
  use?: () => Record<string, any>;
  [key: string]: any;
};

export function classifier(defs: Record<string, ClassifierDef>): void {
  for (const name of Object.keys(defs)) {
    if (_registry[name]) {
      throw new Error(
        `classifier: "${name}" already registered. Classifiers are global — one name, one definition.`
      );
    }

    const { type, use, ...defaults } = defs[name];
    const Primitive = PRIMITIVES[type];
    if (!Primitive) {
      throw new Error(
        `classifier: "${type}" is not a primitive. Valid: ${Object.keys(PRIMITIVES).join(', ')}`
      );
    }

    const hasDefaults = Object.keys(defaults).length > 0;
    const needsTheme = hasDefaults && hasTokens(defaults);
    const needsHook = typeof use === 'function';

    let C: any;
    if (!hasDefaults && !needsHook) {
      C = Primitive;
    } else if (!needsTheme && !needsHook) {
      C = (props: any) => React.createElement(Primitive, mergeProps(defaults, props));
    } else {
      C = (props: any) => {
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
    C.__isClassifier = true;
    _registry[name] = C;
  }
}

export const classifiers: Readonly<Record<string, any>> = _registry;
