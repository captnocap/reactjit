import React, { useMemo, useState } from 'react';
import { Box, Image, Text } from './primitives';
import { Pressable } from './Pressable';
import type { Style } from './types';
import { ImageViewerModal, type ImageGalleryItem, type ImageViewerModalProps } from './ImageViewerModal';

export interface ImageGalleryProps {
  images: ImageGalleryItem[];
  layout?: 'wrap' | 'columns';
  columns?: number;
  gap?: number;
  thumbnailWidth?: number;
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
  layout,
  columns,
  gap = 10,
  thumbnailWidth = 220,
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

  const isColumnsLayout = layout === 'columns' || (layout !== 'wrap' && typeof columns === 'number');
  const normalizedColumns = clampColumns(columns ?? 3);
  // rjit-ignore-next-line — framework API: gallery layout compute
  const rows = useMemo<Array<Array<{ item: ImageGalleryItem; index: number }>>>(() => {
    if (!isColumnsLayout) return [];
    const groupedRows: Array<Array<{ item: ImageGalleryItem; index: number }>> = [];
    for (let rowStart = 0; rowStart < images.length; rowStart += normalizedColumns) {
      const rowItems = images
        .slice(rowStart, rowStart + normalizedColumns)
        .map((item, offset) => ({ item, index: rowStart + offset }));
      groupedRows.push(rowItems);
    }
    return groupedRows;
  }, [images, isColumnsLayout, normalizedColumns]);

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
          gap,
          flexDirection: isColumnsLayout ? 'column' : 'row',
          flexWrap: isColumnsLayout ? 'nowrap' : 'wrap',
          ...style,
        }}
      >
        {isColumnsLayout &&
          rows.map((row, rowIndex) => (
            <Box key={`row-${rowIndex}`} style={{ width: '100%', flexDirection: 'row', gap }}>
              {row.map(({ item, index }) => (
                <Pressable
                  key={item.id ?? `${item.src}-${index}`}
                  style={{
                    flexBasis: 0,
                    flexGrow: 1,
                    minWidth: 0,
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

              {row.length < normalizedColumns &&
                Array.from({ length: normalizedColumns - row.length }, (_, fillerIndex) => (
                  <Box key={`filler-${rowIndex}-${fillerIndex}`} style={{ flexBasis: 0, flexGrow: 1, minWidth: 0 }} />
                ))}
            </Box>
          ))}

        {!isColumnsLayout &&
          images.map((item, index) => (
              <Pressable
                key={item.id ?? `${item.src}-${index}`}
                style={{
                  width: thumbnailWidth,
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
