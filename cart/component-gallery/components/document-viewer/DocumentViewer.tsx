import { useCallback, useMemo, useState } from 'react';
import { classifiers as S } from '@reactjit/core';
import { DocumentOutline } from './DocumentOutline';
import { DocumentPage } from './DocumentPage';
import { DocumentToolbar } from './DocumentToolbar';
import { collectOutline, SAMPLE_DOCUMENT, type DocumentBlock, type DocumentModel, type DocumentSize } from './documentViewerShared';

export type DocumentViewerProps = {
  document?: DocumentModel;
  initialZoom?: number;
};

const SMALL_BREAKPOINT = 540;
const SCROLL_ACTIVE_SLOP = 24;

function estimateTextLines(text: string, dense = false): number {
  const charsPerLine = dense ? 58 : 66;
  return Math.max(1, Math.ceil(text.length / charsPerLine));
}

function estimateHeaderHeight(document: DocumentModel): number {
  let height = 18;
  if (document.subtitle) height += 10 + 14;
  if (document.author || document.date) height += 10 + 9;
  return height + 10;
}

function estimateBlockHeight(block: DocumentBlock): number {
  if (block.type === 'heading') {
    if (block.level === 1) return 18 + 6 + 1;
    if (block.level === 2) return 18;
    return 15;
  }
  if (block.type === 'paragraph') return estimateTextLines(block.text) * 16;
  if (block.type === 'list') {
    return block.items.reduce((total, item) => total + estimateTextLines(item, true) * 16, 0) + Math.max(0, block.items.length - 1) * 4;
  }
  if (block.type === 'quote') {
    return estimateTextLines(block.text) * 18 + (block.attribution ? 13 : 0);
  }
  if (block.type === 'code') return block.code.split('\n').length * 14 + 20;
  if (block.type === 'divider') return 1;
  return 0;
}

function estimateHeadingY(document: DocumentModel): Record<string, number> {
  const offsets: Record<string, number> = {};
  let y = 18 + estimateHeaderHeight(document);
  for (const block of document.blocks) {
    y += 10;
    if (block.type === 'heading') offsets[block.id] = Math.max(0, y - SCROLL_ACTIVE_SLOP);
    y += estimateBlockHeight(block);
  }
  return offsets;
}

export function DocumentViewer({ document = SAMPLE_DOCUMENT, initialZoom = 100 }: DocumentViewerProps) {
  const [width, setWidth] = useState<number | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [outlineOpen, setOutlineOpen] = useState<boolean>(true);
  const [zoom, setZoom] = useState<number>(initialZoom);
  const [scrollY, setScrollY] = useState<number>(0);
  const [contentTop, setContentTop] = useState<number | null>(null);
  const [headingY, setHeadingY] = useState<Record<string, number>>({});

  const outline = useMemo(() => collectOutline(document), [document]);
  const isSmall = width !== null && width < SMALL_BREAKPOINT;
  const size: DocumentSize = isSmall ? 'compact' : 'comfortable';
  const showOutline = !isSmall && outlineOpen && outline.length > 0;
  const estimatedHeadingY = useMemo(() => estimateHeadingY(document), [document]);
  const measuredHeadingY = useMemo<Record<string, number>>(() => {
    if (contentTop === null) return {};
    const offsets: Record<string, number> = {};
    for (const id of Object.keys(headingY)) {
      offsets[id] = Math.max(0, headingY[id] - contentTop - SCROLL_ACTIVE_SLOP);
    }
    return offsets;
  }, [contentTop, headingY]);
  const headingOffsets = useMemo(() => ({ ...estimatedHeadingY, ...measuredHeadingY }), [estimatedHeadingY, measuredHeadingY]);

  const activeSection = useMemo(() => {
    if (!activeId) return outline[0]?.text ?? null;
    return outline.find((entry) => entry.id === activeId)?.text ?? null;
  }, [activeId, outline]);

  const handleHeadingLayout = useCallback((id: string, y: number) => {
    if (!Number.isFinite(y)) return;
    setHeadingY((prev) => (prev[id] === y ? prev : { ...prev, [id]: y }));
  }, []);

  const handleContentLayout = useCallback((y: number) => {
    if (!Number.isFinite(y)) return;
    setContentTop((prev) => (prev === y ? prev : y));
  }, []);

  const selectSection = useCallback(
    (id: string) => {
      setActiveId(id);
      const target = headingOffsets[id];
      if (typeof target === 'number') setScrollY(Math.max(0, target));
    },
    [headingOffsets],
  );

  const handlePageScroll = useCallback(
    (payload: any) => {
      const next = typeof payload?.scrollY === 'number' ? payload.scrollY : scrollY;
      if (next !== scrollY) setScrollY(next);
      let nextActive = outline[0]?.id ?? null;
      for (const entry of outline) {
        const y = headingOffsets[entry.id];
        if (typeof y === 'number' && y <= next + SCROLL_ACTIVE_SLOP) nextActive = entry.id;
      }
      if (nextActive && nextActive !== activeId) setActiveId(nextActive);
    },
    [activeId, headingOffsets, outline, scrollY],
  );

  return (
    <S.DocShell
      onLayout={(rect: any) => {
        if (!rect) return;
        const next = Number.isFinite(rect.width) ? rect.width : null;
        if (next !== null && next !== width) setWidth(next);
      }}
    >
      <DocumentToolbar
        title={document.title}
        activeSection={activeSection}
        size={size}
        outlineVisible={showOutline}
        canToggleOutline={!isSmall && outline.length > 0}
        onToggleOutline={() => setOutlineOpen((prev) => !prev)}
        zoomPct={zoom}
        onZoomIn={() => setZoom((z) => Math.min(200, z + 10))}
        onZoomOut={() => setZoom((z) => Math.max(60, z - 10))}
      />
      <S.DocBody>
        {showOutline ? (
          <DocumentOutline
            entries={outline}
            activeId={activeId ?? outline[0]?.id ?? null}
            onSelect={selectSection}
          />
        ) : null}
        <S.DocPageWrap>
          <DocumentPage
            document={document}
            size={size}
            scrollY={scrollY}
            onScroll={handlePageScroll}
            onContentLayout={handleContentLayout}
            onHeadingLayout={handleHeadingLayout}
          />
        </S.DocPageWrap>
      </S.DocBody>
    </S.DocShell>
  );
}
