import React, { useMemo, useState } from 'react';
import { Box, Text, ScrollView, ImageGallery, useRendererMode, type ImageGalleryItem } from '../../../packages/shared/src';
import { useThemeColors } from '../../../packages/theme/src';

export function ImageGalleryStory() {
  const c = useThemeColors();
  const mode = useRendererMode();
  const [viewerOpen, setViewerOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const columns = mode === 'native' ? 2 : 3;

  const images = useMemo<ImageGalleryItem[]>(() => {
    const placeholderStems = [
      'gallery_1.png',
      'gallery_2.png',
      'gallery_3.png',
      'gallery_4.png',
    ];

    return Array.from({ length: 8 }, (_, i) => {
      return {
        id: i,
        src: `lib/placeholders/${placeholderStems[i % 4]}`,
        title: `Frame ${i + 1}`,
        subtitle: i % 2 === 0 ? 'Landscape tile' : 'Portrait tile',
        description: 'Open from the grid in the built-in modal viewer.',
      };
    });
  }, []);

  return (
    <Box style={{ width: '100%', height: '100%', backgroundColor: c.bg, padding: 16 }}>
      <ScrollView style={{ flexGrow: 1 }}>
        <Box style={{ width: '100%', gap: 12, paddingBottom: 8 }}>
          <Box style={{ gap: 2 }}>
            <Text style={{ fontSize: 18, color: c.text, fontWeight: '700' }}>Image Gallery Showcase</Text>
            <Text style={{ fontSize: 11, color: c.textDim }}>
              Matching visual language with the Image story and a cleaner responsive grid.
            </Text>
          </Box>

          <Box
            style={{
              backgroundColor: c.bgElevated,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: c.border,
              padding: 12,
              gap: 8,
            }}
          >
            <Box style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
              <Box style={{ gap: 1, flexGrow: 1 }}>
                <Text style={{ fontSize: 12, color: c.text, fontWeight: '700' }}>Responsive Grid + Modal Viewer</Text>
                <Text style={{ fontSize: 9, color: c.textSecondary }}>
                  Select any tile to open the viewer. Arrow keys navigate on web.
                </Text>
              </Box>
              <Text style={{ fontSize: 10, color: c.textDim }}>
                {`${images.length}`} frames
              </Text>
            </Box>

            <ImageGallery
              images={images}
              columns={columns}
              gap={10}
              thumbnailHeight={110}
              showTitles
              showFilmstrip={false}
              onImagePress={(index) => setActiveIndex(index)}
              onViewerOpenChange={(isOpen, index) => {
                setViewerOpen(isOpen);
                setActiveIndex(index);
              }}
            />

            <Box style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
              <Text style={{ fontSize: 10, color: c.textSecondary }}>
                Active: {images[activeIndex]?.title || 'None'}
              </Text>
              <Text style={{ fontSize: 10, color: c.textDim }}>
                Viewer: {viewerOpen ? 'open' : 'closed'} | columns: {`${columns}`}
              </Text>
            </Box>
          </Box>
        </Box>
      </ScrollView>
    </Box>
  );
}
