import type { Color, Style } from '@reactjit/core';

import type {
  PresentationAsset,
  PresentationAuthoringMode,
  PresentationCamera,
  PresentationComponentNode,
  PresentationDocument,
  PresentationFragment,
  PresentationFrame,
  PresentationGroupNode,
  PresentationImageNode,
  PresentationNode,
  PresentationSettings,
  PresentationShapeKind,
  PresentationShapeNode,
  PresentationSlide,
  PresentationTextNode,
  PresentationTheme,
  PresentationTransition,
  PresentationVideoNode,
} from './types';

export interface PresentationFactoryOptions {
  idFactory?: (prefix: string) => string;
  now?: () => string;
}

export interface CreatePresentationDocumentOptions {
  id?: string;
  title?: string;
  createdAt?: string;
  updatedAt?: string;
  settings?: Partial<PresentationSettings>;
  theme?: PresentationTheme;
  assets?: Record<string, PresentationAsset>;
  slides?: PresentationSlide[];
}

export interface CreatePresentationSlideOptions {
  id?: string;
  title?: string;
  notes?: string;
  backgroundColor?: Color;
  transition?: PresentationTransition;
  camera?: Partial<PresentationCamera>;
  nodes?: PresentationNode[];
}

export interface CreatePresentationNodeOptions {
  id?: string;
  name?: string;
  frame?: Partial<PresentationFrame>;
  style?: Style;
  fragment?: PresentationFragment;
  locked?: boolean;
  hidden?: boolean;
  opacity?: number;
  meta?: Record<string, unknown>;
}

export interface CreatePresentationTextNodeOptions extends CreatePresentationNodeOptions {
  text?: string;
  placeholder?: string;
  textStyle?: Style;
}

export interface CreatePresentationShapeNodeOptions extends CreatePresentationNodeOptions {
  shape?: PresentationShapeKind;
  fill?: Color;
  stroke?: Color;
  strokeWidth?: number;
  radius?: number;
}

export interface CreatePresentationImageNodeOptions extends CreatePresentationNodeOptions {
  assetId?: string;
  alt?: string;
  fit?: Style['objectFit'];
}

export interface CreatePresentationVideoNodeOptions extends CreatePresentationNodeOptions {
  assetId?: string;
  fit?: Style['objectFit'];
  autoplay?: boolean;
  loop?: boolean;
  muted?: boolean;
}

export interface CreatePresentationComponentNodeOptions extends CreatePresentationNodeOptions {
  component?: string;
  props?: Record<string, unknown>;
}

export interface CreatePresentationGroupNodeOptions extends CreatePresentationNodeOptions {
  clip?: boolean;
  children?: PresentationNode[];
}

const DEFAULT_STAGE = Object.freeze({ width: 1600, height: 900 });
const DEFAULT_FRAME = Object.freeze({ x: 0, y: 0, width: 320, height: 180, rotation: 0, zIndex: 0 });
const DEFAULT_CAMERA = Object.freeze({ x: 0, y: 0, zoom: 1, rotation: 0 });

let generatedIdCounter = 0;

function defaultIdFactory(prefix: string): string {
  generatedIdCounter += 1;
  return `${prefix}_${Date.now().toString(36)}_${generatedIdCounter.toString(36)}`;
}

function defaultNow(): string {
  return new Date().toISOString();
}

function resolveFactory(options?: PresentationFactoryOptions): Required<PresentationFactoryOptions> {
  return {
    idFactory: options?.idFactory ?? defaultIdFactory,
    now: options?.now ?? defaultNow,
  };
}

function normalizeAuthoringMode(value: PresentationAuthoringMode | undefined): PresentationAuthoringMode {
  return value === 'world' ? 'world' : 'slide';
}

function normalizeFrame(frame?: Partial<PresentationFrame>): PresentationFrame {
  return {
    x: frame?.x ?? DEFAULT_FRAME.x,
    y: frame?.y ?? DEFAULT_FRAME.y,
    width: frame?.width ?? DEFAULT_FRAME.width,
    height: frame?.height ?? DEFAULT_FRAME.height,
    rotation: frame?.rotation ?? DEFAULT_FRAME.rotation,
    zIndex: frame?.zIndex ?? DEFAULT_FRAME.zIndex,
  };
}

function normalizeCamera(camera?: Partial<PresentationCamera>): PresentationCamera {
  return {
    x: camera?.x ?? DEFAULT_CAMERA.x,
    y: camera?.y ?? DEFAULT_CAMERA.y,
    zoom: camera?.zoom ?? DEFAULT_CAMERA.zoom,
    rotation: camera?.rotation ?? DEFAULT_CAMERA.rotation,
  };
}

function normalizeFragment(fragment?: PresentationFragment): PresentationFragment | undefined {
  if (!fragment) return undefined;
  const start = Math.max(0, fragment.start ?? 0);
  const end = fragment.end == null ? undefined : Math.max(start, fragment.end);
  return end == null ? { start } : { start, end };
}

function cloneStyle<T extends Style | undefined>(style: T): T {
  return style ? { ...style } as T : style;
}

function cloneMeta(meta: Record<string, unknown> | undefined): Record<string, unknown> | undefined {
  return meta ? { ...meta } : undefined;
}

function normalizeBaseNode<T extends PresentationNode>(
  node: T,
  fallbackKind: T['kind'],
  factory: Required<PresentationFactoryOptions>,
): T {
  return {
    ...node,
    id: node.id || factory.idFactory(fallbackKind),
    kind: node.kind ?? fallbackKind,
    frame: normalizeFrame(node.frame),
    style: cloneStyle(node.style),
    fragment: normalizeFragment(node.fragment),
    locked: node.locked ?? false,
    hidden: node.hidden ?? false,
    opacity: node.opacity ?? 1,
    meta: cloneMeta(node.meta),
  };
}

function normalizeNode(
  node: PresentationNode,
  factory: Required<PresentationFactoryOptions>,
): PresentationNode {
  switch (node.kind) {
    case 'text': {
      const normalized = normalizeBaseNode(node, 'text', factory) as PresentationTextNode;
      return {
        ...normalized,
        text: normalized.text ?? '',
        textStyle: cloneStyle(normalized.textStyle),
      };
    }
    case 'shape': {
      const normalized = normalizeBaseNode(node, 'shape', factory) as PresentationShapeNode;
      return {
        ...normalized,
        shape: normalized.shape ?? 'rectangle',
      };
    }
    case 'image': {
      const normalized = normalizeBaseNode(node, 'image', factory) as PresentationImageNode;
      return {
        ...normalized,
        assetId: normalized.assetId ?? '',
      };
    }
    case 'video': {
      const normalized = normalizeBaseNode(node, 'video', factory) as PresentationVideoNode;
      return {
        ...normalized,
        assetId: normalized.assetId ?? '',
        autoplay: normalized.autoplay ?? false,
        loop: normalized.loop ?? false,
        muted: normalized.muted ?? false,
      };
    }
    case 'component': {
      const normalized = normalizeBaseNode(node, 'component', factory) as PresentationComponentNode;
      return {
        ...normalized,
        component: normalized.component ?? '',
        props: normalized.props ? { ...normalized.props } : undefined,
      };
    }
    case 'group':
    default: {
      const normalized = normalizeBaseNode(
        node.kind === 'group' ? node : ({ ...node, kind: 'group', children: [] } as PresentationGroupNode),
        'group',
        factory,
      ) as PresentationGroupNode;
      return {
        ...normalized,
        clip: normalized.clip ?? false,
        children: (normalized.children ?? []).map((child) => normalizeNode(child, factory)),
      };
    }
  }
}

function normalizeAsset(asset: PresentationAsset): PresentationAsset {
  return {
    ...asset,
    meta: cloneMeta(asset.meta),
  };
}

export function createPresentationSlide(
  options: CreatePresentationSlideOptions = {},
  factoryOptions?: PresentationFactoryOptions,
): PresentationSlide {
  const factory = resolveFactory(factoryOptions);
  return normalizeSlide({
    id: options.id ?? factory.idFactory('slide'),
    title: options.title ?? '',
    notes: options.notes ?? '',
    backgroundColor: options.backgroundColor,
    transition: options.transition,
    camera: options.camera,
    nodes: options.nodes ?? [],
  }, factory);
}

function normalizeSlide(
  slide: CreatePresentationSlideOptions | PresentationSlide,
  factory: Required<PresentationFactoryOptions>,
): PresentationSlide {
  return {
    id: slide.id ?? factory.idFactory('slide'),
    title: slide.title ?? '',
    notes: slide.notes ?? '',
    backgroundColor: slide.backgroundColor,
    transition: slide.transition ? { ...slide.transition } : undefined,
    camera: normalizeCamera(slide.camera),
    nodes: (slide.nodes ?? []).map((node) => normalizeNode(node, factory)),
  };
}

export function createPresentationDocument(
  options: CreatePresentationDocumentOptions = {},
  factoryOptions?: PresentationFactoryOptions,
): PresentationDocument {
  const factory = resolveFactory(factoryOptions);
  const timestamp = options.createdAt ?? factory.now();
  const slides = options.slides && options.slides.length > 0
    ? options.slides.map((slide) => normalizeSlide(slide, factory))
    : [createPresentationSlide({}, factory)];

  return normalizePresentationDocument({
    schemaVersion: 1,
    id: options.id ?? factory.idFactory('deck'),
    title: options.title ?? 'Untitled Presentation',
    createdAt: timestamp,
    updatedAt: options.updatedAt ?? timestamp,
    settings: options.settings,
    theme: options.theme,
    assets: options.assets ?? {},
    slides,
  } as PresentationDocument, factory);
}

export function normalizePresentationDocument(
  document: PresentationDocument,
  factoryOptions?: PresentationFactoryOptions,
): PresentationDocument {
  const factory = resolveFactory(factoryOptions);
  const createdAt = document.createdAt ?? factory.now();
  const slides = (document.slides ?? []).map((slide) => normalizeSlide(slide, factory));

  return {
    schemaVersion: 1,
    id: document.id ?? factory.idFactory('deck'),
    title: document.title ?? 'Untitled Presentation',
    createdAt,
    updatedAt: document.updatedAt ?? createdAt,
    settings: {
      aspectRatio: document.settings?.aspectRatio ?? '16:9',
      stage: {
        width: document.settings?.stage?.width ?? DEFAULT_STAGE.width,
        height: document.settings?.stage?.height ?? DEFAULT_STAGE.height,
      },
      backgroundColor: document.settings?.backgroundColor,
      defaultTransition: document.settings?.defaultTransition
        ? { ...document.settings.defaultTransition }
        : undefined,
      authoringMode: normalizeAuthoringMode(document.settings?.authoringMode),
    },
    theme: document.theme
      ? {
          ...document.theme,
          colors: document.theme.colors ? { ...document.theme.colors } : undefined,
          typography: document.theme.typography ? { ...document.theme.typography } : undefined,
          defaultSlideStyle: cloneStyle(document.theme.defaultSlideStyle),
          defaultNodeStyle: cloneStyle(document.theme.defaultNodeStyle),
        }
      : undefined,
    assets: Object.fromEntries(
      Object.entries(document.assets ?? {}).map(([assetId, asset]) => [assetId, normalizeAsset(asset)]),
    ),
    slides: slides.length > 0 ? slides : [createPresentationSlide({}, factory)],
  };
}

export function createPresentationTextNode(
  options: CreatePresentationTextNodeOptions = {},
  factoryOptions?: PresentationFactoryOptions,
): PresentationTextNode {
  const factory = resolveFactory(factoryOptions);
  return normalizeNode({
    id: options.id ?? factory.idFactory('text'),
    kind: 'text',
    name: options.name,
    frame: options.frame,
    style: options.style,
    fragment: options.fragment,
    locked: options.locked,
    hidden: options.hidden,
    opacity: options.opacity,
    meta: options.meta,
    text: options.text ?? '',
    placeholder: options.placeholder,
    textStyle: options.textStyle,
  }, factory) as PresentationTextNode;
}

export function createPresentationShapeNode(
  options: CreatePresentationShapeNodeOptions = {},
  factoryOptions?: PresentationFactoryOptions,
): PresentationShapeNode {
  const factory = resolveFactory(factoryOptions);
  return normalizeNode({
    id: options.id ?? factory.idFactory('shape'),
    kind: 'shape',
    name: options.name,
    frame: options.frame,
    style: options.style,
    fragment: options.fragment,
    locked: options.locked,
    hidden: options.hidden,
    opacity: options.opacity,
    meta: options.meta,
    shape: options.shape ?? 'rectangle',
    fill: options.fill,
    stroke: options.stroke,
    strokeWidth: options.strokeWidth,
    radius: options.radius,
  }, factory) as PresentationShapeNode;
}

export function createPresentationImageNode(
  options: CreatePresentationImageNodeOptions = {},
  factoryOptions?: PresentationFactoryOptions,
): PresentationImageNode {
  const factory = resolveFactory(factoryOptions);
  return normalizeNode({
    id: options.id ?? factory.idFactory('image'),
    kind: 'image',
    name: options.name,
    frame: options.frame,
    style: options.style,
    fragment: options.fragment,
    locked: options.locked,
    hidden: options.hidden,
    opacity: options.opacity,
    meta: options.meta,
    assetId: options.assetId ?? '',
    alt: options.alt,
    fit: options.fit,
  }, factory) as PresentationImageNode;
}

export function createPresentationVideoNode(
  options: CreatePresentationVideoNodeOptions = {},
  factoryOptions?: PresentationFactoryOptions,
): PresentationVideoNode {
  const factory = resolveFactory(factoryOptions);
  return normalizeNode({
    id: options.id ?? factory.idFactory('video'),
    kind: 'video',
    name: options.name,
    frame: options.frame,
    style: options.style,
    fragment: options.fragment,
    locked: options.locked,
    hidden: options.hidden,
    opacity: options.opacity,
    meta: options.meta,
    assetId: options.assetId ?? '',
    fit: options.fit,
    autoplay: options.autoplay,
    loop: options.loop,
    muted: options.muted,
  }, factory) as PresentationVideoNode;
}

export function createPresentationComponentNode(
  options: CreatePresentationComponentNodeOptions = {},
  factoryOptions?: PresentationFactoryOptions,
): PresentationComponentNode {
  const factory = resolveFactory(factoryOptions);
  return normalizeNode({
    id: options.id ?? factory.idFactory('component'),
    kind: 'component',
    name: options.name,
    frame: options.frame,
    style: options.style,
    fragment: options.fragment,
    locked: options.locked,
    hidden: options.hidden,
    opacity: options.opacity,
    meta: options.meta,
    component: options.component ?? '',
    props: options.props,
  }, factory) as PresentationComponentNode;
}

export function createPresentationGroupNode(
  options: CreatePresentationGroupNodeOptions = {},
  factoryOptions?: PresentationFactoryOptions,
): PresentationGroupNode {
  const factory = resolveFactory(factoryOptions);
  return normalizeNode({
    id: options.id ?? factory.idFactory('group'),
    kind: 'group',
    name: options.name,
    frame: options.frame,
    style: options.style,
    fragment: options.fragment,
    locked: options.locked,
    hidden: options.hidden,
    opacity: options.opacity,
    meta: options.meta,
    clip: options.clip,
    children: options.children ?? [],
  }, factory) as PresentationGroupNode;
}

export function findPresentationSlide(
  document: PresentationDocument,
  slideId: string,
): PresentationSlide | null {
  return document.slides.find((slide) => slide.id === slideId) ?? null;
}

export function findPresentationNode(
  nodes: readonly PresentationNode[],
  nodeId: string,
): PresentationNode | null {
  for (const node of nodes) {
    if (node.id === nodeId) return node;
    if (node.kind === 'group') {
      const nested = findPresentationNode(node.children, nodeId);
      if (nested) return nested;
    }
  }
  return null;
}

export function visitPresentationNodes(
  nodes: readonly PresentationNode[],
  visitor: (node: PresentationNode) => void,
): void {
  for (const node of nodes) {
    visitor(node);
    if (node.kind === 'group') {
      visitPresentationNodes(node.children, visitor);
    }
  }
}

export function getSlideStepCount(slide: PresentationSlide): number {
  let maxStep = 0;
  visitPresentationNodes(slide.nodes, (node) => {
    if (!node.fragment) return;
    maxStep = Math.max(maxStep, node.fragment.end ?? node.fragment.start);
  });
  return maxStep;
}
