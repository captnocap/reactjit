import type { Color, Style } from '@reactjit/core';
import type {
  PresentationAsset,
  PresentationCamera,
  PresentationDocument,
  PresentationFragment,
  PresentationFrame,
  PresentationNode,
  PresentationSelection,
  PresentationSettings,
  PresentationSlide,
  PresentationTheme,
} from './types';
import type { PresentationFactoryOptions } from './document';

import {
  createPresentationSlide,
  findPresentationSlide,
  normalizePresentationDocument,
} from './document.ts';

export interface PresentationDocumentChanges {
  title?: string;
  settings?: Partial<PresentationSettings>;
  theme?: PresentationTheme | null;
}

export interface PresentationSlideChanges {
  title?: string;
  notes?: string;
  backgroundColor?: PresentationSlide['backgroundColor'];
  transition?: PresentationSlide['transition'] | null;
  camera?: Partial<PresentationCamera>;
}

export interface PresentationNodeChanges {
  name?: string;
  frame?: Partial<PresentationFrame>;
  style?: PresentationNode['style'] | null;
  fragment?: PresentationFragment | null;
  locked?: boolean;
  hidden?: boolean;
  opacity?: number;
  meta?: Record<string, unknown>;
  text?: string;
  placeholder?: string;
  textStyle?: Style | null;
  shape?: 'rectangle' | 'ellipse' | 'line';
  fill?: Color;
  stroke?: Color;
  strokeWidth?: number;
  radius?: number;
  assetId?: string;
  alt?: string;
  fit?: Style['objectFit'];
  autoplay?: boolean;
  loop?: boolean;
  muted?: boolean;
  component?: string;
  props?: Record<string, unknown> | null;
  clip?: boolean;
}

export type PresentationPatch =
  | { type: 'replaceDocument'; document: PresentationDocument }
  | { type: 'setDocumentMeta'; changes: PresentationDocumentChanges }
  | { type: 'upsertAsset'; asset: PresentationAsset }
  | { type: 'removeAsset'; assetId: string }
  | { type: 'addSlide'; slide?: PresentationSlide; index?: number }
  | { type: 'updateSlide'; slideId: string; changes: PresentationSlideChanges }
  | { type: 'removeSlide'; slideId: string }
  | { type: 'reorderSlide'; slideId: string; index: number }
  | { type: 'addNode'; slideId: string; node: PresentationNode; parentId?: string; index?: number }
  | { type: 'updateNode'; slideId: string; nodeId: string; changes: PresentationNodeChanges }
  | { type: 'removeNode'; slideId: string; nodeId: string }
  | { type: 'reorderNode'; slideId: string; nodeId: string; parentId?: string; index?: number };

export type PresentationEditorCommand =
  | { type: 'loadDocument'; document: PresentationDocument }
  | { type: 'setActiveSlide'; slideId: string }
  | { type: 'setStep'; step: number }
  | { type: 'setSelection'; selection: PresentationSelection[] };

export type PresentationEditorEvent =
  | { type: 'patch'; patch: PresentationPatch; transient?: boolean }
  | { type: 'patches'; patches: PresentationPatch[]; transient?: boolean }
  | { type: 'selectionChange'; selection: PresentationSelection[] }
  | { type: 'cameraChange'; slideId: string; camera: PresentationCamera; transient?: boolean };

export interface ApplyPresentationPatchOptions extends PresentationFactoryOptions {}

function resolveNow(options?: ApplyPresentationPatchOptions): string {
  return (options?.now ?? (() => new Date().toISOString()))();
}

function clampIndex(index: number | undefined, length: number): number {
  if (index == null || Number.isNaN(index)) return length;
  return Math.max(0, Math.min(index, length));
}

function insertAt<T>(items: readonly T[], item: T, index?: number): T[] {
  const next = [...items];
  next.splice(clampIndex(index, next.length), 0, item);
  return next;
}

function removeAt<T>(items: readonly T[], index: number): T[] {
  return items.filter((_, itemIndex) => itemIndex !== index);
}

function detachNode(
  nodes: readonly PresentationNode[],
  nodeId: string,
): { nodes: PresentationNode[]; removed: PresentationNode | null } {
  let removed: PresentationNode | null = null;
  const nextNodes: PresentationNode[] = [];

  for (const node of nodes) {
    if (node.id === nodeId) {
      removed = node;
      continue;
    }

    if (node.kind === 'group') {
      const nested = detachNode(node.children, nodeId);
      if (nested.removed) {
        removed = nested.removed;
        nextNodes.push({
          ...node,
          children: nested.nodes,
        });
        continue;
      }
    }

    nextNodes.push(node);
  }

  return { nodes: nextNodes, removed };
}

function insertNode(
  nodes: readonly PresentationNode[],
  node: PresentationNode,
  parentId?: string,
  index?: number,
): PresentationNode[] {
  if (!parentId) {
    return insertAt(nodes, node, index);
  }

  let inserted = false;
  const nextNodes = nodes.map((current) => {
    if (current.kind === 'group') {
      if (current.id === parentId) {
        inserted = true;
        return {
          ...current,
          children: insertAt(current.children, node, index),
        };
      }

      const nestedChildren = insertNode(current.children, node, parentId, index);
      if (nestedChildren !== current.children) {
        inserted = true;
        return {
          ...current,
          children: nestedChildren,
        };
      }
    }
    return current;
  });

  return inserted ? nextNodes : nodes as PresentationNode[];
}

function updateNode(
  nodes: readonly PresentationNode[],
  nodeId: string,
  changes: PresentationNodeChanges,
): PresentationNode[] {
  let changed = false;
  const nextNodes = nodes.map((node) => {
    if (node.id === nodeId) {
      changed = true;
      const next: PresentationNode = {
        ...node,
        ...changes,
      } as PresentationNode;

      next.frame = changes.frame ? { ...node.frame, ...changes.frame } : node.frame;
      if (Object.prototype.hasOwnProperty.call(changes, 'style')) {
        next.style = changes.style ?? undefined;
      } else {
        next.style = node.style;
      }
      if (Object.prototype.hasOwnProperty.call(changes, 'fragment')) {
        next.fragment = changes.fragment ?? undefined;
      } else {
        next.fragment = node.fragment;
      }
      if (Object.prototype.hasOwnProperty.call(changes, 'textStyle') && node.kind === 'text') {
        next.textStyle = changes.textStyle ?? undefined;
      }
      if (Object.prototype.hasOwnProperty.call(changes, 'props') && node.kind === 'component') {
        next.props = changes.props ?? undefined;
      }
      return next;
    }

    if (node.kind === 'group') {
      const nestedChildren = updateNode(node.children, nodeId, changes);
      if (nestedChildren !== node.children) {
        changed = true;
        return {
          ...node,
          children: nestedChildren,
        };
      }
    }

    return node;
  });

  return changed ? nextNodes : nodes as PresentationNode[];
}

function removeNode(nodes: readonly PresentationNode[], nodeId: string): PresentationNode[] {
  return detachNode(nodes, nodeId).nodes;
}

function updateSlide(
  document: PresentationDocument,
  slideId: string,
  updater: (slide: PresentationSlide) => PresentationSlide,
): PresentationDocument {
  const slideIndex = document.slides.findIndex((slide) => slide.id === slideId);
  if (slideIndex === -1) return document;

  const nextSlides = [...document.slides];
  nextSlides[slideIndex] = updater(document.slides[slideIndex]);
  return {
    ...document,
    slides: nextSlides,
  };
}

export function applyPresentationPatch(
  document: PresentationDocument,
  patch: PresentationPatch,
  options?: ApplyPresentationPatchOptions,
): PresentationDocument {
  const normalized = normalizePresentationDocument(document, options);

  if (patch.type === 'replaceDocument') {
    return normalizePresentationDocument(patch.document, options);
  }

  let next: PresentationDocument = normalized;

  switch (patch.type) {
    case 'setDocumentMeta':
      next = {
        ...normalized,
        title: patch.changes.title ?? normalized.title,
        settings: patch.changes.settings
          ? {
              ...normalized.settings,
              ...patch.changes.settings,
              stage: patch.changes.settings.stage
                ? {
                    ...normalized.settings.stage,
                    ...patch.changes.settings.stage,
                  }
                : normalized.settings.stage,
            }
          : normalized.settings,
        theme: patch.changes.theme === null ? undefined : (patch.changes.theme ?? normalized.theme),
      };
      break;

    case 'upsertAsset':
      next = {
        ...normalized,
        assets: {
          ...normalized.assets,
          [patch.asset.id]: patch.asset,
        },
      };
      break;

    case 'removeAsset': {
      if (!Object.prototype.hasOwnProperty.call(normalized.assets, patch.assetId)) {
        break;
      }
      const assets = { ...normalized.assets };
      delete assets[patch.assetId];
      next = {
        ...normalized,
        assets,
      };
      break;
    }

    case 'addSlide':
      next = {
        ...normalized,
        slides: insertAt(
          normalized.slides,
          patch.slide ?? createPresentationSlide({}, options),
          patch.index,
        ),
      };
      break;

    case 'updateSlide':
      next = updateSlide(normalized, patch.slideId, (slide) => ({
        ...slide,
        ...patch.changes,
        camera: patch.changes.camera ? { ...slide.camera, ...patch.changes.camera } : slide.camera,
        transition: patch.changes.transition === null ? undefined : (patch.changes.transition ?? slide.transition),
      }));
      break;

    case 'removeSlide': {
      const slideIndex = normalized.slides.findIndex((slide) => slide.id === patch.slideId);
      if (slideIndex === -1) break;
      next = {
        ...normalized,
        slides: removeAt(normalized.slides, slideIndex),
      };
      break;
    }

    case 'reorderSlide': {
      const slideIndex = normalized.slides.findIndex((slide) => slide.id === patch.slideId);
      if (slideIndex === -1) break;
      const [slide] = normalized.slides.slice(slideIndex, slideIndex + 1);
      const withoutSlide = removeAt(normalized.slides, slideIndex);
      next = {
        ...normalized,
        slides: insertAt(withoutSlide, slide, patch.index),
      };
      break;
    }

    case 'addNode':
      next = updateSlide(normalized, patch.slideId, (slide) => ({
        ...slide,
        nodes: insertNode(slide.nodes, patch.node, patch.parentId, patch.index),
      }));
      break;

    case 'updateNode':
      next = updateSlide(normalized, patch.slideId, (slide) => ({
        ...slide,
        nodes: updateNode(slide.nodes, patch.nodeId, patch.changes),
      }));
      break;

    case 'removeNode':
      next = updateSlide(normalized, patch.slideId, (slide) => ({
        ...slide,
        nodes: removeNode(slide.nodes, patch.nodeId),
      }));
      break;

    case 'reorderNode':
      next = updateSlide(normalized, patch.slideId, (slide) => {
        const detached = detachNode(slide.nodes, patch.nodeId);
        if (!detached.removed) return slide;
        const insertedNodes = insertNode(detached.nodes, detached.removed, patch.parentId, patch.index);
        if (patch.parentId && insertedNodes === detached.nodes) {
          return slide;
        }
        return {
          ...slide,
          nodes: insertedNodes,
        };
      });
      break;
  }

  const finalized = normalizePresentationDocument(next, options);
  return {
    ...finalized,
    updatedAt: resolveNow(options),
  };
}

export function applyPresentationPatches(
  document: PresentationDocument,
  patches: readonly PresentationPatch[],
  options?: ApplyPresentationPatchOptions,
): PresentationDocument {
  let next = document;
  for (const patch of patches) {
    next = applyPresentationPatch(next, patch, options);
  }
  return next;
}

export function getSelectionSlide(
  document: PresentationDocument,
  selection: PresentationSelection | null,
): PresentationSlide | null {
  if (!selection) return null;
  return findPresentationSlide(document, selection.slideId);
}
