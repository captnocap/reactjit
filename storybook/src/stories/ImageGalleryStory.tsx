import React, { useMemo, useState } from 'react';
import {
  Box,
  Text,
  ScrollView,
  Image,
  Pressable,
  ImageGallery,
  ImageViewerModal,
  HoverPreviewRowsGallery,
  BentoImageGallery,
  useRendererMode,
  type ImageGalleryItem,
} from '../../../packages/core/src';
import { useThemeColors } from '../../../packages/theme/src';
import { StoryPage, StorySection } from './_shared/StoryScaffold';

function StatusPill({ label }: { label: string }) {
  const c = useThemeColors();
  return (
    <Box
      style={{
        backgroundColor: c.bgAlt,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: c.border,
        paddingLeft: 10,
        paddingRight: 10,
        paddingTop: 4,
        paddingBottom: 4,
      }}
    >
      <Text style={{ fontSize: 10, color: c.textSecondary }}>{label}</Text>
    </Box>
  );
}

function HoverPreviewSplit({ images }: { images: ImageGalleryItem[] }) {
  const c = useThemeColors();
  const [previewIndex, setPreviewIndex] = useState(0);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerIndex, setViewerIndex] = useState(0);
  const preview = images[previewIndex] || images[0];

  if (!preview) return null;

  return (
    <Box style={{ width: '100%', flexDirection: 'row', gap: 10 }}>
      <Pressable
        onPress={() => {
          setViewerIndex(previewIndex);
          setViewerOpen(true);
        }}
        style={({ hovered, pressed }) => ({
          flexGrow: 1,
          borderRadius: 10,
          overflow: 'hidden',
          borderWidth: 1,
          borderColor: hovered ? c.primary : c.border,
          backgroundColor: c.bgAlt,
          opacity: pressed ? 0.9 : 1,
        })}
      >
        <Image src={preview.src} style={{ width: '100%', height: 360, objectFit: 'cover' }} />
        <Box style={{ padding: 8, gap: 2 }}>
          <Text style={{ fontSize: 11, color: c.text, fontWeight: 'normal' }}>{preview.title || 'Preview'}</Text>
          <Text style={{ fontSize: 10, color: c.textSecondary }}>
            Hover or click tiles in the right panel to swap preview
          </Text>
        </Box>
      </Pressable>

      <Box
        style={{
          width: 350,
          minWidth: 300,
          height: 410,
          backgroundColor: c.bgAlt,
          borderRadius: 10,
          borderWidth: 1,
          borderColor: c.border,
          padding: 8,
          gap: 8,
        }}
      >
        <Text style={{ fontSize: 10, color: c.textSecondary, textAlign: 'center' }}>
          Gallery Panel
        </Text>
        <ScrollView style={{ flexGrow: 1, width: '100%' }}>
          <Box style={{ width: '100%', flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center', paddingBottom: 2 }}>
            {images.slice(0, 18).map((item, index) => (
              <Pressable
                key={item.id ?? `${item.src}-${index}`}
                onHoverIn={() => setPreviewIndex(index)}
                onPressIn={() => setPreviewIndex(index)}
                onPress={() => {
                  setViewerIndex(index);
                  setViewerOpen(true);
                }}
                style={({ hovered, pressed }) => ({
                  width: 100,
                  borderRadius: 8,
                  overflow: 'hidden',
                  borderWidth: 1,
                  borderColor: index === previewIndex ? c.primary : hovered ? c.textSecondary : c.border,
                  backgroundColor: c.bg,
                  opacity: pressed ? 0.9 : 1,
                })}
              >
                <Image src={item.thumbnailSrc || item.src} style={{ width: '100%', height: 75, objectFit: 'cover' }} />
              </Pressable>
            ))}
          </Box>
        </ScrollView>
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
        showFilmstrip
      />
    </Box>
  );
}

export function ImageGalleryStory() {
  const c = useThemeColors();
  const mode = useRendererMode();
  const [wrapViewerOpen, setWrapViewerOpen] = useState(false);
  const [wrapActiveIndex, setWrapActiveIndex] = useState(0);
  const wrapThumb = mode === 'native' ? 220 : 260;

  const images = useMemo<ImageGalleryItem[]>(() => {
    const placeholderStems = [
      'gallery_1.png',
      'gallery_2.png',
      'gallery_3.png',
      'gallery_4.png',
    ];

    return Array.from({ length: 24 }, (_, i) => {
      return {
        id: i,
        src: `lib/placeholders/${placeholderStems[i % 4]}`,
        title: `Post ${i + 1}`,
        subtitle: `Tile ${i + 1}`,
        description: 'Click any tile to open the modal viewer.',
      };
    });
  }, []);
  const wrapImages = images.slice(0, 8);

  return (
    <StoryPage>
      <Box style={{ gap: 2, alignItems: 'center' }}>
        <Text style={{ fontSize: 18, color: c.text, fontWeight: 'normal', textAlign: 'center' }}>Gallery Layout Setups</Text>
        <Text style={{ fontSize: 11, color: c.textDim, textAlign: 'center' }}>
        Same image collection shown in different row/preview systems.
        </Text>
      </Box>

      <StorySection index={1} title="Wrap Tiles">
        <ImageGallery
          images={wrapImages}
          layout="wrap"
          gap={10}
          thumbnailWidth={wrapThumb}
          thumbnailHeight={wrapThumb}
          showTitles={false}
          showFilmstrip={false}
          style={{ justifyContent: 'center' }}
          onImagePress={(index) => setWrapActiveIndex(index)}
          onViewerOpenChange={(isOpen, index) => {
            setWrapViewerOpen(isOpen);
            setWrapActiveIndex(index);
          }}
        />
        <Box style={{ width: '100%', flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8 }}>
          <StatusPill label={`Active: ${wrapImages[wrapActiveIndex]?.title || 'None'}`} />
          <StatusPill label={`Viewer: ${wrapViewerOpen ? 'Open' : 'Closed'}`} />
          <StatusPill label={`Tile: ${wrapThumb} x ${wrapThumb}`} />
        </Box>
      </StorySection>

      <StorySection index={2} title="Nested Rows + Hover Preview">
        <HoverPreviewRowsGallery images={images.slice(0, 18)} />
      </StorySection>

      <StorySection index={3} title="Side-by-Side Hover Preview">
        <HoverPreviewSplit images={images.slice(0, 18)} />
      </StorySection>

      <StorySection index={4} title="Bento Grid">
        <BentoImageGallery images={images.slice(0, 8)} />
      </StorySection>
    </StoryPage>
  );
}
