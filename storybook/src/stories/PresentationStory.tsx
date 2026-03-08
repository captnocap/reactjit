import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Box, Pressable, Text } from '../../../packages/core/src';
import { useThemeColors } from '../../../packages/theme/src';
import {
  PresentationEditor,
  applyPresentationPatch,
  createPresentationDocument,
  createPresentationGroupNode,
  createPresentationShapeNode,
  createPresentationSlide,
  createPresentationTextNode,
  findPresentationNode,
  type PresentationCamera,
  type PresentationDocument,
  type PresentationEditorCameraEvent,
  type PresentationEditorPatchEvent,
  type PresentationEditorSelectionEvent,
  type PresentationPatch,
  type PresentationSelection,
} from '../../../packages/presentation/src';

let demoIdCounter = 0;
const DEMO_FACTORY = {
  idFactory: (prefix: string) => `${prefix}_${++demoIdCounter}`,
  now: () => '2026-03-07T00:00:00.000Z',
};
const STARTER_ACCENTS = ['#ff8f3d', '#2a7fff', '#18a77a', '#d4577b'];

function createDemoDocument(): PresentationDocument {
  demoIdCounter = 0;

  const coverCluster = createPresentationGroupNode({
    frame: { x: 980, y: 180, width: 360, height: 240 },
    children: [
      createPresentationShapeNode({
        shape: 'rectangle',
        fill: '#102030',
        radius: 36,
        frame: { x: 0, y: 0, width: 360, height: 240 },
      }, DEMO_FACTORY),
      createPresentationShapeNode({
        shape: 'ellipse',
        fill: '#ff8f3d',
        frame: { x: 34, y: 30, width: 120, height: 120 },
      }, DEMO_FACTORY),
      createPresentationShapeNode({
        shape: 'rectangle',
        fill: '#2a7fff',
        radius: 26,
        frame: { x: 162, y: 86, width: 158, height: 114 },
      }, DEMO_FACTORY),
      createPresentationTextNode({
        text: 'Native-authoring slice',
        frame: { x: 30, y: 172, width: 280, height: 42 },
        textStyle: { fontSize: 26, color: '#f8fbff', fontWeight: 'bold' },
      }, DEMO_FACTORY),
    ],
  }, DEMO_FACTORY);

  const introSlide = createPresentationSlide({
    title: 'Foundation',
    backgroundColor: '#f6f7fb',
    camera: { x: 0, y: 0, zoom: 1 },
    nodes: [
      createPresentationShapeNode({
        shape: 'rectangle',
        fill: '#ff8f3d',
        radius: 18,
        frame: { x: 96, y: 100, width: 260, height: 34 },
      }, DEMO_FACTORY),
      createPresentationTextNode({
        text: 'Presentation Editor',
        frame: { x: 96, y: 164, width: 760, height: 96 },
        textStyle: { fontSize: 60, color: '#102030', fontWeight: 'bold' },
      }, DEMO_FACTORY),
      createPresentationTextNode({
        text: 'Drag nodes, resize from the corners, pan the stage, and zoom with the wheel. Lua owns the interaction loop; JS only applies the committed patch.',
        frame: { x: 96, y: 286, width: 760, height: 160 },
        textStyle: { fontSize: 28, color: '#334155' },
      }, DEMO_FACTORY),
      createPresentationShapeNode({
        shape: 'rectangle',
        fill: '#ffffff',
        stroke: '#d0d8e2',
        strokeWidth: 2,
        radius: 24,
        frame: { x: 96, y: 516, width: 520, height: 196 },
      }, DEMO_FACTORY),
      createPresentationTextNode({
        text: 'Keep the document pure.\nKeep the hot path local.',
        frame: { x: 132, y: 560, width: 420, height: 120 },
        textStyle: { fontSize: 34, color: '#102030', fontWeight: 'bold' },
      }, DEMO_FACTORY),
      coverCluster,
    ],
  }, DEMO_FACTORY);

  const roadmapSlide = createPresentationSlide({
    title: 'Next Slice',
    backgroundColor: '#f4f7ff',
    camera: { x: 0, y: 0, zoom: 1 },
    nodes: [
      createPresentationTextNode({
        text: 'What ships after this',
        frame: { x: 110, y: 120, width: 760, height: 70 },
        textStyle: { fontSize: 54, color: '#102030', fontWeight: 'bold' },
      }, DEMO_FACTORY),
      createPresentationShapeNode({
        shape: 'rectangle',
        fill: '#ffffff',
        stroke: '#d2dae6',
        strokeWidth: 2,
        radius: 24,
        frame: { x: 110, y: 240, width: 480, height: 420 },
      }, DEMO_FACTORY),
      createPresentationTextNode({
        text: '1. Multi-slide strip\n2. Image and video nodes\n3. Player mode from the same document\n4. World camera once the single-slide editor is solid',
        frame: { x: 148, y: 284, width: 396, height: 290 },
        textStyle: { fontSize: 30, color: '#253649' },
      }, DEMO_FACTORY),
      createPresentationShapeNode({
        shape: 'ellipse',
        fill: '#ff8f3d',
        frame: { x: 854, y: 198, width: 246, height: 246 },
      }, DEMO_FACTORY),
      createPresentationShapeNode({
        shape: 'rectangle',
        fill: '#102030',
        radius: 34,
        frame: { x: 1064, y: 356, width: 330, height: 252 },
      }, DEMO_FACTORY),
      createPresentationTextNode({
        text: 'Single-slide first',
        frame: { x: 1106, y: 430, width: 248, height: 48 },
        textStyle: { fontSize: 32, color: '#f8fbff', fontWeight: 'bold' },
      }, DEMO_FACTORY),
    ],
  }, DEMO_FACTORY);

  return createPresentationDocument({
    title: 'Presentation Editor Slice',
    settings: {
      aspectRatio: '16:9',
      stage: { width: 1600, height: 900 },
      authoringMode: 'slide',
    },
    theme: {
      id: 'editor-demo',
      name: 'Editor Demo',
      colors: {
        background: '#f6f7fb',
        foreground: '#102030',
        accent: '#ff8f3d',
        surface: '#ffffff',
        muted: '#6b7280',
      },
    },
    slides: [introSlide, roadmapSlide],
  }, DEMO_FACTORY);
}

function createStarterSlide(index: number) {
  const accent = STARTER_ACCENTS[(index - 1) % STARTER_ACCENTS.length];

  return createPresentationSlide({
    title: `New Slide ${index}`,
    backgroundColor: '#f6f8fc',
    camera: { x: 0, y: 0, zoom: 1 },
    nodes: [
      createPresentationShapeNode({
        shape: 'rectangle',
        fill: accent,
        radius: 18,
        frame: { x: 104, y: 108, width: 248, height: 30 },
      }, DEMO_FACTORY),
      createPresentationTextNode({
        text: `New Slide ${index}`,
        frame: { x: 104, y: 164, width: 760, height: 88 },
        textStyle: { fontSize: 56, color: '#102030', fontWeight: 'bold' },
      }, DEMO_FACTORY),
      createPresentationShapeNode({
        shape: 'rectangle',
        fill: '#ffffff',
        stroke: '#d0d8e2',
        strokeWidth: 2,
        radius: 24,
        frame: { x: 104, y: 288, width: 612, height: 244 },
      }, DEMO_FACTORY),
      createPresentationTextNode({
        text: 'Click the stage to focus it, then move this slide with the native editor controls.\nArrow keys nudge the selected node. Shift plus Arrow moves 10 pixels.\nDelete removes the selection. Equal, minus, and zero control the camera.',
        frame: { x: 144, y: 338, width: 520, height: 152 },
        textStyle: { fontSize: 26, color: '#334155' },
      }, DEMO_FACTORY),
      createPresentationShapeNode({
        shape: 'ellipse',
        fill: accent,
        frame: { x: 1078, y: 242, width: 220, height: 220 },
      }, DEMO_FACTORY),
      createPresentationShapeNode({
        shape: 'rectangle',
        fill: '#102030',
        radius: 28,
        frame: { x: 1008, y: 470, width: 352, height: 182 },
      }, DEMO_FACTORY),
      createPresentationTextNode({
        text: 'Patch-based deck state.\nLua-owned interaction.',
        frame: { x: 1052, y: 526, width: 268, height: 86 },
        textStyle: { fontSize: 28, color: '#f8fbff', fontWeight: 'bold' },
      }, DEMO_FACTORY),
    ],
  }, DEMO_FACTORY);
}

const INITIAL_DOCUMENT = createDemoDocument();
const INITIAL_LOG = [
  'Click inside the editor to focus it.',
  'Drag a node to move it, drag a corner to resize it, and drag empty space to pan.',
  'Arrow keys nudge the selection. Shift plus Arrow moves 10 pixels. Delete, equal, minus, and zero work too.',
];

function pushLog(setter: React.Dispatch<React.SetStateAction<string[]>>, line: string) {
  setter((current) => [line, ...current].slice(0, 10));
}

function formatPatch(patch: PresentationPatch): string {
  switch (patch.type) {
    case 'updateNode':
      return `updateNode ${patch.nodeId}`;
    case 'updateSlide':
      return patch.changes.camera ? `updateSlide ${patch.slideId} camera` : `updateSlide ${patch.slideId}`;
    case 'addNode':
      return `addNode ${patch.node.id}`;
    case 'removeNode':
      return `removeNode ${patch.nodeId}`;
    case 'addSlide':
      return 'addSlide';
    case 'removeSlide':
      return `removeSlide ${patch.slideId}`;
    case 'reorderSlide':
      return `reorderSlide ${patch.slideId}`;
    case 'reorderNode':
      return `reorderNode ${patch.nodeId}`;
    case 'setDocumentMeta':
      return 'setDocumentMeta';
    case 'replaceDocument':
      return 'replaceDocument';
    case 'upsertAsset':
      return `upsertAsset ${patch.asset.id}`;
    case 'removeAsset':
      return `removeAsset ${patch.assetId}`;
    default:
      return patch.type;
  }
}

function ToolbarButton({
  label,
  active = false,
  disabled = false,
  onPress,
}: {
  label: string;
  active?: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  const c = useThemeColors();

  return (
    <Pressable onPress={disabled ? undefined : onPress}>
      <Box
        style={{
          paddingLeft: 10,
          paddingRight: 10,
          paddingTop: 7,
          paddingBottom: 7,
          borderRadius: 999,
          backgroundColor: active ? c.primary : c.surface,
          borderWidth: 1,
          borderColor: active ? c.primary : c.border,
          opacity: disabled ? 0.45 : 1,
        }}
      >
        <Text
          style={{
            fontSize: 10,
            color: active ? c.bg : c.text,
            fontWeight: 'bold',
          }}
        >
          {label}
        </Text>
      </Box>
    </Pressable>
  );
}

function Panel({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  const c = useThemeColors();

  return (
    <Box
      style={{
        backgroundColor: c.bgElevated,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: c.border,
        paddingLeft: 14,
        paddingRight: 14,
        paddingTop: 14,
        paddingBottom: 14,
        gap: 10,
      }}
    >
      <Text style={{ fontSize: 11, color: c.textDim, fontWeight: 'bold' }}>{title}</Text>
      {children}
    </Box>
  );
}

function KeyValue({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  const c = useThemeColors();

  return (
    <Box style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
      <Text style={{ fontSize: 10, color: c.textDim, width: 84 }}>{label}</Text>
      <Text style={{ fontSize: 10, color: c.text }}>{value}</Text>
    </Box>
  );
}

export function PresentationStory() {
  const c = useThemeColors();
  const [document, setDocument] = useState<PresentationDocument>(INITIAL_DOCUMENT);
  const [activeSlideId, setActiveSlideId] = useState(INITIAL_DOCUMENT.slides[0].id);
  const [selection, setSelection] = useState<PresentationSelection[]>([]);
  const [cameraPreview, setCameraPreview] = useState<PresentationCamera>(INITIAL_DOCUMENT.slides[0].camera);
  const [log, setLog] = useState<string[]>(INITIAL_LOG);

  const activeSlide = useMemo(
    () => document.slides.find((slide) => slide.id === activeSlideId) ?? document.slides[0],
    [document, activeSlideId],
  );
  const activeSlideIndex = Math.max(0, document.slides.findIndex((slide) => slide.id === activeSlide.id));
  const canRemoveSlide = document.slides.length > 1;

  const selectedNode = useMemo(
    () => (selection[0] ? findPresentationNode(activeSlide.nodes, selection[0].nodeId) : null),
    [activeSlide, selection],
  );

  useEffect(() => {
    setCameraPreview(activeSlide.camera);
  }, [activeSlide]);

  const handlePatch = useCallback((event: PresentationEditorPatchEvent) => {
    setDocument((current) => applyPresentationPatch(current, event.patch));
    pushLog(setLog, formatPatch(event.patch));
  }, []);

  const handleSelectionChange = useCallback((event: PresentationEditorSelectionEvent) => {
    const nextSelection = Array.isArray(event.selection) ? event.selection : [];
    setSelection(nextSelection);
    pushLog(setLog, nextSelection[0] ? `selected ${nextSelection[0].nodeId}` : 'selection cleared');
  }, []);

  const handleCameraChange = useCallback((event: PresentationEditorCameraEvent) => {
    if (event.slideId === activeSlideId) {
      setCameraPreview(event.camera);
    }
  }, [activeSlideId]);

  const handleReset = useCallback(() => {
    setDocument(INITIAL_DOCUMENT);
    setActiveSlideId(INITIAL_DOCUMENT.slides[0].id);
    setSelection([]);
    setCameraPreview(INITIAL_DOCUMENT.slides[0].camera);
    setLog(INITIAL_LOG);
  }, []);

  const handleAddSlide = useCallback(() => {
    const nextSlide = createStarterSlide(document.slides.length + 1);
    const patch: PresentationPatch = {
      type: 'addSlide',
      slide: nextSlide,
    };

    setDocument((current) => applyPresentationPatch(current, patch));
    setActiveSlideId(nextSlide.id);
    setSelection([]);
    pushLog(setLog, formatPatch(patch));
  }, [document.slides.length]);

  const handleRemoveSlide = useCallback(() => {
    if (!canRemoveSlide) {
      pushLog(setLog, 'removeSlide blocked for the last remaining slide');
      return;
    }

    const fallbackSlide = document.slides[activeSlideIndex + 1] ?? document.slides[activeSlideIndex - 1];
    const patch: PresentationPatch = {
      type: 'removeSlide',
      slideId: activeSlide.id,
    };

    setDocument((current) => applyPresentationPatch(current, patch));
    setActiveSlideId(fallbackSlide.id);
    setSelection([]);
    pushLog(setLog, formatPatch(patch));
  }, [activeSlide.id, activeSlideIndex, canRemoveSlide, document.slides]);

  const handleSelectSlide = useCallback((slideId: string) => {
    setActiveSlideId(slideId);
    setSelection([]);
  }, []);

  return (
    <Box
      style={{
        backgroundColor: c.bg,
        paddingLeft: 20,
        paddingRight: 20,
        paddingTop: 20,
        paddingBottom: 24,
        gap: 16,
      }}
    >
      <Box style={{ gap: 6 }}>
        <Text style={{ fontSize: 24, color: c.text, fontWeight: 'bold' }}>Presentation</Text>
        <Text style={{ fontSize: 11, color: c.textDim }}>
          Native editor slice. Lua owns selection, pan, zoom, drag, resize, and keyboard transforms. JS only receives commit-time patches and reapplies them to the document.
        </Text>
      </Box>

      <Box style={{ flexDirection: 'row', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        {document.slides.map((slide, index) => (
          <ToolbarButton
            key={slide.id}
            label={`Slide ${index + 1}: ${slide.title}`}
            active={slide.id === activeSlideId}
            onPress={() => handleSelectSlide(slide.id)}
          />
        ))}
        <ToolbarButton label="+ Slide" onPress={handleAddSlide} />
        <ToolbarButton label="Remove Slide" disabled={!canRemoveSlide} onPress={handleRemoveSlide} />
        <ToolbarButton label="Reset" onPress={handleReset} />
      </Box>

      <Box style={{ flexDirection: 'row', gap: 16, alignItems: 'flex-start' }}>
        <Box style={{ flexGrow: 1, flexBasis: 0 }}>
          <Panel title="Editor Surface">
            <PresentationEditor
              document={document}
              slideId={activeSlideId}
              onPatch={handlePatch}
              onSelectionChange={handleSelectionChange}
              onCameraChange={handleCameraChange}
              minZoom={0.3}
              maxZoom={5}
              style={{
                width: '100%',
                height: 560,
                borderWidth: 1,
                borderColor: c.border,
                borderRadius: 12,
              }}
            />
            <Text style={{ fontSize: 10, color: c.textDim }}>
              Click the editor to focus it. Arrow keys nudge, Shift plus Arrow moves 10 pixels, Delete removes the selection, and Equal, minus, or zero controls the camera. The hot path stays entirely in Lua.
            </Text>
          </Panel>
        </Box>

        <Box style={{ width: 320, gap: 12 }}>
          <Panel title="Active Slide">
            <KeyValue label="slide" value={`${activeSlideIndex + 1} / ${document.slides.length}`} />
            <KeyValue label="title" value={activeSlide.title || '(untitled)'} />
            <KeyValue label="nodes" value={String(activeSlide.nodes.length)} />
            <KeyValue label="stage" value={`${document.settings.stage.width} x ${document.settings.stage.height}`} />
            <KeyValue label="camera x" value={cameraPreview.x.toFixed(2)} />
            <KeyValue label="camera y" value={cameraPreview.y.toFixed(2)} />
            <KeyValue label="zoom" value={cameraPreview.zoom.toFixed(2)} />
          </Panel>

          <Panel title="Selection">
            {selectedNode ? (
              <Box style={{ gap: 8 }}>
                <KeyValue label="id" value={selectedNode.id} />
                <KeyValue label="kind" value={selectedNode.kind} />
                <KeyValue
                  label="frame"
                  value={`${selectedNode.frame.x}, ${selectedNode.frame.y}, ${selectedNode.frame.width}, ${selectedNode.frame.height}`}
                />
                {selectedNode.kind === 'text' ? (
                  <Text style={{ fontSize: 10, color: c.text }}>{selectedNode.text}</Text>
                ) : selectedNode.kind === 'shape' ? (
                  <Text style={{ fontSize: 10, color: c.text }}>{selectedNode.shape}</Text>
                ) : null}
              </Box>
            ) : (
              <Text style={{ fontSize: 10, color: c.textDim }}>Nothing selected.</Text>
            )}
          </Panel>

          <Panel title="Shortcuts">
            <Box style={{ gap: 6 }}>
              <Text style={{ fontSize: 10, color: c.text }}>Click the editor surface to focus it.</Text>
              <Text style={{ fontSize: 10, color: c.text }}>Arrow keys move the selected node by 1 pixel.</Text>
              <Text style={{ fontSize: 10, color: c.text }}>Shift plus Arrow moves the selected node by 10 pixels.</Text>
              <Text style={{ fontSize: 10, color: c.text }}>Delete removes the selected node.</Text>
              <Text style={{ fontSize: 10, color: c.text }}>Wheel zooms. Equal, minus, and zero control zoom from the keyboard.</Text>
            </Box>
          </Panel>

          <Panel title="Event Log">
            <Box style={{ gap: 6 }}>
              {log.map((entry, index) => (
                <Text key={`${entry}_${index}`} style={{ fontSize: 10, color: index === 0 ? c.text : c.textSecondary }}>
                  {entry}
                </Text>
              ))}
            </Box>
          </Panel>
        </Box>
      </Box>
    </Box>
  );
}
