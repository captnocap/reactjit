/**
 * classifier — global registry of named primitives with theme tokens,
 * layout variants, and breakpoint overrides.
 *
 *   classifier({
 *     Card: {
 *       type: 'Box',
 *       style: { padding: 16, borderRadius: 'theme:radiusMd', backgroundColor: 'theme:surface' },
 *       hoverStyle: { borderColor: 'theme:primary' },
 *       variants: {
 *         magazine:  { style: { flexDirection: 'row', padding: 20 } },
 *         brutalist: { style: { padding: 8, borderRadius: 0 } },
 *       },
 *       bp: {
 *         sm: {
 *           style: { flexDirection: 'column', gap: 4 },
 *           variants: { magazine: { style: { gap: 2 } } },
 *         },
 *       },
 *       use: () => ({ ... })  // optional hook-produced prop overrides
 *     }
 *   });
 *
 * Import and render:
 *
 *   import { classifiers as C } from './classifier';
 *   <C.Card>...</C.Card>
 *
 * Style layer precedence (low → high):
 *   base → bp[current] → variants[active] → bp[current].variants[active] → user props → hook(use)
 *
 * Tokens: any string value like `'theme:bg'` or `'theme:radiusMd'` resolves
 * against the active color / style palettes. Unknown tokens pass through.
 */

import React from 'react';
import {
  resolveTokens,
  hasTokens,
  __useClassifierSnapshot,
  type ThemeColors,
  type StylePalette,
  type Breakpoint,
} from './theme';
import {
  Box, Text, Image, Pressable, ScrollView, TextInput,
  Canvas, Graph, Native,
} from './primitives';
import { Icon } from './icons/Icon';

// The renderer's actual host elements. Row/Col are JSX sugar over Box
// with flexDirection set — they're not primitives and have no place here.
// Classifiers express direction explicitly: type: 'Box', style: { flexDirection: 'row' }.
//
// Icon is a wrapper over Graph that takes `icon` (path data) / `name` /
// `size` / `color` / `strokeWidth` as props. It earns a slot here so
// classifiers can theme `color` via `'theme:NAME'` resolution.
const PRIMITIVES: Record<string, any> = {
  Box, Text, Image, Pressable, ScrollView, TextInput,
  Canvas, CanvasNode: Canvas.Node, CanvasPath: Canvas.Path, CanvasClamp: Canvas.Clamp,
  Graph, GraphNode: Graph.Node, GraphPath: Graph.Path,
  Native, Icon,
};

const STYLE_KEYS = [
  'style', 'hoverStyle', 'activeStyle', 'focusStyle',
  'textStyle', 'contentContainerStyle',
];

const STYLE_KEY_SET = new Set(STYLE_KEYS);
const RESERVED_KEYS = new Set(['type', 'use', 'variants', 'bp']);

// ── Types ─────────────────────────────────────────────

export type StyleBlock = Record<string, any>;

export interface ClassifierStyleSet {
  style?: StyleBlock;
  hoverStyle?: StyleBlock;
  activeStyle?: StyleBlock;
  focusStyle?: StyleBlock;
  textStyle?: StyleBlock;
  contentContainerStyle?: StyleBlock;
  /** Non-style default props passed through to the primitive. */
  [key: string]: any;
}

export type VariantMap = Record<string, ClassifierStyleSet>;

export interface BreakpointOverride extends ClassifierStyleSet {
  variants?: VariantMap;
}

export type BreakpointMap = Partial<Record<Breakpoint, BreakpointOverride>>;

export interface ClassifierDef extends ClassifierStyleSet {
  type: string;
  use?: () => Record<string, any>;
  variants?: VariantMap;
  bp?: BreakpointMap;
}

// ── Style merging ─────────────────────────────────────

function shallowMergeStyle(...blocks: Array<StyleBlock | undefined>): StyleBlock | undefined {
  const present = blocks.filter((b): b is StyleBlock => !!b && typeof b === 'object');
  if (present.length === 0) return undefined;
  if (present.length === 1) return present[0];
  return Object.assign({}, ...present);
}

/** Merge a layered ClassifierStyleSet (for every STYLE_KEY) plus flat defaults. */
function mergeStyleSets(...sets: Array<ClassifierStyleSet | undefined>): ClassifierStyleSet {
  const out: ClassifierStyleSet = {};
  for (const s of sets) {
    if (!s) continue;
    for (const k of Object.keys(s)) {
      if (RESERVED_KEYS.has(k)) continue;
      if (STYLE_KEY_SET.has(k)) {
        out[k] = shallowMergeStyle(out[k], s[k]);
      } else {
        // non-style defaults: later wins
        out[k] = s[k];
      }
    }
  }
  return out;
}

/** Merge resolved defaults with user props — style keys shallow-merge, others overwrite. */
function mergeUserProps(defaults: Record<string, any>, user: Record<string, any>): Record<string, any> {
  const merged: Record<string, any> = { ...defaults, ...user };
  for (const k of STYLE_KEYS) {
    if (defaults[k] && user[k]) {
      merged[k] = { ...defaults[k], ...user[k] };
    }
  }
  return merged;
}

// ── Per-classifier compile ────────────────────────────

/** Split a def into a style-set (style blocks + flat defaults), stripping reserved keys. */
function stripReserved(def: ClassifierDef | ClassifierStyleSet): ClassifierStyleSet {
  const out: ClassifierStyleSet = {};
  for (const k of Object.keys(def)) {
    if (RESERVED_KEYS.has(k)) continue;
    out[k] = (def as any)[k];
  }
  return out;
}

function collectTokens(def: ClassifierDef): boolean {
  if (hasTokens(stripReserved(def) as Record<string, any>)) return true;
  if (def.variants) {
    for (const v of Object.values(def.variants)) {
      if (hasTokens(v as Record<string, any>)) return true;
    }
  }
  if (def.bp) {
    for (const bp of Object.values(def.bp)) {
      if (!bp) continue;
      if (hasTokens(bp as Record<string, any>)) return true;
    }
  }
  return false;
}

function hasAnyVariants(def: ClassifierDef): boolean {
  if (def.variants && Object.keys(def.variants).length) return true;
  if (def.bp) {
    for (const bp of Object.values(def.bp)) {
      if (bp?.variants && Object.keys(bp.variants).length) return true;
    }
  }
  return false;
}

function hasAnyBreakpoints(def: ClassifierDef): boolean {
  return !!(def.bp && Object.keys(def.bp).length);
}

/** Build the effective style-set for a given variant+breakpoint. */
function resolveEffective(
  def: ClassifierDef,
  variant: string | null,
  bp: Breakpoint,
): ClassifierStyleSet {
  const base = stripReserved(def);
  const bpBase = def.bp?.[bp] ? stripReserved(def.bp[bp] as ClassifierStyleSet) : undefined;
  const varBase = variant && def.variants?.[variant]
    ? stripReserved(def.variants[variant])
    : undefined;
  const bpVar = variant && def.bp?.[bp]?.variants?.[variant]
    ? stripReserved(def.bp[bp]!.variants![variant])
    : undefined;
  return mergeStyleSets(base, bpBase, varBase, bpVar);
}

// ── Registry ──────────────────────────────────────────

const _registry: Record<string, any> = {};

export function classifier(defs: Record<string, ClassifierDef>): void {
  for (const name of Object.keys(defs)) {
    if (_registry[name]) {
      throw new Error(
        `classifier: "${name}" already registered. Classifiers are global — one name, one definition.`,
      );
    }

    const def = defs[name];
    const Primitive = PRIMITIVES[def.type];
    if (!Primitive) {
      throw new Error(
        `classifier: "${def.type}" is not a primitive. Valid: ${Object.keys(PRIMITIVES).join(', ')}`,
      );
    }

    const needsTokens = collectTokens(def);
    const needsVariants = hasAnyVariants(def);
    const needsBp = hasAnyBreakpoints(def);
    const needsHook = typeof def.use === 'function';
    const needsStore = needsTokens || needsVariants || needsBp;

    // Precompute the static base (no variant, no bp) for the fast path.
    const staticBase = stripReserved(def);
    const staticBaseIsEmpty = Object.keys(staticBase).length === 0;

    let C: any;

    if (!needsStore && !needsHook && staticBaseIsEmpty) {
      // Identity: classifier adds nothing on top of the primitive.
      C = Primitive;
    } else if (!needsStore && !needsHook) {
      // Defaults only, no tokens, no variants, no bp, no hook.
      C = (props: any) =>
        React.createElement(Primitive, mergeUserProps(staticBase, props));
    } else {
      C = (props: any) => {
        const snap = needsStore ? __useClassifierSnapshot() : null;

        let effective: ClassifierStyleSet;
        if (snap && (needsVariants || needsBp)) {
          effective = resolveEffective(def, snap.variant, snap.breakpoint);
        } else {
          effective = staticBase;
        }

        let resolved: Record<string, any>;
        if (needsTokens && snap) {
          resolved = resolveTokens(effective as Record<string, any>, snap.colors, snap.styles);
        } else {
          resolved = effective as Record<string, any>;
        }

        const hookProps = needsHook ? def.use!() : null;
        const merged = hookProps
          ? mergeUserProps(resolved, mergeUserProps(hookProps, props))
          : mergeUserProps(resolved, props);
        return React.createElement(Primitive, merged);
      };
    }

    C.displayName = name;
    C.__isClassifier = true;
    C.__def = def;
    _registry[name] = C;
  }
}

/** Read-only view of the classifier registry. `<C.Card>`, `<C.Header>`, etc. */
export const classifiers: Readonly<Record<string, any>> = _registry;

/** Inspect a registered classifier by name (for tooling). */
export function getClassifier(name: string): any | null {
  return _registry[name] ?? null;
}

/** All registered classifier names. */
export function classifierNames(): string[] {
  return Object.keys(_registry);
}
