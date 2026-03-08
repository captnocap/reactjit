import type { Color, Style } from '@reactjit/core';
import type { PresentationEditorCommand, PresentationPatch } from './patches';

export type PresentationAspectRatio = '16:9' | '4:3' | 'custom';
export type PresentationAuthoringMode = 'slide' | 'world';
export type PresentationTransitionKind = 'cut' | 'fade' | 'slide' | 'zoom';
export type PresentationNodeKind = 'group' | 'text' | 'shape' | 'image' | 'video' | 'component';
export type PresentationShapeKind = 'rectangle' | 'ellipse' | 'line';
export type PresentationEasing =
  | 'linear'
  | 'easeIn'
  | 'easeOut'
  | 'easeInOut'
  | 'bounce'
  | 'elastic';

export interface PresentationStageSize {
  width: number;
  height: number;
}

export interface PresentationFrame {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number;
  zIndex?: number;
}

export interface PresentationFragment {
  start: number;
  end?: number;
}

export interface PresentationCamera {
  x: number;
  y: number;
  zoom: number;
  rotation?: number;
}

export interface PresentationTransition {
  kind: PresentationTransitionKind;
  durationMs?: number;
  easing?: PresentationEasing;
  direction?: 'left' | 'right' | 'up' | 'down' | 'in' | 'out';
}

export interface PresentationTheme {
  id: string;
  name: string;
  colors?: {
    background?: Color;
    foreground?: Color;
    accent?: Color;
    surface?: Color;
    muted?: Color;
  };
  typography?: {
    titleFontFamily?: string;
    bodyFontFamily?: string;
    monospaceFontFamily?: string;
  };
  defaultSlideStyle?: Style;
  defaultNodeStyle?: Style;
}

export interface PresentationAsset {
  id: string;
  kind: 'image' | 'video' | 'audio' | 'document';
  src: string;
  mimeType?: string;
  title?: string;
  width?: number;
  height?: number;
  durationMs?: number;
  poster?: string;
  meta?: Record<string, unknown>;
}

export interface PresentationSettings {
  aspectRatio: PresentationAspectRatio;
  stage: PresentationStageSize;
  backgroundColor?: Color;
  defaultTransition?: PresentationTransition;
  authoringMode?: PresentationAuthoringMode;
}

export interface PresentationBaseNode {
  id: string;
  kind: PresentationNodeKind;
  name?: string;
  frame: PresentationFrame;
  style?: Style;
  fragment?: PresentationFragment;
  locked?: boolean;
  hidden?: boolean;
  opacity?: number;
  meta?: Record<string, unknown>;
}

export interface PresentationTextNode extends PresentationBaseNode {
  kind: 'text';
  text: string;
  placeholder?: string;
  textStyle?: Style;
}

export interface PresentationShapeNode extends PresentationBaseNode {
  kind: 'shape';
  shape: PresentationShapeKind;
  fill?: Color;
  stroke?: Color;
  strokeWidth?: number;
  radius?: number;
}

export interface PresentationImageNode extends PresentationBaseNode {
  kind: 'image';
  assetId: string;
  alt?: string;
  fit?: Style['objectFit'];
}

export interface PresentationVideoNode extends PresentationBaseNode {
  kind: 'video';
  assetId: string;
  fit?: Style['objectFit'];
  autoplay?: boolean;
  loop?: boolean;
  muted?: boolean;
}

export interface PresentationComponentNode extends PresentationBaseNode {
  kind: 'component';
  component: string;
  props?: Record<string, unknown>;
}

export interface PresentationGroupNode extends PresentationBaseNode {
  kind: 'group';
  clip?: boolean;
  children: PresentationNode[];
}

export type PresentationNode =
  | PresentationGroupNode
  | PresentationTextNode
  | PresentationShapeNode
  | PresentationImageNode
  | PresentationVideoNode
  | PresentationComponentNode;

export interface PresentationSlide {
  id: string;
  title: string;
  notes: string;
  backgroundColor?: Color;
  transition?: PresentationTransition;
  camera: PresentationCamera;
  nodes: PresentationNode[];
}

export interface PresentationDocument {
  schemaVersion: 1;
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  settings: PresentationSettings;
  theme?: PresentationTheme;
  assets: Record<string, PresentationAsset>;
  slides: PresentationSlide[];
}

export interface PresentationSelection {
  slideId: string;
  nodeId: string;
}

export interface PresentationEditorPatchEvent {
  patch: PresentationPatch;
  transient?: boolean;
  targetId?: number;
}

export interface PresentationEditorSelectionEvent {
  selection: PresentationSelection[];
  targetId?: number;
}

export interface PresentationEditorCameraEvent {
  slideId: string;
  camera: PresentationCamera;
  transient?: boolean;
  targetId?: number;
}

export interface PresentationEditorProps {
  document: PresentationDocument;
  slideId?: string;
  command?: PresentationEditorCommand;
  commandId?: string | number;
  style?: Style;
  w?: number | string;
  h?: number | string;
  showGrid?: boolean;
  showFrame?: boolean;
  allowPan?: boolean;
  allowZoom?: boolean;
  minZoom?: number;
  maxZoom?: number;
  onPatch?: (event: PresentationEditorPatchEvent) => void;
  onSelectionChange?: (event: PresentationEditorSelectionEvent) => void;
  onCameraChange?: (event: PresentationEditorCameraEvent) => void;
  key?: string | number;
}
