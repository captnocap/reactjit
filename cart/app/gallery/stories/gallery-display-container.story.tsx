import { Box, Row, Text } from '@reactjit/runtime/primitives';
import { defineGallerySection, defineGalleryStory } from '../types';
import { GalleryDisplayContainer } from '../components/gallery-display-container/GalleryDisplayContainer';

function CalibrationStage({ label }: { label: string }) {
  return (
    <Box
      style={{
        width: '100%',
        height: '100%',
        position: 'relative',
        backgroundColor: 'theme:bg',
      }}
    >
      <Box style={{ position: 'absolute', left: 16, top: 16, width: 72, height: 1, backgroundColor: 'theme:accentHot' }} />
      <Box style={{ position: 'absolute', left: 16, top: 16, width: 1, height: 72, backgroundColor: 'theme:accentHot' }} />
      <Box style={{ position: 'absolute', right: 16, bottom: 16, width: 72, height: 1, backgroundColor: 'theme:tool' }} />
      <Box style={{ position: 'absolute', right: 16, bottom: 16, width: 1, height: 72, backgroundColor: 'theme:tool' }} />
      <Box style={{ width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
        <Text style={{ fontFamily: 'monospace', fontSize: 36, fontWeight: 'bold', color: 'theme:ink' }}>{label}</Text>
        <Text style={{ fontFamily: 'monospace', fontSize: 10, color: 'theme:inkDim' }}>normalized stage area</Text>
      </Box>
    </Box>
  );
}

function WideExample() {
  return (
    <GalleryDisplayContainer code="A1" title="Wide Display Template" meta="720x420 · stage">
      <CalibrationStage label="16:9-ish" />
    </GalleryDisplayContainer>
  );
}

function MiniExample() {
  return (
    <GalleryDisplayContainer code="M1" title="Atom" ratio="mini" center>
      <Box style={{ width: 28, height: 28, borderRadius: 6, backgroundColor: 'theme:accentHot' }} />
    </GalleryDisplayContainer>
  );
}

function CompactExample() {
  return (
    <GalleryDisplayContainer code="M2" title="Compact Atom Template" meta="250x250" ratio="compact" stagePadding={12} center>
      <Box
        style={{
          width: 96,
          height: 96,
          borderWidth: 1,
          borderColor: 'theme:ruleBright',
          backgroundColor: 'theme:bg1',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text style={{ fontFamily: 'monospace', fontSize: 24, fontWeight: 'bold', color: 'theme:ink' }}>A</Text>
      </Box>
    </GalleryDisplayContainer>
  );
}

function SquareExample() {
  return (
    <GalleryDisplayContainer code="B2" title="Square Display Template" meta="420x420" ratio="square">
      <CalibrationStage label="1:1" />
    </GalleryDisplayContainer>
  );
}

function PortraitExample() {
  return (
    <GalleryDisplayContainer code="C3" title="Portrait Display Template" meta="420x560" ratio="portrait">
      <CalibrationStage label="TALL" />
    </GalleryDisplayContainer>
  );
}

function PaddedCenteredExample() {
  return (
    <GalleryDisplayContainer code="D4" title="Centered Component Template" meta="padded · centered" ratio="wide" stagePadding={24} center>
      <Box
        style={{
          width: 260,
          height: 160,
          borderWidth: 1,
          borderColor: 'theme:ruleBright',
          backgroundColor: 'theme:bg1',
          padding: 14,
          gap: 10,
        }}
      >
        <Text style={{ fontSize: 14, fontWeight: 'bold', color: 'theme:ink' }}>Child content keeps its own size</Text>
        <Text style={{ fontFamily: 'monospace', fontSize: 10, color: 'theme:inkDim' }}>The container owns chrome, ID, barcode, and viewport.</Text>
        <Row style={{ gap: 6 }}>
          <Box style={{ width: 16, height: 16, backgroundColor: 'theme:accentHot' }} />
          <Box style={{ width: 16, height: 16, backgroundColor: 'theme:tool' }} />
          <Box style={{ width: 16, height: 16, backgroundColor: 'theme:ok' }} />
        </Row>
      </Box>
    </GalleryDisplayContainer>
  );
}

export const galleryDisplayContainerSection = defineGallerySection({
  id: 'gallery-display-container',
  title: 'Gallery Display Container',
  group: { id: 'compositions', title: 'Compositions' },
  kind: 'atom',
  composedOf: [
    'cart/app/gallery/components/gallery-display-container/GalleryDisplayContainer.tsx',
    'cart/app/gallery/components.cls.ts',
  ],
  stories: [
    defineGalleryStory({
      id: 'gallery-display-container/default',
      title: 'Gallery Display Container',
      source: 'cart/app/gallery/components/gallery-display-container/GalleryDisplayContainer.tsx',
      status: 'ready',
      summary: 'Reusable display wrapper with normalized dimensions, thin title bar, stable code, and generated barcode.',
      tags: ['container', 'layout', 'display', 'normalization'],
      variants: [
        { id: 'mini', name: 'Mini M1', render: () => <MiniExample /> },
        { id: 'compact', name: 'Compact M2', render: () => <CompactExample /> },
        { id: 'wide', name: 'Wide A1', render: () => <WideExample /> },
        { id: 'square', name: 'Square B2', render: () => <SquareExample /> },
        { id: 'portrait', name: 'Portrait C3', render: () => <PortraitExample /> },
        { id: 'centered', name: 'Centered D4', render: () => <PaddedCenteredExample /> },
      ],
    }),
  ],
});
