import React from 'react';
import { Box, Pressable, ScrollView, Text, useScaledStyle } from '@reactjit/core';
import type { Style } from '@reactjit/core';

import type { PresentationNode, PresentationSlide, PresentationSlideStripProps } from './types.ts';

const PANEL_BG = '#f7f8fb';
const PANEL_BORDER = '#d7deea';
const PANEL_TEXT = '#102030';
const PANEL_MUTED = '#5f6f82';
const ACTIVE_BG = '#fff2e8';
const ACTIVE_BORDER = '#ff8f3d';
const ACTION_BG = '#ffffff';
const ACTION_BG_ACTIVE = '#fff2e8';
const ACTION_BG_PRESSED = '#ffd9bf';
const ACTION_DISABLED = '#c5cfdb';

function resolveStripStyle(props: PresentationSlideStripProps): Style | undefined {
  const { w, h, style } = props;

  if (w === undefined && h === undefined) {
    return style;
  }

  const base: Style = {};
  if (w !== undefined) base.width = w;
  if (h !== undefined) base.height = h;

  return style ? { ...base, ...style } : base;
}

function visitNodes(nodes: readonly PresentationNode[], visitor: (node: PresentationNode) => void): void {
  for (const node of nodes) {
    visitor(node);
    if (node.kind === 'group') {
      visitNodes(node.children, visitor);
    }
  }
}

function summarizeSlide(slide: PresentationSlide): { preview: string; textCount: number; shapeCount: number; mediaCount: number } {
  let preview = '';
  let textCount = 0;
  let shapeCount = 0;
  let mediaCount = 0;

  visitNodes(slide.nodes, (node) => {
    if (node.kind === 'text') {
      textCount += 1;
      if (!preview) {
        preview = node.text.replace(/\s+/g, ' ').trim();
      }
    } else if (node.kind === 'shape') {
      shapeCount += 1;
    } else if (node.kind === 'image' || node.kind === 'video') {
      mediaCount += 1;
    }
  });

  if (!preview) {
    preview = `${textCount} text, ${shapeCount} shape, ${mediaCount} media`;
  }

  if (preview.length > 54) {
    preview = `${preview.slice(0, 51)}...`;
  }

  return { preview, textCount, shapeCount, mediaCount };
}

const ActionButton = React.memo(function ActionButton({
  label,
  disabled,
  onPress,
}: {
  label: string;
  disabled?: boolean;
  onPress?: () => void;
}) {
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={({ pressed, hovered }) => ({
        borderWidth: 1,
        borderColor: disabled ? ACTION_DISABLED : hovered || pressed ? ACTIVE_BORDER : PANEL_BORDER,
        backgroundColor: disabled
          ? PANEL_BG
          : pressed
            ? ACTION_BG_PRESSED
            : hovered
              ? ACTION_BG_ACTIVE
              : ACTION_BG,
        borderRadius: 10,
        paddingLeft: 10,
        paddingRight: 10,
        paddingTop: 7,
        paddingBottom: 7,
      })}
    >
      <Text style={{ fontSize: 10, color: disabled ? PANEL_MUTED : PANEL_TEXT, fontWeight: 'bold' }}>{label}</Text>
    </Pressable>
  );
});

export const PresentationSlideStrip = React.memo(function PresentationSlideStrip(props: PresentationSlideStripProps) {
  const {
    document,
    activeSlideId,
    title = 'Slides',
    onSelectSlide,
    onAddSlide,
    onDuplicateSlide,
    onMoveSlide,
    onRemoveSlide,
  } = props;

  const resolvedStyle = resolveStripStyle(props);
  const scaledStyle = useScaledStyle(resolvedStyle);
  const activeSlide = document.slides.find((slide) => slide.id === activeSlideId) ?? document.slides[0] ?? null;
  const activeSlideIndex = activeSlide ? document.slides.findIndex((slide) => slide.id === activeSlide.id) : -1;
  const canDuplicate = activeSlide != null;
  const canRemove = document.slides.length > 1 && activeSlide != null;
  const canMoveUp = activeSlideIndex > 0;
  const canMoveDown = activeSlideIndex >= 0 && activeSlideIndex < document.slides.length - 1;
  const slideSummaries = React.useMemo(
    () => document.slides.map((slide) => summarizeSlide(slide)),
    [document],
  );

  return (
    <Box
      style={{
        backgroundColor: PANEL_BG,
        borderWidth: 1,
        borderColor: PANEL_BORDER,
        borderRadius: 14,
        paddingLeft: 12,
        paddingRight: 12,
        paddingTop: 12,
        paddingBottom: 12,
        gap: 10,
        ...(scaledStyle || {}),
      }}
    >
      <Box style={{ gap: 4 }}>
        <Text style={{ fontSize: 13, color: PANEL_TEXT, fontWeight: 'bold' }}>{title}</Text>
        <Text style={{ fontSize: 10, color: PANEL_MUTED }}>
          {document.slides.length} slide{document.slides.length === 1 ? '' : 's'}
        </Text>
      </Box>

      <Box style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
        <ActionButton label="+ Slide" onPress={onAddSlide} />
        <ActionButton label="Duplicate" disabled={!canDuplicate} onPress={onDuplicateSlide} />
        <ActionButton
          label="Up"
          disabled={!canMoveUp}
          onPress={() => {
            if (activeSlide && activeSlideIndex > 0) {
              onMoveSlide?.(activeSlide.id, activeSlideIndex - 1);
            }
          }}
        />
        <ActionButton
          label="Down"
          disabled={!canMoveDown}
          onPress={() => {
            if (activeSlide && activeSlideIndex >= 0) {
              onMoveSlide?.(activeSlide.id, activeSlideIndex + 1);
            }
          }}
        />
        <ActionButton label="Remove" disabled={!canRemove} onPress={onRemoveSlide} />
      </Box>

      <ScrollView
        style={{
          flexGrow: 1,
          borderRadius: 10,
        }}
        contentContainerStyle={{
          gap: 10,
          paddingTop: 2,
          paddingBottom: 2,
        }}
      >
        {document.slides.map((slide, index) => {
          const summary = slideSummaries[index];
          const active = slide.id === (activeSlide?.id ?? '');

          return (
            <Pressable
              key={slide.id}
              onPress={() => onSelectSlide?.(slide.id)}
              style={({ pressed, hovered }) => ({
                borderWidth: 1,
                borderColor: active ? ACTIVE_BORDER : hovered || pressed ? ACTIVE_BORDER : PANEL_BORDER,
                backgroundColor: active
                  ? ACTIVE_BG
                  : pressed
                    ? ACTION_BG_ACTIVE
                    : hovered
                      ? '#ffffff'
                      : ACTION_BG,
                borderRadius: 12,
                paddingLeft: 12,
                paddingRight: 12,
                paddingTop: 12,
                paddingBottom: 12,
                gap: 8,
              })}
            >
              <Box style={{ gap: 8 }}>
                <Box style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={{ fontSize: 10, color: active ? PANEL_TEXT : PANEL_MUTED, fontWeight: 'bold' }}>
                    Slide {index + 1}
                  </Text>
                  <Text style={{ fontSize: 9, color: PANEL_MUTED }}>
                    {slide.nodes.length} node{slide.nodes.length === 1 ? '' : 's'}
                  </Text>
                </Box>

                <Box
                  style={{
                    borderWidth: 1,
                    borderColor: active ? ACTIVE_BORDER : PANEL_BORDER,
                    backgroundColor: slide.backgroundColor || '#ffffff',
                    borderRadius: 10,
                    paddingLeft: 10,
                    paddingRight: 10,
                    paddingTop: 10,
                    paddingBottom: 10,
                    gap: 8,
                    minHeight: 84,
                  }}
                >
                  <Text style={{ fontSize: 12, color: PANEL_TEXT, fontWeight: 'bold' }}>
                    {slide.title || `Untitled Slide ${index + 1}`}
                  </Text>
                  <Text style={{ fontSize: 10, color: PANEL_MUTED }}>{summary.preview}</Text>
                </Box>

                <Box style={{ flexDirection: 'row', gap: 8 }}>
                  <Text style={{ fontSize: 9, color: PANEL_MUTED }}>
                    {summary.textCount} text
                  </Text>
                  <Text style={{ fontSize: 9, color: PANEL_MUTED }}>
                    {summary.shapeCount} shape
                  </Text>
                  <Text style={{ fontSize: 9, color: PANEL_MUTED }}>
                    {summary.mediaCount} media
                  </Text>
                  <Text style={{ fontSize: 9, color: PANEL_MUTED }}>
                    zoom {slide.camera.zoom.toFixed(2)}
                  </Text>
                </Box>
              </Box>
            </Pressable>
          );
        })}
      </ScrollView>
    </Box>
  );
});
