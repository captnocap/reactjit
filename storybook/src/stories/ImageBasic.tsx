import React, { useMemo } from 'react';
import { Box, Text, Image, useRendererMode } from '../../../packages/core/src';
import { useThemeColors } from '../../../packages/theme/src';
import { StoryPage, StorySection } from './_shared/StoryScaffold';

interface ImageVariant {
  id: string;
  title: string;
  note: string;
  src: string;
  objectFit: 'fill' | 'contain' | 'cover';
  frameHeight: number;
  avatar?: boolean;
}

export function ImageBasicStory() {
  const c = useThemeColors();
  const mode = useRendererMode();
  const sources = useMemo(() => {
    return [
      'lib/placeholders/landscape.png',
      'lib/placeholders/poster.png',
      'lib/placeholders/spotlight.png',
      'lib/placeholders/avatar.png',
    ];
  }, []);

  const variants = useMemo<ImageVariant[]>(() => [
    {
      id: 'fill',
      title: 'Default Fill',
      note: 'Fills bounds edge-to-edge.',
      src: sources[0],
      objectFit: 'fill',
      frameHeight: 112,
    },
    {
      id: 'contain',
      title: 'Object Fit: Contain',
      note: 'Preserves full image inside frame.',
      src: sources[1],
      objectFit: 'contain',
      frameHeight: 112,
    },
    {
      id: 'cover',
      title: 'Object Fit: Cover',
      note: 'Maintains ratio with cinematic crop.',
      src: sources[2],
      objectFit: 'cover',
      frameHeight: 112,
    },
    {
      id: 'rounded',
      title: 'Rounded Avatar',
      note: 'Circular crop for profile images.',
      src: sources[3],
      objectFit: 'cover',
      frameHeight: 112,
      avatar: true,
    },
  ], [sources]);

  return (
    <StoryPage>
        <Box style={{ gap: 2 }}>
          <Text style={{ fontSize: 18, color: c.text, fontWeight: 'normal' }}>Image Showcase</Text>
          <Text style={{ fontSize: 11, color: c.textDim }}>
            Clean image framing patterns for hero media, galleries, and avatars.
          </Text>
        </Box>

        <StorySection index={1} title="Featured Frame">
          <Box style={{ width: '100%', height: 180, borderRadius: 10, overflow: 'hidden', borderWidth: 1, borderColor: c.border }}>
            <Image src={sources[0]} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          </Box>
          <Text style={{ fontSize: 10, color: c.textSecondary }}>
            A wide hero image with stable cropping and consistent border treatment.
          </Text>
        </StorySection>

        <StorySection index={2} title="Object Fit Variants">
          <Box style={{ width: '100%', flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
            {variants.map((variant) => (
              <Box
                key={variant.id}
                style={{
                  flexGrow: 1,
                  backgroundColor: c.surface,
                  borderRadius: 10,
                  borderWidth: 1,
                  borderColor: c.border,
                  padding: 10,
                  gap: 6,
                }}
              >
                <Box style={{ gap: 1 }}>
                  <Text style={{ fontSize: 11, color: c.text, fontWeight: 'normal' }}>{variant.title}</Text>
                  <Text style={{ fontSize: 9, color: c.textSecondary }}>{variant.note}</Text>
                </Box>
                <Box
                  style={{
                    width: '100%',
                    height: variant.frameHeight,
                    borderRadius: 8,
                    overflow: 'hidden',
                    borderWidth: 1,
                    borderColor: c.border,
                    backgroundColor: c.bg,
                  }}
                >
                  {variant.avatar ? (
                    <Box style={{ width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center' }}>
                      <Image
                        src={variant.src}
                        style={{
                          width: 84,
                          height: 84,
                          borderRadius: 42,
                          objectFit: variant.objectFit,
                          borderWidth: 2,
                          borderColor: c.borderFocus,
                        }}
                      />
                    </Box>
                  ) : (
                    <Image src={variant.src} style={{ width: '100%', height: '100%', objectFit: variant.objectFit }} />
                  )}
                </Box>
              </Box>
            ))}
          </Box>
        </StorySection>
    </StoryPage>
  );
}
