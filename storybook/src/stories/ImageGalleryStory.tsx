import React, { useMemo, useState } from 'react';
import { Box, Text, Pressable, ImageGallery, ImageViewerModal, useRendererMode, type ImageGalleryItem } from '../../../packages/shared/src';
import { useThemeColors } from '../../../packages/theme/src';

const WEB_PLACEHOLDER_SRC = 'data:image/svg+xml,' + encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="960" height="640" viewBox="0 0 960 640">' +
  '<rect width="960" height="640" fill="#1f2937"/>' +
  '<text x="480" y="330" text-anchor="middle" fill="#cbd5e1" font-family="sans-serif" font-size="58">placeholder</text>' +
  '</svg>'
);
const NATIVE_PLACEHOLDER_SRC = 'lib/placeholder.png';

function StoryButton({
  label,
  onPress,
}: {
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress}>
      {({ pressed, hovered }) => (
        <Box
          style={{
            backgroundColor: pressed ? 'primaryPressed' : hovered ? 'primaryHover' : 'primary',
            borderRadius: 6,
            borderWidth: 1,
            borderColor: 'borderFocus',
            paddingLeft: 10,
            paddingRight: 10,
            paddingTop: 6,
            paddingBottom: 6,
          }}
        >
          <Text style={{ fontSize: 10, color: 'bg', fontWeight: 'bold' }}>{label}</Text>
        </Box>
      )}
    </Pressable>
  );
}

export function ImageGalleryStory() {
  const c = useThemeColors();
  const mode = useRendererMode();
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerIndex, setViewerIndex] = useState(0);
  const placeholderSrc = mode === 'native' ? NATIVE_PLACEHOLDER_SRC : WEB_PLACEHOLDER_SRC;

  const images = useMemo<ImageGalleryItem[]>(() => {
    return Array.from({ length: 8 }, (_, i) => {
      const label = `Frame ${i + 1}`;
      return {
        id: i,
        src: placeholderSrc,
        title: label,
        subtitle: `Sample ${i + 1}`,
        description: `Placeholder image in modal viewer.`,
      };
    });
  }, [placeholderSrc]);

  return (
    <Box style={{ width: '100%', height: '100%', backgroundColor: c.bg, padding: 16, gap: 12 }}>
      <Box style={{ gap: 2 }}>
        <Text style={{ fontSize: 18, color: c.text, fontWeight: 'bold' }}>Image Gallery + Modal Viewer</Text>
        <Text style={{ fontSize: 11, color: c.textDim }}>
          Click any tile to open a modal viewer. Use arrow keys or controls to navigate.
        </Text>
      </Box>

      <ImageGallery
        images={images}
        columns={4}
        gap={8}
        thumbnailHeight={96}
        showTitles
      />

      <Box style={{ flexDirection: 'row', gap: 8 }}>
        <StoryButton
          label="Open Viewer @ 1"
          onPress={() => {
            setViewerIndex(0);
            setViewerOpen(true);
          }}
        />
        <StoryButton
          label="Open Viewer @ 4"
          onPress={() => {
            setViewerIndex(3);
            setViewerOpen(true);
          }}
        />
      </Box>

      <Text style={{ fontSize: 10, color: c.textSecondary }}>
        Viewer state: {viewerOpen ? 'open' : 'closed'} | index: {`${viewerIndex + 1}`}
      </Text>

      <ImageViewerModal
        visible={viewerOpen}
        images={images}
        index={viewerIndex}
        onIndexChange={setViewerIndex}
        onRequestClose={() => setViewerOpen(false)}
        showFilmstrip={false}
      />
    </Box>
  );
}
