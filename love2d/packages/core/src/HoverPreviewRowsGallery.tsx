import React, { useMemo, useState } from 'react';
import { Box, Image, Text } from './primitives';
import { Pressable } from './Pressable';
import { ImageViewerModal, type ImageGalleryItem } from './ImageViewerModal';
import type { Style } from './types';

export interface HoverPreviewRowsGalleryProps {
  images: ImageGalleryItem[];
  thumbsPerRow?: number;
  maxRows?: number;
  gap?: number;
  previewHeight?: number;
  thumbnailHeight?: number;
  showFilmstrip?: boolean;
  loop?: boolean;
  style?: Style;
  hintText?: string;
}

export function HoverPreviewRowsGallery({
  images,
  thumbsPerRow = 5,
  maxRows = 3,
  gap = 8,
  previewHeight = 300,
  thumbnailHeight = 88,
  showFilmstrip = true,
  loop = true,
  style,
  hintText = 'Hover a tile below to swap preview, click to open viewer',
}: HoverPreviewRowsGalleryProps) {
  const [previewIndex, setPreviewIndex] = useState(0);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerIndex, setViewerIndex] = useState(0);
  const preview = images[previewIndex] || images[0];

  // rjit-ignore-next-line — framework API: gallery preview compute
  const thumbRows = useMemo(() => {
    const rows: Array<Array<{ item: ImageGalleryItem; index: number }>> = [];
    const end = Math.min(images.length, thumbsPerRow * maxRows);
    for (let start = 0; start < end; start += thumbsPerRow) {
      rows.push(
        images
          .slice(start, start + thumbsPerRow)
          .map((item, offset) => ({ item, index: start + offset }))
      );
    }
    return rows;
  }, [images, maxRows, thumbsPerRow]);

  if (!preview) return null;

  return (
    <Box style={{ width: '100%', gap: gap + 2, ...style }}>
      <Pressable
        onPress={() => {
          setViewerIndex(previewIndex);
          setViewerOpen(true);
        }}
        style={({ hovered, pressed }) => ({
          width: '100%',
          borderRadius: 10,
          overflow: 'hidden',
          borderWidth: 1,
          borderColor: hovered ? 'primary' : 'border',
          backgroundColor: 'bgAlt',
          opacity: pressed ? 0.9 : 1,
        })}
      >
        <Image src={preview.src} style={{ width: '100%', height: previewHeight, objectFit: 'cover' }} />
        <Box style={{ padding: 8, gap: 2 }}>
          <Text style={{ fontSize: 11, color: 'text', fontWeight: '700' }}>{preview.title || 'Preview'}</Text>
          <Text style={{ fontSize: 10, color: 'textSecondary' }}>{hintText}</Text>
        </Box>
      </Pressable>

      <Box style={{ width: '100%', gap }}>
        {thumbRows.map((row, rowIndex) => (
          <Box
            key={`thumb-row-${rowIndex}`}
            style={{ width: '100%', flexDirection: 'row', gap, flexWrap: 'wrap', justifyContent: 'center' }}
          >
            {row.map(({ item, index }) => (
              <Pressable
                key={item.id ?? `${item.src}-${index}`}
                onHoverIn={() => setPreviewIndex(index)}
                onPressIn={() => setPreviewIndex(index)}
                onPress={() => {
                  setViewerIndex(index);
                  setViewerOpen(true);
                }}
                style={({ hovered, pressed }) => ({
                  flexGrow: 1,
                  borderRadius: 8,
                  overflow: 'hidden',
                  borderWidth: 1,
                  borderColor: index === previewIndex ? 'primary' : hovered ? 'textSecondary' : 'border',
                  backgroundColor: 'bg',
                  opacity: pressed ? 0.9 : 1,
                })}
              >
                <Image src={item.thumbnailSrc || item.src} style={{ width: '100%', height: thumbnailHeight, objectFit: 'cover' }} />
              </Pressable>
            ))}
          </Box>
        ))}
      </Box>

      <ImageViewerModal
        visible={viewerOpen}
        images={images}
        index={viewerIndex}
        onIndexChange={(idx) => {
          setViewerIndex(idx);
          setPreviewIndex(idx);
        }}
        onRequestClose={() => setViewerOpen(false)}
        showFilmstrip={showFilmstrip}
        loop={loop}
      />
    </Box>
  );
}
