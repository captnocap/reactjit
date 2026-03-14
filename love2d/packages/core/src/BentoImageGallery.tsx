import React, { useState } from 'react';
import { Box, Image } from './primitives';
import { Pressable } from './Pressable';
import { ImageViewerModal, type ImageGalleryItem } from './ImageViewerModal';
import type { Style } from './types';

export interface BentoImageGalleryProps {
  images: ImageGalleryItem[];
  gap?: number;
  height?: number;
  maxWidth?: number;
  showFilmstrip?: boolean;
  loop?: boolean;
  style?: Style;
}

export function BentoImageGallery({
  images,
  gap = 10,
  height = 420,
  maxWidth = 1140,
  showFilmstrip = true,
  loop = true,
  style,
}: BentoImageGalleryProps) {
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerIndex, setViewerIndex] = useState(0);

  if (images.length === 0) return null;

  const renderTile = (slot: number, tileStyle: Style) => {
    const index = slot % images.length;
    const item = images[index];
    return (
      <Pressable
        key={`bento-${slot}`}
        onPress={() => {
          setViewerIndex(index);
          setViewerOpen(true);
        }}
        style={({ hovered, pressed }) => ({
          borderRadius: 10,
          overflow: 'hidden',
          borderWidth: 1,
          borderColor: hovered ? 'primary' : 'border',
          opacity: pressed ? 0.9 : 1,
          backgroundColor: 'bgAlt',
          ...tileStyle,
        })}
      >
        <Image
          src={item.thumbnailSrc || item.src}
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
      </Pressable>
    );
  };

  return (
    <Box style={{ width: '100%', alignItems: 'center', ...style }}>
      <Box
        style={{
          width: '100%',
          maxWidth,
          height,
          flexDirection: 'row',
          gap,
          flexWrap: 'nowrap',
          justifyContent: 'center',
          alignItems: 'flex-start',
        }}
      >
        <Box style={{ flexBasis: 0, flexGrow: 1.45, minWidth: 0, gap }}>
          {renderTile(0, { width: '100%', height: 280 })}
          <Box style={{ width: '100%', flexDirection: 'row', gap }}>
            {renderTile(1, { flexBasis: 0, flexGrow: 1, minWidth: 0, height: 130 })}
            {renderTile(2, { flexBasis: 0, flexGrow: 1, minWidth: 0, height: 130 })}
          </Box>
        </Box>

        <Box style={{ flexBasis: 0, flexGrow: 1.25, minWidth: 0, gap }}>
          <Box style={{ width: '100%', flexDirection: 'row', gap }}>
            {renderTile(3, { flexBasis: 0, flexGrow: 1, minWidth: 0, height: 130 })}
            {renderTile(4, { flexBasis: 0, flexGrow: 1, minWidth: 0, height: 130 })}
          </Box>
          {renderTile(5, { width: '100%', height: 280 })}
        </Box>

        <Box style={{ flexBasis: 0, flexGrow: 1.1, minWidth: 0, gap }}>
          {renderTile(6, { width: '100%', height: 205 })}
          {renderTile(7, { width: '100%', height: 205 })}
        </Box>
      </Box>

      <ImageViewerModal
        visible={viewerOpen}
        images={images}
        index={viewerIndex}
        onIndexChange={setViewerIndex}
        onRequestClose={() => setViewerOpen(false)}
        showFilmstrip={showFilmstrip}
        loop={loop}
      />
    </Box>
  );
}
