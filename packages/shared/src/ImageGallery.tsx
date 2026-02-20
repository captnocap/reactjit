import React, { useMemo, useState } from 'react';
import { Box, Image, Text } from './primitives';
import { Pressable } from './Pressable';
import type { Style } from './types';
import { ImageViewerModal, type ImageGalleryItem, type ImageViewerModalProps } from './ImageViewerModal';

export interface ImageGalleryProps {
  images: ImageGalleryItem[];
  columns?: number;
  gap?: number;
  thumbnailHeight?: number;
  showTitles?: boolean;
  loop?: boolean;
  showCounter?: boolean;
  showCaption?: boolean;
  showFilmstrip?: boolean;
  style?: Style;
  tileStyle?: Style;
  imageStyle?: Style;
  viewerStyle?: Style;
  viewerImageStyle?: Style;
  viewerProps?: Omit<
    ImageViewerModalProps,
    'visible' | 'images' | 'index' | 'onIndexChange' | 'onRequestClose'
  >;
  onImagePress?: (index: number, image: ImageGalleryItem) => void;
  onViewerOpenChange?: (isOpen: boolean, index: number) => void;
}

function clampColumns(columns: number): number {
  if (columns < 1) return 1;
  if (columns > 8) return 8;
  return columns;
}

export function ImageGallery({
  images,
  columns = 3,
  gap = 10,
  thumbnailHeight = 132,
  showTitles = true,
  loop = true,
  showCounter = true,
  showCaption = true,
  showFilmstrip = true,
  style,
  tileStyle,
  imageStyle,
  viewerStyle,
  viewerImageStyle,
  viewerProps,
  onImagePress,
  onViewerOpenChange,
}: ImageGalleryProps) {
  const [viewerVisible, setViewerVisible] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  const normalizedColumns = clampColumns(columns);
  const tileBasis = useMemo(() => `${100 / normalizedColumns}%`, [normalizedColumns]);

  const openViewer = (index: number) => {
    setActiveIndex(index);
    setViewerVisible(true);
    onViewerOpenChange?.(true, index);
  };

  const closeViewer = () => {
    setViewerVisible(false);
    onViewerOpenChange?.(false, activeIndex);
  };

  return (
    <>
      <Box
        style={{
          width: '100%',
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap,
          ...style,
        }}
      >
        {images.map((item, index) => (
          <Pressable
            key={item.id ?? `${item.src}-${index}`}
            style={{
              flexBasis: tileBasis,
              maxWidth: tileBasis,
              flexGrow: 1,
              minWidth: 120,
            }}
            onPress={() => {
              onImagePress?.(index, item);
              openViewer(index);
            }}
          >
            {({ pressed, hovered }) => (
              <Box
                style={{
                  width: '100%',
                  borderRadius: 8,
                  overflow: 'hidden',
                  borderWidth: 1,
                  borderColor: hovered ? 'borderFocus' : 'border',
                  backgroundColor: pressed ? 'surfaceHover' : 'surface',
                  opacity: pressed ? 0.88 : 1,
                  ...tileStyle,
                }}
              >
                <Image
                  src={item.thumbnailSrc || item.src}
                  style={{
                    width: '100%',
                    height: thumbnailHeight,
                    objectFit: 'cover',
                    ...imageStyle,
                  }}
                />
                {showTitles && (item.title || item.subtitle) && (
                  <Box style={{ padding: 8, gap: 1, backgroundColor: 'bgElevated' }}>
                    {item.title && (
                      <Text style={{ fontSize: 11, color: 'text', fontWeight: 'bold' }}>{item.title}</Text>
                    )}
                    {item.subtitle && (
                      <Text style={{ fontSize: 9, color: 'textSecondary' }}>{item.subtitle}</Text>
                    )}
                  </Box>
                )}
              </Box>
            )}
          </Pressable>
        ))}
      </Box>

      <ImageViewerModal
        visible={viewerVisible}
        images={images}
        index={activeIndex}
        onIndexChange={setActiveIndex}
        onRequestClose={closeViewer}
        loop={loop}
        showCounter={showCounter}
        showCaption={showCaption}
        showFilmstrip={showFilmstrip}
        style={viewerStyle}
        imageStyle={viewerImageStyle}
        {...viewerProps}
      />
    </>
  );
}
