/**
 * React-reconciler host config for the native (QuickJS FFI) renderer.
 *
 * Ported from reactor01's renderer.js to TypeScript.
 * Emits mutation commands (CREATE, APPEND, UPDATE, etc.) that get serialized
 * as JSON and sent to Lua via __hostFlush.
 */

import type { HostConfig } from 'react-reconciler';
import { reportError } from './errorReporter';
import { debugLog } from './debugLog';
import { tw } from '@reactjit/core';

// ── HTML Element Remapping ───────────────────────────────────────────
// Maps standard HTML element types to ReactJIT host types so that
// <div>, <span>, <h1>, <img>, etc. just work without modification.
// Lua never sees unknown types — the remap happens before CREATE.

const HTML_TYPE_MAP: Record<string, string> = {
  // Container elements → View
  'div': 'View', 'section': 'View', 'article': 'View', 'aside': 'View',
  'main': 'View', 'nav': 'View', 'header': 'View', 'footer': 'View',
  'form': 'View', 'fieldset': 'View', 'figure': 'View', 'figcaption': 'View',
  'ul': 'View', 'ol': 'View', 'li': 'View', 'dl': 'View', 'dt': 'View', 'dd': 'View',
  'table': 'View', 'thead': 'View', 'tbody': 'View', 'tfoot': 'View',
  'tr': 'View', 'td': 'View', 'th': 'View', 'caption': 'View',
  'a': 'View', 'button': 'View', 'details': 'View', 'summary': 'View',
  'dialog': 'View', 'menu': 'View',
  // Text elements → Text
  'span': 'Text', 'p': 'Text', 'label': 'Text',
  'h1': 'Text', 'h2': 'Text', 'h3': 'Text',
  'h4': 'Text', 'h5': 'Text', 'h6': 'Text',
  'strong': 'Text', 'b': 'Text', 'em': 'Text', 'i': 'Text',
  'code': 'Text', 'small': 'Text', 'mark': 'Text',
  'abbr': 'Text', 'cite': 'Text', 'q': 'Text', 'time': 'Text',
  'sub': 'Text', 'sup': 'Text',
  // Media → native equivalents
  'img': 'Image', 'video': 'Video',
  'input': 'TextInput', 'textarea': 'TextEditor',
  'pre': 'CodeBlock',
  'math': 'Math',
  // Ignored structural (map to View so they don't break)
  'html': 'View', 'body': 'View', 'head': 'View',
  'br': 'View', 'hr': 'View', 'wbr': 'View',
};

// Heading font sizes (matching common browser defaults)
const HEADING_FONT_SIZE: Record<string, number> = {
  h1: 32, h2: 28, h3: 24, h4: 20, h5: 18, h6: 16,
};

// HTML-only props that should not cross the bridge
const HTML_STRIP_PROPS = new Set([
  'alt', 'htmlFor', 'href', 'target', 'rel', 'method', 'action',
  'encType', 'noValidate', 'autoComplete', 'role', 'tabIndex',
  'type', 'min', 'max', 'step', 'checked', 'selected', 'multiple',
  'cols', 'rows', 'wrap', 'spellCheck', 'inputMode', 'pattern',
  'required', 'readOnly', 'disabled', 'name', 'form', 'list',
  'aria-label', 'aria-hidden', 'aria-describedby', 'aria-labelledby',
  'data-testid', 'data-cy',
]);

/**
 * Transform HTML props into ReactJIT-compatible props.
 * Only called when the element type is in HTML_TYPE_MAP.
 */
function resolveHtmlProps(originalType: string, props: Record<string, any>): Record<string, any> {
  const resolved: Record<string, any> = {};

  for (const key of Object.keys(props)) {
    if (key === 'children') continue;
    if (HTML_STRIP_PROPS.has(key)) continue;
    // Strip any aria-* and data-* attributes
    if (key.startsWith('aria-') || key.startsWith('data-')) continue;
    resolved[key] = props[key];
  }

  // className → tw() → merge into style (style wins on conflicts)
  if (resolved.className && typeof resolved.className === 'string') {
    const twStyle = tw(resolved.className);
    resolved.style = resolved.style ? { ...twStyle, ...resolved.style } : twStyle;
    delete resolved.className;
  }

  // Heading defaults: fontSize + bold
  const headingSize = HEADING_FONT_SIZE[originalType];
  if (headingSize) {
    const headingStyle = { fontSize: headingSize, fontWeight: 'bold' as const };
    resolved.style = resolved.style ? { ...headingStyle, ...resolved.style } : headingStyle;
  }

  // strong/b → bold
  if (originalType === 'strong' || originalType === 'b') {
    const boldStyle = { fontWeight: 'bold' as const };
    resolved.style = resolved.style ? { ...boldStyle, ...resolved.style } : boldStyle;
  }

  // img: src → source
  if (originalType === 'img' && resolved.src) {
    resolved.source = resolved.src;
    delete resolved.src;
  }

  // input/textarea: coerce value to string (Lua textinput expects string, not number)
  if ((originalType === 'input' || originalType === 'textarea') && resolved.value != null) {
    resolved.value = String(resolved.value);
  }

  // Note: onClick is NOT remapped — the event dispatcher already dispatches
  // press events as 'onClick'. Handlers pass through as-is.

  return resolved;
}

// ── Types ────────────────────────────────────────────────

export interface Instance {
  id: number;
  type: string;
  props: Record<string, any>;
  handlers: Record<string, Function>;
  children: Instance[];
  renderCount: number;
}

export interface TextInstance {
  id: number;
  text: string;
}

type Container = { id: number };
type Props = Record<string, any>;
type UpdatePayload = Record<string, any> | null;

interface Command {
  op: string;
  [key: string]: any;
}

// ── Globals / FFI bridge ─────────────────────────────────

declare const globalThis: {
  __hostFlush: (commands: string | Command[]) => void;
  __hostGetEvents: () => any[];
  _pollAndDispatchEvents?: () => void;
  [key: string]: any;
};

// ── Transport abstraction ────────────────────────────────

/** Injected flush handler — decouples the reconciler from a specific transport. */
let transportFlush: ((commands: Command[]) => void) | null = null;

/**
 * Register the transport flush handler.
 * Called by the bridge implementation (NativeBridge, WebSocketBridge, etc.)
 * to tell the reconciler how to deliver commands.
 */
export function setTransportFlush(fn: (commands: Command[]) => void): void {
  transportFlush = fn;
}

// ── State ────────────────────────────────────────────────

let nodeIdCounter = 0;
const pendingCommands: Command[] = [];
const rootInstances: Instance[] = [];

/**
 * Get the current root-level instances.
 * Used by remote targets (e.g., CC) to walk the JS-side tree
 * instead of sending mutation commands to a Lua bridge.
 */
export function getRootInstances(): Instance[] {
  return rootInstances;
}

/**
 * Registry of event handlers keyed by nodeId.
 * Handlers never cross the bridge — they stay in JS.
 * Lua sends events referencing targetId, and we dispatch here.
 */
export const handlerRegistry = new Map<number, Record<string, Function>>();

// ── Helpers ──────────────────────────────────────────────

function emit(cmd: Command): void {
  pendingCommands.push(cmd);
}

/**
 * Merge multiple UPDATE commands targeting the same node into a single command.
 * Non-UPDATE commands and UPDATEs for distinct nodes pass through unchanged.
 */
function coalesceCommands(commands: Command[]): Command[] {
  const updateMap = new Map<number, number>(); // nodeId -> index in output
  const output: Command[] = [];

  for (const cmd of commands) {
    if (cmd.op === 'UPDATE' && cmd.id != null) {
      const existingIdx = updateMap.get(cmd.id);
      if (existingIdx !== undefined) {
        const existing = output[existingIdx];
        // Merge props
        existing.props = { ...existing.props, ...cmd.props };
        // Merge style sub-objects
        if (existing.props.style && cmd.props.style) {
          existing.props.style = { ...existing.props.style, ...cmd.props.style };
        }
        // Merge removal arrays
        if (cmd.removeKeys) {
          existing.removeKeys = [...(existing.removeKeys || []), ...cmd.removeKeys];
        }
        if (cmd.removeStyleKeys) {
          existing.removeStyleKeys = [...(existing.removeStyleKeys || []), ...cmd.removeStyleKeys];
        }
        // Latest hasHandlers wins
        if (cmd.hasHandlers !== undefined) {
          existing.hasHandlers = cmd.hasHandlers;
        }
        continue;
      }
      updateMap.set(cmd.id, output.length);
    }
    output.push({ ...cmd });
  }

  return output;
}

export function flushToHost(): void {
  if (pendingCommands.length === 0) return;

  // Resolve transport on first flush (backwards compat: fall back to global)
  if (!transportFlush) {
    if (typeof globalThis.__hostFlush === 'function') {
      transportFlush = (cmds) => globalThis.__hostFlush(cmds);
    } else {
      return;
    }
  }

  const coalesced = coalesceCommands(pendingCommands);
  debugLog.log('recon', `flushToHost pending=${pendingCommands.length} coalesced=${coalesced.length}`);

  try {
    // Send as JSON string to avoid QuickJS GC race during FFI object traversal.
    // Large strings (500+ chars) can be silently collected by GC during property
    // enumeration of sibling properties, causing silent data loss across the bridge.
    transportFlush(JSON.stringify(coalesced));
  } catch (e) {
    reportError(e, 'flushToHost (' + coalesced.length + ' commands)');
  }
  pendingCommands.length = 0;
}

/**
 * Separate on* handler props from regular props.
 * Handlers stay in JS; only clean props cross the bridge.
 */
export function extractHandlers(
  props: Props
): { clean: Record<string, any>; handlers: Record<string, Function> } {
  const clean: Record<string, any> = {};
  const handlers: Record<string, Function> = {};

  for (const key of Object.keys(props)) {
    if (key === 'children') continue;
    if (key.startsWith('on') && typeof props[key] === 'function') {
      handlers[key] = props[key];
    } else {
      clean[key] = props[key];
    }
  }

  return { clean, handlers };
}

/**
 * Build handler metadata for the inspector.
 * Maps handler names to short readable snippets of the function source.
 */
function buildHandlerMeta(handlers: Record<string, Function>): Record<string, string> | undefined {
  const keys = Object.keys(handlers);
  if (keys.length === 0) return undefined;
  const meta: Record<string, string> = {};
  for (const name of keys) {
    try {
      const src = handlers[name].toString().replace(/\s+/g, ' ').trim();
      meta[name] = src.length > 80 ? src.slice(0, 80) + '\u2026' : src;
    } catch {
      meta[name] = '(native)';
    }
  }
  return meta;
}

/**
 * Shallow equality check for prop diffing.
 */
export function shallowEqual(
  a: Record<string, any>,
  b: Record<string, any>
): boolean {
  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  if (keysA.length !== keysB.length) return false;
  for (const key of keysA) {
    if (a[key] !== b[key]) return false;
  }
  return true;
}

/**
 * Compare two handler maps by reference equality of each handler.
 */
function handlersEqual(a: Record<string, Function>, b: Record<string, Function>): boolean {
  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  if (keysA.length !== keysB.length) return false;
  for (const k of keysA) {
    if (a[k] !== b[k]) return false;
  }
  return true;
}

/**
 * Compute a partial diff between two style objects.
 * Returns changed keys (with new values) and removed keys.
 */
function diffStyleObjects(
  oldStyle: Record<string, any>,
  newStyle: Record<string, any>
): { changed: Record<string, any> | null; removed: string[] } {
  const changed: Record<string, any> = {};
  const removed: string[] = [];
  let hasChanged = false;

  for (const key of Object.keys(newStyle)) {
    if (oldStyle[key] !== newStyle[key]) {
      changed[key] = newStyle[key];
      hasChanged = true;
    }
  }

  for (const key of Object.keys(oldStyle)) {
    if (!(key in newStyle)) {
      removed.push(key);
    }
  }

  return {
    changed: hasChanged ? changed : null,
    removed,
  };
}

/**
 * Compute a minimal diff between two clean prop objects.
 * Returns the changed props (with partial style diff), removed top-level keys,
 * and removed style keys. Returns null if nothing changed.
 */
function diffCleanProps(
  oldClean: Record<string, any>,
  newClean: Record<string, any>
): { diff: Record<string, any>; removeKeys: string[]; removeStyleKeys: string[] } | null {
  const diff: Record<string, any> = {};
  const removeKeys: string[] = [];
  let removeStyleKeys: string[] = [];
  let hasDiff = false;

  for (const key of Object.keys(newClean)) {
    const oldVal = oldClean[key];
    const newVal = newClean[key];

    if (key === 'style') {
      const styleDiff = diffStyleObjects(oldVal || {}, newVal || {});
      if (styleDiff.changed) {
        diff.style = styleDiff.changed;
        hasDiff = true;
      }
      removeStyleKeys = styleDiff.removed;
      if (removeStyleKeys.length > 0) hasDiff = true;
    } else if (oldVal !== newVal) {
      diff[key] = newVal;
      hasDiff = true;
    }
  }

  for (const key of Object.keys(oldClean)) {
    if (key === 'style') continue; // handled above
    if (!(key in newClean)) {
      removeKeys.push(key);
      hasDiff = true;
    }
  }

  return hasDiff ? { diff, removeKeys, removeStyleKeys } : null;
}

// ── DefaultEventPriority ────────────────────────────────

const DefaultEventPriority = 0b0000000000000000000000000010000;

// ── Host Config ──────────────────────────────────────────

export const hostConfig: HostConfig<
  string,         // Type
  Props,          // Props
  Container,      // Container
  Instance,       // Instance
  TextInstance,    // TextInstance
  never,          // SuspenseInstance
  never,          // HydratableInstance
  Instance,       // PublicInstance
  {},             // HostContext
  UpdatePayload,  // UpdatePayload
  unknown,        // ChildSet
  number,         // TimeoutHandle
  number           // NoTimeout
> = {
  // ── Feature flags ────────────────────────────────────

  supportsMutation: true,
  supportsPersistence: false,
  supportsHydration: false,
  isPrimaryRenderer: true,

  // ── Context ──────────────────────────────────────────

  getRootHostContext() {
    return {};
  },

  getChildHostContext(_parentContext: {}) {
    return {};
  },

  // ── Instance creation ────────────────────────────────

  createInstance(
    type: string,
    props: Props,
    _rootContainer: Container,
    _hostContext: {},
    internalHandle?: any // React fiber (opaque, but we bend the rules for debugging)
  ): Instance {
    const id = ++nodeIdCounter;

    // HTML element remapping: <div> → View, <h1> → Text, <img> → Image, etc.
    const resolvedType = HTML_TYPE_MAP[type] || type;
    const resolvedProps = HTML_TYPE_MAP[type] ? resolveHtmlProps(type, props) : props;

    const { clean, handlers } = extractHandlers(resolvedProps);
    if (handlers.onLayout) {
      clean.__hasOnLayout = true;
    }

    const hasHandlers = Object.keys(handlers).length > 0;
    debugLog.log('recon', `createInstance id=${id} type=${resolvedType} handlers=${hasHandlers}`);

    // Extract component debug info from fiber (dev tooling only)
    let debugName: string | undefined;
    let debugSource: { fileName?: string; lineNumber?: number } | undefined;

    if (internalHandle) {
      try {
        // Walk up the fiber tree to find the nearest user component name.
        // Skip primitive wrappers (Box, Text, etc.) and classifier FCs —
        // these are framework internals. The meaningful debugName is the
        // user component that uses them (Band, LayoutStory, etc.).
        const PRIMITIVE_NAMES = new Set([
          'Box', 'Text', 'Image', 'Pressable', 'TextInput', 'ScrollView',
          'Modal', 'Row', 'Col', 'CodeBlock', 'Window', 'TextEditor',
        ]);
        let fiber = internalHandle;
        while (fiber) {
          if (fiber.type && typeof fiber.type === 'function') {
            const name = fiber.type.displayName || fiber.type.name;
            if (name && !PRIMITIVE_NAMES.has(name) && !(fiber.type as any).__isClassifier) {
              debugName = name;
              break;
            }
          }
          fiber = fiber.return;
        }

        // Walk the fiber chain to find source location (requires JSX dev transform).
        // createInstance runs for host nodes (View, Text, etc.) whose _debugSource
        // points to framework internals (primitives.tsx). We follow _debugOwner up
        // until we find a source file that isn't inside packages/ or node_modules/.
        const isUserFile = (f: string) =>
          f && !f.includes('/packages/') && !f.includes('/node_modules/') && !f.includes('\\packages\\') && !f.includes('\\node_modules\\');

        let src = internalHandle._debugSource;
        if (src && isUserFile(src.fileName)) {
          debugSource = { fileName: src.fileName, lineNumber: src.lineNumber };
        } else {
          // Follow _debugOwner chain to find nearest user-space source
          let owner = internalHandle._debugOwner;
          while (owner) {
            const ownerSrc = owner._debugSource;
            if (ownerSrc && isUserFile(ownerSrc.fileName)) {
              debugSource = { fileName: ownerSrc.fileName, lineNumber: ownerSrc.lineNumber };
              break;
            }
            // Also check the element's own source before moving up
            if (ownerSrc && !debugSource) {
              debugSource = { fileName: ownerSrc.fileName, lineNumber: ownerSrc.lineNumber };
            }
            owner = owner._debugOwner;
          }
        }
      } catch (e) {
        // Silently fail — fiber internals may change between React versions
      }
    }

    emit({
      op: 'CREATE',
      id,
      type: resolvedType,
      props: clean,
      hasHandlers,
      handlerMeta: hasHandlers ? buildHandlerMeta(handlers) : undefined,
      debugName,
      debugSource,
    });

    if (hasHandlers) {
      handlerRegistry.set(id, handlers);
    }

    return { id, type: resolvedType, props: clean, handlers, children: [], renderCount: 1 };
  },

  createTextInstance(text: string): TextInstance {
    const id = ++nodeIdCounter;
    emit({ op: 'CREATE_TEXT', id, text });
    return { id, text };
  },

  // ── Tree building (pre-commit) ──────────────────────

  appendInitialChild(parent: Instance, child: Instance | TextInstance) {
    (parent.children as any[]).push(child);
    emit({ op: 'APPEND', parentId: parent.id, childId: child.id });
  },

  finalizeInitialChildren() {
    return false;
  },

  // ── Mutations ────────────────────────────────────────

  appendChild(parent: Instance, child: Instance | TextInstance) {
    (parent.children as any[]).push(child);
    emit({ op: 'APPEND', parentId: parent.id, childId: child.id });
  },

  appendChildToContainer(container: Container, child: Instance | TextInstance) {
    rootInstances.push(child as Instance);
    emit({ op: 'APPEND_TO_ROOT', childId: child.id });
  },

  removeChild(parent: Instance, child: Instance | TextInstance) {
    debugLog.log('recon', `removeChild parent=${parent.id} child=${child.id}`);
    const idx = (parent.children as any[]).indexOf(child);
    if (idx !== -1) (parent.children as any[]).splice(idx, 1);
    emit({ op: 'REMOVE', parentId: parent.id, childId: child.id });
    cleanupHandlers(child);
  },

  removeChildFromContainer(_container: Container, child: Instance | TextInstance) {
    const idx = rootInstances.indexOf(child as Instance);
    if (idx !== -1) rootInstances.splice(idx, 1);
    emit({ op: 'REMOVE_FROM_ROOT', childId: child.id });
    cleanupHandlers(child);
  },

  insertBefore(
    parent: Instance,
    child: Instance | TextInstance,
    before: Instance | TextInstance
  ) {
    const arr = parent.children as any[];
    const idx = arr.indexOf(before);
    if (idx !== -1) {
      arr.splice(idx, 0, child);
    } else {
      arr.push(child);
    }
    emit({
      op: 'INSERT_BEFORE',
      parentId: parent.id,
      childId: child.id,
      beforeId: before.id,
    });
  },

  insertInContainerBefore(
    _container: Container,
    child: Instance | TextInstance,
    before: Instance | TextInstance
  ) {
    const idx = rootInstances.indexOf(before as Instance);
    if (idx !== -1) {
      rootInstances.splice(idx, 0, child as Instance);
    } else {
      rootInstances.push(child as Instance);
    }
    emit({
      op: 'INSERT_BEFORE_ROOT',
      childId: child.id,
      beforeId: before.id,
    });
  },

  // ── Updates ──────────────────────────────────────────

  prepareUpdate(
    _instance: Instance,
    _type: string,
    oldProps: Props,
    newProps: Props
  ): UpdatePayload {
    // Resolve HTML props before diffing so className→style, src→source, etc. are compared correctly
    const resolvedOld = HTML_TYPE_MAP[_type] ? resolveHtmlProps(_type, oldProps) : oldProps;
    const resolvedNew = HTML_TYPE_MAP[_type] ? resolveHtmlProps(_type, newProps) : newProps;

    const { clean: oldClean, handlers: oldH } = extractHandlers(resolvedOld);
    const { clean: newClean, handlers: newH } = extractHandlers(resolvedNew);
    if (oldH.onLayout) {
      oldClean.__hasOnLayout = true;
    }
    if (newH.onLayout) {
      newClean.__hasOnLayout = true;
    }

    const handlersChanged = !handlersEqual(oldH, newH);
    const propsDiff = diffCleanProps(oldClean, newClean);

    if (!propsDiff && !handlersChanged) return null;

    if (!propsDiff && handlersChanged) {
      return { __handlersOnly: true };
    }

    return propsDiff; // { diff, removeKeys, removeStyleKeys }
  },

  commitUpdate(
    instance: Instance,
    updatePayload: UpdatePayload,
    _type: string,
    _oldProps: Props,
    newProps: Props
  ) {
    // Resolve HTML props so the committed state matches what prepareUpdate diffed
    const resolvedNew = HTML_TYPE_MAP[_type] ? resolveHtmlProps(_type, newProps) : newProps;
    const { clean, handlers } = extractHandlers(resolvedNew);
    if (handlers.onLayout) {
      clean.__hasOnLayout = true;
    }

    // Update handler registry
    if (Object.keys(handlers).length > 0) {
      handlerRegistry.set(instance.id, handlers);
    } else {
      handlerRegistry.delete(instance.id);
    }

    instance.handlers = handlers;
    instance.props = clean;
    instance.renderCount = (instance.renderCount || 0) + 1;

    if (updatePayload && !(updatePayload as any).__handlersOnly) {
      const hasHandlers = Object.keys(handlers).length > 0;
      const payload = updatePayload as { diff: Record<string, any>; removeKeys: string[]; removeStyleKeys: string[] };
      debugLog.log('recon', `commitUpdate id=${instance.id} type=${instance.type} diffKeys=[${Object.keys(payload.diff).join(',')}] removeStyle=[${payload.removeStyleKeys.join(',')}]`);

      const cmd: any = {
        op: 'UPDATE',
        id: instance.id,
        props: payload.diff,
        hasHandlers,
        handlerMeta: hasHandlers ? buildHandlerMeta(handlers) : undefined,
        renderCount: instance.renderCount,
      };

      if (payload.removeKeys.length > 0) {
        cmd.removeKeys = payload.removeKeys;
      }
      if (payload.removeStyleKeys.length > 0) {
        cmd.removeStyleKeys = payload.removeStyleKeys;
      }

      emit(cmd);
    } else if (updatePayload && (updatePayload as any).__handlersOnly) {
      // Still need to inform Lua about hasHandlers change
      const hasHandlers = Object.keys(handlers).length > 0;
      emit({
        op: 'UPDATE',
        id: instance.id,
        props: {},
        hasHandlers,
        handlerMeta: hasHandlers ? buildHandlerMeta(handlers) : undefined,
      });
    }
  },

  commitTextUpdate(_textInstance: TextInstance, _oldText: string, newText: string) {
    _textInstance.text = newText;
    emit({ op: 'UPDATE_TEXT', id: _textInstance.id, text: newText });
  },

  // ── Commit lifecycle ─────────────────────────────────

  prepareForCommit() {
    return null;
  },

  resetAfterCommit() {
    flushToHost();
  },

  // ── Misc required methods ────────────────────────────

  shouldSetTextContent() {
    return false;
  },

  getPublicInstance(instance: Instance) {
    return instance;
  },

  preparePortalMount() {},

  scheduleTimeout: setTimeout,
  cancelTimeout: clearTimeout,
  noTimeout: -1,

  getCurrentEventPriority() {
    return DefaultEventPriority;
  },

  getInstanceFromNode() {
    return null;
  },

  beforeActiveInstanceBlur() {},
  afterActiveInstanceBlur() {},

  prepareScopeUpdate() {},
  getInstanceFromScope() {
    return null;
  },

  detachDeletedInstance() {},

  clearContainer() {},
};

// ── Internal helpers ─────────────────────────────────────

function cleanupHandlers(node: Instance | TextInstance): void {
  if ('id' in node) {
    handlerRegistry.delete(node.id);
  }
  if ('children' in node) {
    for (const child of (node as Instance).children) {
      cleanupHandlers(child);
    }
  }
}
